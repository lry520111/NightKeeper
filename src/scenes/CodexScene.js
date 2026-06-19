// CodexScene - 文物百科 / 图鉴页
// 入口：TitleScene 的"［ 文物图鉴 ］"按钮
// 内容：
//   · 顶部：仓库统计（已收集 X / 全 Y、撤离次数、累计价值、最佳一局）
//   · 中部：所有文物以卡片网格展示（两列宽卡片，含 AI 生成介绍 + 夜枭批语）
//      - 已发现 → 完整图标 + 名称 + 朝代 + intro + quote，点击可查看三段式完整百科
//      - 未发现 → 灰色剪影 + "??? · 尚未入仓"
//   · 详情面板：历史档案 / 流散经历 / 归来感言（三段式，调用 LLM，失败走 fallback）
//   · 底部：返回按钮 + 重置仓库（小字）
//
// 美术风格沿用 TitleScene 的暗金中国风
import Phaser from 'phaser';
import { RELICS, RARITY_COLOR } from '../data/relics.js';
import Codex from '../systems/Codex.js';
import Audio from '../systems/AudioFx.js';
import LLM from '../systems/LLM.js';

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

    // —— 顶部 / 底部遮罩条 ——
    this.add.rectangle(0, 0, width, VIEW_TOP - 6, 0x0a0a0a, 1).setOrigin(0, 0).setDepth(2);
    this.add.rectangle(0, VIEW_BOTTOM, width, height - VIEW_BOTTOM, 0x0a0a0a, 1).setOrigin(0, 0).setDepth(2);

    // —— 文物卡片网格 ——
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
      if (this._detailLayer) return; // 详情打开时不滚列表
      this._scrollY = Phaser.Math.Clamp(this._scrollY - dy * 0.6, this._scrollMin, this._scrollMax);
      this.cardLayer.y = this._scrollY;
    });
    this.input.keyboard.on('keydown-DOWN', () => {
      if (this._detailLayer) return;
      this._scrollY = Phaser.Math.Clamp(this._scrollY - 28, this._scrollMin, this._scrollMax);
      this.cardLayer.y = this._scrollY;
    });
    this.input.keyboard.on('keydown-UP', () => {
      if (this._detailLayer) return;
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
    backBtn.on('pointerdown', () => {
      if (this._detailLayer) { this.closeDetail(); return; }
      Audio.sfx.click();
      this.scene.start(this._returnTo || 'TitleScene');
    });

    // ESC 也可返回 / 关闭详情
    this.input.keyboard.on('keydown-ESC', () => {
      if (this._detailLayer) { this.closeDetail(); return; }
      this.scene.start(this._returnTo || 'TitleScene');
    });

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

    this._detailLayer = null;

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  // ============================================================
  //  详情面板：三段式（历史档案 / 流散经历 / 归来感言）
  //  · 优先取 LLM 缓存；启用 LLM → 实时生成；失败 → relic.fallback
  // ============================================================
  openDetail(relic) {
    if (this._detailLayer) return;
    const { width, height } = this.scale;

    const layer = this.add.container(0, 0).setDepth(50);
    this._detailLayer = layer;

    // 蒙版
    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.78).setOrigin(0, 0).setInteractive();
    dim.on('pointerdown', () => this.closeDetail());
    layer.add(dim);

    // 主面板（加宽）
    const PW = 820;
    const PH = 470;
    const px = (width - PW) / 2;
    const py = (height - PH) / 2;
    // 正文可用宽度（左右各 32 padding）
    const TEXT_PAD = 32;
    const TEXT_W = PW - TEXT_PAD * 2;
    const rarityHex = RARITY_COLOR[relic.rarity] || '#9ca3af';
    const rarityNum = Phaser.Display.Color.HexStringToColor(rarityHex).color;

    const panel = this.add.rectangle(px, py, PW, PH, 0x14110a, 0.98).setOrigin(0, 0);
    panel.setStrokeStyle(2, rarityNum, 0.9);
    panel.setInteractive(); // 阻止点击穿透到 dim
    layer.add(panel);
    layer.add(
      this.add.rectangle(px + 6, py + 6, PW - 12, PH - 12, 0x000000, 0)
        .setOrigin(0, 0).setStrokeStyle(1, 0x8c6b1f, 0.6)
    );

    // 标题
    const title = this.add.text(px + TEXT_PAD, py + 18, relic.name, {
      fontFamily: '"PingFang SC", serif',
      fontSize: '22px',
      color: '#fff3b8',
      fontStyle: 'bold'
    }).setResolution(2);
    layer.add(title);
    const sub = this.add.text(
      px + TEXT_PAD, py + 50,
      `${relic.dynasty}　·　${RARITY_LABEL[relic.rarity] || ''}　·　${relic.material || ''}`,
      {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: rarityHex
      }
    ).setResolution(2);
    layer.add(sub);

    // 关闭按钮
    const closeBtn = this.add
      .text(px + PW - 24, py + 24, '✕', {
        fontFamily: 'serif',
        fontSize: '20px',
        color: '#a08434'
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor('#fff3b8'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#a08434'));
    closeBtn.on('pointerdown', () => this.closeDetail());
    layer.add(closeBtn);

    // 顶部金线
    layer.add(this.add.rectangle(px + TEXT_PAD, py + 80, PW - TEXT_PAD * 2, 1, 0xd4af37, 0.6).setOrigin(0, 0));

    // 三段标题 + 正文（先填占位，异步加载完替换）
    const sections = [
      { key: 'archive', label: '【 历史档案 】', scenario: 'relic_codex_archive', y: py + 96 },
      { key: 'journey', label: '【 流散经历 】', scenario: 'relic_codex_journey', y: py + 224 },
      { key: 'welcome', label: '【 归来感言 】', scenario: 'relic_codex_welcome', y: py + 352 }
    ];

    const bodyTexts = {};
    sections.forEach((sec) => {
      const head = this.add.text(px + TEXT_PAD, sec.y, sec.label, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '14px',
        color: '#d4af37',
        fontStyle: 'bold'
      }).setResolution(2);
      layer.add(head);

      const placeholder = LLM.isEnabled()
        ? '（夜枭正在执笔……）'
        : (relic.fallback && relic.fallback[sec.key]) || relic.intro || '——';
      const body = this.add.text(px + TEXT_PAD, sec.y + 22, placeholder, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: '#bfa86b',
        wordWrap: { width: TEXT_W, useAdvancedWrap: true },
        lineSpacing: 5
      }).setResolution(2);
      layer.add(body);
      bodyTexts[sec.key] = body;
    });

    // 底部：来源标记（仅启用 LLM 时显示加载来源）
    const srcTip = this.add.text(px + PW - 24, py + PH - 22, '', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '10px',
      color: '#6b5824'
    }).setOrigin(1, 0.5).setResolution(2);
    layer.add(srcTip);

    // 异步加载（启用 LLM 时才会真正发请求；否则 LLM.call 会立刻 resolve 成 fallback）
    const fb = relic.fallback || {};
    sections.forEach(async (sec) => {
      try {
        const res = await LLM.call({
          scenario: sec.scenario,
          cacheKey: relic.id,
          context: { relic },
          fallback: fb[sec.key] || relic.intro || ''
        });
        if (!this._detailLayer || !bodyTexts[sec.key] || !bodyTexts[sec.key].active) return;
        bodyTexts[sec.key].setText(res.text);
        if (LLM.isEnabled()) {
          if (res.source === 'llm') {
            srcTip.setText('✦ 由腾讯混元生成 ✦');
            srcTip.setColor('#f5d97f');
            srcTip.setShadow(0, 0, '#d4af37', 4, false, true);
          } else {
            srcTip.setText(res.source === 'cache' ? '· 来自缓存 ·' : '· 兜底文案 ·');
          }
        }
      } catch {
        if (this._detailLayer && bodyTexts[sec.key] && bodyTexts[sec.key].active) {
          bodyTexts[sec.key].setText(fb[sec.key] || relic.intro || '——');
        }
      }
    });
  }

  closeDetail() {
    if (!this._detailLayer) return;
    this._detailLayer.destroy();
    this._detailLayer = null;
  }

  /** 绘制单张文物卡片（已扩大并展示 intro/quote） */
  fitCardText(text, maxUnits, maxLines) {
    const raw = String(text || '').replace(/\s+/g, ' ').trim();
    const lines = [];
    let line = '';
    let units = 0;
    let consumed = 0;

    for (const ch of raw) {
      const unit = /[\x00-\x7f]/.test(ch) ? 0.55 : 1;
      if (units + unit > maxUnits && line) {
        lines.push(line);
        if (lines.length >= maxLines) break;
        line = '';
        units = 0;
      }
      line += ch;
      units += unit;
      consumed += 1;
    }

    if (lines.length < maxLines && line) lines.push(line);
    const fitted = lines.join('\n');
    return consumed < raw.length && fitted
      ? `${fitted.replace(/[，。；、,.!?！？：:]*$/, '')}…`
      : fitted;
  }

  drawCard(layer, x, y, relic, found, meta) {
    const rarityColorHex = RARITY_COLOR[relic.rarity] || '#9ca3af';
    const rarityColorNum = Phaser.Display.Color.HexStringToColor(rarityColorHex).color;

    // 卡片背板
    const bgColor = found ? 0x141414 : 0x0d0d0d;
    const card = this.add.rectangle(x, y, CARD_W, CARD_H, bgColor).setOrigin(0, 0);
    card.setStrokeStyle(1, found ? rarityColorNum : 0x2a2a2a);
    layer.add(card);

    // 已发现的卡片可点击 → 弹出三段式详情
    if (found) {
      card.setInteractive({ useHandCursor: true });
      card.on('pointerover', () => card.setStrokeStyle(2, rarityColorNum));
      card.on('pointerout', () => card.setStrokeStyle(1, rarityColorNum));
      card.on('pointerdown', () => {
        Audio.sfx.click && Audio.sfx.click();
        this.openDetail(relic);
      });
    }

    // 左侧稀有度色条
    const stripe = this.add.rectangle(x, y, 4, CARD_H, rarityColorNum).setOrigin(0, 0);
    layer.add(stripe);

    // 图标占位
    const iconCx = x + 50;
    const iconCy = y + 38;
    const iconBg = this.add.circle(iconCx, iconCy, 30, 0x1f1d18).setStrokeStyle(1, 0x3d3520);
    layer.add(iconBg);
    if (relic.icon && this.textures.exists(relic.icon)) {
      const img = this.add.image(iconCx, iconCy, relic.icon);
      const src = this.textures.get(relic.icon).getSourceImage();
      const maxIconSize = 48;
      const scale = src
        ? Math.min(maxIconSize / src.width, maxIconSize / src.height, 1)
        : 1;
      img.setScale(scale);
      if (!found) img.setTint(0x101010);
      layer.add(img);
    }

    if (!found) {
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
    const introTxt = this.add.text(x + 12, y + 78, this.fitCardText(intro, 39, 2), {
      fontFamily: '"PingFang SC", serif',
      fontSize: '11px',
      color: '#bfa86b',
      wordWrap: { width: CARD_W - 24, useAdvancedWrap: true },
      lineSpacing: 3
    });
    layer.add(introTxt);

    // 卡片左下角：点击查看完整百科
    const moreTxt = this.add.text(x + 12, y + CARD_H - 18, '› 点开查看完整百科', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '10px',
      color: '#7a6a3a'
    });
    layer.add(moreTxt);

    // 夜枭批语（quote）
    if (relic.quote) {
      const quoteTxt = this.add.text(x + CARD_W - 12, y + CARD_H - 22, this.fitCardText(relic.quote, 24, 1), {
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
