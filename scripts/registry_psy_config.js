function clampPsychValue(value) {
  const next = Number(value);
  if (!Number.isFinite(next)) return null;
  return Math.max(0, Math.min(100, Math.round(next)));
}

export const PSY_STAGE_KEYS = Object.freeze(['0', '1_25', '26_50', '51_75', '76_100', '100_plus']);

export const PSY_MENS_FIELDS = Object.freeze({
  mastery: {
    definition: '个体对月经周期与生理征兆的感知与掌控力。数值越高，反应越从容且精准；数值低则表现为混乱与恐慌。',
    preview: '0(无知与空白) -> 1~25(混乱应对) -> 26~50(常规适应) -> 51~75(精准掌控) -> 76~100(身心一统) -> 100+(超感知觉)',
    stages: {
      0: {
        meaning: '无知与空白',
        performance: '完全不具备生理常识。初次遭遇出血时惊恐不已，当成受了内伤、中了诅咒或得了怪病，完全不知如何应对。无法采取任何护理行动。',
        breakthrough_condition: '需经历一次完整的经期循环，并由他人进行启蒙教育或自我观测记录，方可突破至 1+。',
      },
      '1_25': {
        meaning: '混乱应对',
        performance: '对周期毫无预期，常在不便时突然来潮。情绪受激素波动控制明显，表现为易怒、忧郁且无所适从。增加时，开始尝试记忆日子；减少时，会因压力而忽视身体信号。',
      },
      '26_50': {
        meaning: '常规适应',
        performance: '能大致预判日期，提前准备清洁物。能忍受不适并维持正常生活。增加时，对经前症状更敏感；减少时，表现为对身体管理的怠慢。',
      },
      '51_75': {
        meaning: '精准掌控',
        performance: '精通自身周期，能根据体征判断排卵期。会依据经期调整生活与运动节奏。增加时，能预判经期长度；减少时，感知能力会变得迟钝。',
      },
      '76_100': {
        meaning: '身心一统',
        performance: '对生殖系统有绝对感知。能精准控制经期反应，甚至透过冥想或调理减轻不适。增加时，感知力向精神层面渗透。',
        transcend_condition: '当个体凭身体直觉就能随时报出自己正处于周期哪一天、体内有什么细微变化时，进入 100+ 状态。',
      },
      '100_plus': {
        meaning: '超感知觉',
        performance: '进入超常的身体感知。排卵、受精着床这类平时察觉不到的体内变化，她能凭一丝微妙的体感分辨出来；对受孕窗口的把握近乎本能。此阶段不会跌回100。',
      },
    },
  },
  desire: {
    definition: '个体想不想要孩子的长期态度：对怀孕的渴望或恐惧、对避孕的坚持或松懈。数值越高，越渴望怀上并愿意为此创造条件；数值越低，越回避怀孕、越坚持避孕。',
    preview: '0(视孕为灾) -> 1~25(严防死守) -> 26~50(顺其自然) -> 51~75(想要孩子) -> 76~100(渴望怀上) -> 100+(生育执念)',
    stages: {
      0: {
        meaning: '视孕为灾',
        performance: '把怀孕当成最大的灾难来防。性事以绝不怀上为前提：坚持戴套或吃药，对方想内射会被她拦下，事后还要冲洗确认。',
        breakthrough_condition: '需感情稳定到让她愿意共同生育、被深爱之人真正说服，或经历一次足以扭转观念的意外后，方可突破至 1+。',
      },
      '1_25': {
        meaning: '严防死守',
        performance: '有性生活但避孕从不松懈，事后会立刻清理、反复确认有没有漏。增加时，对怀孕的恐惧减轻；减少时，会因一次意外而更加神经质。',
      },
      '26_50': {
        meaning: '顺其自然',
        performance: '不刻意追求也不刻意回避，把怀不怀得上交给缘分。不主动索取内射，但对方想要时也不抗拒。增加时，开始好奇怀上的感觉；减少时，会更注意避孕。',
      },
      '51_75': {
        meaning: '想要孩子',
        performance: '在稳定关系里会期待怀上：愿意让对方内射、事后也不急着起身清理，会暗暗留意自己的排卵期。增加时，对怀上更上心；减少时，热情降温、退回顺其自然。',
      },
      '76_100': {
        meaning: '渴望怀上',
        performance: '把怀上孩子当成明确的心愿。会主动算排卵期、在排卵期缠着伴侣内射，伴侣犹豫时还会软磨硬泡，极端时甚至隐瞒漏服。增加时更执拗；减少时会焦虑、患得患失。',
        transcend_condition: '当想要孩子成为压倒一切的执念，事业、身体与对方意愿都被她放到一边时，进入 100+ 状态。',
      },
      '100_plus': {
        meaning: '生育执念',
        performance: '怀孕成了她生活的中心：会为受孕调理身体、把握每一次机会，明知有风险也甘愿承担，迟迟怀不上就会焦虑甚至自责。此阶段不会跌回100。',
      },
    },
  },
  autonomy: {
    definition: '个体在性爱与权力关系中的自主性。高则支配、主导；低则被动、服从。',
    preview: '0(绝对木偶) -> 1~25(被动服从) -> 26~50(顺应配合) -> 51~75(主动索求) -> 76~100(支配女王) -> 100+(超越主宰)',
    stages: {
      0: {
        meaning: '绝对木偶',
        performance: '失去灵魂的空壳。身体虽有反应但意识缺席，任由摆布，无任何反抗或主动示爱。无痛觉与愉悦感的外部表达。',
        breakthrough_condition: '需经历剧烈的肉体觉醒、情感冲击或被赋予第一条“自我指令”后，方可突破至 1+。',
      },
      '1_25': {
        meaning: '被动服从',
        performance: '角色处于弱势或受压迫状态。多表现为屈辱、忍耐或消极配合。增加时，会出现微小的反抗；减少时，意志趋向崩溃。',
      },
      '26_50': {
        meaning: '顺应配合',
        performance: '正常的互动模式。听从对方指挥，会给予回馈，但不会主动开拓新领域。增加时，会尝试提出小要求；减少时，会变得更沉默。',
      },
      '51_75': {
        meaning: '主动索求',
        performance: '掌握节奏，主动挑逗或变换体位。明确表达自己的快感需求。增加时，表现出极高的探索欲；减少时，行为会变得保守。',
      },
      '76_100': {
        meaning: '支配女王',
        performance: '绝对主导。将对方视为服务自己的工具或奖励，掌控频率、深度与时间。增加时，掌控欲延伸至生活各层面。',
        transcend_condition: '当常规的交合已无法满足其精神掌控力，开始追求极端、非典型或神圣化的权力仪式时，进入 100+ 状态。',
      },
      '100_plus': {
        meaning: '超越主宰',
        performance: '常规性交已感无趣。开始设计复杂的权力游戏、追求更极端的感官刺激或灵魂控制。将性爱视为一场由其编导的宏大演出。此阶段不会跌回100。',
      },
    },
  },
});

