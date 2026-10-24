import { DIGITS, cellAt, createEmptyGrid, isSafe, setCell } from './board';
import { countSolutions } from './solver';
import type { Difficulty, Grid, RandomSource } from './types';

/**
 * 数独生成器：产出「有唯一解」的题目。
 *
 * 流程：
 * 1. `generateFullGrid` —— 随机回溯填满一张合法终盘（作为 solution）。
 * 2. `digHoles` —— 以随机顺序尝试把格子挖空；每挖一格前用 `countSolutions(limit=2)`
 *    校验：挖掉后仍「唯一解」才保留，否则回填。挖到目标线索数或无格可挖为止。
 *
 * 这样产出的 puzzle 保证唯一解，且 puzzle ⊂ solution（挖掉的都是解里可推出来的格）。
 * rng 注入保证单测可复现；默认 `Math.random`。
 */

/** 各难度目标线索数（题面给定数字个数）。实际可能因唯一性约束略多。 */
export const TARGET_CLUES: Record<Difficulty, number> = {
  easy: 45,
  medium: 35,
  hard: 27
};

/** Fisher–Yates 洗牌（返回新数组，用注入 rng）。 */
function shuffle<T>(input: readonly T[], rng: RandomSource): T[] {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    const a = arr[j];
    if (tmp !== undefined && a !== undefined) {
      arr[i] = a;
      arr[j] = tmp;
    }
  }
  return arr;
}

/** 从 pos 起原地回溯填满 grid（每格用随机顺序的合法数字）。 */
function fillFully(grid: Grid, pos: number, rng: RandomSource): boolean {
  if (pos >= grid.length * grid.length) return true;
  const row = Math.floor(pos / grid.length);
  const col = pos % grid.length;
  if (cellAt(grid, row, col) !== 0) return fillFully(grid, pos + 1, rng);
  for (const d of shuffle(DIGITS, rng)) {
    if (isSafe(grid, row, col, d)) {
      setCell(grid, row, col, d);
      if (fillFully(grid, pos + 1, rng)) return true;
      setCell(grid, row, col, 0);
    }
  }
  return false;
}

/** 生成一张随机合法终盘（9×9 全填、无冲突）。 */
export function generateFullGrid(rng: RandomSource = Math.random): Grid {
  const grid = createEmptyGrid();
  // 空盘的回溯填满总有解（数独解空间非空），fillFully 必返回 true。
  fillFully(grid, 0, rng);
  return grid;
}

/**
 * 在终盘副本上随机挖洞到目标线索数，保持唯一解。
 * 返回挖洞后的题面（会修改并返回传入的 puzzle 副本，入参 solution 不动）。
 */
function digHoles(solution: Grid, targetClues: number, rng: RandomSource): Grid {
  const puzzle = solution.map((row) => row.slice());
  const total = puzzle.length * puzzle.length;
  // 全部坐标乱序，作为挖除尝试顺序。
  const order: number[] = [];
  for (let i = 0; i < total; i++) order.push(i);
  const shuffled = shuffle(order, rng);

  let clues = total;
  for (const idx of shuffled) {
    if (clues <= targetClues) break;
    const r = Math.floor(idx / puzzle.length);
    const c = idx % puzzle.length;
    const backup = cellAt(puzzle, r, c);
    if (backup === 0) continue; // 已挖空
    setCell(puzzle, r, c, 0);
    // 挖掉后是否仍唯一解？不是就回填。
    if (countSolutions(puzzle, 2) === 1) {
      clues--;
    } else {
      setCell(puzzle, r, c, backup);
    }
  }
  return puzzle;
}

export interface GeneratedPuzzle {
  /** 题面（含 0 空格），有唯一解。 */
  puzzle: Grid;
  /** 与题面一致的完整解（题面 ⊂ 解）。 */
  solution: Grid;
  difficulty: Difficulty;
  /** 实际线索数（题面给定个数）。 */
  clues: number;
}

/** 生成一道指定难度、唯一解的数独题。 */
export function generatePuzzle(
  difficulty: Difficulty = 'easy',
  rng: RandomSource = Math.random
): GeneratedPuzzle {
  const solution = generateFullGrid(rng);
  const puzzle = digHoles(solution, TARGET_CLUES[difficulty] ?? TARGET_CLUES.easy, rng);
  let clues = 0;
  for (const row of puzzle) for (const v of row) if (v !== 0) clues++;
  return { puzzle, solution, difficulty, clues };
}
