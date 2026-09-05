/**
 * 激素周期画像层：阶段 → 情绪/行为暗示的纯派生投影。
 *
 * 设计：不做任何持久化——所有内容从 base.stage / base.days / bio 实时推算，
 * 随 tracker 每轮处理完消息自动重建，与 fetus_tags.js 的「只解释当轮出现的
 * 标签」同一套 token 纪律：只描述在场角色当前所处的阶段。
 *
 * 个体差异不加敏感度旋钮：psy 三轴、vitality/psyStress 等级与角色卡本身
 * 已提供方差（设计决定，见计划）。
 *
 * 快层（本模块）回答「今天的激素让她像什么」；慢层（registry_psy_config
 * 的三轴，tracker 写）回答「她本来是什么样的人」。两层互补不互斥。
 */
import { LABOR_STAGES, MENSTRUAL_STAGES, PREGNANCY_STAGES } from './stage_config.js';

/** 黄体期晚段的 PMS 窗口：距阶段结束不足 4 天视为晚段 */
const LUTEAL_LATE_WINDOW_DAYS = 4;

/** 阶段 → 激素画像暗示。键为 getHormonePhaseKey 的输出。 */
export const HORMONE_PHASE_CATALOG = Object.freeze({
  卵泡期: '雌激素回升：情绪平稳上扬、精力恢复、状态渐佳，是周期里最「正常」的时段。',
  排卵期: '雌激素峰值：性欲顶点、魅力外放、主动大胆、体温微升；接近异性时的暗示与试探会自然增多。',
  黄体期早: '孕激素主导：平稳微懒、食欲增加、嗜睡、体温升高，身体进入「储备模式」。',
  黄体期晚: 'PMS 窗口（黄体期末段，激素开始回落）：情绪比平时敏感一些，容易烦躁或莫名低落，小事有点耐心不足；乳房微微胀痛、身体略沉，想吃点甜的。希望被稍微迁就一下，但整体还在可控范围内。',
  月经期: '激素谷底：疲惫腹痛、易怒低落、性欲低谷，想被呵护或想独处；注意力涣散、畏寒嗜甜。',
  孕早期: 'hCG 飙升：孕吐疲惫、嗅觉敏感、情绪多变（上一刻流泪下一刻大笑）、乳房胀痛。',
  孕中期: '激素平台期：孕吐消退、食欲旺盛、皮肤光泽、情绪安稳甚至愉悦，性欲回升；开始感知胎动。',
  孕晚期: '负担顶点：笨重腰酸、尿频失眠、假性宫缩；筑巢本能（收拾、准备婴儿用品）与对分娩的期待焦虑交织。',
  临产期: '入盆后轻松感与坠胀并存；宫缩前兆、见红可能，焦躁不安、反复确认身体状况。',
  逾期: '孕期满载：极度笨重不适、睡眠破碎、急切与担忧并行，随时可能发动。',
  产兆前驱: '不规则宫缩渐强、腰骶酸痛；精力反而上涌（肾上腺素），又慌又亢。',
  第一产程: '规律宫缩阶梯推进：疼痛从可忍到密集强烈，呼吸节奏被打断，意识开始向身体收窄。',
  第二产程: '剧痛与用力本能交叠：意识狭窄到近乎空白，只剩宫缩、坠胀与Push的冲动。',
  第三产程: '娩出后的骤然轻松与虚脱并存；如释重负，随即被对婴儿的急切关注接管。',
  产后恢复: '恶露虚脱、激素断崖式下跌：情绪跌宕（产后抑郁窗口），同时母爱开始萌发；夜间哺乳疲惫与被需要感交织。',
  哺乳期: '泌乳素主导：母爱外溢、哺乳时的亲密与安宁、对婴儿高度专注；情绪温柔而敏感，涨奶不排会烦躁。',
  假孕期: '孕激素欺骗：腹部隆起感、恶心嗜睡等「假象孕吐」、筑巢行为；情绪如孕早期般敏感多变。',
  围绝经期早期: '围绝经期开始（仍在周期内但走向终点）：周期忽长忽短、经量忽多忽少；潮热夜汗说来就来——半夜热醒掀被、白天突然一股燥热从胸口涌到脸。睡眠破碎、易怒与低落交替，性欲波动大；受孕能力已明显衰退但仍非绝对为零。',
  围绝经期晚期: '围绝经期晚期（周期已紊乱）：月经越来越稀、间隔越来越长，也许几个月才来一次，也许这次就是最后一次；潮热夜汗达到顶峰，情绪如坐过山车，阴道干涩初现；对「还能不能怀孕」的答案越来越接近「不能」，对衰老与自由的感受同时涌来。',
  停经: '停经（绝经后）：卵巢功能落幕，月经永久停止，自然受孕可能归零。潮热夜汗在停经头几年仍会袭来，随后逐年减轻；阴道干涩与润滑变慢是常态，需要更长的前戏与耐心；雌激素退场后雄激素相对占上风——部分女性迎来「第二春」，欲望更直接、更不为生育所困。身体进入不再被周期摆动的平稳与自由。',
  无经期: '周期停摆：没有月经的生理状态（用药、体质、初潮前或衰老），情绪不受周期摆动。',
  未激活: '尚未开始追踪，无周期数据。',
});

