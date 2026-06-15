// Codex - 文物百科 / 局外仓库系统
// 职责：
//  · 持久化记录玩家曾经成功撤离过的文物 ID（localStorage）
//  · 记录撤离次数、累计价值、最高单局价值等元数据
//  · 提供查询接口给 TitleScene / CodexScene 使用
//
// 存储格式（localStorage key = 'nightkeeper:codex'）:
//  {
//    relics: { [relicId]: { count, firstAt, lastAt } },
//    runs: { total, success, fail },
//    bestRun: { value, count, at },
//    totalValue: number
//  }

import SaveSlots from './SaveSlots.js';

const BASE_KEY = 'nightkeeper:codex';
function storageKey() { return SaveSlots.slotKey(BASE_KEY); }

function emptyState() {
  return {
    relics: {},
    runs: { total: 0, success: 0, fail: 0 },
    bestRun: { value: 0, count: 0, at: 0 },
    totalValue: 0
  };
}

function safeParse(raw) {
  if (!raw) return emptyState();
  try {
    const obj = JSON.parse(raw);
    // 兜底字段补齐
    return {
      relics: obj.relics || {},
      runs: obj.runs || { total: 0, success: 0, fail: 0 },
      bestRun: obj.bestRun || { value: 0, count: 0, at: 0 },
      totalValue: obj.totalValue || 0
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
    // 忽略持久化失败（隐私模式 / 配额满）
  }
}

export const Codex = {
  /** 读取完整状态（只读副本） */
  getState() {
    return load();
  },

  /** 已发现某文物 ID？ */
  hasDiscovered(relicId) {
    const s = load();
    return Boolean(s.relics[relicId]);
  },

  /** 已发现的文物 ID 集合 */
  discoveredIds() {
    const s = load();
    return Object.keys(s.relics);
  },

  /** 总完成局数 */
  totalRuns() {
    return load().runs.total;
  },

  /** 提交一次撤离结果，更新仓库
   *  @param {object} args
   *  @param {boolean} args.success 是否撤离成功
   *  @param {Array}   args.items   本局带出的文物（成功时计入仓库）
   *  @param {number}  args.value   合计价值
   */
  recordRun({ success, items = [], value = 0 }) {
    const s = load();
    s.runs.total += 1;
    if (success) {
      s.runs.success += 1;
      const now = Date.now();
      for (const r of items) {
        if (!r || !r.id) continue;
        const prev = s.relics[r.id];
        if (prev) {
          prev.count = (prev.count || 1) + 1;
          prev.lastAt = now;
        } else {
          s.relics[r.id] = { count: 1, firstAt: now, lastAt: now };
        }
      }
      s.totalValue += value;
      if (value > (s.bestRun.value || 0)) {
        s.bestRun = { value, count: items.length, at: now };
      }
    } else {
      s.runs.fail += 1;
    }
    save(s);
    return s;
  },

  /** 仅供调试 / 重置按钮（清当前槽位） */
  reset() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(storageKey());
      } catch {
        // ignore
      }
    }
  }
};

export default Codex;
