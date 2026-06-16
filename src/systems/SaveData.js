// SaveData - 局外（meta）存档系统
// 职责：
//  · 资金、声望、出击次数等元数据
//  · 仓库（已收藏的文物实例，区别于 Codex 只记 id）
//  · 当前接取的委托（contract）
//  · 装备配装（loadout）与已购工具（ownedTools）
//  · 提供给 HubScene / MuseumScene / ResultScene 的统一读写接口
//
// 存储 key = 'nightkeeper:save'
//
// 与 Codex 的关系：Codex 仍然负责"图鉴是否解锁 / 历史撤离统计"，
// SaveData 负责"流程经济 + 配装 + 委托"。两者并存。

import {
  TOOLS,
  getToolById,
  CONSUMABLES,
  getConsumableById,
  WEAPONS,
  getWeaponById,
  getStarterWeaponId
} from '../data/tools.js';
import SaveSlots from './SaveSlots.js';

const BASE_KEY = 'nightkeeper:save';
function storageKey() { return SaveSlots.slotKey(BASE_KEY); }

const STARTER_GOLD = 200;
const STARTER_TOOLS = ['silent_shoes']; // 起手送一双消音鞋
const STARTER_WEAPONS = ['short_blade']; // 起手送一柄青锋短刃

function emptyState() {
  return {
    gold: STARTER_GOLD,
    rep: 0,
    runs: { total: 0, success: 0, fail: 0 },
    // 仓库：[{ id, name, dynasty, value, rarity, fromContract, at }]
    vault: [],
    // 已购工具 ID 集合
    ownedTools: STARTER_TOOLS.slice(),
    // 已购武器 ID 集合
    ownedWeapons: STARTER_WEAPONS.slice(),
    // 装备槽：head / feet / tool / sub / weapon
    loadout: { head: null, feet: 'silent_shoes', tool: null, sub: null, weapon: 'short_blade' },
    // 安全箱：从仓库预选 1 件文物 ID（失败不丢）
    safeBox: null,
    // 当前接取的委托对象（结构见 contracts.js）
    activeContract: null,
    // 已完成委托 ID 列表
    completedContracts: [],
    // 已刷新出来的可接委托池（用局内游戏天数 gameDay 控制刷新）
    contractPool: null,
    contractPoolDay: -1,
    // 局内游戏天数 — 每次出击后自动 +1，控制委托板自动刷新
    gameDay: 1,
    // 消耗品库存（可重复购买、关卡内使用）
    consumables: { medkit: 0 },
    // 通用 flag 池（馆长是否见过、上次行动结果等剧情/UI 状态）
    flags: {},
    // 结局判定与馆长复盘所需的累计统计
    //   totalKills      · 累计击杀守卫数
    //   totalAlerts     · 累计被发现次数（alert 警报触发计数）
    //   totalGhostRuns  · 累计「未被发现且未击杀」的成功撤离次数
    //   totalSpent      · 商店 / 刷新 / 制作 累计花费金额
    stats: { totalKills: 0, totalAlerts: 0, totalGhostRuns: 0, totalSpent: 0 }
  };
}

