/**
 * 主题契约测试。
 *
 * 两件事：
 * 1. `src/style.css` 的结构校验——四档预设 × 约 30 个 token 靠肉眼对齐必漏，
 *    所以「预设必须定义全集」「布局层不得残留硬编码色值」「给定数双通道」都做成断言。
 * 2. `themes.ts` 的纯函数行为。
 *
 * 解析策略：不引入 CSS 解析依赖，用「最内层 rule 对」正则取规则。判据刻意依赖选择器
 * 形态而非注释分节，因此重排注释不会误报：
 * - 契约层规则 = 声明了 `--sudoku-*` 属性的规则（主题预设）；
 * - 解析层规则 = 右侧出现 `var(--sudoku-` 的规则；
 * - 布局层规则 = 其余全部，它们不允许出现颜色字面量。
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME,
  SUDOKU_DATA_THEMES,
  SUDOKU_THEMES,
  isTheme,
  normalizeTheme,
  resolveTheme
} from '../src/themes';

const CSS = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

interface Rule {
  selector: string;
  decls: Array<[string, string]>;
}

/** 一条预设规则可能用逗号选择器同时充当兜底档与具名档，故按档名展开成多条 entry。 */
interface PresetEntry {
  name: string;
  rule: Rule;
  tokens: string[];
}

/** 取最内层 rule 对；@media 外层不产规则，只把内部规则带出来。 */
function parseRules(css: string): Rule[] {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: Rule[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const selector = m[1];
    const body = m[2];
    if (selector === undefined || body === undefined) continue;
    const decls: Array<[string, string]> = [];
    for (const part of body.split(';')) {
      const idx = part.indexOf(':');
      if (idx < 0) continue;
      decls.push([part.slice(0, idx).trim(), part.slice(idx + 1).trim()]);
    }
    rules.push({ selector: selector.replace(/\s+/g, ' ').trim(), decls });
  }
  return rules;
}

const RULES = parseRules(CSS);

function buildPresets(): PresetEntry[] {
  const entries: PresetEntry[] = [];
  for (const rule of RULES) {
    const tokens = rule.decls.map(([n]) => n).filter((n) => n.startsWith('--sudoku-'));
    if (tokens.length === 0) continue;
    const names = new Set<string>();
    for (const part of rule.selector.split(',')) {
      const named = /\[data-theme='([^']+)'\]/.exec(part);
      names.add(named && named[1] ? named[1] : 'default');
    }
    for (const name of names) entries.push({ name, rule, tokens });
  }
  return entries;
}

/** 解析层（内部短名 ← 契约名）里出现的全部契约 token，作为「全集」基准。 */
function contractTokens(): string[] {
  const found = new Set<string>();
  for (const rule of RULES) {
    for (const [, value] of rule.decls) {
      for (const m of value.matchAll(/var\((--sudoku-[a-z0-9-]+)\)/g)) {
        if (m[1]) found.add(m[1]);
      }
    }
  }
  return Array.from(found).sort();
}

function declMap(rule: Rule): Map<string, string> {
  return new Map(rule.decls);
}

function requirePreset(name: string): PresetEntry {
  const hit = PRESETS.find((p) => p.name === name);
  if (!hit) throw new Error(`CSS 里没有预设档位：${name}`);
  return hit;
}

const PRESETS = buildPresets();
const TOKENS = contractTokens();

