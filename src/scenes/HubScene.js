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

const ROOM_W = 960;
const ROOM_H = 540;

// 4 个交互台位置
const STATIONS = [
  { id: 'contract', name: '委托板',  x: 180, y: 200, color: 0xd4af37, glyph: '📜', target: 'ContractScene' },
  { id: 'loadout',  name: '配装台',  x: 780, y: 200, color: 0x7ae8e8, glyph: '🛡', target: 'LoadoutScene' },
  { id: 'vault',    name: '保险柜',  x: 180, y: 430, color: 0xc084fc, glyph: '📦', target: 'VaultScene' },
  { id: 'depart',   name: '任务门',  x: 780, y: 430, color: 0xff8c42, glyph: '🏯', target: 'MuseumScene' }
];

// 馆长 NPC 位置（中央办公桌后）
const CURATOR = { x: ROOM_W / 2, y: 320, name: '林默 · 馆长', portraitKey: 'lz_amelia_idle' };

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
      .setOrigin(0.5);
    this.add
      .text(ROOM_W / 2, 50, '— 长夜归藏，照见来时 —', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '11px',
        color: '#8c6b1f'
      })
      .setOrigin(0.5);

    // —— 顶部资源栏 ——
    this.statBar = this.add
      .text(ROOM_W / 2, 78, '', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '13px',
        color: '#e8d27a',
        align: 'center'
      })
      .setOrigin(0.5);
    this.refreshStatBar();

    // —— 4 个交互台 ——
    this.stationObjs = [];
    for (const st of STATIONS) {
      this.stationObjs.push(this.createStation(st));
    }

    // —— 馆长 NPC ——
    this.curator = this.createCurator(CURATOR);

    // —— 玩家（用 LimeZu Adam，16x32）——
    this.player = this.physics.add.sprite(ROOM_W / 2, ROOM_H / 2 + 80, 'lz_adam_idle', 0);
    this.player.setScale(2.4);          // 16x32 → 约 38x76 像素，舒适
    this.player.setSize(12, 16);        // 物理盒只取脚部
    this.player.setOffset(2, 16);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    this.physics.world.setBounds(60, 110, ROOM_W - 120, ROOM_H - 170);
    this._playerDir = 'down';
    if (this.anims.exists('adam_idle_down')) this.player.play('adam_idle_down');

    // 玩家投影/暖光
    this.playerHalo = this.add
      .image(this.player.x, this.player.y + 18, 'tex_light_warm')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.45)
      .setScale(0.85)
      .setDepth(this.player.depth - 1);

    // —— 当前委托提示 ——
    this.contractTip = this.add
      .text(20, ROOM_H - 50, '', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: '#a08434',
        wordWrap: { width: 360 }
      })
      .setOrigin(0, 0)
      .setDepth(50);
    this.refreshContractTip();

    // —— 操作提示 ——
    this.add
      .text(ROOM_W - 20, ROOM_H - 50, 'WASD 走动 · E 交互/对话 · B 图鉴 · ESC 回标题', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: '#6b5824'
      })
      .setOrigin(1, 0)
      .setDepth(50);

    // —— 输入 ——
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,E,B,ESC');

    this.keys.E.on('down', () => this.tryInteract());
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
      .setDepth(100)
      .setVisible(false);

    // 进入动画
    this.cameras.main.fadeIn(450, 0, 0, 0);

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

    // —— 朝向与动画 ——
    const moving = vx !== 0 || vy !== 0;
    let dir = this._playerDir;
    if (moving) {
      if (Math.abs(vx) > Math.abs(vy)) dir = vx > 0 ? 'right' : 'left';
      else dir = vy > 0 ? 'down' : 'up';
    }
    const wantAnim = moving ? `adam_run_${dir}` : `adam_idle_${dir}`;
    if (this.anims.exists(wantAnim) &&
        (!this.player.anims.currentAnim || this.player.anims.currentAnim.key !== wantAnim)) {
      this.player.play(wantAnim);
    }
    this._playerDir = dir;

    // 玩家光晕跟随
    this.playerHalo.setPosition(this.player.x, this.player.y + 20);

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
      portraitKey: CURATOR.portraitKey,
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
