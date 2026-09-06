// 激素画像层：阶段 → 情绪/行为/身体/心理的纯派生投影。
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HORMONE_PHASE_CATALOG,
  buildHormoneContextBlock,
  describeHormonePhases,
  formatStageProgress,
  getHormonePhaseKey,
} from '../scripts/hormone_context.js';
import {
  LABOR_STAGES,
  PREGNANCY_STAGES,
} from '../scripts/stage_config.js';
import { buildMainFlowStatePrompt, buildTrackerSystemPrompt } from '../scripts/tracker_prompt_context.js';

function makeCharacter(name, stage, days = 0, extra = {}) {
  return {
    name,
    initialized: true,
    profile: {
      base: { stage, days, age: 28, isHere: true, ...extra.base },
      pregnant: { effectivePregnantDays: 168, fetuses: [], ...extra.pregnant },
      metabolism: { milk: 30 },
      experience: { ...extra.experience },
      psychology: { ...extra.psychology },
      ...extra.profile,
    },
  };
}

test('目录覆盖所有阶段常量与特殊阶段，且演出画像四维齐备（完整性）', () => {
  const required = [
    '卵泡期早',
    '卵泡期晚',
    '排卵期',
    '黄体期早',
    '黄体期晚',
    '月经初期',
    '月经后期',
    ...PREGNANCY_STAGES,
    '产兆前驱',
    ...LABOR_STAGES,
    '产后恢复',
    '哺乳期',
    '围绝经期早期',
    '围绝经期晚期',
    '停经',
    '无经期',
    '未激活',
  ];
  for (const key of required) {
    const entry = HORMONE_PHASE_CATALOG[key];
    assert.ok(entry && typeof entry.summary === 'string' && entry.summary.length > 0, `目录缺少 ${key}`);
    if (key === '未激活') continue; // 未激活没有可演的内容
    assert.ok(entry.mood && entry.behavior && entry.body, `${key} 缺少情绪/行为/身体维`);
    assert.ok(typeof entry.psy === 'string', `${key} 缺少心理写入倾向`);
  }
});

test('分带边界：黄体期 PMS 窗口 4 天；卵泡期/月经期按半程分早晚', () => {
  assert.equal(getHormonePhaseKey('黄体期', 8, 12), '黄体期早');
  assert.equal(getHormonePhaseKey('黄体期', 9, 12), '黄体期晚');
  // 卵泡期 limit 9：半程 4.5，day 4 早、day 5 晚
  assert.equal(getHormonePhaseKey('卵泡期', 4, 9), '卵泡期早');
  assert.equal(getHormonePhaseKey('卵泡期', 5, 9), '卵泡期晚');
  // 月经期 limit 5：半程 2.5，day 2 初期、day 3 后期
  assert.equal(getHormonePhaseKey('月经期', 2, 5), '月经初期');
  assert.equal(getHormonePhaseKey('月经期', 3, 5), '月经后期');
  // 其他阶段原样返回
  assert.equal(getHormonePhaseKey('哺乳期', 100, 180), '哺乳期');
  assert.equal(getHormonePhaseKey('停经', 400, 0), '停经');
  assert.equal(getHormonePhaseKey('围绝经期晚期', 3, 7), '围绝经期晚期');
});

test('formatStageProgress：各阶段格式（含停经年换算）', () => {
  assert.equal(formatStageProgress({ base: { stage: '黄体期', days: 4 } }), '黄体期 第5/12天');
  assert.equal(formatStageProgress({ base: { stage: '黄体期', days: 10 } }), '黄体期 第11/12天（晚段/PMS）');
  assert.equal(formatStageProgress({ base: { stage: '月经期', days: 0 } }), '月经期 第1/5天');
  assert.equal(formatStageProgress({ base: { stage: '孕中期', days: 10 }, pregnant: { effectivePregnantDays: 168 } }), '孕中期 孕第25/40周');
  assert.equal(formatStageProgress({ base: { stage: '产后恢复', days: 9 }, bio: { recoveryDays: 56 } }), '产后恢复 第10/56天');
  assert.equal(formatStageProgress({ base: { stage: '哺乳期', days: 40 } }), '哺乳期 第41天');
  assert.equal(formatStageProgress({ base: { stage: '围绝经期晚期', days: 3 } }), '围绝经期晚期 第4天');
  assert.equal(formatStageProgress({ base: { stage: '停经', days: 200 } }), '停经 200天（周期永久停止）');
  assert.equal(formatStageProgress({ base: { stage: '停经', days: 800 } }), '停经 2年+（周期永久停止）');
  assert.equal(formatStageProgress({ base: { stage: '第一产程' }, pregnant: { laborPhase: '活跃期' } }), '第一产程（活跃期）');
});

