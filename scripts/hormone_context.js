/**
 * 激素周期画像层：阶段 → 情绪/行为/身体/心理的纯派生投影。
 *
 * 设计：不做任何持久化——所有内容从 base.stage / base.days / age / libido / pregnant
 * 等实时推算，随 tracker 每轮处理完消息自动重建，同一套 token 纪律：只描述在场角色
 * 当前所处的阶段。
 *
 * 个体差异不加敏感度旋钮：psy 三轴、vitality/psyStress 等级与角色卡本身
 * 已提供方差（设计决定，见计划）。
 *
 * 快层（本模块）回答「今天的激素让她像什么、该怎么演」；慢层（registry_psy_config
 * 的三轴，tracker 写）回答「她本来是什么样的人」。两层互补不互斥。
 *
 * 主流程块给「演出指令」（情绪/行为/身体三维，show-don't-tell）；
 * tracker 块给「心理写入倾向」（psy 字段，喂给 bsUpdatePsychology / bsWriteDiary）。
 */
import { LABOR_STAGES, MENSTRUAL_STAGES, PREGNANCY_STAGES } from './stage_config.js';
import { describeSexualityLines } from './sexuality_config.js';

/** 黄体期晚段的 PMS 窗口：距阶段结束不足 4 天视为晚段 */
const LUTEAL_LATE_WINDOW_DAYS = 4;

/** 停经年龄默认标尺（bio 不入 payload，与 estimateStageLimit 同样的取舍） */
const MENOPAUSE_DEFAULT_AGE = 45;

/** 围绝经期早期的年龄窗：停经前 5 年且仍在周期内 */
const PERIMENOPAUSE_EARLY_YEARS = 5;

/** 哺乳断奶窗口默认标尺（bio.lactationDays 未入 payload 时兜底） */
const LACTATION_DEFAULT_DAYS = 45;

/**
 * 阶段 → 激素演出画像。键为 getHormonePhaseKey 的输出。
 * - summary：一句话激素概览（tracker 与主流程共用）
 * - mood / behavior / body：主流程演出指令（写对白/动作/身体反应时贴合）
 * - psy：tracker 心理写入倾向（bsUpdatePsychology / bsWriteDiary 的方向参考）
 * 键覆盖：月经三键分带（卵泡期早/晚、月经初期/后期）、黄体期早/晚、排卵期，
 * 以及孕产全线、围绝经与停经。
 */
