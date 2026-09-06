// 哺乳期：活产 → 产后恢复 → 哺乳期 → 卵泡期，闭经与乳意累积。
import assert from 'node:assert/strict';
import test from 'node:test';

import * as state from '../scripts/state.js';
import { applyToolCall } from '../scripts/tools.js';

function makeCharacter(name, overrides = {}) {
  return {
    name,
    initialized: true,
    profile: {
      base: {
        stage: '临产期', days: 0, race: '人类', vitality: 100, isHere: true,
        sperms: [], eggs: 0, libido: 20, uterinePressure: 0, psyStress: 50,
      },
      pregnant: {
        pregnantDays: 280, effectivePregnantDays: 280,
        fetusesCount: 1, fetuses: [makeFetus()], fetalEnergyDrain: 1,
        amnionDurability: 100,
      },
      bio: { birthDifficulty: 1, breedTolerance: 1, recoveryDays: 56, lactationDays: 45, menstrualLengthRatio: 1 },
      immune: {},
      metabolism: { excretion: 0, hunger: 0, sleep: 0, milk: 0, companionship: 0 },
      experience: {},
      children: [],
      notify: {},
      ...overrides,
    },
  };
}

function makeLactating(name, overrides = {}) {
  const character = makeCharacter(name);
  const profile = character.profile;
  profile.base.stage = '哺乳期';
  profile.base.days = 0;
  profile.pregnant = {
    pregnantDays: 0, effectivePregnantDays: 0,
    fetusesCount: 0, fetuses: [], fetalEnergyDrain: 0,
  };
  return character;
}

function makeFetus(overrides = {}) {
  return {
    fathers: '父', race: '人类', fatherRace: '人类',
    gender: '女', embryoType: '胎生', weight: 1, tendencyAngle: 0, affinity: 0,
    ...overrides,
  };
}

test('活产 → 产后恢复 → 哺乳期（pendingLactation 标记被消费）', () => {
  const chatState = state.createEmptyChatState();
  chatState.characters['艾拉'] = makeCharacter('艾拉');

  applyToolCall(chatState, { name: 'bsChildbirth', arguments: { female: '艾拉' } });
  assert.equal(chatState.characters['艾拉'].profile.base.stage, '产后恢复');
  assert.equal(chatState.characters['艾拉'].profile.base.pendingLactation, true, '分娩后应带哺乳标记');
  assert.equal(chatState.characters['艾拉'].profile.children.length, 1);

  // 恢复期 56 天 + 1 天越界（阶段切换的溢出天数丢弃，与原产后恢复语义一致）
  applyToolCall(chatState, { name: 'bsPassedTime', arguments: { day: 57 } });
  const base = chatState.characters['艾拉'].profile.base;
  assert.equal(base.stage, '哺乳期', '活产恢复完应进哺乳期');
  assert.equal(base.pendingLactation, undefined, '进哺乳期时标记应被消费');
  assert.equal(base.days, 0);
});

test('哺乳期超过 lactationDays → 回卵泡期且 milk 被跨周结算清零（自然离乳）', () => {
  const chatState = state.createEmptyChatState();
  chatState.characters['艾拉'] = makeLactating('艾拉');
  chatState.characters['艾拉'].profile.metabolism.milk = 80;

  // 断奶窗口 45 天（默认 lactationDays 语义已改为断奶窗口）
  applyToolCall(chatState, { name: 'bsPassedTime', arguments: { day: 46 } });
  // applyPassedTime 会替换 characters[name] 为新对象，断言必须取最新引用
  const profile = chatState.characters['艾拉'].profile;
  assert.equal(profile.base.stage, '卵泡期', '连续 46 天不哺乳应自然离乳回卵泡期');
  assert.equal(profile.metabolism.milk, 0, '离开哺乳期后周期型乳意应清零');
  assert.equal(profile.base.fertilizationDays, 0);
});

