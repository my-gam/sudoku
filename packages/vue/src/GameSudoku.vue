<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import '@my-games/sudoku-core/style.css';
import { useGame } from './useGame';
import type { Digit, Difficulty, SaveStorage } from '@my-games/sudoku-core';

/**
 * GameSudoku —— Vue 3 官方组件，桥接 @my-games/sudoku-core 引擎。
 *
 * 输入模型：
 * - 点击格子选中；数字面板 / 键盘 1-9 填数；N 切笔记模式；Backspace/Delete 擦除；方向键移动选中。
 * - 键盘走 window keydown，但严格判 `document.activeElement === boardEl`，多实例并存只活动那个响应。
 * - 视觉/类名全部复用 core 的 style.css，与 React 版行为对齐。
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
  showHint: false
});

const emit = defineEmits<{
  (e: 'input', payload: { digit: Digit; changed: boolean; row: number; col: number }): void;
  (e: 'solved', payload: { difficulty: Difficulty; seconds: number }): void;
}>();

const { state, raw, select, input, erase, toggleNote, hint, newGame, undo } = useGame({
  difficulty: props.difficulty,
  storage: props.storage,
  saveKey: props.saveKey,
  bestKey: props.bestKey,
  freshStart: props.freshStart
});

const boardEl = ref<HTMLDivElement | null>(null);
const noteMode = ref(false);
// 用时每秒刷新：core 只在操作时推快照，这里用 tick 触发对 raw.getState() 的实时重读。
const tick = ref(0);
let timerId: number | undefined;
function startTimer(): void {
  if (timerId !== undefined || typeof window === 'undefined') return;
  timerId = window.setInterval(() => {
    if (state.value.status === 'playing') tick.value++;
  }, 1000);
}
function stopTimer(): void {
  if (timerId !== undefined) {
    window.clearInterval(timerId);
    timerId = undefined;
  }
}

const DIFFS: Array<{ key: Difficulty; label: string }> = [
  { key: 'easy', label: '简单' },
  { key: 'medium', label: '中等' },
  { key: 'hard', label: '困难' }
];
const PAD_DIGITS: Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** 9 宫，每宫 9 格（映射到全局 row/col）。 */
const boxes = computed(() => {
  const out: Array<{ key: number; cells: Array<{ row: number; col: number }> }> = [];
  for (let bi = 0; bi < 9; bi++) {
    const cells: Array<{ row: number; col: number }> = [];
    for (let ci = 0; ci < 9; ci++) {
      cells.push({
        row: Math.floor(bi / 3) * 3 + Math.floor(ci / 3),
        col: (bi % 3) * 3 + (ci % 3)
      });
    }
    out.push({ key: bi, cells });
  }
  return out;
});

function cellValue(row: number, col: number): number {
  return state.value.grid[row]?.[col] ?? 0;
}

function cellNotes(row: number, col: number): Digit[] {
  return cellValue(row, col) === 0 ? (state.value.notes[row]?.[col] ?? []) : [];
}

function cellClass(row: number, col: number): Record<string, boolean> {
  const s = state.value;
  const v = cellValue(row, col);
  const given = s.givenMask[row]?.[col] ?? false;
  const sel = s.selected;
  const cls: Record<string, boolean> = {
    'game-sudoku-cell': true,
    'is-given': given,
    'is-user': !given && v !== 0,
    'is-conflict': !!s.conflicts[row]?.[col],
    'is-selected': !!sel && sel.row === row && sel.col === col,
    'is-peer': false,
    'is-same': false
  };
  if (sel && !(sel.row === row && sel.col === col)) {
    const sameBox =
      Math.floor(sel.row / 3) === Math.floor(row / 3) &&
      Math.floor(sel.col / 3) === Math.floor(col / 3);
    if (sel.row === row || sel.col === col || sameBox) cls['is-peer'] = true;
    const selVal = cellValue(sel.row, sel.col);
    if (v !== 0 && v === selVal) cls['is-same'] = true;
  }
  return cls;
}

function applyDigit(d: Digit): void {
  const sel = state.value.selected;
  const changed = noteMode.value ? toggleNote(d) : input(d);
  if (!noteMode.value) emit('input', { digit: d, changed, row: sel?.row ?? -1, col: sel?.col ?? -1 });
}

