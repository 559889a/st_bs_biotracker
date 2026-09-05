/**
 * 性爱观与癖好画像：角色稳定的性态度特质（枚举 + 一句自由补充）。
 *
 * 与两层心理的关系：
 * - 本模块 = 最慢层「她本来对性是什么态度」，注册时定、几乎不动，LLM 工具只读；
 * - psychology.mens 三轴 = 中层「当下的心理状态」，tracker 可小幅推演；
 * - hormone_context 阶段画像 = 快层「今天的激素让她像什么」。
 * 三层冲突时以更快的层作为当下表现，本画像作为底盘与解释。
 *
 * 存 profile.sexuality，随 tracker 原样进入提示词（枚举键本身无语义，
 * 中文解读由 describeSexualityLines 投影到 [性与避孕态度] 块）。
 * 不给 LLM 改写工具：癖好不该被剧情自动改写，用户在完整变量页 JSON 里改。
 */

/** 自由补充字段的长度上限（防止模型把整段人设塞进来） */
export const SEXUALITY_NOTE_MAX = 60;

export const SEXUALITY_FIELDS = Object.freeze({
  intimacyNeed: {
    label: '性爱观',
    definition: '发生性关系需要多少情感前提；决定她会不会拒绝、以什么理由答应。',
    options: Object.freeze({
      love_only: { label: '唯爱', note: '只与深爱且关系确认的人做；没有爱的性对她根本不成立，被强求会真实受伤，事后需要被确认「你爱我」。' },
      affection_first: { label: '好感为先', note: '要先有明确好感与信任才会答应；能被真诚追求打动，但一夜关系会直接拒绝。' },
      mood_led: { label: '看氛围', note: '不一定要爱，但要有氛围、合眼缘与当下的心动；理由可以只是「今晚想」，事后不必然认定关系。' },
      casual: { label: '不在意', note: '把性与情感分开看待；愉悦、好奇或需求本身就是足够的理由，不会因为上过床而改变关系判断。' },
    }),
  },
  initiative: {
    label: '主被动',
    definition: '性事中的主导倾向。这是稳定性格；psychology.mens.autonomy 是当下状态，冲突时以当下为表现。',
    options: Object.freeze({
      leading: { label: '主导', note: '会自己开口、定节奏、提出要求；对方一味被动等待会让她失去兴致。' },
      responsive: { label: '回应型', note: '不主动开场，但一旦被邀就热烈回应；喜欢被明确地要，而不是被询问。' },
      passive: { label: '被动', note: '几乎不主动，等对方带；被推着走时最放松，也常不好意思说出真实需求。' },
      switching: { label: '随情境', note: '主动与被动都自在，看对象、心情与场合切换。' },
    }),
  },
  varietyTaste: {
    label: '花样偏好',
    definition: '对新奇花样与稳定舒适之间的偏好。',
    options: Object.freeze({
      plain: { label: '舒服就好', note: '专注于熟悉、舒服的方式；花样与道具只会让她分心或不安。' },
      mild: { label: '偶尔换换', note: '以舒服为主，偶尔换个方式或地点；接受轻度的新鲜感。' },
      adventurous: { label: '乐于尝新', note: '愿意被带着尝试新方式与新场景；对提议好奇多于抵触。' },
      elaborate: { label: '热衷花样', note: '主动追求变化、道具与情境；一成不变会让她觉得无聊。' },
    }),
  },
  contraceptionStyle: {
    label: '避孕偏好',
    definition: '她偏好的避孕方式。与 psychology.mens.hasContraception（当前是否生效）配合解读。',
    options: Object.freeze({
      none_natural: { label: '不避孕', note: '不做避孕、顺其自然；对内射毫无抵触，怀上就接受。' },
      condom: { label: '避孕套', note: '默认用套，会在事前提出并确认；无套需要她明确点头。' },
      novelty_condom: { label: '情趣套', note: '自己备好情趣套（薄型、香型、带纹），把戴套变成前戏的一部分而不是打断。' },
      pill: { label: '口服避孕药', note: '为了能被无套内射而按时服药；抵触戴套，但会在意漏服与服药时间。' },
      rhythm: { label: '安全期/体外', note: '靠推算安全期与体外解决；侥幸与不安并存，排卵期会格外犹豫。' },
      long_acting: { label: '长效措施', note: '已上宫内节育器或皮下埋植；日常不必操心，可以放心内射。' },
    }),
  },
  note: {
    label: '癖好补充',
    definition: '枚举之外的个人癖好、偏好情境或明确不接受的界线，一句话。',
    free: true,
  },
});

export function createDefaultSexuality() {
  const result = {};
  for (const key of Object.keys(SEXUALITY_FIELDS)) result[key] = '';
  return result;
}

