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
`showHint`（默认 `false`，`hint()` 始终在句柄 / `useGame` 上）/ `title` / `theme`，另有 `className`（追加到最外层
`.game-sudoku`）、`onDigit({ digit, changed, row, col })`、`onSolved({ difficulty, seconds })`。

`theme?: SudokuTheme`（`'light'|'dark'|'high-contrast'|'sepia'|'auto'`）——**档位归 core 引擎**：
不传时引擎读自己的持久化偏好（`game-sudoku:theme`）并回落 `'light'`，传了则写回引擎；刷新后
保持，同页多实例共享。`'auto'` 由本组件用 `matchMedia` 解析成 `light`/`dark` 并跟随系统变化。
首帧一律按 `light` 渲染，所以服务端渲染结果与之一致、不会报水合不匹配；但系统为深色且用
`auto` 时，挂载后仍会有一次可见的浅→深闪变——要消除得由宿主在服务端读
`Sec-CH-Prefers-Color-Scheme` 后直接传具体档，组件本身拿不到请求头。配色可逐项覆盖，见 core
README「主题与样式契约」（注意覆盖要打在 `.game-sudoku` 上，写 `:root` 不生效）。

## Ref 命令式方法（`GameSudokuHandle`）

```tsx
import { useRef } from 'react';
import { GameSudoku, type GameSudokuHandle } from '@my-games/sudoku-react';

const g = useRef<GameSudokuHandle>(null);
// g.current?.select(0, 2); g.current?.input(4); g.current?.hint(); g.current?.undo();
// g.current?.setTheme('dark'); g.current?.getTheme();  // 主题也在引擎上，返回 false = 档位非法
```

## Hook（想自己画 UI）

```tsx
import { useGame } from '@my-games/sudoku-react';
const { state, select, input, hint, undo, newGame } = useGame({ difficulty: 'hard' });
```

完整说明见仓库根 README：<https://github.com/my-gam/sudoku#readme>

## License

MIT.
