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
import {
  getEndingMeta,
  markEndingSeen,
  gatherStatsForEnding
} from '../systems/Endings.js';

const W = 960;
const H = 540;

export default class EndingScene extends Phaser.Scene {
  constructor() { super('EndingScene'); }

  init(data) {
    this.endingId = (data && data.endingId) || 'gui_cang';
  }

  create() {
    Audio.init();
    const meta = getEndingMeta(this.endingId);
    if (!meta) {
      // 数据非法：直接回 Hub 兜底
      this.scene.start('HubScene');
      return;
    }
    const stats = gatherStatsForEnding();
    markEndingSeen(this.endingId);

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
      cacheKey: `ending_${this.endingId}`,
      context: { ending: meta, stats },
      fallback: meta.fallback
    }).then((res) => {
      if (this.monologue && this.monologue.active) {
        this.monologue.setText(res.text);
      }
    }).catch(() => { /* 已在 LLM 内做兜底 */ });

    // 底部按钮：回到博物馆 / 重启周目
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
      // 保留 Codex 与图鉴解锁，但清掉 SaveData
      SaveData.reset();
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('TitleScene'));
    });

    this.tweens.add({ targets: [btnBack, btnRestart], alpha: 1, duration: 800, delay: 1800 });

    // 渐入
    this.cameras.main.fadeIn(800, 0, 0, 0);

    // 关键提示（小字）
    this.add
      .text(W / 2, H - 22, '— 你的旅程仍可继续。所有结局共存于这一座馆。 —', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '11px',
        color: '#3d3520'
      })
      .setOrigin(0.5);
  }
}
