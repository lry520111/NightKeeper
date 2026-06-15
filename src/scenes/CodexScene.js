// CodexScene - 文物百科 / 图鉴页
// 入口：TitleScene 的"［ 文物图鉴 ］"按钮
// 内容：
//   · 顶部：仓库统计（已收集 X / 全 Y、撤离次数、累计价值、最佳一局）
//   · 中部：所有文物以卡片网格展示（两列宽卡片，含 AI 生成介绍 + 夜枭批语）
//      - 已发现 → 完整图标 + 名称 + 朝代 + intro + quote
//      - 未发现 → 灰色剪影 + "??? · 尚未入仓"
//   · 底部：返回按钮 + 重置仓库（小字）
//
// 美术风格沿用 TitleScene 的暗金中国风
import Phaser from 'phaser';
import { RELICS, RARITY_COLOR } from '../data/relics.js';
import Codex from '../systems/Codex.js';
import Audio from '../systems/AudioFx.js';

const RARITY_LABEL = {
  legendary: '传世',
  epic: '稀世',
  rare: '珍品',
  common: '常品'
};

// 卡片网格参数（两列宽卡）
const CARD_W = 430;
const CARD_H = 154;
const COLS = 2;
const GAP_X = 18;
const GAP_Y = 14;
const VIEW_TOP = 110;            // 卡片可视区起始 Y
const VIEW_BOTTOM = 510;         // 可视区底部 Y

export default class CodexScene extends Phaser.Scene {
  constructor() {
    super('CodexScene');
  }

  init(data) {
    this._returnTo = (data && data.returnTo) || 'TitleScene';
  }

  create() {
    Audio.init();
    const { width, height } = this.scale;
    const state = Codex.getState();
    const discovered = new Set(Object.keys(state.relics));

    // —— 背景 ——
    this.add.rectangle(0, 0, width, height, 0x0a0a0a).setOrigin(0, 0);
    // 顶部 / 底部装饰金线
    this.add.rectangle(width / 2, 50, width - 80, 1, 0xd4af37).setDepth(2);
    this.add.rectangle(width / 2, height - 50, width - 80, 1, 0xd4af37).setDepth(2);

    // —— 标题 ——
    this.add
      .text(width / 2, 26, '归藏 · 文物图鉴', {
        fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
        fontSize: '22px',
        color: '#d4af37',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(3);

    // —— 顶部统计条 ——
    const statText =
      `已入仓 ${discovered.size} / ${RELICS.length}   ·   ` +
      `撤离 ${state.runs.success} 成 / ${state.runs.fail} 败   ·   ` +
      `累计价值 ¥ ${state.totalValue}   ·   ` +
      `最佳一局 ¥ ${state.bestRun.value || 0}`;
    this.add
      .text(width / 2, 68, statText, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '13px',
        color: '#a08434'
      })
      .setOrigin(0.5)
      .setDepth(3);

    // —— 顶部遮罩条（让滚动卡片视觉上"消失"在金线之下） ——
    this.add.rectangle(0, 0, width, VIEW_TOP - 6, 0x0a0a0a, 1).setOrigin(0, 0).setDepth(2);
    this.add.rectangle(0, VIEW_BOTTOM, width, height - VIEW_BOTTOM, 0x0a0a0a, 1).setOrigin(0, 0).setDepth(2);

    // —— 文物卡片网格（放入容器以支持滚动） ——
    const gridTotalW = COLS * CARD_W + (COLS - 1) * GAP_X;
    const startX = (width - gridTotalW) / 2;
    const startY = VIEW_TOP;

    this.cardLayer = this.add.container(0, 0).setDepth(1);

    RELICS.forEach((relic, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const x = startX + col * (CARD_W + GAP_X);
      const y = startY + row * (CARD_H + GAP_Y);
      this.drawCard(this.cardLayer, x, y, relic, discovered.has(relic.id), state.relics[relic.id]);
    });

    // —— 滚动支持 ——
    const totalRows = Math.ceil(RELICS.length / COLS);
    const contentH = totalRows * CARD_H + (totalRows - 1) * GAP_Y;
    const visibleH = VIEW_BOTTOM - VIEW_TOP;
    this._scrollMin = Math.min(0, visibleH - contentH);
    this._scrollMax = 0;
    this._scrollY = 0;
    this.input.on('wheel', (_p, _o, _dx, dy) => {
      this._scrollY = Phaser.Math.Clamp(this._scrollY - dy * 0.6, this._scrollMin, this._scrollMax);
      this.cardLayer.y = this._scrollY;
    });
    // 上下键也可滚动
    this.input.keyboard.on('keydown-DOWN', () => {
      this._scrollY = Phaser.Math.Clamp(this._scrollY - 28, this._scrollMin, this._scrollMax);
      this.cardLayer.y = this._scrollY;
    });
    this.input.keyboard.on('keydown-UP', () => {
      this._scrollY = Phaser.Math.Clamp(this._scrollY + 28, this._scrollMin, this._scrollMax);
      this.cardLayer.y = this._scrollY;
    });

    // —— 返回按钮 ——
    const backBtn = this.add
      .text(width / 2, height - 26, '［ 返回 ］', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '18px',
        color: '#e8d27a'
      })
      .setOrigin(0.5)
      .setDepth(3)
      .setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setColor('#fff3b8'));
    backBtn.on('pointerout', () => backBtn.setColor('#e8d27a'));
    backBtn.on('pointerdown', () => { Audio.sfx.click(); this.scene.start(this._returnTo || 'TitleScene'); });

