// 激素画像层：阶段 → 情绪/行为暗示的纯派生投影。
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
  MENSTRUAL_STAGES,
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

test('目录覆盖所有阶段常量与特殊阶段（完整性）', () => {
  const required = [
    ...MENSTRUAL_STAGES.filter((stage) => stage !== '黄体期'),
    '黄体期早',
    '黄体期晚',
    ...PREGNANCY_STAGES,
    '产兆前驱',
    ...LABOR_STAGES,
    '产后恢复',
    '哺乳期',
    '假孕期',
    '回归期',
    '围绝经期早期',
    '围绝经期晚期',
    '停经',
    '无经期',
    '未激活',
  ];
  for (const key of required) {
    assert.ok(typeof HORMONE_PHASE_CATALOG[key] === 'string' && HORMONE_PHASE_CATALOG[key].length > 0, `目录缺少 ${key}`);
  }
});

test('黄体期分带边界：limit 12 时 day 8 仍早段、day 9 起晚段（PMS 窗口 4 天）', () => {
  assert.equal(getHormonePhaseKey('黄体期', 8, 12), '黄体期早');
  assert.equal(getHormonePhaseKey('黄体期', 9, 12), '黄体期晚');
  assert.equal(getHormonePhaseKey('黄体期', 11, 12), '黄体期晚');
  // 其他阶段原样返回
  assert.equal(getHormonePhaseKey('月经期', 4, 5), '月经期');
  assert.equal(getHormonePhaseKey('哺乳期', 100, 180), '哺乳期');
  assert.equal(getHormonePhaseKey('停经', 400, 0), '停经');
  assert.equal(getHormonePhaseKey('围绝经期晚期', 3, 7), '围绝经期晚期');
});

test('formatStageProgress：各阶段格式', () => {
  assert.equal(formatStageProgress({ base: { stage: '黄体期', days: 4 } }), '黄体期 第5/12天');
  assert.equal(formatStageProgress({ base: { stage: '黄体期', days: 10 } }), '黄体期 第11/12天（晚段/PMS）');
  assert.equal(formatStageProgress({ base: { stage: '月经期', days: 0 } }), '月经期 第1/5天');
  assert.equal(formatStageProgress({ base: { stage: '孕中期', days: 10 }, pregnant: { effectivePregnantDays: 168 } }), '孕中期 孕第25/40周');
  assert.equal(formatStageProgress({ base: { stage: '产后恢复', days: 9 }, bio: { recoveryDays: 56 } }), '产后恢复 第10/56天');
  assert.equal(formatStageProgress({ base: { stage: '哺乳期', days: 40 } }), '哺乳期 第41天');
  assert.equal(formatStageProgress({ base: { stage: '围绝经期晚期', days: 3 } }), '围绝经期晚期 第4天');
  assert.equal(formatStageProgress({ base: { stage: '停经', days: 200 } }), '停经 200天（周期永久停止）');
  assert.equal(formatStageProgress({ base: { stage: '假孕期', days: 20 } }), '假孕期 第21天');
  assert.equal(formatStageProgress({ base: { stage: '第一产程' }, pregnant: { laborPhase: '活跃期' } }), '第一产程（活跃期）');
});

test('buildHormoneContextBlock：只列在场阶段 + 进度行 + 空态为空', () => {
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
  // 只有在场阶段进入目录：PMS 与哺乳期画像都出现，但没出现排卵期
  assert.match(block, /PMS 窗口/);
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

test('tracker 系统 prompt 追加当期激素目录', () => {
  const prompt = buildTrackerSystemPrompt('', null, {
    existing_state: { 艾拉: makeCharacter('艾拉', '月经期', 0) },
  });
  assert.match(prompt, /\[当期激素阶段画像\]/);
  assert.match(prompt, /激素谷底/);
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

test('幕外角色仍显示进度但标注幕外', () => {
  const block = buildHormoneContextBlock({
    existing_state: {
      艾拉: { ...makeCharacter('艾拉', '卵泡期', 3), offscreen: true },
    },
  });
  assert.match(block, /艾拉：（幕外）卵泡期/);
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
