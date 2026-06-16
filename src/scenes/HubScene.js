// HubScene - 行动前室（博物馆"夜行司·追回总部"）
//
// v2 改造：
//   · 玩家用 LimeZu Adam 16x32 像素序列帧（idle/run 动画）
//   · 中央增加馆长 NPC（Amelia），靠近按 E 触发对话（DialogScene）
//   · 首次进入自动播放馆长开场白
//   · 房间分为五区：委托卷轴区(西北)、配装兵器区(东北)、仓库保险柜区(西南)、任务漆门区(东南)、中央馆长办公区
//   · 装饰物：博古架、卷轴墙画、香炉、屏风、灯笼，用 sprite 摆放营造博物馆质感
//
// 交互：WASD 走动；走近交互台/馆长后按 E 触发；B 图鉴；ESC 回标题

import Phaser from 'phaser';
import SaveData from '../systems/SaveData.js';
import Codex from '../systems/Codex.js';
import Audio from '../systems/AudioFx.js';
import { RELICS } from '../data/relics.js';
import { describeRequirement } from '../data/contracts.js';
import { buildCuratorDialog } from '../data/curatorLines.js';
import { evaluateEnding, hasEndingBeenSeen } from '../systems/Endings.js';

const ROOM_W = 1280;
const ROOM_H = 720;

// 4 个交互台位置
const STATIONS = [
  { id: 'contract', name: '委托板',  x: 180, y: 200, color: 0xd4af37, glyph: '📜', target: 'ContractScene' },
  { id: 'loadout',  name: '配装台',  x: 780, y: 200, color: 0x7ae8e8, glyph: '🛡', target: 'LoadoutScene' },
  { id: 'vault',    name: '保险柜',  x: 180, y: 430, color: 0xc084fc, glyph: '📦', target: 'VaultScene' },
  { id: 'depart',   name: '任务门',  x: 780, y: 430, color: 0xff8c42, glyph: '🏯', target: 'MuseumScene' }
];

// 馆长 NPC 位置（中央办公桌后）
const CURATOR = { x: ROOM_W / 2, y: 320, name: '林默 · 馆长', portraitKey: 'lz_amelia_idle' };

const REFINED_STATIONS = [
  { id: 'contract', name: '委托榜', x: 245, y: 250, interactX: 245, interactY: 350, color: 0xd4af37, glyph: '卷', target: 'ContractScene' },
  { id: 'loadout', name: '配装台', x: 995, y: 250, interactX: 995, interactY: 350, color: 0x7ae8e8, glyph: '盾', target: 'LoadoutScene' },
  { id: 'vault', name: '保险柜', x: 245, y: 505, interactX: 245, interactY: 600, color: 0xc084fc, glyph: '匣', target: 'VaultScene' },
  { id: 'depart', name: '任务门', x: 995, y: 505, interactX: 995, interactY: 640, color: 0xff8c42, glyph: '门', target: 'MuseumScene' }
];

const REFINED_CURATOR = { x: ROOM_W / 2, y: 338, sortY: 302, name: '林默 · 馆长', portraitKey: 'lz_amelia_idle' };

// Centralized hub obstacle config. `hitbox` is the blocked footprint used by
// Arcade Physics. `front` is a tight visual slice copied from hall_back and
// sorted by `sortY`, so actors can pass in front of or behind the object.
const HUB_OBSTACLES = [
  {
    name: 'managerDesk',
    hitbox: { x: 640, y: 294, width: 320, height: 66 },
    sortY: 326,
    front: { x: 488, y: 198, width: 304, height: 124 }
  },
  {
    name: 'contractBoard',
    hitbox: { x: 255, y: 284, width: 270, height: 78 },
    sortY: 326,
    front: { x: 116, y: 122, width: 286, height: 202 }
  },
  {
    name: 'loadoutRack',
    hitbox: { x: 1034, y: 282, width: 284, height: 74 },
    sortY: 326,
    front: { x: 902, y: 112, width: 300, height: 208 }
  },
  {
    name: 'vaultLeftCabinet',
    hitbox: { x: 168, y: 518, width: 78, height: 74 },
    sortY: 566,
    front: { x: 126, y: 418, width: 92, height: 146 }
  },
  {
    name: 'vaultSafe',
    hitbox: { x: 286, y: 524, width: 136, height: 96 },
    sortY: 580,
    front: { x: 214, y: 410, width: 154, height: 166 }
  },
  {
    name: 'vaultRightCabinet',
    hitbox: { x: 390, y: 516, width: 70, height: 74 },
    sortY: 566,
    front: { x: 350, y: 420, width: 76, height: 142 }
  },
  {
    name: 'missionLeftColumn',
    hitbox: { x: 918, y: 552, width: 58, height: 130 },
    sortY: 642,
    front: { x: 888, y: 392, width: 78, height: 246 }
  },
  {
    name: 'missionDoor',
    hitbox: { x: 1038, y: 610, width: 170, height: 62 },
    sortY: 650,
    front: { x: 954, y: 414, width: 182, height: 232 }
  },
  {
    name: 'missionRightColumn',
    hitbox: { x: 1166, y: 552, width: 58, height: 130 },
    sortY: 642,
    front: { x: 1134, y: 392, width: 78, height: 246 }
  },
  {
    name: 'leftWallLamp',
    hitbox: { x: 116, y: 350, width: 42, height: 74 },
    sortY: 404,
    front: { x: 94, y: 286, width: 48, height: 124 }
  },
  {
    name: 'rightWallLamp',
    hitbox: { x: 1164, y: 350, width: 42, height: 74 },
    sortY: 404,
    front: { x: 1140, y: 286, width: 48, height: 124 }
  },
  {
    name: 'leftTopPlant',
    hitbox: { x: 72, y: 188, width: 50, height: 74 },
    sortY: 224,
    front: { x: 42, y: 126, width: 72, height: 104 }
  },
  {
    name: 'rightTopPlant',
    hitbox: { x: 1210, y: 188, width: 50, height: 74 },
    sortY: 224,
    front: { x: 1178, y: 126, width: 72, height: 104 }
  },
  {
    name: 'leftBottomPlant',
    hitbox: { x: 62, y: 318, width: 52, height: 82 },
    sortY: 360,
    front: { x: 28, y: 276, width: 78, height: 98 }
  },
  {
    name: 'rightBottomPlant',
    hitbox: { x: 1216, y: 318, width: 52, height: 82 },
    sortY: 360,
    front: { x: 1180, y: 276, width: 78, height: 98 }
  }
];