test('buildHormoneContextBlock：进度行 + 演出指引三维 + 只列在场阶段 + 空态为空', () => {
  const empty = buildHormoneContextBlock({});
  assert.equal(empty, '');

  const block = buildHormoneContextBlock({
    existing_state: {
      艾拉: makeCharacter('艾拉', '黄体期', 10),
      贝拉: makeCharacter('贝拉', '哺乳期', 40),
    },
  });
  assert.match(block, /\[周期与激素状态\]/);
  assert.match(block, /艾拉：黄体期 第11\/12天（晚段\/PMS）/);
  assert.match(block, /贝拉：哺乳期 第41天/);
  // 共享演出指引：在场阶段的三维画像出现，不在场的（排卵期）不出现
  assert.match(block, /当期阶段演出指引/);
  assert.match(block, /◆ 黄体期晚——/);
  assert.match(block, /情绪：/);
  assert.match(block, /行为：/);
  assert.match(block, /身体：/);
  assert.match(block, /泌乳素主导/);
  assert.doesNotMatch(block, /雌激素峰值/);
  assert.match(block, /需求刻度/);
  // 性态度块随主流程注入
  assert.match(block, /\[性与避孕态度\]/);
  assert.match(block, /哺乳期闭经/);
});

test('mainflow prompt：晚黄体角色带 PMS 暗示，早黄体不带', () => {
  const latePayload = {
    existing_state: { 艾拉: makeCharacter('艾拉', '黄体期', 10) },
  };
  const latePrompt = buildMainFlowStatePrompt(latePayload);
  assert.match(latePrompt, /\[周期与激素状态\]/);
  assert.match(latePrompt, /PMS/);

  const earlyPayload = {
    existing_state: { 艾拉: makeCharacter('艾拉', '黄体期', 2) },
  };
  const earlyPrompt = buildMainFlowStatePrompt(earlyPayload);
  assert.doesNotMatch(earlyPrompt, /PMS/);
  assert.match(earlyPrompt, /孕激素主导/);
});

test('欲求档位：成年非产程角色随进度行附上，未成年与产程不附', () => {
  const block = buildHormoneContextBlock({
    existing_state: {
      艾拉: makeCharacter('艾拉', '排卵期', 0, { base: { libido: 70 } }),
      少女: makeCharacter('少女', '排卵期', 0, { base: { age: 15, libido: 70 } }),
      产妇: makeCharacter('产妇', '第一产程', 0, { base: { libido: 90 }, pregnant: { laborPhase: '潜伏期' } }),
      无欲: makeCharacter('无欲', '卵泡期', 0),
    },
  });
  assert.match(block, /艾拉：排卵期 第1\/2天｜欲求：心动不安/);
  assert.doesNotMatch(block, /少女：排卵期[^\n]*欲求/);
  assert.doesNotMatch(block, /产妇：[^\n]*欲求/);
  // libido 未定义时不附加
  assert.doesNotMatch(block, /无欲：[^\n]*欲求/);
});

test('孕程里程碑：不同孕龄给出对应的叙事钩子', () => {
  const quickening = buildHormoneContextBlock({
    existing_state: { 艾拉: makeCharacter('艾拉', '孕中期', 10, { pregnant: { effectivePregnantDays: 140 } }) },
  });
  assert.match(quickening, /· 孕程：孕第21周——初感胎动的窗口/);

  const nausea = buildHormoneContextBlock({
    existing_state: { 艾拉: makeCharacter('艾拉', '孕早期', 10, { pregnant: { effectivePregnantDays: 56 } }) },
  });
  assert.match(nausea, /· 孕程：孕第9周——孕吐与疲劳的高发窗/);

  const nonPregnant = buildHormoneContextBlock({
    existing_state: { 艾拉: makeCharacter('艾拉', '卵泡期', 2) },
  });
  assert.doesNotMatch(nonPregnant, /· 孕程/);
});

