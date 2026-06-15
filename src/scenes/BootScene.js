// BootScene - 资源加载与全局配色
// Day1 阶段先用 Phaser 内置 Graphics 生成占位贴图，避免依赖外部素材
import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Day1: 暂无外部素材，用代码生成占位 textures
    // 后续 Day2+ 将在此处加载真实像素素材
  }

  create() {
    // 生成占位贴图：玩家（深色守夜人）
    this.makeRectTexture('tex_player', 16, 24, 0x2b2b3a, 0xd4af37);
    // 守卫（红色巡逻）
    this.makeRectTexture('tex_guard', 16, 24, 0x6b1f1f, 0xe8c87a);
    // 文物（金色方块占位）
    this.makeRectTexture('tex_relic', 12, 12, 0xd4af37, 0xfff3b8);
    // 撤离点（青色）
    this.makeRectTexture('tex_exit', 32, 32, 0x1f6b6b, 0x7ae8e8);
    // 墙体（深灰）
    this.makeRectTexture('tex_wall', 32, 32, 0x1a1a22, 0x2b2b3a);
    // 地板（深棕，木地板感）
    this.makeRectTexture('tex_floor', 32, 32, 0x2a2018, 0x3a2e22);

    this.scene.start('TitleScene');
  }

  /**
   * 生成一个带边框的纯色矩形贴图
   */
  makeRectTexture(key, w, h, fill, border) {
    const g = this.add.graphics();
    g.fillStyle(fill, 1);
    g.fillRect(0, 0, w, h);
    g.lineStyle(1, border, 1);
    g.strokeRect(0, 0, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  }
}
