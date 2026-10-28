import { SIZE, cellAt, cloneGrid, findConflicts, hasConflict, isSafe, setCell } from './board';
import { generatePuzzle } from './generator';
import { solve } from './solver';
import {
  DEFAULT_BEST_KEY,
  DEFAULT_SAVE_KEY,
  clearSave,
  loadBest,
  loadSave,
  tryGetGlobalStorage,
  writeBest,
  writeSave
} from './storage';
import type {
  BestTimes,
  Difficulty,
  Digit,
  GameOptions,
  GameState,
  GameStatus,
  GivenMask,
  Grid,
  NoteGrid,
  Position,
  RandomSource,
  Clock,
  SaveStorage,
  SerializedSave,
  Snapshot
} from './types';

export type { GameOptions } from './types';

const DEFAULT_DIFFICULTY: Difficulty = 'easy';
const DEFAULT_UNDO_LIMIT = 50;

/** 深拷贝笔记网格。 */
function cloneNotes(notes: NoteGrid): NoteGrid {
  return notes.map((row) => row.map((cell) => cell.slice()));
}

/** 初始化 9×9 全空笔记。 */
function emptyNotes(): NoteGrid {
  return Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => [] as Digit[])
  );
}

/** 盘面上是否还留着任意一条笔记（笔记只能由用户 toggleNote 产生，故等价于「已动手」）。 */
function hasAnyNotes(notes: NoteGrid): boolean {
  return notes.some((row) => row.some((cell) => cell.length > 0));
}

/** 由题面推导「给定掩码」。 */
function maskFromPuzzle(puzzle: Grid): GivenMask {
  return puzzle.map((row) => row.map((v) => v !== 0));
}

/** 升序去重写回某格笔记。 */
function sortedUnique(digits: Digit[]): Digit[] {
  return Array.from(new Set(digits)).sort((a, b) => a - b);
}

/**
 * Sudoku —— 数独状态机与规则实现，与 UI 完全解耦。
 *
 * - 通过 `subscribe(fn)` 推完整 `GameState` 快照（不推 diff）；注册即收到一次。
 * - 每次改变局面的公开操作（input/erase/toggleNote/hint/newGame/undo）成功后
 *   走一次 `commit()`：写存档 + 通知订阅。`select()` 只更新选中并通知，不落盘。
 * - 谜题来源：默认按 `difficulty` 现场生成唯一解题；也可注入 `puzzle`（+可选 solution）
 *   用作固定题/测试。`newGame()` 总是重新随机生成一道。
 * - 计时：注入 `clock`（默认 Date.now）；`elapsedMs = baseMs + (clock()-origin)`，
 *   通关瞬间冻结为 `finalMs`。undo 回未到通关的快照会按当时累计值续表。
 *   起表时机 = 第一次真正改动局面的用户操作（填数 / 擦除 / 笔记 / 提示）；只选格浏览不起表。
 * - 存档：注入 storage（默认尝试 globalThis.localStorage）；`best` 是分难度最佳用时。
 */
export class Sudoku {
  private readonly rng: RandomSource;
  private readonly clock: Clock;
  private readonly storage: SaveStorage | null;
  private readonly saveKey: string;
  private readonly bestKey: string;
  private readonly undoLimit: number;
  private readonly fixedPuzzle: Grid | null;
  private readonly fixedSolution: Grid | null;

  private difficulty: Difficulty;
  private puzzle: Grid;
  private solution: Grid;
  // givenMask/grid/notes 由构造函数分派的 startNewGame/loadFromSave 必赋值；
  // selected 默认无选中。
  private givenMask!: GivenMask;
  private grid!: Grid;
  private notes!: NoteGrid;
  private selected: Position | null = null;
  private status: GameStatus = 'playing';
  private hintCount = 0;
  private mistakeCount = 0;
  private moveCount = 0;
  private history: Snapshot[] = [];

  // 计时三段量：started=false 时 elapsedMs 恒 0，首次改动局面（input/erase/toggleNote/hint）才起算。
  private started = false;
  private baseMs = 0;
  private origin = 0;
  private finalMs = 0;

  private best: BestTimes;

  private listeners = new Set<(state: GameState) => void>();
  private notifying = false;