function safeParse(raw) {
  if (!raw) return emptyState();
  try {
    const obj = JSON.parse(raw);
    const base = emptyState();
    return {
      gold: typeof obj.gold === 'number' ? obj.gold : base.gold,
      rep: typeof obj.rep === 'number' ? obj.rep : 0,
      runs: obj.runs || base.runs,
      vault: Array.isArray(obj.vault) ? obj.vault : [],
      ownedTools: Array.isArray(obj.ownedTools) ? obj.ownedTools : base.ownedTools,
      ownedWeapons: Array.isArray(obj.ownedWeapons) && obj.ownedWeapons.length
        ? obj.ownedWeapons
        : base.ownedWeapons,
      loadout: Object.assign(
        { head: null, feet: null, tool: null, sub: null, weapon: getStarterWeaponId() },
        obj.loadout || {}
      ),
      safeBox: typeof obj.safeBox === 'string' ? obj.safeBox : null,
      activeContract: obj.activeContract || null,
      completedContracts: Array.isArray(obj.completedContracts) ? obj.completedContracts : [],
      contractPool: Array.isArray(obj.contractPool) ? obj.contractPool : null,
      contractPoolDay: typeof obj.contractPoolDay === 'number' ? obj.contractPoolDay : -1,
      gameDay: typeof obj.gameDay === 'number' && obj.gameDay > 0 ? obj.gameDay : 1,
      consumables: obj.consumables && typeof obj.consumables === 'object'
        ? Object.assign({ medkit: 0, smoke_bomb: 0, qinggong_talisman: 0 }, obj.consumables)
        : { medkit: 0, smoke_bomb: 0, qinggong_talisman: 0 },
      flags: obj.flags && typeof obj.flags === 'object' ? obj.flags : {},
      stats: Object.assign(
        { totalKills: 0, totalAlerts: 0, totalGhostRuns: 0, totalSpent: 0 },
        (obj.stats && typeof obj.stats === 'object') ? obj.stats : {}
      )
    };
  } catch {
    return emptyState();
  }
}

function load() {
  if (typeof localStorage === 'undefined') return emptyState();
  return safeParse(localStorage.getItem(storageKey()));
}

function save(state) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(storageKey(), JSON.stringify(state));
  } catch {
    /* 忽略持久化失败 */
  }
}

