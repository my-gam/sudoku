# @my-games/sudoku-core

> 数独引擎核心，纯 TypeScript、无框架依赖。产出 ESM / CJS / UMD / IIFE 四格式；
> IIFE/UMD 全局名 `SudokuCore`。样式：`@my-games/sudoku-core/style.css`。

**如果你要用 Vue 或 React，直接装对应适配器包更省事**（见 `@my-games/sudoku-vue` / `-react`）。

```bash
pnpm add @my-games/sudoku-core
```

## 快速开始

```ts
import { Sudoku } from '@my-games/sudoku-core';

const game = new Sudoku({ difficulty: 'easy' });
const unsub = game.subscribe((state) => {
  // state: difficulty / grid / givenMask / notes / selected / conflicts /
  //        status / elapsedSeconds / bestSeconds / hintCount / mistakeCount /
  //        moveCount / historySize
  console.log(state.status, state.elapsedSeconds);
});

game.select(0, 2);
game.input(4);      // 在选中空格填 4（给定格/已通关会被拒）
game.toggleNote(7); // 空格铅笔笔记
game.hint();        // 用解填一格
game.undo();
unsub();
```

## 引擎 API

- `new Sudoku(options?)` — 全可注入：`difficulty` / `rng` / `clock` / `storage` / `saveKey` /
  `bestKey` / `freshStart` / `puzzle` / `solution` / `undoLimit`。默认 `difficulty:'easy'` 现场生成唯一解题。
- `game.subscribe(fn): () => void` — 注册即收一次快照，返回退订函数。
- `game.getState()` — `GameState` 深拷贝快照；`getGrid()` / `getPuzzle()` / `getSolution()`。
- 操作：`select(row, col)` / `input(digit)` / `erase()` / `toggleNote(digit)` / `hint()` /
  `newGame(difficulty?)` / `undo()` / `canUndo()` / `clearSaved()`。
- 求解/生成：`solve(grid)` / `countSolutions(grid, limit=2)` / `generatePuzzle(difficulty, rng)` /
  `generateFullGrid(rng)` / `TARGET_CLUES`。
- 纯函数原语：`createEmptyGrid` / `cloneGrid` / `cellAt` / `setCell` / `withCell` / `peers` /
  `isSafe` / `candidates` / `emptyCells` / `isFull` / `findConflicts` / `hasConflict` /
  `isSolved` / `gridsEqual` / `countFilled` / `boxOrigin` / `makeMask` + 常量 `SIZE` / `BOX` / `DIGITS`。
- 存储：`loadSave` / `writeSave` / `clearSave` / `isSerializedSave` / `loadBest` / `writeBest` /
  `emptyBestTimes` / `tryGetGlobalStorage` + 键常量。
- 主题：`SUDOKU_THEMES` / `SUDOKU_DATA_THEMES` / `DEFAULT_THEME` / `isTheme` / `normalizeTheme` /
  `resolveTheme(theme, prefersDark)` + 类型 `SudokuTheme` / `SudokuDataTheme`。
  本包零 DOM，只提供档位真相与纯解析函数；写 `data-theme` 的是宿主或适配层组件。

## 主题与样式契约

`@my-games/sudoku-core/style.css` 是三层结构，视觉全部走变量，布局层不出现一个颜色字面量
（`test/theme.test.ts` 会静态断言这一点）。

| 层 | 作用 | 你会碰到的 |
| --- | --- | --- |
| 契约层 | `--sudoku-*`，四档预设各写一份 | 覆盖配色就在这里 |
| 解析层 | 短名 ← 契约名，整表只一次 | 一般不用管 |
| 布局层 | 只消费短名 | 改尺寸/结构时看 |

四档预设：`light`（默认，未写属性即此档）、`dark`、`high-contrast`、`sepia`。
选择方式是在组件根元素上放属性：

```html
<div class="game-sudoku" data-theme="dark">…</div>
```

