# sudoku

[![npm @my-games/sudoku-core](https://img.shields.io/npm/v/%40my-games%2Fsudoku-core?label=core&logo=npm&color=cb3837)](https://www.npmjs.com/package/@my-games/sudoku-core)
[![npm @my-games/sudoku-vue](https://img.shields.io/npm/v/%40my-games%2Fsudoku-vue?label=vue&logo=vue.js&color=42b883)](https://www.npmjs.com/package/@my-games/sudoku-vue)
[![npm @my-games/sudoku-react](https://img.shields.io/npm/v/%40my-games%2Fsudoku-react?label=react&logo=react&color=61dafb)](https://www.npmjs.com/package/@my-games/sudoku-react)
[![Publish](https://img.shields.io/github/actions/workflow/status/my-gam/sudoku/publish.yml?label=publish&logo=githubactions)](https://github.com/my-gam/sudoku/actions/workflows/publish.yml)
[![Pages](https://img.shields.io/github/actions/workflow/status/my-gam/sudoku/pages.yml?label=pages&logo=githubactions)](https://my-gam.github.io/sudoku/)
[![license: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![online demo](https://img.shields.io/badge/playground-my--gam.github.io%2Fsudoku%2F-blueviolet?logo=githubpages)](https://my-gam.github.io/sudoku/)

> 一个数独小游戏。核心引擎不依赖任何框架，产出 **ESM / CJS / UMD / IIFE 四种格式**；
> Vue 3 与 React 18/19 各有一份官方适配器，两端共享同一份样式表与引擎行为，完全一致。
>
> 本仓库照 [`my-gam/2048`](https://github.com/my-gam/2048) 三层模板搭建，先以 `0.0.0` 手工占位
> 种下 npm 首版并跑通 Trusted Publisher，再由引擎与适配层按功能块逐笔提交落地。

- **技术栈**：TypeScript 7（Go-native tsgo）· Vite 8（Rolldown）· Vue 3.5 · React 19（peerDep 兼容 18.2+）· Vitest 5
- **包结构**：`packages/core` + `packages/vue` + `packages/react`，pnpm workspace；`playground/` 是三 tab 演示页（Vanilla / Vue / React）。
- **纯 TS**：全项目 `strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`；core 单测 **82 条**，覆盖棋盘、求解、生成、状态机、存档、订阅与边界。
- **真·引擎**：回溯求解器（MRV 启发）、唯一解题生成器（填盘 + 挖洞 + `countSolutions` 校验）、`Sudoku` 状态机（选格/填数/擦除/笔记/提示/撤销/计时/分难度最佳）。

## 本地跑起来

```bash
git clone git@github.com:my-gam/sudoku.git
cd sudoku
pnpm install
pnpm build          # 先构建三包（playground 依赖它们的 dist）
pnpm dev            # 起 playground，默认 http://127.0.0.1:5173
```

> ⚠ playground 不是「workspace 源码直连」：core/vue/react 的 `exports` 都指向 `./dist/*` 且
> `dist/` 被 gitignore，所以**必须先 `pnpm build`**。`pnpm dev` 脚本已内含 `pnpm build`。

其他命令：

```bash
pnpm build        # 三包 vite lib（core 四格式；vue/react ESM+CSS+DTS）
pnpm verify:dist  # 断言 11 个必需产物存在且非 0 字节（防 --filter 空跑假绿）
pnpm typecheck    # core / vue / react 全量 tsc --noEmit
pnpm test         # core 单测（82 条）
node tools/pages.mjs  # 本地跑一遍 Pages 构建 + 零断链自检
```

## 在线 demo

**<https://my-gam.github.io/sudoku/>** — 由 `pages.yml` 从 `main` 自动构建 deploy。
可加 `?demo=vanilla|vue|react` 直接进某个 tab、`?hint=1` 显示「提示」按钮（默认 `hint()` 只作 API）。

## 玩法

- 点格子选中（或用方向键移动），按数字 1-9 / 点数字面板填入；`N` 切铅笔笔记，`Backspace` 擦除。
- 题面给定数字（深色加粗）不可改；填错（与同行/列/宫重复）会标红并计一次错误，但不强制拦下。
- 填满且无冲突即通关，按难度记录最佳用时（用时从首次填充起算，开局浏览/记笔记不计时）。「提示」填对一格，「撤销」回退，难度条即时重开一局。
- 存档与最佳用时落 `localStorage`（可注入自定义 `SaveStorage` 或 `null` 关闭）。

## 集成到你的项目

### Vue 3

```bash
pnpm add @my-games/sudoku-vue vue
```

```vue
<script setup lang="ts">
import { GameSudoku } from '@my-games/sudoku-vue';
import '@my-games/sudoku-vue/style.css';
</script>

<template>
  <GameSudoku difficulty="easy" save-key="my-app:sudoku:save" @solved="(p) => console.log(p)" />
</template>
```

### React 18 / 19

```bash
pnpm add @my-games/sudoku-react react react-dom
```

```tsx
import { GameSudoku } from '@my-games/sudoku-react';
import '@my-games/sudoku-react/style.css';

export function Demo() {
  return <GameSudoku difficulty="medium" onSolved={(p) => console.log(p)} />;
}
```

**样式必须显式引入**：Vite 8 lib 模式把组件内 CSS import 抽到 `dist/index.css`，JS bundle 不再引 CSS。
消费者入口加一次 `import '@my-games/sudoku-{vue,react}/style.css'`，或直接引 `@my-games/sudoku-core/style.css`（同源）。

### 浏览器直接引入（IIFE / UMD，无需 bundler）

core 还产出 `dist/index.iife.js` 与 `dist/index.umd.js`，全局变量 **`SudokuCore`**：

```html
<!doctype html>
<link rel="stylesheet" href="https://unpkg.com/@my-games/sudoku-core/src/style.css" />
<div id="app"></div>
<script src="https://unpkg.com/@my-games/sudoku-core/dist/index.iife.js"></script>
<script>
  const { Sudoku } = SudokuCore;
  const game = new Sudoku({ difficulty: 'easy' });
  game.subscribe((state) => console.log(state.grid));
  game.select(0, 2);
  game.input(4);
</script>
```

> 样式在 `@my-games/sudoku-core/style.css`（随包发布的源样式），用 `<link>` 或你的打包器引入。

### Node.js（ESM / CJS）

```ts
import { generatePuzzle, solve, countSolutions } from '@my-games/sudoku-core';
const { puzzle, solution } = generatePuzzle('hard');
console.log(countSolutions(puzzle) === 1, solve(puzzle)); // true, 与 solution 一致
```

## Props / 事件 / API（Vue 与 React 对齐）

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `difficulty` | `'easy'\|'medium'\|'hard'` | `'easy'` | 初始难度（组件内难度条可即时重开） |
| `storage` | `SaveStorage \| null` | `localStorage` | `null` 关闭持久化（SSR 也传 `null`） |
| `saveKey` | `string` | `game-sudoku:save` | 存档键（多实例务必分开） |
| `bestKey` | `string` | `game-sudoku:best` | 分难度最佳用时键 |
| `freshStart` | `boolean` | `false` | 忽略已有存档开新局 |
| `autofocus` | `boolean` | `true` | mount 后 focus 棋盘 |
| `showPad` | `boolean` | `true` | 是否显示数字键盘 |
| `showHint` | `boolean` | `false` | 是否显示「提示」按钮；`hint()` 始终在 ref / `useGame` API 上 |
| `title` | `string` | `'数独'` | 头部标题 |

事件：`input`/`onDigit({ digit, changed, row, col })`（`row`/`col` 为目标格，0 起算）、`solved({ difficulty, seconds })`；React 另有 `className`。
`ref`（`GameSudokuInstance` / `GameSudokuHandle`）暴露 `select / input / erase / toggleNote / hint / newGame / undo`。

### 引擎核心 API（`@my-games/sudoku-core`）

- `new Sudoku(options?)`：`difficulty` / `rng` / `clock` / `storage` / `saveKey` / `bestKey` / `freshStart` / `puzzle` / `solution` / `undoLimit`
- `subscribe/getState/getGrid/getPuzzle/getSolution` + `select/input/erase/toggleNote/hint/newGame/undo/canUndo/clearSaved`
- 求解/生成：`solve` / `countSolutions` / `generatePuzzle` / `generateFullGrid` / `TARGET_CLUES`
- 纯函数原语与存储工具见 `packages/core/README.md`

## 目录结构

```
sudoku/
├── packages/
│   ├── core/   @my-games/sudoku-core  纯 TS 引擎
│   │   ├── src/{types,board,solver,generator,game,storage,index}.ts
│   │   ├── src/style.css                 单份视觉，Vue/React 共享
│   │   └── test/{board,solver,generator,game,storage,index}.test.ts  82 单测
│   ├── vue/    @my-games/sudoku-vue   GameSudoku.vue + useGame + instance
│   └── react/  @my-games/sudoku-react GameSudoku.tsx + useGame
├── playground/ Vite 三 tab 演示（Vanilla / Vue / React）
├── tools/      pages.mjs（Pages 构建 + 零断链自检）、verify-dist.mjs（产物守卫）
└── .github/    publish.yml / pages.yml / dependabot / issue & PR 模板
```

## 构建产物

| 位置 | 内容 |
| --- | --- |
| `packages/core/dist/` | `index.js`（ESM）· `index.cjs` · `index.umd.js` · `index.iife.js` · `index.d.ts` · sourcemap |
| `packages/vue/dist/` `packages/react/dist/` | `index.js`（ESM）+ `index.d.ts` + `index.css` + sourcemap |
| `pages-dist/` | `node tools/pages.mjs`（base=`/sudoku/`，GitHub Pages 用） |

IIFE 全局名 `SudokuCore`，挂 core 全部导出。`dist/`、`pages-dist/` 均在 `.gitignore`。

## 发布流程（含踩过的坑）

**npm 三包**：推 `v*` tag 触发 `publish.yml` → 门禁（`pnpm build` → `verify:dist` → `typecheck & test` →
tag↔版本一致）→ `pnpm -r publish --access public --provenance`（OIDC Trusted Publishing，零 secret）。

首版坑（本仓库已趟过）：

1. **可信发布者发不了某包的第一个版本**，所以首版必须**手工** `npm publish`。想让它不占用 `latest`，
   靠的是 **dist-tag** `--tag stage`，与版本号本身无关。
2. **`0.0.0-stage` 是 npm Staged Publishing 的保留哨兵版本号**，普通 `publish` 用它会被 registry 拒
   （`403`）。本项目改用 `0.0.0` 手工 seed，之后由 `v0.0.1` tag 经 CI 自动发布、`latest` 正常。
3. `pnpm` 在 **Windows 下执行 package.json 脚本不剥单引号**，`--filter './packages/**'` 会被当字面量、
   匹配 0 项目、退出码仍是 0 → 三道门禁静默空跑假绿（Linux CI 的 `/bin/sh` 会剥，查不出）。根脚本因此
   一律用转义双引号 `--filter \"./packages/**\"`，并以 `tools/verify-dist.mjs` 断言产物把空跑变硬失败。

**GitHub Pages**：`main` push（`playground/**` / `packages/**` / `tools/pages.mjs` / `pnpm-lock.yaml` /
`package.json`）触发 `pages.yml`，走 `pnpm build` → `verify:dist` → `node tools/pages.mjs`（内存覆盖
`base=/<repo>/` + 零断链自检）→ deploy 到 <https://my-gam.github.io/sudoku/>。

## 设计取舍与已知边界

- **CSS 单点**：样式只放 `core/src/style.css` 一份，vue/react `import` 后各自抽出 `dist/index.css`
  （内容一致）；消费者显式引 CSS。（合集模板缺陷②「单复数 / 源与产物不对称」在本仓库已统一为 `./style.css`。）
- **冲突不拦填**：允许把冲突值填进去并标红 + 计错误，贴近真实数独 App（区别于「非法直接拒绝」）。
- **适配层无单测**：与 2048 模板一致，回归主要靠 core 的 82 条用例；适配层靠 `typecheck + build` 覆盖，
  是否补 `@vue/test-utils` / `@testing-library/react` 是独立的、需新增依赖的决策。
- **计时非高精度**：`elapsedSeconds` 靠注入 `clock` 差值，标签页挂起不计；够休闲游戏用。

## 许可

MIT · © 2026 xyj2156
