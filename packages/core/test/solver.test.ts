import { describe, expect, it } from 'vitest';
import { countSolutions, solve } from '../src/solver';
import { isSolved, withCell } from '../src/board';
import type { Cell, Grid } from '../src/types';

function solved(): Grid {
  return [
    [5, 3, 4, 6, 7, 8, 9, 1, 2],
    [6, 7, 2, 1, 9, 5, 3, 4, 8],
    [1, 9, 8, 3, 4, 2, 5, 6, 7],
    [8, 5, 9, 7, 6, 1, 4, 2, 3],
    [4, 2, 6, 8, 5, 3, 7, 9, 1],
    [7, 1, 3, 9, 2, 4, 8, 5, 6],
    [9, 6, 1, 5, 3, 7, 2, 8, 4],
    [2, 8, 7, 4, 1, 9, 6, 3, 5],
    [3, 4, 5, 2, 8, 6, 1, 7, 9]
  ].map((r) => r.slice()) as Grid;
}

/** 经典唯一解题面（0 = 空），其唯一解即 solved()。 */
function puzzle(): Grid {
  return [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9]
  ].map((r) => r.slice()) as Grid;
}

function emptyGrid(): Grid {
  return Array.from({ length: 9 }, () => Array<Cell>(9).fill(0)) as Grid;
}

describe('solve', () => {
  it('解唯一题面 → 命中已知终盘', () => {
    expect(solve(puzzle())).toEqual(solved());
  });

  it('输入已是终盘 → 原样返回（合法）', () => {
    expect(solve(solved())).toEqual(solved());
  });

  it('从空盘能解出一个合法完整盘', () => {
    const g = solve(emptyGrid());
    expect(g).not.toBeNull();
    expect(isSolved(g as Grid)).toBe(true);
  });

  it('题面自身冲突 → 返回 null', () => {
    const bad = withCell(solved(), 0, 1, 5 as Cell); // (0,0)(0,1) 均 5
    expect(solve(bad)).toBeNull();
  });

  it('不改动入参', () => {
    const p = puzzle();
    const snapshot = JSON.stringify(p);
    solve(p);
    expect(JSON.stringify(p)).toBe(snapshot);
  });
});

describe('countSolutions', () => {
  it('唯一解题面 → 恰 1', () => {
    expect(countSolutions(puzzle(), 2)).toBe(1);
  });

  it('完整终盘 → 1（无空格）', () => {
    expect(countSolutions(solved(), 2)).toBe(1);
  });

  it('空盘 → 早停到 limit 2', () => {
    expect(countSolutions(emptyGrid(), 2)).toBe(2);
  });

  it('limit=1 时最多返回 1', () => {
    expect(countSolutions(emptyGrid(), 1)).toBe(1);
  });

  it('冲突题面 → 0', () => {
    // 把 (0,1) 改成 5，与 (0,0)=5 同行重复 → hasConflict
    const conflicting = withCell(solved(), 0, 1, 5 as Cell);
    expect(countSolutions(conflicting, 2)).toBe(0);
  });
});
