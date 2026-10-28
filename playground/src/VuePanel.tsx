import { useEffect, useRef } from 'react';
import { createApp, h, ref, type Ref } from 'vue';
import { GameSudoku as GameSudokuVue } from '@my-games/sudoku-vue';
import type { Difficulty, Digit, SudokuTheme } from '@my-games/sudoku-core';

/**
 * 在 React playground 里挂一个 Vue 组件。Vite 同时启 plugin-vue 与 plugin-react；
 * .vue 被 plugin-vue 编译，再由 createApp(...).mount(el) 手动挂进 React 分配的容器。
 * 任一引擎相关 prop 变化就 unmount + 重新 mount（playground 里代价可忽略）。
 * 事件用 ref 承载转给父级，避免因回调换引用而重建 app。
 * theme 例外：它走一个 Vue 侧的 ref，改主题只重渲染、不重挂 —— 重挂会丢掉 undo 历史。
 */
export interface VuePanelProps {
  saveKey?: string;
  bestKey?: string;
  difficulty?: Difficulty;
  autofocus?: boolean;
  showHint?: boolean;
  theme?: SudokuTheme;
  onDigit?: (e: { digit: Digit; changed: boolean; row: number; col: number }) => void;
  onSolved?: (e: { difficulty: Difficulty; seconds: number }) => void;
}

export function VuePanel(props: VuePanelProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cbRef = useRef(props);
  cbRef.current = props;
  const { saveKey, bestKey, difficulty, autofocus, showHint } = props;

  // Vue 的 ref 必须「每个 React 实例只建一次」。踩过的坑：直接在组件函数体里 ref()，
  // 每次 React 重渲染都会产出一个新的 ref 对象 —— 挂载 effect 的渲染闭包追踪的是第一次
  // 那个，下面的同步 effect 写的却是最新那个，两边不是同一对象，Vue 永不重渲染，
  // 表现就是「切主题没反应」。所以用 useRef 把 Vue ref 本身钉住。
  const themeHolder = useRef<Ref<SudokuTheme | undefined> | null>(null);
  let themeRef = themeHolder.current;
  if (!themeRef) {
    themeRef = ref<SudokuTheme | undefined>(props.theme);
    themeHolder.current = themeRef;
  }

  useEffect(() => {
    themeRef.value = props.theme;
  }, [props.theme, themeRef]);

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
            theme: themeRef.value,
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

