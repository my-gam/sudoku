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
> 本仓库照 [`my-gam/2048`](https://github.com/my-gam/2048) 三层模板搭建，先手工 seed 一个占位版
> 种下 npm 首版并跑通 Trusted Publisher（这段历史有两个坑，见下面「发布流程」1–2 条），再由引擎与
> 适配层按功能块逐笔提交落地。

- **技术栈**：TypeScript 7（Go-native tsgo）· Vite 8（Rolldown）· Vue 3.5 · React 19（peerDep 兼容 18.2+）· Vitest 5
- **包结构**：`packages/core` + `packages/vue` + `packages/react`，pnpm workspace；`playground/` 是三 tab 演示页（Vanilla / Vue / React）。
- **纯 TS**：全项目 `strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`；core 单测 **131 条**，覆盖棋盘、求解、生成、状态机、存档、订阅、主题契约与边界。
- **真·引擎**：回溯求解器（MRV 启发）、唯一解题生成器（填盘 + 挖洞 + `countSolutions` 校验）、`Sudoku` 状态机（选格/填数/擦除/笔记/提示/撤销/计时/分难度最佳）。
- **主题**：样式全走 `--sudoku-*` 契约层，内置 light / dark / high-contrast / sepia 四档。档位由**引擎持有**（`game.setTheme()` / `GameState.theme`，独立持久化在 `game-sudoku:theme`），组件 `theme` 属性只是初始值/受控覆盖，纯 vanilla 与 IIFE 宿主同样能用，逐色可覆盖。

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
pnpm test         # core 单测（131 条）
node tools/pages.mjs  # 本地跑一遍 Pages 构建 + 零断链自检
```

## 在线 demo

**<https://my-gam.github.io/sudoku/>** — 由 `pages.yml` 从 `main` 自动构建 deploy。
可加 `?demo=vanilla|vue|react` 直接进某个 tab、`?theme=light|dark|high-contrast|sepia|auto`
直接换肤（可分享）、`?hint=1` 显示「提示」按钮（默认 `hint()` 只作 API）。
主题偏好存在 `game-sudoku:theme`，刷新与换 tab 都保持；URL 参数优先级更高。

## 玩法

- 点格子选中（或用方向键移动），按数字 1-9 / 点数字面板填入；`N` 切铅笔笔记，`Backspace` 擦除。
- 题面给定数字（中性淡底上的墨色粗字）不可改；填错（与同行/列/宫重复）会标红并计一次错误，但不强制拦下。
- 填满且无冲突即通关，按难度记录最佳用时（用时从第一次真正动手起算：填数、擦除、记笔记、提示都算开始游戏，只有选格浏览不计时）。「提示」填对一格，「撤销」回退，难度条即时重开一局。
- 题面给定数字 = 中性淡底上的墨色粗字，玩家填入 = 实心色块上的反白字，两套底色互差 ≥3:1（只改字色在数学上做不到一眼区分）。选中一格后，同行/列/宫的高亮在数字格上是把各自底色"调一档"而不是刷掉，题面/玩家身份仍一眼可辨。主题在页面顶部切换器可试四档，`?theme=dark` 之类可直接分享。
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
  const { Sudoku, resolveTheme } = SudokuCore;
  const game = new Sudoku({ difficulty: 'easy', theme: 'auto' });
  const dark = matchMedia('(prefers-color-scheme: dark)');
  const root = document.getElementById('app');
  // 主题归引擎：档位存在 state.theme，宿主只把它解析成具体档写进 data-theme。
  const applyTheme = () => { root.dataset.theme = resolveTheme(game.getTheme(), dark.matches); };
  game.subscribe((state) => { console.log(state.grid); applyTheme(); });
  dark.addEventListener('change', applyTheme); // 系统翻深浅时重算（setTheme 同值不会重推）
  game.select(0, 2);
  game.input(4);
</script>
```

> 样式在 `@my-games/sudoku-core/style.css`（随包发布的源样式），用 `<link>` 或你的打包器引入。
> 主题档位（`light` / `dark` / `high-contrast` / `sepia` / `auto`）由引擎持有并持久化在
> `game-sudoku:theme`，不依赖 Vue / React —— 上面这段就是纯浏览器的用法。

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
| `theme` | `'light'\|'dark'\|'high-contrast'\|'sepia'\|'auto'` | 不传（引擎决定） | 初始 / 受控主题；见下面「主题与自定义外观」 |

事件：`input`/`onDigit({ digit, changed, row, col })`（`row`/`col` 为目标格，0 起算）、`solved({ difficulty, seconds })`；React 另有 `className`。
`ref`（`GameSudokuInstance` / `GameSudokuHandle`）暴露 `select / input / erase / toggleNote / hint / newGame / undo / setTheme / getTheme`。

### 引擎核心 API（`@my-games/sudoku-core`）

- `new Sudoku(options?)`：`difficulty` / `rng` / `clock` / `storage` / `saveKey` / `bestKey` /
  `theme` / `themeKey` / `freshStart` / `puzzle` / `solution` / `undoLimit`
- `subscribe/getState/getGrid/getPuzzle/getSolution` + `select/input/erase/toggleNote/hint/newGame/undo/canUndo/clearSaved`
- 主题：`getTheme()` / `setTheme(next): boolean` / `getEffectiveTheme(prefersDark?)`；档位也在 `GameState.theme`
- 档位与工具：`SUDOKU_THEMES` / `SUDOKU_DATA_THEMES` / `DEFAULT_THEME` / `isTheme` / `normalizeTheme` /
  `resolveTheme` / `loadTheme` / `writeTheme` / `clearTheme` / `DEFAULT_THEME_KEY`
- 求解/生成：`solve` / `countSolutions` / `generatePuzzle` / `generateFullGrid` / `TARGET_CLUES`
- 纯函数原语与存储工具见 `packages/core/README.md`

## 主题与自定义外观

### 四档预设

| 档位 | 气质 | 典型场景 |
| --- | --- | --- |
| `light`（默认） | 冷灰白 + 蓝 | 常规 |
| `dark` | 中性深灰 + 亮蓝 | 夜间 |
| `high-contrast` | 纯黑白 + 黄，分隔线最硬 | 强光、低视力 |
| `sepia` | 米黄纸底 + 墨绿 | 长时间阅读 |

档位归**引擎**持有，三种接法完全等价：

```tsx
<GameSudoku theme="dark" />                 {/* 组件属性：初始值 / 受控覆盖 */}
gameRef.current?.setTheme('sepia');          {/* 命令式：落到引擎，UI 自己跟着重渲染 */}
new Sudoku({ theme: 'auto' });               {/* IIFE / vanilla：不依赖任何框架 */}
```

- `'auto'` = 跟随系统深浅。core 保持零 DOM，所以解析发生在宿主侧：适配器用
  `matchMedia` 拿到结果后调 `resolveTheme(theme, prefersDark)`（或
  `game.getEffectiveTheme(prefersDark)`）得到具体档，再写进根元素的 `data-theme`。
- 当前档在 `GameState.theme` 里随快照推给所有订阅者；`setTheme()` 收到登记表外的值
  返回 `false` 且状态不动。
- 持久化落在**独立键** `game-sudoku:theme`（可用 `themeKey` 改），与对局存档分家：
  换难度、开新局都保留，刷新后仍在；`undo()` 不会把配色撤回去。

### CSS 变量：逐色自定义

样式表分三层。**契约层** `--sudoku-*` 是对外承诺；**解析层**把它映射成内部短名；
**布局层**只消费短名，且不含一个颜色字面量（`test/theme.test.ts` 静态断言这点）。

```css
/* ✅ 覆盖生效：预设全部写成 :where(...) 零特异性，任何真实选择器都盖得住 */
.game-sudoku {
  --sudoku-cell-bg: #101820;
  --sudoku-text-given: #e8edf3;
  --sudoku-user-bg: #2f855a;   /* 玩家数字的实心色块 */
  --sudoku-accent: #38b2ac;
  --sudoku-board-size: min(96vw, 520px);
}

/* ✅ 就地改一个色也行 */
// <GameSudoku class="game-sudoku" style={{ '--sudoku-given-bg': '#fff' }} />
```

```css
/* ❌ 不生效：自定义属性就近解析，元素自身的声明优先于从 :root 继承的值 */
:root { --sudoku-cell-bg: #101820; }
```

常用变量（完整约 32 个的清单与分组见 [`packages/core/README.md`](./packages/core/README.md#主题与样式契约)）：

| 想要的效果 | 改哪个 |
| --- | --- |
| 棋盘整体尺寸 / 圆角 / 缝隙 | `--sudoku-board-size` · `--sudoku-radius` · `--sudoku-box-gap` · `--sudoku-cell-gap` |
| 格子底、九宫分隔线 | `--sudoku-cell-bg` · `--sudoku-line-strong` · `--sudoku-line-soft` |
| 题面数字（淡底 + 字重） | `--sudoku-given-bg` · `--sudoku-text-given` · `--sudoku-given-weight` |
| 玩家数字（色块 + 反白） | `--sudoku-user-bg` · `--sudoku-text-user` |
| 选中 / 同数 / 同行高亮 | `--sudoku-hl-selected` · `--sudoku-hl-same` · `--sudoku-hl-peer` |
| 冲突格 | `--sudoku-bad-bg` · `--sudoku-bad-text` |
| 按钮 / 数字面板 / 难度条 | `--sudoku-button-bg` · `--sudoku-pad-bg` · `--sudoku-chip-bg` 及各自 hover/text 配套 |
| 强调色与其上文字、焦点环 | `--sudoku-accent` · `--sudoku-accent-dark` · `--sudoku-on-accent` · `--sudoku-focus-ring` |

> **为什么题面数字与玩家数字是"两套底色"而不是两种字色**：同一张浅底上，两个颜色若都要过
> WCAG AA 正文 4.5:1，彼此最多差约 1.28:1 —— 只改字色在数学上做不到一眼区分。所以给定数字
> 走中性淡底 + 墨色粗字，玩家数字走实心色块 + 反白字，两套底色互差 ≥3:1（有硬断言）。
> 字重差异只是辅助通道：Android 的 Roboto 没有 800 一档，16px 下 800 与 500 本来就分不开。
>
> **选中一格后，同行/列/宫的高亮是"调底"不是"刷底"**：数字格的高亮用 `color-mix` 把各自的
> 底色往高亮色调一档（玩家色块变深、题面淡底带上一笔高亮色），身份一眼可辨；空格仍是平底
> （笔记需要）。选中格另有 `--sudoku-accent` 内描边。
>
> 加新档位或改配色时，四档必须同时补齐同一组 token —— 漏一个不会悄悄变透明，
> `test/theme.test.ts` 会直接判红。

## 目录结构

```
sudoku/
├── packages/
│   ├── core/   @my-games/sudoku-core  纯 TS 引擎
│   │   ├── src/{types,board,solver,generator,game,storage,themes,index}.ts
│   │   ├── src/style.css                 单份视觉 + 主题契约层，Vue/React 共享
│   │   └── test/{board,solver,generator,game,storage,index,theme}.test.ts  131 单测
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

1. **可信发布者发不了某包的第一个版本**，所以首版必须**手工** `npm publish`。想让占位版不占用
   `latest`，靠的是 dist-tag（`--tag stage`），与版本号本身无关。
2. **占位/预发布号必须带 `--tag` 发**，否则发布那一刻 `latest` 就指向它。本仓库当年连发了两个
   占位版都没带 tag —— registry 的 `time` 可复核：`0.0.0-stage`（10-24 15:24:11）→ 76 秒后
   `0.0.0`（15:25:27）→ `0.0.1`（15:49）→ `0.1.0`（10-25 07:31），而 `dist-tags` 现在只剩
   `latest: 0.1.0`，即**两个无 tag 的孤儿占位版**。
   > 更正：旧版本文档写过「`0.0.0-stage` 是 npm Staged Publishing 保留哨兵号、普通 publish 会被
   > `403` 拒」——**不成立**，它实际发成功了（见上面的 `time`）。占位版 72h 内可 `unpublish`，
   > 本包两个都已过期，只能 `npm deprecate`，暂不处理。
3. `pnpm` 在 **Windows 下执行 package.json 脚本不剥单引号**，`--filter './packages/**'` 会被当字面量、
   匹配 0 项目、退出码仍是 0 → 三道门禁静默空跑假绿（Linux CI 的 `/bin/sh` 会剥，查不出）。根脚本因此
   一律用转义双引号 `--filter \"./packages/**\"`，并以 `tools/verify-dist.mjs` 断言产物把空跑变硬失败。

**GitHub Pages**：`main` push（`playground/**` / `packages/**` / `tools/pages.mjs` / `pnpm-lock.yaml` /
`package.json`）触发 `pages.yml`，走 `pnpm build` → `verify:dist` → `node tools/pages.mjs`（内存覆盖
`base=/<repo>/` + 零断链自检）→ deploy 到 <https://my-gam.github.io/sudoku/>。

## 设计取舍与已知边界

- **CSS 单点**：样式只放 `core/src/style.css` 一份，vue/react `import` 后各自抽出 `dist/index.css`
  （内容一致）；消费者显式引 CSS。（合集模板缺陷②「单复数 / 源与产物不对称」在本仓库已统一为 `./style.css`。）
- **主题是 CSS 变量 + 引擎状态**：core 保持零 DOM，落到页面上就是一个 `data-theme` 属性，但
  档位本身存在引擎里（`GameState.theme`，独立键持久化），所以三种消费面接法一致。代价是四档色板
  在 CSS 里各写一份（约 32 个 `--sudoku-*` × 4 档），完整性、"布局层零硬编码色"、"两类数字
  的两套底色互差 ≥3:1"全部由 `test/theme.test.ts` 静态断言把关，不靠肉眼往返猜；配色另按
  WCAG 2.1 逐对实测（脚本见该文件与合集根 `.theme-contrast.mjs`）。
- **`auto` 归适配层**：放进 CSS 会把深色那叠变量抄第二遍（`dark` 与「auto 且系统为深」生效条件不同，
  规则体无法共享），所以组件用 `matchMedia` 解析。副作用是深色系统下首帧有一次浅→深闪变。
- **冲突不拦填**：允许把冲突值填进去并标红 + 计错误，贴近真实数独 App（区别于「非法直接拒绝」）。
- **适配层无单测**：与 2048 模板一致，回归主要靠 core 的 131 条用例；适配层靠 `typecheck + build` 覆盖，
  是否补 `@vue/test-utils` / `@testing-library/react` 是独立的、需新增依赖的决策。
- **计时非高精度**：`elapsedSeconds` 靠注入 `clock` 差值，标签页挂起不计；够休闲游戏用。

## 许可

MIT · © 2026 xyj2156