function onPad(d: Digit): void {
  applyDigit(d);
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const overlayVisible = computed(() => state.value.status === 'won');
const timeText = computed(() => {
  void tick.value; // 依赖 tick，每秒重读实时用时
  return formatTime(raw.getState().elapsedSeconds);
});
const bestText = computed(() =>
  state.value.bestSeconds === null ? '—' : formatTime(state.value.bestSeconds)
);

// --- 键盘 ---
function onKey(ev: KeyboardEvent): void {
  if (typeof document !== 'undefined' && document.activeElement !== boardEl.value) return;
  if (/^[1-9]$/.test(ev.key)) {
    applyDigit(Number(ev.key) as Digit);
    ev.preventDefault();
    return;
  }
  if (ev.key === 'Backspace' || ev.key === 'Delete') {
    erase();
    ev.preventDefault();
    return;
  }
  if (ev.key === 'n' || ev.key === 'N') {
    noteMode.value = !noteMode.value;
    return;
  }
  const sel = state.value.selected;
  if (!sel) return;
  let { row, col } = sel;
  switch (ev.key) {
    case 'ArrowUp':
      row = (row + 8) % 9;
      break;
    case 'ArrowDown':
      row = (row + 1) % 9;
      break;
    case 'ArrowLeft':
      col = (col + 8) % 9;
      break;
    case 'ArrowRight':
      col = (col + 1) % 9;
      break;
    default:
      return;
  }
  ev.preventDefault();
  select(row, col);
}

let lastStatus = state.value.status;
watch(
  () => state.value.status,
  (st) => {
    if (st === 'won') {
      stopTimer();
      if (lastStatus !== 'won') {
        emit('solved', { difficulty: state.value.difficulty, seconds: raw.getState().elapsedSeconds });
      }
    } else {
      startTimer(); // playing（含 newGame 重开）
    }
    lastStatus = st;
  }
);

onMounted(() => {
  if (props.autofocus) boardEl.value?.focus({ preventScroll: true });
  window.addEventListener('keydown', onKey, { passive: false });
  startTimer();
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  stopTimer();
});

defineExpose({ select, input, erase, toggleNote, hint, newGame, undo });
</script>

<template>
  <div class="game-sudoku">
    <header class="game-sudoku-header">
      <h1 class="game-sudoku-title">
        {{ title }}
        <span class="subtitle">@my-games/sudoku-vue</span>
      </h1>
      <div class="game-sudoku-stats">
        <div class="game-sudoku-stat">
          <span class="label">用时</span>
          <span class="value">{{ timeText }}</span>
        </div>
        <div class="game-sudoku-stat">
          <span class="label">最佳</span>
          <span class="value">{{ bestText }}</span>
        </div>
        <div class="game-sudoku-stat" :class="{ 'is-danger': state.mistakeCount > 0 }">
          <span class="label">错误</span>
          <span class="value">{{ state.mistakeCount }}</span>
        </div>
      </div>
    </header>

    <div class="game-sudoku-toolbar">
      <div class="game-sudoku-difficulty" role="group" aria-label="难度">
        <button
          v-for="d in DIFFS"
          :key="d.key"
          class="game-sudoku-chip"
          :class="{ 'is-active': state.difficulty === d.key }"
          type="button"
          @click="newGame(d.key)"
        >
          {{ d.label }}
        </button>
      </div>
      <div class="game-sudoku-actions">
        <button
          class="game-sudoku-button"
          :class="{ 'is-toggled': noteMode }"
          type="button"
          :disabled="state.status === 'won'"
          @click="noteMode = !noteMode"
        >
          笔记 {{ noteMode ? '开' : '关' }}
        </button>
        <button
          class="game-sudoku-button"
          type="button"
          :disabled="state.status === 'won' || state.historySize === 0"
          @click="undo()"
        >
          撤销
        </button>
        <button
          v-if="showHint"
          class="game-sudoku-button"
          type="button"
          :disabled="state.status === 'won'"
          @click="hint()"
        >
          提示
        </button>
        <button class="game-sudoku-button is-primary" type="button" @click="newGame()">
          新游戏
        </button>
      </div>
    </div>

    <div
      ref="boardEl"
      class="game-sudoku-board"
      tabindex="0"
      role="application"
      :aria-label="`数独棋盘 ${state.status}`"
    >
      <div v-for="box in boxes" :key="box.key" class="game-sudoku-box">
        <div
          v-for="cell in box.cells"
          :key="`${cell.row}-${cell.col}`"
          :class="cellClass(cell.row, cell.col)"
          :data-row="cell.row"
          :data-col="cell.col"
          @click="select(cell.row, cell.col)"
        >
          <template v-if="cellValue(cell.row, cell.col) !== 0">
            {{ cellValue(cell.row, cell.col) }}
          </template>
          <div v-else class="cell-notes">
            <span v-for="d in PAD_DIGITS" :key="d">{{
              cellNotes(cell.row, cell.col).includes(d) ? d : ''
            }}</span>
          </div>
        </div>
      </div>

      <div class="game-sudoku-overlay" :class="{ 'is-visible': overlayVisible }">
        <h2>解开了！</h2>
        <p class="meta">
          难度 {{ state.difficulty }} · 用时 {{ timeText }} · 提示 {{ state.hintCount }} 次 · 错误
          {{ state.mistakeCount }} 次
        </p>
        <div class="row">
          <button class="game-sudoku-button is-primary" type="button" @click="newGame()">
            再来一局
          </button>
        </div>
      </div>
    </div>

    <div v-if="showPad" class="game-sudoku-pad" role="group" aria-label="数字键盘">
      <button
        v-for="d in PAD_DIGITS"
        :key="d"
        type="button"
        :disabled="state.status === 'won'"
        @click="onPad(d)"
      >
        {{ d }}
      </button>
    </div>
  </div>
</template>
