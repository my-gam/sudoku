/**
 * mount —— 把数独的完整 UI（棋盘 / 工具栏 / 数字键盘 / 通关浮层）渲染成 DOM，并接管全部交互。
 *
 * 设计目标（来自「把 DOM 操作收进 core」的诉求）：
 * - 一份 DOM 实现，vue / react / vanilla / IIFE 全都复用，不再各自手抄一遍棋盘渲染；
 * - IIFE 用法只需 `mount(宿主元素, 配置)`：零框架、零手写 DOM；
 * - core 仍保持「无副作用导入」——本模块只在 `mount()` 被调用时才碰 `document`，
 *   Node / SSR 下 import 本模块不会报错（仅调用 mount 会抛）。
 *
 * 渲染策略（性能与动画的折中）：
 * - 81 个 cell 只在挂载时建一次，之后每帧只做「最小差异更新」
 *   （类名用 classList.toggle、值/笔记只在内容变化时写），1s 心跳重绘几乎零成本；
 * - 落子弹跳：引擎在 `state.lastPop` 给出「哪格 + 递增 seq」，我们用「摘类 → 强制回流 → 加类」
 *   重播 CSS 动画，并用一个定时器把 `is-pop` 摘掉（> 动画时长，兼容 reduced-motion 不播动画的情况），
 *   `is-pop` 永远挂在格子、动画挂在 `.cell-value`（见 style.css，挂格子会被 box 的 overflow 裁切）。
 *
 * 主题：`auto` 由这里的 `matchMedia` 解析成 light/dark 并跟随系统变化；具体档直接写进根元素 `data-theme`。
 * 样式：默认自动把 style.css 注入一次 `<head>`（IIFE/vanilla 零配置），传 `injectStyle:false` 可关掉，
 * 改由宿主自己的 `@my-games/sudoku-core/style.css` import 接管（vue/react 适配器就走这条，避免重复）。
 */
import { Sudoku } from './game';
import { resolveTheme, type SudokuTheme } from './themes';
import type { Difficulty, Digit, GameOptions, GameState } from './types';
import styleText from './style.css?raw';

/** 适配层 / IIFE 可传的 UI 配置，叠加在引擎 `GameOptions` 之上。 */
export interface MountOptions extends GameOptions {
  /** 标题文案，默认「数独」。 */
  title?: string;
  /** 副标题（小字，如 `@my-games/sudoku-vue`）；传 `false` 隐藏。默认 `core`。 */
  subtitle?: string | false;
  /** 是否渲染数字键盘，默认 true。 */
  showPad?: boolean;
  /** 是否渲染「提示」按钮，默认 false。 */
  showHint?: boolean;
  /** 挂载后是否自动聚焦棋盘（键盘可用），默认 true。 */
  autofocus?: boolean;
  /** 填数回调：携带目标格坐标，便于宿主记「哪个格填了什么」。 */
  onDigit?: (e: { digit: Digit; changed: boolean; row: number; col: number }) => void;
  /** 通关回调。 */
  onSolved?: (e: { difficulty: Difficulty; seconds: number }) => void;
  /**
   * 是否把核心样式自动注入 `<head>`（仅浏览器）。默认 true——让 IIFE/vanilla 零配置。
   * 若宿主已通过 `@my-games/sudoku-core/style.css` 自行引入样式，可设 false 避免重复。
   */
  injectStyle?: boolean;
}

/** `mount()` 返回的控制器：暴露引擎与生命周期方法，供适配层 ref / IIFE 句柄复用。 */
export interface SudokuController {
  /** 引擎实例本体（状态机 + 订阅 + 存档）。 */
  readonly game: Sudoku;
  /** 渲染出的根元素（`.game-sudoku`），`destroy()` 时从宿主移除。 */
  readonly root: HTMLElement;
  /** 解绑全部事件监听、定时器，并从宿主移除根元素。可重复调用（幂等）。 */
  destroy(): void;
  select(row: number, col: number): void;
  input(digit: Digit): boolean;
  erase(): boolean;
  toggleNote(digit: Digit): boolean;
  hint(): boolean;
  newGame(difficulty?: Difficulty): void;
  undo(): boolean;
  canUndo(): boolean;
  setTheme(next: SudokuTheme): boolean;
  getTheme(): SudokuTheme;
  setAutoNotes(next: boolean): boolean;
  getAutoNotes(): boolean;
  getState(): GameState;
}