export const HORMONE_PHASE_CATALOG = Object.freeze({
  卵泡期早: {
    summary: '雌激素低位回升：经期阴霾散去，情绪止跌回稳，体力一点点回来。',
    mood: '从经后虚脱里缓过来：偏平静、略倦怠，容错度回升，不再一点就炸。',
    behavior: '愿意重新收拾自己、出门见人；语速偏慢、节奏温，对亲密接触不再排斥但也谈不上主动。',
    body: '经血刚净仍有淡淡余感，肤色偏淡、小腹偶有坠胀残留；怕冷的感觉渐渐退去。',
    psy: '情压从经期峰值回落；mastery 高者开始记录与推算周期。',
  },
  卵泡期晚: {
    summary: '雌激素爬升：精力与皮肤状态走向周期最佳，心情明亮、思维敏捷。',
    mood: '轻快自信，社交意愿强，看什么都顺眼一些，也更能开玩笑。',
    behavior: '主动安排事务、敢于表达意见；对暧昧信号的接收与发出都变敏锐，玩笑里带点试探。',
    body: '皮肤透亮、精力充沛；分泌物由干转润——身体在为排卵做准备，她自己也说不出为什么状态这么好。',
    psy: 'autonomy 与日常 cognition 类表现自然上行；desire 开始抬头。',
  },
  排卵期: {
    summary: '雌激素峰值：性欲顶点、魅力外放、主动大胆、体温微升；接近异性时的暗示与试探会自然增多。',
    mood: '自信张扬，带一点想撩拨的躁动；被吸引时不容易按捺，理智在线但阈值变高。',
    behavior: '穿着与举止不自觉更张扬，会主动创造独处机会、说些越界的话；眼神与距离感都在往前递。',
    body: '基础体温微升、下腹单侧偶有排卵的细微坠感；分泌物呈蛋清样清亮拉丝——最易受孕的体征，mastery 高的角色可能认得出来。',
    psy: 'desire 与 autonomy 易上行；mastery 高者能自我识别「现在是危险/受孕窗口」。',
  },
  黄体期早: {
    summary: '孕激素主导：平稳微懒、食欲增加、嗜睡、体温升高，身体进入「储备模式」。',
    mood: '松弛安定，带点绵软的慵懒，不太想动脑子，容易被小确幸满足。',
    behavior: '偏好待在熟悉的地方、吃点好的；对计划外的事务有轻微抵触，想早点收工回家。',
    body: '基础体温持续偏高、乳房开始发胀、口味变重嗜甜嗜咸；傍晚容易犯困。',
    psy: 'desire 平稳回落；对陪伴的渴求（伴意）易小幅上行。',
  },
  黄体期晚: {
    summary: 'PMS 窗口（黄体期末段，激素开始回落）：情绪比平时敏感一些，容易烦躁或莫名低落，小事有点耐心不足；乳房微微胀痛、身体略沉，想吃点甜的。希望被稍微迁就一下，但整体还在可控范围内。',
    mood: '比平时敏感一点，容易被小事硌到，耐心余额不足；想被顺着捋，硬碰硬只会更僵。',
    behavior: '会莫名想收拾东西、买点东西、吃点甜的；话变少或带刺取决于性格——迁就她一下就软。',
    body: '乳房胀痛、身体发沉、轻度水肿；情绪性地想吃甜食与碳水，傍晚尤其明显。',
    psy: '情压易小幅上行；mastery 高者能自我察觉「是激素不是世界」，并在日记里写下来。',
  },
  月经初期: {
    summary: '激素谷底：疲惫腹痛、易怒低落、性欲低谷，想被呵护或想独处；注意力涣散、畏寒嗜甜。',
    mood: '低落与烦躁交叠：耐心差、易哭或易炸，看人看事都灰一度，最怕被要求「正常一点」。',
    behavior: '推掉不必要的事、蜷着不想动；只想热水袋、甜食和被窝，回复消息都嫌累。',
    body: '经量最大、绞痛阵阵、腰酸畏寒；更换卫生用品、躲去洗手间这类细节会自然出现。',
    psy: '情压易升至高点、desire 处于谷底；被温柔照顾时情绪会明显回暖。',
  },
  月经后期: {
    summary: '激素谷底的尾声：经量转少、腹痛缓解，情绪从低点缓慢爬回。',
    mood: '灰度渐退，开始「活过来」，但仍易疲、玻璃心没有完全收起。',
    behavior: '愿意洗头、收拾、恢复轻度日常；对热闹仍有一点距离感，更享受安静的一对一相处。',
    body: '经血转淡转少、腹部松快下来，畏寒消退；清洁感与食欲回到日常。',
    psy: '情压从峰值回落；desire 仍低位，但对亲密（非性）的渴望回升。',
  },
  孕早期: {
    summary: 'hCG 飙升：孕吐疲惫、嗅觉敏感、情绪多变（上一刻流泪下一刻大笑）、乳房胀痛。',
    mood: '敏感多变——上一刻落泪下一刻大笑，自己也拿不准自己，既委屈又说不清为什么。',
    behavior: '嗜睡、口味突变、对油烟与气味避之不及；开始留意「这个月有没有来」，猜测或确认的过程本身就是戏。',
    body: '晨呕恶心（未必只在早晨）、乳房胀痛变沉、基础体温持续不降；小腹尚平，只有她自己摸得到那点不同。',
    psy: 'preg 的 cognition 决定她是冷静应对还是慌乱否认；bonding 自知晓之日起开始萌芽。',
  },
  孕中期: {
    summary: '激素平台期：孕吐消退、食欲旺盛、皮肤光泽、情绪安稳甚至愉悦，性欲回升；开始感知胎动。',
    mood: '安稳甚至愉悦，进入孕期最舒展的「蜜月段」，愿意谈论宝宝也愿意撒娇。',
    behavior: '食欲旺盛、开始逛婴儿用品、研究名字；性欲回升，亲密需求回来且更放得开（以舒适为先）。',
    body: '孕吐消退、小腹初显、皮肤有光泽；第一次胎动会发生在这个阶段——像鱼吐泡或蝴蝶扇翅，她一定会停下来感受。',
    psy: 'bonding 与 stance 趋稳；desire 在「安全」的认知下自然回升。',
  },
  孕晚期: {
    summary: '负担顶点：笨重腰酸、尿频失眠、假性宫缩；筑巢本能（收拾、准备婴儿用品）与对分娩的期待焦虑交织。',
    mood: '期待与焦虑交织，对分娩既盼且惧；容易感伤，或像安排后事一样絮絮叨叨交代各种细节。',
    behavior: '筑巢本能——反复收拾房间、清点待产包；动作迟缓、频繁换姿势，弯腰系鞋带都成工程。',
    body: '宫底最高、腰酸尿频、腿肿失眠、假性宫缩偶发；肚皮会被胎动顶出形状，一侧肋下常被顶得发麻。',
    psy: 'cognition 高者有条不紊地倒计时；stance 面临「怎么生、在哪生」的抉择。',
  },
  临产期: {
    summary: '入盆后轻松感与坠胀并存；宫缩前兆、见红可能，焦躁不安、反复确认身体状况。',
    mood: '坐立难安，注意力被身体牵着走；一有风吹草动就停下来分辨「是不是开始了」。',
    behavior: '收拾最后行李、洗头、联系该联系的人；在「再等等」与「是不是要生了」之间反复摇摆。',
    body: '入盆后胃口与呼吸轻松一点，但下坠感与耻骨痛加重；见红与不规律宫缩可能登场。',
    psy: 'cognition 决定从容或恐慌；bonding 在等待中达到临产前的峰值。',
  },
  逾期: {
    summary: '孕期满载：极度笨重不适、睡眠破碎、急切与担忧并行，随时可能发动。',
    mood: '烦躁与担忧并行——「怎么还不出来」；既盼发动又怕发动。',
    behavior: '数着胎动过日子、反复与医者确认；做什么都坐不踏实，走也不是躺也不是。',
    body: '极度笨重、睡不成整觉；任何一次宫缩收紧都让她屏息分辨真假。',
    psy: '情压持续上行；cognition 高者会主动催促评估引产。',
  },
  产兆前驱: {
    summary: '不规则宫缩渐强、腰骶酸痛；精力反而上涌（肾上腺素），又慌又亢。',
    mood: '又慌又亢：肾上腺素让她停不下来又静不下来，笑与抖在同一张脸上。',
    behavior: '抓紧最后收拾、洗头、计时宫缩；在家人面前强装镇定，或彻底破防抓紧任何一只手。',
    body: '不规则宫缩渐强渐密、腰骶酸坠如被碾过；可能破水、见红，呼吸开始不自觉变深。',
    psy: 'stance 与 cognition 接受产程的最终考验；bonding 全部押注在那个即将到来的声音上。',
  },
  第一产程: {
    summary: '规律宫缩阶梯推进：疼痛从可忍到密集强烈，呼吸节奏被打断，意识开始向身体收窄。',
    mood: '从还能谈笑到只能哼声应对；意识随疼痛向内收窄，外界的声音越来越远。',
    behavior: '抓握、换姿势、跟着呼吸口令；话越来越少，点头摇头取代语言。',
    body: '规律宫缩阶梯增强（严格以 laborPain 为准，不得超出）、破水、后腰被碾过般的酸；额发汗湿。',
    psy: 'autonomy 让位于身体本能；cognition 支撑她配合每一次呼吸与用力。',
  },
  第二产程: {
    summary: '剧痛与用力本能交叠：意识狭窄到近乎空白，只剩宫缩、坠胀与Push的冲动。',
    mood: '意识近乎空白，只剩坠胀与用力的冲动，间隙偶有碎片般的清醒。',
    behavior: '完全被宫缩与助产指令驱动用力，间歇瘫软如泥、连手指都不想抬。',
    body: '撕裂感与肠道压迫感、汗水浸透头发；遵循 laborPain 分级，描写不得越级。',
    psy: '本阶段心理写入幅度收窄，以身体叙事为主。',
  },
  第三产程: {
    summary: '娩出后的骤然轻松与虚脱并存；如释重负，随即被对婴儿的急切关注接管。',
    mood: '骤然的虚脱与如释重负，随即被第一声啼哭攫住——很多母亲在这里不受控制地哭。',
    behavior: '伸手要孩子、反复确认手脚齐全；累到连话都是碎的，却舍不得移开视线。',
    body: '胎盘娩出的余痛、全身颤抖、大汗后的虚凉；乳房已经开始为第一次哺乳做准备。',
    psy: 'bonding 瞬间拉满；产后数日是情绪低谷窗（baby blues），tracker 应留意走向。',
  },
  产后恢复: {
    summary: '恶露虚脱、激素断崖式下跌：情绪跌宕（产后抑郁窗口），同时母爱开始萌发；夜间哺乳疲惫与被需要感交织。',
    mood: '跌宕——前一秒幸福后一秒落泪，激素断崖不是比喻；对自己的脆弱既羞愧又无能为力。',
    behavior: '笨拙地学哺乳、睡眠被切成碎片、注意力围着孩子转；对身材与角色转变极其敏感。',
    body: '恶露、产后宫缩痛、伤口不适、虚汗不断；乳房从初乳走向涨奶，乳头的酸痛真实存在。',
    psy: 'bonding 与 cognition 持续演化；第3-10天是 baby blues 高发窗，情绪低谷应如实写入而非回避。',
  },
  哺乳期: {
    summary: '泌乳素主导：母爱外溢、哺乳时的亲密与安宁、对婴儿高度专注；情绪温柔而敏感，涨奶不排会烦躁。',
    mood: '温柔而敏感：被哺乳的安宁包裹，也更容易为小事红眼眶——一句「辛苦了」就能让她破防。',
    behavior: '注意力高度聚焦婴儿，听到哭声身体先于意识反应；当众哺乳的坦然或羞涩取决于人设。',
    body: '涨奶如钟表：不排就胀痛、硬块、溢奶（见乳意刻度与泌乳行）；乳头皲裂、饭量大、易渴易饿。',
    psy: 'bonding 高位运行；desire 回落但对亲密拥抱、被需要感的需求上升。',
  },
  围绝经期早期: {
    summary: '围绝经期开始（仍在周期内但走向终点）：周期忽长忽短、经量忽多忽少；潮热夜汗说来就来——半夜热醒掀被、白天突然一股燥热从胸口涌到脸。睡眠破碎、易怒与低落交替，性欲波动大；受孕能力已明显衰退但仍非绝对为零。',
    mood: '潮热夜汗随行：易怒与低落交替，自己也觉得「不像自己」，对失控的身体既恼火又心虚。',
    behavior: '半夜热醒掀被、白天无端扇风；对「老了」之类的字眼敏感；性欲忽高忽低，自己也摸不准。',
    body: '阵发燥热从胸口涌到脸、心悸、睡眠破碎；周期开始不守规矩——提前、推迟、量多变少都正常。',
    psy: '情压与 cognition（对身体变化的认知）双向拉锯；mastery 被打乱，需要重新学习自己的身体。',
  },
  围绝经期晚期: {
    summary: '围绝经期晚期（周期彻底紊乱）：该来的月经时来时不来、经量忽多忽少，紊乱出血段反复出现，谁也不知道哪一次才是最后一次；潮热夜汗达到顶峰，情绪如坐过山车，阴道干涩初现；对「还能不能怀孕」的答案越来越接近「不能」，对衰老与自由的感受同时涌来。',
    mood: '过山车：潮热顶峰与情绪波动顶峰叠加；被紊乱周期反复折腾，一边盼着它彻底结束、一边又怕它真的结束。',
    behavior: '接受周期正在谢幕：卫生用品永远备着但总说不准用不用得上；开始把注意力从「会不会来」挪回自己身上。',
    body: '紊乱出血反复出现、夜汗浸衣、阴道干涩初现；亲密时的润滑开始需要时间与耐心。',
    psy: 'mastery 面对彻底失控的周期；desire 在波动中寻找不依赖周期的新平衡。',
  },
  停经: {
    summary: '停经（绝经后）：卵巢功能落幕，月经永久停止，自然受孕可能归零。潮热夜汗在停经头几年仍会袭来，随后逐年减轻；阴道干涩与润滑变慢是常态，需要更长的前戏与耐心；雌激素退场后雄激素相对占上风——部分女性迎来「第二春」，欲望更直接、更不为生育所困。身体进入不再被周期摆动的平稳与自由。',
    mood: '不再被周期摆动：平稳、自由，情绪不再按月充值崩扣；部分人迎来「第二春」——欲望更直接、更忠于自己。',
    behavior: '对性与亲密更敢说出口：要或不要都直接讲，不再被「危险期」绑架；把省下的精力还给自己。',
    body: '潮热逐年减轻但头几年仍在；干涩与润滑变慢是常态，亲密需要更久的前戏与耐心；钙流失与体力变化是长线课题。',
    psy: 'desire 的走向由角色与关系决定，而非生理峰值；cognition 帮她把「衰老」重写成「自由」。',
  },
  无经期: {
    summary: '周期停摆：没有月经的生理状态（用药、体质或初潮前），情绪不受周期摆动。',
    mood: '无周期起伏，情绪稳定于角色本身。',
    behavior: '依角色本来的性格与处境演出即可。',
    body: '无月经及相关体征。',
    psy: '无周期倾向，按剧情与角色本来面目写入。',
  },
  未激活: {
    summary: '尚未开始追踪，无周期数据。',
    mood: '',
    behavior: '',
    body: '',
    psy: '',
  },
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
    } else if (stage === '黄体期') {
      riskLine = '黄体期，排卵已过但卵子存活期内受孕概率较低（非零）';
    } else if (stage === '产后恢复') {
      riskLine = '产后恢复期，排卵尚未恢复，暂不会受孕';
    } else if (MENSTRUAL_STAGES.includes(stage)) {
      riskLine = '非排卵期，当前无成熟卵子可受精';
    } else if (PREGNANCY_STAGES.includes(stage) || LABOR_STAGES.includes(stage) || stage === '产兆前驱') {
      riskLine = '妊娠中';
    }
    if (riskLine) facts.push(riskLine);

    // 关系语境
    if (marriageMate) facts.push(`婚姻对象是${marriageMate}`);
    else if (emotionalMate) facts.push(`情感对象是${emotionalMate}`);

    // 避孕态度推导（描述给模型看，不是硬规则）
    const attitude = [];
    if (riskLine.includes('受孕可能几乎为零') || riskLine.includes('不会受孕')) {
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
    if (attitude.length === 0 && riskLine === '妊娠中') {
      attitude.push('妊娠中的性以彼此舒适与安全为先');
    }

    // 慢层画像：性爱观与癖好（注册时定，工具不改）。hasContraception 只在
    // psy 可用时传入——psy 关闭时不该凭空断言「她没在避孕」。
    const portrait = describeSexualityLines(item?.profile?.sexuality, {
      hasContraception: psychology?.mens ? hasContraception : undefined,
      autonomyValue: psychology?.mens?.autonomy_value,
    });

    if (facts.length > 0 || attitude.length > 0) {
      lines.push(`- ${displayName}：${[...facts, ...attitude].join('；')}。`);
      lines.push(...portrait);
    } else if (portrait.length > 0) {
      lines.push(`- ${displayName}：`);
      lines.push(...portrait);
    }
  }
  if (lines.length === 0) return '';
  return [
    '[性与避孕态度]',
    '以下是按角色当前生理阶段、关系状态与其稳定性爱观推导的态度参考；写亲密场景时必须把它纳入叙事——她会不会答应、需不需要感情前提、主动还是被动、要不要戴套、接不接受内射，都取决于这里给出的语境，不要凭黄文惯性一律写成无套且来者不拒。缩排行是该角色的长期癖好画像，除剧情明确改变外应保持一致。',
    ...lines,
  ].join('\n');
}