test('产后窗口：baby blues 高发窗按产后天数触发', () => {
  const blues = buildHormoneContextBlock({
    existing_state: { 艾拉: makeCharacter('艾拉', '产后恢复', 5) },
  });
  assert.match(blues, /· 产后：第6天——baby blues 窗口/);

  const early = buildHormoneContextBlock({
    existing_state: { 艾拉: makeCharacter('艾拉', '产后恢复', 1) },
  });
  assert.match(early, /· 产后：第2天——恶露高峰与初乳到来/);

  const late = buildHormoneContextBlock({
    existing_state: { 艾拉: makeCharacter('艾拉', '产后恢复', 45) },
  });
  assert.match(late, /42天产后检查/);
});

test('泌乳行：断奶倒计时与胀感档位', () => {
  const block = buildHormoneContextBlock({
    existing_state: {
      艾拉: makeCharacter('艾拉', '哺乳期', 40, { base: { daysSinceMilkRelief: 2, lactationDaysLeft: 12 } }),
    },
  });
  assert.match(block, /· 泌乳：距上次有效哺乳2天（明显胀满）；断奶窗口剩12天，持续哺乳会重置计时/);

  const engorged = buildHormoneContextBlock({
    existing_state: {
      艾拉: makeCharacter('艾拉', '哺乳期', 40, { base: { daysSinceMilkRelief: 5 } }),
    },
  });
  assert.match(engorged, /胀痛难忍/);

  const fresh = buildHormoneContextBlock({
    existing_state: {
      艾拉: makeCharacter('艾拉', '哺乳期', 0, { base: { daysSinceMilkRelief: 0 } }),
    },
  });
  assert.match(fresh, /刚哺乳\/排乳后，松软轻松/);
});

test('围绝经期早期：停经前 5 年的月经阶段角色由年龄触发（非阶段机阶段）', () => {
  const block = buildHormoneContextBlock({
    existing_state: { 中年艾拉: makeCharacter('中年艾拉', '卵泡期', 6, { base: { age: 42 } }) },
  });
  assert.match(block, /◆ 围绝经期早期——/);
  assert.match(block, /潮热夜汗说来就来/);

  const young = buildHormoneContextBlock({
    existing_state: { 艾拉: makeCharacter('艾拉', '卵泡期', 6, { base: { age: 28 } }) },
  });
  assert.doesNotMatch(young, /围绝经期早期/);

  // 停经后年龄再大也不触发（她已经是 停经 阶段）
  const post = buildHormoneContextBlock({
    existing_state: { 老艾拉: makeCharacter('老艾拉', '停经', 400, { base: { age: 47 } }) },
  });
  assert.doesNotMatch(post, /◆ 围绝经期早期/);
});

test('症状图例：只有带症状的角色出现时才列', () => {
  const withSymptom = buildHormoneContextBlock({
    existing_state: {
      艾拉: makeCharacter('艾拉', '孕中期', 10, {
        pregnant: { blockage: { key: 'hunger', severity: 0.4 } },
      }),
    },
  });
  assert.match(withSymptom, /当日症状含义/);
  assert.match(withSymptom, /孕吐恶心/);

  const withoutSymptom = buildHormoneContextBlock({
    existing_state: { 艾拉: makeCharacter('艾拉', '孕中期', 10) },
  });
  assert.doesNotMatch(withoutSymptom, /当日症状含义/);
});

test('tracker 系统 prompt 追加当期激素目录与心理写入倾向', () => {
  const prompt = buildTrackerSystemPrompt('', null, {
    existing_state: { 艾拉: makeCharacter('艾拉', '月经期', 0) },
  });
  assert.match(prompt, /\[当期激素阶段画像\]/);
  assert.match(prompt, /激素谷底/);
  assert.match(prompt, /心理写入：/);
  // 演出三维是主流程的东西，tracker 目录只给 summary + psy
  assert.doesNotMatch(prompt, /当期阶段演出指引/);
});

