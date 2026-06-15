// 装备工具数据表
// 每件工具占用一个槽位（head / feet / tool / sub）
// 一次出击玩家最多装备 4 件
//
// 消耗品（不占槽位，为可重复购买的数量型道具）在 CONSUMABLES 中维护
//
// effects 各字段含义（被 SaveData.resolveEffects 聚合）：
//   stealthBonus    警觉增长抑制（0.3 表示警觉 -30%）
//   visionBonus     视野亮度提升（0.3 表示亮度 +30%）
//   pickSpeedMul    拾取耗时倍率（<1 即更快）
//   extractCdMul    撤离倒计时倍率（<1 即更快）
//   hasDart         携带麻醉针消耗品
//   hasBeacon       携带撤离信标（撤离冷却减半，叠加 extractCdMul）

export const TOOLS = [
  {
    id: 'silent_shoes',
    name: '消音麻履',
    slot: 'feet',
    price: 0,
    icon: '👟',
    desc: '内衬蒲草，落地无声。',
    effects: { stealthBonus: 0.3 }
  },
  {
    id: 'lockpick',
    name: '九连撬',
    slot: 'tool',
    price: 120,
    icon: '🗝',
    desc: '宫匠打造的连环撬针，开柜如解九连环。',
    effects: { pickSpeedMul: 0.5 }
  },
  {
    id: 'night_vision',
    name: '玄铁夜瞳',
    slot: 'head',
    price: 180,
    icon: '🕶',
    desc: '以玄铁与油皮所制的夜行护目，月色皆为白昼。',
    effects: { visionBonus: 0.45 }
  },
  {
    id: 'sleep_dart',
    name: '醉仙乌梅',
    slot: 'sub',
    price: 90,
    icon: '🥢',
    desc: '一次性麻醉针。近身可使守卫昏睡六息。',
    effects: { hasDart: true }
  },
  {
    id: 'extract_beacon',
    name: '青鸾哨',
    slot: 'tool',
    price: 220,
    icon: '🪶',
    desc: '驯鸽传讯。撤离信标响起，接应者即至。',
    effects: { extractCdMul: 0.5, hasBeacon: true }
  }
];

export const SLOT_NAME = {
  head: '冠 / 首',
  feet: '履',
  tool: '器',
  sub: '囊中'
};

export function getToolById(id) {
  return TOOLS.find((t) => t.id === id) || null;
}

export function toolsBySlot(slot) {
  return TOOLS.filter((t) => t.slot === slot);
}

export default TOOLS;

// ———— 消耗品（可重复购买、入库存、关卡内热键使用）————
export const CONSUMABLES = [
  {
    id: 'medkit',
    name: '回春丸',
    icon: '⚕',
    price: 60,
    hotkey: 'H',
    effect: { type: 'heal', amount: 1 },
    desc: '身负一枚，险中求生。按 H 回 1 HP。'
  }
];

export function getConsumableById(id) {
  return CONSUMABLES.find((c) => c.id === id) || null;
}
