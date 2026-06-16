// ContractScene - 委托板
// 玩家从今日 3 份委托中选择一份接取（已接取的可以"放弃"换另一份，但放弃损 1 声望）
// 设计：左侧列表（3 个委托卡片），右侧详情面板（委托人话语 + 要求 + 奖励）

import Phaser from 'phaser';
import SaveData from '../systems/SaveData.js';
import Audio from '../systems/AudioFx.js';
import {
  generateDailyContracts,
  describeRequirement
} from '../data/contracts.js';
import { getBiome } from '../data/biomes.js';

const W = 1280;
const H = 720;

export default class ContractScene extends Phaser.Scene {
  constructor() { super('ContractScene'); }

  create() {
    Audio.init();

    this.add.rectangle(0, 0, W, H, 0x0a0a0a).setOrigin(0, 0);

    // 标题
    this.add
      .text(W / 2, 36, '委　托　板', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '24px',
        color: '#d4af37',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    this.add.rectangle(W / 2, 56, 200, 1, 0xd4af37);

    // 取（或刷新）今日委托池（用局内 gameDay）
    const day = SaveData.getGameDay();
    let pool = SaveData.getContractPool(day);
    if (!pool) {
      pool = generateDailyContracts(day);
      SaveData.setContractPool(day, pool);
    }
    this.pool = pool;

    // 左侧列表
    this.cards = [];
    pool.forEach((c, i) => {
      this.cards.push(this.createCard(c, i));
    });

    // 右侧详情区（默认空）
    this.detailGroup = this.add.container(0, 0);

    // 顶部右边：刷新按钮 + 当前资金
    this.refreshLabel = this.add.text(W - 24, 28, '', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '14px',
      color: '#d4af37'
    }).setOrigin(1, 0.5);
    this.rerollBtn = this.add.text(W - 24, 56, '〔  刷新委托板  ¥50  〕', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '14px',
      color: '#fff3b8',
      backgroundColor: '#3a2814',
      padding: { x: 10, y: 5 }
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    this.rerollBtn.on('pointerover', () => this.rerollBtn.setColor('#ffe28a'));
    this.rerollBtn.on('pointerout', () => this.rerollBtn.setColor('#fff3b8'));
    this.rerollBtn.on('pointerdown', () => this.tryReroll());
    this.refreshGoldLabel();

    // 选中第一张作为默认
    if (pool.length) this.selectContract(pool[0], 0);

    // 底部操作
    this.add
      .text(W / 2, H - 24, 'Esc / Q  返回前室', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: '#6b5824'
      })
      .setOrigin(0.5);

    this.input.keyboard.on('keydown-ESC', () => this.back());
    this.input.keyboard.on('keydown-Q', () => this.back());

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  createCard(c, idx) {
    const x = 80;
    const y = 110 + idx * 130;    // 1280×720 画布下加大间距，更舒展
    const w = 400;
    const h = 110;
    const bg = this.add.rectangle(x, y, w, h, 0x1a1208).setOrigin(0, 0);
    bg.setStrokeStyle(1, 0x6b5824);
    bg.setInteractive({ useHandCursor: true });

    const av = this.add
      .text(x + 20, y + h / 2, c.patron.avatar, { fontSize: '30px' })
      .setOrigin(0.5);

    const title = this.add.text(x + 50, y + 8, c.title, {
      fontFamily: '"PingFang SC", serif',
      fontSize: '15px',
      color: '#e8d27a',
      fontStyle: 'bold',
      wordWrap: { width: w - 60 }
    });

    const patron = this.add.text(x + 50, y + 32, `${c.patron.name} · ${c.patron.tag}`, {
      fontFamily: '"PingFang SC", serif',
      fontSize: '11px',
      color: c.patron.color
    });

    const req = this.add.text(x + 50, y + 48, describeRequirement(c.requirement), {
      fontFamily: '"PingFang SC", serif',
      fontSize: '11px',
      color: '#a08434',
      wordWrap: { width: w - 60 }
    });

    const reward = this.add.text(
      x + 50,
      y + 68,
      `¥${c.goldReward}  ·  声望 ${c.repReward >= 0 ? '+' : ''}${c.repReward}`,
      {
        fontFamily: 'Georgia, serif',
        fontSize: '12px',
        color: '#d4af37'
      }
    );

    bg.on('pointerover', () => bg.setStrokeStyle(2, 0xd4af37));
    bg.on('pointerout', () => {
      const isSelected = this._selectedIdx === idx;
      bg.setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0xd4af37 : 0x6b5824);
    });
    bg.on('pointerdown', () => {
      Audio.sfx.click();
      this.selectContract(c, idx);
    });

    return { bg, av, title, patron, req, reward, contract: c, idx };
  }

