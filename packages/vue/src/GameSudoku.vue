<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import '@my-games/sudoku-core/style.css';
import { mount, type Digit, type Difficulty, type SaveStorage, type SudokuTheme } from '@my-games/sudoku-core';
import type { GameSudokuInstance } from './instance';

/**
 * GameSudoku —— Vue 3 官方组件，桥接 @my-games/sudoku-core。
 *
 * 重构后：本组件**不再手写任何 DOM**——棋盘 / 工具栏 / 数字键盘 / 通关浮层全部由 core 的
 * `mount()` 渲染并接管交互（键盘、主题、计时、落子弹跳都在 core 里）。本组件只负责：
 * - 把 props 透传给 `mount`（难度 / 存储 / 标题 / 是否显示键盘与提示 / 初始主题…）；
 * - 把 `mount` 的 `onDigit` / `onSolved` 转成 Vue 的 `input` / `solved` 事件；
 * - 受控 `theme` / `autoNotes` 变化时推回引擎（换主题不该重建棋盘、丢 undo 历史）；
 * - 通过 `defineExpose` 暴露命令式句柄（委托给 controller）。
 *
 * 视觉 / 类名 / 无障碍全部复用 core 的 style.css，与 React / vanilla / IIFE 完全一致。
 */
interface Props {
  difficulty?: Difficulty;
  storage?: SaveStorage | null;
  saveKey?: string;
  bestKey?: string;
  freshStart?: boolean;
  autofocus?: boolean;
  title?: string;
  showPad?: boolean;
  showHint?: boolean;
  /** 初始 / 受控主题。不传则由引擎读持久化偏好，最终回落 `light`。 */
  theme?: SudokuTheme;
  /** 初始 / 受控自动候选开关。不传则由引擎读持久化偏好，最终回落 false（关）。 */
  autoNotes?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  difficulty: 'easy',
  storage: undefined,
  saveKey: undefined,
  bestKey: undefined,
  freshStart: false,
  autofocus: true,
  title: '数独',
  showPad: true,
  showHint: false,
  theme: undefined,
  autoNotes: undefined
});

const emit = defineEmits<{
  (e: 'input', payload: { digit: Digit; changed: boolean; row: number; col: number }): void;
  (e: 'solved', payload: { difficulty: Difficulty; seconds: number }): void;
}>();

const host = ref<HTMLDivElement | null>(null);
const controller = shallowRef<ReturnType<typeof mount> | null>(null);

onMounted(() => {
  const el = host.value;
  if (!el) return;
  controller.value = mount(el, {
    difficulty: props.difficulty,
    storage: props.storage,
    saveKey: props.saveKey,
    bestKey: props.bestKey,
    freshStart: props.freshStart,
    title: props.title,
    showPad: props.showPad,
    showHint: props.showHint,
    autofocus: props.autofocus,
    // 样式由本包自行 import 的 @my-games/sudoku-core/style.css 提供，关掉 core 的自动注入避免重复。
    injectStyle: false,
    subtitle: '@my-games/sudoku-vue',
    theme: props.theme,
    autoNotes: props.autoNotes,
    onDigit: (e) => emit('input', e),
    onSolved: (e) => emit('solved', e)
  });
});

onBeforeUnmount(() => {
  controller.value?.destroy();
  controller.value = null;
});

// 受控用法：宿主改了 theme / autoNotes 就写回引擎（undefined 表示交还引擎自己决定，不覆盖）。
watch(
  () => props.theme,
  (next) => {
    if (next !== undefined) controller.value?.setTheme(next);
  }
);
watch(
  () => props.autoNotes,
  (next) => {
    if (next !== undefined) controller.value?.setAutoNotes(next);
  }
);

defineExpose<GameSudokuInstance>({
  select: (row, col) => controller.value?.select(row, col),
  input: (digit) => controller.value?.input(digit) ?? false,
  erase: () => controller.value?.erase() ?? false,
  toggleNote: (digit) => controller.value?.toggleNote(digit) ?? false,
  hint: () => controller.value?.hint() ?? false,
  newGame: (difficulty) => controller.value?.newGame(difficulty),
  undo: () => controller.value?.undo() ?? false,
  setTheme: (next) => controller.value?.setTheme(next) ?? false,
  getTheme: () => controller.value?.getTheme() ?? 'light',
  setAutoNotes: (next) => controller.value?.setAutoNotes(next) ?? false,
  getAutoNotes: () => controller.value?.getAutoNotes() ?? false
});
</script>

<template>
  <div ref="host" class="game-sudoku-host" />
</template>
