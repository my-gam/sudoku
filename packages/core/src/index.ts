/**
 * @my-games/sudoku-core —— `0.0.0-stage` 占位实现。
 *
 * 这是一个「空包」骨架：目的仅是把 monorepo 的
 * `build → verify:dist → typecheck → test` 门禁与 npm Trusted Publisher 链路跑通，
 * 好让首版（可信发布者无法发某包的第一个版本）能先手工种进 registry。
 *
 * 真实数独引擎 —— 棋盘校验、回溯求解器、唯一解题生成、`Sudoku` 状态机
 * （选格/填数/擦除/笔记/提示/撤销/计时）、注入式存档与最佳用时 —— 已在占位包
 * 发布前按同一三层结构写好并暂存，待 `0.0.0-stage` 上线后作为后续提交补回。
 */

/** 包标识占位。 */
export const SUDOKU_PACKAGE = 'sudoku-core' as const;

/** 占位版本，与 package.json 的 version 对齐，便于确认发的是 stage 包。 */
export const SUDOKU_STAGE = '0.0.0-stage' as const;