  constructor(opts: GameOptions = {}) {
    this.rng = opts.rng ?? Math.random;
    this.clock = opts.clock ?? Date.now;
    this.storage = opts.storage === undefined ? tryGetGlobalStorage() : opts.storage;
    this.saveKey = opts.saveKey ?? DEFAULT_SAVE_KEY;
    this.bestKey = opts.bestKey ?? DEFAULT_BEST_KEY;
    this.undoLimit = opts.undoLimit ?? DEFAULT_UNDO_LIMIT;
    this.difficulty = opts.difficulty ?? DEFAULT_DIFFICULTY;
    this.best = loadBest(this.storage, this.bestKey);

    this.fixedPuzzle = opts.puzzle ? cloneGrid(opts.puzzle) : null;
    this.fixedSolution = opts.solution ? cloneGrid(opts.solution) : null;

    // 先给一个合法初值（构造分支会覆盖）。
    this.puzzle = this.fixedPuzzle ?? cloneGrid(generatePuzzle(this.difficulty, this.rng).puzzle);
    this.solution = this.deriveSolution(this.puzzle);

    const saved = opts.freshStart ? null : loadSave(this.storage, this.saveKey);
    if (saved && this.canReserve(saved)) {
      this.loadFromSave(saved);
    } else {
      this.startNewGame(this.difficulty);
    }
  }

  // ---------- 公共 API ----------

  /** 订阅状态变化，返回退订函数；注册后立刻收到一次当前快照。 */
  subscribe(fn: (state: GameState) => void): () => void {
    this.listeners.add(fn);
    try {
      fn(this.getState());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[game-sudoku] listener threw on subscribe:', err);
    }
    return () => {
      this.listeners.delete(fn);
    };
  }

  getState(): GameState {
    return {
      difficulty: this.difficulty,
      grid: cloneGrid(this.grid),
      givenMask: this.givenMask.map((row) => row.slice()),
      notes: cloneNotes(this.notes),
      selected: this.selected ? { ...this.selected } : null,
      conflicts: findConflicts(this.grid),
      status: this.status,
      elapsedSeconds: Math.floor(this.elapsedMs() / 1000),
      bestSeconds: this.best[this.difficulty],
      hintCount: this.hintCount,
      mistakeCount: this.mistakeCount,
      moveCount: this.moveCount,
      historySize: this.history.length
    };
  }

  getGrid(): Grid {
    return cloneGrid(this.grid);
  }

  getPuzzle(): Grid {
    return cloneGrid(this.puzzle);
  }

  getSolution(): Grid {
    return cloneGrid(this.solution);
  }

  canUndo(): boolean {
    return this.history.length > 0;
  }

  /** 选中某格（越界则忽略）。仅更新选中并通知订阅，不写存档、不入 undo 栈。 */
  select(row: number, col: number): void {
    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return;
    if (this.selected?.row === row && this.selected?.col === col) return;
    this.selected = { row, col };
    this.notify();
  }

  /**
   * 在选中格填数字。题面给定格 / 已通关时忽略。
   * 返回 true = 棋盘确有变化。填了与盘面冲突的值会计一次 mistake（仍允许填）。
   */
  input(digit: Digit): boolean {
    if (this.status === 'won') return false;
    const sel = this.selected;
    if (!sel) return false;
    if (this.givenMask[sel.row]?.[sel.col]) return false; // 题面给定，禁改
    if (cellAt(this.grid, sel.row, sel.col) === digit) return false; // 同值，无变化

    this.pushHistory();
    this.ensureStarted(); // 改动局面即起表
    setCell(this.grid, sel.row, sel.col, digit);
    const notesRow = this.notes[sel.row];
    if (notesRow) notesRow[sel.col] = []; // 有值即清空该格笔记
    this.moveCount++;
    if (!isSafe(this.grid, sel.row, sel.col, digit)) this.mistakeCount++;
    this.checkWin();
    this.commit();
    return true;
  }

  /** 擦除选中格（值与笔记一起清）。题面给定 / 已通关忽略。返回是否有变化。 */
  erase(): boolean {
    if (this.status === 'won') return false;
    const sel = this.selected;
    if (!sel) return false;
    if (this.givenMask[sel.row]?.[sel.col]) return false;
    const hadValue = cellAt(this.grid, sel.row, sel.col) !== 0;
    const notesRow = this.notes[sel.row];
    const hadNotes = !!notesRow?.[sel.col]?.length;
    if (!hadValue && !hadNotes) return false; // 本来就空，无变化

    this.pushHistory();
    this.ensureStarted(); // 擦掉东西同样算开始作答
    setCell(this.grid, sel.row, sel.col, 0);
    if (notesRow) notesRow[sel.col] = [];
    if (hadValue) this.moveCount++; // 擦掉一个「值」算一步；纯擦笔记不计步
    this.commit();
    return true;
  }

