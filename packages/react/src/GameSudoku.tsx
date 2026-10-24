// 0.0.0-stage 空骨架占位组件：仅 import core 样式以让 vite lib build 抽出非空
// dist/index.css（verify:dist 守卫要求）。真实棋盘/输入/提示 UI 随引擎补入。
import '@my-games/sudoku-core/style.css';

export interface GameSudokuProps {
  title?: string;
}

export function GameSudoku({ title = 'Sudoku' }: GameSudokuProps) {
  return (
    <div className="game-sudoku">
      <p>{title} · React 占位组件（0.0.0-stage）。真实棋盘随引擎后续提交补入。</p>
    </div>
  );
}