/** 归一化：未知枚举键一律丢弃（不猜），自由文本裁到上限。 */
export function normalizeSexualityState(value) {
  const result = createDefaultSexuality();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const [key, field] of Object.entries(SEXUALITY_FIELDS)) {
    const raw = value[key];
    if (raw === undefined || raw === null) continue;
    if (field.free) {
      result[key] = String(raw).replace(/\s+/g, ' ').trim().slice(0, SEXUALITY_NOTE_MAX);
      continue;
    }
    const optionKey = String(raw).trim();
    if (field.options[optionKey]) result[key] = optionKey;
  }
  return result;
}

function hasAnySexuality(sexuality) {
  if (!sexuality || typeof sexuality !== 'object') return false;
  return Object.keys(SEXUALITY_FIELDS).some((key) => String(sexuality[key] || '').trim());
}

/** 当前避孕措施是否生效的括注；psy 关闭时（undefined）不加注。 */
function describeContraceptionState(styleKey, hasContraception) {
  if (hasContraception === undefined || hasContraception === null) return '';
  if (hasContraception) return '（当前措施生效中）';
  if (styleKey === 'pill' || styleKey === 'long_acting') return '（当前无生效措施——漏服或未续，这次内射的风险是真的）';
  if (styleKey === 'none_natural') return '';
  return '（当前没有措施在生效）';
}

/**
 * 投影成 [性与避孕态度] 块里的缩排行。
 * autonomyValue 有值时作为「当下自主」括注贴在主被动行后，体现慢层/中层的张力。
 */
export function describeSexualityLines(sexuality, { hasContraception, autonomyValue } = {}) {
  if (!hasAnySexuality(sexuality)) return [];
  const lines = [];
  for (const [key, field] of Object.entries(SEXUALITY_FIELDS)) {
    const raw = String(sexuality[key] || '').trim();
    if (!raw) continue;
    if (field.free) {
      lines.push(`  · ${field.label}：${raw}`);
      continue;
    }
    const option = field.options[raw];
    if (!option) continue;
    let suffix = '';
    if (key === 'initiative' && Number.isFinite(Number(autonomyValue))) {
      suffix = `（当下自主 ${Math.round(Number(autonomyValue))}/100）`;
    } else if (key === 'contraceptionStyle') {
      suffix = describeContraceptionState(raw, hasContraception);
    }
    lines.push(`  · ${field.label}（${option.label}）：${option.note}${suffix}`);
  }
  return lines;
}

/** UI 单行摘要：唯爱 · 回应型 · 舒服就好 · 口服避孕药 */
export function formatSexualitySummary(sexuality) {
  if (!hasAnySexuality(sexuality)) return '';
  const parts = [];
  for (const [key, field] of Object.entries(SEXUALITY_FIELDS)) {
    const raw = String(sexuality?.[key] || '').trim();
    if (!raw) continue;
    if (field.free) continue;
    const option = field.options[raw];
    if (option) parts.push(option.label);
  }
  return parts.join(' · ');
}

/** 注册提示词用的字段说明（自动跟随目录，不必手写两份） */
export function buildSexualityRegistryGuideLines() {
  const lines = [
    '参数说明：',
    '- profile.sexuality 是角色稳定的性爱观与癖好画像，用来让主模型在亲密场景里保持角色一致：她需不需要爱才肯、主动还是被动、爱花样还是求舒服、偏好哪种避孕方式。',
    '- 依角色卡、世界书与角色补充设定推演，不要千篇一律地给同一组值；资料完全无法判断的字段可以省略，不要瞎猜。',
    '- 枚举字段只能填下列英文键之一（不要填中文标签、不要自造键）。',
    '- 未成年角色（age < 18）整个 sexuality 对象省略，不要填写。',
  ];
  for (const [key, field] of Object.entries(SEXUALITY_FIELDS)) {
    if (field.free) {
      lines.push(`- sexuality.${key}（${field.label}）: ${field.definition}自由文本，${SEXUALITY_NOTE_MAX} 字以内，可省略。`);
      continue;
    }
    lines.push(`- sexuality.${key}（${field.label}）: ${field.definition}`);
    for (const [optionKey, option] of Object.entries(field.options)) {
      lines.push(`  · ${optionKey} = ${option.label}：${option.note}`);
    }
  }
  lines.push(
    '示例：',
    '- 已婚、需要爱、求安稳: {"sexuality":{"intimacyNeed":"love_only","initiative":"responsive","varietyTaste":"plain","contraceptionStyle":"pill","note":"喜欢事后被抱着说话"}}',
    '- 恋爱中、乐于尝新: {"sexuality":{"intimacyNeed":"affection_first","initiative":"switching","varietyTaste":"adventurous","contraceptionStyle":"novelty_condom"}}',
  );
  return lines;
}
