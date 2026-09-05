/**
 * 胎儿标签：给一颗胎儿标注「它是怎么来的／它现在处于什么特殊状态」。
 *
 * 分两类来源，合并后去重：
 * 全部写进 fetus.tags 落盘（同卵分裂、异期复孕）：这些事件的证据在发生当下
 * 就消失了——同卵分裂产生的复制体和原胚在栏位上完全一样，事后无从分辨。
 *
 * 多父系与第三方生殖功能（嵌合体、孕中孕、代孕、自交、胎内回归）已随纯爱化
 * 改造移除。
 *
 * 本模块是纯资料层，不依赖引擎也不依赖宿主 API。
 */

/**
 * id 稳定且与语言无关（落盘的是 id，不是中文字），label 供介面显示，
 * short 只在该标签真的出现在本轮 payload 时才注入提示词——与种族短叙述同规则，
 * 没用到的标签不占 token。
 */
export const FETUS_TAG_CATALOG = [
  {
    id: 'identical',
    label: '同卵',
    short: '著床时由同一颗受精卵分裂而来；带同一个 identicalGroup 的几胎基因一致。',
  },
  {
    id: 'superfetation',
    label: '异期复孕',
    short: '母体已经怀孕时又受精而成的一胎——孕早期里没用掉的排卵留到了那时。它比同腹其他胎儿晚受精，孕龄与发育都落后一截，出生时通常明显更小，但仍与先来那胎一起娩出。',
  },
];

const TAG_BY_ID = new Map(FETUS_TAG_CATALOG.map((tag) => [tag.id, tag]));
const TAG_ORDER = new Map(FETUS_TAG_CATALOG.map((tag, index) => [tag.id, index]));

export function isKnownFetusTag(id) {
  return TAG_BY_ID.has(String(id || ''));
}

/** 未收录的 id 一律丢弃：落盘资料只允许出现目录里有的标签 */
export function sanitizeFetusTagList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  for (const item of value) {
    const id = String(item || '').trim();
    if (isKnownFetusTag(id)) seen.add(id);
  }
  return sortFetusTags([...seen]);
}

function sortFetusTags(ids) {
  return [...ids].sort((a, b) => (TAG_ORDER.get(a) ?? 999) - (TAG_ORDER.get(b) ?? 999));
}

/**
 * 一颗胎儿（或一笔孩子记录）当前的完整标签集合。
 * @param context.carrierName 预留参数（代孕/自交推导移除后暂无使用方）
 */
export function deriveFetusTags(fetus, { carrierName = '' } = {}) {
  if (!fetus || typeof fetus !== 'object') return [];
  return sortFetusTags(sanitizeFetusTagList(fetus.tags));
}

export function getFetusTagLabel(id) {
  return TAG_BY_ID.get(String(id || ''))?.label || String(id || '');
}

export function getFetusTagLabels(ids) {
  return (Array.isArray(ids) ? ids : []).map(getFetusTagLabel);
}

/** 提示词用：只描述本轮真的出现过的标签 */
export function describeFetusTags(ids) {
  const wanted = new Set((Array.isArray(ids) ? ids : []).filter(isKnownFetusTag));
  return FETUS_TAG_CATALOG
    .filter((tag) => wanted.has(tag.id))
    .map((tag) => `  - ${tag.id}（${tag.label}）：${tag.short}`);
}
