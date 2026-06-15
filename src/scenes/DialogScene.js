// DialogScene - 通用对话覆盖层场景
//
// 用法：
//   this.scene.launch('DialogScene', {
//     pages: ['第一句…', '第二句…'],
//     speaker: '林馆长',
//     portraitKey: 'lz_amelia_idle',  // 可选，sprite key
//     portraitFrame: 0,               // 可选，使用 sprite 的某一帧
//     onComplete: () => { ... }       // 可选，关闭时回调
//   });
//   this.scene.pause();               // 暂停下层
//
// 操作：
//   E / 空格 / 鼠标点击：当前页未打完则立即显示完整；已打完则进入下一页；最后一页则关闭对话
//
// 风格：底部黑底金边对话框，左侧头像 + 上方发言者，下方文字打字机效果

import Phaser from 'phaser';

const BOX_W = 880;
const BOX_H = 150;
const SCREEN_W = 1280;
const SCREEN_H = 720;

export default class DialogScene extends Phaser.Scene {
  constructor() {
    super('DialogScene');
  }

  init(data) {
    this.pages = Array.isArray(data.pages) ? data.pages : [String(data.pages || '...')];
    this.speaker = data.speaker || '';
    this.portraitKey = data.portraitKey || null;
    this.portraitFrame = typeof data.portraitFrame === 'number' ? data.portraitFrame : 0;
    this.returnTo = data.returnTo || null; // 关闭时如果指定，会 resume
    this.onComplete = typeof data.onComplete === 'function' ? data.onComplete : null;

    this.pageIdx = 0;
    this.charIdx = 0;
    this.typeAcc = 0;
    this.pageDone = false;
  }

  create() {
    // —— 半透明遮罩（不全黑，保留下层场景的氛围） ——
    const dim = this.add.rectangle(0, 0, SCREEN_W, SCREEN_H, 0x000000, 0.35).setOrigin(0, 0);
    dim.setDepth(0);

    // —— 对话框背景 ——
    const boxX = (SCREEN_W - BOX_W) / 2;
    const boxY = SCREEN_H - BOX_H - 30;

    // 外阴影
    this.add.rectangle(boxX + 4, boxY + 4, BOX_W, BOX_H, 0x000000, 0.5).setOrigin(0, 0).setDepth(1);
    // 主体（深棕）
    const box = this.add.rectangle(boxX, boxY, BOX_W, BOX_H, 0x18120a, 0.94).setOrigin(0, 0).setDepth(2);
    box.setStrokeStyle(2, 0xd4af37, 0.95);
    // 内描边（金色细线）
    this.add
      .rectangle(boxX + 6, boxY + 6, BOX_W - 12, BOX_H - 12, 0x000000, 0)
      .setOrigin(0, 0)
      .setDepth(3)
      .setStrokeStyle(1, 0x8c6b1f, 0.7);

    // —— 头像区（左侧 96x96 框） ——
    const portraitX = boxX + 22;
    const portraitY = boxY + 22;
    const portraitSize = 96;
    this.add
      .rectangle(portraitX, portraitY, portraitSize, portraitSize, 0x2a1d10, 0.95)
      .setOrigin(0, 0)
      .setDepth(3)
      .setStrokeStyle(1, 0xd4af37, 0.6);

    if (this.portraitKey && this.textures.exists(this.portraitKey)) {
      // 16x32 像素角色，放大 4 倍 = 64x128 → 取上半身 64x64 居中
      const portrait = this.add
        .sprite(portraitX + portraitSize / 2, portraitY + portraitSize / 2 + 8, this.portraitKey, this.portraitFrame)
        .setDepth(4);
      portrait.setScale(4);
      // 让角色头部出现在框中（向下偏移）
      portrait.y = portraitY + portraitSize / 2 + 16;
      // idle 动画
      const idleAnimKey = this.portraitKey.replace('lz_', '').replace('_idle', '_idle_down');
      if (this.anims.exists(idleAnimKey)) {
        portrait.play(idleAnimKey);
      }
      this.portrait = portrait;
    }

    // —— 发言者名字（头像上方） ——
    if (this.speaker) {
      this.add
        .text(portraitX, boxY - 4, this.speaker, {
          fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
          fontSize: '15px',
          color: '#fff3b8',
          backgroundColor: '#1a1208',
          padding: { x: 8, y: 3 }
        })
        .setOrigin(0, 1)
        .setDepth(5);
    }

    // —— 正文文字 ——
    const textX = portraitX + portraitSize + 24;
    const textY = boxY + 24;
    const textW = BOX_W - (textX - boxX) - 24;
    this.bodyText = this.add
      .text(textX, textY, '', {
        fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
        fontSize: '17px',
        color: '#f4e6c1',
        wordWrap: { width: textW, useAdvancedWrap: true },
        lineSpacing: 6
      })
      .setDepth(4);

    // —— "▼"提示（页底） ——
    this.nextHint = this.add
      .text(boxX + BOX_W - 18, boxY + BOX_H - 14, '▼', {
        fontFamily: 'serif',
        fontSize: '14px',
        color: '#d4af37'
      })
      .setOrigin(1, 1)
      .setDepth(5)
      .setVisible(false);
    this.tweens.add({
      targets: this.nextHint,
      alpha: { from: 0.4, to: 1 },
      duration: 600,
      yoyo: true,
      repeat: -1
    });

    // —— 操作提示 ——
    this.add
      .text(SCREEN_W / 2, boxY - 18, 'E / 空格 / 点击 继续', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '11px',
        color: '#7a6a3a'
      })
      .setOrigin(0.5)
      .setDepth(5);

    // —— 输入 ——
    this.keys = this.input.keyboard.addKeys('E,SPACE,ENTER,ESC');
    this.input.on('pointerdown', () => this.advance());
    this.keys.E.on('down', () => this.advance());
    this.keys.SPACE.on('down', () => this.advance());
    this.keys.ENTER.on('down', () => this.advance());
    this.keys.ESC.on('down', () => this.skipAll());

    // 入场
    this.cameras.main.fadeIn(180, 0, 0, 0);
  }

  update(_time, delta) {
    if (this.pageDone) return;
    const page = this.pages[this.pageIdx] || '';
    if (this.charIdx >= page.length) {
      this.pageDone = true;
      this.bodyText.setText(page);
      this.nextHint.setVisible(true);
      return;
    }
    // 每 28ms 出 1 个字
    this.typeAcc += delta;
    while (this.typeAcc >= 28 && this.charIdx < page.length) {
      this.typeAcc -= 28;
      this.charIdx += 1;
    }
    this.bodyText.setText(page.slice(0, this.charIdx));
  }

  advance() {
    if (!this.pageDone) {
      // 当前页直接补完
      const page = this.pages[this.pageIdx] || '';
      this.charIdx = page.length;
      this.bodyText.setText(page);
      this.pageDone = true;
      this.nextHint.setVisible(true);
      return;
    }
    // 下一页
    this.pageIdx += 1;
    if (this.pageIdx >= this.pages.length) {
      this.close();
      return;
    }
    this.charIdx = 0;
    this.typeAcc = 0;
    this.pageDone = false;
    this.nextHint.setVisible(false);
    this.bodyText.setText('');
  }

  skipAll() {
    this.close();
  }

  close() {
    this.cameras.main.fadeOut(160, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const cb = this.onComplete;
      const back = this.returnTo;
      this.scene.stop();
      if (back) this.scene.resume(back);
      if (cb) cb();
    });
  }
}
