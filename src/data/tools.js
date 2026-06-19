// 装备工具数据表
// 每件工具占用一个槽位（head / feet / tool / sub）
// 一次出击玩家最多装备 4 件
//
// 武器（WEAPONS）独立于工具，单独占一个 weapon 槽，影响近战/远程攻击的手感与数值
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
  sub: '囊中',
  weapon: '兵刃'
};

export function getToolById(id) {
  return TOOLS.find((t) => t.id === id) || null;
}

export function toolsBySlot(slot) {
  return TOOLS.filter((t) => t.slot === slot);
}

export default TOOLS;

// ============================================================
//   兵刃（武器）
// ============================================================
//
// 通用字段：
//   id / name / icon / price / desc            ─ 基本属性
//   kind        : 'melee' | 'ranged'           ─ 近战 / 远程
//   damage      : 单击伤害（守卫 HP=3，普攻 1，斩 2，重击 3）
//   range       : 命中半径（近战为扇形半径；远程为弹道最大射程像素）
//   arc         : 近战扇形半角（弧度）；远程不用
//   cooldownMs  : 出招间隔
//   staminaCost : 出招消耗（默认 14）
//   knockMul    : 击退倍率（默认 1）
//   noisy       : 真则触发距离内警觉（远程默认 false）
//   ─ 远程特有：
//     projectile : 'arrow' | 'shuriken'   弹体类型
//     speed      : 弹速 px/s
//     ammoMax    : 单局弹药上限（关卡内补给）
//   starter     : 初始默认武器（不可卖、永久持有）
export const WEAPONS = [
  // —— 冷兵器 ——
  {
    id: 'short_blade',
    name: '青锋短刃',
    kind: 'melee',
    icon: '🗡',
    price: 0,
    desc: '夜行司常备短刃。出招迅速，伤害平平。',
    damage: 1,
    range: 32,
    arc: Math.PI / 3,
    cooldownMs: 360,
    staminaCost: 14,
    knockMul: 1.0,
    noisy: true,
    starter: true
  },
  {
    id: 'broad_saber',
    name: '雁翎大刀',
    kind: 'melee',
    icon: '🗡',
    price: 260,
    desc: '边军遗留的雁翎刀，一刀两断。挥砍稍迟，伤害高、击退强。',
    damage: 2,
    range: 40,
    arc: Math.PI / 2.4,   // 75°
    cooldownMs: 540,
    staminaCost: 22,
    knockMul: 1.6,
    noisy: true
  },
  // —— 远程兵器 ——
  {
    id: 'shuriken',
    name: '飞蝗石',
    kind: 'ranged',
    projectile: 'shuriken',
    icon: '🟤',
    price: 200,
    desc: '袖中石子，连发不绝。伤害低但出手极快、声响小。',
    damage: 1,
    range: 200,
    speed: 360,
    cooldownMs: 240,
    staminaCost: 8,
    knockMul: 0.6,
    ammoMax: 12,
    noisy: false
  },
  {
    id: 'reverse_bow',
    name: '反曲短弓',
    kind: 'ranged',
    projectile: 'arrow',
    icon: '🏹',
    price: 380,
    desc: '改良反曲弓，劲道惊人。一箭穿心，可破甲；声响较大。',
    damage: 1,
    range: 320,
    speed: 540,
    cooldownMs: 720,
    staminaCost: 20,
    knockMul: 1.4,
    ammoMax: Infinity,
    noisy: true
  }
];

export function getWeaponById(id) {
  return WEAPONS.find((w) => w.id === id) || null;
}

export function getStarterWeaponId() {
  const w = WEAPONS.find((x) => x.starter);
  return w ? w.id : (WEAPONS[0] && WEAPONS[0].id) || null;
}

// ============================================================
//   消耗品（可重复购买、入库存、关卡内热键使用）
// ============================================================
export const CONSUMABLES = [
  {
    id: 'medkit',
    name: '回春丸',
    icon: '⚕',
    price: 60,
    hotkey: 'H',
    effect: { type: 'heal', amount: 1 },
    desc: '身负一枚，险中求生。按 H 回 1 HP。'
  },
  {
    id: 'smoke_bomb',
    name: '迷烟丸',
    icon: '💨',
    price: 80,
    hotkey: 'G',
    effect: { type: 'smoke', radius: 96, duration: 4500, alertDrop: 0.6 },
    desc: '掷地起烟，附近守卫警觉骤降。按 G 投放。'
  },
  {
    id: 'qinggong_talisman',
    name: '轻功符',
    icon: '🍃',
    price: 70,
    hotkey: 'V',
    effect: { type: 'qinggong', duration: 3500, speedMul: 1.7, silent: true },
    desc: '贴符即起，三息内疾走如风、足下无声。按 V 启用。'
  }
];

export function getConsumableById(id) {
  return CONSUMABLES.find((c) => c.id === id) || null;
}
