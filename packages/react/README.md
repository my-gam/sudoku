# @my-games/sudoku-react

> 数独的 React 18/19 组件适配器。**当前为 `0.0.0` 占位版本**，`GameSudoku` 仅渲染占位文案。

```bash
pnpm add @my-games/sudoku-react react react-dom
```

```tsx
import { GameSudoku } from '@my-games/sudoku-react';
import '@my-games/sudoku-react/style.css';

export function Demo() {
  return <GameSudoku title="Sudoku" />;
}
```

**样式需显式引入**：vite lib build 把内部 CSS import 抽到 `dist/index.css`。
真实棋盘组件、`forwardRef` 句柄与 `useGame()` hook 随引擎后续提交补入。

完整说明见仓库根 README：<https://github.com/my-gam/sudoku#readme>

## License

MIT.