test('流产后的产后恢复不进哺乳期，直接回卵泡期', () => {
  const chatState = state.createEmptyChatState();
  chatState.characters['艾拉'] = makeCharacter('艾拉');

  applyToolCall(chatState, { name: 'bsAbortion', arguments: { female: '艾拉' } });
  assert.equal(chatState.characters['艾拉'].profile.base.stage, '产后恢复');
  assert.equal(chatState.characters['艾拉'].profile.base.pendingLactation, undefined, '流产不应设哺乳标记');

  applyToolCall(chatState, { name: 'bsPassedTime', arguments: { day: 57 } });
  assert.equal(chatState.characters['艾拉'].profile.base.stage, '卵泡期', '流产后恢复完直接回卵泡期');
});

test('哺乳期闭经：卵子不排出、受精不发生，但精子可保留', () => {
  const chatState = state.createEmptyChatState();
  chatState.characters['艾拉'] = makeLactating('艾拉');
  let profile = chatState.characters['艾拉'].profile;

  // bsAddSperm 应该正常生效（stageAllowsSpermRetention 含哺乳期）
  const addResult = applyToolCall(chatState, {
    name: 'bsAddSperm',
    arguments: { female: '艾拉', male: '父', amount: 30 },
  });
  assert.equal(addResult.applied, true);
  // bsAddSperm 同样会替换 characters 引用，重新取
  profile = chatState.characters['艾拉'].profile;
  assert.equal(profile.base.sperms.length, 1);

  // 推进 3 天：精子保留、衰减照常，但不排卵不受精
  applyToolCall(chatState, { name: 'bsPassedTime', arguments: { day: 3 } });
  profile = chatState.characters['艾拉'].profile;
  assert.equal(profile.base.eggs, 0, '哺乳期不应排出卵子');
  assert.equal(profile.pregnant.fetusesCount, 0, '哺乳期不应受精着床');
  assert.ok(profile.base.sperms.length === 0 || profile.base.sperms[0].value < 30, '精子照常衰减');
});

test('哺乳期乳意持续累积且高于日常速率', () => {
  const chatState = state.createEmptyChatState();
  chatState.characters['艾拉'] = makeLactating('艾拉');

  applyToolCall(chatState, { name: 'bsPassedTime', arguments: { day: 1 } });
  const profile = chatState.characters['艾拉'].profile;
  // 1.5 胎负荷 × 0.08/h ≈ 2.88/天
  assert.ok(profile.metabolism.milk > 2, `哺乳期乳意应累积，实际 ${profile.metabolism.milk}`);
});

test('syncCharacterStageFromProfile 保留哺乳期不被重置', () => {
  const chatState = state.createEmptyChatState();
  chatState.characters['艾拉'] = makeLactating('艾拉');
  chatState.characters['艾拉'].profile.base.days = 5;

  // 任意一次工具调用会触发 normalize/sync
  applyToolCall(chatState, { name: 'bsPassedTime', arguments: { minute: 1 } });
  const profile = chatState.characters['艾拉'].profile;
  assert.equal(profile.base.stage, '哺乳期', '白名单应保留哺乳期');
});

test('bsSetMenstrualPhases 接受哺乳期，且强制跳阶段清掉 pendingLactation', () => {
  const chatState = state.createEmptyChatState();
  chatState.characters['艾拉'] = makeLactating('艾拉');

  // 直接设为哺乳期
  const result = applyToolCall(chatState, {
    name: 'bsSetMenstrualPhases',
    arguments: { female: '艾拉', stage: '哺乳期' },
  });
  assert.equal(result.applied, true, result.message);
  assert.equal(chatState.characters['艾拉'].profile.base.stage, '哺乳期');

  // 分娩设了标记再强制跳走 → 标记应被清掉
  applyToolCall(chatState, { name: 'bsSetMenstrualPhases', arguments: { female: '艾拉', stage: '卵泡期' } });
  assert.equal(chatState.characters['艾拉'].profile.base.pendingLactation, undefined);
});

