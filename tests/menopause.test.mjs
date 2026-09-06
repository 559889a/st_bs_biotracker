// 年龄判定与更年期：初潮前无周期、围绝经期晚期、停经、生育力衰退。
import assert from 'node:assert/strict';
import test from 'node:test';

import * as state from '../scripts/state.js';
import { applyToolCall } from '../scripts/tools.js';

function makeCharacter(name, overrides = {}) {
  const defaultBase = { stage: '卵泡期', days: 0, race: '人类', age: 25, vitality: 100, isHere: true, sperms: [], eggs: 0, libido: 20, uterinePressure: 0, psyStress: 50 };
  const defaultBio = { birthDifficulty: 1, breedTolerance: 1, recoveryDays: 56, lactationDays: 45, menstrualLengthRatio: 1, menarcheAge: 12, menopauseAge: 45 };
  return {
    name,
    initialized: true,
    profile: {
      base: { ...defaultBase, ...(overrides.base || {}) },
      pregnant: { pregnantDays: 0, effectivePregnantDays: 0, fetusesCount: 0, fetuses: [], fetalEnergyDrain: 0 },
      bio: { ...defaultBio, ...(overrides.bio || {}) },
      immune: {},
      metabolism: { excretion: 0, hunger: 0, sleep: 0, milk: 0, companionship: 0 },
      experience: { ...(overrides.experience || {}) },
      children: [],
      notify: {},
    },
  };
}

test('初潮前（age < menarcheAge）的月经阶段被强制为无经期', () => {
  const chatState = state.createEmptyChatState();
  chatState.characters['小满'] = makeCharacter('小满', { base: { stage: '黄体期', days: 3, age: 9 } });
  applyToolCall(chatState, { name: 'bsPassedTime', arguments: { day: 1 } });
  const base = chatState.characters['小满'].profile.base;
  assert.equal(base.stage, '无经期', '初潮前不应有周期');
  assert.equal(base.eggs, 0);
});

test('无经期少女到初潮年龄自动开始周期（初潮事件）', () => {
  const chatState = state.createEmptyChatState();
  chatState.characters['小满'] = makeCharacter('小满', { base: { stage: '无经期', days: 100, age: 11.9 } });
  applyToolCall(chatState, { name: 'bsPassedTime', arguments: { year: 1 } });
  const base = chatState.characters['小满'].profile.base;
  assert.equal(base.stage, '卵泡期', '到初潮年龄应转入卵泡期');
  // 跳了 1 年（365 天）> 卵泡期 9 天，周期已在推进（可能已轮转到后续阶段）
  assert.notEqual(base.stage, '无经期');
});

test('到停经年龄的周期角色被强制为停经', () => {
  const chatState = state.createEmptyChatState();
  chatState.characters['中年'] = makeCharacter('中年', { base: { stage: '黄体期', days: 3, age: 46 } });
  applyToolCall(chatState, { name: 'bsPassedTime', arguments: { day: 1 } });
  assert.equal(chatState.characters['中年'].profile.base.stage, '停经');
});

test('围绝经期晚期：42-45 岁的周期在月经期边界转入，到 45 转停经', () => {
  const chatState = state.createEmptyChatState();
  // 43 岁、正在黄体期末尾——推进到月经期边界时应转入围绝经期晚期
  chatState.characters['阿姨'] = makeCharacter('阿姨', { base: { stage: '黄体期', days: 11, age: 43 } });
  applyToolCall(chatState, { name: 'bsPassedTime', arguments: { day: 2 } });
  let base = chatState.characters['阿姨'].profile.base;
  assert.equal(base.stage, '围绝经期晚期', '42+ 岁的周期边界应转入围绝经期晚期');

  // 继续推进到 45 岁 → 停经
  applyToolCall(chatState, { name: 'bsPassedTime', arguments: { year: 3 } });
  base = chatState.characters['阿姨'].profile.base;
  assert.equal(base.stage, '停经', '到停经年龄应永久停经');
});

test('bio.menopauseAge 可配置：晚停经的门槛顺延', () => {
  const chatState = state.createEmptyChatState();
  chatState.characters['阿姨'] = makeCharacter('阿姨', {
    base: { stage: '黄体期', days: 3, age: 46 },
    bio: { menopauseAge: 52 },
  });
  applyToolCall(chatState, { name: 'bsPassedTime', arguments: { day: 1 } });
  // 46 < 52-3=49 → 不进晚期；也不停经；仍是周期（黄体期或已轮转的周期阶段）
  const stage = chatState.characters['阿姨'].profile.base.stage;
  assert.ok(['卵泡期', '排卵期', '黄体期', '月经期'].includes(stage), `46岁、停经52的角色应仍在周期内，实际 ${stage}`);
});