export const SaveData = {
  /** 完整状态副本 */
  getState() {
    return load();
  },

  // —— 资源 ——
  getGold() { return load().gold; },
  getRep() { return load().rep; },

  addGold(delta) {
    const s = load();
    s.gold = Math.max(0, s.gold + delta);
    save(s);
    return s.gold;
  },

  addRep(delta) {
    const s = load();
    s.rep += delta;
    save(s);
    return s.rep;
  },

  // —— 仓库 ——
  getVault() { return load().vault; },

  addToVault(items, contractId = null) {
    if (!items || !items.length) return;
    const s = load();
    const now = Date.now();
    for (const it of items) {
      if (!it || !it.id) continue;
      s.vault.push({
        id: it.id,
        name: it.name,
        dynasty: it.dynasty,
        value: it.value,
        rarity: it.rarity,
        fromContract: contractId,
        at: now
      });
    }
    save(s);
  },

  /** 从仓库中卖出一件（按索引），返回获得的金币 */
  sellVaultItem(index) {
    const s = load();
    if (index < 0 || index >= s.vault.length) return 0;
    const it = s.vault[index];
    const gold = Math.floor(it.value * 0.7); // 自留 70% 价值
    s.vault.splice(index, 1);
    s.gold += gold;
    save(s);
    return gold;
  },

  // —— 安全箱 （存仓库中的一件文物 ID，失败不丢）——
  getSafeBox() {
    const s = load();
    if (!s.safeBox) return null;
    // 返回仓库里该 ID 的实例（取第一个匹配）
    return s.vault.find((v) => v.id === s.safeBox) || null;
  },

  /** 设置安全箱预选：itemId = 仓库中某文物的 id；null = 清空 */
  setSafeBox(itemId) {
    const s = load();
    if (itemId !== null) {
      const exists = s.vault.some((v) => v.id === itemId);
      if (!exists) return false;
    }
    s.safeBox = itemId;
    save(s);
    return true;
  },

  // —— 工具 / 配装 ——
  getOwnedTools() { return load().ownedTools; },
  getLoadout() { return load().loadout; },

  ownsTool(toolId) {
    return load().ownedTools.includes(toolId);
  },

  /** 购买工具，成功返回 true；金币不足或已拥有则 false */
  buyTool(toolId) {
    const tool = getToolById(toolId);
    if (!tool) return false;
    const s = load();
    if (s.ownedTools.includes(toolId)) return false;
    if (s.gold < tool.price) return false;
    s.gold -= tool.price;
    s.ownedTools.push(toolId);
    s.stats = s.stats || { totalKills: 0, totalAlerts: 0, totalGhostRuns: 0, totalSpent: 0 };
    s.stats.totalSpent = (s.stats.totalSpent || 0) + tool.price;
    save(s);
    return true;
  },

  /** 把工具装备到指定槽位；toolId=null 即卸下 */
  equip(slot, toolId) {
    const s = load();
    if (!['head', 'feet', 'tool', 'sub'].includes(slot)) return false;
    if (toolId !== null) {
      const tool = getToolById(toolId);
      if (!tool) return false;
      if (!s.ownedTools.includes(toolId)) return false;
      if (tool.slot !== slot) return false;
    }
    s.loadout[slot] = toolId;
    save(s);
    return true;
  },

  // —— 武器 ——
  getOwnedWeapons() {
    const s = load();
    return Array.isArray(s.ownedWeapons) && s.ownedWeapons.length
      ? s.ownedWeapons.slice()
      : STARTER_WEAPONS.slice();
  },
  ownsWeapon(weaponId) { return this.getOwnedWeapons().includes(weaponId); },
  getEquippedWeaponId() {
    const s = load();
    return (s.loadout && s.loadout.weapon) || getStarterWeaponId();
  },
  getEquippedWeapon() {
    return getWeaponById(this.getEquippedWeaponId());
  },

  /** 购买武器，成功返回 true；金币不足或已拥有则 false */
  buyWeapon(weaponId) {
    const w = getWeaponById(weaponId);
    if (!w) return false;
    const s = load();
    s.ownedWeapons = s.ownedWeapons || [];
    if (s.ownedWeapons.includes(weaponId)) return false;
    if ((s.gold || 0) < (w.price || 0)) return false;
    s.gold -= w.price || 0;
    s.ownedWeapons.push(weaponId);
    s.stats = s.stats || { totalKills: 0, totalAlerts: 0, totalGhostRuns: 0, totalSpent: 0 };
    s.stats.totalSpent = (s.stats.totalSpent || 0) + (w.price || 0);
    save(s);
    return true;
  },

  /** 装备武器到 weapon 槽；null 会回退到 starter 武器（不允许空手） */
  equipWeapon(weaponId) {
    const s = load();
    s.loadout = s.loadout || {};
    if (weaponId === null) {
      s.loadout.weapon = getStarterWeaponId();
    } else {
      if (!getWeaponById(weaponId)) return false;
      s.ownedWeapons = s.ownedWeapons || [];
      if (!s.ownedWeapons.includes(weaponId)) return false;
      s.loadout.weapon = weaponId;
    }
    save(s);
    return true;
  },

  /** 把当前装备解析为运行时效果对象（供 MuseumScene 读取） */
  resolveEffects() {
    const s = load();
    const eff = {
      stealthBonus: 0,        // 警觉增长倍率：1 - sum
      visionBonus: 0,         // 视野亮度提升
      pickSpeedMul: 1,        // 拾取耗时倍率
      extractCdMul: 1,        // 撤离冷却倍率
      hasDart: false,         // 是否带麻醉针
      hasBeacon: false,
      tools: [],
      weapon: null            // 当前装备的武器定义
    };
    for (const slot of ['head', 'feet', 'tool', 'sub']) {
      const id = s.loadout[slot];
      if (!id) continue;
      const tool = getToolById(id);
      if (!tool) continue;
      eff.tools.push(tool);
      if (tool.effects) {
        if (tool.effects.stealthBonus) eff.stealthBonus += tool.effects.stealthBonus;
        if (tool.effects.visionBonus) eff.visionBonus += tool.effects.visionBonus;
        if (tool.effects.pickSpeedMul) eff.pickSpeedMul *= tool.effects.pickSpeedMul;
        if (tool.effects.extractCdMul) eff.extractCdMul *= tool.effects.extractCdMul;
        if (tool.effects.hasDart) eff.hasDart = true;
        if (tool.effects.hasBeacon) eff.hasBeacon = true;
      }
    }
    // 武器槽：默认 starter
    const wid = (s.loadout && s.loadout.weapon) || getStarterWeaponId();
    eff.weapon = getWeaponById(wid) || null;
    return eff;
  },

  // —— 委托 ——
  getActiveContract() { return load().activeContract; },

  setActiveContract(contract) {
    const s = load();
    s.activeContract = contract || null;
    save(s);
  },

  /** 提交委托结果（通常由 ResultScene 在结算时调用）
   *  @returns {object} { contract, met, goldReward, repReward, penalty }
   */
  resolveActiveContract(broughtItems = []) {
    const s = load();
    const c = s.activeContract;
    if (!c) return null;
    const result = evaluateContract(c, broughtItems);
    if (result.met) {
      s.gold += result.goldReward;
      s.rep += result.repReward;
      s.completedContracts.push(c.id);
    } else {
      s.rep += result.penalty; // penalty 为负数
    }
    s.activeContract = null;
    save(s);
    return result;
  },

  getContractPool(currentDay) {
    const s = load();
    if (s.contractPoolDay === currentDay && Array.isArray(s.contractPool)) {
      return s.contractPool;
    }
    return null;
  },

  setContractPool(currentDay, pool) {
    const s = load();
    s.contractPoolDay = currentDay;
    s.contractPool = pool;
    save(s);
  },

  // —— 局内游戏天数：控制委托板刷新节奏 ——
  getGameDay() { return load().gameDay || 1; },

  /** 推进一天（一次行动结束后调用）。返回新的 gameDay。 */
  bumpGameDay() {
    const s = load();
    s.gameDay = (s.gameDay || 1) + 1;
    // 推进后上一天的委托池过期，下次进委托板会重生
    save(s);
    return s.gameDay;
  },

  /** 主动花金刷新委托池。返回是否成功。 */
  rerollContractPool(cost = 50) {
    const s = load();
    if (s.gold < cost) return false;
    s.gold -= cost;
    s.stats = s.stats || { totalKills: 0, totalAlerts: 0, totalGhostRuns: 0, totalSpent: 0 };
    s.stats.totalSpent = (s.stats.totalSpent || 0) + cost;
    s.contractPool = null;
    s.contractPoolDay = -1;
    save(s);
    return true;
  },

  // —— 消耗品 ——
  /** 返回一份消耗品库存副本（不包含未定义的） */
  getConsumables() {
    const s = load();
    return Object.assign({ medkit: 0, smoke_bomb: 0, qinggong_talisman: 0 }, s.consumables || {});
  },

  /** 为某种消耗品增加库存。返回新库存。 */
  addConsumable(id, n = 1) {
    const s = load();
    s.consumables = s.consumables || { medkit: 0, smoke_bomb: 0, qinggong_talisman: 0 };
    s.consumables[id] = (s.consumables[id] || 0) + n;
    save(s);
    return s.consumables[id];
  },

  /** 消耗一个。库存 0 返回 false；否则减一返回 true。 */
  consumeConsumable(id) {
    const s = load();
    s.consumables = s.consumables || { medkit: 0, smoke_bomb: 0, qinggong_talisman: 0 };
    if ((s.consumables[id] || 0) <= 0) return false;
    s.consumables[id] -= 1;
    save(s);
    return true;
  },

  /** 购买消耗品一枚（可重复购买）。返回是否成功。 */
  buyConsumable(id) {
    const c = getConsumableById(id);
    if (!c) return false;
    const s = load();
    if (s.gold < c.price) return false;
    s.gold -= c.price;
    s.consumables = s.consumables || { medkit: 0, smoke_bomb: 0, qinggong_talisman: 0 };
    s.consumables[id] = (s.consumables[id] || 0) + 1;
    s.stats = s.stats || { totalKills: 0, totalAlerts: 0, totalGhostRuns: 0, totalSpent: 0 };
    s.stats.totalSpent = (s.stats.totalSpent || 0) + c.price;
    save(s);
    return true;
  },

  // —— 局外结算 ——
  /** 提交一次出击结果。MuseumScene 在结算时调用。
   *  这里只更新 runs 计数和把文物入仓库。委托判定由 ResultScene 单独触发。
   */
  commitRun({ success, items = [], baseReward = 0 }) {
    const s = load();
    s.runs.total += 1;
    if (success) {
      s.runs.success += 1;
      // 撤离基础奖励：每件文物 30% 价值即时入账（剩余 70% 仍留在仓库可卖）
      const cashIn = Math.floor(items.reduce((a, b) => a + (b.value || 0), 0) * 0.3) + baseReward;
      s.gold += cashIn;
    } else {
      s.runs.fail += 1;
    }
    save(s);
    return s;
  },

  /** 调试：清空当前槽位的存档（不影响 Codex） */
  reset() {
    if (typeof localStorage !== 'undefined') {
      try { localStorage.removeItem(storageKey()); } catch { /* ignore */ }
    }
  },

  // —— 统计（结局判定与馆长复盘）——
  /** 获取一份统计副本 */
  getStats() {
    const s = load();
    return Object.assign({ totalKills: 0, totalAlerts: 0, totalGhostRuns: 0, totalSpent: 0 }, s.stats || {});
  },

  /** 给某个统计计数加上 delta（可为负）。返回新值。 */
  bumpStat(key, delta = 1) {
    const s = load();
    s.stats = Object.assign({ totalKills: 0, totalAlerts: 0, totalGhostRuns: 0, totalSpent: 0 }, s.stats || {});
    s.stats[key] = Math.max(0, (s.stats[key] || 0) + delta);
    save(s);
    return s.stats[key];
  },

  /** 快捷访问几个 runs 字段。 */
  getRunsTotal()   { return (load().runs && load().runs.total)   || 0; },
  getRunsSuccess() { return (load().runs && load().runs.success) || 0; },
  getRunsFail()    { return (load().runs && load().runs.fail)    || 0; },


  // —— flag：通用标记位（剧情/UI 状态） ——
  getFlag(key, fallback = null) {
    const s = load();
    return s.flags && key in s.flags ? s.flags[key] : fallback;
  },
  setFlag(key, value) {
    const s = load();
    s.flags = s.flags || {};
    s.flags[key] = value;
    save(s);
  }
};

