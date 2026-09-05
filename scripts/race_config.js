/**
 * 生理参数配置——本插件已锁死人类。
 * 原版这里有 67 种族 / 5 繁殖组 / 11 衍生类型 / 混血合并；改造后只保留
 * 人类基线。引擎读的是 profile.bio 上的数值（注册时由此处 seed），race
 * 字段仅作展示，恒为「人类」。
 *
 * genderRatio 不放这里：它不能落进 bio（注册白名单与 bio 默认值均无此项），
 * 胎儿性别直接 50/50。
 */
export const HUMAN_PHYSIOLOGY = Object.freeze({
  menstrualLengthRatio: 1,
  gestationSpeciesSpeed: 1,
  birthDifficulty: 1,
  breedTolerance: 1,
  impregnationDifficulty: 1,
  orgasmOvulationAmount: 1,
  recoveryDays: 56,
});

export function getHumanPhysiologyProfile() {
  return { ...HUMAN_PHYSIOLOGY };
}
