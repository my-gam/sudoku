import {
  type CSSProperties,
  type ReactNode,
  type Ref,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react';
import '@my-games/sudoku-core/style.css';
import { DEFAULT_THEME, resolveTheme } from '@my-games/sudoku-core';
import type { Difficulty, Digit, GameState, SaveStorage, SudokuTheme } from '@my-games/sudoku-core';
import { useGame } from './useGame';

/**
 * GameSudoku —— React 18/19 组件，行为与 Vue 版对齐。
 * 键盘：数字 1-9 填数 / N 切笔记 / Backspace·Delete 擦除 / 方向键移动选中；
 * 严格判 `document.activeElement === board`，多实例并存只活动那个响应。
 */

export interface GameSudokuProps {
  difficulty?: Difficulty;
  storage?: SaveStorage | null;
  saveKey?: string;
  bestKey?: string;
  freshStart?: boolean;
  autofocus?: boolean;
  showPad?: boolean;
  title?: string;
  className?: string;
  showHint?: boolean;
  /** 主题档；`auto` 由本组件用 matchMedia 解析成 light / dark。默认 light，不静默跟随系统。 */
  theme?: SudokuTheme;
  onDigit?: (e: { digit: Digit; changed: boolean; row: number; col: number }) => void;
  onSolved?: (payload: { difficulty: Difficulty; seconds: number }) => void;
}

export interface GameSudokuHandle {
  select(row: number, col: number): void;
  input(digit: Digit): boolean;
  erase(): boolean;
  toggleNote(digit: Digit): boolean;
  hint(): boolean;
  newGame(difficulty?: Difficulty): void;
  undo(): boolean;
}

const PAD_DIGITS: Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const DIFFS: Array<{ key: Difficulty; label: string }> = [
  { key: 'easy', label: '简单' },
  { key: 'medium', label: '中等' },
  { key: 'hard', label: '困难' }
];

/** 9 宫 × 9 格的全局坐标映射。 */
const BOXES: Array<Array<{ row: number; col: number }>> = (() => {
  const out: Array<Array<{ row: number; col: number }>> = [];
  for (let bi = 0; bi < 9; bi++) {
    const cells: Array<{ row: number; col: number }> = [];
    for (let ci = 0; ci < 9; ci++) {
      cells.push({
        row: Math.floor(bi / 3) * 3 + Math.floor(ci / 3),
        col: (bi % 3) * 3 + (ci % 3)
      });
    }
    out.push(cells);
  }
  return out;
})();

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function cellValueOf(state: GameState, row: number, col: number): number {
  return state.grid[row]?.[col] ?? 0;
}

function cellClass(state: GameState, row: number, col: number): string {
  const v = cellValueOf(state, row, col);
  const given = state.givenMask[row]?.[col] ?? false;
  const sel = state.selected;
  const cls = ['game-sudoku-cell'];
  if (given) cls.push('is-given');
  else if (v !== 0) cls.push('is-user');
  if (state.conflicts[row]?.[col]) cls.push('is-conflict');
  if (sel && sel.row === row && sel.col === col) {
    cls.push('is-selected');
  } else if (sel) {
    const sameBox =
      Math.floor(sel.row / 3) === Math.floor(row / 3) &&
      Math.floor(sel.col / 3) === Math.floor(col / 3);
    if (sel.row === row || sel.col === col || sameBox) cls.push('is-peer');
    const selVal = cellValueOf(state, sel.row, sel.col);
    if (v !== 0 && v === selVal) cls.push('is-same');
  }
  return cls.join(' ');
}

function cellNotesOf(state: GameState, row: number, col: number): Digit[] {
  return cellValueOf(state, row, col) === 0 ? (state.notes[row]?.[col] ?? []) : [];
}

function GameSudokuInner(props: GameSudokuProps, ref: Ref<GameSudokuHandle>) {
  const {
    difficulty = 'easy',
    storage,
    saveKey,
    bestKey,
    freshStart = false,
    autofocus = true,
    showPad = true,
    title = '数独',
    className,
    showHint = false,
    theme = DEFAULT_THEME,
    onDigit,
    onSolved
  } = props;

  const { state, game, select, input, erase, toggleNote, hint, newGame, undo } = useGame({
    difficulty,
    storage,
    saveKey,
    bestKey,
    freshStart
  });

  const boardRef = useRef<HTMLDivElement>(null);
  const [noteMode, setNoteMode] = useState(false);
  // 系统深浅偏好。只有 theme='auto' 会消费它，但监听从挂载就一直开着——用户中途翻系统
  // 深色时不需要重挂组件就能换档。首帧恒为 false，与 Vue 版及 SSR 输出保持一致。
  const [prefersDark, setPrefersDark] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    setPrefersDark(query.matches);
    const onChange = (ev: MediaQueryListEvent): void => setPrefersDark(ev.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  /** 写进根元素 data-theme 的最终档位：auto 已解析成 light / dark。 */
  const resolvedTheme = resolveTheme(theme, prefersDark);
  // 用时每秒刷新：core 只在操作时推快照，tick 触发重绘后由 game.getState() 读实时值。
  const [, setTick] = useState(0);
  useEffect(() => {
    if (state.status !== 'playing') return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [state.status]);

  const applyDigit = useCallback(
    (digit: Digit) => {
      const sel = game.getState().selected;
      const changed = noteMode ? toggleNote(digit) : input(digit);
      if (!noteMode) onDigit?.({ digit, changed, row: sel?.row ?? -1, col: sel?.col ?? -1 });
    },
    [noteMode, toggleNote, input, onDigit, game]
  );

  const handleKey = useCallback(
    (ev: KeyboardEvent) => {
      if (document.activeElement !== boardRef.current) return;
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
        setNoteMode((v) => !v);
        return;
      }
      const sel = state.selected;
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
    },
    [applyDigit, erase, select, state.selected]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKey, { passive: false });
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  useEffect(() => {
    if (autofocus) boardRef.current?.focus({ preventScroll: true });
  }, [autofocus]);

  const lastStatus = useRef(state.status);
  useEffect(() => {
    if (state.status === 'won' && lastStatus.current !== 'won') {
      onSolved?.({ difficulty: state.difficulty, seconds: state.elapsedSeconds });
    }
    lastStatus.current = state.status;
  }, [state.status, state.difficulty, state.elapsedSeconds, onSolved]);

  useImperativeHandle(
    ref,
    () => ({ select, input, erase, toggleNote, hint, newGame, undo }),
    [select, input, erase, toggleNote, hint, newGame, undo]
  );

  const won = state.status === 'won';
  const timeText = formatTime(won ? state.elapsedSeconds : game.getState().elapsedSeconds);
  const bestText = state.bestSeconds === null ? '—' : formatTime(state.bestSeconds);

  const renderCell = (row: number, col: number): ReactNode => {
    const value = cellValueOf(state, row, col);
    const notes = cellNotesOf(state, row, col);
    return (
      <div
        key={`${row}-${col}`}
        className={cellClass(state, row, col)}
        data-row={row}
        data-col={col}
        onClick={() => select(row, col)}
      >
        {value !== 0 ? (
          value
        ) : (
          <div className="cell-notes">
            {PAD_DIGITS.map((d) => (
              <span key={d}>{notes.includes(d) ? d : ''}</span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={['game-sudoku', className].filter(Boolean).join(' ')} data-theme={resolvedTheme}>
      <header className="game-sudoku-header">
        <h1 className="game-sudoku-title">
          {title}
          <span className="subtitle">@my-games/sudoku-react</span>
        </h1>
        <div className="game-sudoku-stats">
          <div className="game-sudoku-stat">
            <span className="label">用时</span>
            <span className="value">{timeText}</span>
          </div>
          <div className="game-sudoku-stat">
            <span className="label">最佳</span>
            <span className="value">{bestText}</span>
          </div>
          <div className={`game-sudoku-stat${state.mistakeCount > 0 ? ' is-danger' : ''}`}>
            <span className="label">错误</span>
            <span className="value">{state.mistakeCount}</span>
          </div>
        </div>
      </header>

      <div className="game-sudoku-toolbar">
        <div className="game-sudoku-difficulty" role="group" aria-label="难度">
          {DIFFS.map((d) => (
            <button
              key={d.key}
              className={`game-sudoku-chip${state.difficulty === d.key ? ' is-active' : ''}`}
              type="button"
              onClick={() => newGame(d.key)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="game-sudoku-actions">
          <button
            className={`game-sudoku-button${noteMode ? ' is-toggled' : ''}`}
            type="button"
            disabled={won}
            onClick={() => setNoteMode((v) => !v)}
          >
            笔记 {noteMode ? '开' : '关'}
          </button>
          <button
            className="game-sudoku-button"
            type="button"
            disabled={won || state.historySize === 0}
            onClick={() => undo()}
          >
            撤销
          </button>
          {showHint ? (
            <button
              className="game-sudoku-button"
              type="button"
              disabled={won}
              onClick={() => hint()}
            >
              提示
            </button>
          ) : null}
          <button className="game-sudoku-button is-primary" type="button" onClick={() => newGame()}>
            新游戏
          </button>
        </div>
      </div>

      <div
        ref={boardRef}
        className="game-sudoku-board"
        tabIndex={0}
        role="application"
        aria-label={`数独棋盘 ${state.status}`}
        style={{ '--cols': 9 } as CSSProperties}
      >
        {BOXES.map((cells, bi) => (
          <div key={bi} className="game-sudoku-box">
            {cells.map(({ row, col }) => renderCell(row, col))}
          </div>
        ))}

        <div className={`game-sudoku-overlay${won ? ' is-visible' : ''}`}>
          <h2>解开了！</h2>
          <p className="meta">
            难度 {state.difficulty} · 用时 {timeText} · 提示 {state.hintCount} 次 · 错误{' '}
            {state.mistakeCount} 次
          </p>
          <div className="row">
            <button className="game-sudoku-button is-primary" type="button" onClick={() => newGame()}>
              再来一局
            </button>
          </div>
        </div>
      </div>

      {showPad ? (
        <div className="game-sudoku-pad" role="group" aria-label="数字键盘">
          {PAD_DIGITS.map((d) => (
            <button key={d} type="button" disabled={won} onClick={() => applyDigit(d)}>
              {d}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const GameSudoku = forwardRef(GameSudokuInner);
GameSudoku.displayName = 'GameSudoku';
