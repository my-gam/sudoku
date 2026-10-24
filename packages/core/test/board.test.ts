import { describe, expect, it } from 'vitest';
import {
  BOX,
  DIGITS,
  SIZE,
  boxOrigin,
  candidates,
  cellAt,
  cloneGrid,
  countFilled,
  createEmptyGrid,
  emptyCells,
  findConflicts,
  gridsEqual,
  hasConflict,
  isFull,
  isSafe,
  isSolved,
  makeMask,
  peers,
  setCell,
  withCell
} from '../src/board';
import type { Cell, Grid } from '../src/types';

/** 经典维基示例终盘（合法解），作为纯函数断言的稳定 fixture。 */
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
  ].map((row) => row.slice()) as Grid;
}

function empty(): Grid {
  return createEmptyGrid();
}

describe('常量与建盘', () => {
  it('SIZE/BOX/DIGITS 基线', () => {
    expect(SIZE).toBe(9);
    expect(BOX).toBe(3);
    expect(DIGITS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('createEmptyGrid 生成 9×9 全 0', () => {
    const g = empty();
    expect(g.length).toBe(9);
    expect(g.every((r) => r.length === 9 && r.every((v) => v === 0))).toBe(true);
  });

  it('makeMask 按初值铺满', () => {
    expect(makeMask(true).every((r) => r.every((v) => v === true))).toBe(true);
    expect(makeMask(false)[0]?.[0]).toBe(false);
  });
});

describe('读取/写入纯函数', () => {
  it('cellAt 越界安全返回 0', () => {
    expect(cellAt(empty(), 100, 100)).toBe(0);
    expect(cellAt(solved(), 0, 0)).toBe(5);
  });

  it('setCell 原地写并返回同引用', () => {
    const g = empty();
    const ret = setCell(g, 1, 2, 7 as Cell);
    expect(ret).toBe(g);
    expect(g[1]?.[2]).toBe(7);
  });

  it('withCell 不改动入参，返回新盘', () => {
    const base = empty();
    const next = withCell(base, 4, 4, 9 as Cell);
    expect(base[4]?.[4]).toBe(0);
    expect(next[4]?.[4]).toBe(9);
    expect(next).not.toBe(base);
  });

  it('cloneGrid 深拷贝独立', () => {
    const a = solved();
    const b = cloneGrid(a);
    b[0]![0] = 1 as Cell;
    expect(a[0]?.[0]).toBe(5);
    expect(b).not.toBe(a);
  });
});

describe('宫/邻居', () => {
  it('boxOrigin 归到所在 3×3 宫左上角', () => {
    expect(boxOrigin(7, 8)).toEqual({ r: 6, c: 6 });
    expect(boxOrigin(0, 2)).toEqual({ r: 0, c: 0 });
    expect(boxOrigin(4, 4)).toEqual({ r: 3, c: 3 });
  });

  it('peers(0,0) = 行8+列8+宫4 = 20 且不含自身/无重复', () => {
    const p = peers(0, 0);
    expect(p.length).toBe(20);
    expect(p.some(([r, c]) => r === 0 && c === 0)).toBe(false);
    const uniq = new Set(p.map(([r, c]) => `${r},${c}`));
    expect(uniq.size).toBe(20);
  });
});

describe('合法性与候选', () => {
  it('空盘任意格放 5 合法', () => {
    expect(isSafe(empty(), 4, 4, 5)).toBe(true);
  });

  it('isSafe 忽略自身：在终盘把 (0,0) 再判 5 合法、判同行的 3 非法', () => {
    const s = solved();
    expect(isSafe(s, 0, 0, 5)).toBe(true); // 5 只在自身，peers 无 5
    expect(isSafe(s, 0, 0, 3)).toBe(false); // (0,1)=3 同列行冲突
  });

  it('终盘每个已填格候选为空数组', () => {
    const s = solved();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        expect(candidates(s, r, c)).toEqual([]);
      }
    }
  });

  it('从终盘挖掉 (0,0) 后该格唯一候选是 5', () => {
    const g = withCell(solved(), 0, 0, 0);
    expect(candidates(g, 0, 0)).toEqual([5]);
  });

  it('空盘 (0,0) 候选为 1..9', () => {
    expect(candidates(empty(), 0, 0).length).toBe(9);
  });
});

describe('填充/冲突/求解判定', () => {
  it('emptyCells 行优先，数量正确', () => {
    const g = withCell(withCell(empty(), 0, 0, 5), 0, 1, 3);
    const cells = emptyCells(g);
    expect(cells.length).toBe(79);
    expect(cells[0]).toEqual([0, 2]);
  });

  it('countFilled / isFull', () => {
    expect(countFilled(empty())).toBe(0);
    expect(countFilled(solved())).toBe(81);
    expect(isFull(solved())).toBe(true);
    expect(isFull(withCell(solved(), 0, 0, 0))).toBe(false);
  });

  it('终盘无冲突、isSolved true', () => {
    expect(hasConflict(solved())).toBe(false);
    expect(isSolved(solved())).toBe(true);
  });

  it('制造同行重复 → findConflicts 标两格、hasConflict true、isSolved false', () => {
    // 把 (0,1) 改成 5，与 (0,0)=5 同行冲突
    const g = withCell(solved(), 0, 1, 5);
    expect(g[0]?.[1]).toBe(5);
    expect(hasConflict(g)).toBe(true);
    expect(findConflicts(g)[0]?.[0]).toBe(true);
    expect(findConflicts(g)[0]?.[1]).toBe(true);
    expect(isSolved(g)).toBe(false); // 虽填满但有冲突
  });

  it('有空格时即便无冲突也非 isSolved', () => {
    expect(isSolved(withCell(solved(), 0, 0, 0))).toBe(false);
  });

  it('gridsEqual 逐格比较', () => {
    expect(gridsEqual(solved(), solved())).toBe(true);
    expect(gridsEqual(solved(), withCell(solved(), 8, 8, 1))).toBe(false);
  });
});
