import { useEffect, useRef } from 'react';
import { createApp, h, ref, type Ref } from 'vue';
import { GameSudoku as GameSudokuVue } from '@my-games/sudoku-vue';
import type { Difficulty, Digit, SudokuTheme } from '@my-games/sudoku-core';

/**
 * 在 React playground 里挂一个 Vue 组件。Vite 同时启 plugin-vue 与 plugin-react；
 * .vue 被 plugin-vue 编译，再由 createApp(...).mount(el) 手动挂进 React 分配的容器。
 * 引擎类 prop（saveKey/bestKey/difficulty/…）变化就 unmount + 重新 mount；
 * 事件用 cbRef 承载转给父级，避免因回调换引用而重建 app。
 *
 * theme / autoNotes 例外：它们走 Vue 侧的 ref，改一次只重渲染、不重挂 —— 重挂会丢 undo 历史。
 * 而那两个 Vue ref 必须「每个 React 实例只建一次」（踩过的坑见 vueProps 处的注释）。
 */
export interface VuePanelProps {
  saveKey?: string;
  bestKey?: string;
  difficulty?: Difficulty;
  autofocus?: boolean;
  showHint?: boolean;
  theme?: SudokuTheme;
  autoNotes?: boolean;
  onDigit?: (e: { digit: Digit; changed: boolean; row: number; col: number }) => void;
  onSolved?: (e: { difficulty: Difficulty; seconds: number }) => void;
}

/** 需要「活着的」传给 Vue 的 prop（其余走重建 app 的路子）。 */
interface LiveVueProps {
  theme: Ref<SudokuTheme | undefined>;
  autoNotes: Ref<boolean | undefined>;
}

export function VuePanel(props: VuePanelProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cbRef = useRef(props);
  cbRef.current = props;
  const { saveKey, bestKey, difficulty, autofocus, showHint } = props;

  // ⚠ 不能在这里直接 ref()：那会在每次 React 重渲染时产出**新的** Vue ref 对象，
  // 而挂载 effect 的渲染闭包追踪的是第一次那批 —— 写入与追踪不是同一对象，
  // Vue 永不重渲染，表现就是「切主题/切候选没反应」。用 useRef 把这组 ref 钉住，只建一次。
  const propsHolder = useRef<LiveVueProps | null>(null);
  if (!propsHolder.current) {
    propsHolder.current = {
      theme: ref<SudokuTheme | undefined>(props.theme),
      autoNotes: ref<boolean | undefined>(props.autoNotes)
    };
  }
  const live = propsHolder.current;

  useEffect(() => {
    live.theme.value = props.theme;
  }, [props.theme, live]);

  useEffect(() => {
    live.autoNotes.value = props.autoNotes;
  }, [props.autoNotes, live]);

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
            theme: live.theme.value,
            autoNotes: live.autoNotes.value,
            onInput: (e: { digit: Digit; changed: boolean; row: number; col: number }) =>
              cbRef.current.onDigit?.(e),
            onSolved: (e: { difficulty: Difficulty; seconds: number }) =>
              cbRef.current.onSolved?.(e)
          });
      }
    });
    app.mount(el);
    return () => app.unmount();
  }, [saveKey, bestKey, difficulty, autofocus, showHint, live]);

  return <div ref={hostRef} />;
}