`auto`（跟随系统）**不在 CSS 里**，是适配层 / 宿主的解析结果：用 `matchMedia` 拿到深浅后
调 `resolveTheme('auto', prefersDark)` 得到具体档再写入。手写 `data-theme="auto"` 得到默认浅色。

自定义配色——**注意选择器**，四档预设全部写成 `:where(...)`，特异性恒为 0，所以：

```css
/* ✅ 生效：任何真实选择器都盖得住零特异性预设 */
.game-sudoku { --sudoku-cell-bg: #101820; --sudoku-text-user: #7ee0c0; }
/* ✅ 更省事：直接挂在元素上 */
<div class="game-sudoku" style="--sudoku-accent:#c04">
```

```css
/* ❌ 不生效：自定义属性就近解析，元素自身的声明优先于从 :root 继承的值 */
:root { --sudoku-cell-bg: #101820; }
```

可覆盖的完整清单（约 32 个，四档均已给值）：结构线 `--sudoku-line-strong` /
`--sudoku-line-soft` / `--sudoku-cell-bg`；文字 `--sudoku-text-base` / `--sudoku-text-given` /
`--sudoku-text-user` / `--sudoku-text-muted`；题面数字 `--sudoku-given-bg` /
`--sudoku-given-weight`；玩家数字 `--sudoku-user-bg` / `--sudoku-user-ink-on-tint`；
高亮 `--sudoku-hl-selected` / `--sudoku-hl-peer` / `--sudoku-hl-same` /
`--sudoku-bad-bg` / `--sudoku-bad-text`；强调 `--sudoku-accent` / `--sudoku-accent-dark` /
`--sudoku-on-accent` / `--sudoku-focus-ring`；控件 `--sudoku-chip-bg` / `--sudoku-button-bg` /
`--sudoku-button-bg-hover` / `--sudoku-pad-bg` / `--sudoku-pad-bg-hover` / `--sudoku-pad-text` /
`--sudoku-stat-text` / `--sudoku-danger-text` / `--sudoku-overlay-bg`；几何 `--sudoku-board-size` /
`--sudoku-box-gap` / `--sudoku-cell-gap` / `--sudoku-radius`。

**题面数字与玩家数字为什么长这样**：给定 = 中性淡底上的墨色粗字，玩家 = 实心色块上的反白字。
原因是个数学事实——同一张浅底上，两个颜色若都要过 4.5:1（AA 正文），彼此最多差约 1.28:1，
所以「只改字色」永远做不到一眼区分，必须动底色。字重差异（700 vs 500）保留但只作辅助通道
（Android 的 Roboto 没有 800 一档，16px 下 800 与 500 本来就拉不开）；窄屏另有
`@media (max-width: 420px)` 单独把给定数字号抬半档。
玩家格被选中/同数/同行高亮盖住时改用 `--sudoku-user-ink-on-tint`（否则反白字会压在浅色填充上
看不见），冲突态再压过它回到红字——这两条顺序都有测试盯着。
四档配色按 WCAG 2.1 逐对实测过线，且「两套底色互差 ≥3:1」「色块与普通格子互差 ≥3:1」
是 `test/theme.test.ts` 里的硬断言。

## 规则要点

- 9×9，3×3 宫；题面给定格不可改写。
- `input` 填的值若与同行/列/宫重复 → 计入 `mistakeCount` 且该格进 `conflicts`，但仍允许填（不强制拦下）。
- 全部 81 格填满且无冲突 → `status:'won'`，按难度写入 `bestSeconds`（更快才覆盖）。
- 计时用注入的 `clock`（默认 `Date.now`）：**第一次改动局面（`input` / `erase` / `toggleNote` / `hint`）才起表**，
  只选格浏览不计时；`elapsedSeconds` 在 `won` 时定格。
- 存档（含题面、解、当前盘、笔记、计数、用时）落 `saveKey`；`best`（分难度）落 `bestKey`；
  同难度同题面才续档，损坏 JSON / 版本不符自动开新局。

完整玩法、Props / Events / ref API、设计取舍见仓库根 README：<https://github.com/my-gam/sudoku#readme>

## License

MIT.
