// CuratorMenuScene - 馆长交互选择菜单（覆盖层）
// 当玩家与馆长交互时，先弹出此菜单让玩家选择：
//   1. 对话（进入原有的 DialogScene 对话流程）
//   2. 文物图鉴（进入 RelicChatScene，与 LLM 对话学习文物知识）
//
// 风格：居中弹出的暗金选择面板，与游戏整体中国风一致

import Phaser from 'phaser';
import Audio from '../systems/AudioFx.js';
import Codex from '../systems/Codex.js';

const SCREEN_W = 960;
const SCREEN_H = 540;

export default class CuratorMenuScene extends Phaser.Scene {
  constructor() {
    super('CuratorMenuScene');
  }

  init(data) {
    this._dialogData = data.dialogData || null;   // Original dialog data for "对话" option
    this._curatorConfig = data.curatorConfig || {};
    this._returnTo = data.returnTo || 'HubScene';
    this._onClose = typeof data.onClose === 'function' ? data.onClose : null;
  }

  create() {
    // Viewport matching HubScene
    this.cameras.main.setViewport(160, 90, SCREEN_W, SCREEN_H);

    // Dim overlay
    const dim = this.add.rectangle(0, 0, SCREEN_W, SCREEN_H, 0x000000, 0.5)
      .setOrigin(0, 0).setDepth(0).setInteractive();
    dim.on('pointerdown', () => this._close());

    // Menu panel
    const PW = 360;
    const PH = 260;
    const px = (SCREEN_W - PW) / 2;
    const py = (SCREEN_H - PH) / 2;

    const panel = this.add.rectangle(px, py, PW, PH, 0x14110a, 0.96)
      .setOrigin(0, 0).setDepth(1);
    panel.setStrokeStyle(2, 0xd4af37, 0.9);
    panel.setInteractive(); // Block click-through

    // Inner border
    this.add.rectangle(px + 6, py + 6, PW - 12, PH - 12, 0x000000, 0)
      .setOrigin(0, 0).setDepth(2).setStrokeStyle(1, 0x8c6b1f, 0.6);

    // Title
    this.add.text(px + PW / 2, py + 28, '林默 · 馆长', {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '18px',
      color: '#fff3b8',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(3);

    this.add.text(px + PW / 2, py + 52, '你想做什么？', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '13px',
      color: '#a08434'
    }).setOrigin(0.5).setDepth(3);

    // Separator
    this.add.rectangle(px + 24, py + 72, PW - 48, 1, 0xd4af37, 0.5)
      .setOrigin(0, 0).setDepth(2);

    // Option 1: 对话
    const opt1 = this._createOption(px + PW / 2, py + 105, '📜  与馆长交谈', '听听馆长对当前局势的看法', () => {
      this._openDialog();
    });

    // Option 2: 文物图鉴
    const discoveredCount = Codex.discoveredIds().length;
    const opt2 = this._createOption(px + PW / 2, py + 160, '🏺  文物图鉴', `已解锁 ${discoveredCount} 件 · 与馆长探讨文物知识`, () => {
      this._openRelicChat();
    });

    // Close hint
    this.add.text(px + PW / 2, py + PH - 24, 'ESC 关闭', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '11px',
      color: '#6b5824'
    }).setOrigin(0.5).setDepth(3);

    // Input
    this.input.keyboard.on('keydown-ESC', () => this._close());
    this.input.keyboard.on('keydown-ONE', () => this._openDialog());
    this.input.keyboard.on('keydown-TWO', () => this._openRelicChat());

    // Fade in
    this.cameras.main.fadeIn(150, 0, 0, 0);
  }

  _createOption(cx, cy, title, subtitle, callback) {
    const BW = 300;
    const BH = 44;

    const bg = this.add.rectangle(cx, cy, BW, BH, 0x1a1208, 0.9)
      .setOrigin(0.5).setDepth(2)
      .setStrokeStyle(1, 0x6b5824, 0.7)
      .setInteractive({ useHandCursor: true });

    const titleText = this.add.text(cx, cy - 8, title, {
      fontFamily: '"PingFang SC", serif',
      fontSize: '15px',
      color: '#e8d27a',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(3);

    const subText = this.add.text(cx, cy + 12, subtitle, {
      fontFamily: '"PingFang SC", serif',
      fontSize: '11px',
      color: '#8c6b1f'
    }).setOrigin(0.5).setDepth(3);

    bg.on('pointerover', () => {
      bg.setStrokeStyle(2, 0xd4af37, 1);
      titleText.setColor('#fff3b8');
    });
    bg.on('pointerout', () => {
      bg.setStrokeStyle(1, 0x6b5824, 0.7);
      titleText.setColor('#e8d27a');
    });
    bg.on('pointerdown', () => {
      Audio.sfx.click && Audio.sfx.click();
      callback();
    });

    return { bg, titleText, subText };
  }

  _openDialog() {
    // Close this menu and launch the original DialogScene
    this.scene.stop();
    if (this._returnTo) this.scene.resume(this._returnTo);

    const hubScene = this.scene.get(this._returnTo);
    if (hubScene && hubScene.openCuratorDialogDirect) {
      hubScene.openCuratorDialogDirect();
    }
  }

  _openRelicChat() {
    // Close this menu and transition to RelicChatScene
    this.scene.stop();
    // Stop the hub scene (not just pause) since RelicChatScene is a full scene
    if (this._returnTo) this.scene.stop(this._returnTo);

    this.scene.start('RelicChatScene', { returnTo: this._returnTo });
  }

  _close() {
    this.scene.stop();
    if (this._returnTo) this.scene.resume(this._returnTo);
    if (this._onClose) this._onClose();
  }
}
