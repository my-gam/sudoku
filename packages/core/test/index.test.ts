import { describe, expect, it } from 'vitest';
import {
  Sudoku,
  countSolutions,
  generatePuzzle,
  isSolved,
  solve,
  DEFAULT_SAVE_KEY,
  DEFAULT_BEST_KEY,
  DEFAULT_THEME_KEY,
  DEFAULT_THEME,
  SUDOKU_THEMES,
  clearTheme,
  isTheme,
  loadTheme,
  normalizeTheme,
  resolveTheme,
  writeTheme
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

/**
 * 主题的「引擎侧」出口必须从 index 可达 —— 单测直接 import 自 themes.ts / storage.ts，
 * 漏了 index 的 re-export 它们照样绿，而宿主会拿不到。这条专防这种漂移。
 */
describe('index 的公共导出面包含主题 API', () => {
  it('档位常量与纯函数都在', () => {
    expect(SUDOKU_THEMES).toContain('auto');
    expect(DEFAULT_THEME).toBe('light');
    expect(DEFAULT_THEME_KEY).toBe('game-sudoku:theme');
    expect(typeof isTheme).toBe('function');
    expect(typeof normalizeTheme).toBe('function');
    expect(typeof resolveTheme).toBe('function');
    expect(typeof loadTheme).toBe('function');
    expect(typeof writeTheme).toBe('function');
    expect(typeof clearTheme).toBe('function');
  });

  it('引擎实例带 getTheme / setTheme / getEffectiveTheme，且快照里有 theme 字段', () => {
    const g = new Sudoku({ puzzle: zeros(), freshStart: true, storage: null });
    expect(g.getState().theme).toBe(DEFAULT_THEME);
    expect(typeof g.getTheme).toBe('function');
    expect(typeof g.setTheme).toBe('function');
    expect(typeof g.getEffectiveTheme).toBe('function');
    // storage: null 下 setTheme 仍要能改状态（只是不落盘），不能因为没存储就失败。
    expect(g.setTheme('dark')).toBe(true);
    expect(g.getState().theme).toBe('dark');
    expect(g.getEffectiveTheme(true)).toBe('dark');
  });
});