test('产后恢复期再孕：着床时清 pendingLactation，流产后出口走卵泡期', () => {
  const chatState = state.createEmptyChatState();
  chatState.characters['艾拉'] = makeCharacter('艾拉');

  // 分娩 → 产后恢复（带标记）
  applyToolCall(chatState, { name: 'bsChildbirth', arguments: { female: '艾拉' } });
  let profile = chatState.characters['艾拉'].profile;
  assert.equal(profile.base.pendingLactation, true);

  // 恢复期受孕：加精 + 排卵期 + 推进到着床
  applyToolCall(chatState, { name: 'bsAddSperm', arguments: { female: '艾拉', male: '新伴侣', amount: 30 } });
  applyToolCall(chatState, { name: 'bsSetMenstrualPhases', arguments: { female: '艾拉', stage: '排卵期' } });
  profile.base.eggs = 3;
  // 受精成功率强制成功
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    applyToolCall(chatState, { name: 'bsPassedTime', arguments: { day: 8 } });
  } finally {
    Math.random = originalRandom;
  }
  // 着床 → 孕早期，标记被清（新妊娠＝断奶）
  profile = chatState.characters['艾拉'].profile;
  assert.equal(profile.base.stage, '孕早期', '恢复期再孕应正常着床');
  assert.equal(profile.base.pendingLactation, undefined, '着床时应清掉哺乳标记');

  // 这场妊娠流产后：恢复期结束直接回卵泡期，不会进哺乳期
  applyToolCall(chatState, { name: 'bsAbortion', arguments: { female: '艾拉' } });
  profile = chatState.characters['艾拉'].profile;
  assert.equal(profile.base.stage, '产后恢复');
  assert.equal(profile.base.pendingLactation, undefined);
  applyToolCall(chatState, { name: 'bsPassedTime', arguments: { day: 60 } });
  profile = chatState.characters['艾拉'].profile;
  assert.equal(profile.base.stage, '卵泡期', '再流产的恢复期不应进哺乳期');
});

test('lactationDays 现在是断奶窗口：可配置缩短后更早离乳', () => {
  const chatState = state.createEmptyChatState();
  chatState.characters['艾拉'] = makeLactating('艾拉');
  chatState.characters['艾拉'].profile.bio.lactationDays = 10;

  applyToolCall(chatState, { name: 'bsPassedTime', arguments: { day: 11 } });
  assert.equal(chatState.characters['艾拉'].profile.base.stage, '卵泡期', '断奶窗口 10 天应在第 11 天离乳');
});

test('用进废退：规律哺乳（乳意缓解≥10）会重置断奶计时，哺乳期不结束', () => {
  const chatState = state.createEmptyChatState();
  chatState.characters['艾拉'] = makeLactating('艾拉');

  // 模拟 60 天规律哺乳：每 5 天排乳一次（乳意累积后用 bsExcreteMetabolism 缓解）
  for (let cycle = 0; cycle < 12; cycle += 1) {
    applyToolCall(chatState, { name: 'bsPassedTime', arguments: { day: 5 } });
    let profile = chatState.characters['艾拉'].profile;
    profile.metabolism.milk = 40; // 直接设高值保证缓解量 ≥10
    applyToolCall(chatState, {
      name: 'bsExcreteMetabolism',
      arguments: { female: '艾拉', options: { milk: 30 } },
    });
    profile = chatState.characters['艾拉'].profile;
    assert.equal(profile.base.daysSinceMilkRelief, 0, `第 ${cycle + 1} 次哺乳后断奶计时应归零`);
    assert.equal(profile.base.stage, '哺乳期', '规律哺乳期不应结束');
  }
  // 60 天过去（超过任何旧版 45 天上限），仍在哺乳期
  assert.equal(chatState.characters['艾拉'].profile.base.stage, '哺乳期');
});

test('断奶计时从最后一次哺乳起算：哺乳后 45 天不哺乳才离乳', () => {
  const chatState = state.createEmptyChatState();
  chatState.characters['艾拉'] = makeLactating('艾拉');

  // 先哺乳 30 天（每天），断奶计时恒为 0
  applyToolCall(chatState, { name: 'bsPassedTime', arguments: { day: 30 } });
  let profile = chatState.characters['艾拉'].profile;
  profile.metabolism.milk = 40;
  applyToolCall(chatState, { name: 'bsExcreteMetabolism', arguments: { female: '艾拉', options: { milk: 30 } } });

  // 然后停止哺乳 46 天 → 离乳
  applyToolCall(chatState, { name: 'bsPassedTime', arguments: { day: 46 } });
  profile = chatState.characters['艾拉'].profile;
  assert.equal(profile.base.stage, '卵泡期', '停止哺乳超过断奶窗口后应离乳');
});
