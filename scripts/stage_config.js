export const MENSTRUAL_STAGES = Object.freeze(['卵泡期', '排卵期', '黄体期', '月经期']);

export const PREGNANCY_STAGES = Object.freeze(['孕早期', '孕中期', '孕晚期', '临产期', '逾期']);

export const LABOR_STAGES = Object.freeze(['第一产程', '第二产程', '第三产程']);

export const MENSTRUAL_STAGE_DAYS = Object.freeze({
  卵泡期: 9,
  排卵期: 2,
  黄体期: 12,
  月经期: 5,
});

/**
 * 哺乳期：产后恢复结束后、月经恢复前的泌乳阶段。
 * 「用进废退」模型：lactationDays 是断奶窗口——连续这么多天没有哺乳/排乳
 * （bsExcreteMetabolism 缓解乳意 ≥10 会重置计时）身体才会退奶；规律哺乳
 * 的角色哺乳期不会结束。期间排卵与月经被抑制（哺乳期闭经）。
 * 注意：不能加进 MENSTRUAL_STAGES，否则会被周期轮转逻辑直接推进。
 */
export const LACTATION_STAGE = '哺乳期';
/** 断奶窗口默认天数 */
export const LACTATION_DEFAULT_DAYS = 45;

export const PREGNANCY_STAGE_DAYS = Object.freeze({
  孕早期: 84,
  孕中期: 105,
  孕晚期: 63,
  临产期: 28,
});

export const LABOR_STAGE_BASE_HOURS = Object.freeze({
  第一产程: 12,
  第二产程: 2,
  第三产程: 0.5,
});

export const LABOR_STAGE_INCREMENT = Object.freeze({
  第一产程: 1.5,
  第二产程: 2,
  第三产程: 0.5,
});

export const FIRST_STAGE_NATURAL_BIRTH_EXPERIENCE = Object.freeze({
  reductionPerBirth: 0.15,
  maxCount: 3,
  minMultiplier: 0.55,
});

export const LABOR_POSTPARTUM_OBSERVATION_HOURS = 2;
