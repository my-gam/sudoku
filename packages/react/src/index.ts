export { GameSudoku, type GameSudokuProps, type GameSudokuHandle } from './GameSudoku';
export { useGame, type UseGameReturn } from './useGame';

export type {
  Cell,
  Difficulty,
  Digit,
  GameState,
  GameStatus,
  Grid,
  SaveStorage,
  SudokuTheme
} from '@my-games/sudoku-core';

// 主题档位表与解析函数是有值运行时的（宿主做主题选择器时直接 map 这份即可）。
export { SUDOKU_THEMES, resolveTheme } from '@my-games/sudoku-core';
