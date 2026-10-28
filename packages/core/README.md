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
