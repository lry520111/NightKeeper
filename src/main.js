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

const config = {
  type: Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: '#0a0a0a',
  // 像素游戏关键设置
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 540
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
    CodexScene
  ]
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
