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

test('嵌合/孕中孕标签已随多父系功能移除：字段在也会被白名单丢弃', () => {
  const tags = deriveFetusTags({ fathers: '凯', tags: ['chimera', 'nested', 'identical'] }, { carrierName: '艾拉' });
  assert.ok(!tags.includes('chimera'));
  assert.ok(!tags.includes('nested'));
  assert.ok(tags.includes('identical'), '目录内标签照常保留');
});

test('代孕：遗传母方不是承载者', () => {
  const tags = deriveFetusTags(
    { fathers: '凯', provider: '琪拉', providerSources: ['琪拉'] },
    { carrierName: '贝拉' },
  );
  assert.ok(tags.includes('surrogacy'));
});

test('自己怀自己的卵不算代孕', () => {
  const tags = deriveFetusTags(
    { fathers: '凯', provider: '艾拉', providerSources: ['艾拉'] },
    { carrierName: '艾拉' },
  );
  assert.ok(!tags.includes('surrogacy'));
});

test('自交：父方就是遗传母方', () => {
  const tags = deriveFetusTags({ fathers: '艾拉' }, { carrierName: '艾拉' });
  assert.ok(tags.includes('selfing'));
});

test('代孕情境下的自交比对的是遗传母方，不是承载者', () => {
  const surrogate = deriveFetusTags(
    { fathers: '琪拉', provider: '琪拉', providerSources: ['琪拉'] },
    { carrierName: '贝拉' },
  );
  assert.deepEqual(surrogate.sort(), ['selfing', 'surrogacy'].sort());
  // 父方等于承载者但不等于遗传母方：那是普通的代孕，不是自交
  const notSelfing = deriveFetusTags(
    { fathers: '贝拉', provider: '琪拉', providerSources: ['琪拉'] },
    { carrierName: '贝拉' },
  );
  assert.ok(!notSelfing.includes('selfing'));
});

test('父方未知不会被误判成自交', () => {
  const tags = deriveFetusTags({ fathers: '未知' }, { carrierName: '未知' });
  assert.deepEqual(tags, []);
});

test('落盘标签与推导标签合并去重并按目录排序', () => {
  const fetus = { fathers: '艾拉', tags: ['identical', 'selfing'] };
  const tags = deriveFetusTags(fetus, { carrierName: '艾拉' });
  assert.deepEqual(tags, ['selfing', 'identical']);
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

test('目录不再收录多父系标签；纯爱向标签齐全', () => {
  const ids = FETUS_TAG_CATALOG.map((tag) => tag.id);
  for (const kept of ['surrogacy', 'selfing', 'identical', 'rebirth', 'superfetation']) {
    assert.ok(ids.includes(kept), `${kept} 应在目录中`);
  }
  for (const removed of ['chimera', 'nested', 'androgenesis', 'gynogenesis']) {
    assert.ok(!ids.includes(removed), `${removed} 已移除，不应在目录中`);
  }
  assert.deepEqual(getFetusTagLabels(['rebirth', 'superfetation']), ['胎内回归', '异期复孕']);
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
    fathers: '艾拉',
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
  // 自交是推导出来的：孩子记录不存这个标签，读的时候照样算得出来
  assert.deepEqual(
    deriveFetusTags(child, { carrierName: '艾拉' }).sort(),
    ['identical', 'selfing'].sort(),
  );
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
