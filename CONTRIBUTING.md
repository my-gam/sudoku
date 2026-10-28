# 贡献指南 · Contributing

感谢关注 sudoku。三层结构与 CI/发布链路已跑通，引擎与三个消费面均已落地，
首个正式版 `0.1.0` 已经 `publish.yml` + OIDC Trusted Publisher 发出（带 provenance）。
仓库处于「按功能块持续加玩法」阶段。

**快捷入口**

- npm：`@my-games/sudoku-core` · `@my-games/sudoku-vue` · `@my-games/sudoku-react`
- 安全漏洞：见 [SECURITY.md](./SECURITY.md)

## 项目结构 · Layout

```
sudoku/
├── packages/
│   ├── core/     @my-games/sudoku-core   纯 TS 引擎（ESM/CJS/UMD/IIFE 四格式）
│   ├── vue/      @my-games/sudoku-vue    Vue 3 SFC + composable
│   └── react/    @my-games/sudoku-react  React 18/19 组件 + hook
├── playground/   Vite SPA（Vanilla / Vue / React 三 tab + 主题切换器，Pages 的构建源）
├── tools/        CI 侧脚本（pages.mjs、verify-dist.mjs）
└── .github/      Actions workflow + issue/PR 模板
```

`core` 是唯一事实来源；`vue` / `react` 只订阅引擎状态 + 桥接输入输出。想上新玩法，先改
`core`，再让两个适配器的 typecheck/build 都过。**引擎不碰 DOM**：需要环境信息（如系统深浅）
时由宿主取值喂进来，core 只提供纯函数，这样 Node 单测能跑。

## 门禁 · Gates before submitting

任何 PR 都必须本地跑通（顺序 build → verify:dist → typecheck → test）：

```bash
pnpm build          # 三包 vite lib；core 拓扑序先建，供 vue/react 解析 dist/index.d.ts
pnpm verify:dist    # 断言 11 个必需产物存在且非 0 字节（防 --filter 空跑假绿）
pnpm typecheck      # core / vue / react 各自 tsc --noEmit
pnpm test           # core vitest
```

根脚本的 `--filter "./packages/**"` **盖不到 playground**，下面两条要单独跑：

```bash
pnpm --filter playground typecheck
pnpm --filter playground build
PAGES_REPO=sudoku node tools/pages.mjs   # Pages 构建 + 零断链自检（纯 build，不起监听）
```

> ⚠ 只看退出码不够：pnpm 的 `--filter` 空匹配也会退出 0。要么在输出里看到
> `Scope: 3 of 5 workspace projects`，要么靠 `verify:dist` 的产物断言兜住。
> ⚠ Windows 下 `pnpm` 跑 package.json 脚本不剥单引号，`--filter` 必须用转义双引号
> `\"./packages/**\"`（见根 `package.json`），否则匹配 0 项目且退出码仍为 0，门禁变假绿灯。

## 样式与主题 · CSS 契约

视觉只有一份：`packages/core/src/style.css`，vue / react 各自 `import` 它再抽出自己的
`dist/index.css`。改动请守这四条，前两条有测试钉：

1. **三层结构**：契约层 `--sudoku-*`（对外承诺）→ 解析层（映射成内部短名，整表只出现一次）
   → 布局层（只消费短名）。**布局层不允许出现颜色字面量**，`test/theme.test.ts` 会扫源码断言。
2. **四档预设必须同步补齐**：`light`（含兜底 `:where(.game-sudoku)`）/ `dark` /
   `high-contrast` / `sepia`。加一个 token 就要在**每一档**都给值，漏一个测试直接判红——
   解析层刻意不写 fallback，就是为了让漏项变成硬失败而不是"渲染出透明色"。
3. **预设写成零特异性** `:where(.game-sudoku[data-theme='…'])`，这样宿主任何真实选择器
   （`.game-sudoku{…}` 或 inline style）都盖得住。自定义属性是就近解析的，元素自身声明优先于
   从 `:root` 继承的值——所以**文档要一直写明"覆盖别写在 `:root`"**，这是宿主第一个会踩的坑。
4. **配色改动按 WCAG 2.1 逐对实测**，不要靠肉眼：数字与笔记这类小字号按 4.5:1 判，
   大标题按 3:1；两套底色（给定淡底 / 玩家色块）之间按非文本对比 ≥3:1。
   区分题面数字与玩家数字**不能只靠字色**（同一张浅底上两个都过 4.5:1 的颜色彼此最多差
   约 1.28:1），也不能只靠字重（Android Roboto 没有 800，会落回 700）。

`auto`（跟随系统）不在 CSS 里，归适配层 / 宿主用 `matchMedia` 解析后写 `data-theme`；
档位本身存在引擎（`GameState.theme`）与独立键 `game-sudoku:theme`，**不进对局存档、不进
undo 历史**。

## 提交风格 · Commits

- **每个 commit 必须 GPG-signed**（本仓库依赖全局 `commit.gpgsign=true`）。
- 走 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)：`type(scope): 中文描述`，
  `type` ∈ feat/fix/chore/refactor/docs/perf/test，`scope` 用包名（core/vue/react/playground/ci/release）。
- 提交后**不自行 push、不自行打 tag**，等维护者指示。

## 版本与发布 · Versioning & release

三包版本 **lockstep**。npm 可信发布者无法发某个包的第一个版本，故：

1. **首版手工 seed**：npm 可信发布者无法发某个包的第一个版本，所以首版走手工
   `npm publish --access public`。若首版是占位号（本仓库当年是 `0.0.0-stage`），
   **必须带 `--tag <dist-tag>`**，否则发布那一刻 `latest` 就指向它。
   见根 README「发布流程（含踩过的坑）」——里面也更正了一条旧说法：`0.0.0-stage`
   并不会被 registry 以 `403` 拒（它实际发成功了），真正的坑是没带 tag。
2. 在 npmjs 为三包登记 Trusted Publisher → `my-gam/sudoku` + `publish.yml` + environment `npm`。
3. 之后正式版本：bump 三包 `version` 到同一 semver → 跑全部门禁（含 playground 与 `pages.mjs`
   两条，见上面「门禁」）→ `chore(release): vX.Y.Z` 签名提交 → 在该提交上 `git tag -s vX.Y.Z`
   → **由维护者明确指示后** push tag 触发 `publish.yml` 全自动发。已实证：`v0.1.0` 经
   OIDC Trusted Publishing 发出，带 provenance，零 secret。

**红线：tag 一旦 push 就真的发包。** 绝不自行打/推 tag。