/**
 * 把 (stage, days, limit) 映射到目录键。
 * 三处分带：黄体期按 PMS 窗口分早晚；卵泡期、月经期按半程分早晚——
 * 头半段是「恢复/高峰」，后半段是「爬升/收尾」，演出基调不同。
 */
export function getHormonePhaseKey(stage, days = 0, limit = 0) {
  const key = String(stage || '').trim();
  const numericDays = Math.max(0, Number(days) || 0);
  const numericLimit = Math.max(0, Number(limit) || 0);
  if (key === '黄体期') {
    if (numericLimit > 0 && numericDays > numericLimit - LUTEAL_LATE_WINDOW_DAYS) return '黄体期晚';
    return '黄体期早';
  }
  if (key === '卵泡期') {
    const half = (numericLimit > 0 ? numericLimit : 9) / 2;
    return numericDays > half ? '卵泡期晚' : '卵泡期早';
  }
  if (key === '月经期') {
    const half = (numericLimit > 0 ? numericLimit : 5) / 2;
    return numericDays > half ? '月经后期' : '月经初期';
  }
  return key;
}

/**
 * 阶段进度文本（人类可读），供 prompt 里直接理解「现在处于周期哪一点」。
 * 月经阶段按实际长度（ratio 不发，就用默认 28 天标尺）；
 * 妊娠按 0-280 标尺换算孕周；产后/哺乳按 bio 天数；停经满一年换算年。
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
  if (stage === '停经') {
    if (days >= 365) return `停经 ${Math.floor(days / 365)}年+（周期永久停止）`;
    return `停经 ${days}天（周期永久停止）`;
  }
  if (LABOR_STAGES.includes(stage)) {
    const phase = String(pregnant.laborPhase || '').trim();
    return phase ? `${stage}（${phase}）` : stage;
  }
  return stage;
}

/* ------------------------------------------------------------------ */
/* 每角色派生维度：欲求档位 / 孕程里程碑 / 产后窗口 / 泌乳与断奶倒计时 */
/* ------------------------------------------------------------------ */

