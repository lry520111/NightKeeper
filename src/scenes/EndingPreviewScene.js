// EndingPreviewScene — 结局预览菜单
//
// 入口：TitleScene 的「结局预览」按钮。
// 用途：开发期 / 演示期间快速预览 4 种结局的视觉效果，**不会写入存档**。
// 流程：
//   点击某个结局卡片 → 用 preview:true 启动 EndingScene
//   EndingScene 在预览模式下：不调用 markEndingSeen()、按钮变为「上一个 / 返回 / 下一个」
//
// 设计原则：
//   - 与 TitleScene 同色调 / 字体，保持风格统一
//   - 数据条仅显示触发条件，不显示真实玩家数据
//   - 顶部加 PREVIEW 角标提示这是开发预览

import Phaser from 'phaser';
import Audio from '../systems/AudioFx.js';
import { ENDINGS } from '../systems/Endings.js';

export default class EndingPreviewScene extends Phaser.Scene {
  constructor() { super('EndingPreviewScene'); }

  create() {
    const { width, height } = this.scale;
    Audio.init();

    // 背景
    this.add.rectangle(0, 0, width, height, 0x0a0a0a).setOrigin(0, 0);

    // 顶部金线 / 底部金线
    this.add.rectangle(width / 2, 60, 320, 1, 0xd4af37);
    this.add.rectangle(width / 2, height - 60, 320, 1, 0xd4af37);

    // 标题
    this.add
      .text(width / 2, 90, '结　局　预　览', {
        fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
        fontSize: '36px',
        color: '#d4af37',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setResolution(2);

    this.add
      .text(width / 2, 130, '点击任一结局即可进入预览。预览不会写入存档。', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '13px',
        color: '#7a6228'
      })
      .setOrigin(0.5)
      .setResolution(2);

    // PREVIEW 角标
    this.add
      .text(width - 16, 16, 'PREVIEW', {
        fontFamily: 'Georgia, serif',
        fontSize: '11px',
        color: '#1a1208',
        backgroundColor: '#d4af37',
        padding: { x: 8, y: 3 }
      })
      .setOrigin(1, 0)
      .setResolution(2);

    // —— 结局卡片列表 —— //
    // 4 种结局 + 触发条件简述
    const cards = [
      {
        id: 'gui_cang',
        condition: '文物 ≥ 6  ·  累计击杀 = 0'
      },
      {
        id: 'tie_wan',
        condition: '文物 ≥ 5  ·  累计击杀 ≥ 8'
      },
      {
        id: 'shi_kuai',
        condition: '文物 < 5  ·  累计消费 ≥ ¥1500  ·  出击 ≥ 3 次'
      },
      {
        id: 'ye_xing_zhe',
        condition: '文物 ≥ 6  ·  无伤通关 ≥ 3 次  · （隐藏）'
      }
    ];

    // 卡片 2x2 网格布局
    const cardW = 380;
    const cardH = 110;
    const gapX = 32;
    const gapY = 24;
    const gridW = cardW * 2 + gapX;
    const gridH = cardH * 2 + gapY;
    const startX = (width - gridW) / 2 + cardW / 2;
    const startY = 200 + cardH / 2;

    cards.forEach((c, i) => {
      const meta = ENDINGS[c.id];
      if (!meta) return;
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = startX + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY);
      this._buildCard(cx, cy, cardW, cardH, meta, c.condition);
    });

    // —— 返回按钮 —— //
    const backBtn = this.add
      .text(width / 2, height - 32, '［ 返回标题 ］', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '15px',
        color: '#a08434'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setColor('#fff3b8'));
    backBtn.on('pointerout', () => backBtn.setColor('#a08434'));
    backBtn.on('pointerdown', () => {
      Audio.sfx.click && Audio.sfx.click();
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('TitleScene'));
    });

    // ESC 快捷返回
    this.input.keyboard.once('keydown-ESC', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('TitleScene'));
    });

    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  // 单张结局卡片
  _buildCard(cx, cy, w, h, meta, condition) {
    const colorNum = Phaser.Display.Color.HexStringToColor(meta.color).color;

    // 卡背
    const bg = this.add
      .rectangle(cx, cy, w, h, 0x14110a, 0.95)
      .setStrokeStyle(1, colorNum, 0.55)
      .setInteractive({ useHandCursor: true });

    // 标题（结局名）
    const title = this.add
      .text(cx - w / 2 + 18, cy - h / 2 + 16, meta.title, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '24px',
        color: meta.color,
        fontStyle: 'bold'
      })
      .setOrigin(0, 0)
      .setResolution(2);

    // 副标题（True Ending 等）
    this.add
      .text(cx - w / 2 + 18, cy - h / 2 + 50, meta.subtitle || '', {
        fontFamily: 'Georgia, serif',
        fontSize: '12px',
        color: '#a08434'
      })
      .setOrigin(0, 0)
      .setResolution(2);

    // 触发条件
    this.add
      .text(cx - w / 2 + 18, cy - h / 2 + 72, `触发：${condition}`, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '11px',
        color: '#7a6228'
      })
      .setOrigin(0, 0)
      .setResolution(2);

    // 右下角"预览 ▶"
    const arrow = this.add
      .text(cx + w / 2 - 14, cy + h / 2 - 12, '预览 ▶', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: '#fff3b8'
      })
      .setOrigin(1, 1)
      .setResolution(2);

    // 悬停高亮
    bg.on('pointerover', () => {
      bg.setStrokeStyle(2, colorNum, 1);
      bg.setFillStyle(0x1f1a10, 1);
      title.setColor('#fff3b8');
    });
    bg.on('pointerout', () => {
      bg.setStrokeStyle(1, colorNum, 0.55);
      bg.setFillStyle(0x14110a, 0.95);
      title.setColor(meta.color);
    });
    bg.on('pointerdown', () => {
      Audio.sfx.click && Audio.sfx.click();
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('EndingScene', { endingId: meta.id, preview: true });
      });
    });
  }
}
