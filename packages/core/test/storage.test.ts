import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BEST_KEY,
  DEFAULT_SAVE_KEY,
  SAVE_VERSION,
  clearSave,
  emptyBestTimes,
  isSerializedSave,
  loadBest,
  loadSave,
  tryGetGlobalStorage,
  writeBest,
  writeSave
} from '../src/storage';
import type { BestTimes, Cell, Grid, SaveStorage, SerializedSave } from '../src/types';

function memStorage(): SaveStorage & { dump(): Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    dump: () => Object.fromEntries(map)
  };
}

function zeros(): Grid {
  return Array.from({ length: 9 }, () => Array<Cell>(9).fill(0)) as Grid;
}

function sampleSave(over: Partial<SerializedSave> = {}): SerializedSave {
  return {
    version: SAVE_VERSION,
    difficulty: 'easy',
    puzzle: zeros(),
    solution: zeros(),
    grid: zeros(),
    notes: Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => [] as Cell[] as never)),
    status: 'playing',
    hintCount: 0,
    mistakeCount: 0,
    moveCount: 0,
    elapsedMs: 1234,
    ...over
  } as SerializedSave;
}

describe('常量', () => {
  it('save/best 键前缀是 game-sudoku', () => {
    expect(DEFAULT_SAVE_KEY).toBe('game-sudoku:save');
    expect(DEFAULT_BEST_KEY).toBe('game-sudoku:best');
    expect(SAVE_VERSION).toBe(1);
  });
});

describe('isSerializedSave 守卫', () => {
  it('接受合法存档', () => {
    expect(isSerializedSave(sampleSave())).toBe(true);
  });
  it('拒绝：null / 非对象', () => {
    expect(isSerializedSave(null)).toBe(false);
    expect(isSerializedSave('x')).toBe(false);
  });
  it('拒绝：版本不符', () => {
    expect(isSerializedSave(sampleSave({ version: 2 as unknown as 1 }))).toBe(false);
  });
  it('拒绝：非法 difficulty', () => {
    expect(isSerializedSave({ ...sampleSave(), difficulty: 'nope' })).toBe(false);
  });
  it('拒绝：grid 维度不对', () => {
    expect(isSerializedSave({ ...sampleSave(), grid: [[1, 2]] as unknown as Grid })).toBe(false);
  });
  it('拒绝：非法 status', () => {
    expect(isSerializedSave({ ...sampleSave(), status: 'paused' })).toBe(false);
  });
});

describe('存档 round-trip', () => {
  it('write → load 拿回等价对象', () => {
    const s = memStorage();
    const save = sampleSave({ moveCount: 7 });
    writeSave(s, DEFAULT_SAVE_KEY, save);
    const back = loadSave(s, DEFAULT_SAVE_KEY);
    expect(back?.moveCount).toBe(7);
    expect(back?.elapsedMs).toBe(1234);
  });
  it('storage=null 时读写不炸、load 返回 null', () => {
    writeSave(null, DEFAULT_SAVE_KEY, sampleSave());
    expect(loadSave(null, DEFAULT_SAVE_KEY)).toBe(null);
  });
  it('缺失键 → null', () => {
    expect(loadSave(memStorage(), DEFAULT_SAVE_KEY)).toBe(null);
  });
  it('损坏 JSON → null', () => {
    const s = memStorage();
    s.setItem(DEFAULT_SAVE_KEY, '{ broken');
    expect(loadSave(s, DEFAULT_SAVE_KEY)).toBe(null);
  });
  it('clearSave 移除了存档', () => {
    const s = memStorage();
    writeSave(s, DEFAULT_SAVE_KEY, sampleSave());
    clearSave(s, DEFAULT_SAVE_KEY);
    expect(loadSave(s, DEFAULT_SAVE_KEY)).toBe(null);
  });
});

describe('最佳用时 BestTimes', () => {
  it('emptyBestTimes 全 null', () => {
    expect(emptyBestTimes()).toEqual({ easy: null, medium: null, hard: null });
  });
  it('write → load round-trip', () => {
    const s = memStorage();
    const best: BestTimes = { easy: 120, medium: null, hard: 300 };
    writeBest(s, DEFAULT_BEST_KEY, best);
    expect(loadBest(s, DEFAULT_BEST_KEY)).toEqual(best);
  });
  it('缺失/损坏 → 全 null，不抛', () => {
    expect(loadBest(memStorage(), DEFAULT_BEST_KEY)).toEqual(emptyBestTimes());
    const s = memStorage();
    s.setItem(DEFAULT_BEST_KEY, 'not-json');
    expect(loadBest(s, DEFAULT_BEST_KEY)).toEqual(emptyBestTimes());
  });
  it('字段缺失补 null、非数字被忽略', () => {
    const s = memStorage();
    s.setItem(DEFAULT_BEST_KEY, JSON.stringify({ easy: 42, medium: 'x' }));
    expect(loadBest(s, DEFAULT_BEST_KEY)).toEqual({ easy: 42, medium: null, hard: null });
  });
});

describe('tryGetGlobalStorage', () => {
  it('Node 环境无 localStorage → null', () => {
    expect(tryGetGlobalStorage()).toBe(null);
  });
});
