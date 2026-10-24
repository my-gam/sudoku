import { candidates, cellAt, cloneGrid, hasConflict, setCell } from './board';
import type { Digit, Grid } from './types';

/**
 * 数独回溯求解器（MRV 启发式）+ 解个数统计。
 *
 * - `solve`：给定（可能不完整的）合法棋盘，返回一个完整解的副本；无解返回 null。
 * - `countSolutions(grid, limit)`：统计该棋盘有多少个不同完整解，最多数到 `limit`
 *   就早停。生成器用 `limit = 2` 判定「唯一解」（返回 1 → 唯一；≥2 → 多解）。
 *
 * MRV（Minimum Remaining Values）：每步优先填「候选数最少」的空格，
 * 一旦某空格候选为 0 立即回溯。标准 9×9 题在毫秒级完成，纯同步、无副作用。
 *
 * 内部对「工作副本」做原地 try/untry（backtracking 需要），但对外一律
 * 先 `cloneGrid`，绝不改动调用者传入的棋盘。
 */

/** 在 grid 上找候选最少的空格；若填满返回 null；若发现死格（0 候选）返回 { dead:true }。 */
function pickCell(grid: Grid): { row: number; col: number; cands: Digit[] } | null {
  let best: { row: number; col: number; cands: Digit[] } | null = null;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < (grid[r]?.length ?? 0); c++) {
      if (cellAt(grid, r, c) !== 0) continue;
      const cands = candidates(grid, r, c);
      if (cands.length === 0) return null; // 死格 → 由调用方据 filled 判定失败
      if (!best || cands.length < best.cands.length) {
        best = { row: r, col: c, cands };
        if (cands.length === 1) return best; // 已是最优，提前收敛
      }
    }
  }
  return best;
}

/** 是否已无空格。 */
function isComplete(grid: Grid): boolean {
  for (const row of grid) {
    for (const v of row) if (v === 0) return false;
  }
  return true;
}

/** 原地回溯填充工作副本；成功返回 true（grid 被填满），失败返回 false 并复原。 */
function fillInPlace(grid: Grid): boolean {
  if (isComplete(grid)) return true;
  const cell = pickCell(grid);
  if (!cell) return false; // 有死格
  for (const d of cell.cands) {
    setCell(grid, cell.row, cell.col, d);
    if (fillInPlace(grid)) return true;
    setCell(grid, cell.row, cell.col, 0);
  }
  return false;
}

/**
 * 求解：返回完整解的新棋盘；若初始棋盘非法（已冲突）/无解返回 null。
 * 不修改入参。
 */
export function solve(grid: Grid): Grid | null {
  if (hasConflict(grid)) return null; // 题面自身已矛盾 → 无合法解
  const work = cloneGrid(grid);
  return fillInPlace(work) ? work : null;
}

/**
 * 统计解个数，最多数到 `limit` 即早停（默认 2）。
 * 用于唯一性判定：`countSolutions(p) === 1` 表示唯一解。
 * 不修改入参。`limit < 1` 视为 1；题面已冲突则返回 0。
 */
export function countSolutions(grid: Grid, limit = 2): number {
  if (hasConflict(grid)) return 0;
  const cap = Math.max(1, limit);
  const work = cloneGrid(grid);
  let solutions = 0;

  const rec = (): void => {
    if (solutions >= cap) return;
    if (isComplete(work)) {
      solutions++;
      return;
    }
    const cell = pickCell(work);
    if (!cell) return; // 死格，此分支无解
    for (const d of cell.cands) {
      setCell(work, cell.row, cell.col, d);
      rec();
      setCell(work, cell.row, cell.col, 0);
      if (solutions >= cap) return;
    }
  };

  rec();
  return solutions;
}
