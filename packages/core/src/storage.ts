import { isTheme } from './themes';
import type { SudokuTheme } from './themes';
import type { BestTimes, Difficulty, SaveStorage, SerializedSave } from './types';

/**
 * 存档、最佳用时与主题偏好持久化。
 *
 * 版本策略：读到的 version ≠ SAVE_VERSION 时，`isSerializedSave` 守卫失败 →
 * 上层丢弃并开新局。目前仅 v1。
 *
 * best 存的是 `BestTimes`（每个难度历史最佳用时秒数，null = 未通关），
 * 以 JSON 落在单个 bestKey 下，读回时补全缺失难度为 null。
 *
 * theme 与 best 同级、**不进对局存档**：主题是用户偏好，换难度 / 开新局都该保留，
 * 而且塞进 SerializedSave 会牵动版本守卫与 migrate()。单键存 JSON 字符串。
 */
export const SAVE_VERSION = 1 as const;
export const DEFAULT_SAVE_KEY = 'game-sudoku:save';
export const DEFAULT_BEST_KEY = 'game-sudoku:best';
export const DEFAULT_THEME_KEY = 'game-sudoku:theme';

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

function isDifficulty(x: unknown): x is Difficulty {
  return typeof x === 'string' && (DIFFICULTIES as readonly string[]).includes(x);
}

/** 9×9 的二维数组守卫（浅校验行数与每行长度）。 */
function isGridLike(x: unknown): boolean {
  return (
    Array.isArray(x) &&
    x.length === 9 &&
    x.every((row) => Array.isArray(row) && row.length === 9)
  );
}

/** 粗粒度结构守卫：只保证关键字段形状，深层值由 Sudoku 载入时再防御。 */
export function isSerializedSave(x: unknown): x is SerializedSave {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    o['version'] === SAVE_VERSION &&
    isDifficulty(o['difficulty']) &&
    isGridLike(o['puzzle']) &&
    isGridLike(o['solution']) &&
    isGridLike(o['grid']) &&
    (o['status'] === 'playing' || o['status'] === 'won')
  );
}

export function loadSave(storage: SaveStorage | null, key: string): SerializedSave | null {
  if (!storage) return null;
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isSerializedSave(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSave(storage: SaveStorage | null, key: string, save: SerializedSave): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(save));
  } catch {
    /* quota / 隐私模式静默忽略；不阻断游戏 */
  }
}

export function clearSave(storage: SaveStorage | null, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** 空的 BestTimes（全 null）。 */
export function emptyBestTimes(): BestTimes {
  return { easy: null, medium: null, hard: null };
}

/** 读回 BestTimes；损坏/缺失字段回落为 null。 */
export function loadBest(storage: SaveStorage | null, key: string): BestTimes {
  const result = emptyBestTimes();
  if (!storage) return result;
  const raw = storage.getItem(key);
  if (!raw) return result;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      const o = parsed as Record<string, unknown>;
      for (const d of DIFFICULTIES) {
        const v = o[d];
        if (typeof v === 'number' && Number.isFinite(v) && v >= 0) result[d] = Math.floor(v);
      }
    }
  } catch {
    /* 回落全 null */
  }
  return result;
}

export function writeBest(storage: SaveStorage | null, key: string, best: BestTimes): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(best));
  } catch {
    /* ignore */
  }
}

/**
 * 读回主题偏好。存的是 JSON 字符串（如 `"dark"`）；缺失、JSON 损坏、或值不在登记表里
 * 都返回 null，由上层决定回落（`Sudoku` 回落 DEFAULT_THEME）。返回 null 而不是默认值，
 * 是为了让上层能区分「用户没存过」与「用户存的就是 light」。
 */
export function loadTheme(storage: SaveStorage | null, key: string): SudokuTheme | null {
  if (!storage) return null;
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isTheme(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeTheme(storage: SaveStorage | null, key: string, theme: SudokuTheme): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(theme));
  } catch {
    /* quota / 隐私模式静默忽略；主题写不进不该影响游戏 */
  }
}

export function clearTheme(storage: SaveStorage | null, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** 浏览器默认 Storage；无 DOM 环境返回 null，让 core 在 Node 也能跑。 */
export function tryGetGlobalStorage(): SaveStorage | null {
  if (typeof globalThis === 'undefined') return null;
  const s = (globalThis as { localStorage?: SaveStorage }).localStorage;
  return s ?? null;
}
