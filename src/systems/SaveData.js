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

import { TOOLS, getToolById } from '../data/tools.js';

const STORAGE_KEY = 'nightkeeper:save';

const STARTER_GOLD = 200;
const STARTER_TOOLS = ['silent_shoes']; // 起手送一双消音鞋

function emptyState() {
  return {
    gold: STARTER_GOLD,
    rep: 0,
    runs: { total: 0, success: 0, fail: 0 },
    // 仓库：[{ id, name, dynasty, value, rarity, fromContract, at }]
    vault: [],
    // 已购工具 ID 集合
    ownedTools: STARTER_TOOLS.slice(),
    // 装备槽：head / feet / tool / sub
    loadout: { head: null, feet: 'silent_shoes', tool: null, sub: null },
    // 当前接取的委托对象（结构见 contracts.js）
    activeContract: null,
    // 已完成委托 ID 列表
    completedContracts: [],
    // 已刷新出来的可接委托池（用 daySeed 控制每"天"刷新一次）
    contractPool: null,
    contractPoolDay: -1
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
      loadout: Object.assign({ head: null, feet: null, tool: null, sub: null }, obj.loadout || {}),
      activeContract: obj.activeContract || null,
      completedContracts: Array.isArray(obj.completedContracts) ? obj.completedContracts : [],
      contractPool: Array.isArray(obj.contractPool) ? obj.contractPool : null,
      contractPoolDay: typeof obj.contractPoolDay === 'number' ? obj.contractPoolDay : -1
    };
  } catch {
    return emptyState();
  }
}

function load() {
  if (typeof localStorage === 'undefined') return emptyState();
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

function save(state) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

  /** 把当前装备解析为运行时效果对象（供 MuseumScene 读取） */
  resolveEffects() {
    const s = load();
    const eff = {
      stealthBonus: 0,        // 警觉增长倍率：1 - sum
      visionBonus: 0,         // 视野亮度提升
      pickSpeedMul: 1,        // 拾取耗时倍率
      extractCdMul: 1,        // 撤离冷却倍率
      hasDart: false,         // 是否带麻醉针
      hasMedkit: false,       // 是否带急救包
      hasBeacon: false,
      tools: []
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
        if (tool.effects.hasMedkit) eff.hasMedkit = true;
        if (tool.effects.hasBeacon) eff.hasBeacon = true;
      }
    }
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

  /** 调试：清空全部存档（不影响 Codex） */
  reset() {
    if (typeof localStorage !== 'undefined') {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
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
export { TOOLS };
export default SaveData;
