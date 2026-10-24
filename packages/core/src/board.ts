import type { Cell, ConflictMask, Digit, Grid } from './types';

/**
 * 纯函数棋盘工具：只用 `Grid`（`Cell[][]`，0 = 空），不涉及对局可变态。
 *
 * 设计原则：所有「产出新棋盘」的函数都返回新数组，不原地修改输入。
 * solver / generator / Sudoku 类都建立在这套底层原语上。
 *
 * 严格模式（noUncheckedIndexedAccess）：读取一律走 `cellAt`（越界/空返回 0），
 * 派生 9×9 结构时用 `makeMask` / `setAt` 保证行存在后再写下标。
 */

/** 数独边长（标准 9×9）。 */
export const SIZE = 9 as const;
/** 宫的边长（3×3 宫，共 9 宫）。 */
export const BOX = 3 as const;

/** 数字 1..9 常量表（升序）。 */
export const DIGITS: readonly Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** 生成 SIZE×SIZE 全 0 空棋盘。 */
export function createEmptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array<Cell>(SIZE).fill(0));
}

/** 深拷贝棋盘。 */
export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => row.slice());
}

/** 生成 SIZE×SIZE 掩码，初值由 `fill` 决定。 */
export function makeMask(fill: boolean): ConflictMask {
  return Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(fill));
}

/** 安全读取：越界返回 0。 */
export function cellAt(grid: Grid, row: number, col: number): Cell {
  return grid[row]?.[col] ?? 0;
}

/** 安全写入：仅在行存在时写入（返回同一引用，供链式）。 */
export function setCell(grid: Grid, row: number, col: number, value: Cell): Grid {
  const line = grid[row];
  if (line) line[col] = value;
  return grid;
}

/** 返回把 (row,col) 设为 value 后的新棋盘（不改动入参）。 */
export function withCell(grid: Grid, row: number, col: number, value: Cell): Grid {
  const next = cloneGrid(grid);
  return setCell(next, row, col, value);
}

/** (row,col) 所属宫的左上角坐标。 */
export function boxOrigin(row: number, col: number): { r: number; c: number } {
  return { r: Math.floor(row / BOX) * BOX, c: Math.floor(col / BOX) * BOX };
}

/** 与 (row,col) 同处一行、一列、一宫（不含自身）的所有坐标，去重后共 20 个。 */
export function peers(row: number, col: number): Array<[number, number]> {
  const seen = new Set<number>();
  const out: Array<[number, number]> = [];
  const push = (r: number, c: number): void => {
    if (r === row && c === col) return;
    const key = r * SIZE + c;
    if (seen.has(key)) return;
    seen.add(key);
    out.push([r, c]);
  };
  for (let i = 0; i < SIZE; i++) {
    push(row, i);
    push(i, col);
  }
  const { r, c } = boxOrigin(row, col);
  for (let dr = 0; dr < BOX; dr++) {
    for (let dc = 0; dc < BOX; dc++) {
      push(r + dr, c + dc);
    }
  }
  return out;
}

/**
 * 数字 digit 能否放到 (row,col)：检查所有 peer 是否已占用同值。
 * 不关心 (row,col) 当前值（用于「换个值是否合法」判断）。
 */
export function isSafe(grid: Grid, row: number, col: number, digit: Digit): boolean {
  for (const [pr, pc] of peers(row, col)) {
    if (cellAt(grid, pr, pc) === digit) return false;
  }
  return true;
}

/** 空格 (row,col) 的所有合法候选数字；非空格返回 []。 */
export function candidates(grid: Grid, row: number, col: number): Digit[] {
  if (cellAt(grid, row, col) !== 0) return [];
  const out: Digit[] = [];
  for (const d of DIGITS) {
    if (isSafe(grid, row, col, d)) out.push(d);
  }
  return out;
}

/** 所有空格坐标（行优先）。 */
export function emptyCells(grid: Grid): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (cellAt(grid, r, c) === 0) out.push([r, c]);
    }
  }
  return out;
}

/** 是否填满（无 0）。 */
export function isFull(grid: Grid): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (cellAt(grid, r, c) === 0) return false;
    }
  }
  return true;
}

/**
 * 计算冲突掩码：某格为非 0 且与任一 peer 同值 → true。
 * 供 UI 标红「当前矛盾」的格，允许存在空格（部分填写）。
 */
export function findConflicts(grid: Grid): ConflictMask {
  const mask = makeMask(false);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = cellAt(grid, r, c);
      if (v === 0) continue;
      for (const [pr, pc] of peers(r, c)) {
        if (cellAt(grid, pr, pc) === v) {
          const line = mask[r];
          if (line) line[c] = true;
          break;
        }
      }
    }
  }
  return mask;
}

/** 是否存在任意冲突（有重复）。 */
export function hasConflict(grid: Grid): boolean {
  for (const row of findConflicts(grid)) {
    for (const v of row) if (v) return true;
  }
  return false;
}

/**
 * 是否为「合法完成盘」：填满且无冲突。
 * 等价于每行/列/宫都是 1..9 的一个排列。
 */
export function isSolved(grid: Grid): boolean {
  return isFull(grid) && !hasConflict(grid);
}

/** 棋盘相等（逐格比较）。 */
export function gridsEqual(a: Grid, b: Grid): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (cellAt(a, r, c) !== cellAt(b, r, c)) return false;
    }
  }
  return true;
}

/** 数非空格数量（题面线索数）。 */
export function countFilled(grid: Grid): number {
  let n = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (cellAt(grid, r, c) !== 0) n++;
    }
  }
  return n;
}