export default class HubScene extends Phaser.Scene {
  constructor() {
    super('HubScene');
    this._dialogOpen = false;
  }

  create() {
    Audio.init();
    this._dialogOpen = false;

    // —— 背景 ——
    this.drawFloor();
    this.drawWalls();
    this.drawDecor();

    // 房间标题（卷轴感）
    this.add
      .text(ROOM_W / 2, 28, '夜行司 · 追回总部', {
        fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
        fontSize: '20px',
        color: '#d4af37',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(1600);
    this.add
      .text(ROOM_W / 2, 50, '— 长夜归藏，照见来时 —', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '11px',
        color: '#8c6b1f'
      })
      .setOrigin(0.5)
      .setDepth(1600);

    // —— 顶部资源栏 ——
    this.statBar = this.add
      .text(ROOM_W / 2, 78, '', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '13px',
        color: '#e8d27a',
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(1600);
    this.refreshStatBar();

    // —— 4 个交互台 ——
    this.stationObjs = [];
    for (const st of REFINED_STATIONS) {
      this.stationObjs.push(this.createStation(st));
    }

    // —— 馆长 NPC ——
    this.curator = this.createCurator(REFINED_CURATOR);

    // —— 玩家（hongfa.png，32x32 五行动作表）——
    this.player = this.physics.add.sprite(ROOM_W / 2, ROOM_H / 2 + 145, 'hero_hongfa', 0);
    this.player.setScale(2);
    this.player.setSize(12, 8);         // Arcade body 只取脚底，避免头发/身体误撞家具
    this.player.setOffset(10, 22);
    this.player.setCollideWorldBounds(true);
    this.updateActorDepth(this.player);
    this.physics.world.setBounds(60, 110, ROOM_W - 120, ROOM_H - 170);
    this.createObstacleLayer();
    this.physics.add.collider(this.player, this.hubObstacles);
    this._playerDir = 'down';
    if (this.anims.exists('hero_idle_down')) this.player.play('hero_idle_down');

    // 玩家投影/暖光
    this.playerHalo = this.add
      .image(this.player.x, this.player.y + 18, 'tex_light_warm')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.45)
      .setScale(0.85)
      .setDepth(this.player.depth - 1);

    this.createOcclusionLayer();
    this.createHitboxDebug();

    // —— 当前委托提示 ——
    this.contractTip = this.add
      .text(20, ROOM_H - 50, '', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: '#a08434',
        wordWrap: { width: 360 }
      })
      .setOrigin(0, 0)
      .setDepth(1600);
    this.refreshContractTip();

    // —— 操作提示 ——
    this.add
      .text(ROOM_W - 20, ROOM_H - 50, 'WASD 走动 · E 交互/对话 · B 图鉴 · ESC 回标题', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: '#6b5824'
      })
      .setOrigin(1, 0)
      .setDepth(1600);

    // —— 输入 ——
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,E,B,ESC,H');

    this.keys.E.on('down', () => this.tryInteract());
    this.keys.H.on('down', () => this.toggleHitboxDebug());
    this.keys.B.on('down', () => {
      if (this._dialogOpen) return;
      Audio.sfx.click();
      this.scene.start('CodexScene', { returnTo: 'HubScene' });
    });
    this.keys.ESC.on('down', () => {
      if (this._dialogOpen) return;
      Audio.sfx.click();
      this.scene.start('TitleScene');
    });