/** 欲求档位：libido 数值 → 词。阶段基调交给目录，这里只给「她此刻身体里的刻度」。 */
const LIBIDO_TIERS = Object.freeze([
  [80, '炽烈难耐'],
  [60, '心动不安'],
  [40, '微澜轻起'],
  [20, '平淡'],
  [0, '沉寂'],
]);

function describeLibidoTier(base = {}) {
  const libido = Number(base.libido);
  if (!Number.isFinite(libido)) return '';
  for (const [threshold, label] of LIBIDO_TIERS) {
    if (libido >= threshold) return label;
  }
  return '沉寂';
}

/** 产程与产兆阶段不挂欲求行：正在生的角色谈欲求是噪音。 */
const LIBIDO_SKIP_STAGES = new Set([...LABOR_STAGES, '产兆前驱']);

function buildCharacterDesireSuffix(base = {}) {
  const age = Number(base.age);
  if (!Number.isFinite(age) || age < 18) return '';
  const stage = String(base.stage || '').trim();
  if (LIBIDO_SKIP_STAGES.has(stage)) return '';
  const tier = describeLibidoTier(base);
  return tier ? `｜欲求：${tier}` : '';
}

/** 孕程里程碑：按有效孕龄给一个「本周会发生什么」的叙事钩子。 */
function describePregnancyMilestone(pregnant = {}) {
  const effective = Math.max(0, Number(pregnant.effectivePregnantDays) || 0);
  const week = Math.floor(effective / 7) + 1;
  let milestone;
  if (effective < 28) milestone = '着床不久，多数征兆尚未登场，验孕临近可测';
  else if (effective < 98) milestone = '孕吐与疲劳的高发窗';
  else if (effective < 112) milestone = '孕吐开始退潮，小腹初显';
  else if (effective < 176) milestone = '初感胎动的窗口——像鱼吐泡或蝴蝶扇翅（头胎偏晚、经产偏早）';
  else if (effective < 210) milestone = '胎动渐成规律，腹部已明显';
  else if (effective < 245) milestone = '胎动有力、假性宫缩开始造访';
  else if (effective < 273) milestone = '胎儿入盆，胃口与呼吸稍松、坠胀加重';
  else if (effective < 280) milestone = '足月边缘，随时可能发动';
  else milestone = '足月已过，逾期待产';
  return `  · 孕程：孕第${week}周——${milestone}`;
}

