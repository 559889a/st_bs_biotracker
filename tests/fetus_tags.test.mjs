import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FETUS_TAG_CATALOG,
  deriveFetusTags,
  describeFetusTags,
  getFetusTagLabels,
  sanitizeFetusTagList,
} from '../scripts/fetus_tags.js';

test('一般妊娠没有任何标签', () => {
  const tags = deriveFetusTags({ fathers: '凯' }, { carrierName: '艾拉' });
  assert.deepEqual(tags, []);
});

test('多父系/第三方生殖标签已移除：字段在也会被白名单丢弃', () => {
  const tags = deriveFetusTags({
    fathers: '凯',
    provider: '琪拉',
    tags: ['chimera', 'nested', 'surrogacy', 'selfing', 'rebirth', 'identical'],
  }, { carrierName: '艾拉' });
  for (const removed of ['chimera', 'nested', 'surrogacy', 'selfing', 'rebirth']) {
    assert.ok(!tags.includes(removed), `${removed} 应被白名单丢弃`);
  }
  assert.ok(tags.includes('identical'), '目录内标签照常保留');
});

test('fathers 未知时不产生任何标签', () => {
  const tags = deriveFetusTags({ fathers: '未知' }, { carrierName: '未知' });
  assert.deepEqual(tags, []);
});

test('落盘标签去重并按目录排序', () => {
  const fetus = { fathers: '凯', tags: ['superfetation', 'identical', 'identical'] };
  const tags = deriveFetusTags(fetus, { carrierName: '艾拉' });
  assert.deepEqual(tags, ['identical', 'superfetation']);
});

test('未收录的标签一律丢弃', () => {
  assert.deepEqual(sanitizeFetusTagList(['identical', 'not_a_real_tag', '']), ['identical']);
  assert.deepEqual(sanitizeFetusTagList('identical'), []);
});

test('标签目录的 id 唯一，且每一项都有 label 与 short', () => {
  const ids = FETUS_TAG_CATALOG.map((tag) => tag.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const tag of FETUS_TAG_CATALOG) {
    assert.ok(tag.label, `${tag.id} 缺 label`);
    assert.ok(tag.short, `${tag.id} 缺 short`);
  }
});

test('提示词只描述本轮出现过的标签', () => {
  const lines = describeFetusTags(['identical']);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /identical/);
  assert.deepEqual(describeFetusTags([]), []);
  assert.deepEqual(describeFetusTags(['not_a_real_tag']), []);
});

test('目录只保留纯爱向标签', () => {
  const ids = FETUS_TAG_CATALOG.map((tag) => tag.id);
  assert.deepEqual(ids.sort(), ['identical', 'superfetation']);
  assert.deepEqual(getFetusTagLabels(['superfetation']), ['异期复孕']);
});

// ── 落盘路径：白名单式清洗只要漏列新栏位，标签就会静默消失，整个机制等于没做
import * as state from '../scripts/state.js';
import { applyToolCall } from '../scripts/tools.js';

function makePregnant(name, fetuses) {
  return {
    name,
    initialized: true,
    profile: {
      base: { stage: '孕晚期', days: 0, race: '人类', vitality: 100 },
      pregnant: {
        pregnantDays: 240,
        effectivePregnantDays: 240,
        fetusesCount: fetuses.length,
        fetalEnergyDrain: 1,
        amnionDurability: 100,
        fetuses,
      },
      bio: { birthDifficulty: 1, breedTolerance: 1 },
      immune: {},
      metabolism: {},
      children: [],
      notify: {},
    },
  };
}

test('落盘标签与 identicalGroup 熬得过一次时间推进', () => {
  const chatState = state.createEmptyChatState();
  chatState.characters['艾拉'] = makePregnant('艾拉', [{
    embryoId: 1,
    fathers: '凯',
    race: '人类',
    gender: '女',
    embryoType: '胎生',
    weight: 1,
    tendencyAngle: 0,
    affinity: 0,
    tags: ['identical'],
    identicalGroup: 1,
  }]);

  const result = applyToolCall(chatState, { name: 'bsPassedTime', arguments: { hour: 1 } });
  assert.equal(result.applied, true);
  const fetus = chatState.characters['艾拉'].profile.pregnant.fetuses[0];
  assert.deepEqual(fetus.tags, ['identical']);
  assert.equal(fetus.identicalGroup, 1);
});

test('分娩时标签跟着孩子记录一起留下来', () => {
  const chatState = state.createEmptyChatState();
  chatState.characters['艾拉'] = makePregnant('艾拉', [{
    embryoId: 1,
    fathers: '凯',
    race: '人类',
    gender: '女',
    embryoType: '胎生',
    weight: 1,
    tendencyAngle: 0,
    affinity: 0,
    tags: ['identical'],
    identicalGroup: 1,
  }]);

  const result = applyToolCall(chatState, { name: 'bsChildbirth', arguments: { female: '艾拉' } });
  assert.equal(result.applied, true);
  const child = chatState.characters['艾拉'].profile.children[0];
  assert.deepEqual(child.tags, ['identical'], '落盘标签必须跟到孩子身上');
  assert.deepEqual(deriveFetusTags(child, { carrierName: '艾拉' }), ['identical']);
});

// ── 说明要送到写故事的主模型，不能只送给追踪器 ──────────────────
import { buildMainFlowStatePrompt, buildTrackerSystemPrompt } from '../scripts/tracker_prompt_context.js';

const payloadWith = (fetuses) => ({
  existing_state: { A: { name: 'A', profile: { pregnant: { fetuses } } } },
});

test('特殊胎儿出现时，主线状态提示词会附上来历说明', () => {
  const prompt = buildMainFlowStatePrompt(payloadWith([
    { fathers: '甲', race: '人类' },
    { fathers: '乙', race: '人类', conceivedAtDays: 60, revealed: true, tags: ['superfetation'] },
  ]));
  assert.match(prompt, /本轮出现的特殊胎儿来历/);
  assert.match(prompt, /superfetation/);
});

test('只有普通胎儿时主线提示词不多带一段', () => {
  const prompt = buildMainFlowStatePrompt(payloadWith([{ fathers: '甲', race: '人类' }]));
  assert.ok(!prompt.includes('特殊胎儿来历'), '没用到的标签不该占 token');
});

test('追踪器系统提示词同样只在标签出现时才解释', () => {
  const withTag = buildTrackerSystemPrompt('', null, payloadWith([
    { fathers: '甲', conceivedAtDays: 60, revealed: true, tags: ['superfetation'] },
  ]));
  assert.match(withTag, /本轮出现的胎儿标签/);
  const plain = buildTrackerSystemPrompt('', null, payloadWith([{ fathers: '甲' }]));
  assert.ok(!plain.includes('本轮出现的胎儿标签'));
});

test('异期复孕的说明强调晚受精与发育落后', () => {
  const [line] = describeFetusTags(['superfetation']);
  assert.match(line, /晚受精/);
  assert.match(line, /落后/);
});
