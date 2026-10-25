import { useEffect, useRef } from 'react';
import { Sudoku, type Cell, type Difficulty, type Digit, type GameState } from '@my-games/sudoku-core';

/**
 * VanillaDemo —— 不依赖任何适配器，直接吃 `@my-games/sudoku-core`。
 *
 * 棋盘 DOM 由 useEffect 里 `document.createElement` 手工构建 + 订阅回调全量重绘；
 * 等价于浏览器 `<script src="...index.iife.js">` + `const { Sudoku } = SudokuCore` 的写法。
 * 复用 core/src/style.css 的 `.game-sudoku-*` 类，视觉与 vue/react 一致。
 */
export interface VanillaDemoProps {
  saveKey: string;
  bestKey: string;
  difficulty?: Difficulty;
  autofocus?: boolean;
}

const PAD_DIGITS: Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const DIFFS: Array<{ key: Difficulty; label: string }> = [
  { key: 'easy', label: '简单' },
  { key: 'medium', label: '中等' },
  { key: 'hard', label: '困难' }
];

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function VanillaDemo({ saveKey, bestKey, difficulty = 'easy', autofocus = true }: VanillaDemoProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = '';
    let noteMode = false;

    // ---- Header ----
    const header = document.createElement('header');
    header.className = 'game-sudoku-header';
    header.innerHTML = `
      <h1 class="game-sudoku-title">数独 <small class="subtitle">Vanilla · core only</small></h1>
      <div class="game-sudoku-stats">
        <div class="game-sudoku-stat"><span class="label">用时</span><span class="value" data-role="time">0:00</span></div>
        <div class="game-sudoku-stat"><span class="label">最佳</span><span class="value" data-role="best">—</span></div>
        <div class="game-sudoku-stat"><span class="label">错误</span><span class="value" data-role="mistake">0</span></div>
      </div>`;
    host.appendChild(header);
    const timeEl = header.querySelector<HTMLElement>('[data-role="time"]');
    const bestEl = header.querySelector<HTMLElement>('[data-role="best"]');
    const mistakeEl = header.querySelector<HTMLElement>('[data-role="mistake"]');

    // ---- Toolbar ----
    const toolbar = document.createElement('div');
    toolbar.className = 'game-sudoku-toolbar';
    toolbar.innerHTML = `
      <div class="game-sudoku-difficulty" role="group" aria-label="难度">
        ${DIFFS.map(
          (d) =>
            `<button class="game-sudoku-chip" type="button" data-diff="${d.key}">${d.label}</button>`
        ).join('')}
      </div>
      <div class="game-sudoku-actions">
        <button class="game-sudoku-button" type="button" data-role="note">笔记 关</button>
        <button class="game-sudoku-button" type="button" data-role="undo" disabled>撤销</button>
        <button class="game-sudoku-button" type="button" data-role="hint">提示</button>
        <button class="game-sudoku-button is-primary" type="button" data-role="new">新游戏</button>
      </div>`;
    host.appendChild(toolbar);
    const noteBtn = toolbar.querySelector<HTMLButtonElement>('[data-role="note"]');
    const undoBtn = toolbar.querySelector<HTMLButtonElement>('[data-role="undo"]');
    const hintBtn = toolbar.querySelector<HTMLButtonElement>('[data-role="hint"]');
    const newBtn = toolbar.querySelector<HTMLButtonElement>('[data-role="new"]');

    // ---- Board shell（一次搭建，之后重画 cell 层） ----
    const board = document.createElement('div');
    board.className = 'game-sudoku-board';
    board.tabIndex = 0;
    board.setAttribute('role', 'application');
    board.setAttribute('aria-label', '数独棋盘 (Vanilla)');
    const boxes: HTMLElement[] = [];
    for (let bi = 0; bi < 9; bi++) {
      const box = document.createElement('div');
      box.className = 'game-sudoku-box';
      board.appendChild(box);
      boxes.push(box);
    }
    const overlay = document.createElement('div');
    overlay.className = 'game-sudoku-overlay';
    overlay.innerHTML = `
      <h2>解开了！</h2>
      <p class="meta" data-role="overlay-meta"></p>
      <div class="row"><button class="game-sudoku-button is-primary" type="button" data-role="overlay-new">再来一局</button></div>`;
    board.appendChild(overlay);
    host.appendChild(board);
    const overlayMeta = overlay.querySelector<HTMLElement>('[data-role="overlay-meta"]');

    // ---- Pad ----
    const pad = document.createElement('div');
    pad.className = 'game-sudoku-pad';
    pad.setAttribute('role', 'group');
    pad.setAttribute('aria-label', '数字键盘');
    for (const d of PAD_DIGITS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = String(d);
      b.dataset.digit = String(d);
      pad.appendChild(b);
    }
    host.appendChild(pad);

    // ---- 引擎 ----
    const game = new Sudoku({ saveKey, bestKey, difficulty });

    const render = (state: GameState): void => {
      if (timeEl) timeEl.textContent = formatTime(state.elapsedSeconds);
      if (bestEl) bestEl.textContent = state.bestSeconds === null ? '—' : formatTime(state.bestSeconds);
      if (mistakeEl) mistakeEl.textContent = String(state.mistakeCount);
      if (undoBtn) undoBtn.disabled = state.historySize === 0 || state.status === 'won';
      if (noteBtn) {
        noteBtn.textContent = `笔记 ${noteMode ? '开' : '关'}`;
        noteBtn.classList.toggle('is-toggled', noteMode);
      }

      // 重画 9 个 box 的 cell
      for (let bi = 0; bi < 9; bi++) {
        const box = boxes[bi];
        if (!box) continue;
        box.innerHTML = '';
        for (let ci = 0; ci < 9; ci++) {
          const row = Math.floor(bi / 3) * 3 + Math.floor(ci / 3);
          const col = (bi % 3) * 3 + (ci % 3);
          box.appendChild(buildCell(state, row, col, game));
        }
      }

      const won = state.status === 'won';
      overlay.classList.toggle('is-visible', won);
      if (overlayMeta) {
        overlayMeta.textContent = `难度 ${state.difficulty} · 用时 ${formatTime(state.elapsedSeconds)} · 提示 ${state.hintCount} 次 · 错误 ${state.mistakeCount} 次`;
      }
      pad.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = won));
      // 难度高亮
      toolbar.querySelectorAll<HTMLButtonElement>('[data-diff]').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.diff === state.difficulty);
      });
    };

    const unsub = game.subscribe(render);
    // 用时每秒刷新：core 只在操作时推快照，这里补一个 1s tick；通关后不再重绘。
    const timer = window.setInterval(() => {
      const s = game.getState();
      if (s.status === 'playing') render(s);
    }, 1000);

    // ---- 交互 ----
    const onPad = (ev: MouseEvent): void => {
      const target = ev.target as HTMLElement;
      const digit = target.dataset?.digit;
      if (!digit) return;
      const d = Number(digit) as Digit;
      if (noteMode) game.toggleNote(d);
      else game.input(d);
    };
    pad.addEventListener('click', onPad);

    const onBoardClick = (ev: MouseEvent): void => {
      const cell = (ev.target as HTMLElement).closest<HTMLElement>('[data-row]');
      if (!cell) return;
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      if (!Number.isNaN(row) && !Number.isNaN(col)) game.select(row, col);
    };
    board.addEventListener('click', onBoardClick);

    const onKey = (ev: KeyboardEvent): void => {
      if (document.activeElement !== board) return;
      if (/^[1-9]$/.test(ev.key)) {
        const d = Number(ev.key) as Digit;
        if (noteMode) game.toggleNote(d);
        else game.input(d);
        ev.preventDefault();
        return;
      }
      if (ev.key === 'Backspace' || ev.key === 'Delete') {
        game.erase();
        ev.preventDefault();
        return;
      }
      if (ev.key === 'n' || ev.key === 'N') {
        noteMode = !noteMode;
        game.select(game.getState().selected?.row ?? 0, game.getState().selected?.col ?? 0);
        render(game.getState());
        return;
      }
      const sel = game.getState().selected;
      if (!sel) return;
      let { row, col } = sel;
      if (ev.key === 'ArrowUp') row = (row + 8) % 9;
      else if (ev.key === 'ArrowDown') row = (row + 1) % 9;
      else if (ev.key === 'ArrowLeft') col = (col + 8) % 9;
      else if (ev.key === 'ArrowRight') col = (col + 1) % 9;
      else return;
      ev.preventDefault();
      game.select(row, col);
    };
    window.addEventListener('keydown', onKey, { passive: false });

    noteBtn?.addEventListener('click', () => {
      noteMode = !noteMode;
      render(game.getState());
    });
    undoBtn?.addEventListener('click', () => game.undo());
    hintBtn?.addEventListener('click', () => game.hint());
    const startNew = (): void => game.newGame();
    newBtn?.addEventListener('click', startNew);
    overlay.querySelector<HTMLButtonElement>('[data-role="overlay-new"]')?.addEventListener('click', startNew);
    toolbar.querySelectorAll<HTMLButtonElement>('[data-diff]').forEach((b) => {
      b.addEventListener('click', () => game.newGame(b.dataset.diff as Difficulty));
    });

    if (autofocus) board.focus({ preventScroll: true });

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('keydown', onKey);
      pad.removeEventListener('click', onPad);
      board.removeEventListener('click', onBoardClick);
      unsub();
    };
  }, [saveKey, bestKey, difficulty, autofocus]);

  return <div ref={hostRef} className="game-sudoku vanilla-host" />;
}