/** 产后窗口：按产后天数给恢复/情绪窗口。 */
function describePostpartumWindow(base = {}) {
  const days = Math.max(0, Number(base.days) || 0);
  let window;
  if (days < 3) window = '恶露高峰与初乳到来，身体最虚的三天';
  else if (days < 10) window = 'baby blues 窗口——情绪低谷与莫名落泪高发，最需要被照料';
  else if (days < 28) window = '恶露转淡、体力缓复，正在适应新节律';
  else window = '身体接近常态；42天产后检查前后可评估恢复房事';
  return `  · 产后：第${days + 1}天——${window}`;
}

/** 泌乳行：距上次有效哺乳的天数决定胀感；断奶窗口倒计时（用进废退）。 */
function describeLactationLine(base = {}) {
  const sinceRelief = Math.max(0, Number(base.daysSinceMilkRelief) || 0);
  let fullness;
  if (sinceRelief <= 0) fullness = '刚哺乳/排乳后，松软轻松';
  else if (sinceRelief === 1) fullness = '轻度充盈';
  else if (sinceRelief === 2) fullness = '明显胀满';
  else if (sinceRelief <= 4) fullness = '涨硬发烫、不动就溢';
  else fullness = '胀痛难忍、有硬块风险（持续不排将走向回奶）';
  const windowDays = Number(base.lactationDaysLeft);
  const left = Number.isFinite(windowDays) && windowDays >= 0
    ? Math.floor(windowDays)
    : Math.max(0, LACTATION_DEFAULT_DAYS - sinceRelief);
  return `  · 泌乳：距上次有效哺乳${sinceRelief}天（${fullness}）；断奶窗口剩${left}天，持续哺乳会重置计时`;
}

