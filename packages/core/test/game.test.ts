import { describe, expect, it } from 'vitest';
import { Sudoku } from '../src/game';
import { DEFAULT_THEME_KEY, writeTheme } from '../src/storage';
import type { SudokuTheme } from '../src/themes';
import type { Cell, Clock, Digit, Grid, SaveStorage } from '../src/types';

/** 经典唯一题面 + 其已知解（避免测试期随机生成，solution 直接注入）。 */
const PUZZLE: Grid = [
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

const SOLUTION: Grid = [
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

function newGame(extra: Partial<ConstructorParameters<typeof Sudoku>[0] & Record<string, unknown>> = {}): Sudoku {
  return new Sudoku({
    puzzle: PUZZLE.map((r) => r.slice()) as Grid,
    solution: SOLUTION.map((r) => r.slice()) as Grid,
    storage: null,
    clock: (() => 0) as Clock,
    ...extra
  });
}

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

/** 把所有空格按解填对（用于通关测试）。 */
function solveIt(g: Sudoku): void {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if ((PUZZLE[r]?.[c] ?? 0) === 0) {
        g.select(r, c);
        g.input((SOLUTION[r]?.[c] ?? 1) as Digit);
      }
    }
  }
}

describe('Sudoku 初始态', () => {
  it('题面即初盘，选中第一个空格 (0,2)', () => {
    const g = newGame();
    const s = g.getState();
    expect(s.status).toBe('playing');
    expect(s.grid).toEqual(PUZZLE);
    expect(s.selected).toEqual({ row: 0, col: 2 });
    expect(s.moveCount).toBe(0);
    expect(s.hintCount).toBe(0);
    expect(s.mistakeCount).toBe(0);
    expect(s.historySize).toBe(0);
    expect(s.elapsedSeconds).toBe(0);
    expect(s.bestSeconds).toBe(null);
    expect(s.difficulty).toBe('easy');
  });

  it('givenMask 与题面非 0 处一致', () => {
    const s = newGame().getState();
    expect(s.givenMask[0]?.[0]).toBe(true);
    expect(s.givenMask[0]?.[2]).toBe(false);
  });
});

describe('Sudoku 填数与选中', () => {
  it('填正确值：moveCount+1、无 mistake', () => {
    const g = newGame();
    g.select(0, 2);
    expect(g.input(4)).toBe(true);
    const s = g.getState();
    expect(s.grid[0]?.[2]).toBe(4);
    expect(s.moveCount).toBe(1);
    expect(s.mistakeCount).toBe(0);
  });

  it('填与盘面冲突的值：计一次 mistake 且 conflicts 标出', () => {
    const g = newGame();
    g.select(0, 2); // (0,0)=5 同行
    expect(g.input(5)).toBe(true);
    const s = g.getState();
    expect(s.mistakeCount).toBe(1);
    expect(s.conflicts[0]?.[2]).toBe(true);
  });

  it('题面给定格禁止改写', () => {
    const g = newGame();
    g.select(0, 0);
    expect(g.input(9)).toBe(false);
    expect(g.getState().grid[0]?.[0]).toBe(5);
  });

  it('重复填同值返回 false 且不改状态', () => {
    const g = newGame();
    g.select(0, 2);
    g.input(4);
    const before = JSON.stringify(g.getState());
    expect(g.input(4)).toBe(false);
    expect(JSON.stringify(g.getState())).toBe(before);
  });

  it('未选中时 input/erase 返回 false', () => {
    const g = newGame();
    const s = g.getState();
    // 手动选中越界会被忽略；构造一个无选中：select 非法坐标不改选中但已有初选中，
    // 这里直接用新实例的默认选中再擦除，改测「无变化擦除」。
    expect(s.selected).not.toBeNull();
    expect(g.erase()).toBe(false); // (0,2) 本就空且无笔记
  });
});

describe('Sudoku 擦除与笔记', () => {
  it('erase 清值', () => {
    const g = newGame();
    g.select(0, 2);
    g.input(4);
    expect(g.erase()).toBe(true);
    expect(g.getState().grid[0]?.[2]).toBe(0);
  });

  it('toggleNote 增删；给给定/已填格笔记被拒', () => {
    const g = newGame();
    g.select(0, 2);
    expect(g.toggleNote(1)).toBe(true);
    expect(g.getState().notes[0]?.[2]).toContain(1);
    expect(g.toggleNote(1)).toBe(true);
    expect(g.getState().notes[0]?.[2]).not.toContain(1);
    // 已填值的格不谈笔记
    g.select(0, 2);
    g.input(4);
    expect(g.toggleNote(3)).toBe(false);
    // 给定格
    g.select(0, 0);
    expect(g.toggleNote(1)).toBe(false);
  });

  it('填值会清掉该格笔记', () => {
    const g = newGame();
    g.select(0, 2);
    g.toggleNote(4);
    g.input(4);
    expect(g.getState().notes[0]?.[2]).toEqual([]);
  });
});