test('停经是永久阶段：时间推进不会离开', () => {
  const chatState = state.createEmptyChatState();
  chatState.characters['老年'] = makeCharacter('老年', { base: { stage: '停经', days: 300, age: 60 } });
  applyToolCall(chatState, { name: 'bsPassedTime', arguments: { year: 5 } });
  assert.equal(chatState.characters['老年'].profile.base.stage, '停经');
});

test('停经角色不排卵：bsAddSperm 留精但不受孕', () => {
  const chatState = state.createEmptyChatState();
  chatState.characters['老年'] = makeCharacter('老年', { base: { stage: '停经', days: 100, age: 55 } });
  const add = applyToolCall(chatState, { name: 'bsAddSperm', arguments: { female: '老年', male: '老王', amount: 30 } });
  assert.equal(add.applied, true);
  applyToolCall(chatState, { name: 'bsPassedTime', arguments: { day: 3 } });
  const profile = chatState.characters['老年'].profile;
  assert.equal(profile.base.eggs, 0, '停经不排卵');
  assert.equal(profile.pregnant.fetusesCount, 0, '停经不受孕');
});

test('bsSetMenstrualPhases 不能把停经角色切回周期', () => {
  const chatState = state.createEmptyChatState();
  chatState.characters['老年'] = makeCharacter('老年', { base: { stage: '停经', days: 100, age: 55 } });
  const result = applyToolCall(chatState, {
    name: 'bsSetMenstrualPhases',
    arguments: { female: '老年', stage: '排卵期' },
  });
  assert.equal(result.applied, false);
  assert.match(result.message, /永久阶段/);
});

test('围绝经期早期（40 岁左右）生育力衰退但非零：受孕概率被压低', () => {
  const chatState = state.createEmptyChatState();
  chatState.characters['阿姨'] = makeCharacter('阿姨', { base: { stage: '排卵期', days: 0, age: 43, eggs: 3 } });
  chatState.characters['阿姨'].profile.base.sperms = [{ male: '老王', race: '人类', value: 30 }];
  // 强制受精判定成功（Math.random → 0），但 chanceFactor 衰减后仍应可能成功
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    applyToolCall(chatState, { name: 'bsPassedTime', arguments: { day: 1 } });
  } finally {
    Math.random = originalRandom;
  }
  // 43 岁 factor ≈ 1 - (43-40)/5*0.95 = 0.43；random=0 < 0.43 → 受精成功
  const profile = chatState.characters['阿姨'].profile;
  assert.equal(profile.pregnant.fetuses.length, 1, '43 岁受孕概率已减半但random=0仍应成功');
});

test('44.5+ 岁生育力接近归零：random=0 也难以受孕', () => {
  const chatState = state.createEmptyChatState();
  chatState.characters['阿姨'] = makeCharacter('阿姨', { base: { stage: '排卵期', days: 0, age: 44.8, eggs: 3 } });
  chatState.characters['阿姨'].profile.base.sperms = [{ male: '老王', race: '人类', value: 30 }];
  const originalRandom = Math.random;
  Math.random = () => 0.5; // 高于 factor (~0.09)
  try {
    applyToolCall(chatState, { name: 'bsPassedTime', arguments: { day: 1 } });
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(chatState.characters['阿姨'].profile.pregnant.fetuses.length, 0, 'random 0.5 > 衰减后概率，不应受孕');
});

test('bio.menopauseAge 可配置：晚停经的门槛顺延', () => {
  const chatState = state.createEmptyChatState();
  chatState.characters['阿姨'] = makeCharacter('阿姨', {
    base: { stage: '黄体期', days: 3, age: 46 },
    bio: { birthDifficulty: 1, breedTolerance: 1, recoveryDays: 56, menstrualLengthRatio: 1, menarcheAge: 12, menopauseAge: 52 },
  });
  applyToolCall(chatState, { name: 'bsPassedTime', arguments: { day: 1 } });
  // 46 < 52-3=49 → 不进晚期；也不停经；仍是周期（黄体期或已轮转的周期阶段）
  const stage = chatState.characters['阿姨'].profile.base.stage;
  assert.ok(['卵泡期', '排卵期', '黄体期', '月经期'].includes(stage), `46岁、停经52的角色应仍在周期内，实际 ${stage}`);
});