/** 阶段专属派生行：孕期/产后/哺乳各一行，其余阶段没有（目录已覆盖）。 */
function buildCharacterDerivedLines(profile = {}) {
  const base = profile?.base || {};
  const stage = String(base.stage || '').trim();
  if (PREGNANCY_STAGES.includes(stage)) return describePregnancyMilestone(profile?.pregnant || {});
  if (stage === '产后恢复') return describePostpartumWindow(base);
  if (stage === '哺乳期') return describeLactationLine(base);
  return '';
}

/* ------------------------------------------------------------------ */
/* 阶段键收集与共享目录                                               */
/* ------------------------------------------------------------------ */

/** 只为分带用的粗略上限；精确值 tracker 侧另有 getStageLimit */
function estimateStageLimit(stage, item) {
  const bio = item?.profile?.bio || {};
  const defaults = { 卵泡期: 9, 排卵期: 2, 黄体期: 12, 月经期: 5 };
  if (defaults[stage]) return Math.max(1, defaults[stage] * (Math.max(0.1, Number(bio.menstrualLengthRatio) || 1)));
  return 0;
}

/**
 * 围绝经期早期不是阶段机里的真阶段——它只是「停经前 5 年的月经阶段角色」的
 * 年龄派生键。这里补进共享目录，让中年角色的潮热初现也能被演出来。
 * bio.menopauseAge 不入 payload，用默认标尺（同 estimateStageLimit 的取舍）。
 */
