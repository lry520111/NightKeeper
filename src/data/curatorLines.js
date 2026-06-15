// curatorLines.js - 馆长 NPC 对话词库
//
// 根据当前存档状态返回不同的多页对话内容，统一格式：
//   { pages: ['第一句', '第二句'...] }
//
// 调用方：HubScene 在玩家与馆长 NPC 交互时调用 buildCuratorDialog(SaveData) 生成台词

import { describeRequirement } from './contracts.js';

/**
 * 根据存档状态构造馆长对话
 * @param {SaveData} SaveData
 * @returns {{ pages: string[], speaker: string, mood: 'normal'|'happy'|'angry' }}
 */
export function buildCuratorDialog(SaveData) {
  const flags = {
    metCurator: SaveData.getFlag('metCurator', false),
    lastRun: SaveData.getFlag('lastRunResult', null)
  };
  const active = SaveData.getActiveContract();

  // —— 状态优先级 ——
  // 1) 首次见馆长（剧情向，长开场）
  if (!flags.metCurator) {
    SaveData.setFlag('metCurator', true);
    return {
      speaker: '林默 · 馆长',
      mood: 'normal',
      pages: [
        '你来了。先把外面的雪抖掉吧——这间屋子是夜行司新设的"追回总部"，往后所有夜行卷宗都从这里发出。',
        '你已经看过卷首：那张《长夜失物录》。被劫的不止是几件铜器玉器，是这一整代人安放山河的念想。',
        '规矩简单——西墙的【委托板】上有人发来的求援；北角的【配装台】挑你顺手的家伙；南角的【保险柜】放你换下来的物件；东角那扇【任务门】，便是出夜的入口。',
        '记着：能不惊动看守，就别动刀。咱们做的是追回，不是杀伐。'
      ]
    };
  }

  // 2) 上一次刚回来——根据成败问候
  if (flags.lastRun) {
    const lr = flags.lastRun;
    // 已读：清掉，避免每次都念
    SaveData.setFlag('lastRunResult', null);
    if (lr.success && lr.met) {
      return {
        speaker: '林默 · 馆长',
        mood: 'happy',
        pages: [
          `「${lr.contractTitle || '上一份夜行'}」的委托——办成了。`,
          `带回 ${lr.itemsCount} 件归藏，账已经记下。委托人那边的银两声望，也都到了你名下。`,
          '别松口气，长夜还没尽。再去【委托板】看看，下一份卷宗在等你。'
        ]
      };
    }
    if (lr.success && lr.met === false) {
      return {
        speaker: '林默 · 馆长',
        mood: 'normal',
        pages: [
          '回来了就好。听说你抄了别的物件，但委托上要的那件……没拿到？',
          '没关系，归藏室也欢迎一切失而复得。委托可以再等等——下次记得对照卷宗再下手。'
        ]
      };
    }
    if (!lr.success) {
      return {
        speaker: '林默 · 馆长',
        mood: 'angry',
        pages: [
          '……回来了。看你这副样子，知道这一夜不顺。',
          '没事，伤口我来包。背包里的家当折损是免不了的，但安全箱里的物件还在——这是夜行司的老规矩。',
          '歇一阵，再去【委托板】挑一份顺手的卷宗。这条路，本来就没有一帆风顺。'
        ]
      };
    }
  }

  // 3) 未接委托
  if (!active) {
    return {
      speaker: '林默 · 馆长',
      mood: 'normal',
      pages: [
        '今夜风急。先去西墙的【委托板】吧——黑市那边又传来几封新的卷宗。',
        '别空着手出门。配装台上那些工具，比你想的有用得多。'
      ]
    };
  }

  // 4) 已接委托 - 提醒
  return {
    speaker: '林默 · 馆长',
    mood: 'normal',
    pages: [
      `卷宗已记：「${active.title}」。`,
      `委托人 ${active.patron && active.patron.name ? active.patron.name : '不愿具名'}，要求是——${describeRequirement(active.requirement)}。`,
      '配装与安全箱都备齐了？齐了，就从东角那扇门走。山高水长，活着回来。'
    ]
  };
}

export default buildCuratorDialog;
