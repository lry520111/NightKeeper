// ResultScene - 出击结算
// 由 MuseumScene 在玩家撤离 / 失败时调用 scene.start('ResultScene', { success, items, value, reason })
// 这里负责：
//   · 把带回的文物入库（仓库）
//   · 给基础奖励（30% 价值现金 + 是否成功）
//   · 评估并结算 activeContract（if 成功撤离）
//   · 更新 Codex（图鉴解锁）
//   · 展示结算页 → 回 Hub

import Phaser from 'phaser';
import SaveData from '../systems/SaveData.js';
import Codex from '../systems/Codex.js';
import Audio from '../systems/AudioFx.js';
import { describeRequirement } from '../data/contracts.js';

const W = 960;
const H = 540;

export default class ResultScene extends Phaser.Scene {
  constructor() { super('ResultScene'); }

  init(data) {
    this.payload = Object.assign(
      { success: false, items: [], value: 0, reason: '', bonusGold: 0, bonusRep: 0 },
      data || {}
    );
  }

  create() {
    Audio.init();
    this.add.rectangle(0, 0, W, H, 0x0a0a0a).setOrigin(0, 0);

    const { success, items, value, reason, bonusGold, bonusRep } = this.payload;

    // —— 1. 写入 Codex（图鉴）——
    let newDiscoveries = [];
    if (success) {
      const beforeSet = new Set(Codex.discoveredIds());
      Codex.recordRun({ success: true, items, value });
      newDiscoveries = items.filter((r) => r && r.id && !beforeSet.has(r.id));
    } else {
      Codex.recordRun({ success: false });
    }

    // —— 2. 写入 SaveData（金币 / 入库 / 委托结算）——
    const beforeGold = SaveData.getGold();
    const beforeRep = SaveData.getRep();
    const activeContract = SaveData.getActiveContract();

    SaveData.commitRun({ success, items });
    let contractResult = null;
    if (success) {
      // 文物入仓库
      SaveData.addToVault(items, activeContract ? activeContract.id : null);
      if (activeContract) {
        contractResult = SaveData.resolveActiveContract(items);
      }
    } else if (activeContract) {
      // 失败：照样按"失败"处理委托惩罚，但委托不消耗（玩家可以再尝试）
      // 这里的设计选择：失败不清空 activeContract，只扣 1 点声望作为"夜行受挫"
      SaveData.addRep(-1);
    }

    // 额外奖励（容器中拾取的金币 / 声望，无论成败都发放）
    if (bonusGold) SaveData.addGold(bonusGold);
    if (bonusRep)  SaveData.addRep(bonusRep);

    // 失败时检查安全箱：文物本来就在仓库里，这里只作为反馈提示
    const safeBoxRef = (!success) ? SaveData.getSafeBox() : null;

    // —— 给 Hub 馆长 NPC 留个 flag，便于其根据上一次结果说不同的台词 ——
    SaveData.setFlag('lastRunResult', {
      success: !!success,
      met: contractResult ? !!contractResult.met : null,
      itemsCount: Array.isArray(items) ? items.length : 0,
      contractTitle: activeContract ? activeContract.title : null,
      at: Date.now()
    });

    const afterGold = SaveData.getGold();
    const afterRep = SaveData.getRep();
    const goldDelta = afterGold - beforeGold;
    const repDelta = afterRep - beforeRep;

    // —— 标题 ——
    this.add
      .text(W / 2, 60, success ? '追  回  成  功' : '行  动  失  败', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '32px',
        color: success ? '#d4af37' : '#ff8c42',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    if (reason) {
      this.add
        .text(W / 2, 100, reason, {
          fontFamily: '"PingFang SC", serif',
          fontSize: '13px',
          color: '#a08434'
        })
        .setOrigin(0.5);
    }

    // —— 战利品列表 ——
    const lines = items.length
      ? items
          .map((r) => {
            const isNew = newDiscoveries.some((n) => n.id === r.id);
            return `${isNew ? '★ ' : '· '}${r.name}（${r.dynasty}）  ¥${r.value}`;
          })
          .join('\n')
      : '此行未带回文物。';
    this.add
      .text(W / 2, 180, lines, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '15px',
        color: '#e8d27a',
        align: 'center',
        lineSpacing: 6
      })
      .setOrigin(0.5);

    if (success && newDiscoveries.length) {
      this.add
        .text(W / 2, 250, `★ 新入图鉴 ${newDiscoveries.length} 件`, {
          fontFamily: '"PingFang SC", serif',
          fontSize: '13px',
          color: '#7ae8e8'
        })
        .setOrigin(0.5);
    }

    // 安全箱提示（失败时）
    if (safeBoxRef) {
      this.add
        .text(W / 2, 268, `📦 安全箱：【${safeBoxRef.name}】完好无损，仍在仓库。`, {
          fontFamily: '"PingFang SC", serif',
          fontSize: '13px',
          color: '#c084fc'
        })
        .setOrigin(0.5);
    }

    // —— 委托结算 ——
    let yCursor = 290;
    if (contractResult) {
      const c = contractResult.contract;
      const ok = contractResult.met;
      this.add
        .text(W / 2, yCursor, `委托：「${c.title}」`, {
          fontFamily: '"PingFang SC", serif',
          fontSize: '15px',
          color: '#d4af37'
        })
        .setOrigin(0.5);
      yCursor += 22;
      this.add
        .text(W / 2, yCursor, `要求：${describeRequirement(c.requirement)}`, {
          fontFamily: '"PingFang SC", serif',
          fontSize: '12px',
          color: '#a08434'
        })
        .setOrigin(0.5);
      yCursor += 22;
      this.add
        .text(W / 2, yCursor, ok ? '✓ 委托达成' : '✗ 委托未达成', {
          fontFamily: '"PingFang SC", serif',
          fontSize: '16px',
          color: ok ? '#7ae8e8' : '#ff8c42',
          fontStyle: 'bold'
        })
        .setOrigin(0.5);
      yCursor += 30;
    } else if (success && activeContract) {
      // 边界保护，理论上 success 时一定有 contractResult
      yCursor += 30;
    } else if (!success && activeContract) {
      this.add
        .text(W / 2, yCursor, `当前委托「${activeContract.title}」仍待完成`, {
          fontFamily: '"PingFang SC", serif',
          fontSize: '13px',
          color: '#a08434'
        })
        .setOrigin(0.5);
      yCursor += 26;
    }

    // —— 结算条 ——
    const summary = [];
    if (goldDelta !== 0) summary.push(`金 ${goldDelta >= 0 ? '+' : ''}${goldDelta}`);
    if (repDelta !== 0) summary.push(`声望 ${repDelta >= 0 ? '+' : ''}${repDelta}`);
    if (summary.length === 0) summary.push('无收益');
    this.add
      .text(W / 2, yCursor + 10, summary.join('    ·    '), {
        fontFamily: 'Georgia, serif',
        fontSize: '20px',
        color: '#d4af37',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    this.add
      .text(W / 2, yCursor + 38, `当前余额：金 ¥${afterGold}    声望 ${afterRep}`, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: '#6b5824'
      })
      .setOrigin(0.5);

    // —— 按钮 ——
    const btn = this.add
      .text(W / 2, H - 60, '［ 回到行动前室 ］', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '20px',
        color: '#fff3b8',
        backgroundColor: '#3a2814',
        padding: { x: 16, y: 8 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setBackgroundColor('#5a3e1c'));
    btn.on('pointerout', () => btn.setBackgroundColor('#3a2814'));
    btn.on('pointerdown', () => {
      Audio.sfx.click();
      this.cameras.main.fadeOut(350, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('HubScene');
      });
    });

    this.input.keyboard.on('keydown-SPACE', () => btn.emit('pointerdown'));
    this.input.keyboard.on('keydown-ENTER', () => btn.emit('pointerdown'));

    this.cameras.main.fadeIn(450, 0, 0, 0);

    if (success) {
      Audio.sfx.exit && Audio.sfx.exit();
    } else {
      Audio.sfx.fail && Audio.sfx.fail();
    }
  }
}