const PAD_DIGITS: Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const DIFFS: Array<{ key: Difficulty; label: string }> = [
  { key: 'easy', label: '简单' },
  { key: 'medium', label: '中等' },
  { key: 'hard', label: '困难' }
];
/** 落子弹跳类的存活窗口（ms）：必须大于 style.css 的 `--sudoku-pop-duration`（当前 160ms）。 */
const POP_CLEAR_MS = 240;

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

let styleInjected = false;
/** 把核心样式注入 `<head>` 一次；已有同 id 的 `<style>` 或已注入过则跳过。 */
function ensureStyle(): void {
  if (typeof document === 'undefined') return;
  if (styleInjected || document.getElementById('game-sudoku-core-style')) {
    styleInjected = true;
    return;
  }
  const style = document.createElement('style');
  style.id = 'game-sudoku-core-style';
  style.textContent = styleText;
  const head = document.head ?? document.documentElement;
  head.appendChild(style);
  styleInjected = true;
}

/** 9 宫 × 9 格的全局坐标映射（box 内顺序 => 全局 row/col）。 */
function boxCells(bi: number): Array<{ row: number; col: number }> {
  const out: Array<{ row: number; col: number }> = [];
  for (let ci = 0; ci < 9; ci++) {
    out.push({
      row: Math.floor(bi / 3) * 3 + Math.floor(ci / 3),
      col: (bi % 3) * 3 + (ci % 3)
    });
  }
  return out;
}

interface CellRef {
  cell: HTMLDivElement;
  value: HTMLSpanElement;
  notes: HTMLDivElement;
  noteSpans: HTMLSpanElement[];
  /** 当前是否展示值（否则展示笔记）。初始化为 null 强制首帧建立结构。 */
  filled: boolean | null;
  notesSig: string;
  lastPopSeq: number;
}

/**
 * 把数独渲染进 `target` 并返回控制器。
 *
 * @param target 挂载点 DOM 元素（任意容器；内部会新建一个 `.game-sudoku` 根节点挂进去）。
 * @param options 引擎选项（难度 / 存储 / 主题 …）+ UI 选项（标题 / 键盘 / 回调 …）。
 */
