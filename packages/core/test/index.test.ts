import { describe, expect, it } from 'vitest';
import { SUDOKU_PACKAGE, SUDOKU_STAGE } from '../src/index';

/**
 * 空骨架占位测试：唯一目的是让 `pnpm test` 门禁真的跑起来且非空跑
 * （模板缺陷④：无 test 脚本的包会被 pnpm -r 静默跳过，只看退出码不足以证明测过）。
 * 数独引擎单测（board/solver/generator/game/storage）随后续提交补回。
 */
describe('sudoku-core 占位', () => {
  it('导出占位标识', () => {
    expect(SUDOKU_PACKAGE).toBe('sudoku-core');
    expect(SUDOKU_STAGE).toBe('0.0.0');
  });
});
