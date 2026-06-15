// TitleScene - 标题菜单
import Phaser from 'phaser';
import Codex from '../systems/Codex.js';
import { RELICS } from '../data/relics.js';
import Audio from '../systems/AudioFx.js';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    const { width, height } = this.scale;

    // 暗色背景 + 微金色装饰线
    this.add.rectangle(0, 0, width, height, 0x0a0a0a).setOrigin(0, 0);

    // 顶部装饰线
    this.add.rectangle(width / 2, 80, 320, 1, 0xd4af37);
    this.add.rectangle(width / 2, height - 80, 320, 1, 0xd4af37);

    // 标题（中文主标题 + 英文副标题）
    this.add
      .text(width / 2, height / 2 - 60, '夜　行　者', {
        fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
        fontSize: '64px',
        color: '#d4af37',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2, '— 归　藏 —', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '24px',
        color: '#a08434'
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 36, 'NightKeeper', {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        color: '#6b5824',
        fontStyle: 'italic'
      })
      .setOrigin(0.5);

    // 开始按钮
    const startBtn = this.add
      .text(width / 2, height / 2 + 110, '［ 进入博物馆 ］', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '22px',
        color: '#e8d27a'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    startBtn.on('pointerover', () => startBtn.setColor('#fff3b8'));
    startBtn.on('pointerout', () => startBtn.setColor('#e8d27a'));
    startBtn.on('pointerdown', () => {
      Audio.init();         // 首次点击解锁 AudioContext
      Audio.sfx.click();
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('MuseumScene');
      });
    });

    // 文物图鉴按钮
    const codexBtn = this.add
      .text(width / 2, height / 2 + 152, '［ 文物图鉴 ］', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '18px',
        color: '#a08434'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    codexBtn.on('pointerover', () => codexBtn.setColor('#fff3b8'));
    codexBtn.on('pointerout', () => codexBtn.setColor('#a08434'));
    codexBtn.on('pointerdown', () => {
      Audio.init();
      Audio.sfx.click();
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('CodexScene');
      });
    });

    // 仓库进度小字
    const state = Codex.getState();
    const found = Object.keys(state.relics).length;
    const progressText = found > 0
      ? `仓库 ${found} / ${RELICS.length}  ·  撤离 ${state.runs.success} 次  ·  累计 ¥${state.totalValue}`
      : `归藏待启 · 共 ${RELICS.length} 件国宝待归仓`;
    this.add
      .text(width / 2, height / 2 + 184, progressText, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '11px',
        color: '#6b5824'
      })
      .setOrigin(0.5);

    // 底部说明
    this.add
      .text(width / 2, height - 50, '方向键 / WASD 移动 ·  Shift 潜行 ·  E 拾取 / 撤离', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '13px',
        color: '#6b5824'
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height - 30, 'v0.1.0  ·  CodeBuddy Hackathon 2026', {
        fontFamily: 'Georgia, serif',
        fontSize: '11px',
        color: '#3d3520'
      })
      .setOrigin(0.5);

    this.cameras.main.fadeIn(500, 0, 0, 0);
  }
}
