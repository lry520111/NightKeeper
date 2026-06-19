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
import RelicChatScene from './scenes/RelicChatScene.js';
import CuratorMenuScene from './scenes/CuratorMenuScene.js';
import TrainingScene from './scenes/TrainingScene.js';
import BossRoomScene from './scenes/BossRoomScene.js';
const config = {
  type: Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: '#0a0a0a',
  // 像素美术保护：
  //   · pixelArt: false  → 文字 / UI 仍走 LINEAR（不锯齿）
  //   · antialias: false → 全局采样默认 NEAREST（像素图锐利）
  //   · BootScene 中所有 tex_* / lz_* 纹理都已显式 setFilter(NEAREST)
  //   · roundPixels: true → 角色不会落在半像素，避免毛边
  pixelArt: false,
  antialias: false,
  antialiasGL: false,
  roundPixels: true,
  // 高 DPI 屏（Retina/4K）按设备像素比提升渲染分辨率 → Canvas 实际像素 ×2
  // （本身不改逻辑画布尺寸，只让 GPU 以更高采样率画同一个 960×540 表面）
  resolution: (typeof window !== 'undefined' && window.devicePixelRatio) ? Math.min(window.devicePixelRatio, 2) : 1,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // 逻辑画布 1280×720（720p）
    // UI 场景（标题/委托/仓库/装备/结算/片头/片尾）按 1280×720 全画布布局，文字与描边更锐利。
    // 玩法场景（HubScene / MuseumScene）保持内部 960×540 世界尺寸不变，
    // 由各自场景在 create() 中调用 cameras.main.setViewport(160, 90, 960, 540) 居中显示，
    // 上下各留 90px、左右各留 160px 黑边——既保留原有锚点/碰撞/关卡数据，又能享受更高分辨率的 UI 层。
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
    SaveSlotsScene,
    RelicChatScene,
    CuratorMenuScene,
    TrainingScene,
    BossRoomScene
  ]
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
