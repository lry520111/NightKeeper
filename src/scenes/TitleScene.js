// TitleScene - 标题菜单
import Phaser from 'phaser';
import Codex from '../systems/Codex.js';
import SaveSlots from '../systems/SaveSlots.js';
import { RELICS } from '../data/relics.js';
import Audio from '../systems/AudioFx.js';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    const { width, height } = this.scale;

    // 背景
    this.add.rectangle(0, 0, width, height, 0x0a0a0a).setOrigin(0, 0);

    // —— 三段式布局参数 —— //
    // 顶部分隔线 / 底部分隔线 位置
    const topLineY = 60;
    const bottomLineY = height - 90;
    // 标题块基线（上半部分中心略偏上）
    const titleBlockY = Math.round(height * 0.26);
    // 菜单组：在「标题块下方」与「底部分隔线」之间居中
    const menuTopY = titleBlockY + 110;
    const menuBottomY = bottomLineY - 30;
    const menuCenterY = (menuTopY + menuBottomY) / 2;

    // —— 装饰分隔线 —— //
    this.add.rectangle(width / 2, topLineY, 320, 1, 0xd4af37);
    this.add.rectangle(width / 2, bottomLineY, 320, 1, 0xd4af37);

    // —— 标题区 —— //
    this.add
      .text(width / 2, titleBlockY - 28, '夜　行　者', {
        fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
        fontSize: '56px',
        color: '#d4af37',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, titleBlockY + 32, '— 归　藏 —', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '22px',
        color: '#a08434'
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, titleBlockY + 56, '一段被盗国宝的追回行动', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '13px',
        color: '#7a6228'
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, titleBlockY + 74, 'NightKeeper', {
        fontFamily: 'Georgia, serif',
        fontSize: '13px',
        color: '#6b5824',
        fontStyle: 'italic'
      })
      .setOrigin(0.5);

    // —— 菜单区：4 个按钮垂直均匀分布 —— //
    // 间距固定，整组围绕 menuCenterY 居中
    const items = [
      {
        label: '［ 继续夜行 ］',
        size: '22px',
        color: '#e8d27a',
        gapBelow: 40,
        onClick: () => {
          this.cameras.main.fadeOut(400, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => {
            const seen = (() => {
              try { return localStorage.getItem(SaveSlots.slotKey('nightkeeper:seenIntro')) === '1'; }
              catch { return false; }
            })();
            SaveSlots.touchActive();
            this.scene.start(seen ? 'HubScene' : 'IntroScene');
          });
        }
      },
      {
        label: '［ 存档管理 ］',
        size: '16px',
        color: '#a08434',
        gapBelow: 32,
        onClick: () => {
          this.cameras.main.fadeOut(300, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('SaveSlotsScene'));
        }
      },
      {
        label: '［ 文物图鉴 ］',
        size: '16px',
        color: '#a08434',
        gapBelow: 28,
        onClick: () => {
          this.cameras.main.fadeOut(300, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('CodexScene'));
        }
      },
      {
        label: '［ 重看序章 ］',
        size: '13px',
        color: '#7a6228',
        gapBelow: 0,
        onClick: () => {
          this.cameras.main.fadeOut(300, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('IntroScene'));
        }
      }
    ];

    // 计算菜单组总高度，用于围绕 menuCenterY 居中
    const totalGap = items.reduce((s, it) => s + it.gapBelow, 0);
    let cursorY = menuCenterY - totalGap / 2;

    items.forEach((it) => {
      const btn = this.add
        .text(width / 2, cursorY, it.label, {
          fontFamily: '"PingFang SC", serif',
          fontSize: it.size,
          color: it.color
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setColor('#fff3b8'));
      btn.on('pointerout', () => btn.setColor(it.color));
      btn.on('pointerdown', () => {
        Audio.init();
        Audio.sfx.click();
        it.onClick();
      });
      cursorY += it.gapBelow;
    });

    // —— 底部信息区（分隔线下方，固定 3 行，间距 18px）—— //
    // 行 1：当前存档摘要（紧贴分隔线下）
    const activeSlot = SaveSlots.getActiveSlot();
    const slotLabel = activeSlot ? `当前存档：${activeSlot.name}` : '归藏待启';
    const state = Codex.getState();
    const found = Object.keys(state.relics).length;
    const progressText = found > 0
      ? `${slotLabel}  ·  仓库 ${found} / ${RELICS.length}  ·  追回行动 ${state.runs.success} 次`
      : `${slotLabel}  ·  共 ${RELICS.length} 件国宝待归仓`;
    this.add
      .text(width / 2, bottomLineY + 22, progressText, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: '#8a7030'
      })
      .setOrigin(0.5);

    // 行 2：副标语
    this.add
      .text(width / 2, bottomLineY + 44, '夜行司·接委托·配装·潜入·归藏国宝', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: '#6b5824'
      })
      .setOrigin(0.5);

    // 行 3：版本号
    this.add
      .text(width / 2, bottomLineY + 64, 'v0.1.0  ·  CodeBuddy Hackathon 2026', {
        fontFamily: 'Georgia, serif',
        fontSize: '11px',
        color: '#3d3520'
      })
      .setOrigin(0.5);

    this.cameras.main.fadeIn(500, 0, 0, 0);
  }
}
