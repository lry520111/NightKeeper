// HubScene - 行动前室
// 玩家在此操作的"主城"：选委托、配装、查看仓库、出发追回行动
// 顶视像素房间，4 个交互台分布在房间四角，玩家以小人走过去按 E 触发。
//
// 交互台：
//   · 委托板（西北）→ ContractScene
//   · 配装台（东北）→ LoadoutScene
//   · 仓库柜（西南）→ VaultScene
//   · 任务门（东南）→ MuseumScene（必须有 activeContract 才可出发）
// 顶部：金币 / 声望 / 已归藏数 / 追回成功次数
// 左下角：当前接取的委托提示
// 全局：B 键打开图鉴，ESC 回标题

import Phaser from 'phaser';
import SaveData from '../systems/SaveData.js';
import Codex from '../systems/Codex.js';
import Audio from '../systems/AudioFx.js';
import { RELICS } from '../data/relics.js';
import { describeRequirement } from '../data/contracts.js';

// 房间逻辑大小（房间内活动区，单位像素，相机直接锁定整屏）
const ROOM_W = 960;
const ROOM_H = 540;

// 4 个交互台位置
const STATIONS = [
  { id: 'contract', name: '委托板',  x: 200, y: 220, color: 0xd4af37, glyph: '📜', target: 'ContractScene' },
  { id: 'loadout',  name: '配装台',  x: 760, y: 220, color: 0x7ae8e8, glyph: '🛡', target: 'LoadoutScene' },
  { id: 'vault',    name: '保险柜',  x: 200, y: 420, color: 0xc084fc, glyph: '📦', target: 'VaultScene' },
  { id: 'depart',   name: '任务门',  x: 760, y: 420, color: 0xff8c42, glyph: '🏯', target: 'MuseumScene' }
];

export default class HubScene extends Phaser.Scene {
  constructor() {
    super('HubScene');
  }

