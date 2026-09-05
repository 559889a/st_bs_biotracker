// 注册页勾选的特殊胎儿来历：勾选转成给模型的提示词（同卵/异期复孕）。
// 胎内回归与代孕的「硬套」路径已随纯爱化改造移除。
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSpecialFetusNotes } from '../scripts/registry.js';

test('没勾任何一项时不追加提示词', () => {
  assert.equal(buildSpecialFetusNotes(null), '');
  assert.equal(buildSpecialFetusNotes({ hints: [] }), '');
});

test('勾选会转成给模型的指示', () => {
  const notes = buildSpecialFetusNotes({ hints: ['identical', 'superfetation'] });
  assert.match(notes, /同卵双胞胎/);
  assert.match(notes, /异期复孕/);
});

test('已移除的勾选不产生任何指示', () => {
  // 嵌合/孕中孕/胎内回归/代孕均已移除
  assert.equal(buildSpecialFetusNotes({ rebirth: '小明', surrogacy: 'B', hints: ['chimera', 'nested'] }), '');
});

test('未知的勾选被忽略', () => {
  assert.equal(buildSpecialFetusNotes({ hints: ['nope'] }), '');
});