/**
 * 阶段 → 避孕/性态度的决策依据。
 * 关键设计：不替角色决定，而是把「生理事实 + 关系语境」摆给模型，
 * 让它自己推演出「这次戴不戴套」。AI 黄文惯性下模型几乎从不主动写避孕，
 * 必须显式喂给它这套逻辑（用户明确要求）。
 *
 * 关系语境从 experience 读：marriageMate（婚姻对象）、emotionalMate（情感对象）、
 * latestSexPartner（最近性对象）。意向从 psy 的 desire 轴与 hasContraception 旗标读：
 * - desire 高 + 无避孕措施 + 非婚姻关系 → 排卵期会主动要求戴套/避开危险日
 * - desire 高 + 婚姻/稳定关系 → 可能反过来「想要孩子」或接受无套
 * - 停经/初潮前 → 受孕风险归零，无套与否纯看关系卫生与信任
 */
export function buildSexualAttitudeBlock(existingState) {
  if (!existingState || typeof existingState !== 'object') return '';
  const lines = [];
  for (const [name, item] of Object.entries(existingState)) {
    if (item?.offscreen === true) continue;
    const base = item?.profile?.base || {};
    const experience = item?.profile?.experience || {};
    const psychology = item?.profile?.psychology || {};
    const stage = String(base.stage || '').trim();
    const displayName = String(item?.name || name);
    // 年龄闸门：性语境只对成年角色生成。年龄未知同样不放行——宁可漏一行，不给未成年角色挂性语境。
    const age = Number(base.age);
    if (!Number.isFinite(age) || age < 18) continue;
    const marriageMate = String(experience.marriageMate || '').trim();
    const emotionalMate = String(experience.emotionalMate || '').trim();
    const hasContraception = Boolean(psychology?.mens?.hasContraception);
    const desireValue = Number(psychology?.mens?.desire_value);
    const wantsBaby = Number.isFinite(desireValue) && desireValue >= 60;

    const facts = [];
    let riskLine = '';
    if (stage === '停经' || stage === '围绝经期晚期') {
      riskLine = '已停经/近停经，自然受孕可能几乎为零';
    } else if (stage === '无经期') {
      riskLine = '无经期，当前不会受孕';
    } else if (stage === '哺乳期') {
      riskLine = '哺乳期闭经，当前不会受孕（但持续断奶后周期就会恢复）';
    } else if (stage === '排卵期') {
      riskLine = '排卵期，受孕概率最高的窗口';
    } else if (MENSTRUAL_STAGES.includes(stage) || stage === '产后恢复') {
      riskLine = '周期内但非排卵窗口，受孕概率较低（非零）';
    } else if (stage === '假孕期') {
      riskLine = '假孕期，不会真实受孕';
    } else if (PREGNANCY_STAGES.includes(stage) || LABOR_STAGES.includes(stage) || stage === '产兆前驱') {
      riskLine = '妊娠中';
    }
    if (riskLine) facts.push(riskLine);

    // 关系语境
    const partner = marriageMate || emotionalMate;
    if (marriageMate) facts.push(`婚姻对象是${marriageMate}`);
    else if (emotionalMate) facts.push(`情感对象是${emotionalMate}`);

    // 避孕态度推导（描述给模型看，不是硬规则）
    const attitude = [];
    if (riskLine.includes('受孕可能几乎为零') || riskLine.includes('不会受孕') || riskLine.includes('不会真实受孕')) {
      attitude.push('怀孕风险已不是顾虑：是否无套取决于她对这段关系的信任与卫生习惯，而非避孕');
      if (marriageMate) attitude.push(`与丈夫/伴侣${marriageMate}之间，无套内射是自然且无需商量的选择`);
    } else if (stage === '排卵期') {
      if (wantsBaby && (marriageMate || emotionalMate)) {
        attitude.push('排卵期 + 高受孕意愿：她此刻可能正希望被内射、被留下孩子——哪怕嘴上不说');
      } else if (hasContraception) {
        attitude.push('排卵期 + 有稳定避孕措施：她在按计划避孕，性事照常但心里有底');
      } else if (marriageMate) {
        attitude.push('排卵期 + 已婚未避孕：默认接受「顺其自然」，内射意味着可能真的会怀上');
      } else {
        attitude.push('排卵期 + 无避孕措施：这是她最该坚持要戴套的时刻——除非剧情明确让她放弃克制；模型不应替她省略这一步');
      }
    } else if (riskLine.includes('概率较低')) {
      if (hasContraception) attitude.push('有稳定避孕措施，安全期心态下更容易接受无套');
      else if (marriageMate) attitude.push('已婚关系里，非排卵日的无套是常态');
      else attitude.push('非排卵日但无措施：她会用「安全期」说服自己，但残留的侥幸不安仍在');
    }
    if (attitude.length === 0 && stage === '妊娠中') {
      attitude.push('妊娠中的性以彼此舒适与安全为先');
    }

    if (facts.length > 0 || attitude.length > 0) {
      lines.push(`- ${displayName}：${[...facts, ...attitude].join('；')}。`);
    }
  }
  if (lines.length === 0) return '';
  return [
    '[性与避孕态度]',
    '以下是按角色当前生理阶段与关系状态推导的避孕/性行为态度参考；写亲密场景时必须把它纳入叙事——角色会不会要求戴套、会不会接受内射，取决于这里给出的语境，不要凭黄文惯性一律写无套。',
    ...lines,
  ].join('\n');
}

