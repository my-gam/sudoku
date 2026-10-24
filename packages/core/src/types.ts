/**
 * sudoku 公共类型定义。
 *
 * 设计要点（对齐合集三层模板）：
 * - 棋盘是固定 9×9 的 `Grid`（`Cell[][]`，行优先）；`Cell` = `0 | Digit`，`0` 表示空。
 * - `givenMask` 标记题面给定的格（不可改），与 `grid` 分离，UI 据此禁用输入。
 * - 纯逻辑运算（solver / generator / 测试）只用 `Grid`，不带可变的对局态。
 * - `Sudoku` 类持有「当前这局」的完整可序列化快照 `GameState`，供订阅者渲染。
 */

/** 一个可填入的数独数字。 */
export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** 单元格值：`0` = 空，`1..9` = 已填。 */
export type Cell = Digit | 0;

/** 9×9 值网格，`grid[row][col]`。 */
export type Grid = Cell[][];

/** 题面难度；对应题面给定数字（clues）的目标区间。 */
export type Difficulty = 'easy' | 'medium' | 'hard';

/** 棋盘上的一个坐标。 */
export interface Position {
  row: number;
  col: number;
}

/** 每格铅笔标记（候选笔记）；仅在该格为空时有意义。 */
export type NoteGrid = Digit[][][];

/** 每格是否为「题面给定」（不可擦除/改写）。 */
export type GivenMask = boolean[][];

/** 每格当前是否处于冲突态（同行/列/宫有重复）。 */
export type ConflictMask = boolean[][];

export type GameStatus = 'playing' | 'won';

/** 订阅者可见的完整快照。字段全部可序列化，便于存档与 UI diff。 */
export interface GameState {
  difficulty: Difficulty;
  /** 当前值网格（题面 + 玩家填入），`0` 表示空。 */
  grid: Grid;
  /** 题面给定掩码；true 的格禁止改写。 */
  givenMask: GivenMask;
  /** 铅笔笔记：`notes[r][c]` 是该空格的候选数字数组（升序、去重）。 */
  notes: NoteGrid;
  /** 当前选中格；无选中为 null。 */
  selected: Position | null;
  /** 当前与同行/列/宫重复的格标记，供 UI 红框。 */
  conflicts: ConflictMask;
  status: GameStatus;
  /** 已用时（秒，向下取整）；`won` 时定格在完成瞬间。 */
  elapsedSeconds: number;
  /** 该难度的历史最佳用时（秒）；无则 null。 */
  bestSeconds: number | null;
  /** 本局已用提示次数。 */
  hintCount: number;
  /** 本局已犯错误次数（填了与盘面冲突的值）。 */
  mistakeCount: number;
  /** 本局有效操作数（input/erase/hint 各算一步，撤销不计，切选中不算）。 */
  moveCount: number;
  /** 可撤销栈深度；>0 时 UI 可点亮「撤销」。 */
  historySize: number;
}

/** 一局的可回退快照（不含派生态与计时，undo 时整体还原）。 */
export interface Snapshot {
  grid: Grid;
  notes: NoteGrid;
  selected: Position | null;
  status: GameStatus;
  hintCount: number;
  mistakeCount: number;
  moveCount: number;
  /** 该快照生成时刻已累计的用时（ms），用于 undo 后计时口径一致。 */
  elapsedMs: number;
}

/** 序列化存档；版本化字段演进策略见 storage.ts。 */
export interface SerializedSave {
  version: 1;
  difficulty: Difficulty;
  /** 题面（含 0），用于校验存档与当前局是否同一道题。 */
  puzzle: Grid;
  /** 完整解，用于提示与 reveal（不入 undo，单独随存档走）。 */
  solution: Grid;
  grid: Grid;
  notes: NoteGrid;
  status: GameStatus;
  hintCount: number;
  mistakeCount: number;
  moveCount: number;
  /** 存档时刻已累计用时（ms），恢复后从此继续走表。 */
  elapsedMs: number;
}

/** 各难度的历史最佳用时（秒）；null = 该难度尚未通关。 */
export type BestTimes = Record<Difficulty, number | null>;

/** 简易 RNG 契约：返回 [0, 1)。注入是为了单测可复现。 */
export type RandomSource = () => number;

/** 简易时钟契约：返回单调毫秒（Date.now 语义）。注入以便测试计时。 */
export type Clock = () => number;

/**
 * `Sudoku` 构造参数。全部可选，缺省即「易难度 + Math.random + Date.now +
 * 尝试接管 globalThis.localStorage」。
 */
export interface GameOptions {
  /** 谜题难度，默认 'easy'。newGame 可临时覆盖。 */
  difficulty?: Difficulty;
  /** 随机源（[0,1)）；注入以便生成与单测可复现。 */
  rng?: RandomSource;
  /** 时钟（ms）；注入以便测试计时与最佳用时。 */
  clock?: Clock;
  /**
   * 存储后端。`undefined` → 尝试取 globalThis.localStorage；
   * `null` → 明确禁用；也可注入自实现的 SaveStorage mock。
   */
  storage?: SaveStorage | null;
  saveKey?: string;
  bestKey?: string;
  /** 构造时忽略已有存档，直接开新局。 */
  freshStart?: boolean;
  /** 固定题面（含 0 空格）：给定时用它而非现场生成（固定题 / 测试场景）。 */
  puzzle?: Grid;
  /** 配合 puzzle 给出已知解，省去求解；缺省则由 solve 推导。 */
  solution?: Grid;
  /** undo 栈深度上限，默认 50。 */
  undoLimit?: number;
}

/**
 * 最小可注入的存储抽象（与 DOM Storage 兼容，允许 Node 环境注入 mock）。
 * `null` 表示禁用持久化。
 */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
