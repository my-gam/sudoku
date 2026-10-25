import { useEffect, useRef } from 'react';
import { createApp, h } from 'vue';
import { GameSudoku as GameSudokuVue } from '@my-games/sudoku-vue';
import type { Difficulty, Digit } from '@my-games/sudoku-core';

/**
 * 在 React playground 里挂一个 Vue 组件。Vite 同时启 plugin-vue 与 plugin-react；
 * .vue 被 plugin-vue 编译，再由 createApp(...).mount(el) 手动挂进 React 分配的容器。
 * 任一引擎相关 prop 变化就 unmount + 重新 mount（playground 里代价可忽略）。
 * 事件用 ref 承载转给父级，避免因回调换引用而重建 app。
 */
export interface VuePanelProps {
  saveKey?: string;
  bestKey?: string;
  difficulty?: Difficulty;
  autofocus?: boolean;
  showHint?: boolean;
  onDigit?: (e: { digit: Digit; changed: boolean; row: number; col: number }) => void;
  onSolved?: (e: { difficulty: Difficulty; seconds: number }) => void;
}

export function VuePanel(props: VuePanelProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cbRef = useRef(props);
  cbRef.current = props;
  const { saveKey, bestKey, difficulty, autofocus, showHint } = props;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const app = createApp({
      setup() {
        return () =>
          h(GameSudokuVue, {
            saveKey,
            bestKey,
            difficulty,
            autofocus: autofocus ?? true,
            showHint: showHint ?? false,
            onInput: (e: { digit: Digit; changed: boolean; row: number; col: number }) =>
              cbRef.current.onDigit?.(e),
            onSolved: (e: { difficulty: Difficulty; seconds: number }) =>
              cbRef.current.onSolved?.(e)
          });
      }
    });
    app.mount(el);
    return () => app.unmount();
  }, [saveKey, bestKey, difficulty, autofocus, showHint]);

  return <div ref={hostRef} />;
}

