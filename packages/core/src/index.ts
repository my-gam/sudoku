/**
 * @my-games/sudoku-core
 *
 * 无框架依赖的数独引擎。入口分三类：
 * - `Sudoku` 类：状态机 + 订阅 + 存档 + undo + 计时（注入 clock）。
 * - `solve` / `countSolutions` / `generatePuzzle` / `generateFullGrid`：回溯求解与唯一解题生成。
 * - 纯函数原语 `isSafe` / `candidates` / `findConflicts` / `isSolved` ... 与存储工具。
 *
 * IIFE / UMD 全局名 `SudokuCore` 上挂的就是下面这些导出，与 ESM 侧完全一致。
 */

export { Sudoku } from './game';
export type { GameOptions } from './game';

export { solve, countSolutions } from './solver';

export { generatePuzzle, generateFullGrid, TARGET_CLUES } from './generator';
export type { GeneratedPuzzle } from './generator';

export {
  BOX,
  DIGITS,
  SIZE,
  candidates,
  cellAt,
  cloneGrid,
  countFilled,
  createEmptyGrid,
  emptyCells,
  findConflicts,
  gridsEqual,
  hasConflict,
  isFull,
  isSafe,
  isSolved,
  makeMask,
  peers,
  setCell,
  withCell
} from './board';

export {
  DEFAULT_BEST_KEY,
  DEFAULT_SAVE_KEY,
  SAVE_VERSION,
  clearSave,
  emptyBestTimes,
  isSerializedSave,
  loadBest,
  loadSave,
  tryGetGlobalStorage,
  writeBest,
  writeSave
} from './storage';

export type {
  BestTimes,
  Cell,
  Clock,
  ConflictMask,
  Difficulty,
  Digit,
  GameState,
  GameStatus,
  GivenMask,
  Grid,
  NoteGrid,
  Position,
  RandomSource,
  SaveStorage,
  SerializedSave,
  Snapshot
} from './types';