test('多胎提示只在有角色怀多胎时出现', () => {
  const block = buildHormoneContextBlock({
    existing_state: {
      艾拉: makeCharacter('艾拉', '孕中期', 10, {
        pregnant: { fetuses: [{}, {}] },
      }),
    },
  });
  assert.match(block, /多胎提示：艾拉/);

  const single = buildHormoneContextBlock({
    existing_state: { 艾拉: makeCharacter('艾拉', '孕中期', 10, { pregnant: { fetuses: [{}] } }) },
  });
  assert.doesNotMatch(single, /多胎提示/);
});

test('幕外角色仍显示进度但标注幕外，且不带派生行', () => {
  const block = buildHormoneContextBlock({
    existing_state: {
      艾拉: { ...makeCharacter('艾拉', '卵泡期', 3, { base: { libido: 70 } }), offscreen: true },
    },
  });
  assert.match(block, /艾拉：（幕外）卵泡期/);
  assert.doesNotMatch(block, /欲求：/);
});

test('性态度：排卵期+无措施+非婚姻关系 → 必须戴套', () => {
  const block = buildHormoneContextBlock({
    existing_state: {
      单身女: makeCharacter('单身女', '排卵期', 0, {
        experience: { latestSexPartner: '路人' },
      }),
    },
  });
  assert.match(block, /\[性与避孕态度\]/);
  assert.match(block, /最该坚持要戴套/);
});

test('性态度：排卵期+已婚 → 默认顺其自然', () => {
  const block = buildHormoneContextBlock({
    existing_state: {
      人妻: makeCharacter('人妻', '排卵期', 0, {
        experience: { marriageMate: '丈夫' },
      }),
    },
  });
  assert.match(block, /已婚未避孕：默认接受「顺其自然」/);
});

test('性态度：停经+有丈夫 → 无套自然', () => {
  const block = buildHormoneContextBlock({
    existing_state: {
      中年妻: makeCharacter('中年妻', '停经', 200, {
        experience: { marriageMate: '老张' },
      }),
    },
  });
  assert.match(block, /已停经\/近停经，自然受孕可能几乎为零/);
  assert.match(block, /与丈夫\/伴侣老张之间，无套内射是自然且无需商量的选择/);
  assert.match(block, /第二春/);
});

test('性态度：desire 高 + 稳定关系 → 排卵期想被内射', () => {
  const block = buildHormoneContextBlock({
    existing_state: {
      想要孩子的: makeCharacter('想要孩子的', '排卵期', 0, {
        experience: { emotionalMate: '男友' },
        psychology: { mens: { desire_value: 80 } },
      }),
    },
  });
  assert.match(block, /高受孕意愿/);
  assert.match(block, /希望被内射/);
});

test('性态度：未成年或年龄未知的角色不生成性语境行', () => {
  const block = buildHormoneContextBlock({
    existing_state: {
      少女: makeCharacter('少女', '排卵期', 0, {
        experience: { latestSexPartner: '路人' },
        base: { stage: '排卵期', days: 0, age: 15 },
      }),
      无年龄: {
        name: '无年龄', initialized: true,
        profile: {
          base: { stage: '排卵期', days: 0, isHere: true },
          pregnant: {}, metabolism: {}, experience: {},
        },
      },
      成年: makeCharacter('成年', '排卵期', 0, {
        experience: { latestSexPartner: '路人' },
      }),
    },
  });
  assert.match(block, /\[性与避孕态度\]/);
  // 年龄闸门只作用于性态度段；激素进度行照常显示所有角色
  const sexSection = block.split('[性与避孕态度]')[1] || '';
  assert.doesNotMatch(sexSection, /少女/);
  assert.doesNotMatch(sexSection, /无年龄/);
  assert.match(sexSection, /成年：/);
});

test('性态度：妊娠期角色即使无关系语境也拿到"舒适安全为先"兜底', () => {
  // 回归：旧实现用 stage === '妊娠中' 判断，而 stage 实际是孕早期/产程等具体值，
  // 兜底行从不触发——妊娠角色没有任何态度行。
  const block = buildHormoneContextBlock({
    existing_state: {
      孕妇: makeCharacter('孕妇', '孕中期', 20, {
        experience: {},
        base: { stage: '孕中期', days: 20, age: 26 },
      }),
    },
  });
  const sexSection = block.split('[性与避孕态度]')[1] || '';
  assert.match(sexSection, /妊娠中的性以彼此舒适与安全为先/);
  assert.match(sexSection, /妊娠中/);
});
