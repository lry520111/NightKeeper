// 委托数据表 + 委托池生成
// 每"天"刷新一次委托池，玩家从中选择一份接取。
// 接取后会保存到 SaveData.activeContract，撤离结算时由 SaveData.resolveActiveContract 判定。

import { RELICS } from './relics.js';

// 委托人头像（用 emoji 占位，后续可替换为像素头像）
const PATRONS = {
  collector: { name: '苏老爷', tag: '私人藏家', avatar: '🎩', color: '#d4af37' },
  scholar:   { name: '陆教授', tag: '考古学者', avatar: '📜', color: '#7ae8e8' },
  syndicate: { name: '黑面客', tag: '黑市掠客',   avatar: '🃏', color: '#c084fc' }
};

/** 模板池。生成时会按 daySeed 随机抽取并填充参数。 */
const CONTRACT_TEMPLATES = [
  // —— 私人藏家：要品级 ——
  {
    patron: 'collector',
    title: '为我追回一件传世名物',
    requirement: { type: 'rarity', rarity: 'legendary', count: 1 },
    goldReward: 320,
    repReward: 2,
    failPenalty: -1,
    quote: '它本就属于这片土地，我只是要让它回来。'
  },
  {
    patron: 'collector',
    title: '凑齐一对宋瓷',
    requirement: { type: 'rarity', rarity: 'epic', count: 2 },
    goldReward: 240,
    repReward: 1,
    failPenalty: 0,
    quote: '一件孤独，两件成对，缺一不可。'
  },
  // —— 学者：要具体文物 ——
  {
    patron: 'scholar',
    title: '论文急缺一手影像',
    requirementHint: '指定文物（每日不同）',
    isSpecificRelic: true, // 生成时随机挑一件
    goldReward: 200,
    repReward: 3,
    failPenalty: 0,
    quote: '它不该躺在别人的保险柜里。'
  },
  // —— 黑面客：高赏金、损声望（黑市重购，有伦理争议） ——
  {
    patron: 'syndicate',
    title: '今晚只看价钱',
    requirement: { type: 'value', amount: 120 },
    goldReward: 380,
    repReward: -2,
    failPenalty: -1,
    quote: '货出了黑市，不必问去哪。钱货两清。'
  },
  {
    patron: 'syndicate',
    title: '扫荡一柜货',
    requirement: { type: 'count', count: 3 },
    goldReward: 280,
    repReward: -1,
    failPenalty: -1,
    quote: '不挑，全要。'
  }
];

// —— 工具 ——
export function todayKey(now = Date.now()) {
  // 以本地日历日为单位（毫秒级精度对随机来说够用）
  const d = new Date(now);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 根据"日期种子"生成今日委托池（3 份） */
export function generateDailyContracts(daySeed) {
  const rand = mulberry32(daySeed * 9301 + 49297);
  // 抽 3 个互不相同的模板
  const idxPool = CONTRACT_TEMPLATES.map((_, i) => i);
  const pick = [];
  for (let i = 0; i < 3 && idxPool.length; i++) {
    const k = Math.floor(rand() * idxPool.length);
    pick.push(idxPool.splice(k, 1)[0]);
  }
  const out = [];
  for (let i = 0; i < pick.length; i++) {
    const tpl = CONTRACT_TEMPLATES[pick[i]];
    const patron = PATRONS[tpl.patron];
    let req = tpl.requirement;
    let title = tpl.title;
    if (tpl.isSpecificRelic) {
      const r = RELICS[Math.floor(rand() * RELICS.length)];
      req = { type: 'relic', relicId: r.id, relicName: r.name };
      title = `求一影：${r.name}`;
    }
    out.push({
      id: `c_${daySeed}_${i}`,
      title,
      patron,
      requirement: req,
      goldReward: tpl.goldReward,
      repReward: tpl.repReward,
      failPenalty: tpl.failPenalty,
      quote: tpl.quote
    });
  }
  return out;
}

/** 把需求格式化为人类可读的描述 */
export function describeRequirement(req) {
  if (!req) return '—';
  if (req.type === 'rarity') {
    const map = { legendary: '传说', epic: '史诗', rare: '稀有', common: '寻常' };
    return `带回 ${req.count || 1} 件【${map[req.rarity] || req.rarity}】品级文物`;
  }
  if (req.type === 'relic') return `带回指定文物：${req.relicName || req.relicId}`;
  if (req.type === 'value') return `单局合计价值 ≥ ${req.amount}`;
  if (req.type === 'count') return `单局至少带回 ${req.count} 件文物`;
  return '—';
}

export default { generateDailyContracts, describeRequirement, todayKey };
