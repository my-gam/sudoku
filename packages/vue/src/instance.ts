import type { Digit, Difficulty, SudokuTheme } from '@my-games/sudoku-core';

/**
 * 组件 `ref` 上暴露的方法（`defineExpose` 的类型镜像）。
 * 供父组件 `const g = ref<GameSudokuInstance>()` 精确声明类型。
 */
export interface GameSudokuInstance {
  select(row: number, col: number): void;
  input(digit: Digit): boolean;
  erase(): boolean;
  toggleNote(digit: Digit): boolean;
  hint(): boolean;
  newGame(difficulty?: Difficulty): void;
  undo(): boolean;
  /** 切主题并落盘；返回 false = 档位不合法。归属在 core 引擎，不在组件里。 */
  setTheme(next: SudokuTheme): boolean;
  /** 引擎当前的请求档（可能是 'auto'）。 */
  getTheme(): SudokuTheme;
}
