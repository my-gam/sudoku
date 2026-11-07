import { useEffect, useRef } from 'react';
import {
  mount,
  type Difficulty,
  type Digit,
  type SudokuTheme
} from '@my-games/sudoku-core';

/**
 * VanillaDemo —— 不依赖任何框架，直接吃 `@my-games/sudoku-core` 的 `mount()`。
 *
 * 这正是「把 DOM 操作收进 core」后的理想形态：组件本身**零手写 DOM**，把宿主元素 +
 * 配置交给 `mount`，棋盘 / 工具栏 / 键盘 / 主题 / 计时 / 落子弹跳全部由 core 渲染并接管。
 * 等价浏览器 `<script src="...index.iife.js">` + `SudokuCore.mount(el, opts)` 的写法。
 */
export interface VanillaDemoProps {
  saveKey: string;
  bestKey: string;
  difficulty?: Difficulty;
  autofocus?: boolean;
  showHint?: boolean;
  theme?: SudokuTheme;
  autoNotes?: boolean;
  onDigit?: (e: { digit: Digit; changed: boolean; row: number; col: number }) => void;
  onSolved?: (e: { difficulty: Difficulty; seconds: number }) => void;
}

export function VanillaDemo({
  saveKey,
  bestKey,
  difficulty = 'easy',
  autofocus = true,
  showHint = false,
  theme,
  autoNotes,
  onDigit,
  onSolved
}: VanillaDemoProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const ctrlRef = useRef<ReturnType<typeof mount> | null>(null);
  // 用 ref 持有最新回调：挂载 effect 依赖只放引擎参数，不因父级回调换引用而重建棋盘。
  const cb = useRef({ onDigit, onSolved });
  cb.current = { onDigit, onSolved };

  // 受控用法：theme / autoNotes 变化时推回引擎（undefined 表示交还引擎自己决定，不覆盖）。
  useEffect(() => {
    if (theme !== undefined) ctrlRef.current?.setTheme(theme);
  }, [theme]);
  useEffect(() => {
    if (autoNotes !== undefined) ctrlRef.current?.setAutoNotes(autoNotes);
  }, [autoNotes]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ctrl = mount(el, {
      saveKey,
      bestKey,
      difficulty,
      autofocus,
      showHint,
      title: '数独',
      subtitle: 'Vanilla · core only',
      theme,
      autoNotes,
      onDigit: (e) => cb.current.onDigit?.(e),
      onSolved: (e) => cb.current.onSolved?.(e)
    });
    ctrlRef.current = ctrl;
    return () => {
      ctrl.destroy();
      ctrlRef.current = null;
    };
  }, [saveKey, bestKey, difficulty, autofocus, showHint]);

  return <div ref={hostRef} className="game-sudoku vanilla-host" />;
}