/** 把 (stage, days, limit) 映射到目录键。除黄体期分早晚段外，其余原样返回。 */
export function getHormonePhaseKey(stage, days = 0, limit = 0) {
  const key = String(stage || '').trim();
  if (key === '黄体期') {
    const numericDays = Math.max(0, Number(days) || 0);
    const numericLimit = Math.max(0, Number(limit) || 0);
    if (numericLimit > 0 && numericDays > numericLimit - LUTEAL_LATE_WINDOW_DAYS) return '黄体期晚';
    return '黄体期早';
  }
  return key;
}

/**
 * 阶段进度文本（人类可读），供 prompt 里直接理解「现在处于周期哪一点」。
 * 月经阶段按实际长度（ratio 不发，就用默认 28 天标尺）；
 * 妊娠按 0-280 标尺换算孕周；产后/哺乳按 bio 天数。
 */
export function formatStageProgress(profile = {}) {
  const base = profile?.base || {};
  const bio = profile?.bio || {};
  const pregnant = profile?.pregnant || {};
  const stage = String(base.stage || '').trim();
  const days = Math.max(0, Number(base.days) || 0);
  if (!stage) return '';

  if (MENSTRUAL_STAGES.includes(stage)) {
    const ratio = Math.max(0.1, Number(bio.menstrualLengthRatio) || 1);
    const defaults = { 卵泡期: 9, 排卵期: 2, 黄体期: 12, 月经期: 5 };
    const limit = Math.max(1, (defaults[stage] || 9) * ratio);
    const dayText = `第${Math.min(Math.floor(days) + 1, Math.ceil(limit))}/${Math.round(limit)}天`;
    return stage === '黄体期' && days > limit - LUTEAL_LATE_WINDOW_DAYS
      ? `${stage} ${dayText}（晚段/PMS）`
      : `${stage} ${dayText}`;
  }
  if (PREGNANCY_STAGES.includes(stage)) {
    const effective = Math.max(0, Number(pregnant.effectivePregnantDays) || 0);
    return `${stage} 孕第${Math.floor(effective / 7) + 1}/40周`;
  }
  if (stage === '产后恢复') {
    const limit = Math.max(1, Number(bio.recoveryDays) || 56);
    return `${stage} 第${Math.min(Math.floor(days) + 1, Math.ceil(limit))}/${Math.round(limit)}天`;
  }
  if (stage === '哺乳期') {
    // 用进废退：无界显示哺乳时长
    return `${stage} 第${Math.floor(days) + 1}天`;
  }
  if (stage === '围绝经期晚期') return `${stage} 第${Math.floor(days) + 1}天`;
  if (stage === '停经') return `停经 ${Math.floor(days)}天（周期永久停止）`;
  if (stage === '假孕期') return `${stage} 第${Math.floor(days) + 1}天`;
  if (LABOR_STAGES.includes(stage)) {
    const phase = String(pregnant.laborPhase || '').trim();
    return phase ? `${stage}（${phase}）` : stage;
  }
  return stage;
}

