// EndingScene — 多结局触发场景
//
// 入口：HubScene 检测到 evaluateEnding() 返回非 null 时跳转。
// 表现：
//   1) 黑屏淡入 → 大字结局标题（带稀有色）
//   2) 副标题（如"True Ending"）
//   3) 玩家本周目数据小结
//   4) LLM 生成的独白（启用 LLM 时实时生成；否则走 fallback）
//   5) 底部按钮：返回博物馆 / 重启周目（清存档）
//
// 写入 SaveData.flags.seenEndings 避免重复触发。

import Phaser from 'phaser';
import SaveData from '../systems/SaveData.js';
import Audio from '../systems/AudioFx.js';
import LLM from '../systems/LLM.js';
import { RELICS } from '../data/relics.js';
import {
  getEndingMeta,
  markEndingSeen,
  gatherStatsForEnding
} from '../systems/Endings.js';

const W = 1280;
const H = 720;

export default class EndingScene extends Phaser.Scene {
  constructor() { super('EndingScene'); }

  init(data) {
    this.endingId = (data && data.endingId) || 'gui_cang';
    // 预览模式：从 EndingPreviewScene 进入；不写存档、不清存档、按钮回到预览菜单
    this.previewMode = !!(data && data.preview);
    // 预览模式专用的虚拟统计；让数据条不暴露玩家真实存档
    this.previewStats = (data && data.stats) || null;
  }

  create() {
    Audio.init();
    const meta = getEndingMeta(this.endingId);
    if (!meta) {
      // 数据非法：直接回 Hub 兜底（预览模式下回到预览菜单）
      this.scene.start(this.previewMode ? 'EndingPreviewScene' : 'HubScene');
      return;
    }
    // 预览模式使用一组与该结局触发条件相符的「展示用数据」，不读真实存档
    const stats = this.previewMode
      ? (this.previewStats || this._buildPreviewStats(this.endingId))
      : gatherStatsForEnding();
    // 仅在正式触发时写入存档；预览不污染存档
    if (!this.previewMode) {
      markEndingSeen(this.endingId);
    }

    const colorNum = Phaser.Display.Color.HexStringToColor(meta.color).color;

    // 全屏黑底
    this.add.rectangle(0, 0, W, H, 0x000000).setOrigin(0, 0);

    // 顶 / 底装饰金线
    this.add.rectangle(W / 2, 50, W - 120, 1, colorNum, 0.7);
    this.add.rectangle(W / 2, H - 50, W - 120, 1, colorNum, 0.7);

    // 大字标题
    const title = this.add
      .text(W / 2, 110, meta.title, {
        fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
        fontSize: '64px',
        color: meta.color,
        fontStyle: 'bold',
        letterSpacing: 12
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 1200, ease: 'Sine.out' });

    // 副标题
    const sub = this.add
      .text(W / 2, 168, meta.subtitle || '', {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        color: '#a08434'
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, duration: 1200, delay: 400 });

    // 数据条
    const statText =
      `已归藏 ${stats.relicsCollected} / ${stats.relicsTotal}    ·    ` +
      `击杀 ${stats.totalKills}    ·    ` +
      `无伤通关 ${stats.totalGhostRuns}    ·    ` +
      `累计消费 ¥${stats.totalSpent}`;
    const statLine = this.add
      .text(W / 2, 200, statText, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: '#6b5824'
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setAlpha(0);
    this.tweens.add({ targets: statLine, alpha: 1, duration: 1200, delay: 700 });

    // —— 独白主体（占位 → LLM 异步替换） ——
    const monologuePlaceholder = LLM.isEnabled()
      ? '（夜枭执笔中……）'
      : meta.fallback;
    this.monologue = this.add
      .text(W / 2, 320, monologuePlaceholder, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '15px',
        color: '#e8d27a',
        align: 'center',
        wordWrap: { width: W - 200, useAdvancedWrap: true },
        lineSpacing: 8
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setAlpha(0);
    this.tweens.add({ targets: this.monologue, alpha: 1, duration: 1500, delay: 1100 });

    // 异步加载独白
    LLM.call({
      scenario: 'ending_monologue',
      cacheKey: `ending_${this.endingId}${this.previewMode ? '_preview' : ''}`,
      context: { ending: meta, stats, preview: this.previewMode },
      fallback: meta.fallback
    }).then((res) => {
      if (this.monologue && this.monologue.active) {
        this.monologue.setText(res.text);
      }
    }).catch(() => { /* 已在 LLM 内做兜底 */ });

    // —— 底部按钮 —— //
    // 正式模式：回到博物馆 / 开启新周目
    // 预览模式：返回预览菜单 / 切换上一个 / 下一个 结局（避免误清存档）
    if (this.previewMode) {
      this._buildPreviewButtons(colorNum);
    } else {
      this._buildEndingButtons();
    }

    // 渐入
    this.cameras.main.fadeIn(800, 0, 0, 0);

    // 关键提示（小字）
    const footerText = this.previewMode
      ? '— 预览模式：以下数据为示意，不会写入存档 —'
      : '— 你的旅程仍可继续。所有结局共存于这一座馆。 —';
    this.add
      .text(W / 2, H - 22, footerText, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '11px',
        color: this.previewMode ? '#7a6228' : '#3d3520'
      })
      .setOrigin(0.5);

    // 预览角标（右上角，提示当前是预览态）
    if (this.previewMode) {
      this.add
        .text(W - 16, 16, 'PREVIEW', {
          fontFamily: 'Georgia, serif',
          fontSize: '11px',
          color: '#1a1208',
          backgroundColor: '#d4af37',
          padding: { x: 8, y: 3 }
        })
        .setOrigin(1, 0)
        .setResolution(2);
    }
  }

  // —— 正式触发：回博物馆 / 开新周目 —— //
  _buildEndingButtons() {
    const btnBack = this.add
      .text(W / 2 - 110, H - 90, '［ 回到博物馆 ］', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '17px',
        color: '#fff3b8',
        backgroundColor: '#3a2814',
        padding: { x: 14, y: 8 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0);
    btnBack.on('pointerover', () => btnBack.setBackgroundColor('#5a3e1c'));
    btnBack.on('pointerout', () => btnBack.setBackgroundColor('#3a2814'));
    btnBack.on('pointerdown', () => {
      Audio.sfx.click && Audio.sfx.click();
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('HubScene'));
    });

    const btnRestart = this.add
      .text(W / 2 + 110, H - 90, '［ 开启新周目 ］', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '17px',
        color: '#fff3b8',
        backgroundColor: '#1f1230',
        padding: { x: 14, y: 8 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0);
    btnRestart.on('pointerover', () => btnRestart.setBackgroundColor('#3a1f60'));
    btnRestart.on('pointerout', () => btnRestart.setBackgroundColor('#1f1230'));
    btnRestart.on('pointerdown', () => {
      Audio.sfx.click && Audio.sfx.click();
      SaveData.reset();
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('TitleScene'));
    });

    this.tweens.add({ targets: [btnBack, btnRestart], alpha: 1, duration: 800, delay: 1800 });
  }

  // —— 预览模式：上一个 / 返回菜单 / 下一个 —— //
  _buildPreviewButtons() {
    const order = ['gui_cang', 'tie_wan', 'shi_kuai', 'ye_xing_zhe'];
    const idx = Math.max(0, order.indexOf(this.endingId));
    const prev = order[(idx - 1 + order.length) % order.length];
    const next = order[(idx + 1) % order.length];

    const makeBtn = (x, label, bg, hoverBg, onClick) => {
      const btn = this.add
        .text(x, H - 90, label, {
          fontFamily: '"PingFang SC", serif',
          fontSize: '15px',
          color: '#fff3b8',
          backgroundColor: bg,
          padding: { x: 12, y: 8 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .setAlpha(0);
      btn.on('pointerover', () => btn.setBackgroundColor(hoverBg));
      btn.on('pointerout', () => btn.setBackgroundColor(bg));
      btn.on('pointerdown', () => {
        Audio.sfx.click && Audio.sfx.click();
        onClick();
      });
      return btn;
    };

    const goPreview = (id) => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('EndingScene', { endingId: id, preview: true });
      });
    };

    const btnPrev = makeBtn(W / 2 - 200, '◀ 上一个', '#2a2218', '#4a3a26', () => goPreview(prev));
    const btnBack = makeBtn(W / 2, '［ 返回结局菜单 ］', '#3a2814', '#5a3e1c', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('EndingPreviewScene'));
    });
    const btnNext = makeBtn(W / 2 + 200, '下一个 ▶', '#2a2218', '#4a3a26', () => goPreview(next));