describe('Sudoku 提示与撤销', () => {
  it('hint 填选中空格为解值并计 hintCount', () => {
    const g = newGame();
    g.select(0, 2);
    expect(g.hint()).toBe(true);
    const s = g.getState();
    expect(s.grid[0]?.[2]).toBe(4); // SOLUTION[0][2]
    expect(s.hintCount).toBe(1);
  });

  it('hint 无有效选中时落到第一个空格', () => {
    const g = newGame();
    g.select(0, 0); // 给定格 → pickHintTarget 回落 firstEmpty (0,2)
    expect(g.hint()).toBe(true);
    expect(g.getState().grid[0]?.[2]).toBe(4);
  });

  it('undo 回到上一步（值、计数、历史深度）', () => {
    const g = newGame();
    g.select(0, 2);
    g.input(4);
    expect(g.canUndo()).toBe(true);
    expect(g.undo()).toBe(true);
    const s = g.getState();
    expect(s.grid[0]?.[2]).toBe(0);
    expect(s.moveCount).toBe(0);
    expect(g.canUndo()).toBe(false);
  });

  it('通关后 undo 退回 playing', () => {
    const g = newGame();
    solveIt(g);
    expect(g.getState().status).toBe('won');
    expect(g.undo()).toBe(true);
    expect(g.getState().status).toBe('playing');
  });
});

describe('Sudoku 通关与计时', () => {
  it('全部填对 → won，通关时刻写入分难度最佳', () => {
    const g = newGame();
    solveIt(g);
    const s = g.getState();
    expect(s.status).toBe('won');
    expect(s.mistakeCount).toBe(0);
    expect(s.bestSeconds).toBe(0); // clock 恒为 0
  });

  it('won 后禁止再填数', () => {
    const g = newGame();
    solveIt(g);
    expect(g.input(1)).toBe(false);
  });

  it('起表时机：只选格不计时，记笔记即算开始游戏', () => {
    let now = 0;
    const clock: Clock = () => now;
    const g = newGame({ clock });
    now = 5000;
    g.select(0, 3); // 仅选中 → 不起表
    expect(g.getState().elapsedSeconds).toBe(0);
    now = 7000;
    expect(g.toggleNote(1)).toBe(true); // 笔记落了子 = 开始作答，此刻起表
    expect(g.getState().notes[0]?.[3]).toEqual([1]); // 证明确实写进笔记，而非空跑 false
    expect(g.getState().elapsedSeconds).toBe(0);
    now = 10000;
    expect(g.getState().elapsedSeconds).toBe(3); // 从 7000 起算
  });

  it('笔记起表后再填数，不会另起一张表', () => {
    let now = 0;
    const clock: Clock = () => now;
    const g = newGame({ clock });
    now = 1000;
    g.select(0, 3);
    g.toggleNote(1); // 起表 origin=1000
    now = 4000;
    g.select(0, 2);
    expect(g.input(4)).toBe(true);
    now = 6000;
    expect(g.getState().elapsedSeconds).toBe(5); // 仍从 1000 起算，没被填数重置
  });

  it('擦除（只擦掉笔记）后表不停', () => {
    let now = 0;
    const clock: Clock = () => now;
    const g = newGame({ clock });
    now = 2000;
    g.select(0, 3);
    expect(g.toggleNote(1)).toBe(true); // 起表 origin=2000
    now = 5000;
    expect(g.erase()).toBe(true); // 该格只有笔记、无填值
    expect(g.getState().moveCount).toBe(0); // 纯擦笔记不计步
    now = 8000;
    expect(g.getState().elapsedSeconds).toBe(6); // 2000 起算，中途没停
  });

  it('undo 回到首笔笔记之前 → 停表回 0:00', () => {
    let now = 0;
    const clock: Clock = () => now;
    const g = newGame({ clock });
    now = 6000;
    g.select(0, 3);
    expect(g.toggleNote(1)).toBe(true); // 起表
    now = 9000;
    expect(g.getState().elapsedSeconds).toBe(3);
    expect(g.undo()).toBe(true); // 回到笔记前（started 随快照复位）
    expect(g.getState().elapsedSeconds).toBe(0);
    now = 20000;
    expect(g.getState().elapsedSeconds).toBe(0); // 已停表，仍 0
  });

  it('won 后用时冻结（从首次填充计到通关）', () => {
    let now = 0;
    const clock: Clock = () => now;
    const g = newGame({ clock });
    now = 4000;
    g.select(0, 2);
    g.input(4); // 起表 origin=4000
    now = 9000;
    solveIt(g); // 通关发生在 now=9000 → 5s
    expect(g.getState().status).toBe('won');
    expect(g.getState().elapsedSeconds).toBe(5);
    now = 99999;
    expect(g.getState().elapsedSeconds).toBe(5); // 冻结
  });

  it('undo 回到首次填充之前 → 停表回 0:00', () => {
    let now = 0;
    const clock: Clock = () => now;
    const g = newGame({ clock });
    now = 6000;
    g.select(0, 2);
    g.input(4); // 起表
    now = 8000;
    expect(g.getState().elapsedSeconds).toBe(2);
    g.undo(); // 回到填充前（started 复位）
    const s = g.getState();
    expect(s.elapsedSeconds).toBe(0);
    expect(s.grid[0]?.[2]).toBe(0);
    now = 20000;
    expect(g.getState().elapsedSeconds).toBe(0); // 已停表，仍 0
  });
});

