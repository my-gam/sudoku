import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sudoku,
  type Difficulty,
  type Digit,
  type GameOptions,
  type GameState
} from '@my-games/sudoku-core';

/**
 * `useGame` —— React Hook 版引擎桥接（与 Vue 的 useGame 语义对齐）。
 *
 * - 引擎实例用 useMemo 按「难度 + 键名」缓存；这些 prop 变化 = 重开一局，视为预期语义。
 * - useState 订阅引擎快照，useEffect 挂/卸订阅防泄漏。
 * - useRef 保最新 game 实例给命令式 handler，避免闭包过期。
 */
export interface UseGameReturn {
  state: GameState;
  game: Sudoku;
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
  const { difficulty, storage, saveKey, bestKey, freshStart, puzzle } = options;

  const game = useMemo(
    // theme / themeKey 只作「构造期初值」，刻意不进依赖数组：换主题应当走
    // game.setTheme()（组件里已接好），若把它列入依赖，切一次主题就会重建引擎、
    // 连带丢掉本局 undo 历史。
    () => new Sudoku({ difficulty, storage, saveKey, bestKey, freshStart, puzzle, theme: options.theme, themeKey: options.themeKey }),
    // 故意只依赖这些稳定原始值；storage / puzzle / rng / clock 引用不稳定，重开一次即可。
    [difficulty, saveKey, bestKey]
  );

  const gameRef = useRef(game);
  gameRef.current = game;

  const [state, setState] = useState<GameState>(() => game.getState());

  useEffect(() => {
    setState(game.getState());
    const unsub = game.subscribe(setState);
    return unsub;
  }, [game]);

  return {
    state,
    game,
    select: (row, col) => gameRef.current.select(row, col),
    input: (digit) => gameRef.current.input(digit),
    erase: () => gameRef.current.erase(),
    toggleNote: (digit) => gameRef.current.toggleNote(digit),
    hint: () => gameRef.current.hint(),
    newGame: (diff) => gameRef.current.newGame(diff),
    undo: () => gameRef.current.undo(),
    canUndo: () => gameRef.current.canUndo()
  };
}