  create() {
    Audio.init();

    // —— 房间背景 ——
    this.drawFloor();
    this.drawWalls();

    // 房间标题（卷轴感）
    this.add
      .text(ROOM_W / 2, 60, '夜行司·追回总部', {
        fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
        fontSize: '22px',
        color: '#d4af37',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    // —— 顶部资源栏 ——
    this.statBar = this.add
      .text(ROOM_W / 2, 90, '', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '14px',
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

    // —— 玩家（用 tex_player 纹理，与 Raid 一致）——
    this.player = this.physics.add.sprite(ROOM_W / 2, ROOM_H / 2 + 20, 'tex_player');
    this.player.setCollideWorldBounds(true);
    // 房间边界缩进，避免贴墙
    this.physics.world.setBounds(80, 130, ROOM_W - 160, ROOM_H - 200);

    // 玩家投影（暖色光圈）
    this.playerHalo = this.add
      .image(this.player.x, this.player.y + 8, 'tex_light_warm')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.55)
      .setDepth(this.player.depth - 1);

    // —— 当前委托提示 ——
    this.contractTip = this.add
      .text(20, ROOM_H - 56, '', {
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
      .text(ROOM_W - 20, ROOM_H - 56, 'WASD 走动 · E 交互 · B 图鉴 · ESC 回标题', {
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
      Audio.sfx.click();
      this.scene.start('CodexScene', { returnTo: 'HubScene' });
    });
    this.keys.ESC.on('down', () => {
      Audio.sfx.click();
      this.scene.start('TitleScene');
    });

    // 提示文（出现在某个交互台上方）
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
  }

  // —— 地板 ——
  drawFloor() {
    // 平铺地板（深色）
    for (let y = 0; y < ROOM_H; y += 32) {
      for (let x = 0; x < ROOM_W; x += 32) {
        const key = (x + y) % 64 === 0 ? 'tex_floor_a' : 'tex_floor_b';
        this.add.image(x, y, key).setOrigin(0, 0).setAlpha(0.85);
      }
    }
    // 中央地毯
    const carpet = this.add.rectangle(ROOM_W / 2, ROOM_H / 2 + 20, 280, 200, 0x4a1e1e, 0.7);
    carpet.setStrokeStyle(2, 0xd4af37, 0.5);
    // 中央纹饰
    this.add
      .text(ROOM_W / 2, ROOM_H / 2 + 20, '夜', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '64px',
        color: '#d4af37',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setAlpha(0.18);
  }

  drawWalls() {
    // 上下墙
    for (let x = 0; x < ROOM_W; x += 32) {
      this.add.image(x, 100, 'tex_wall_top').setOrigin(0, 0);
      this.add.image(x, ROOM_H - 64, 'tex_wall').setOrigin(0, 0);
    }
    // 左右墙
    for (let y = 100; y < ROOM_H - 32; y += 32) {
      this.add.image(0, y, 'tex_wall').setOrigin(0, 0);
      this.add.image(ROOM_W - 32, y, 'tex_wall').setOrigin(0, 0);
    }
    // 四个角放灯笼当氛围
    const lanternPos = [
      [80, 140], [ROOM_W - 80, 140], [80, ROOM_H - 100], [ROOM_W - 80, ROOM_H - 100]
    ];
    for (const [lx, ly] of lanternPos) {
      const lan = this.add.image(lx, ly, 'tex_lantern');
      const halo = this.add
        .image(lx, ly + 4, 'tex_light_warm')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.5);
      this.tweens.add({
        targets: halo,
        alpha: 0.75,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      lan.setDepth(2);
    }
  }

  createStation(st) {
    // 一个木桌（深棕矩形）+ 一个标志符号 + 名字
    const table = this.add.rectangle(st.x, st.y, 80, 60, 0x3a2814);
    table.setStrokeStyle(2, st.color, 0.8);

    const glyph = this.add
      .text(st.x, st.y - 4, st.glyph, { fontSize: '28px' })
      .setOrigin(0.5);
    const label = this.add
      .text(st.x, st.y + 38, st.name, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '13px',
        color: '#e8d27a'
      })
      .setOrigin(0.5);

    // 围绕的呼吸光圈（用 light_warm，颜色靠 tint 染）
    const halo = this.add
      .image(st.x, st.y, 'tex_light_warm')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.35)
      .setTint(st.color)
      .setDepth(0);
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
    if (!this.player) return;
    const speed = 180;
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

    // 简易朝向翻转
    if (vx < 0) this.player.setFlipX(true);
    else if (vx > 0) this.player.setFlipX(false);

    // 切换走路 / 站立纹理
    const moving = vx !== 0 || vy !== 0;
    const wantTex = moving ? 'tex_player_walk' : 'tex_player';
    if (this.player.texture.key !== wantTex) this.player.setTexture(wantTex);

    // 玩家光晕跟随
    this.playerHalo.setPosition(this.player.x, this.player.y + 8);

    // 高亮最近的交互台
    let nearest = null;
    let bestD = 999999;
    for (const s of this.stationObjs) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, s.x, s.y);
      if (d < bestD) { bestD = d; nearest = s; }
    }
    if (nearest && bestD < 80) {
      this._near = nearest;
      this.hintText
        .setPosition(nearest.x, nearest.y - 50)
        .setText(`E  进入【${nearest.name}】`)
        .setVisible(true);
    } else {
      this._near = null;
      this.hintText.setVisible(false);
    }
  }

  tryInteract() {
    if (!this._near) return;
    Audio.sfx.click();
    const target = this._near.target;

    // 出发要求：必须有 activeContract
    if (target === 'MuseumScene') {
      if (!SaveData.getActiveContract()) {
        this.flashWarn('没有委托，先去委托板接一份。');
        return;
      }
    }

    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(target);
    });
  }

  flashWarn(msg) {
    if (this._warnTxt) this._warnTxt.destroy();
    this._warnTxt = this.add
      .text(ROOM_W / 2, ROOM_H - 90, msg, {
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
