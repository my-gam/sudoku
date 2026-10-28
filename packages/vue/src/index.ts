export { default as GameSudoku } from './GameSudoku.vue';
export { useGame, type UseGameReturn } from './useGame';
export type { GameSudokuInstance } from './instance';

// 顺手把 core 的关键类型透出来，宿主项目不需要额外装 core 也能拿到这些类型。
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