  /**
   * 切换选中空格的某条铅笔笔记。仅对「非给定且当前为空」的格生效。
   * 返回 true = 笔记集合确有变化。
   */
  toggleNote(digit: Digit): boolean {
    if (this.status === 'won') return false;
    const sel = this.selected;
    if (!sel) return false;
    if (this.givenMask[sel.row]?.[sel.col]) return false;
    if (cellAt(this.grid, sel.row, sel.col) !== 0) return false; // 有值不谈笔记

    const notesRow = this.notes[sel.row];
    if (!notesRow) return false;
    const current = notesRow[sel.col] ?? [];
    const has = current.includes(digit);
    this.pushHistory();
    this.ensureStarted(); // 记笔记也算开始作答
    notesRow[sel.col] = has
      ? sortedUnique(current.filter((d) => d !== digit))
      : sortedUnique([...current, digit]);
    this.commit();
    return true;
  }

  /**
   * 提示：优先填「选中的空格」，否则填第一个空格；写入解中的正确值并清该格笔记。
   * 返回 true = 确有一格被填。计一次 hint（不单独计 mistake）。
   */
  hint(): boolean {
    if (this.status === 'won') return false;
    const target = this.pickHintTarget();
    if (!target) return false;
    const answer = cellAt(this.solution, target.row, target.col);
    if (answer === 0) return false;

    this.pushHistory();
    this.ensureStarted(); // 提示也算开始作答，起表
    setCell(this.grid, target.row, target.col, answer);
    const notesRow = this.notes[target.row];
    if (notesRow) notesRow[target.col] = [];
    this.selected = target;
    this.hintCount++;
    this.moveCount++;
    this.checkWin();
    this.commit();
    return true;
  }

  /**
   * 开启新局：随机生成指定难度（默认沿用当前难度）的唯一解题，清空局面与历史，
   * 计时归零，best 保留。会清除旧存档并落一份新局存档。
   */
  newGame(difficulty: Difficulty = this.difficulty): void {
    this.startNewGame(difficulty);
    this.commit();
  }

  /** 撤销一步；返回是否成功。 */
  undo(): boolean {
    const s = this.history.pop();
    if (!s) return false;
    this.restoreSnapshot(s);
    this.commit();
    return true;
  }

  /** 清除当前存档（不影响 best）。 */
  clearSaved(): void {
    clearSave(this.storage, this.saveKey);
  }

  // ---------- 内部 ----------

  /** 由（部分）题面推导完整解：优先用注入的 solution，否则用 solve。 */
  private deriveSolution(puzzle: Grid): Grid {
    if (this.fixedSolution && !hasConflict(puzzle) && gridsCompatible(puzzle, this.fixedSolution)) {
      return cloneGrid(this.fixedSolution);
    }
    const solved = solve(puzzle);
    return solved ?? cloneGrid(puzzle);
  }

  /** 存档是否可续用：同难度、同题面（防切难度/换题后串档）。 */
  private canReserve(save: SerializedSave): boolean {
    if (save.difficulty !== this.difficulty) return false;
    // 有固定题面时只认同一道题；无固定题面时，允许续任何同难度存档。
    if (this.fixedPuzzle) return gridsCompatible(this.fixedPuzzle, save.puzzle);
    return true;
  }

  private startNewGame(difficulty: Difficulty): void {
    this.difficulty = difficulty;
    if (this.fixedPuzzle) {
      this.puzzle = cloneGrid(this.fixedPuzzle);
      this.solution = this.deriveSolution(this.puzzle);
    } else {
      const gen = generatePuzzle(difficulty, this.rng);
      this.puzzle = gen.puzzle;
      this.solution = gen.solution;
    }
    this.givenMask = maskFromPuzzle(this.puzzle);
    this.grid = cloneGrid(this.puzzle);
    this.notes = emptyNotes();
    this.selected = firstEmpty(this.grid);
    this.status = 'playing';
    this.hintCount = 0;
    this.mistakeCount = 0;
    this.moveCount = 0;
    this.history = [];
    this.started = false;
    this.baseMs = 0;
    this.finalMs = 0;
    this.origin = this.clock();
    this.clearSaved();
  }

  /** 首次改动局面（input/erase/toggleNote/hint）时懒起表；未起表前 elapsedMs 恒 0。 */
  private ensureStarted(): void {
    if (this.started) return;
    this.started = true;
    this.baseMs = 0;
    this.origin = this.clock();
  }

  private elapsedMs(): number {
    if (this.status === 'won') return this.finalMs;
    if (!this.started) return 0;
    return this.baseMs + (this.clock() - this.origin);
  }