    this.tweens.add({ targets: [btnPrev, btnBack, btnNext], alpha: 1, duration: 800, delay: 1800 });
  }

  // —— 给预览模式构造一组与结局触发条件相符的展示数据 —— //
  _buildPreviewStats(id) {
    const total = (RELICS && RELICS.length) || 8;
    switch (id) {
      case 'gui_cang':
        return { relicsCollected: 7, relicsTotal: total, totalKills: 0, totalAlerts: 4, totalGhostRuns: 5, totalSpent: 820, runsSuccess: 9, runsTotal: 10 };
      case 'tie_wan':
        return { relicsCollected: 6, relicsTotal: total, totalKills: 12, totalAlerts: 18, totalGhostRuns: 0, totalSpent: 600, runsSuccess: 8, runsTotal: 12 };
      case 'shi_kuai':
        return { relicsCollected: 3, relicsTotal: total, totalKills: 4, totalAlerts: 9, totalGhostRuns: 1, totalSpent: 1820, runsSuccess: 5, runsTotal: 9 };
      case 'ye_xing_zhe':
        return { relicsCollected: 8, relicsTotal: total, totalKills: 0, totalAlerts: 0, totalGhostRuns: 6, totalSpent: 540, runsSuccess: 8, runsTotal: 8 };
      default:
        return { relicsCollected: 0, relicsTotal: total, totalKills: 0, totalAlerts: 0, totalGhostRuns: 0, totalSpent: 0, runsSuccess: 0, runsTotal: 0 };
    }
  }
}
