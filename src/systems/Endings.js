// Endings.js — 多结局判定
//
// 4 个结局：
//   归藏  (gui_cang)    — 文物 ≥ 6 件 + 累计击杀 = 0           "守夜人不杀生，只把器物请回家"
//   铁腕  (tie_wan)     — 文物 ≥ 5 件 + 累计击杀 ≥ 8           "代价是血，但国宝回家了"
//   市侩  (shi_kuai)    — 文物 < 5 件 + 累计消费 ≥ 1500        "你成了另一个倒爷"
//   夜行者(ye_xing_zhe) — 文物 ≥ 6 件 + 累计无伤通关 ≥ 3        "你从未存在过，但博物馆灯亮了" (隐藏)
//
// 判定优先级：夜行者 > 归藏 > 铁腕 > 市侩 > 未达成
// 馆长在玩家回到 Hub 时检测；满足则触发结局动画。
// 结局触发后会写入 SaveData.flags.endingId，避免重复触发；
// 玩家可以在标题画面看到"已通关结局"。

import SaveData from './SaveData.js';
import { RELICS } from '../data/relics.js';

export const ENDINGS = {
  gui_cang: {
    id: 'gui_cang',
    title: '归藏',
    subtitle: '· True Ending ·',
    tone: '宁静、沉郁、敬重器物',
    color: '#d4af37',
    fallback:
      '夜行司的灯一盏盏熄了。我把最后一件器物放进展柜，回头时，长廊的尽头亮着另一盏灯——那是来日的访客，将站在玻璃前，听器物自己讲述它走过的路。我们从未杀生，只把那些被夺走的，安安静静地，请了回家。'
  },
  tie_wan: {
    id: 'tie_wan',
    title: '铁腕',
    subtitle: '· Iron Hand ·',
    tone: '沉重、克制、灰色道德',
    color: '#ff8c42',
    fallback:
      '清点的不是账目，而是名字。每一件归藏的器物背后，都站着一个我不曾认识、也不曾留下姓名的人。代价是血，但国宝回家了——这句话，我不想说第二遍。从今夜起，我只在每月初一，往后山的旧庙里，添一炷香。'
  },
  shi_kuai: {
    id: 'shi_kuai',
    title: '市侩',
    subtitle: '· Bad Ending ·',
    tone: '讽刺、冷淡、自嘲',
    color: '#7a3030',
    fallback:
      '账本上数字越攒越厚，仓库里的锦盒却越来越空。我笑自己——出发时说要做一个守夜人，走着走着，竟成了另一个倒爷。这条路上的人都很客气，他们叫我"林老板"。我喝着他们递来的酒，听他们谈下一批要出货的"老物件"，灯下的影子，越来越像我从前最瞧不起的人。'
  },
  ye_xing_zhe: {
    id: 'ye_xing_zhe',
    title: '夜行者',
    subtitle: '· Hidden · 你从未存在过 ·',
    tone: '空灵、冷峻、几乎不带情感',
    color: '#7ae8e8',
    fallback:
      '没有报警，没有目击者，没有一具倒下的尸体。监控里只有一闪而过的影子，第二天清晨，被盗的器物已躺在博物馆的展柜里。报纸上没有我的名字。馆长林默在每月的会议纪要末尾，写了一句无主的批注——"夜行者归位"。我只在风吹过长廊的时候，知道她写过这句话。'
  }
};

/**
 * 判定当前存档应触发哪个结局。
 * @returns {string|null} ending id，或 null 表示尚未达成。
 */
export function evaluateEnding() {
  const stats = SaveData.getStats ? SaveData.getStats() : {};
  const vault = SaveData.getVault();
  const uniqueRelics = new Set(vault.map((v) => v.id)).size;

  const totalKills = stats.totalKills || 0;
  const totalGhostRuns = stats.totalGhostRuns || 0;
  const totalSpent = stats.totalSpent || 0;

  // 1. 夜行者（隐藏）
  if (uniqueRelics >= 6 && totalGhostRuns >= 3) return 'ye_xing_zhe';
  // 2. 归藏（True）
  if (uniqueRelics >= 6 && totalKills === 0) return 'gui_cang';
  // 3. 铁腕
  if (uniqueRelics >= 5 && totalKills >= 8) return 'tie_wan';
  // 4. 市侩
  if (uniqueRelics < 5 && totalSpent >= 1500 && SaveData.getRunsTotal && SaveData.getRunsTotal() >= 3) return 'shi_kuai';

  return null;
}

/** 结局是否已被触发过（避免馆长反复唠叨） */
export function hasEndingBeenSeen(id) {
  const seen = SaveData.getFlag('seenEndings', []) || [];
  return Array.isArray(seen) && seen.includes(id);
}

/** 标记结局已被看到 */
export function markEndingSeen(id) {
  const seen = SaveData.getFlag('seenEndings', []) || [];
  if (!Array.isArray(seen)) {
    SaveData.setFlag('seenEndings', [id]);
    return;
  }
  if (!seen.includes(id)) {
    seen.push(id);
    SaveData.setFlag('seenEndings', seen);
  }
  // 同时记录最近一次结局
  SaveData.setFlag('lastEnding', id);
}

/** 取出某结局的元数据；找不到返回 null */
export function getEndingMeta(id) {
  return ENDINGS[id] || null;
}

/** 整理给 LLM / 结局场景使用的玩家统计数据 */
export function gatherStatsForEnding() {
  const stats = SaveData.getStats ? SaveData.getStats() : {};
  const vault = SaveData.getVault();
  const uniqueRelics = new Set(vault.map((v) => v.id)).size;
  return {
    relicsCollected: uniqueRelics,
    relicsTotal: RELICS.length,
    totalKills: stats.totalKills || 0,
    totalAlerts: stats.totalAlerts || 0,
    totalGhostRuns: stats.totalGhostRuns || 0,
    totalSpent: stats.totalSpent || 0,
    runsSuccess: SaveData.getRunsSuccess ? SaveData.getRunsSuccess() : 0,
    runsTotal: SaveData.getRunsTotal ? SaveData.getRunsTotal() : 0
  };
}

export default { ENDINGS, evaluateEnding, hasEndingBeenSeen, markEndingSeen, getEndingMeta, gatherStatsForEnding };