function isPerimenopauseEarly(item) {
  const base = item?.profile?.base || {};
  const age = Number(base.age);
  if (!Number.isFinite(age)) return false;
  if (!MENSTRUAL_STAGES.includes(String(base.stage || '').trim())) return false;
  const threshold = MENOPAUSE_DEFAULT_AGE - PERIMENOPAUSE_EARLY_YEARS;
  return age >= threshold && age < MENOPAUSE_DEFAULT_AGE;
}

function collectHormonePhases(existingState) {
  const found = new Set();
  if (!existingState || typeof existingState !== 'object') return [];
  for (const item of Object.values(existingState)) {
    const base = item?.profile?.base || {};
    const stage = String(base.stage || '').trim();
    if (!stage) continue;
    found.add(getHormonePhaseKey(stage, base.days, estimateStageLimit(stage, item)));
    if (isPerimenopauseEarly(item)) found.add('围绝经期早期');
  }
  return [...found];
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
    companionship: '阻塞·伴意＝社交回避',
  },
  acceleration: {
    excretion: '快积·泄意＝频尿',
    hunger: '快积·饿意＝容易饿、奇特饮食偏好',
    sleep: '快积·困意＝晕眩嗜睡',
    milk: '快积·乳意＝乳意快升、溢乳',
    companionship: '快积·伴意＝黏人',
  },
  expansion: {
    excretion: '扩容·泄意＝水肿、肠道慢蠕动',
    hunger: '扩容·饿意＝养分母体优先',
    milk: '扩容·乳意＝胸部沉重饱满',
    sleep: '扩容·困意＝激素使精力旺盛（代偿）',
    companionship: '扩容·伴意＝胎儿内在陪伴感',
  },
});

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
 * 空状态返回 ''。内容：每角色进度行（+欲求档位/阶段派生行）+ 在场阶段演出指引
 * （情绪/行为/身体三维）+ 多胎提示 + 症状图例 + 代谢刻度 + 性态度。
 */
