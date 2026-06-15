// IntroScene - 片头动画
// 在玩家首次启动游戏时播放，介绍"夜行司·追回国宝"的世界观。
// 走"分镜逐张显现 + 文字打字机 + 卷轴边框"的极简动画风格。
// 任意时刻按 SPACE / ENTER / ESC 跳过；播完自动进入 HubScene。
// 看过一次后写入 localStorage('nightkeeper:seenIntro')，下次直接跳过。

import Phaser from 'phaser';
import Audio from '../systems/AudioFx.js';

const W = 960;
const H = 540;

// 6 段叙事文字（单段不超过 2 行，让玩家容易消化）
const SCRIPT = [
  {
    title: '· 一 ·',
    body: '近百年间，故土被劫、宝物流离。\n它们辗转于黑市、私窟、海外密仓，无声蒙尘。',
    glyph: '🏛'
  },
  {
    title: '· 二 ·',
    body: '为追回这些被盗的国宝，\n一群无名之人，组成了「夜行司」。',
    glyph: '🌙'
  },
  {
    title: '· 三 ·',
    body: '夜行司不持令、不留名，\n只以一袭夜衣，一腔归藏之愿。',
    glyph: '🗝'
  },
  {
    title: '· 四 ·',
    body: '走私货船、地下黑市、盗墓据点……\n哪里有失散之物，那里就是他们的去处。',
    glyph: '⚔'
  },
  {
    title: '· 五 ·',
    body: '今夜，你接过那枚青铜令牌——\n你是夜行司新一任「夜行干员」。',
    glyph: '🎴'
  },
  {
    title: '· 六 ·',
    body: '让流离的国宝，回它该在的地方。\n——归藏，自此始。',
    glyph: '🏯'
  }
];

const PAGE_DURATION = 3800; // 每页基础展示时长（ms）
const TYPE_SPEED = 38;      // 每字打字间隔（ms）

export default class IntroScene extends Phaser.Scene {
  constructor() { super('IntroScene'); }

  create() {
    Audio.init();

    // 暗色幕布
    this.add.rectangle(0, 0, W, H, 0x080806).setOrigin(0, 0);

    // 顶部 / 底部金色装饰线
    this.add.rectangle(W / 2, 60, 520, 1, 0xd4af37).setAlpha(0.4);
    this.add.rectangle(W / 2, H - 60, 520, 1, 0xd4af37).setAlpha(0.4);

    // 顶部小标
    this.add.text(W / 2, 36, '夜 行 者 · 归 藏', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '14px',
      color: '#6b5824',
      letterSpacing: 4
    }).setOrigin(0.5);

    // 跳过提示
    this.skipHint = this.add.text(W - 24, H - 36, '按 SPACE 继续 · ESC 跳过', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '12px',
      color: '#5a4a20'
    }).setOrigin(1, 0.5);

    // 中央大字符（朝代意象 emoji）
    this.glyphTxt = this.add.text(W / 2, H / 2 - 80, '', {
      fontSize: '96px'
    }).setOrigin(0.5).setAlpha(0);

    // 章节标号
    this.titleTxt = this.add.text(W / 2, H / 2 + 10, '', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '20px',
      color: '#a08434'
    }).setOrigin(0.5).setAlpha(0);

    // 正文（打字机）
    this.bodyTxt = this.add.text(W / 2, H / 2 + 60, '', {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '20px',
      color: '#e8d27a',
      align: 'center',
      lineSpacing: 12
    }).setOrigin(0.5);

    // 进度点
    this.dots = [];
    const dotW = SCRIPT.length * 14;
    for (let i = 0; i < SCRIPT.length; i++) {
      const d = this.add.rectangle(W / 2 - dotW / 2 + i * 14 + 6, H - 36, 6, 6, 0x3d3520);
      this.dots.push(d);
    }

    this.pageIdx = 0;
    this._typing = null;

    // 输入：空格/回车 = 立刻翻页；ESC = 跳过整个片头
    this.input.keyboard.on('keydown-SPACE', () => this.advance());
    this.input.keyboard.on('keydown-ENTER', () => this.advance());
    this.input.keyboard.on('keydown-ESC', () => this.finish());
    this.input.on('pointerdown', () => this.advance());

    this.cameras.main.fadeIn(600, 0, 0, 0);
    this.showPage(0);
  }

  showPage(i) {
    if (i >= SCRIPT.length) {
      this.finish();
      return;
    }
    this.pageIdx = i;
    const data = SCRIPT[i];

    // 清除之前的打字机定时
    if (this._typing) { this._typing.remove(false); this._typing = null; }
    if (this._autoNext) { this._autoNext.remove(false); this._autoNext = null; }

    // 进度点
    this.dots.forEach((d, k) => d.setFillStyle(k <= i ? 0xd4af37 : 0x3d3520));

    // glyph & title 淡入
    this.glyphTxt.setText(data.glyph).setAlpha(0);
    this.titleTxt.setText(data.title).setAlpha(0);
    this.bodyTxt.setText('');

    Audio.sfx.click && Audio.sfx.click();

    this.tweens.add({
      targets: [this.glyphTxt, this.titleTxt],
      alpha: 1,
      duration: 600,
      ease: 'Sine.easeOut',
      onComplete: () => this.startTyping(data.body)
    });
  }

  startTyping(text) {
    let idx = 0;
    this._typing = this.time.addEvent({
      delay: TYPE_SPEED,
      loop: true,
      callback: () => {
        idx++;
        this.bodyTxt.setText(text.slice(0, idx));
        if (idx >= text.length) {
          this._typing.remove(false);
          this._typing = null;
          // 播完文字后，若玩家不操作，PAGE_DURATION 后自动翻页
          this._autoNext = this.time.delayedCall(PAGE_DURATION, () => this.advance());
        }
      }
    });
  }

  advance() {
    // 若文字尚未打完：立刻补全
    if (this._typing) {
      this._typing.remove(false);
      this._typing = null;
      this.bodyTxt.setText(SCRIPT[this.pageIdx].body);
      this._autoNext = this.time.delayedCall(800, () => this.advance());
      return;
    }
    if (this._autoNext) { this._autoNext.remove(false); this._autoNext = null; }
    this.tweens.add({
      targets: [this.glyphTxt, this.titleTxt, this.bodyTxt],
      alpha: 0,
      duration: 380,
      onComplete: () => this.showPage(this.pageIdx + 1)
    });
  }

  finish() {
    try { localStorage.setItem('nightkeeper:seenIntro', '1'); } catch { /* ignore */ }
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('HubScene'));
  }
}