    // ESC 也可返回
    this.input.keyboard.once('keydown-ESC', () => this.scene.start(this._returnTo || 'TitleScene'));

    // —— 滚动提示 ——
    if (this._scrollMin < 0) {
      this.add
        .text(width - 20, 90, '↑↓ / 滚轮 翻阅', {
          fontFamily: '"PingFang SC", serif',
          fontSize: '11px',
          color: '#6b5824'
        })
        .setOrigin(1, 0.5)
        .setDepth(3);
    }

    // —— 重置仓库（开发用，小字）——
    const resetBtn = this.add
      .text(width - 16, height - 26, '清空仓库', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '11px',
        color: '#3d3520'
      })
      .setOrigin(1, 0.5)
      .setDepth(3)
      .setInteractive({ useHandCursor: true });
    resetBtn.on('pointerover', () => resetBtn.setColor('#7a3030'));
    resetBtn.on('pointerout', () => resetBtn.setColor('#3d3520'));
    resetBtn.on('pointerdown', () => {
      Codex.reset();
      this.scene.restart();
    });

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  /** 绘制单张文物卡片（已扩大并展示 intro/quote） */
  drawCard(layer, x, y, relic, found, meta) {
    const rarityColorHex = RARITY_COLOR[relic.rarity] || '#9ca3af';
    const rarityColorNum = Phaser.Display.Color.HexStringToColor(rarityColorHex).color;

    // 卡片背板
    const bgColor = found ? 0x141414 : 0x0d0d0d;
    const card = this.add.rectangle(x, y, CARD_W, CARD_H, bgColor).setOrigin(0, 0);
    card.setStrokeStyle(1, found ? rarityColorNum : 0x2a2a2a);
    layer.add(card);

    // 左侧稀有度色条
    const stripe = this.add.rectangle(x, y, 4, CARD_H, rarityColorNum).setOrigin(0, 0);
    layer.add(stripe);

    // 图标占位（圆形底 + 文物贴图，未发现则灰色剪影）
    const iconCx = x + 50;
    const iconCy = y + 38;
    const iconBg = this.add.circle(iconCx, iconCy, 30, 0x1f1d18).setStrokeStyle(1, 0x3d3520);
    layer.add(iconBg);
    if (relic.icon && this.textures.exists(relic.icon)) {
      const img = this.add.image(iconCx, iconCy, relic.icon);
      img.setScale(1.0);
      if (!found) img.setTint(0x101010); // 剪影
      layer.add(img);
    }

    if (!found) {
      // 未发现：??? + 提示
      const t1 = this.add.text(x + 96, y + 16, '？？？', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '17px',
        color: '#3d3520',
        fontStyle: 'bold'
      });
      const t2 = this.add.text(x + 96, y + 42, '尚未入仓', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '11px',
        color: '#3d3520'
      });
      const t3 = this.add.text(x + 96, y + 64, '出仓博物馆，亲手将其带回。\n夜枭尚未为它落笔。', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '10px',
        color: '#2a2418',
        wordWrap: { width: CARD_W - 110 },
        lineSpacing: 4
      });
      layer.add([t1, t2, t3]);
      return;
    }

    // 已发现：完整信息
    const titleTxt = this.add.text(x + 96, y + 10, relic.name, {
      fontFamily: '"PingFang SC", serif',
      fontSize: '15px',
      color: '#e8d27a',
      fontStyle: 'bold'
    });
    const subTxt = this.add.text(x + 96, y + 30, `${relic.dynasty} · ${RARITY_LABEL[relic.rarity] || '常品'}`, {
      fontFamily: '"PingFang SC", serif',
      fontSize: '11px',
      color: rarityColorHex
    });
    layer.add([titleTxt, subTxt]);

    // 介绍正文（intro，AI 生成）
    const intro = relic.intro || relic.desc || '';
    const introTxt = this.add.text(x + 12, y + 78, intro, {
      fontFamily: '"PingFang SC", serif',
      fontSize: '11px',
      color: '#bfa86b',
      wordWrap: { width: CARD_W - 24 },
      lineSpacing: 3
    });
    layer.add(introTxt);

    // 夜枭批语（quote）放在底部，斜体，金色
    if (relic.quote) {
      const quoteTxt = this.add.text(x + CARD_W - 12, y + CARD_H - 22, relic.quote, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '11px',
        color: '#d4af37',
        fontStyle: 'italic'
      }).setOrigin(1, 0);
      layer.add(quoteTxt);
    }

    // 右上角：价值 + 入仓次数
    const cnt = meta ? meta.count || 1 : 1;
    const valTxt = this.add.text(x + CARD_W - 10, y + 10, `¥${relic.value}  · ×${cnt}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '11px',
      color: '#d4af37'
    }).setOrigin(1, 0);
    layer.add(valTxt);
  }
}
