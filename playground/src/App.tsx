import { useCallback, useEffect, useRef, useState } from 'react';
import { GameSudoku as GameSudokuReact } from '@my-games/sudoku-react';
import type { Digit } from '@my-games/sudoku-core';
import { VuePanel } from './VuePanel';
import { VanillaDemo } from './VanillaDemo';

/**
 * Playground —— 三 tab 共享同一份 @my-games/sudoku-core 引擎与样式：
 * Vanilla（直吃 core，手工 DOM）/ Vue 3 / React 18/19。移动端紧凑排版：首屏只留棋盘，
 * 「关于」与「事件日志」折进 <details>。URL：?demo=vanilla|vue|react。
 */
type Demo = 'vanilla' | 'vue' | 'react';
type LogEntry = { id: number; framework: Demo; kind: 'digit' | 'solved'; text: string };

const TABS: Array<{ key: Demo; label: string }> = [
  { key: 'vanilla', label: 'Vanilla' },
  { key: 'vue', label: 'Vue' },
  { key: 'react', label: 'React' }
];

function initialDemo(): Demo {
  if (typeof window === 'undefined') return 'vanilla';
  const raw = new URLSearchParams(window.location.search).get('demo');
  return raw === 'vue' || raw === 'react' ? raw : 'vanilla';
}

export function App() {
  const [demo, setDemo] = useState<Demo>(initialDemo);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);

  const pushLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    logIdRef.current += 1;
    setLogs((prev) => [{ id: logIdRef.current, ...entry }, ...prev].slice(0, 120));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('demo', demo);
    window.history.replaceState({}, '', url.toString());
  }, [demo]);

  const onReactDigit = useCallback(
    (digit: Digit, changed: boolean) =>
      pushLog({ framework: 'react', kind: 'digit', text: `填 ${digit}${changed ? '' : '（无效）'}` }),
    [pushLog]
  );
  const onReactSolved = useCallback(
    (p: { difficulty: string; seconds: number }) =>
      pushLog({ framework: 'react', kind: 'solved', text: `通关 ${p.difficulty} · ${p.seconds}s` }),
    [pushLog]
  );

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

      <section className="pg-stage" role="tabpanel">
        {demo === 'vanilla' && (
          <>
            <p className="pg-meta">
              <span className="pg-tag pg-tag-vanilla">core</span>
              直接 <code>new Sudoku()</code> + 手搓 DOM，等价浏览器 IIFE 用法。
            </p>
            <VanillaDemo saveKey="sudoku-vanilla:save" bestKey="sudoku-vanilla:best" autofocus />
          </>
        )}
        {demo === 'vue' && (
          <>
            <p className="pg-meta">
              <span className="pg-tag pg-tag-vue">Vue 3</span>
              <code>GameSudoku.vue</code> + <code>useGame()</code> composable。
            </p>
            <VuePanel saveKey="sudoku-vue:save" bestKey="sudoku-vue:best" autofocus />
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
              onDigit={onReactDigit}
              onSolved={onReactSolved}
            />
          </>
        )}
      </section>

      <details className="pg-fold">
        <summary>
          事件日志（React tab）{logs.length ? ` · ${logs.length}` : ''}
        </summary>
        <div className="pg-logbar">
          <button className="pg-btn" type="button" onClick={() => setLogs([])}>
            清空
          </button>
        </div>
        <div className="pg-log">
          {logs.length === 0 ? (
            <div className="row empty">还没有事件。在 React tab 点格子或按 1-9。</div>
          ) : (
            logs.map((l) => (
              <span key={l.id} className="row">
                [{l.framework}] {l.kind === 'digit' ? '填数' : '结果'}：{l.text}
              </span>
            ))
          )}
        </div>
      </details>

      <details className="pg-fold">
        <summary>关于本页</summary>
        <p className="pg-about">
          一个数独引擎，三种消费方式共享同一份 <code>@my-games/sudoku-core</code> 与样式：Vanilla
          直接吃 core、<code>@my-games/sudoku-vue</code>、<code>@my-games/sudoku-react</code>。
          三 tab 各自独立 localStorage 键（<code>sudoku-&lt;tab&gt;:save</code> / <code>:best</code>），
          切换不打断对局。键盘：1-9 填数、N 笔记、Backspace 擦除、方向键移动选中。
        </p>
      </details>

      <footer className="pg-foot">MIT · @my-games/sudoku · <a href="https://github.com/my-gam/sudoku">GitHub</a></footer>
    </div>
  );
}