  private checkWin(): void {
    if (this.status !== 'playing') return;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (cellAt(this.grid, r, c) === 0) return; // 仍有空格
      }
    }
    // 填满后判冲突；无冲突即通关。
    for (const row of findConflicts(this.grid)) {
      for (const v of row) if (v) return; // 填满但有冲突 → 不算通关
    }
    this.finalMs = this.baseMs + (this.clock() - this.origin);
    this.status = 'won';
    const secs = Math.floor(this.finalMs / 1000);
    const cur = this.best[this.difficulty];
    if (cur === null || secs < cur) {
      this.best[this.difficulty] = secs;
      writeBest(this.storage, this.bestKey, this.best);
    }
  }

  private pickHintTarget(): Position | null {
    const sel = this.selected;
    if (sel && cellAt(this.grid, sel.row, sel.col) === 0 && !this.givenMask[sel.row]?.[sel.col]) {
      return { ...sel };
    }
    return firstEmpty(this.grid);
  }

  private pushHistory(): void {
    const snap: Snapshot = {
      grid: cloneGrid(this.grid),
      notes: cloneNotes(this.notes),
      selected: this.selected ? { ...this.selected } : null,
      status: this.status,
      hintCount: this.hintCount,
      mistakeCount: this.mistakeCount,
      moveCount: this.moveCount,
      elapsedMs: this.elapsedMs(),
      started: this.started
    };
    this.history.push(snap);
    if (this.history.length > this.undoLimit) this.history.shift();
  }

  private restoreSnapshot(s: Snapshot): void {
    this.grid = cloneGrid(s.grid);
    this.notes = cloneNotes(s.notes);
    this.selected = s.selected ? { ...s.selected } : null;
    this.status = s.status;
    this.hintCount = s.hintCount;
    this.mistakeCount = s.mistakeCount;
    this.moveCount = s.moveCount;
    this.started = s.started;
    if (s.status === 'won') {
      this.finalMs = s.elapsedMs;
    } else {
      this.baseMs = s.elapsedMs;
      this.origin = this.clock();
    }
  }

  private loadFromSave(save: SerializedSave): void {
    this.difficulty = save.difficulty;
    this.puzzle = cloneGrid(save.puzzle);
    this.solution = cloneGrid(save.solution);
    this.givenMask = maskFromPuzzle(this.puzzle);
    this.grid = cloneGrid(save.grid);
    this.notes = save.notes ? cloneNotes(save.notes) : emptyNotes();
    this.status = save.status === 'won' ? 'won' : 'playing';
    this.hintCount = numberOr(save.hintCount, 0);
    this.mistakeCount = numberOr(save.mistakeCount, 0);
    this.moveCount = numberOr(save.moveCount, 0);
    this.history = [];
    this.selected = firstEmpty(this.grid);
    const elapsed = numberOr(save.elapsedMs, 0);
    // 续档时按局面推定是否已起表：通关 / 已有步数 / 有用时 / 留有笔记 → 已起表；
    // 否则（全新题面、只选中没动过）继续等到首次改动局面才走表。
    const dirty = this.moveCount > 0 || elapsed > 0 || hasAnyNotes(this.notes);
    this.started = this.status === 'won' || dirty;
    if (this.status === 'won') {
      this.finalMs = elapsed;
      this.baseMs = elapsed;
      this.origin = this.clock();
    } else {
      this.baseMs = elapsed;
      this.finalMs = 0;
      this.origin = this.clock();
    }
  }

  private commit(): void {
    writeSave(this.storage, this.saveKey, {
      version: 1,
      difficulty: this.difficulty,
      puzzle: cloneGrid(this.puzzle),
      solution: cloneGrid(this.solution),
      grid: cloneGrid(this.grid),
      notes: cloneNotes(this.notes),
      status: this.status,
      hintCount: this.hintCount,
      mistakeCount: this.mistakeCount,
      moveCount: this.moveCount,
      elapsedMs: this.elapsedMs()
    });
    this.notify();
  }

  private notify(): void {
    if (this.notifying) return;
    this.notifying = true;
    try {
      const snapshot = this.getState();
      for (const fn of this.listeners) {
        try {
          fn(snapshot);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[game-sudoku] listener threw:', err);
        }
      }
    } finally {
      this.notifying = false;
    }
  }
}

// ---------- 局部小工具（避免把棋盘遍历细节散进主流程） ----------

/** puzzle ⊂ solution：puzzle 非 0 处 solution 必须同值。 */
function gridsCompatible(puzzle: Grid, solution: Grid): boolean {
  for (let r = 0; r < puzzle.length; r++) {
    for (let c = 0; c < (puzzle[r]?.length ?? 0); c++) {
      const p = cellAt(puzzle, r, c);
      if (p !== 0 && cellAt(solution, r, c) !== p) return false;
    }
  }
  return true;
}

function firstEmpty(grid: Grid): Position | null {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (cellAt(grid, r, c) === 0) return { row: r, col: c };
    }
  }
  return null;
}

function numberOr(x: unknown, fallback: number): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : fallback;
}
