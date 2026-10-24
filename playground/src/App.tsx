import { useCallback, useEffect, useRef, useState } from 'react';
import { GameSudoku as GameSudokuReact } from '@my-games/sudoku-react';
import type { Digit } from '@my-games/sudoku-core';
import { VuePanel } from './VuePanel';
import { VanillaDemo } from './VanillaDemo';

/**
 * Playground —— 三 tab，共享同一份 @my-games/sudoku-core 引擎与样式：
 *  - Vanilla：直接吃 core，手工画 DOM（无框架）
 *  - Vue 3：@my-games/sudoku-vue 组件
 *  - React 18/19：@my-games/sudoku-react 组件
 *
 * URL：`?demo=vanilla|vue|react`，默认 vanilla。三 tab 各自独立 localStorage key。
 */
type Demo = 'vanilla' | 'vue' | 'react';
type LogEntry = { id: number; framework: Demo; kind: 'digit' | 'solved'; text: string };

function useInitialQuery(): { demo: Demo } {
  const [state] = useState(() => {
    if (typeof window === 'undefined') return { demo: 'vanilla' as Demo };
    const raw = new URLSearchParams(window.location.search).get('demo');
    const demo: Demo = raw === 'vue' || raw === 'react' ? raw : 'vanilla';
    return { demo };
  });
  return state;
}

export function App() {
  const boot = useInitialQuery();
  const [demo, setDemo] = useState<Demo>(boot.demo);
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
      <header className="pg-header">
        <h1>sudoku · Playground</h1>
        <p>
          一个数独引擎，三种消费方式：<b>Vanilla</b>（直接吃 core，手工画 DOM）、
          <b>Vue 3</b>（<code>@my-games/sudoku-vue</code>）、
          <b>React 18/19</b>（<code>@my-games/sudoku-react</code>）。三包共享同一份
          <code> @my-games/sudoku-core</code> 引擎与样式表。
        </p>
        <div className="pg-badges">
          <span className="pg-badge">TypeScript 7 · tsgo</span>
          <span className="pg-badge">Vite 8 · Rolldown</span>
          <span className="pg-badge">ESM · CJS · UMD · IIFE</span>
          <span className="pg-badge">回溯求解 · 唯一解生成</span>
          <span className="pg-badge">localStorage 存档 · 撤销 · 计时</span>
        </div>
      </header>

      <nav className="pg-tabs" role="tablist" aria-label="Demo tabs">
        {(
          [
            ['vanilla', 'Vanilla · 直接引入 core'],
            ['vue', 'Vue 3 组件'],
            ['react', 'React 18/19 组件']
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={demo === key}
            className={`pg-tab${demo === key ? ' is-active' : ''}`}
            onClick={() => setDemo(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <section className="pg-panel" role="tabpanel">
        {demo === 'vanilla' && (
          <>
            <div className="pg-panel-head">
              <h2>Vanilla</h2>
              <span className="pg-tag pg-tag-vanilla">@my-games/sudoku-core · 无框架 · 手工 DOM</span>
            </div>
            <p className="pg-panel-desc">
              等价于浏览器 <code>&lt;script src="...index.iife.js"&gt;</code> +{' '}
              <code> const {'{'} Sudoku {'}'} = SudokuCore</code>：棋盘 DOM、键盘/点击、覆盖层全手写，
              只靠 core 的 <code>Sudoku</code> 类。
            </p>
            <VanillaDemo saveKey="sudoku-vanilla:save" bestKey="sudoku-vanilla:best" autofocus />
          </>
        )}
        {demo === 'vue' && (
          <>
            <div className="pg-panel-head">
              <h2>Vue 3</h2>
              <span className="pg-tag pg-tag-vue">GameSudoku from @my-games/sudoku-vue</span>
            </div>
            <p className="pg-panel-desc">
              单文件 <code>GameSudoku.vue</code> + <code>useGame()</code> composable；键盘走 focus +
              window keydown。
            </p>
            <VuePanel saveKey="sudoku-vue:save" bestKey="sudoku-vue:best" autofocus />
          </>
        )}
        {demo === 'react' && (
          <>
            <div className="pg-panel-head">
              <h2>React 18/19</h2>
              <span className="pg-tag pg-tag-react">GameSudoku from @my-games/sudoku-react</span>
            </div>
            <p className="pg-panel-desc">
              函数组件 + <code>useGame()</code> hook；<code>forwardRef</code> 暴露命令式方法。样式与
              动画完全复用 core 的 <code>style.css</code>。
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

      <section>
        <div className="pg-panel-head">
          <h2 style={{ fontSize: 16 }}>事件日志（最新在前 · React tab 触发）</h2>
          <button className="pg-btn" type="button" onClick={() => setLogs([])}>
            清空
          </button>
        </div>
        <div className="pg-log">
          {logs.length === 0 ? (
            <div className="row empty">还没有事件。切到 React tab 点格子、按 1-9 或点数字键盘。</div>
          ) : (
            logs.map((l) => (
              <span key={l.id} className="row">
                [{l.framework}] {l.kind === 'digit' ? '填数' : '结果'}：{l.text}
              </span>
            ))
          )}
        </div>
      </section>

      <footer className="pg-footer">
        <p>
          存档分别落在 <code>sudoku-vanilla:save</code> / <code>sudoku-vue:save</code> /{' '}
          <code>sudoku-react:save</code> 与对应 best 键，切换 tab 不打断对局。
        </p>
      </footer>
    </div>
  );
}