/** 代谢需求刻度图例（静态，一次列出阈值） */
const METABOLISM_LEVEL_LEGEND = '需求刻度（容量150，扩容200）：无<25≤低<50≤中<75≤高<100≤满<125≤爆。';

/** 症状含义蒸馏：与 tracker_prompt_context 的三张表同义，压缩成一行一条 */
const SYMPTOM_GLOSS = Object.freeze({
  blockage: {
    excretion: '阻塞·泄意＝便秘',
    hunger: '阻塞·饿意＝孕吐恶心、消化不良',
    sleep: '阻塞·困意＝失眠',
    milk: '阻塞·乳意＝乳房胀痛敏感',
    odor: '阻塞·臭意＝分泌物增生',
    companionship: '阻塞·伴意＝社交回避',
  },
  acceleration: {
    excretion: '快积·泄意＝频尿',
    hunger: '快积·饿意＝容易饿、奇特饮食偏好',
    sleep: '快积·困意＝晕眩嗜睡',
    milk: '快积·乳意＝乳意快升、溢乳',
    odor: '快积·臭意＝体温升高、容易排汗',
    companionship: '快积·伴意＝黏人',
  },
  expansion: {
    excretion: '扩容·泄意＝水肿、肠道慢蠕动',
    hunger: '扩容·饿意＝养分母体优先',
    milk: '扩容·乳意＝胸部沉重饱满',
    sleep: '扩容·困意＝激素使精力旺盛（代偿）',
    odor: '扩容·臭意＝孕妇香气',
    companionship: '扩容·伴意＝胎儿内在陪伴感',
  },
});

function collectHormonePhases(existingState) {
  const found = new Set();
  if (!existingState || typeof existingState !== 'object') return [];
  for (const [name, item] of Object.entries(existingState)) {
    const base = item?.profile?.base || {};
    const stage = String(base.stage || '').trim();
    if (!stage) continue;
    found.add(getHormonePhaseKey(stage, base.days, estimateStageLimit(stage, item)));
  }
  return [...found];
}

/** 只为分带用的粗略上限（黄体期 PMS 判定）；精确值 tracker 侧另有 getStageLimit */
function estimateStageLimit(stage, item) {
  const bio = item?.profile?.bio || {};
  const defaults = { 卵泡期: 9, 排卵期: 2, 黄体期: 12, 月经期: 5 };
  if (defaults[stage]) return Math.max(1, defaults[stage] * (Math.max(0.1, Number(bio.menstrualLengthRatio) || 1)));
  return 0;
}

