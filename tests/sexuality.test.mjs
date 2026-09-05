// 性爱观与癖好画像：慢层特质（注册时定，工具只读）与其提示词投影。
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SEXUALITY_FIELDS,
  buildSexualityRegistryGuideLines,
  createDefaultSexuality,
  describeSexualityLines,
  formatSexualitySummary,
  normalizeSexualityState,
} from '../scripts/sexuality_config.js';
import { buildHormoneContextBlock } from '../scripts/hormone_context.js';
import { buildRegistrySystemPrompt, applyRegistryResult } from '../scripts/registry.js';
import { createEmptyChatState, createDefaultFemaleState } from '../scripts/state.js';

function makeCharacter(name, stage, extra = {}) {
  return {
    name,
    initialized: true,
    profile: {
      base: { stage, days: 0, age: 28, isHere: true, ...extra.base },
      pregnant: { fetuses: [] },
      metabolism: {},
      experience: { ...extra.experience },
      psychology: extra.psychology === null ? undefined : { mens: {}, ...extra.psychology },
      sexuality: extra.sexuality,
    },
  };
}

test('normalizeSexualityState：未知枚举键丢弃、自由文本裁长、非对象归默认', () => {
  const normalized = normalizeSexualityState({
    intimacyNeed: 'love_only',
    initiative: '主导',            // 中文标签不是合法键
    varietyTaste: 'nonexistent',   // 不存在的键
    contraceptionStyle: 'pill',
    note: `  多余  空白 ${'长'.repeat(80)}`,
  });
  assert.equal(normalized.intimacyNeed, 'love_only');
  assert.equal(normalized.initiative, '', '中文标签应被丢弃而不是写入');
  assert.equal(normalized.varietyTaste, '', '未知键应被丢弃');
  assert.equal(normalized.contraceptionStyle, 'pill');
  assert.equal(normalized.note.length, 60, 'note 应裁到 60 字');
  assert.doesNotMatch(normalized.note, /  /, '连续空白应被折叠');

  assert.deepEqual(normalizeSexualityState(null), createDefaultSexuality());
  assert.deepEqual(normalizeSexualityState('love_only'), createDefaultSexuality());
  // 默认结构含所有字段，供用户在完整变量页发现并填写
  assert.deepEqual(Object.keys(createDefaultSexuality()), Object.keys(SEXUALITY_FIELDS));
});

test('describeSexualityLines：标签+解读，空画像不出行', () => {
  assert.deepEqual(describeSexualityLines(undefined), []);
  assert.deepEqual(describeSexualityLines(createDefaultSexuality()), []);

  const lines = describeSexualityLines({
    intimacyNeed: 'love_only',
    initiative: 'responsive',
    varietyTaste: 'plain',
    note: '喜欢事后被抱着说话',
  });
  assert.equal(lines.length, 4);
  assert.match(lines[0], /· 性爱观（唯爱）：只与深爱且关系确认的人做/);
  assert.match(lines[1], /· 主被动（回应型）：不主动开场/);
  assert.match(lines[2], /· 花样偏好（舒服就好）/);
  assert.match(lines[3], /· 癖好补充：喜欢事后被抱着说话/);
});

test('避孕偏好与当前措施交叉解读', () => {
  const inEffect = describeSexualityLines({ contraceptionStyle: 'pill' }, { hasContraception: true });
  assert.match(inEffect[0], /口服避孕药/);
  assert.match(inEffect[0], /（当前措施生效中）/);

  // 吃药党漏服＝真风险，必须明说，否则模型只会看到「她吃药」就照写无套
  const lapsed = describeSexualityLines({ contraceptionStyle: 'pill' }, { hasContraception: false });
  assert.match(lapsed[0], /漏服或未续，这次内射的风险是真的/);

  const condom = describeSexualityLines({ contraceptionStyle: 'condom' }, { hasContraception: false });
  assert.match(condom[0], /（当前没有措施在生效）/);

  // 不避孕党没有「措施失效」的概念
  const natural = describeSexualityLines({ contraceptionStyle: 'none_natural' }, { hasContraception: false });
  assert.doesNotMatch(natural[0], /生效/);

  // psy 关闭（undefined）时不得凭空断言当前措施
  const psyOff = describeSexualityLines({ contraceptionStyle: 'condom' }, {});
  assert.doesNotMatch(psyOff[0], /生效/);
});

test('主被动行附当下自主值（慢层 vs 中层的张力）', () => {
  const lines = describeSexualityLines({ initiative: 'passive' }, { autonomyValue: 71 });
  assert.match(lines[0], /· 主被动（被动）/);
  assert.match(lines[0], /（当下自主 71\/100）/);

  const noPsy = describeSexualityLines({ initiative: 'passive' }, {});
  assert.doesNotMatch(noPsy[0], /当下自主/);
});

