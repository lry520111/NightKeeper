// 夜行者：归藏 - 入口
import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import TitleScene from './scenes/TitleScene.js';
import IntroScene from './scenes/IntroScene.js';
import HubScene from './scenes/HubScene.js';
import ContractScene from './scenes/ContractScene.js';
import VaultScene from './scenes/VaultScene.js';
import LoadoutScene from './scenes/LoadoutScene.js';
import MuseumScene from './scenes/MuseumScene.js';
import ResultScene from './scenes/ResultScene.js';
import CodexScene from './scenes/CodexScene.js';
import DialogScene from './scenes/DialogScene.js';
import EndingScene from './scenes/EndingScene.js';
import EndingPreviewScene from './scenes/EndingPreviewScene.js';
import SaveSlotsScene from './scenes/SaveSlotsScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: '#0a0a0a',
  // 渲染分辨率：默认 1，高 DPI 屏幕（Retina/4K）按设备像素比提升 → 文字与 UI 清晰
  // 像素美术（角色/瓦片）通过单独 setScale + texture filter 控制，不依赖全局 pixelArt
  pixelArt: false,
  antialias: true,
  antialiasGL: true,
  roundPixels: true,
  resolution: (typeof window !== 'undefined' && window.devicePixelRatio) ? Math.min(window.devicePixelRatio, 2) : 1,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scene: [
    BootScene,
    TitleScene,
    IntroScene,
    HubScene,
    ContractScene,
    VaultScene,
    LoadoutScene,
    MuseumScene,
    ResultScene,
    CodexScene,
    DialogScene,
    EndingScene,
    EndingPreviewScene,
    SaveSlotsScene
  ]
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