function collectSymptomKeys(existingState) {
  const found = new Map();
  if (!existingState || typeof existingState !== 'object') return found;
  for (const item of Object.values(existingState)) {
    const pregnant = item?.profile?.pregnant || {};
    for (const [kind, gloss] of Object.entries(SYMPTOM_GLOSS)) {
      const entry = pregnant[kind];
      if (entry && typeof entry === 'object' && String(entry.key || '').trim()) {
        found.set(`${kind}:${entry.key}`, gloss[entry.key]);
      }
    }
  }
  return found;
}

function collectMultiFetusNames(existingState) {
  const names = [];
  if (!existingState || typeof existingState !== 'object') return names;
  for (const [name, item] of Object.entries(existingState)) {
    const fetuses = item?.profile?.pregnant?.fetuses;
    if (Array.isArray(fetuses) && fetuses.length > 1) names.push(String(item?.name || name));
  }
  return names;
}

/**
 * 主流程提示词的 [周期与激素状态] 块。
 * 空状态返回 ''。内容：每角色一行进度 + 在场阶段目录 + 多胎提示 + 症状图例 + 代谢刻度 + 性态度。
 */
export function buildHormoneContextBlock(payload = {}) {
  const existingState = payload?.existing_state && typeof payload.existing_state === 'object' ? payload.existing_state : {};
  const entries = Object.entries(existingState);
  if (entries.length === 0) return '';

  const lines = [
    '[周期与激素状态]',
    '以下按角色当前生理阶段推演当期激素状态，用于叙事时微调情绪、行为与身体反应；不要在回复中复述本节。',
  ];

  for (const [name, item] of entries) {
    const profile = item?.profile || {};
    const progress = formatStageProgress(profile);
    const displayName = String(item?.name || name);
    if (item?.offscreen === true) {
      lines.push(`- ${displayName}：（幕外）${progress}`);
    } else {
      lines.push(`- ${displayName}：${progress}`);
    }
  }

  const phaseKeys = collectHormonePhases(existingState);
  const catalogLines = phaseKeys
    .map((key) => HORMONE_PHASE_CATALOG[key])
    .filter(Boolean);
  if (catalogLines.length > 0) {
    lines.push('', '当期阶段画像：');
    for (const text of catalogLines) lines.push(`  · ${text}`);
  }

  const multiFetus = collectMultiFetusNames(existingState);
  if (multiFetus.length > 0) {
    lines.push('', `多胎提示：${multiFetus.join('、')} 怀有一胎以上，负担、腹部变化与营养需求都成倍于单胎。`);
  }

  const symptoms = collectSymptomKeys(existingState);
  if (symptoms.size > 0) {
    lines.push('', '当日症状含义（数值为强度 0-1）：');
    for (const gloss of symptoms.values()) lines.push(`  · ${gloss}`);
  }

  const sexAttitude = buildSexualAttitudeBlock(existingState);
  if (sexAttitude) lines.push('', sexAttitude);

  lines.push('', METABOLISM_LEVEL_LEGEND);
  return lines.join('\n');
}

/** tracker 系统 prompt 用的目录片段：只描述在场阶段，让 tracker 写心理/日记时贴合当期激素 */
export function describeHormonePhases(payload = {}) {
  const existingState = payload?.existing_state && typeof payload.existing_state === 'object' ? payload.existing_state : {};
  const phaseKeys = collectHormonePhases(existingState);
  const lines = phaseKeys
    .map((key) => HORMONE_PHASE_CATALOG[key])
    .filter(Boolean);
  if (lines.length === 0) return '';
  return [
    '[当期激素阶段画像]',
    '以下是角色当前所处阶段的激素与情绪基调；调用 bsUpdatePsychology / bsWriteDiary 时应与之一致，大幅偏离当期激素的表现需要剧情给出明确理由。',
    ...lines.map((text) => `- ${text}`),
  ].join('\n');
}