test('formatSexualitySummary：UI 单行摘要只取枚举标签', () => {
  assert.equal(formatSexualitySummary({
    intimacyNeed: 'love_only',
    initiative: 'responsive',
    varietyTaste: 'plain',
    contraceptionStyle: 'pill',
    note: '不进摘要',
  }), '唯爱 · 回应型 · 舒服就好 · 口服避孕药');
  assert.equal(formatSexualitySummary(createDefaultSexuality()), '');
  assert.equal(formatSexualitySummary(null), '');
});

test('主流程块：画像缩排在角色态度行之下', () => {
  const block = buildHormoneContextBlock({
    existing_state: {
      人妻: makeCharacter('人妻', '排卵期', {
        experience: { marriageMate: '丈夫' },
        psychology: { mens: { hasContraception: true, autonomy_value: 40 } },
        sexuality: { intimacyNeed: 'love_only', contraceptionStyle: 'pill' },
      }),
    },
  });
  assert.match(block, /\[性与避孕态度\]/);
  assert.match(block, /- 人妻：排卵期[\s\S]*?。\n  · 性爱观（唯爱）/);
  assert.match(block, /· 避孕偏好（口服避孕药）[^\n]*（当前措施生效中）/);
  // 块头说明要提到癖好画像的约束
  assert.match(block, /缩排行是该角色的长期癖好画像/);
});

test('主流程块：未成年不出画像、幕外不出画像', () => {
  const block = buildHormoneContextBlock({
    existing_state: {
      少女: makeCharacter('少女', '排卵期', {
        base: { age: 15 },
        sexuality: { intimacyNeed: 'casual' },
      }),
      幕外: { ...makeCharacter('幕外', '卵泡期', { sexuality: { intimacyNeed: 'casual' } }), offscreen: true },
      成年: makeCharacter('成年', '排卵期', { sexuality: { intimacyNeed: 'casual' } }),
    },
  });
  const sexSection = block.split('[性与避孕态度]')[1] || '';
  assert.doesNotMatch(sexSection, /少女/);
  assert.doesNotMatch(sexSection, /幕外/);
  assert.match(sexSection, /成年：/);
  // 只出现一次（成年那一份）
  assert.equal(sexSection.match(/· 性爱观（不在意）/g).length, 1);
});

test('主流程块：阶段未激活但有画像时仍输出该角色', () => {
  const block = buildHormoneContextBlock({
    existing_state: {
      新人: makeCharacter('新人', '未激活', { sexuality: { varietyTaste: 'elaborate' } }),
    },
  });
  assert.match(block, /- 新人：\n  · 花样偏好（热衷花样）/);
});

test('注册提示词含画像章节与枚举键，注册结果经白名单归一', () => {
  const prompt = buildRegistrySystemPrompt({ payload: { target_character: '露比' } }, { includeBreedingPsychology: true });
  assert.match(prompt, /【7\. 性爱观与癖好画像】/);
  assert.match(prompt, /【8\. 角色补充设定】/);
  assert.match(prompt, /7\. 性爱观与癖好画像：sexuality/, '填写清单也要点名 sexuality');
  assert.match(prompt, /love_only = 唯爱/);
  assert.match(prompt, /novelty_condom = 情趣套/);
  assert.match(prompt, /未成年角色（age < 18）整个 sexuality 对象省略/);
  assert.match(prompt, /"sexuality": \{/, 'JSON 结构模板需给出 sexuality 位置');
  // 关闭繁育心理时章节顺移一位，且画像不随心理一起被剥掉
  const noPsy = buildRegistrySystemPrompt({}, { includeBreedingPsychology: false });
  assert.match(noPsy, /【6\. 性爱观与癖好画像】/);
  assert.match(noPsy, /【7\. 角色补充设定】/);
  assert.doesNotMatch(noPsy, /【3\. 繁育心理】/);

  assert.ok(buildSexualityRegistryGuideLines().length > 10);

  const chatState = createEmptyChatState();
  applyRegistryResult(chatState, {
    name: '露比',
    profile: {
      sexuality: { intimacyNeed: 'affection_first', initiative: '瞎写', contraceptionStyle: 'novelty_condom' },
    },
  });
  const sexuality = chatState.characters['露比'].profile.sexuality;
  assert.equal(sexuality.intimacyNeed, 'affection_first');
  assert.equal(sexuality.initiative, '', '非法键不得落库');
  assert.equal(sexuality.contraceptionStyle, 'novelty_condom');
});

test('新角色默认带空画像结构（用户可在变量页直接填）', () => {
  const character = createDefaultFemaleState('新角色');
  assert.deepEqual(character.profile.sexuality, createDefaultSexuality());
});