/** 建一个 cell 元素（值或铅笔笔记），点击选中。 */
function buildCell(state: GameState, row: number, col: number, game: Sudoku): HTMLElement {
  const cell = document.createElement('div');
  const value = state.grid[row]?.[col] ?? 0;
  const given = state.givenMask[row]?.[col] ?? false;
  const cls = ['game-sudoku-cell'];
  if (given) cls.push('is-given');
  else if (value !== 0) cls.push('is-user');
  if (state.conflicts[row]?.[col]) cls.push('is-conflict');
  const sel = state.selected;
  if (sel && sel.row === row && sel.col === col) cls.push('is-selected');
  else if (sel) {
    const sameBox =
      Math.floor(sel.row / 3) === Math.floor(row / 3) &&
      Math.floor(sel.col / 3) === Math.floor(col / 3);
    if (sel.row === row || sel.col === col || sameBox) cls.push('is-peer');
    if (value !== 0 && value === (state.grid[sel.row]?.[sel.col] ?? 0)) cls.push('is-same');
  }
  cell.className = cls.join(' ');
  cell.dataset.row = String(row);
  cell.dataset.col = String(col);

  if (value !== 0) {
    cell.textContent = String(value as Cell);
  } else {
    const notesWrap = document.createElement('div');
    notesWrap.className = 'cell-notes';
    const notes = state.notes[row]?.[col] ?? [];
    for (const d of PAD_DIGITS) {
      const s = document.createElement('span');
      s.textContent = notes.includes(d) ? String(d) : '';
      notesWrap.appendChild(s);
    }
    cell.appendChild(notesWrap);
  }
  cell.addEventListener('click', () => game.select(row, col));
  return cell;
}
