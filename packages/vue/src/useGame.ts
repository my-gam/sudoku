import { onBeforeUnmount, shallowRef, type ShallowRef } from 'vue';
import {
  Sudoku,
  type Digit,
  type Difficulty,
  type GameOptions,
  type GameState
} from '@my-games/sudoku-core';

/**
 * `useGame` —— Vue 侧桥接 @my-games/sudoku-core 引擎的 composable。
 *
 * 用法：
 * ```ts
 * const { state, input, select, newGame, undo } = useGame({ difficulty: 'easy' });
 * ```
 *
 * 生命周期：内部订阅引擎，`onBeforeUnmount` 自动退订。state 用 `shallowRef`
 * —— 引擎每次推全新快照，深度 reactive 无收益。
 */
export interface UseGameReturn {
  state: ShallowRef<GameState>;
  raw: Sudoku;
  select: (row: number, col: number) => void;
  input: (digit: Digit) => boolean;
  erase: () => boolean;
  toggleNote: (digit: Digit) => boolean;
  hint: () => boolean;
  newGame: (difficulty?: Difficulty) => void;
  undo: () => boolean;
  canUndo: () => boolean;
}

export function useGame(options: GameOptions = {}): UseGameReturn {
  const game = new Sudoku(options);
  const state = shallowRef<GameState>(game.getState());
  const unsubscribe = game.subscribe((s) => {
    state.value = s;
  });
  onBeforeUnmount(unsubscribe);

  return {
    state,
    raw: game,
    select: (row, col) => game.select(row, col),
    input: (digit) => game.input(digit),
    erase: () => game.erase(),
    toggleNote: (digit) => game.toggleNote(digit),
    hint: () => game.hint(),
    newGame: (difficulty) => game.newGame(difficulty),
    undo: () => game.undo(),
    canUndo: () => game.canUndo()
  };
}
