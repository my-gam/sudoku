import {
  type Ref,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef
} from 'react';
import '@my-games/sudoku-core/style.css';
import {
  mount,
  type Difficulty,
  type Digit,
  type SaveStorage,
  type SudokuTheme
} from '@my-games/sudoku-core';

/**
 * GameSudoku —— React 18/19 组件适配器。
 *
 * 重构后：本组件**不再手写任何 JSX 棋盘**——DOM 与全部交互由 core 的 `mount()` 渲染并接管
 * （键盘 1-9 / N / Backspace / 方向键、主题 `auto` 跟随系统、1s 计时心跳、落子弹跳都在 core 里）。
 * 本组件只负责：把 props 透传给 `mount`、把 `onDigit` / `onSolved` 回调接出来、在 `theme` /
 * `autoNotes` 受控变化时推回引擎、通过 `forwardRef` 暴露命令式句柄。
 *
 * 视觉 / 类名 / 无障碍全部复用 core 的 style.css，与 Vue / vanilla / IIFE 完全一致。
 * `useGame`（无头状态桥接）仍导出，供想自建 UI 的宿主使用。
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
  /**
   * 初始 / 受控主题。不传则由引擎读它自己的持久化偏好（`game-sudoku:theme`），最终回落
   * `light`。`'auto'` 由 core 用 matchMedia 解析成 light / dark 并跟随系统变化。
   */
  theme?: SudokuTheme;
  /**
   * 初始 / 受控的自动候选开关。不传则由引擎读它自己的持久化偏好（`game-sudoku:auto-notes`），
   * 最终回落 `false`。
   */
  autoNotes?: boolean;
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
  setTheme(next: SudokuTheme): boolean;
  getTheme(): SudokuTheme;
  setAutoNotes(next: boolean): boolean;
  getAutoNotes(): boolean;
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
    theme,
    autoNotes,
    onDigit,
    onSolved
  } = props;

  const hostRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<ReturnType<typeof mount> | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ctrl = mount(el, {
      difficulty,
      storage,
      saveKey,
      bestKey,
      freshStart,
      title,
      showPad,
      showHint,
      autofocus,
      // 样式由本包自行 import 的 @my-games/sudoku-core/style.css 提供，关掉 core 的自动注入避免重复。
      injectStyle: false,
      subtitle: '@my-games/sudoku-react',
      theme,
      autoNotes,
      onDigit,
      onSolved
    });
    ctrlRef.current = ctrl;
    return () => {
      ctrl.destroy();
      ctrlRef.current = null;
    };
    // 仅挂载一次：引擎/棋盘在内部自管理，theme/autoNotes 的受控变化由下方两个 effect 单独推回。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 受控用法：宿主换 theme / autoNotes 时写回引擎；undefined 表示交还引擎自己决定。
  useEffect(() => {
    if (theme !== undefined) ctrlRef.current?.setTheme(theme);
  }, [theme]);
  useEffect(() => {
    if (autoNotes !== undefined) ctrlRef.current?.setAutoNotes(autoNotes);
  }, [autoNotes]);

  useImperativeHandle(
    ref,
    () => ({
      select: (row, col) => ctrlRef.current?.select(row, col),
      input: (digit) => ctrlRef.current?.input(digit) ?? false,
      erase: () => ctrlRef.current?.erase() ?? false,
      toggleNote: (digit) => ctrlRef.current?.toggleNote(digit) ?? false,
      hint: () => ctrlRef.current?.hint() ?? false,
      newGame: (d) => ctrlRef.current?.newGame(d),
      undo: () => ctrlRef.current?.undo() ?? false,
      setTheme: (next) => ctrlRef.current?.setTheme(next) ?? false,
      getTheme: () => ctrlRef.current?.getTheme() ?? 'light',
      setAutoNotes: (next) => ctrlRef.current?.setAutoNotes(next) ?? false,
      getAutoNotes: () => ctrlRef.current?.getAutoNotes() ?? false
    }),
    []
  );

  return <div ref={hostRef} className={['game-sudoku-host', className].filter(Boolean).join(' ')} />;
}

export const GameSudoku = forwardRef(GameSudokuInner);
GameSudoku.displayName = 'GameSudoku';
