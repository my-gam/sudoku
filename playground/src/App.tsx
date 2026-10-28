import { useCallback, useEffect, useRef, useState } from 'react';
import { GameSudoku as GameSudokuReact } from '@my-games/sudoku-react';
import {
  DEFAULT_THEME,
  DEFAULT_THEME_KEY,
  isTheme,
  loadTheme,
  resolveTheme,
  tryGetGlobalStorage
} from '@my-games/sudoku-core';
import type { Digit, SudokuTheme } from '@my-games/sudoku-core';
import { VuePanel } from './VuePanel';
import { VanillaDemo } from './VanillaDemo';

/**
 * Playground —— 三 tab 共享同一份 @my-games/sudoku-core 引擎与样式：
 * Vanilla（直吃 core，手工 DOM）/ Vue 3 / React 18/19。
 * 每个 tab 各有一份独立事件日志（跟随当前 tab），填数记录"格坐标 ← 数字"。
 * 主题切换器对三个 tab 同时生效，走 core 的 --sudoku-* 契约层；页面外壳另用一套 pg-* 色。
 * URL：?demo=vanilla|vue|react；?theme=light|dark|high-contrast|sepia|auto；?hint=1 显示提示按钮。
 */
type Demo = 'vanilla' | 'vue' | 'react';
type LogEntry = { id: number; kind: 'fill' | 'solved'; text: string };

const TABS: Array<{ key: Demo; label: string }> = [
  { key: 'vanilla', label: 'Vanilla' },
  { key: 'vue', label: 'Vue' },
  { key: 'react', label: 'React' }
];

const THEMES: Array<{ key: SudokuTheme; label: string }> = [
  { key: 'light', label: '浅色' },
  { key: 'dark', label: '深色' },
  { key: 'high-contrast', label: '高对比' },
  { key: 'sepia', label: '纸质' },
  { key: 'auto', label: '跟随系统' }
];

const EMPTY_LOGS: Record<Demo, LogEntry[]> = { vanilla: [], vue: [], react: [] };

function initialDemo(): Demo {
  if (typeof window === 'undefined') return 'vanilla';
  const raw = new URLSearchParams(window.location.search).get('demo');
  return raw === 'vue' || raw === 'react' ? raw : 'vanilla';
}

/**
 * 初始主题优先级：URL ?theme= > 引擎持久化的偏好（game-sudoku:theme）> light。
 * URL 值是不可信输入，交给 core 的 normalizeTheme 归一；持久化值由 loadTheme 自己挡非法。
 */
function initialTheme(): SudokuTheme {
  if (typeof window === 'undefined') return 'light';
  const fromUrl = new URLSearchParams(window.location.search).get('theme');
  if (isTheme(fromUrl)) return fromUrl;
  return loadTheme(tryGetGlobalStorage(), DEFAULT_THEME_KEY) ?? DEFAULT_THEME;
}

function formatFill(e: { digit: Digit; changed: boolean; row: number; col: number }): string {
  const cell = e.row >= 0 && e.col >= 0 ? `(${e.row + 1},${e.col + 1})` : '(未选中)';
  return `${cell} ← ${e.digit}${e.changed ? '' : ' 无效'}`;
}

