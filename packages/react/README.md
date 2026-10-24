# @my-games/sudoku-react

> 数独的 React 18/19 组件适配器（函数组件 + Hooks + `forwardRef`），基于 `@my-games/sudoku-core`。

```bash
pnpm add @my-games/sudoku-react react react-dom
```

```tsx
import { GameSudoku } from '@my-games/sudoku-react';
import '@my-games/sudoku-react/style.css';

export function Demo() {
  return (
    <GameSudoku
      difficulty="easy"
      saveKey="my-app:sudoku:save"
      onDigit={(d, changed) => console.log('fill', d, changed)}
      onSolved={(p) => console.log('won', p.difficulty, p.seconds + 's')}
    />
  );
}
```

**样式需显式引入**：vite lib build 把内部 CSS import 抽到 `dist/index.css`，入口加一次
`import '@my-games/sudoku-react/style.css'`（或 core 的 `@my-games/sudoku-core/style.css`）。

## Props

同 Vue 版：`difficulty` / `storage` / `saveKey` / `bestKey` / `freshStart` / `autofocus` / `showPad` /
`title`，另有 `className`（追加到最外层 `.game-sudoku`）、`onDigit(digit, changed)`、
`onSolved({ difficulty, seconds })`。

## Ref 命令式方法（`GameSudokuHandle`）

```tsx
import { useRef } from 'react';
import { GameSudoku, type GameSudokuHandle } from '@my-games/sudoku-react';

const g = useRef<GameSudokuHandle>(null);
// g.current?.select(0, 2); g.current?.input(4); g.current?.hint(); g.current?.undo();
```

## Hook（想自己画 UI）

```tsx
import { useGame } from '@my-games/sudoku-react';
const { state, select, input, hint, undo, newGame } = useGame({ difficulty: 'hard' });
```

完整说明见仓库根 README：<https://github.com/my-gam/sudoku#readme>

## License

MIT.
