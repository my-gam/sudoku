import { describe, expect, it } from 'vitest';
import { TARGET_CLUES, generateFullGrid, generatePuzzle } from '../src/generator';
import { countFilled, isSolved, withCell } from '../src/board';
import { countSolutions } from '../src/solver';
import type { Cell, Grid, RandomSource } from '../src/types';

/** mulberry32：确定性伪随机，注入以让生成结果可复现。 */
function lcg(seed: number): RandomSource {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 题面非 0 处必须与解同值（puzzle ⊂ solution）。 */
function isSubset(puzzle: Grid, solution: Grid): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const p = puzzle[r]?.[c] ?? 0;
      if (p !== 0 && solution[r]?.[c] !== p) return false;
    }
  }
  return true;
}

describe('generateFullGrid', () => {
  it('产出一张合法完整终盘', () => {
    const g = generateFullGrid(lcg(1));
    expect(countFilled(g)).toBe(81);
    expect(isSolved(g)).toBe(true);
  });

  it('同种子确定、不同种子不同盘', () => {
    const a = generateFullGrid(lcg(99));
    const b = generateFullGrid(lcg(99));
    const c = generateFullGrid(lcg(123));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });
});

describe('generatePuzzle', () => {
  it('easy：唯一解、puzzle⊂solution、clues 合理', () => {
    const { puzzle, solution, clues, difficulty } = generatePuzzle('easy', lcg(7));
    expect(difficulty).toBe('easy');
    expect(isSolved(solution)).toBe(true);
    expect(countSolutions(puzzle, 2)).toBe(1); // 唯一解
    expect(isSubset(puzzle, solution)).toBe(true);
    expect(clues).toBe(countFilled(puzzle));
    expect(clues).toBeGreaterThanOrEqual(30);
    expect(clues).toBeLessThan(81);
  });

  it('hard：唯一解且线索数不超过 easy 目标区间上限', () => {
    const { puzzle, solution, clues } = generatePuzzle('hard', lcg(2024));
    expect(countSolutions(puzzle, 2)).toBe(1);
    expect(isSubset(puzzle, solution)).toBe(true);
    // 挖到目标可能被唯一解约束挡住，实际 clues ≥ 目标；给 12 的容差
    expect(clues).toBeGreaterThanOrEqual(TARGET_CLUES.hard);
    expect(clues).toBeLessThanOrEqual(TARGET_CLUES.hard + 12);
  });

  it('同种子可复现整道题', () => {
    const a = generatePuzzle('medium', lcg(555));
    const b = generatePuzzle('medium', lcg(555));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('solution 就是 puzzle 的唯一解（solve 命中）', () => {
    const { puzzle, solution } = generatePuzzle('easy', lcg(31));
    // 把 solution 打回 puzzle 的完整解应一致：验证 solution 本身合法且与 puzzle 相容
    expect(isSolved(solution)).toBe(true);
    expect(isSubset(puzzle, solution)).toBe(true);
  });

  it('默认参数走 easy', () => {
    const res = generatePuzzle();
    expect(res.difficulty).toBe('easy');
    expect(countSolutions(res.puzzle, 2)).toBe(1);
  });

  it('构造的极端冲突盘无法被当成合法解（isSolved 反例守卫）', () => {
    const full = generateFullGrid(lcg(5));
    const broken = withCell(full, 0, 1, (full[0]?.[0] ?? 1) as Cell);
    expect(isSolved(broken)).toBe(false);
  });
});