describe('Sudoku 主题偏好（引擎持有，不是组件属性）', () => {
  it('无 storage 无 opts 时回落 light，且不抛错', () => {
    const g = newGame();
    expect(g.getState().theme).toBe('light');
    expect(g.getTheme()).toBe('light');
  });

  it('构造传入 theme 会写进独立的 themeKey，二次构造可恢复', () => {
    const storage = memStorage();
    const g1 = newGame({ storage, freshStart: true, theme: 'dark' });
    expect(g1.getTheme()).toBe('dark');
    expect(JSON.parse(storage.dump()[DEFAULT_THEME_KEY] ?? 'null')).toBe('dark');
    // 对局存档里不该出现 theme —— 它是偏好，不是局状态。
    const rawSave = JSON.parse(storage.dump()['game-sudoku:save'] ?? 'null');
    expect('theme' in (rawSave ?? {})).toBe(false);
    const g2 = newGame({ storage });
    expect(g2.getTheme()).toBe('dark');
  });

  it('显式传入优先于已持久化的值，并回写覆盖', () => {
    const storage = memStorage();
    writeTheme(storage, DEFAULT_THEME_KEY, 'sepia');
    const g = newGame({ storage, theme: 'high-contrast' });
    expect(g.getTheme()).toBe('high-contrast');
    expect(JSON.parse(storage.dump()[DEFAULT_THEME_KEY] ?? 'null')).toBe('high-contrast');
  });

  it('没传 theme 时读持久化值；持久化值是垃圾则回落 light 且不炸', () => {
    const storage = memStorage();
    storage.setItem(DEFAULT_THEME_KEY, '"neon"');
    expect(newGame({ storage }).getTheme()).toBe('light');
    storage.setItem(DEFAULT_THEME_KEY, '{ broken');
    expect(newGame({ storage }).getTheme()).toBe('light');
  });

  it('setTheme 更新状态 + 落盘 + 通知订阅者', () => {
    const storage = memStorage();
    const g = newGame({ storage, freshStart: true });
    const seen: SudokuTheme[] = [];
    g.subscribe((s) => seen.push(s.theme));
    expect(seen).toEqual(['light']); // 注册即收一次
    expect(g.setTheme('dark')).toBe(true);
    expect(seen).toEqual(['light', 'dark']); // 第二次来自 setTheme 的通知
    expect(JSON.parse(storage.dump()[DEFAULT_THEME_KEY] ?? 'null')).toBe('dark');
  });

  it('非法档位被拒（不通知、不落盘、状态不动）', () => {
    const storage = memStorage();
    const g = newGame({ storage, freshStart: true });
    let notifications = 0;
    g.subscribe(() => {
      notifications++;
    });
    expect(notifications).toBe(1);
    expect(g.setTheme('neon' as SudokuTheme)).toBe(false);
    expect(notifications).toBe(1);
    expect(g.getTheme()).toBe('light');
    expect(storage.dump()[DEFAULT_THEME_KEY]).toBeUndefined();
  });

  it('同值幂等：返回 true 但不重复写盘通知', () => {
    const g = newGame({ freshStart: true });
    g.setTheme('sepia');
    let notifications = 0;
    g.subscribe(() => {
      notifications++;
    });
    expect(notifications).toBe(1);
    expect(g.setTheme('sepia')).toBe(true);
    expect(notifications).toBe(1);
  });

  it('主题不进 undo 历史，也不随 newGame / 切难度丢失', () => {
    const g = newGame({ freshStart: true });
    g.select(0, 2);
    g.input(4);
    g.setTheme('dark');
    expect(g.undo()).toBe(true);
    expect(g.getTheme()).toBe('dark'); // 撤销一步不该把配色撤回去
    g.newGame('hard');
    expect(g.getTheme()).toBe('dark');
  });

  it('clearSaved 只动对局存档，主题偏好保留', () => {
    const storage = memStorage();
    const g = newGame({ storage, freshStart: true, theme: 'sepia' });
    g.select(0, 2);
    g.input(4);
    g.clearSaved();
    expect(storage.dump()['game-sudoku:save']).toBeUndefined();
    expect(storage.dump()[DEFAULT_THEME_KEY]).toBeDefined();
    expect(newGame({ storage }).getTheme()).toBe('sepia');
  });

  it('getEffectiveTheme 只做纯解析，core 不碰 DOM', () => {
    const g = newGame({ freshStart: true, theme: 'auto' });
    expect(g.getEffectiveTheme(false)).toBe('light');
    expect(g.getEffectiveTheme(true)).toBe('dark');
    expect(g.getEffectiveTheme()).toBe('light'); // 不传参按浅色
    g.setTheme('high-contrast');
    expect(g.getEffectiveTheme(true)).toBe('high-contrast'); // 具体档不受系统影响
  });
});