export function buildHormoneContextBlock(payload = {}) {
  const existingState = payload?.existing_state && typeof payload.existing_state === 'object' ? payload.existing_state : {};
  const entries = Object.entries(existingState);
  if (entries.length === 0) return '';

  const lines = [
    '[周期与激素状态]',
    '以下由系统按各角色生理数据实时推演，是对「此刻的她」的演出指令：写这些角色的对白、动作、情绪与身体反应时必须贴合当期画像；超出画像的剧烈情绪波动需要剧情给出明确理由。不要在回复中复述本节。',
  ];

  for (const [name, item] of entries) {
    const profile = item?.profile || {};
    const progress = formatStageProgress(profile);
    const displayName = String(item?.name || name);
    if (item?.offscreen === true) {
      lines.push(`- ${displayName}：（幕外）${progress}`);
      continue;
    }
    lines.push(`- ${displayName}：${progress}${buildCharacterDesireSuffix(profile.base || {})}`);
    const derived = buildCharacterDerivedLines(profile);
    if (derived) lines.push(derived);
  }

  const phaseKeys = collectHormonePhases(existingState);
  const profileEntries = phaseKeys
    .map((key) => [key, HORMONE_PHASE_CATALOG[key]])
    .filter(([, entry]) => Boolean(entry));
  if (profileEntries.length > 0) {
    lines.push('', '当期阶段演出指引（三维都来自当前激素状态，应自然织入叙事而非罗列）：');
    for (const [key, entry] of profileEntries) {
      lines.push(`◆ ${key}——${entry.summary}`);
      if (entry.mood) lines.push(`    情绪：${entry.mood}`);
      if (entry.behavior) lines.push(`    行为：${entry.behavior}`);
      if (entry.body) lines.push(`    身体：${entry.body}`);
    }
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

/**
 * tracker 系统 prompt 用的目录片段：只描述在场阶段，附「心理写入倾向」——
 * 让 tracker 写 psychology / diary 时方向与当期激素一致。
 */
export function describeHormonePhases(payload = {}) {
  const existingState = payload?.existing_state && typeof payload.existing_state === 'object' ? payload.existing_state : {};
  const phaseKeys = collectHormonePhases(existingState);
  const lines = [];
  for (const key of phaseKeys) {
    const entry = HORMONE_PHASE_CATALOG[key];
    if (!entry) continue;
    lines.push(`- ${key}——${entry.summary}`);
    if (entry.psy) lines.push(`  心理写入：${entry.psy}`);
  }
  if (lines.length === 0) return '';
  return [
    '[当期激素阶段画像]',
    '以下是角色当前所处阶段的激素与情绪基调；调用 bsUpdatePsychology / bsWriteDiary 时应与之一致，大幅偏离当期激素的表现需要剧情给出明确理由。「心理写入」行给出该阶段各心理轴的倾向方向。',
    ...lines,
  ].join('\n');
}