export function App() {
  const [demo, setDemo] = useState<Demo>(initialDemo);
  const [theme, setTheme] = useState<SudokuTheme>(initialTheme);
  const [hintOn] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('hint') === '1'
  );
  const [logs, setLogs] = useState<Record<Demo, LogEntry[]>>(EMPTY_LOGS);
  const idRef = useRef(0);

  // 页面外壳要跟着换色，所以这里也得把 auto 解析成具体档（组件内部各自还会再解析一次）。
  const [prefersDark, setPrefersDark] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    setPrefersDark(query.matches);
    const onChange = (ev: MediaQueryListEvent): void => setPrefersDark(ev.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  const resolvedTheme = resolveTheme(theme, prefersDark);

  // 页面外壳的配色挂在 <html> 上（挂在 .pg-shell 上的话，body 读不到变量，
  // 桌面端 460px 栏目外侧会露出一圈白底）。用 data-pg-theme 与组件的 data-theme 区分开。
  useEffect(() => {
    document.documentElement.dataset.pgTheme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('demo', demo);
    url.searchParams.set('theme', theme);
    window.history.replaceState({}, '', url.toString());
  }, [demo, theme]);

  const addLog = useCallback((target: Demo, entry: Omit<LogEntry, 'id'>) => {
    idRef.current += 1;
    const id = idRef.current;
    setLogs((prev) => ({ ...prev, [target]: [{ id, ...entry }, ...prev[target]].slice(0, 200) }));
  }, []);

  const clearLog = useCallback((target: Demo) => {
    setLogs((prev) => ({ ...prev, [target]: [] }));
  }, []);

  // 每个 tab 一套稳定回调（addLog 稳定 → 这些也稳定），写入各自独立的日志。
  const onFill = useCallback((target: Demo) => (e: { digit: Digit; changed: boolean; row: number; col: number }) =>
    addLog(target, { kind: 'fill', text: formatFill(e) }), [addLog]);
  const onSolvedFor = useCallback((target: Demo) => (e: { difficulty: string; seconds: number }) =>
    addLog(target, { kind: 'solved', text: `通关 · 用时 ${e.seconds}s` }), [addLog]);

  const handlers = {
    vanilla: { onDigit: onFill('vanilla'), onSolved: onSolvedFor('vanilla') },
    vue: { onDigit: onFill('vue'), onSolved: onSolvedFor('vue') },
    react: { onDigit: onFill('react'), onSolved: onSolvedFor('react') }
  };

  return (
    <div className="pg-shell">
      <header className="pg-top">
        <h1 className="pg-title">
          数独<span className="pg-sub">Playground</span>
        </h1>
        <div className="pg-badges">
          <span className="pg-badge">core · 无框架</span>
          <span className="pg-badge">Vue · React · Vanilla</span>
        </div>
      </header>

      <nav className="pg-tabs" role="tablist" aria-label="演示方式">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={demo === t.key}
            className={`pg-tab${demo === t.key ? ' is-active' : ''}`}
            onClick={() => setDemo(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <nav className="pg-themes" role="group" aria-label="主题">
        {THEMES.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={theme === t.key}
            className={`pg-theme-btn${theme === t.key ? ' is-active' : ''}`}
            onClick={() => setTheme(t.key)}
          >
            {t.label}
          </button>
        ))}
        <span className="pg-theme-now">
          <code>data-theme={resolvedTheme}</code>
        </span>
      </nav>

      <section className="pg-stage" role="tabpanel">
        {demo === 'vanilla' && (
          <>
            <p className="pg-meta">
              <span className="pg-tag pg-tag-vanilla">core</span>
              直接 <code>new Sudoku()</code> + 手搓 DOM，等价浏览器 IIFE 用法。
            </p>
            <VanillaDemo
              saveKey="sudoku-vanilla:save"
              bestKey="sudoku-vanilla:best"
              autofocus
              showHint={hintOn}
              theme={theme}
              onDigit={handlers.vanilla.onDigit}
              onSolved={handlers.vanilla.onSolved}
            />
            <EventLog items={logs.vanilla} onClear={() => clearLog('vanilla')} />
          </>
        )}
        {demo === 'vue' && (
          <>
            <p className="pg-meta">
              <span className="pg-tag pg-tag-vue">Vue 3</span>
              <code>GameSudoku.vue</code> + <code>useGame()</code> composable。
            </p>
            <VuePanel
              saveKey="sudoku-vue:save"
              bestKey="sudoku-vue:best"
              autofocus
              showHint={hintOn}
              theme={theme}
              onDigit={handlers.vue.onDigit}
              onSolved={handlers.vue.onSolved}
            />
            <EventLog items={logs.vue} onClear={() => clearLog('vue')} />
          </>
        )}
        {demo === 'react' && (
          <>
            <p className="pg-meta">
              <span className="pg-tag pg-tag-react">React</span>
              <code>GameSudoku</code> + <code>useGame()</code> hook，<code>forwardRef</code> 暴露句柄。
            </p>
            <GameSudokuReact
              saveKey="sudoku-react:save"
              bestKey="sudoku-react:best"
              autofocus
              showHint={hintOn}
              theme={theme}
              onDigit={handlers.react.onDigit}
              onSolved={handlers.react.onSolved}
            />
            <EventLog items={logs.react} onClear={() => clearLog('react')} />
          </>
        )}
      </section>

      <details className="pg-fold">
        <summary>关于本页</summary>
        <p className="pg-about">
          一个数独引擎，三种消费方式共享同一份 <code>@my-games/sudoku-core</code> 与样式。每个 tab
          有各自独立的事件日志（切换 tab 即切换日志），填数记录形如 <code>(行,列) ← 数字</code>（1 起算，
          无效填数标注"无效"）。三 tab 各自独立 localStorage 键（<code>sudoku-&lt;tab&gt;:save</code> /
          <code>:best</code>），切换不打断对局。键盘：1-9 填数、N 笔记、Backspace 擦除、方向键移动选中。
          「提示」默认不常驻，只作 API；加 <code>?hint=1</code> 显示按钮。主题档位归
          <code>@my-games/sudoku-core</code> 引擎所有（<code>game.setTheme()</code> /
          <code>GameState.theme</code>），落在独立的 <code>game-sudoku:theme</code> 键里，
          <b>刷新后保持</b>；三个 tab 共享这一份偏好。<code>auto</code> = 跟随系统，由
          <code>matchMedia</code> 解析成具体档（右侧回显真正生效的值）。
        </p>
      </details>

      <footer className="pg-foot">MIT · @my-games/sudoku · <a href="https://github.com/my-gam/sudoku">GitHub</a></footer>
    </div>
  );
}

/** 单个 tab 的事件日志（折叠，跟随该 tab）。 */
function EventLog({ items, onClear }: { items: LogEntry[]; onClear: () => void }) {
  return (
    <details className="pg-fold pg-tablog">
      <summary>
        事件日志{items.length ? ` · ${items.length}` : ''}
      </summary>
      <div className="pg-logbar">
        <button className="pg-btn" type="button" onClick={onClear} disabled={items.length === 0}>
          清空
        </button>
      </div>
      <div className="pg-log">
        {items.length === 0 ? (
          <div className="row empty">还没有事件。点格子、按 1-9 或点数字键盘。</div>
        ) : (
          items.map((l) => (
            <span key={l.id} className={`row${l.kind === 'solved' ? ' win' : ''}`}>
              {l.text}
            </span>
          ))
        )}
      </div>
    </details>
  );
}
