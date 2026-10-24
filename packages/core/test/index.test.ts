import { describe, expect, it } from 'vitest';
import {
  Sudoku,
  countSolutions,
  generatePuzzle,
  isSolved,
  solve,
  DEFAULT_SAVE_KEY,
  DEFAULT_BEST_KEY
} from '../src/index';
import type { Cell, Grid, RandomSource } from '../src/types';

/** 固定种子 RNG（mulberry32）。 */
function lcg(seed: number): RandomSource {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function zeros(): Grid {
  return Array.from({ length: 9 }, () => Array<Cell>(9).fill(0)) as Grid;
}

/**
 * 空骨架占位测试已随引擎落地退役，改为校验 index.ts 公共导出面真正接通
 * （占位时它只断言两个常量；现在断言引擎入口 + 端到端最小闭环）。
 */
describe('core barrel（index.ts 公共导出面）', () => {
  it('导出引擎主入口与关键 API', () => {
    expect(typeof Sudoku).toBe('function');
    expect(typeof solve).toBe('function');
    expect(typeof countSolutions).toBe('function');
    expect(typeof generatePuzzle).toBe('function');
    expect(DEFAULT_SAVE_KEY).toBe('game-sudoku:save');
    expect(DEFAULT_BEST_KEY).toBe('game-sudoku:best');
  });

  it('生成的题面可被 solve 还原且唯一', () => {
    const { puzzle, solution } = generatePuzzle('easy', lcg(11));
    expect(isSolved(solution)).toBe(true);
    expect(solve(puzzle)).toEqual(solution);
    expect(countSolutions(puzzle, 2)).toBe(1);
  });

  it('Sudoku 类可实例化并推初始快照（禁用存储）', () => {
    const g = new Sudoku({ puzzle: zeros(), freshStart: true, storage: null });
    expect(g.getState().status).toBe('playing');
    g.select(0, 0);
    g.input(5 as Cell);
    expect(g.getGrid()[0]?.[0]).toBe(5);
  });
});
