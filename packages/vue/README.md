# @my-games/sudoku-vue

> 数独的 Vue 3 组件适配器（Composition API + SFC），基于 `@my-games/sudoku-core`。

```bash
pnpm add @my-games/sudoku-vue vue
```

```vue
<script setup lang="ts">
import { GameSudoku } from '@my-games/sudoku-vue';
import '@my-games/sudoku-vue/style.css';

function onSolved(p: { difficulty: string; seconds: number }) {
  console.log('通关', p.difficulty, p.seconds + 's');
}
</script>

<template>
  <GameSudoku difficulty="easy" save-key="my-app:sudoku:save" @solved="onSolved" />
</template>
```

**样式需显式引入**：vite lib build 把内部 CSS import 抽到 `dist/index.css`，消费者入口加一次
`import '@my-games/sudoku-vue/style.css'`（或 `import '@my-games/sudoku-core/style.css'`，同源）。

## Props

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `difficulty` | `'easy'\|'medium'\|'hard'` | `'easy'` | 初始难度（组件内难度条可即时切换重开） |
| `storage` | `SaveStorage \| null` | `localStorage` | 传 `null` 关闭持久化（SSR） |
| `saveKey` | `string` | `game-sudoku:save` | 存档键，多实例分开 |
| `bestKey` | `string` | `game-sudoku:best` | 分难度最佳用时键 |
| `freshStart` | `boolean` | `false` | 忽略已有存档开新局 |
| `autofocus` | `boolean` | `true` | mount 后 focus 棋盘让键盘立即可用 |
| `showPad` | `boolean` | `true` | 是否显示数字键盘 |
| `showHint` | `boolean` | `false` | 是否显示「提示」按钮（`hint()` 始终在 ref / `useGame` 上） |
| `title` | `string` | `'数独'` | 头部标题 |
| `theme` | `'light'\|'dark'\|'high-contrast'\|'sepia'\|'auto'` | `'light'` | 根元素 `data-theme`；`auto` 由组件用 `matchMedia` 解析并跟随系统变化 |

> `theme` 默认 `light`，不静默跟随系统。选 `auto` 时首帧按 `light` 渲染（与 SSR 输出一致、不报水合
> 不匹配），系统为深色则挂载后有一次可见闪变；要消除请在服务端读 `Sec-CH-Prefers-Color-Scheme`
> 后直接传具体档。逐项改配色见 core README「主题与样式契约」——覆盖要打在 `.game-sudoku` 上，
> 写 `:root` 不生效。

## 事件

- `input({ digit, changed, row, col })` — 填数后触发；`row`/`col` 为目标格（0 起算，未选中为 `-1`），`changed` 表示盘面是否真的变了。
- `solved({ difficulty, seconds })` — 通关瞬间触发一次。

## Ref 命令式方法（`GameSudokuInstance`）

`select / input / erase / toggleNote / hint / newGame / undo`。

## Composable（想自己画 UI）

```ts
import { useGame } from '@my-games/sudoku-vue';
const { state, select, input, hint, undo, newGame } = useGame({ difficulty: 'medium' });
```

`state` 是 `ShallowRef<GameState>`，模板里 auto-unwrap。

完整说明见仓库根 README：<https://github.com/my-gam/sudoku#readme>

## License

MIT.