/** 判定一份委托是否达成
 *  contract.requirement 形态：
 *    { type: 'rarity', rarity: 'epic', count: 2 }     至少带回 N 件指定品级
 *    { type: 'relic',  relicId: 'da_ke_ding' }        带回指定文物
 *    { type: 'value',  amount: 80 }                    单局合计价值 ≥ amount
 *    { type: 'count',  count: 3 }                      单局至少 N 件
 */
function evaluateContract(contract, items) {
  const req = contract.requirement || {};
  let met = false;
  if (req.type === 'rarity') {
    const cnt = items.filter((r) => r.rarity === req.rarity).length;
    met = cnt >= (req.count || 1);
  } else if (req.type === 'relic') {
    met = items.some((r) => r.id === req.relicId);
  } else if (req.type === 'value') {
    const sum = items.reduce((a, b) => a + (b.value || 0), 0);
    met = sum >= (req.amount || 0);
  } else if (req.type === 'count') {
    met = items.length >= (req.count || 1);
  }
  return {
    contract,
    met,
    goldReward: met ? (contract.goldReward || 0) : 0,
    repReward: met ? (contract.repReward || 0) : 0,
    penalty: met ? 0 : (contract.failPenalty || 0)
  };
}

// 导出工具表方便外部直接 import
export { TOOLS, CONSUMABLES, WEAPONS };
export default SaveData;