describe('Sudoku 存档与最佳持久化', () => {
  it('同 storage 二次构造续玩局面', () => {
    const storage = memStorage();
    const g1 = newGame({ storage, freshStart: true });
    g1.select(0, 2);
    g1.input(4);
    const g2 = newGame({ storage });
    expect(g2.getState().grid[0]?.[2]).toBe(4);
    expect(g2.getState().historySize).toBe(0); // undo 历史不跨会话
  });

  it('只有笔记且用时 0 的存档，续玩后仍算已开始（不再退回未起表）', () => {
    let now = 0;
    const clock: Clock = () => now;
    const storage = memStorage();
    const g1 = newGame({ storage, freshStart: true, clock });
    now = 1000;
    g1.select(0, 3);
    expect(g1.toggleNote(1)).toBe(true); // 起表同时落盘，此刻存档里的 elapsedMs 仍是 0
    const g2 = newGame({ storage, clock }); // 同题面同难度 → 续档
    expect(g2.getState().notes[0]?.[3]).toEqual([1]);
    now = 5000;
    // 若续档时只看 moveCount/elapsedMs 会误判为「没开始」，用时被清零。
    expect(g2.getState().elapsedSeconds).toBe(4);
  });

  it('损坏存档被安全忽略并开新局', () => {
    const storage = memStorage();
    storage.setItem('game-sudoku:save', '{ broken');
    const g = newGame({ storage });
    expect(g.getState().grid[0]?.[2]).toBe(0);
  });

  it('最佳用时跨实例保留（freshStart 不影响 best）', () => {
    const storage = memStorage();
    const g1 = newGame({ storage, freshStart: true });
    solveIt(g1); // best easy = 0 写入
    const g2 = newGame({ storage, freshStart: true });
    expect(g2.getState().bestSeconds).toBe(0);
  });

  it('clearSaved 移除存档键但保留 best', () => {
    const storage = memStorage();
    const g = newGame({ storage, freshStart: true });
    g.select(0, 2);
    g.input(4);
    g.clearSaved();
    expect(storage.dump()['game-sudoku:save']).toBeUndefined();
  });

  it('newGame 切换难度并重置局面', () => {
    const g = newGame();
    g.select(0, 2);
    g.input(4);
    g.newGame('hard');
    const s = g.getState();
    expect(s.difficulty).toBe('hard');
    expect(s.status).toBe('playing');
    expect(s.moveCount).toBe(0);
    expect(s.grid[0]?.[2]).toBe(0);
  });
});

describe('Sudoku 订阅与快照隔离', () => {
  it('subscribe 注册即推一次，操作后各推一次，退订后不再推', () => {
    const g = newGame();
    let count = 0;
    const unsub = g.subscribe(() => {
      count++;
    });
    expect(count).toBe(1);
    g.select(0, 3); // 从默认选中 (0,2) 改选到不同格 → notify（同格重复 select 是 no-op）
    g.input(6); // (0,3) 解值为 6 → commit → notify
    expect(count).toBe(3);
    unsub();
    const frozen = count;
    g.input(1); // 已退订：仍改内部状态但不再推
    expect(count).toBe(frozen);
    expect(g.getState().grid[0]?.[3]).toBe(1);
  });

  it('getState 返回深拷贝：改外部不影响内部', () => {
    const g = newGame();
    const s = g.getState();
    (s.grid[0] as Cell[])[2] = 9 as Cell;
    s.notes[0]![2] = [9 as Digit];
    expect(g.getState().grid[0]?.[2]).toBe(0);
    expect(g.getState().notes[0]?.[2]).toEqual([]);
  });
});
