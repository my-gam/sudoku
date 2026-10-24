# sudoku（0.0.0-stage 空骨架）

> 这是一个 **占位发布**：monorepo 三层结构 + CI/发布链路已就位，但游戏逻辑尚未落地。
> 目的是先把 `@my-games/sudoku-core` / `-vue` / `-react` 三个包以 `0.0.0-stage`
> 手工种进 npm，用来配置 GitHub 的 npm **Trusted Publisher**（可信发布者无法发布
> 某个包的第一个版本，所以首版必须手工 seed）。真实数独引擎会在此之后作为后续提交补入。

## 这个仓库现在有什么

- **pnpm workspace**：`packages/core` + `packages/vue` + `packages/react`，外加 `playground/`。
- **`@my-games/sudoku-core`**：框架无关引擎占位，`vite build --mode lib` 一次出
  ESM / CJS / UMD / IIFE 四格式 + `.d.ts`。当前只导出 `SUDOKU_PACKAGE` / `SUDOKU_STAGE` 两个占位常量。
- **`@my-games/sudoku-vue` / `-react`**：组件适配器占位，各出一个 `GameSudoku` 组件（仅渲染占位文案）
  并抽出 `dist/index.css`。
- **CI**：`.github/workflows/publish.yml`（推 `v*` tag → 门禁 → OIDC 发布；`workflow_dispatch`
  默认 `dry_run=true` 可安全彩排）与 `pages.yml`（main 推 → 构建 playground → GitHub Pages）。
  两道 workflow 都在 `pnpm build` 后插入 `tools/verify-dist.mjs` 产物守卫，防 `--filter` 空跑。

## 本地跑门禁（不发版、不起监听）

```bash
pnpm install
pnpm build        # 三包 vite lib → dist
pnpm verify:dist  # 断言 11 个必需产物存在且非 0 字节
pnpm typecheck    # core / vue / react 全量 tsc --noEmit
pnpm test         # core 冒烟测试
```

> ⚠ 本仓库测试/构建**不启动 dev server**。`pnpm dev` / `dev:play` 会绑定 `127.0.0.1:5173`
> 触发 Windows 防火墙弹窗，需先获批准再手动跑一次。

## 首次占位发布（维护者手工执行）

`0.0.0-stage` 无法通过 Trusted Publishing 上传（可信发布者只能绑定已存在的包），必须用
一次性 npm token 手工发。**务必带 `--tag stage`**，否则会把预发布版设成 `latest`、污染 dist-tag：

```bash
pnpm build && pnpm verify:dist
npm login            # 或 NPM_TOKEN；仅首版需要
npm publish --access public --tag stage -w @my-games/sudoku-core
npm publish --access public --tag stage -w @my-games/sudoku-vue
npm publish --access public --tag stage -w @my-games/sudoku-react
```

发完在 npmjs 上为 `@my-games` org 的三个包分别登记 Trusted Publisher：指向
`my-gam/sudoku` 仓库 + 对应 workflow（`publish.yml`）+ environment `npm`。之后正式版本
（`v0.1.0` 起）由推 tag 的 CI 全自动接管，不再需要本地凭据。

## 接下来会补什么

真实数独引擎（棋盘校验、回溯求解器、唯一解题生成、`Sudoku` 状态机：选格/填数/擦除/
笔记/提示/撤销/计时 + 注入式存档与分难度最佳用时）、Vue/React 适配层、playground 三 tab
演示，以及完整 README / 单测。

## 红线

**不要自行打 tag / push tag** —— `publish.yml` 一旦被 `v*` tag 触发就会真发 npm 包。

## 许可

MIT · © 2026 xyj2156