export const PSY_MENS_BOOL_FIELDS = Object.freeze({
  isChaste: {
    definition: '是否当前保持贞洁取向或单一性伴侣关系，不处于多对象性关系状态。',
  },
  hasContraception: {
    definition: '是否当前存在稳定生效中的避孕措施，例如安全套、避孕药、节育器，或角色世界观里同样可靠的避孕手段。(若角色對自身月经完全无知，则该字段也应为 false)',
  },
});

export const PSY_PREG_FIELDS = Object.freeze({
  cognition: {
    definition: '个体对妊娠生理变化的认知与应对能力。数值越高，越能冷静处理风险；数值低则表现为无知或恐慌。',
    preview: '0(隐式妊娠) -> 1~25(混乱与猜疑) -> 26~50(勉强适应) -> 51~75(理性理解) -> 76~100(专业准备) -> 100+(医学级觉知)',
    stages: {
      0: {
        meaning: '隐式妊娠',
        performance: '大脑完全封锁怀孕讯号。即便胎动剧烈或腹部隆起，仍会解释为胃病、肠胃不适或单纯吃胖了。拒绝承认怀孕。',
        breakthrough_condition: '需由外部权威强制指认，或经历不可忽视的分娩启动，方可突破至 1+。',
      },
      '1_25': {
        meaning: '混乱与猜疑',
        performance: '感知到身体异样但拒绝深思。对孕期禁忌、周数完全模糊。增加时，开始怀疑真实情况；减少时，会陷入自我欺骗。',
      },
      '26_50': {
        meaning: '勉强适应',
        performance: '虽然承认怀孕，但对未来的变化感到焦虑。缺乏系统知识，容易被谣言误导或因小症状而惊慌失措。尚未达到从容应对的程度。',
      },
      '51_75': {
        meaning: '理性理解',
        performance: '主动掌握孕期知识，能对应自身周数与胎儿状态。开始能辨识假性宫缩，并有条理地准备待产物品。增加时，对身体掌控感提升。',
      },
      '76_100': {
        meaning: '专业准备',
        performance: '对妊娠风险有深刻理解。能冷静应对各种生理突发状况，如预判破水、调整呼吸节奏以缓解疼痛。增加时，进入准专业状态。',
        transcend_condition: '当个体能像专业医师般冷静审视自身分娩过程，甚至能自行引导胎位、处理紧急分娩细节时，进入 100+。',
      },
      '100_plus': {
        meaning: '医学级觉知',
        performance: '绝对冷静。能精确感应子宫颈开口公分数、羊水状态与胎儿心率。在分娩时能如同旁观者般指挥自己，无惧痛楚，只追求最优的分娩结果。此阶段不会跌回100。',
      },
    },
  },
  bonding: {
    definition: '个体与腹中胎儿的情感联结与母性本能。数值越高，守护欲越强；数值低则视胎儿为异物。',
    preview: '0(怀孕否认症) -> 1~25(疏离与嫌恶) -> 26~50(任务式共存) -> 51~75(萌生守护) -> 76~100(自我牺牲) -> 100+(恋孕狂热)',
    stages: {
      0: {
        meaning: '怀孕否认症',
        performance: '心理防御机制完全切断与胎儿的联系。无视胎动，甚至将腹部隆起视为肿瘤或寄生，拒绝产生任何情感回馈。',
        breakthrough_condition: '需经历与胎儿的共生感触发，或被强烈爱意感化，方可突破至 1+。',
      },
      '1_25': {
        meaning: '疏离与嫌恶',
        performance: '将怀孕视为诅咒、累赘。对腹部触碰感到厌恶，常有终结妊娠的念头，缺乏保护胎儿的本能。增加时，排斥感减弱；减少时，会产生毁灭倾向。',
      },
      '26_50': {
        meaning: '任务式共存',
        performance: '接受怀孕事实，但仅将其视为一项生理任务或责任。缺乏自发的爱意，仅是被动地配合养胎。增加时，开始产生好奇。',
      },
      '51_75': {
        meaning: '萌生守护',
        performance: '开始自发地触摸肚子、与胎儿对话。能感知到胎动带来的喜悦，产生初步的母性保护欲。增加时，保护行为会变得明显。',
      },
      '76_100': {
        meaning: '自我牺牲',
        performance: '胎儿成为生命核心。愿意为了胎儿的健康放弃自己的喜好、形象甚至安全。展现强烈的母爱。增加时，联结感向灵魂层面延伸。',
        transcend_condition: '当母性本能转化为一种对怀孕状态与腹中生命的极度崇拜与迷恋时，进入 100+。',
      },
      '100_plus': {
        meaning: '恋孕狂热',
        performance: '产生强烈的恋孕情节。迷恋大肚子带来的沉重感、胎动的入侵感。比起生产，更希望永远维持这种合而为一的状态，视怀孕为最高幸福。此阶段不会跌回100。',
      },
    },
  },
  stance: {
    definition: '个体对怀孕身份的社会展现与心态。数值越高，越倾向利用孕妇身份获取优势。',
    preview: '0(绝对藏孕) -> 1~25(畏怯隐蔽) -> 26~50(被动接受) -> 51~75(正式准备) -> 76~100(自豪展现) -> 100+(母权优越)',
    stages: {
      0: {
        meaning: '绝对藏孕',
        performance: '将怀孕视为耻辱或致命弱点。会用宽大衣物、束腹或各种遮掩手段藏住孕肚，绝不在言谈中提及怀孕。害怕被识破。',
        breakthrough_condition: '当隐藏已无可能，或被环境强迫接受孕妇身份后，方可突破至 1+。',
      },
      '1_25': {
        meaning: '畏怯隐蔽',
        performance: '对自己的孕态感到不安，害怕别人的指点。在社交场合总是缩小存在感，对母职缺乏信心。增加时，羞耻感降低；减少时，会更加封闭。',
      },
      '26_50': {
        meaning: '被动接受',
        performance: '不再刻意隐藏，但也不会主动展示。穿着以宽松舒适为主，被动地接受他人的照顾，但内心仍感局促。增加时，开始习惯特殊待遇。',
      },
      '51_75': {
        meaning: '正式准备',
        performance: '坦然展现孕妇身份。会为了待产主动收集资源、与人交流经验。能以正常心态面对外界的注目与关怀。增加时，自信心提升。',
      },
      '76_100': {
        meaning: '自豪展现',
        performance: '刻意穿着贴身孕妇装展示腹部曲线。主动谈论育儿计划，享受被视为母亲的尊重，并开始懂得要求合理的照顾。增加时，展现欲增强。',
        transcend_condition: '当个体开始意识到孕妇身份是一种强大的社会武器，能主动操控规则来获取更大利益时，进入 100+。',
      },
      '100_plus': {
        meaning: '母权优越',
        performance: '极度炫耀孕肚，将怀孕作为获取特权、物资或地位的手段。懂得利用他人的同情或保护欲来达成目的。将怀孕视为一种高人一等的阶级符号。此阶段不会跌回100。',
      },
    },
  },
});

