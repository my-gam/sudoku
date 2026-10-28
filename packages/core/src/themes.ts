/**
 * 主题档位定义。
 *
 * 放在 core 是为了让 Vue / React 两个适配层与 playground 共用同一份真相，避免各自
 * 抄一份联合类型后漂移。本模块零 DOM 依赖，纯函数可单测。
 *
 * 注意 `auto` 的归属：CSS 契约层（`src/style.css`）只承载 4 个**具体**预设，`auto`
 * 是适配层用 `matchMedia` 解析后才写进 `data-theme` 的结果。把 auto 放进 CSS 需要把
 * 深色那一叠变量再抄一遍（`[data-theme='dark']` 与「auto 且系统为深」的生效条件不同，
 * 无法共享规则体），所以宁可让 JS 侧多一行监听。
 * 直接手写 `data-theme="auto"` 的宿主拿到的是默认浅色——这是有意的取舍。
 */

/** 具体主题档位：与 style.css 契约层的预设一一对应（`test/theme.test.ts` 静态校验）。 */
export const SUDOKU_DATA_THEMES = ['light', 'dark', 'high-contrast', 'sepia'] as const;

/** 组件可接受的 `theme` 取值：4 个具体档 + `auto`（跟随系统深浅）。 */
export const SUDOKU_THEMES = [...SUDOKU_DATA_THEMES, 'auto'] as const;

export type SudokuDataTheme = (typeof SUDOKU_DATA_THEMES)[number];

export type SudokuTheme = (typeof SUDOKU_THEMES)[number];

/** 未指定主题时的档位：保持既有观感，不静默改成跟随系统。 */
export const DEFAULT_THEME: SudokuTheme = 'light';

/** 是否合法档位（大小写敏感，档位名就是 CSS 属性值）。 */
export function isTheme(value: unknown): value is SudokuTheme {
  return typeof value === 'string' && (SUDOKU_THEMES as readonly string[]).includes(value);
}

/**
 * 把任意来源（URL 参数、localStorage、宿主配置）归一成合法档位；
 * 非法值退回 `fallback`（默认 `DEFAULT_THEME`），不抛错。
 */
export function normalizeTheme(value: unknown, fallback: SudokuTheme = DEFAULT_THEME): SudokuTheme {
  return isTheme(value) ? value : fallback;
}

/**
 * 把 `auto` 解析成具体档，其余原样返回。
 * `prefersDark` 由调用方从 `matchMedia('(prefers-color-scheme: dark)')` 提供，
 * 这样 core 不碰 window，SSR 与单测都好办。
 */
export function resolveTheme(theme: SudokuTheme, prefersDark: boolean): SudokuDataTheme {
  if (theme !== 'auto') return theme;
  return prefersDark ? 'dark' : 'light';
}
