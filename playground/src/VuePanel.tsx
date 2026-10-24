import { useEffect, useRef } from 'react';
import { createApp, h } from 'vue';
import { GameSudoku as GameSudokuVue } from '@my-games/sudoku-vue';
import type { Difficulty } from '@my-games/sudoku-core';

/**
 * 在 React playground 里挂一个 Vue 组件。Vite 同时启 plugin-vue 与 plugin-react；
 * .vue 被 plugin-vue 编译，再由 createApp(...).mount(el) 手动挂进 React 分配的容器。
 * 任一引擎相关 prop 变化就 unmount + 重新 mount（playground 里代价可忽略）。
 */
export interface VuePanelProps {
  saveKey?: string;
  bestKey?: string;
  difficulty?: Difficulty;
  autofocus?: boolean;
}

export function VuePanel(props: VuePanelProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cbRef = useRef(props);
  cbRef.current = props;
  const { saveKey, bestKey, difficulty, autofocus } = props;

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
            autofocus: autofocus ?? true
          });
      }
    });
    app.mount(el);
    return () => app.unmount();
  }, [saveKey, bestKey, difficulty, autofocus]);

  return <div ref={hostRef} />;
}
