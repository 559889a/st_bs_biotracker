/**
 * 血缘关系图：从 chatState 读出节点与边，不修改任何状态、不依赖引擎逻辑。
 *
 * 纯爱模型下图的形状极简：每个孩子恰好一位母亲（承载者本人）与一位父亲
 * （精液来源）。多父/代孕/自交/胎内回归的边型已随纯爱化改造移除。
 *
 * 身分即名字：characters 以名字为键，所以 children[*].fathers 这个字串
 * 直接就能对回角色节点；对不上的（路人）当作未注册叶节点。
 */

export function buildLineageGraph(chatState) {
  const characters = (chatState && typeof chatState.characters === 'object' && chatState.characters) || {};
  const characterNames = Object.keys(characters);
  const isRegistered = (name) => Object.prototype.hasOwnProperty.call(characters, name);

  const nodes = new Map();
  const edges = [];

  const characterNodeId = (name) => `char:${name}`;
  const unregisteredNodeId = (name) => `name:${name}`;

  /**
   * 解析一个亲代名字到节点；未注册的当叶节点。
   * race/derivedType 能对应时才补，宁可留空也不要标错血统。
   */
  const resolveParent = (name, traits = null) => {
    const value = String(name || '').trim();
    if (!value) return null;
    if (isRegistered(value)) return characterNodeId(value);
    const id = unregisteredNodeId(value);
    if (!nodes.has(id)) nodes.set(id, { id, kind: 'unregistered', name: value });
    const node = nodes.get(id);
    if (traits?.race && !node.race) node.race = traits.race;
    if (traits?.derivedType && !node.derivedType) node.derivedType = traits.derivedType;
    return id;
  };

  // 先建立所有已注册角色的节点，孤立角色也要出现在图上
  for (const name of characterNames) {
    const profile = characters[name]?.profile || {};
    nodes.set(characterNodeId(name), {
      id: characterNodeId(name),
      kind: 'character',
      name,
      race: profile.base?.race ?? null,
      derivedType: profile.base?.derivedType ?? null,
      age: profile.base?.age ?? null,
    });
  }

  for (const ownerName of characterNames) {
    const owner = characters[ownerName];
    const children = Array.isArray(owner?.profile?.children) ? owner.profile.children : [];
    for (const child of children) {
      if (!child || typeof child !== 'object') continue;

      // 孩子注册成角色后，两者是同一个体：节点合并到角色上
      const registeredAs = String(child.registeredAs || '').trim();
      const childNodeId = registeredAs && isRegistered(registeredAs)
        ? characterNodeId(registeredAs)
        : `child:${child.id || `${ownerName}#${children.indexOf(child)}`}`;

      if (!nodes.has(childNodeId)) {
        nodes.set(childNodeId, {
          id: childNodeId,
          kind: 'child',
          name: child.name ?? null,
          race: child.race ?? null,
          derivedType: child.derivedType ?? null,
          gender: child.gender ?? null,
          age: child.age ?? null,
        });
      }
      // 合并到角色节点时不写 registeredAs——那会指向它自己。
      // 「这个角色是在故事里被生下来的」判定 kind === 'character' 且有 childId 即可。
      const childNode = nodes.get(childNodeId);
      childNode.childId = child.id ?? null;

      // 母系：纯爱模型下承载者就是遗传母亲
      edges.push({ from: characterNodeId(ownerName), to: childNodeId, type: 'mother' });

      // 父系：精液来源
      const fatherName = String(child.fathers || '').trim();
      if (fatherName && fatherName !== '未知') {
        const from = resolveParent(fatherName, { race: child.fatherRace ?? null, derivedType: child.fatherDerivedType ?? null });
        if (from) edges.push({ from, to: childNodeId, type: 'father' });
      }
    }
  }

  return { nodes: [...nodes.values()], edges };
}

/**
 * 以某个节点为中心裁切血缘图，并标上世代。
 *
 * 全图在手机上很快就糊了，实际想看的多半是「这孩子谁生的、跟谁有血缘」。
 * 中心为第 0 代，祖先为负、后代为正，渲染层照 generation 分代横排即可。
 *
 * 此处取最近的一条——分代横排只能给每人一列，取近的比取远的直观。
 */
export function focusLineage(graph, centerId, { up = 2, down = 2 } = {}) {
  const allNodes = new Map((graph?.nodes || []).map((node) => [node.id, node]));
  const edges = graph?.edges || [];
  if (!allNodes.has(centerId)) return { nodes: [], edges: [], centerId };

  const generation = new Map([[centerId, 0]]);

  // 往上找亲代：边的 to 是当前节点
  const walk = (direction, limit) => {
    let frontier = [centerId];
    for (let step = 1; step <= limit; step += 1) {
      const next = [];
      for (const id of frontier) {
        for (const edge of edges) {
          const isMatch = direction < 0 ? edge.to === id : edge.from === id;
          if (!isMatch) continue;
          const neighbour = direction < 0 ? edge.from : edge.to;
          if (generation.has(neighbour)) continue;
          generation.set(neighbour, direction * step);
          next.push(neighbour);
        }
      }
      if (next.length === 0) break;
      frontier = next;
    }
  };
  walk(-1, Math.max(0, up));
  walk(1, Math.max(0, down));

  // 补上共同亲代：往下走只会捞到中心的后代，另一位亲代既不是中心的祖先
  // 也不是后代，会整个缺席，族谱上看起来就像孩子只有一个亲代。
  // 只补一层、不再往上递归，避免把整张图拉进来。
  for (const [id, gen] of [...generation.entries()]) {
    if (gen < 0) continue;
    for (const edge of edges) {
      if (edge.to !== id || generation.has(edge.from)) continue;
      generation.set(edge.from, gen - 1);
    }
  }

  const nodes = [...generation.entries()]
    .filter(([id]) => allNodes.has(id))
    .map(([id, gen]) => ({ ...allNodes.get(id), generation: gen }))
    .sort((a, b) => a.generation - b.generation);

  const kept = new Set(nodes.map((node) => node.id));
  return {
    centerId,
    nodes,
    edges: edges.filter((edge) => kept.has(edge.from) && kept.has(edge.to)),
  };
}