export const PSY_PREG_BOOL_FIELDS = Object.freeze({
  knowsFatherSource: {
    definition: '是否知晓当前妊娠或腹中胎儿的父源对象。(若角色連自身妊娠都未知曉，該字段也应为 false)',
  },
  hasProfessionalPrenatalCare: {
    definition: '是否已经接受或持续接受专业产检、医疗监护或正规待产照护。',
  },
});

export function resolvePsychStageKey(value) {
  const next = Number(value);
  if (!Number.isFinite(next)) return null;
  if (next <= 0) return '0';
  if (next <= 25) return '1_25';
  if (next <= 50) return '26_50';
  if (next <= 75) return '51_75';
  if (next <= 100) return '76_100';
  return '100_plus';
}

export function buildPsychInterpret(fieldConfig, value, stageProfile = null) {
  const stageKey = resolvePsychStageKey(value);
  const customInterpret = stageProfile && typeof stageProfile === 'object'
    ? String(stageProfile[stageKey] || '').trim()
    : '';
  if (customInterpret) return customInterpret;
  if (!stageKey || !fieldConfig?.stages?.[stageKey]) return '';
  const stage = fieldConfig.stages[stageKey];
  return [stage.meaning, stage.performance, stage.breakthrough_condition, stage.transcend_condition]
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function normalizePsychologyStageProfiles(value, { mensFields = PSY_MENS_FIELDS, pregFields = PSY_PREG_FIELDS } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  const groups = [
    ['mens', mensFields],
    ['preg', pregFields],
  ];
  for (const [groupKey, fieldConfig] of groups) {
    const sourceGroup = value[groupKey];
    if (!sourceGroup || typeof sourceGroup !== 'object' || Array.isArray(sourceGroup)) continue;
    const normalizedGroup = {};
    for (const field of Object.keys(fieldConfig || {})) {
      const sourceField = sourceGroup[field];
      if (!sourceField || typeof sourceField !== 'object' || Array.isArray(sourceField)) continue;
      const normalizedField = {};
      for (const stageKey of PSY_STAGE_KEYS) {
        const text = String(sourceField[stageKey] || '').trim();
        if (text) normalizedField[stageKey] = text;
      }
      if (Object.keys(normalizedField).length > 0) normalizedGroup[field] = normalizedField;
    }
    if (Object.keys(normalizedGroup).length > 0) result[groupKey] = normalizedGroup;
  }
  return result;
}

export function buildEmptyPsychologyGroup(fieldConfig, booleanFields = {}) {
  const result = {};
  for (const key of Object.keys(fieldConfig || {})) {
    result[`${key}_value`] = null;
    result[`${key}_interpret`] = '';
  }
  for (const key of Object.keys(booleanFields || {})) {
    result[key] = false;
  }
  return result;
}

export function normalizePsychologyGroup(value, fieldConfig, { includeDefaults = true, booleanFields = {}, stageProfiles = {} } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return includeDefaults ? buildEmptyPsychologyGroup(fieldConfig, booleanFields) : null;
  const result = includeDefaults ? buildEmptyPsychologyGroup(fieldConfig, booleanFields) : {};
  let changed = false;
  for (const key of Object.keys(fieldConfig || {})) {
    const rawValue = value[`${key}_value`] ?? value[key];
    if (rawValue === undefined) continue;
    changed = true;
    if (rawValue === null) {
      result[`${key}_value`] = null;
      result[`${key}_interpret`] = '';
      continue;
    }
    const nextValue = clampPsychValue(rawValue);
    if (nextValue === null) continue;
    result[`${key}_value`] = nextValue;
    result[`${key}_interpret`] = buildPsychInterpret(fieldConfig[key], nextValue, stageProfiles?.[key]);
  }
  for (const key of Object.keys(booleanFields || {})) {
    if (value[key] === undefined) continue;
    changed = true;
    result[key] = Boolean(value[key]);
  }
  if (!includeDefaults && !changed) return null;
  return result;
}