describe('style.css 规则解析器自检', () => {
  it('真的读到了规则（否则下面的断言全是空集合 vs 空集合的假绿灯）', () => {
    expect(RULES.length).toBeGreaterThan(40);
    expect(PRESETS.length).toBeGreaterThanOrEqual(SUDOKU_DATA_THEMES.length + 1);
    expect(TOKENS.length).toBeGreaterThan(20);
    // 解析器不能把 @media 里的规则整段丢掉。
    expect(RULES.some((r) => r.selector === '.game-sudoku-cell.is-given')).toBe(true);
  });

  it('契约 token 全集里没有重复定义，且都在解析层映射过', () => {
    expect(new Set(TOKENS).size).toBe(TOKENS.length);
    const mapped = RULES.filter((r) => {
      const d = declMap(r);
      return [...d.keys()].some((k) => !k.startsWith('--sudoku-') && /var\(--sudoku-/.test(d.get(k) ?? ''));
    });
    expect(mapped.length, '解析层应当恰好是一条规则').toBe(1);
    const resolveRule = mapped[0];
    if (!resolveRule) throw new Error('找不到解析层规则');
    const resolveNames = resolveRule.decls.map(([n]) => n);
    expect(new Set(resolveNames).size).toBe(resolveNames.length);
  });
});

describe('style.css 主题契约层', () => {
  it('预设档位与 SUDOKU_DATA_THEMES 一一对应（双向不漂移）', () => {
    const names = PRESETS.map((p) => p.name);
    expect(names).toContain('default');
    for (const theme of SUDOKU_DATA_THEMES) {
      expect(names, `CSS 缺少 [data-theme='${theme}']`).toContain(theme);
    }
    for (const name of names) {
      if (name === 'default') continue;
      expect(SUDOKU_DATA_THEMES as readonly string[], `CSS 有未登记的预设 ${name}`).toContain(name);
    }
  });

  it('每个预设都定义全集 token，且不多定义（缺一个会渲染出透明/无色）', () => {
    for (const p of PRESETS) {
      const declared = [...new Set(p.tokens)].sort();
      const missing = TOKENS.filter((t) => !declared.includes(t));
      const extra = declared.filter((t) => !TOKENS.includes(t));
      expect(missing, `预设 ${p.name} 缺少的 token`).toEqual([]);
      expect(extra, `预设 ${p.name} 里没人消费的 token`).toEqual([]);
      expect(declared.length, `预设 ${p.name} 的 token 数与全集不符`).toBe(TOKENS.length);
    }
  });

  it('三档具名预设彼此不同色，且都不等于 light（避免某档是复制粘贴）', () => {
    // 注意 default 与 light 是同一条规则（逗号选择器），不能参与「互不相同」比较。
    const key = (d: Map<string, string | undefined>): string =>
      ['--sudoku-cell-bg', '--sudoku-text-given', '--sudoku-accent'].map((k) => d.get(k)).join('|');
    const lightSig = key(declMap(requirePreset('light').rule));
    const others = SUDOKU_DATA_THEMES.filter((t) => t !== 'light').map((t) => key(declMap(requirePreset(t).rule)));
    for (const sig of others) {
      expect(sig === lightSig, '有一档与 light 的关键色完全相同').toBe(false);
    }
    expect(new Set(others).size, '有两档关键色互相撞车').toBe(others.length);
  });

  it('选中格上的笔记提级到正文色（笔记只有 7-11px，压在选中底色上过不了 4.5:1）', () => {
    const rule = RULES.find((r) => r.selector === '.game-sudoku-cell.is-selected .cell-notes');
    if (!rule) throw new Error('缺少选中格笔记提级规则');
    expect(declMap(rule).get('color')).toBe('var(--text-given)');
    // 提级必须能盖过基础 .cell-notes：靠的是多两级类选择器，不靠 !important。
    const base = RULES.find((r) => r.selector === '.cell-notes');
    if (!base) throw new Error('找不到 .cell-notes 基础规则');
    expect(declMap(base).get('color')).toBe('var(--text-muted)');
    expect(JSON.stringify(rule.decls).includes('!important')).toBe(false);
  });

  it('布局层不残留任何颜色字面量（一切颜色必须穿过 token）', () => {
    const colorLiteral = /#[0-9a-fA-F]{3,8}|\brgba?\(|\bhsla?\(/;
    const offenders: string[] = [];
    for (const rule of RULES) {
      const isContractOrResolve = rule.decls.some(
        ([name, value]) => name.startsWith('--sudoku-') || /var\(--sudoku-/.test(value)
      );
      if (isContractOrResolve) continue;
      for (const [name, value] of rule.decls) {
        if (colorLiteral.test(value)) offenders.push(`${rule.selector} { ${name}: ${value} }`);
      }
    }
    expect(offenders, '布局层出现硬编码颜色').toEqual([]);
  });

  it('玩家数字也走「彩底 + 颜色 + 字重」，且与给定淡底彼此可辨', () => {
    const rule = RULES.find((r) => r.selector === '.game-sudoku-cell.is-user');
    if (!rule) throw new Error('找不到 .game-sudoku-cell.is-user 规则');
    const d = declMap(rule);
    expect(d.get('color')).toBe('var(--text-user)');
    expect(d.get('background')).toBe('var(--user-bg)');
    for (const p of PRESETS) {
      const t = declMap(p.rule);
      const userBg = t.get('--sudoku-user-bg');
      expect(userBg, `${p.name} 缺 user-bg`).toBeTruthy();
      expect(userBg === t.get('--sudoku-cell-bg'), `${p.name} 玩家淡底与格子同色`).toBe(false);
      expect(userBg === t.get('--sudoku-given-bg'), `${p.name} 玩家淡底与给定淡底同色`).toBe(false);
    }
  });

  it('给定数字走「底色 + 字重」双通道（不能退回只靠字重）', () => {
    const rule = RULES.find((r) => r.selector === '.game-sudoku-cell.is-given');
    if (!rule) throw new Error('找不到 .game-sudoku-cell.is-given 规则');
    const d = declMap(rule);
    expect(d.get('background')).toBe('var(--given-bg)');
    expect(d.get('font-weight')).toBe('var(--given-weight)');
    expect(d.get('color')).toBe('var(--text-given)');
  });

  it('is-given / is-user 排在同行同数/选中高亮之前，保证高亮压得过两种淡底', () => {
    const at = (sel: string): number => {
      const idx = CSS.indexOf(`\n${sel} {`);
      if (idx < 0) throw new Error(`找不到规则 ${sel}`);
      return idx;
    };
    for (const plate of ['.game-sudoku-cell.is-given', '.game-sudoku-cell.is-user']) {
      const base = at(plate);
      for (const sel of [
        '.game-sudoku-cell.is-peer',
        '.game-sudoku-cell.is-same',
        '.game-sudoku-cell.is-selected'
      ]) {
        expect(base, `${plate} 必须排在 ${sel} 之前`).toBeLessThan(at(sel));
      }
    }
  });

  it('窄屏给定数字号单独放大，且确实大于基础字号（移动端补的那一环）', () => {
    const media = /@media \(max-width: 420px\) \{[\s\S]*?\.game-sudoku-cell\.is-given \{([^}]*)\}/.exec(CSS);
    if (!media || !media[1]) throw new Error('缺少窄屏 is-given 规则');
    const big = /clamp\((\d+)px/.exec(media[1]);
    const base = /\.game-sudoku-cell \{[\s\S]*?font-size: clamp\((\d+)px/.exec(CSS);
    if (!big || !big[1] || !base || !base[1]) throw new Error('字号规则解析失败');
    expect(Number(big[1])).toBeGreaterThan(Number(base[1]));
  });

  it('每档预设都声明 color-scheme，且深浅方向与档位匹配', () => {
    for (const p of PRESETS) {
      const scheme = declMap(p.rule).get('color-scheme');
      expect(scheme, `预设 ${p.name} 未声明 color-scheme`).toBeTruthy();
      const shouldDark = p.name === 'dark' || p.name === 'high-contrast';
      expect(scheme === 'dark', `${p.name} 的 color-scheme 方向不对`).toBe(shouldDark);
    }
  });

  it('每档的给定底色既不同于格子底色、也不同于给定文字色（淡底通道真实存在）', () => {
    for (const p of PRESETS) {
      const d = declMap(p.rule);
      const cellBg = d.get('--sudoku-cell-bg');
      const givenBg = d.get('--sudoku-given-bg');
      const givenText = d.get('--sudoku-text-given');
      expect(givenBg, `${p.name} 没有 given-bg`).toBeTruthy();
      expect(givenBg === cellBg, `${p.name} 给定底色与格子底色相同，淡底通道等于没做`).toBe(false);
      expect(givenBg === givenText, `${p.name} 给定底色与文字同色`).toBe(false);
    }
  });

  it('每档的强调色与其上文字对比足够（避免深色档把白字压在白底上）', () => {
    for (const p of PRESETS) {
      const d = declMap(p.rule);
      // 粗判：on-accent 与 accent 不能是同一个值，且都不能同时接近纯白。
      const accent = (d.get('--sudoku-accent') ?? '').toLowerCase();
      const onAccent = (d.get('--sudoku-on-accent') ?? '').toLowerCase();
      const nearWhite = (hex: string): boolean =>
        /^#f{3}$|^#(fff|fefefe|fdfdfd|fcfcfc|ffffff)\b/.test(hex);
      expect(accent === onAccent, `${p.name} accent 与其上文字同色`).toBe(false);
      expect(
        nearWhite(accent) && nearWhite(onAccent),
        `${p.name} accent 与文字都是白，按钮文字将不可见`
      ).toBe(false);
    }
  });
});

describe('style.css 给定数字字重', () => {
  it('字重是真实存在的档位，且不高于 700（800 在 Android 会落回 700，等于没改）', () => {
    for (const p of PRESETS) {
      const raw = declMap(p.rule).get('--sudoku-given-weight');
      expect(raw, `${p.name} 缺 given-weight`).toBeTruthy();
      const w = Number(raw);
      expect([100, 200, 300, 400, 500, 600, 700, 800, 900], `${p.name} 非法字重`).toContain(w);
      expect(w, `${p.name} 字重回到 800`).toBeLessThanOrEqual(700);
    }
  });
});

describe('给定数字 vs 玩家数字的可辨识度', () => {
  // 「不够明显」这种反馈不该靠肉眼往返猜，这里把判据钉成断言：
  // 底色块之间按 WCAG 1.4.11 非文本对比 ≥3:1；文字压底按 1.4.3 正文 ≥4.5:1。
  const chan = (v: string): number => {
    const c = parseInt(v, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = (hex: string): number => {
    const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
    if (!m || !m[1]) throw new Error(`契约层出现非 #rrggbb 的颜色：${hex}`);
    const n = m[1];
    return 0.2126 * chan(n.slice(0, 2)) + 0.7152 * chan(n.slice(2, 4)) + 0.0722 * chan(n.slice(4, 6));
  };
  const contrast = (a: string, b: string): number => {
    const [x, y] = [lum(a), lum(b)];
    const [hi, lo] = x > y ? [x, y] : [y, x];
    return (hi + 0.05) / (lo + 0.05);
  };
  const need = (p: PresetEntry, token: string): string => {
    const v = declMap(p.rule).get(token);
    if (!v) throw new Error(`预设 ${p.name} 缺 ${token}`);
    return v;
  };

  it('给定淡底与玩家色块互差 ≥3:1（这是"一眼区分"的主通道）', () => {
    for (const p of PRESETS) {
      const r = contrast(need(p, '--sudoku-given-bg'), need(p, '--sudoku-user-bg'));
      expect(r, `${p.name} 两块底几乎同色，区分度不足：${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    }
  });

  it('玩家色块压普通格子底 ≥3:1（色块要跳得出来）', () => {
    for (const p of PRESETS) {
      const r = contrast(need(p, '--sudoku-user-bg'), need(p, '--sudoku-cell-bg'));
      expect(r, `${p.name} 色块和格子分不开：${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    }
  });

  it('玩家反白字压自己色块 ≥4.5:1', () => {
    for (const p of PRESETS) {
      const r = contrast(need(p, '--sudoku-text-user'), need(p, '--sudoku-user-bg'));
      expect(r, `${p.name} 玩家数字读数不达标：${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('高亮态深色字压住选中/同数/同行三种浅色填充，全部 ≥4.5:1', () => {
    for (const p of PRESETS) {
      const ink = need(p, '--sudoku-user-ink-on-tint');
      for (const tint of ['--sudoku-hl-selected', '--sudoku-hl-same', '--sudoku-hl-peer']) {
        const r = contrast(ink, need(p, tint));
        expect(r, `${p.name} 玩家数字压 ${tint} 上只有 ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('给定墨字压给定淡底 ≥7:1（题面数字是全场最该清晰的）', () => {
    for (const p of PRESETS) {
      const r = contrast(need(p, '--sudoku-text-given'), need(p, '--sudoku-given-bg'));
      expect(r, `${p.name} 给定数字对比不足：${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(7);
    }
  });

  it('玩家格被高亮覆盖时必须改用深色字，冲突态再压过它', () => {
    const at = (sel: string): number => {
      const idx = CSS.indexOf(`\n${sel},`) === -1 ? CSS.indexOf(`\n${sel} {`) : CSS.indexOf(`\n${sel},`);
      if (idx < 0) throw new Error(`找不到规则 ${sel}`);
      return idx;
    };
    const onTint = at('.game-sudoku-cell.is-user.is-peer');
    const conflict = at('.game-sudoku-cell.is-conflict');
    expect(onTint, '高亮态深色字规则缺失').toBeGreaterThan(-1);
    expect(conflict, '冲突态必须在「高亮态深色字」之后，否则选中的错格看不到红字').toBeGreaterThan(onTint);
    const rule = RULES.find((r) => r.selector.includes('.game-sudoku-cell.is-user.is-peer'));
    if (!rule) throw new Error('找不到玩家格高亮态规则');
    expect(declMap(rule).get('color')).toBe('var(--user-ink-on-tint)');
  });
});

describe('themes.ts 档位解析', () => {
  it('SUDOKU_THEMES = 具体档 + auto', () => {
    expect(SUDOKU_THEMES).toEqual([...SUDOKU_DATA_THEMES, 'auto']);
    expect(DEFAULT_THEME).toBe('light');
    expect(SUDOKU_DATA_THEMES as readonly string[]).toContain('high-contrast');
  });

  it('isTheme 只认登记表里的档位（大小写敏感）', () => {
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('auto')).toBe(true);
    expect(isTheme('DARK')).toBe(false);
    expect(isTheme('')).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(undefined)).toBe(false);
    expect(isTheme(42)).toBe(false);
  });

  it('normalizeTheme 合法值原样通过，非法值退回兜底', () => {
    expect(normalizeTheme('sepia')).toBe('sepia');
    expect(normalizeTheme('neon')).toBe(DEFAULT_THEME);
    expect(normalizeTheme('neon', 'dark')).toBe('dark');
    expect(normalizeTheme(undefined, 'high-contrast')).toBe('high-contrast');
  });

  it('resolveTheme：auto 按系统偏好落到具体档，具体档原样返回', () => {
    // 先钉住 auto 的两支确实不同，否则后面的断言可能恒真。
    expect(resolveTheme('auto', true)).not.toBe(resolveTheme('auto', false));
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
    for (const theme of SUDOKU_DATA_THEMES) {
      expect(resolveTheme(theme, true)).toBe(theme);
      expect(resolveTheme(theme, false)).toBe(theme);
    }
  });

  it('resolveTheme 的返回永远是 CSS 里真实存在的档（不会写出哑属性）', () => {
    const cssNames = new Set(PRESETS.map((p) => p.name));
    for (const theme of SUDOKU_THEMES) {
      for (const prefersDark of [true, false]) {
        const resolved = resolveTheme(theme, prefersDark);
        expect(cssNames.has(resolved), `data-theme="${resolved}" 在 CSS 里没有对应预设`).toBe(true);
      }
    }
  });
});