  selectContract(c, idx) {
    this._selectedIdx = idx;
    // 高亮当前
    for (const card of this.cards) {
      const isSel = card.idx === idx;
      card.bg.setStrokeStyle(isSel ? 2 : 1, isSel ? 0xd4af37 : 0x6b5824);
    }

    this.detailGroup.removeAll(true);

    const dx = 520;
    const dy = 110;
    const dw = 700;
    const dh = 520;

    const bg = this.add.rectangle(dx, dy, dw, dh, 0x140d05).setOrigin(0, 0);
    bg.setStrokeStyle(1, 0x6b5824);
    this.detailGroup.add(bg);

    // 头像 + 名字
    this.detailGroup.add(
      this.add.text(dx + 24, dy + 24, c.patron.avatar, { fontSize: '52px' }).setOrigin(0, 0)
    );
    this.detailGroup.add(
      this.add.text(dx + 100, dy + 30, c.patron.name, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '20px',
        color: c.patron.color,
        fontStyle: 'bold'
      })
    );
    this.detailGroup.add(
      this.add.text(dx + 100, dy + 60, c.patron.tag, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '13px',
        color: '#a08434'
      })
    );

    // 标题
    this.detailGroup.add(
      this.add.text(dx + 24, dy + 110, `「${c.title}」`, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '20px',
        color: '#e8d27a',
        fontStyle: 'bold'
      })
    );

    // 引文
    this.detailGroup.add(
      this.add.text(dx + 24, dy + 150, `"${c.quote}"`, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '14px',
        color: '#a08434',
        fontStyle: 'italic',
        wordWrap: { width: dw - 48 }
      })
    );

    // 要求
    this.detailGroup.add(
      this.add.text(dx + 24, dy + 220, '目标：', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '13px',
        color: '#6b5824'
      })
    );
    this.detailGroup.add(
      this.add.text(dx + 70, dy + 220, describeRequirement(c.requirement), {
        fontFamily: '"PingFang SC", serif',
        fontSize: '14px',
        color: '#7ae8e8'
      })
    );

    // 行动地点（biome）
    const bio = getBiome(c.biome || 'museum');
    const bioColor = bio.id === 'blackmarket' ? '#c084fc' : '#d4af37';
    this.detailGroup.add(
      this.add.text(dx + 24, dy + 246, '地点：', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '13px',
        color: '#6b5824'
      })
    );
    this.detailGroup.add(
      this.add.text(dx + 70, dy + 246, `${bio.name}　·　${bio.subtitle || ''}`, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '13px',
        color: bioColor
      })
    );

    // 奖励
    this.detailGroup.add(
      this.add.text(dx + 24, dy + 276, '酬劳：', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '13px',
        color: '#6b5824'
      })
    );
    this.detailGroup.add(
      this.add.text(
        dx + 70,
        dy + 276,
        `¥${c.goldReward}    声望 ${c.repReward >= 0 ? '+' : ''}${c.repReward}    失败：声望 ${c.failPenalty}`,
        {
          fontFamily: 'Georgia, serif',
          fontSize: '14px',
          color: '#d4af37'
        }
      )
    );

    // 接取按钮
    const active = SaveData.getActiveContract();
    const isCurrent = active && active.id === c.id;
    const btnLabel = isCurrent ? '［ 已接取 · 放弃此委托 ］' : '［ 接取此委托 ］';
    const btn = this.add
      .text(dx + dw / 2, dy + dh - 40, btnLabel, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '18px',
        color: isCurrent ? '#a08434' : '#fff3b8',
        backgroundColor: isCurrent ? '#1a1208' : '#3a2814',
        padding: { x: 16, y: 8 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setColor('#fff3b8'));
    btn.on('pointerout', () => btn.setColor(isCurrent ? '#a08434' : '#fff3b8'));
    btn.on('pointerdown', () => {
      Audio.sfx.click();
      if (isCurrent) {
        // 放弃
        SaveData.setActiveContract(null);
        SaveData.addRep(-1);
        this.toast('已放弃当前委托（声望 -1）');
      } else {
        if (active) {
          // 切换委托：放弃旧的同样损 1 声望
          SaveData.addRep(-1);
        }
        SaveData.setActiveContract(c);
        this.toast('已接取！');
      }
      this.selectContract(c, idx);
    });
    this.detailGroup.add(btn);
  }

  toast(msg) {
    if (this._toast) this._toast.destroy();
    this._toast = this.add
      .text(W / 2, H - 60, msg, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '14px',
        color: '#fff3b8',
        backgroundColor: '#1a1208cc',
        padding: { x: 10, y: 5 }
      })
      .setOrigin(0.5)
      .setDepth(200);
    this.tweens.add({
      targets: this._toast,
      alpha: 0,
      duration: 1500,
      delay: 1000,
      onComplete: () => this._toast && this._toast.destroy()
    });
  }

  refreshGoldLabel() {
    if (this.refreshLabel) {
      this.refreshLabel.setText(`资金 ¥${SaveData.getGold()}   ·   第 ${SaveData.getGameDay()} 天`);
    }
  }

  tryReroll() {
    const ok = SaveData.rerollContractPool(50);
    if (!ok) {
      Audio.sfx.click();
      this.toast('资金不足，刷新需 ¥50');
      return;
    }
    Audio.sfx.click();
    // 重生委托池
    const day = SaveData.getGameDay();
    const newPool = generateDailyContracts((day * 31 + Date.now()) >>> 0);
    SaveData.setContractPool(day, newPool);
    this.pool = newPool;
    // 重建左侧卡片
    for (const card of this.cards) {
      card.bg.destroy(); card.av.destroy(); card.title.destroy();
      card.patron.destroy(); card.req.destroy(); card.reward.destroy();
    }
    this.cards = [];
    newPool.forEach((c, i) => this.cards.push(this.createCard(c, i)));
    if (newPool.length) this.selectContract(newPool[0], 0);
    this.refreshGoldLabel();
    this.toast('委托板已刷新');
  }

  back() {
    Audio.sfx.click();
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('HubScene');
    });
  }
}