    // 提示文（出现在某个交互目标上方）
    this.hintText = this.add
      .text(0, 0, '', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '13px',
        color: '#fff3b8',
        backgroundColor: '#1a1208cc',
        padding: { x: 6, y: 3 }
      })
      .setOrigin(0.5, 1)
      .setDepth(1700)
      .setVisible(false);

    // 进入动画
    this.cameras.main.fadeIn(450, 0, 0, 0);

    // —— 结局判定：若达成且未看过，馆长接裷后自动进入结局 ——
    const endingId = evaluateEnding();
    if (endingId && !hasEndingBeenSeen(endingId)) {
      this.time.delayedCall(900, () => {
        if (this._dialogOpen) return;
        this.cameras.main.fadeOut(700, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('EndingScene', { endingId });
        });
      });
      return;
    }

    // —— 首次进入自动触发馆长对话 ——
    if (!SaveData.getFlag('metCurator', false)) {
      this.time.delayedCall(700, () => this.openCuratorDialog());
    } else if (SaveData.getFlag('lastRunResult', null)) {
      // 上次刚行动归来，馆长会主动问候
      this.time.delayedCall(700, () => this.openCuratorDialog());
    }
  }

  // ——————————————— 绘制：地板 / 墙壁 / 装饰 ———————————————
  drawFloor() {
    // 平铺地板
    for (let y = 0; y < ROOM_H; y += 32) {
      for (let x = 0; x < ROOM_W; x += 32) {
        const key = (x + y) % 64 === 0 ? 'tex_floor_a' : 'tex_floor_b';
        this.add.image(x, y, key).setOrigin(0, 0).setAlpha(0.78).setDepth(0);
      }
    }

    // 中央地毯（馆长办公区）
    const carpet = this.add.rectangle(ROOM_W / 2, 350, 360, 240, 0x4a1e1e, 0.78).setDepth(0.5);
    carpet.setStrokeStyle(2, 0xd4af37, 0.55);
    // 地毯角花
    [[-160, -100], [160, -100], [-160, 100], [160, 100]].forEach(([dx, dy]) => {
      this.add
        .rectangle(ROOM_W / 2 + dx, 350 + dy, 8, 8, 0xd4af37, 0.7)
        .setDepth(0.6);
    });

    // 中央徽印
    this.add
      .text(ROOM_W / 2, 350, '夜', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '52px',
        color: '#d4af37',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setAlpha(0.13)
      .setDepth(0.7);
  }

  drawWalls() {
    // 上下墙
    for (let x = 0; x < ROOM_W; x += 32) {
      this.add.image(x, 88, 'tex_wall_top').setOrigin(0, 0).setDepth(1);
      this.add.image(x, ROOM_H - 56, 'tex_wall').setOrigin(0, 0).setDepth(1);
    }
    // 左右墙
    for (let y = 88; y < ROOM_H - 32; y += 32) {
      this.add.image(0, y, 'tex_wall').setOrigin(0, 0).setDepth(1);
      this.add.image(ROOM_W - 32, y, 'tex_wall').setOrigin(0, 0).setDepth(1);
    }

    // 四角灯笼
    const lanternPos = [
      [60, 130], [ROOM_W - 60, 130], [60, ROOM_H - 90], [ROOM_W - 60, ROOM_H - 90]
    ];
    for (const [lx, ly] of lanternPos) {
      const lan = this.add.image(lx, ly, 'tex_lantern').setDepth(2);
      const halo = this.add
        .image(lx, ly + 4, 'tex_light_warm')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.55)
        .setDepth(1.5);
      this.tweens.add({
        targets: halo,
        alpha: 0.85,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      lan.setScale(1.2);
    }
  }

  drawDecor() {
    // —— 北墙：博物馆牌匾 ——
    const plaqueX = ROOM_W / 2;
    const plaqueY = 110;
    this.add.rectangle(plaqueX, plaqueY, 200, 36, 0x2a1d10, 1).setDepth(2).setStrokeStyle(2, 0xd4af37, 0.8);
    this.add
      .text(plaqueX, plaqueY, '夜  行  司', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '18px',
        color: '#d4af37',
        fontStyle: 'bold',
        letterSpacing: '4px'
      })
      .setOrigin(0.5)
      .setDepth(3);

    // —— 北墙两侧卷轴墙画（只画框示意） ——
    [200, ROOM_W - 200].forEach((x) => {
      this.add.rectangle(x, 122, 80, 60, 0x1f1408, 1).setDepth(2).setStrokeStyle(1, 0x8c6b1f, 0.7);
      this.add
        .text(x, 122, '山\n川', {
          fontFamily: '"PingFang SC", serif',
          fontSize: '14px',
          color: '#a08434',
          align: 'center',
          lineSpacing: -2
        })
        .setOrigin(0.5)
        .setDepth(3);
    });

    // —— 馆长办公桌（中央，玩家会在桌前与馆长对话） ——
    // 桌身
    this.add.rectangle(ROOM_W / 2, 290, 160, 36, 0x3a2814, 1).setDepth(3).setStrokeStyle(1, 0x8c6b1f, 0.9);
    this.add.rectangle(ROOM_W / 2, 274, 160, 6, 0x5a3e22, 1).setDepth(3.1);
    // 桌上卷宗与笔
    this.add.rectangle(ROOM_W / 2 - 50, 286, 30, 18, 0xf0e0a8, 1).setDepth(3.5).setStrokeStyle(1, 0x8c6b1f, 1);
    this.add.rectangle(ROOM_W / 2 + 30, 286, 22, 22, 0xc6913a, 1).setDepth(3.5).setStrokeStyle(1, 0x4a1e1e, 1);
    // 桌上小灯
    this.add.image(ROOM_W / 2 + 60, 282, 'tex_lantern').setScale(0.6).setDepth(3.5);
    this.add
      .image(ROOM_W / 2 + 60, 286, 'tex_light_warm')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.6)
      .setScale(0.6)
      .setDepth(3.4);

    // —— 西北：委托区背景（卷轴架） ——
    this.add.rectangle(180, 150, 140, 56, 0x2a1d10, 0.85).setDepth(1.5).setStrokeStyle(1, 0x8c6b1f, 0.7);
    for (let i = 0; i < 4; i++) {
      this.add.rectangle(140 + i * 28, 150, 18, 38, 0xc0a060, 1).setDepth(2).setStrokeStyle(1, 0x4a3a1a, 1);
    }
    this.add
      .text(180, 178, '— 委托卷宗 —', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '11px',
        color: '#a08434'
      })
      .setOrigin(0.5)
      .setDepth(2);

    // —— 东北：兵器架 ——
    this.add.rectangle(780, 150, 140, 56, 0x2a1d10, 0.85).setDepth(1.5).setStrokeStyle(1, 0x8c6b1f, 0.7);
    // 三件兵器（剑/弓/弩）
    this.add.rectangle(745, 145, 4, 40, 0xc0c8d8, 1).setDepth(2);  // 剑
    this.add.rectangle(745, 124, 8, 6, 0x8c6b1f, 1).setDepth(2.1); // 剑柄
    this.add.rectangle(780, 148, 28, 4, 0x8c6b1f, 1).setDepth(2);   // 弓臂
    this.add.rectangle(780, 148, 4, 32, 0xa67d2f, 1).setDepth(2);
    this.add.rectangle(815, 148, 22, 6, 0x4a3a1a, 1).setDepth(2);   // 弩
    this.add.rectangle(815, 148, 4, 28, 0xa67d2f, 1).setDepth(2);
    this.add
      .text(780, 178, '— 配装 兵器 —', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '11px',
        color: '#a08434'
      })
      .setOrigin(0.5)
      .setDepth(2);

    // —— 西南：保险柜区背景 ——
    this.add.rectangle(180, 470, 140, 50, 0x2a1d10, 0.85).setDepth(1.5).setStrokeStyle(1, 0x8c6b1f, 0.7);
    this.add
      .text(180, 488, '— 归藏 仓房 —', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '11px',
        color: '#a08434'
      })
      .setOrigin(0.5)
      .setDepth(2);

    // —— 东南：漆门区背景 ——
    this.add.rectangle(780, 470, 140, 50, 0x1a0e06, 0.85).setDepth(1.5).setStrokeStyle(1, 0x8c6b1f, 0.7);
    // 门
    this.add.rectangle(780, 458, 60, 70, 0x2a0e06, 1).setDepth(1.6).setStrokeStyle(2, 0xd4af37, 0.85);
    this.add.rectangle(780, 458, 50, 60, 0x000000, 0.5).setDepth(1.7);
    this.add.circle(796, 458, 2, 0xd4af37, 1).setDepth(1.8); // 门环
    this.add
      .text(780, 488, '— 任务出口 —', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '11px',
        color: '#a08434'
      })
      .setOrigin(0.5)
      .setDepth(2);

    // —— 屏风（中央办公桌后方） ——
    this.add.image(ROOM_W / 2, 240, 'tex_screen')
      .setScale(2)
      .setDepth(2)
      .setAlpha(0.95);
  }

  createStation(st) {
    // 矩形交互台（保留旧的机制，但视觉更精致）
    const table = this.add.rectangle(st.x, st.y, 90, 64, 0x3a2814, 0.95).setDepth(2);
    table.setStrokeStyle(2, st.color, 0.9);
    // 台面木纹
    this.add.rectangle(st.x, st.y - 26, 90, 6, 0x5a3e22, 1).setDepth(2.1);

    const glyph = this.add
      .text(st.x, st.y - 6, st.glyph, { fontSize: '26px' })
      .setOrigin(0.5)
      .setDepth(3);
    const label = this.add
      .text(st.x, st.y + 38, st.name, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '13px',
        color: '#e8d27a'
      })
      .setOrigin(0.5)
      .setDepth(3);

    // 围绕的呼吸光圈
    const halo = this.add
      .image(st.x, st.y, 'tex_light_warm')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.32)
      .setTint(st.color)
      .setDepth(1.8);
    this.tweens.add({
      targets: halo,
      alpha: 0.6,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    return { ...st, table, glyph, label, halo };
  }

  createCurator(cur) {
    // Amelia 序列帧（朝下 idle）
    const sprite = this.add.sprite(cur.x, cur.y, 'lz_amelia_idle', 0).setDepth(9);
    sprite.setScale(2.4);
    if (this.anims.exists('amelia_idle_down')) sprite.play('amelia_idle_down');

    // 头顶名牌
    this.add
      .text(cur.x, cur.y - 56, cur.name, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: '#fff3b8',
        backgroundColor: '#1a1208cc',
        padding: { x: 6, y: 2 }
      })
      .setOrigin(0.5)
      .setDepth(10);

    // 暖光光晕
    const halo = this.add
      .image(cur.x, cur.y + 16, 'tex_light_warm')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.5)
      .setScale(1.05)
      .setDepth(8);
    this.tweens.add({
      targets: halo,
      alpha: 0.75,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    return { ...cur, sprite, halo, isCurator: true };
  }

  drawFloor() {
    this.add.rectangle(0, 0, ROOM_W, ROOM_H, 0x080706).setOrigin(0, 0).setDepth(-2);

    const floorTop = 176;
    const floorBottom = ROOM_H - 92;
    const tile = 32;
    for (let y = floorTop; y < floorBottom; y += tile) {
      for (let x = 52; x < ROOM_W - 52; x += tile) {
        const n = ((x * 17 + y * 31) & 3);
        const base = [0x21170f, 0x261a10, 0x1d1510, 0x2a1d12][n];
        this.add.rectangle(x, y, tile, tile, base, 1)
          .setOrigin(0, 0)
          .setDepth(0)
          .setStrokeStyle(1, 0x0d0b0a, 0.75);

        if (((x / tile + y / tile) % 3) === 0) {
          this.add.rectangle(x + 10, y + 10, 12, 12, 0x4a3316, 0.72)
            .setOrigin(0, 0).setDepth(0.03)
            .setStrokeStyle(1, 0x8a6428, 0.55);
          this.add.rectangle(x + 15, y + 15, 2, 2, 0xd4af37, 0.45)
            .setOrigin(0, 0).setDepth(0.04);
        }
        if (((x * 13 + y * 7) % 11) === 0) {
          this.add.rectangle(x + 4, y + 24, 16, 2, 0x0e0c0b, 0.45)
            .setOrigin(0, 0).setDepth(0.04);
        }
      }
    }

    this.add.rectangle(52, floorTop - 8, ROOM_W - 104, 8, 0x111722, 1)
      .setOrigin(0, 0).setDepth(0.15)
      .setStrokeStyle(1, 0x30384a, 0.7);
    this.add.rectangle(52, floorBottom, ROOM_W - 104, 12, 0x111722, 1)
      .setOrigin(0, 0).setDepth(0.15)
      .setStrokeStyle(1, 0x30384a, 0.7);

    this.drawCarpet(ROOM_W / 2, 445, 430, 270);
  }

  drawWalls() {
    this.add.rectangle(0, 0, ROOM_W, 78, 0x080706, 1).setOrigin(0, 0).setDepth(0.2);
    this.add.rectangle(52, 78, ROOM_W - 104, 98, 0x25180f, 1)
      .setOrigin(0, 0).setDepth(0.25)
      .setStrokeStyle(2, 0x0f0d0c, 1);

    for (let y = 84; y < 172; y += 16) {
      for (let x = 64; x < ROOM_W - 64; x += 48) {
        const offset = ((y / 16) % 2) * 24;
        this.add.rectangle(x + offset, y, 36, 12, 0x2f2115, 0.88)
          .setOrigin(0, 0).setDepth(0.27)
          .setStrokeStyle(1, 0x130e0a, 0.8);
      }
    }

    for (let x = 64; x < ROOM_W - 64; x += 72) {
      this.add.rectangle(x, 92, 20, 20, 0x1a1208, 1)
        .setOrigin(0.5).setDepth(0.35)
        .setStrokeStyle(2, 0x7a5520, 0.8);
      this.add.rectangle(x, 92, 6, 6, 0xd4af37, 0.55).setOrigin(0.5).setDepth(0.36);
    }

    for (const x of [36, ROOM_W - 36]) {
      this.add.rectangle(x, 70, 32, ROOM_H - 128, 0x151927, 1)
        .setDepth(0.6)
        .setStrokeStyle(1, 0x30384a, 0.75);
      for (let y = 90; y < ROOM_H - 80; y += 32) {
        this.add.rectangle(x, y, 26, 14, 0x222838, 1)
          .setDepth(0.62)
          .setStrokeStyle(1, 0x090b12, 0.9);
      }
    }

    this.addPixelLamp(92, 150, 1.15, 3);
    this.addPixelLamp(ROOM_W - 92, 150, 1.15, 3);
    this.addPixelLamp(92, ROOM_H - 115, 1.05, 3);
    this.addPixelLamp(ROOM_W - 92, ROOM_H - 115, 1.05, 3);
  }

  drawDecor() {
    this.addPixelPanel(ROOM_W / 2 - 185, 108, 370, 48, 0x160f08, 0xa77a2a, 2.4);
    this.add.text(ROOM_W / 2, 124, '夜 行 司 · 追 回 总 部', {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '22px',
      color: '#d4af37',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(3);
    this.add.text(ROOM_W / 2, 148, '遗夜归藏    慎明来时', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '11px',
      color: '#8c6b1f'
    }).setOrigin(0.5).setDepth(3);

    this.addBanner(250, 125, '委\n托');
    this.addBanner(1030, 125, '配\n装');
    this.addShelf(455, 128, 100, 46);
    this.addShelf(825, 128, 100, 46);

    this.drawNoticeBoard(245, 307);
    this.drawWeaponCabinet(995, 307);
    this.drawVaultCabinet(245, 562);
    this.drawMissionGate(995, 562);
    this.drawCuratorDesk(ROOM_W / 2, 372);

    this.addPixelLamp(578, 364, 0.72, 7);
    this.addPixelLamp(702, 364, 0.72, 7);
    this.addPottedPlant(150, 390);
    this.addPottedPlant(ROOM_W - 150, 390);
  }

  drawCarpet(cx, cy, w, h) {
    this.add.rectangle(cx, cy, w, h, 0x4b1c18, 0.92)
      .setDepth(0.45)
      .setStrokeStyle(3, 0xa77a2a, 0.8);
    this.add.rectangle(cx, cy, w - 28, h - 28, 0x5e2420, 0.85)
      .setDepth(0.47)
      .setStrokeStyle(2, 0x7f5a24, 0.65);
    this.add.rectangle(cx, cy, 180, 120, 0x6c2a23, 0.6)
      .setDepth(0.48)
      .setStrokeStyle(1, 0xa77a2a, 0.45);
    for (const [dx, dy] of [[-185, -112], [185, -112], [-185, 112], [185, 112]]) {
      this.add.rectangle(cx + dx, cy + dy, 10, 10, 0xd4af37, 0.6).setDepth(0.5);
    }
    for (let i = -3; i <= 3; i++) {
      this.add.rectangle(cx + i * 24, cy, 10, 10, 0x8a6428, 0.45)
        .setDepth(0.5)
        .setStrokeStyle(1, 0xd4af37, 0.24);
    }
  }

  addPixelPanel(x, y, w, h, fill, border, depth = 1) {
    const bg = this.add.rectangle(x, y, w, h, fill, 0.96).setOrigin(0, 0).setDepth(depth);
    bg.setStrokeStyle(2, border, 0.88);
    this.add.rectangle(x + 4, y + 4, w - 8, 2, 0xe1b94b, 0.25).setOrigin(0, 0).setDepth(depth + 0.01);
    this.add.rectangle(x + 4, y + h - 6, w - 8, 2, 0x000000, 0.25).setOrigin(0, 0).setDepth(depth + 0.01);
    for (const [cx, cy] of [[x + 7, y + 7], [x + w - 7, y + 7], [x + 7, y + h - 7], [x + w - 7, y + h - 7]]) {
      this.add.rectangle(cx, cy, 4, 4, border, 0.9).setDepth(depth + 0.02);
    }
    return bg;
  }

  addPixelLamp(x, y, scale = 1, depth = 2) {
    const glow = this.add.image(x, y + 8, 'tex_light_warm')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.7)
      .setScale(scale * 1.15)
      .setDepth(depth - 0.2);
    this.tweens.add({ targets: glow, alpha: 0.95, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.rectangle(x, y - 10, 14 * scale, 6 * scale, 0x2a1608, 1).setDepth(depth);
    this.add.rectangle(x, y, 10 * scale, 24 * scale, 0xc82e24, 1).setDepth(depth + 0.1).setStrokeStyle(1, 0xf0c060);
    this.add.rectangle(x, y + 2, 3 * scale, 20 * scale, 0xf6d05a, 0.95).setDepth(depth + 0.2);
    this.add.rectangle(x, y + 17 * scale, 18 * scale, 4 * scale, 0x2a1608, 1).setDepth(depth + 0.1);
    return glow;
  }

  addShelf(x, y, w, h) {
    this.addPixelPanel(x - w / 2, y - h / 2, w, h, 0x1a1008, 0x5f3e18, 1.8);
    for (let i = 0; i < 5; i++) {
      const bx = x - w / 2 + 12 + i * 16;
      const bh = 12 + (i % 3) * 5;
      this.add.rectangle(bx, y + 12 - bh, 9, bh, [0x8a4a28, 0xb68a38, 0x566b4e][i % 3], 1).setDepth(2.1);
    }
  }

  addBanner(x, y, text) {
    this.addPixelPanel(x - 44, y - 40, 88, 74, 0x120d08, 0x6b4b1d, 1.8);
    this.add.text(x, y - 5, text, {
      fontFamily: '"PingFang SC", serif',
      fontSize: '16px',
      color: '#b99235',
      align: 'center',
      lineSpacing: -3
    }).setOrigin(0.5).setDepth(2.1);
  }

  addPottedPlant(x, y) {
    this.add.rectangle(x, y + 24, 26, 20, 0x4a2810, 1).setDepth(2).setStrokeStyle(1, 0x8a6428);
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI + i * Math.PI / 6;
      this.add.rectangle(x + Math.cos(a) * 15, y + Math.sin(a) * 16, 8, 22, 0x2f6f3a, 0.95)
        .setAngle(Phaser.Math.RadToDeg(a) + 90)
        .setDepth(2.1);
    }
  }

  drawNoticeBoard(x, y) {
    this.addPixelPanel(x - 118, y - 52, 236, 104, 0x2b190b, 0x7a5520, 1.4);
    this.add.rectangle(x, y - 38, 200, 8, 0x523013, 1).setDepth(1.6);
    for (let i = 0; i < 7; i++) {
      const px = x - 84 + (i % 4) * 46;
      const py = y - 22 + Math.floor(i / 4) * 38;
      this.add.rectangle(px, py, 28, 34, 0xe6c88f, 1).setDepth(1.7).setStrokeStyle(1, 0x7a5520);
      this.add.rectangle(px, py - 6, 6, 4, 0xc33a2a, 1).setDepth(1.8);
    }
  }

  drawWeaponCabinet(x, y) {
    this.addPixelPanel(x - 118, y - 52, 236, 104, 0x1a1209, 0x7a5520, 1.4);
    this.add.rectangle(x, y + 30, 200, 16, 0x4a2a10, 1).setDepth(1.6).setStrokeStyle(1, 0xa77a2a);
    for (let i = 0; i < 4; i++) {
      const bx = x - 70 + i * 45;
      this.add.rectangle(bx, y - 8, 5, 48, 0xc8d0d8, 1).setDepth(1.8);
      this.add.rectangle(bx, y + 18, 18, 6, 0x8a6428, 1).setDepth(1.9);
    }
    this.add.rectangle(x + 72, y - 4, 30, 38, 0x242a32, 1).setDepth(1.8).setStrokeStyle(1, 0xb0b8c8);
  }

  drawVaultCabinet(x, y) {
    this.addPixelPanel(x - 118, y - 44, 236, 88, 0x20120a, 0x7a5520, 1.4);
    this.add.rectangle(x - 42, y + 4, 78, 62, 0x2a2422, 1).setDepth(1.7).setStrokeStyle(2, 0xc084fc);
    this.add.rectangle(x - 42, y + 4, 38, 28, 0x5f3e18, 1).setDepth(1.8).setStrokeStyle(1, 0xd4af37);
    this.add.rectangle(x + 48, y + 8, 54, 44, 0x4a2a10, 1).setDepth(1.7).setStrokeStyle(1, 0x8a6428);
    this.add.rectangle(x + 48, y + 8, 18, 18, 0xd4af37, 0.75).setDepth(1.8);
  }

  drawMissionGate(x, y) {
    this.addPixelPanel(x - 118, y - 56, 236, 112, 0x1b0c08, 0x7a5520, 1.4);
    this.add.rectangle(x, y + 12, 86, 92, 0x351010, 1).setDepth(1.7).setStrokeStyle(2, 0xd4af37);
    this.add.rectangle(x, y + 12, 56, 78, 0x8a1e2a, 0.92).setDepth(1.8).setStrokeStyle(1, 0xff8c42);
    this.add.rectangle(x, y + 12, 14, 78, 0xff5c57, 0.5).setDepth(1.9);
    this.addPixelLamp(x - 70, y + 32, 0.7, 2.1);
    this.addPixelLamp(x + 70, y + 32, 0.7, 2.1);
  }

  drawCuratorDesk(x, y) {
    this.addPixelPanel(x - 170, y - 28, 340, 76, 0x3a2412, 0x8a6428, 5.3);
    this.add.rectangle(x, y - 42, 360, 18, 0x5a3517, 1).setDepth(5.5).setStrokeStyle(1, 0xd4af37, 0.55);
    this.add.rectangle(x - 82, y - 3, 48, 22, 0xe8d6a8, 1).setDepth(5.7).setStrokeStyle(1, 0x8a6428);
    this.add.rectangle(x + 76, y - 3, 34, 28, 0xc6913a, 1).setDepth(5.7).setStrokeStyle(1, 0x4a1e1e);
    this.add.rectangle(x + 128, y + 4, 28, 18, 0x26333a, 1).setDepth(5.7).setStrokeStyle(1, 0x7ae8e8, 0.5);
  }

  createStation(st) {
    const panelY = st.id === 'vault' || st.id === 'depart' ? st.y - 82 : st.y - 78;
    this.addPixelPanel(st.x - 88, panelY, 176, 48, 0x160f08, st.color, 7);
    const label = this.add.text(st.x, panelY + 15, st.name, {
      fontFamily: '"PingFang SC", serif',
      fontSize: '15px',
      color: '#fff3b8',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(8);
    this.add.text(st.x, panelY + 34, this.stationSubtitle(st.id), {
      fontFamily: '"PingFang SC", serif',
      fontSize: '10px',
      color: '#a08434'
    }).setOrigin(0.5).setDepth(8);

    const table = this.add.rectangle(st.x, st.y, 112, 68, 0x3a2412, 0.96).setDepth(6);
    table.setStrokeStyle(2, st.color, 0.95);
    this.add.rectangle(st.x, st.y - 28, 112, 8, 0x5a3517, 1).setDepth(6.2);
    const glyph = this.add.text(st.x, st.y - 2, st.glyph, {
      fontFamily: '"PingFang SC", serif',
      fontSize: '26px',
      color: '#e8d27a'
    }).setOrigin(0.5).setDepth(8);
    this.drawStationIcon(st);

    const halo = this.add.image(st.x, st.y + 18, 'tex_light_warm')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.32)
      .setTint(st.color)
      .setScale(0.8)
      .setDepth(5.5);
    this.tweens.add({ targets: halo, alpha: 0.58, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    return { ...st, table, glyph, label, halo };
  }

  stationSubtitle(id) {
    return {
      contract: '查看与接取委托',
      loadout: '配置装备与技能',
      vault: '存放守夜藏品',
      depart: '进入夜行动任务'
    }[id] || '';
  }

  drawStationIcon(st) {
    const x = st.x;
    const y = st.y - 2;
    if (st.id === 'contract') {
      this.add.rectangle(x - 18, y - 16, 30, 36, 0xe6c88f, 1).setDepth(7.4).setStrokeStyle(1, 0x8a6428);
      this.add.rectangle(x - 18, y - 8, 18, 2, 0xb45a32, 1).setDepth(7.5);
      this.add.rectangle(x - 18, y, 18, 2, 0xb45a32, 1).setDepth(7.5);
    } else if (st.id === 'loadout') {
      this.add.rectangle(x - 22, y - 16, 5, 36, 0xbec8d2, 1).setDepth(7.4);
      this.add.rectangle(x - 22, y + 6, 20, 5, 0x8a6428, 1).setDepth(7.5);
      this.add.rectangle(x + 20, y - 14, 28, 34, 0x2d333d, 1).setDepth(7.4).setStrokeStyle(1, 0xc8d0d8);
    } else if (st.id === 'vault') {
      this.add.rectangle(x - 22, y - 16, 44, 34, 0x423631, 1).setDepth(7.4).setStrokeStyle(2, 0xc084fc);
      this.add.rectangle(x, y, 14, 14, 0xd4af37, 0.8).setDepth(7.5);
    } else {
      this.add.rectangle(x - 24, y - 20, 48, 46, 0x651d24, 1).setDepth(7.4).setStrokeStyle(2, 0xff8c42);
      this.add.rectangle(x, y + 2, 12, 44, 0xff6b6b, 0.5).setDepth(7.5);
    }
  }

  createCurator(cur) {
    const sprite = this.add.sprite(cur.x, cur.y, 'lz_amelia_idle', 0).setDepth(cur.sortY ?? cur.y);
    sprite.setScale(2.6);
    if (this.anims.exists('amelia_idle_down')) sprite.play('amelia_idle_down');

    this.addPixelPanel(cur.x - 92, cur.y - 96, 184, 38, 0x160f08, 0xd4af37, 10);
    this.add.text(cur.x, cur.y - 84, cur.name, {
      fontFamily: '"PingFang SC", serif',
      fontSize: '13px',
      color: '#fff3b8',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11);
    this.add.text(cur.x, cur.y - 66, '总师负责人', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '10px',
      color: '#a08434'
    }).setOrigin(0.5).setDepth(11);

    const halo = this.add.image(cur.x, cur.y + 18, 'tex_light_warm')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.52)
      .setScale(1.05)
      .setDepth(8);
    this.tweens.add({ targets: halo, alpha: 0.76, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    return { ...cur, sprite, halo, isCurator: true };
  }

  // Final hub renderer: use generated pixel-art layers as the scene art, and keep
  // Phaser objects only for labels, player/NPC, lights, and interaction logic.
  drawFloor() {
    this.add.rectangle(0, 0, ROOM_W, ROOM_H, 0x050403).setOrigin(0, 0).setDepth(-2);
    this.hubBackground = this.add.image(0, 0, 'hub_hall_back')
      .setOrigin(0, 0)
      .setDisplaySize(ROOM_W, ROOM_H)
      .setDepth(0);
  }

  drawWalls() {
    // The generated background already contains walls, floor, furniture, and trim.
  }

  drawDecor() {
    const lanterns = [
      [114, 180, 0.55],
      [1166, 180, 0.55],
      [198, 576, 0.45],
      [1082, 576, 0.45],
      [640, 302, 0.35]
    ];

    for (const [x, y, scale] of lanterns) {
      const glow = this.add.image(x, y, 'tex_light_warm')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.22)
        .setScale(scale)
        .setDepth(1.5);
      this.tweens.add({
        targets: glow,
        alpha: 0.36,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  createObstacleLayer() {
    this.hubObstacles = this.physics.add.staticGroup();
    this.hubObstacleItems = [];

    for (const config of HUB_OBSTACLES) {
      const zone = this.addObstacle(config);
      this.hubObstacleItems.push({ ...config, zone, frontSprites: [] });
    }
  }

  createOcclusionLayer() {
    if (!this.hubObstacleItems) return;

    for (const item of this.hubObstacleItems) {
      const frontRects = Array.isArray(item.front) ? item.front : [item.front].filter(Boolean);
      for (const rect of frontRects) {
        const sprite = this.add.image(rect.x, rect.y, 'hub_hall_back')
          .setOrigin(0, 0)
          .setCrop(rect.x, rect.y, rect.width, rect.height)
          .setDepth(item.sortY);
        item.frontSprites.push(sprite);
      }
    }
  }

  createHitboxDebug() {
    this.hitboxDebugVisible = false;
    this.hitboxDebugLabels = [];
    this.hitboxDebugGraphics = this.add.graphics()
      .setDepth(1800)
      .setVisible(false);
    this.redrawHitboxDebug();
  }

  redrawHitboxDebug() {
    if (!this.hitboxDebugGraphics || !this.hubObstacleItems) return;

    this.hitboxDebugGraphics.clear();
    for (const label of this.hitboxDebugLabels) label.destroy();
    this.hitboxDebugLabels = [];

    for (const item of this.hubObstacleItems) {
      const h = item.hitbox;
      const left = h.x - h.width / 2;
      const top = h.y - h.height / 2;

      this.hitboxDebugGraphics
        .fillStyle(0xff3355, 0.22)
        .fillRect(left, top, h.width, h.height)
        .lineStyle(2, 0xff3355, 0.9)
        .strokeRect(left, top, h.width, h.height);

      this.hitboxDebugGraphics
        .lineStyle(1, 0xffe066, 0.95)
        .lineBetween(left - 8, item.sortY, left + h.width + 8, item.sortY);

      const frontRects = Array.isArray(item.front) ? item.front : [item.front].filter(Boolean);
      for (const rect of frontRects) {
        this.hitboxDebugGraphics
          .lineStyle(1, 0x66ccff, 0.8)
          .strokeRect(rect.x, rect.y, rect.width, rect.height);
      }

      const label = this.add.text(left, top - 14, item.name, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffec99',
        backgroundColor: '#000000aa',
        padding: { x: 3, y: 1 }
      })
        .setDepth(1801)
        .setVisible(this.hitboxDebugVisible);
      this.hitboxDebugLabels.push(label);
    }

    this.hitboxDebugGraphics.setVisible(this.hitboxDebugVisible);
  }

  toggleHitboxDebug() {
    this.hitboxDebugVisible = !this.hitboxDebugVisible;
    if (this.hitboxDebugGraphics) {
      this.hitboxDebugGraphics.setVisible(this.hitboxDebugVisible);
    }
    for (const label of this.hitboxDebugLabels || []) {
      label.setVisible(this.hitboxDebugVisible);
    }
  }

  addObstacle(config) {
    const { x, y, width, height } = config.hitbox;
    const zone = this.add.zone(x, y, width, height).setOrigin(0.5);
    this.physics.add.existing(zone, true);
    zone.body.setSize(width, height, false);
    zone.body.updateFromGameObject();
    this.hubObstacles.add(zone);
    return zone;
  }

  getActorSortY(actor) {
    return actor?.body ? actor.body.bottom : actor.y;
  }

  updateActorDepth(actor) {
    if (!actor) return;
    actor.setDepth(this.getActorSortY(actor));
  }

  createStation(st) {
    const visualX = st.x;
    const visualY = st.y;
    const interactX = st.interactX ?? visualX;
    const interactY = st.interactY ?? visualY;
    const panelY = st.id === 'vault' || st.id === 'depart' ? st.y - 88 : st.y - 86;
    const panelW = st.id === 'loadout' ? 190 : 178;
    const panel = this.add.rectangle(visualX, panelY, panelW, 52, 0x140d07, 0.86)
      .setDepth(1500)
      .setStrokeStyle(2, st.color, 0.9);

    this.add.rectangle(visualX - panelW / 2 + 8, panelY - 18, 4, 4, st.color, 1).setDepth(1501);
    this.add.rectangle(visualX + panelW / 2 - 8, panelY - 18, 4, 4, st.color, 1).setDepth(1501);
    this.add.rectangle(visualX - panelW / 2 + 8, panelY + 18, 4, 4, st.color, 1).setDepth(1501);
    this.add.rectangle(visualX + panelW / 2 - 8, panelY + 18, 4, 4, st.color, 1).setDepth(1501);

    const label = this.add.text(visualX, panelY - 5, st.name, {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '18px',
      color: '#fff0b8',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1502);

    this.add.text(visualX, panelY + 17, this.stationSubtitle(st.id), {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '11px',
      color: '#b9943a'
    }).setOrigin(0.5).setDepth(1502);

    const halo = this.add.image(interactX, interactY, 'tex_light_warm')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.12)
      .setTint(st.color)
      .setScale(0.55)
      .setDepth(2);
    this.tweens.add({
      targets: halo,
      alpha: 0.24,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    return { ...st, x: interactX, y: interactY, visualX, visualY, panel, label, halo };
  }

  stationSubtitle(id) {
    return {
      contract: '查看与接取委托',
      loadout: '配置装备与技能',
      vault: '存放守夜藏品',
      depart: '进入夜行任务'
    }[id] || '';
  }

  createCurator(cur) {
    const sprite = this.add.sprite(cur.x, cur.y, 'lz_amelia_idle', 0).setDepth(cur.sortY ?? cur.y);
    sprite.setScale(2.45);
    if (this.anims.exists('amelia_idle_down')) sprite.play('amelia_idle_down');

    const panelY = cur.y - 88;
    this.add.rectangle(cur.x, panelY, 188, 48, 0x140d07, 0.88)
      .setDepth(1500)
      .setStrokeStyle(2, 0xd4af37, 0.9);
    this.add.text(cur.x, panelY - 5, cur.name, {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '15px',
      color: '#fff0b8',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1502);
    this.add.text(cur.x, panelY + 16, '总部负责人', {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '11px',
      color: '#b9943a'
    }).setOrigin(0.5).setDepth(1502);

    const halo = this.add.image(cur.x, cur.y + 18, 'tex_light_warm')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.28)
      .setScale(0.85)
      .setDepth((cur.sortY ?? cur.y) - 1);
    this.tweens.add({
      targets: halo,
      alpha: 0.46,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    return { ...cur, sprite, halo, isCurator: true };
  }

  refreshStatBar() {
    const gold = SaveData.getGold();
    const rep = SaveData.getRep();
    const codex = Codex.getState();
    const found = Object.keys(codex.relics).length;
    this.statBar.setText(
      `金 ¥${gold}    声望 ${rep}    已归藏 ${found}/${RELICS.length}    追回 ${codex.runs.success}/${codex.runs.total}`
    );
  }

  refreshContractTip() {
    const c = SaveData.getActiveContract();
    if (!c) {
      this.contractTip.setColor('#6b5824');
      this.contractTip.setText('当前无委托。先到【委托板】接一份追回任务。');
      return;
    }
    this.contractTip.setColor('#a08434');
    this.contractTip.setText(
      `委托：「${c.title}」\n委托人：${c.patron.name}（${c.patron.tag}）\n要求：${describeRequirement(c.requirement)}\n奖：¥${c.goldReward} · 声望 ${c.repReward >= 0 ? '+' : ''}${c.repReward}`
    );
  }

  update() {
    if (!this.player || this._dialogOpen) {
      if (this.player) this.player.setVelocity(0, 0);
      return;
    }
    const speed = 170;
    let vx = 0;
    let vy = 0;
    if (this.cursors.left.isDown || this.keys.A.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) vx += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) vy += 1;
    if (vx !== 0 && vy !== 0) {
      const inv = 1 / Math.SQRT2;
      vx *= inv; vy *= inv;
    }
    this.player.setVelocity(vx * speed, vy * speed);
    this.updateActorDepth(this.player);

    // —— 朝向与动画 ——
    const moving = vx !== 0 || vy !== 0;
    let dir = this._playerDir;
    if (moving) {
      if (Math.abs(vx) > Math.abs(vy)) dir = vx > 0 ? 'right' : 'left';
      else dir = vy > 0 ? 'down' : 'up';
    }
    const animDir = dir === 'left' ? 'right' : dir;
    const wantAnim = moving ? `hero_walk_${animDir}` : `hero_idle_${animDir}`;
    if (this.anims.exists(wantAnim) &&
        (!this.player.anims.currentAnim || this.player.anims.currentAnim.key !== wantAnim)) {
      this.player.play(wantAnim);
    }
    this.player.setFlipX(dir === 'left');
    this._playerDir = dir;

    // 玩家光晕跟随
    this.playerHalo
      .setPosition(this.player.x, this.player.y + 20)
      .setDepth(this.player.depth - 1);

    // —— 找最近交互对象（含馆长 NPC） ——
    let nearest = null;
    let bestD = 999999;
    for (const s of this.stationObjs) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, s.x, s.y);
      if (d < bestD) { bestD = d; nearest = s; }
    }
    // 馆长
    const dC = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.curator.x, this.curator.y + 16);
    if (dC < bestD) { bestD = dC; nearest = this.curator; }

    if (nearest && bestD < 78) {
      this._near = nearest;
      const label = nearest.isCurator ? `E  与【${nearest.name}】交谈` : `E  进入【${nearest.name}】`;
      const yOff = nearest.isCurator ? -56 : -50;
      this.hintText
        .setPosition(nearest.x, nearest.y + yOff)
        .setText(label)
        .setVisible(true);
    } else {
      this._near = null;
      this.hintText.setVisible(false);
    }
  }

  tryInteract() {
    if (this._dialogOpen) return;
    if (!this._near) return;
    Audio.sfx.click();

    if (this._near.isCurator) {
      this.openCuratorDialog();
      return;
    }

    const target = this._near.target;
    let sceneData = undefined;
    if (target === 'MuseumScene') {
      const ac = SaveData.getActiveContract();
      if (!ac) {
        this.flashWarn('没有委托，先去委托板接一份。');
        return;
      }
      // 把委托上的 biome 传给关卡场景
      sceneData = { biome: ac.biome || 'museum' };
    }

    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(target, sceneData);
    });
  }

  openCuratorDialog() {
    if (this._dialogOpen) return;
    const dlg = buildCuratorDialog(SaveData);
    if (!dlg || !dlg.pages || !dlg.pages.length) return;
    this._dialogOpen = true;
    this.player.setVelocity(0, 0);
    this.hintText.setVisible(false);

    // 启动对话叠加层
    this.scene.launch('DialogScene', {
      pages: dlg.pages,
      speaker: dlg.speaker || '林默 · 馆长',
      portraitKey: REFINED_CURATOR.portraitKey,
      portraitFrame: 0,
      returnTo: 'HubScene',
      onComplete: () => {
        this._dialogOpen = false;
        this.refreshStatBar();
        this.refreshContractTip();
      }
    });
    this.scene.pause();
  }

  flashWarn(msg) {
    if (this._warnTxt) this._warnTxt.destroy();
    this._warnTxt = this.add
      .text(ROOM_W / 2, ROOM_H - 84, msg, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '14px',
        color: '#ff8c42',
        backgroundColor: '#1a1208cc',
        padding: { x: 8, y: 4 }
      })
      .setOrigin(0.5)
      .setDepth(200);
    this.tweens.add({
      targets: this._warnTxt,
      alpha: 0,
      duration: 1500,
      delay: 800,
      onComplete: () => this._warnTxt && this._warnTxt.destroy()
    });
  }
}