export function mount(target: HTMLElement, options: MountOptions = {}): SudokuController {
  if (typeof document === 'undefined') {
    throw new Error(
      '[game-sudoku] mount() 需要浏览器 DOM 环境（当前没有 document）。Node/SSR 请直接用 Sudoku 类消费状态，不要调用 mount。'
    );
  }
  if (options.injectStyle !== false) ensureStyle();

  const {
    title = '数独',
    subtitle = 'core',
    showPad = true,
    showHint = false,
    autofocus = true,
    onDigit,
    onSolved
  } = options;

  const game = new Sudoku(options);

  // ---------- 构建 DOM（一次性） ----------
  const root = document.createElement('div');
  root.className = 'game-sudoku';

  // 头部：标题 + 三项统计
  const header = document.createElement('header');
  header.className = 'game-sudoku-header';
  const h1 = document.createElement('h1');
  h1.className = 'game-sudoku-title';
  h1.textContent = title;
  if (subtitle) {
    const small = document.createElement('small');
    small.className = 'subtitle';
    small.textContent = subtitle;
    h1.appendChild(small);
  }
  const stats = document.createElement('div');
  stats.className = 'game-sudoku-stats';
  stats.innerHTML = `
    <div class="game-sudoku-stat"><span class="label">用时</span><span class="value" data-role="time">0:00</span></div>
    <div class="game-sudoku-stat"><span class="label">最佳</span><span class="value" data-role="best">—</span></div>
    <div class="game-sudoku-stat"><span class="label">错误</span><span class="value" data-role="mistake">0</span></div>`;
  header.appendChild(h1);
  header.appendChild(stats);
  root.appendChild(header);
  const timeEl = stats.querySelector<HTMLElement>('[data-role="time"]');
  const bestEl = stats.querySelector<HTMLElement>('[data-role="best"]');
  const mistakeEl = stats.querySelector<HTMLElement>('[data-role="mistake"]');

  // 工具栏：难度切换 + 操作按钮
  const toolbar = document.createElement('div');
  toolbar.className = 'game-sudoku-toolbar';
  const difficultyGroup = document.createElement('div');
  difficultyGroup.className = 'game-sudoku-difficulty';
  difficultyGroup.setAttribute('role', 'group');
  difficultyGroup.setAttribute('aria-label', '难度');
  for (const d of DIFFS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'game-sudoku-chip';
    b.dataset.diff = d.key;
    b.textContent = d.label;
    difficultyGroup.appendChild(b);
  }
  const actions = document.createElement('div');
  actions.className = 'game-sudoku-actions';
  const noteBtn = document.createElement('button');
  noteBtn.type = 'button';
  noteBtn.className = 'game-sudoku-button';
  noteBtn.textContent = '笔记 关';
  const autoBtn = document.createElement('button');
  autoBtn.type = 'button';
  autoBtn.className = 'game-sudoku-button';
  autoBtn.title = '自动按盘面填候选数（与手写笔记同一通道，会被下一次重算覆盖）';
  autoBtn.textContent = '候选 关';
  const undoBtn = document.createElement('button');
  undoBtn.type = 'button';
  undoBtn.className = 'game-sudoku-button';
  undoBtn.textContent = '撤销';
  const hintBtn = document.createElement('button');
  hintBtn.type = 'button';
  hintBtn.className = 'game-sudoku-button';
  hintBtn.textContent = '提示';
  const newBtn = document.createElement('button');
  newBtn.type = 'button';
  newBtn.className = 'game-sudoku-button is-primary';
  newBtn.textContent = '新游戏';
  actions.append(noteBtn, autoBtn, undoBtn);
  if (showHint) actions.appendChild(hintBtn);
  actions.appendChild(newBtn);
  toolbar.append(difficultyGroup, actions);
  root.appendChild(toolbar);

  // 棋盘：3×3 宫，每宫 9 格；外加通关浮层
  const board = document.createElement('div');
  board.className = 'game-sudoku-board';
  board.tabIndex = 0;
  board.setAttribute('role', 'application');
  board.setAttribute('aria-label', '数独棋盘');
  const cells: CellRef[][] = [];
  for (let bi = 0; bi < 9; bi++) {
    const box = document.createElement('div');
    box.className = 'game-sudoku-box';
    for (const { row, col } of boxCells(bi)) {
      const cell = document.createElement('div');
      cell.className = 'game-sudoku-cell';
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      const value = document.createElement('span');
      value.className = 'cell-value';
      const notes = document.createElement('div');
      notes.className = 'cell-notes';
      const noteSpans: HTMLSpanElement[] = [];
      for (let i = 0; i < PAD_DIGITS.length; i++) {
        const s = document.createElement('span');
        s.textContent = '';
        // 标记所属数字，CSS 据此给候选每数字异色（见 style.css 的 .cell-notes span[data-digit]）。
        s.dataset.digit = String(PAD_DIGITS[i]);
        notes.appendChild(s);
        noteSpans.push(s);
      }
      cell.appendChild(value);
      cell.appendChild(notes);
      box.appendChild(cell);
      (cells[row] ??= [])[col] = { cell, value, notes, noteSpans, filled: null, notesSig: '', lastPopSeq: 0 };
    }
    board.appendChild(box);
  }
  const overlay = document.createElement('div');
  overlay.className = 'game-sudoku-overlay';
  overlay.innerHTML = `
    <h2>解开了！</h2>
    <p class="meta" data-role="overlay-meta"></p>
    <div class="row"><button type="button" class="game-sudoku-button is-primary" data-role="overlay-new">再来一局</button></div>`;
  board.appendChild(overlay);
  root.appendChild(board);
  const overlayMeta = overlay.querySelector<HTMLElement>('[data-role="overlay-meta"]');
  const overlayNewBtn = overlay.querySelector<HTMLButtonElement>('[data-role="overlay-new"]');

  // 数字键盘
  if (showPad) {
    const pad = document.createElement('div');
    pad.className = 'game-sudoku-pad';
    pad.setAttribute('role', 'group');
    pad.setAttribute('aria-label', '数字键盘');
    for (const d of PAD_DIGITS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.digit = String(d);
      b.textContent = String(d);
      pad.appendChild(b);
    }
    root.appendChild(pad);
  }

  target.appendChild(root);

  // ---------- 交互与渲染状态 ----------
  let noteMode = false;
  let poppedCell: HTMLDivElement | null = null;
  let popTimer = 0;
  let lastStatus = game.getState().status;
  let destroyed = false;
  let schemeQuery: MediaQueryList | null = null;
  let onSchemeChange: (() => void) | null = null;

  const prefersDark = (): boolean => (schemeQuery ? schemeQuery.matches : false);

  function applyTheme(state: GameState): void {
    root.dataset.theme = resolveTheme(state.theme, prefersDark());
  }

  /** 重播一次落子弹跳：摘类 → 强制回流 → 加类；定时器摘掉（兼容 reduced-motion 不播动画）。 */
  function triggerPop(cell: HTMLDivElement): void {
    if (poppedCell && poppedCell !== cell) poppedCell.classList.remove('is-pop');
    cell.classList.remove('is-pop');
    void cell.offsetWidth; // 强制回流，让同名动画重新起播
    cell.classList.add('is-pop');
    poppedCell = cell;
    window.clearTimeout(popTimer);
    popTimer = window.setTimeout(() => {
      cell.classList.remove('is-pop');
      if (poppedCell === cell) poppedCell = null;
    }, POP_CLEAR_MS);
  }

  /** 单个 cell 的最小差异更新（类 / 值 / 笔记 / 落子）。 */
  function updateCell(r: number, c: number, state: GameState): void {
    const ref = cells[r]?.[c];
    if (!ref) return;
    const v = state.grid[r]?.[c] ?? 0;
    const given = state.givenMask[r]?.[c] ?? false;
    const cell = ref.cell;
    // 类用 toggle 管理，刻意不碰 is-pop（由 triggerPop 单独掌控，避免整段 className 覆盖把它擦掉）。
    cell.classList.toggle('is-given', given);
    cell.classList.toggle('is-user', !given && v !== 0);
    cell.classList.toggle('is-conflict', !!state.conflicts[r]?.[c]);
    const sel = state.selected;
    const isSel = !!sel && sel.row === r && sel.col === c;
    cell.classList.toggle('is-selected', isSel);
    let isPeer = false;
    let isSame = false;
    if (sel && !isSel) {
      const sameBox =
        Math.floor(sel.row / 3) === Math.floor(r / 3) && Math.floor(sel.col / 3) === Math.floor(c / 3);
      if (sel.row === r || sel.col === c || sameBox) isPeer = true;
      const selV = state.grid[sel.row]?.[sel.col] ?? 0;
      if (v !== 0 && v === selV) isSame = true;
    }
    cell.classList.toggle('is-peer', isPeer);
    cell.classList.toggle('is-same', isSame);

    const filled = v !== 0;
    // 结构切换（值 ↔ 笔记）只在「填充态」变化时发生；切换后立刻走下面的内容刷新，
    // 保证刚重新挂回的笔记层拿到的是当前盘面，而不是上一次空格时留下的旧数字。
    if (filled !== ref.filled) {
      if (filled) {
        ref.notes.remove();
        cell.appendChild(ref.value);
      } else {
        ref.value.remove();
        cell.appendChild(ref.notes);
      }
      ref.filled = filled;
    }
    if (filled) {
      const text = String(v);
      if (ref.value.textContent !== text) ref.value.textContent = text;
    } else {
      const notes = state.notes[r]?.[c] ?? [];
      const sig = notes.join(',');
      if (sig !== ref.notesSig) {
        for (let d = 1; d <= 9; d++) {
          const span = ref.noteSpans[d - 1];
          if (span) span.textContent = notes.includes(d as Digit) ? String(d) : '';
        }
        ref.notesSig = sig;
      }
    }

    const pop = state.lastPop;
    if (pop && pop.row === r && pop.col === c && pop.seq !== ref.lastPopSeq) {
      ref.lastPopSeq = pop.seq;
      triggerPop(cell);
    }
  }

  /** 整盘 + 工具栏 + 统计 + 浮层的一次性刷新（1s 心跳也走这里，重绘几乎零成本）。 */
  function render(state: GameState): void {
    applyTheme(state);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) updateCell(r, c, state);
    }
    const won = state.status === 'won';
    if (timeEl) timeEl.textContent = formatTime(state.elapsedSeconds);
    if (bestEl) bestEl.textContent = state.bestSeconds === null ? '—' : formatTime(state.bestSeconds);
    if (mistakeEl) {
      mistakeEl.textContent = String(state.mistakeCount);
      mistakeEl.parentElement?.classList.toggle('is-danger', state.mistakeCount > 0);
    }
    if (undoBtn) {
      undoBtn.disabled = won || state.historySize === 0;
    }
    if (noteBtn) {
      noteBtn.textContent = `笔记 ${noteMode ? '开' : '关'}`;
      noteBtn.classList.toggle('is-toggled', noteMode);
    }
    if (autoBtn) {
      // 读引擎状态而非本地变量：候选开关的真相在 core。
      autoBtn.textContent = `候选 ${state.autoNotes ? '开' : '关'}`;
      autoBtn.classList.toggle('is-toggled', state.autoNotes);
      autoBtn.setAttribute('aria-pressed', String(state.autoNotes));
    }
    if (overlay) {
      overlay.classList.toggle('is-visible', won);
      if (overlayMeta) {
        overlayMeta.textContent = `难度 ${state.difficulty} · 用时 ${formatTime(state.elapsedSeconds)} · 提示 ${state.hintCount} 次 · 错误 ${state.mistakeCount} 次`;
      }
    }
    if (showPad) {
      const padButtons = root.querySelectorAll<HTMLButtonElement>('.game-sudoku-pad button');
      padButtons.forEach((b) => (b.disabled = won));
    }
    difficultyGroup.querySelectorAll<HTMLButtonElement>('[data-diff]').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.diff === state.difficulty);
    });
  }

  // ---------- 引擎订阅 ----------
  const unsub = game.subscribe((s) => {
    render(s);
    if (s.status === 'won' && lastStatus !== 'won') {
      onSolved?.({ difficulty: s.difficulty, seconds: s.elapsedSeconds });
    }
    lastStatus = s.status;
  });

  // 用时每秒刷新：core 只在操作时推快照，这里补一个 1s tick；通关后不再重绘。
  const timer = window.setInterval(() => {
    const s = game.getState();
    if (s.status === 'playing') render(s);
  }, 1000);

  // ---------- 主题：auto 跟随系统 ----------
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    schemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    onSchemeChange = (): void => {
      // 只重算 data-theme，不必整盘重绘。
      root.dataset.theme = resolveTheme(game.getState().theme, schemeQuery ? schemeQuery.matches : false);
    };
    schemeQuery.addEventListener('change', onSchemeChange);
  }

  // ---------- 事件 ----------
  const applyFill = (d: Digit): void => {
    const sel = game.getState().selected;
    const changed = noteMode ? game.toggleNote(d) : game.input(d);
    if (!noteMode) onDigit?.({ digit: d, changed, row: sel?.row ?? -1, col: sel?.col ?? -1 });
  };

  const onPadClick = (ev: MouseEvent): void => {
    const digit = (ev.target as HTMLElement).dataset?.digit;
    if (!digit) return;
    applyFill(Number(digit) as Digit);
  };
  const onBoardClick = (ev: MouseEvent): void => {
    const cell = (ev.target as HTMLElement).closest<HTMLElement>('[data-row]');
    if (!cell) return;
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    if (!Number.isNaN(row) && !Number.isNaN(col)) game.select(row, col);
  };
  const onKey = (ev: KeyboardEvent): void => {
    if (document.activeElement !== board) return;
    if (/^[1-9]$/.test(ev.key)) {
      applyFill(Number(ev.key) as Digit);
      ev.preventDefault();
      return;
    }
    if (ev.key === 'Backspace' || ev.key === 'Delete') {
      game.erase();
      ev.preventDefault();
      return;
    }
    if (ev.key === 'n' || ev.key === 'N') {
      noteMode = !noteMode;
      render(game.getState());
      return;
    }
    const sel = game.getState().selected;
    if (!sel) return;
    let { row, col } = sel;
    if (ev.key === 'ArrowUp') row = (row + 8) % 9;
    else if (ev.key === 'ArrowDown') row = (row + 1) % 9;
    else if (ev.key === 'ArrowLeft') col = (col + 8) % 9;
    else if (ev.key === 'ArrowRight') col = (col + 1) % 9;
    else return;
    ev.preventDefault();
    game.select(row, col);
  };

  const padEl = showPad ? root.querySelector<HTMLElement>('.game-sudoku-pad') : null;
  padEl?.addEventListener('click', onPadClick);
  board.addEventListener('click', onBoardClick);
  window.addEventListener('keydown', onKey, { passive: false });
  noteBtn?.addEventListener('click', () => {
    noteMode = !noteMode;
    render(game.getState());
  });
  autoBtn?.addEventListener('click', () => game.setAutoNotes(!game.getAutoNotes()));
  undoBtn?.addEventListener('click', () => game.undo());
  hintBtn?.addEventListener('click', () => game.hint());
  newBtn?.addEventListener('click', () => game.newGame());
  overlayNewBtn?.addEventListener('click', () => game.newGame());
  difficultyGroup.querySelectorAll<HTMLButtonElement>('[data-diff]').forEach((b) => {
    b.addEventListener('click', () => game.newGame(b.dataset.diff as Difficulty));
  });

  if (autofocus) board.focus({ preventScroll: true });

  // ---------- 控制器 ----------
  const controller: SudokuController = {
    game,
    root,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      window.clearInterval(timer);
      window.clearTimeout(popTimer);
      window.removeEventListener('keydown', onKey);
      padEl?.removeEventListener('click', onPadClick);
      board.removeEventListener('click', onBoardClick);
      schemeQuery?.removeEventListener('change', onSchemeChange ?? (() => undefined));
      unsub();
      root.remove();
    },
    select: (row, col) => game.select(row, col),
    input: (digit) => game.input(digit),
    erase: () => game.erase(),
    toggleNote: (digit) => game.toggleNote(digit),
    hint: () => game.hint(),
    newGame: (difficulty) => game.newGame(difficulty),
    undo: () => game.undo(),
    canUndo: () => game.canUndo(),
    setTheme: (next) => game.setTheme(next),
    getTheme: () => game.getTheme(),
    setAutoNotes: (next) => game.setAutoNotes(next),
    getAutoNotes: () => game.getAutoNotes(),
    getState: () => game.getState()
  };

  return controller;
}
