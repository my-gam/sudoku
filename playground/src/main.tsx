import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// 棋盘视觉（core 同源，随组件包抽出）+ playground 外壳样式。
import '@my-games/sudoku-react/style.css';
import './playground.css';
import { App } from './App';

const el = document.getElementById('app');
if (!el) throw new Error('#app not found');
createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>
);
