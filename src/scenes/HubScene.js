// HubScene - 行动前室（博物馆"夜行司·追回总部"）
//
// v3 改造：背景图驱动版本
//   · 整个大厅用一张精美的预渲染背景图 (hub_cover.png) 直接铺满 960×540 画布
//   · 不再使用 tilemap 拼接，所有视觉细节都在背景图里
//   · 代码侧只负责：玩家活动 + 隐形碰撞 + 锚点交互检测 + 浮空标签 + HUD
//   · F1 切换调试模式：可视化所有碰撞框和锚点（方便美术坐标微调）
//
// 交互：WASD 走动；走近交互台/馆长后按 E 触发；B 图鉴；ESC 回标题；F1 调试

import Phaser from 'phaser';
import SaveData from '../systems/SaveData.js';
import Codex from '../systems/Codex.js';
import Audio from '../systems/AudioFx.js';
import { RELICS } from '../data/relics.js';
import { describeRequirement } from '../data/contracts.js';
import { buildCuratorDialog } from '../data/curatorLines.js';
import { evaluateEnding, hasEndingBeenSeen } from '../systems/Endings.js';
import {
  ROOM_W,
  ROOM_H,
  HUB_ANCHORS,
  HUB_COLLIDERS,
  HUB_PHYS_BOUNDS,
  HUB_INTERACT_RADIUS,
} from '../data/hubLayout.js';

// 4 个交互台（坐标取自 HUB_ANCHORS，对应背景图上的标签位置）
const STATIONS = [
  { id: 'contract', name: '委托榜', sub: '查看与接取委托', ...HUB_ANCHORS.contract, color: 0xd4af37, target: 'ContractScene' },
  { id: 'loadout',  name: '配装台', sub: '配置装备与技能', ...HUB_ANCHORS.loadout,  color: 0x7ae8e8, target: 'LoadoutScene' },
  { id: 'vault',    name: '保险柜', sub: '存放守夜藏品',   ...HUB_ANCHORS.vault,    color: 0xc084fc, target: 'VaultScene' },
  { id: 'depart',   name: '任务门', sub: '进入夜行任务',   ...HUB_ANCHORS.depart,   color: 0xff8c42, target: 'MuseumScene' },
];

// 馆长 NPC
const CURATOR = { ...HUB_ANCHORS.curator, name: '林默 · 馆长', sub: '总部负责人', portraitKey: 'lz_adam_idle', portraitFrame: 18, portraitTint: 0xc8a26a };

export default class HubScene extends Phaser.Scene {
  constructor() {
    super('HubScene');
    this._dialogOpen = false;
    this._debugMode = false;
  }

  create() {
    Audio.init();
    this._dialogOpen = false;

    // —— 1. 背景大图（一张图覆盖整个 1280×720 画布，所有视觉细节都在里面）——
    const bg = this.add.image(ROOM_W / 2, ROOM_H / 2, 'hub_cover');
    bg.setDisplaySize(ROOM_W, ROOM_H);
    bg.setDepth(-10);

    // —— 2. 顶部资源栏（叠在背景上方，半透明黑底防止文字糊在背景里）——
    const topBar = this.add.rectangle(ROOM_W / 2, 18, ROOM_W, 36, 0x000000, 0.55).setDepth(40);
    topBar.setStrokeStyle(1, 0xd4af37, 0.4);
    this.statBar = this.add
      .text(ROOM_W / 2, 18, '', {
        fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
        fontSize: '13px',
        color: '#e8d27a',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(41);
    this.refreshStatBar();

    // —— 3. 隐形碰撞墙（玩家无法穿过的家具/墙体，与背景图视觉对齐）——
    this.colliderGroup = this.physics.add.staticGroup();
    for (const c of HUB_COLLIDERS) {
      const rect = this.add.rectangle(c.x + c.w / 2, c.y + c.h / 2, c.w, c.h, 0xff0000, 0);
      this.physics.add.existing(rect, true); // static body
      rect.body.updateFromGameObject();
      rect._dbgTag = c.tag;
      this.colliderGroup.add(rect);
    }

    // —— 4. 4 个交互台浮空标签（指示当前可交互区域，背景图已有静态标签，这里只加"光晕指示器"）——
    this.stationObjs = [];
    for (const st of STATIONS) {
      this.stationObjs.push(this.createStationIndicator(st));
    }

    // —— 5. 馆长 NPC ——
    this.curator = this.createCurator(CURATOR);

    // —— 6. 玩家（高清精灵表 93×137，scale 0.75 → 视觉约 70×103）——
    this.player = this.physics.add.sprite(HUB_ANCHORS.player.x, HUB_ANCHORS.player.y, 'lz_adam_idle', 18);
    this.player.setScale(1.6);
    this.player.body.setSize(10, 12).setOffset(3, 18);
    this.player.setDepth(10);

    // 物理边界
    this.physics.world.setBounds(
      HUB_PHYS_BOUNDS.x, HUB_PHYS_BOUNDS.y,
      HUB_PHYS_BOUNDS.w, HUB_PHYS_BOUNDS.h
    );
    this.player.setCollideWorldBounds(true);

    // 与碰撞墙做物理碰撞
    this.physics.add.collider(this.player, this.colliderGroup);

    this._playerDir = 'down';
    if (this.anims.exists('adam_idle_down')) this.player.play('adam_idle_down');

    // 玩家暖光投影（脚下圆形光晕）
    this.playerHalo = this.add
      .image(this.player.x, this.player.y + 18, 'tex_light_warm')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.45)
      .setScale(0.85)
      .setDepth(this.player.depth - 1);

    // —— 7. 当前委托提示（左下角小字）——
    const tipBg = this.add.rectangle(15, ROOM_H - 60, 380, 56, 0x000000, 0.65)
      .setOrigin(0, 0)
      .setDepth(49);
    tipBg.setStrokeStyle(1, 0xa08434, 0.5);
    this.contractTip = this.add
      .text(25, ROOM_H - 52, '', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: '#e8d27a',
        wordWrap: { width: 360 },
      })
      .setOrigin(0, 0)
      .setDepth(50);
    this.refreshContractTip();

    // —— 8. 操作提示（右下角）——
    const hintBg = this.add.rectangle(ROOM_W - 15, ROOM_H - 30, 460, 26, 0x000000, 0.55)
      .setOrigin(1, 0.5)
      .setDepth(49);
    hintBg.setStrokeStyle(1, 0x6b5824, 0.5);
    this.add
      .text(ROOM_W - 25, ROOM_H - 30, 'WASD 走动 · E 交互/对话 · B 图鉴 · ESC 回标题 · F1 调试', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '11px',
        color: '#cdb98a',
      })
      .setOrigin(1, 0.5)
      .setDepth(50);

    // —— 9. 输入 ——
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,E,B,ESC,F1');

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
    this.keys.F1.on('down', () => this.toggleDebug());

    // —— 10. 交互浮空提示（"E  与XXX交谈"）——
    this.hintText = this.add
      .text(0, 0, '', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '13px',
        color: '#fff3b8',
        backgroundColor: '#1a1208ee',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 1)
      .setDepth(100)
      .setVisible(false);

    // —— 11. 调试图层（默认隐藏）——
    this.debugGraphics = this.add.graphics().setDepth(200).setVisible(false);
    this.debugLabels = this.add.container(0, 0).setDepth(201).setVisible(false);
    this._buildDebugOverlay();

    // 鼠标点击调试坐标（仅调试模式下打印）
    this.input.on('pointerdown', (pointer) => {
      if (this._debugMode) {
        const x = Math.round(pointer.worldX);
        const y = Math.round(pointer.worldY);
        // eslint-disable-next-line no-console
        console.log(`[HUB DEBUG] click @ x:${x}, y:${y}`);
      }
    });

    // 进入动画
    this.cameras.main.fadeIn(450, 0, 0, 0);

    // —— 结局判定 ——
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

    // —— 首次进入或刚行动归来 → 自动触发馆长对话 ——
    if (!SaveData.getFlag('metCurator', false)) {
      this.time.delayedCall(700, () => this.openCuratorDialog());
    } else if (SaveData.getFlag('lastRunResult', null)) {
      this.time.delayedCall(700, () => this.openCuratorDialog());
    }
  }

  // ——————————— 交互台光晕指示器（背景图已有静态标签，这里只加 hover 光晕）———————————
  createStationIndicator(st) {
    // 区域光晕（脉动暖光，引导玩家注意）
    const halo = this.add
      .image(st.x, st.y, 'tex_light_warm')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.25)
      .setScale(1.0)
      .setTint(st.color)
      .setDepth(5);
    this.tweens.add({
      targets: halo,
      alpha: 0.5,
      scale: 1.2,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    return { ...st, halo };
  }

  // ——————————— 馆长 NPC ———————————
  createCurator(cur) {
    // 复用主角精灵表（LimeZu 16×32，down 起始帧 = 18）
    // 通过暖金色 tint 与主角及守卫做视觉区分（资深 / 西装感）
    const sprite = this.physics.add.sprite(cur.x, cur.y, 'lz_adam_idle', 18);
    sprite.setScale(1.6);
    sprite.setDepth(9);
    sprite.body.setSize(10, 12).setOffset(3, 18);
    sprite.body.setImmovable(true);
    sprite.body.moves = false;
    sprite.setTint(0xc8a26a); // 暖金棕：长者气质，与主角的冷白和守卫绿军装区分
    if (this.anims.exists('adam_idle_down')) sprite.play('adam_idle_down');

    // 玩家不能穿过馆长
    this.physics.add.collider(this.player ?? sprite, sprite);

    // 暖光光晕
    const halo = this.add
      .image(cur.x, cur.y + 16, 'tex_light_warm')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.45)
      .setScale(0.95)
      .setDepth(8);
    this.tweens.add({
      targets: halo,
      alpha: 0.7,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
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
      this.contractTip.setColor('#a08434');
      this.contractTip.setText('当前无委托。先到【委托榜】接一份追回任务。');
      return;
    }
    this.contractTip.setColor('#e8d27a');
    this.contractTip.setText(
      `委托：「${c.title}」\n委托人：${c.patron.name}（${c.patron.tag}）\n要求：${describeRequirement(c.requirement)}\n奖：¥${c.goldReward} · 声望 ${c.repReward >= 0 ? '+' : ''}${c.repReward}`
    );
  }

  // ——————————— 调试模式：可视化碰撞框和锚点 ———————————
  _buildDebugOverlay() {
    const g = this.debugGraphics;
    g.clear();
    // 碰撞矩形：红色半透明
    g.lineStyle(2, 0xff3344, 0.9);
    g.fillStyle(0xff3344, 0.18);
    for (const c of HUB_COLLIDERS) {
      g.fillRect(c.x, c.y, c.w, c.h);
      g.strokeRect(c.x, c.y, c.w, c.h);
      const t = this.add.text(c.x + 4, c.y + 4, c.tag, {
        fontFamily: 'monospace', fontSize: '10px', color: '#ff8888',
      });
      this.debugLabels.add(t);
    }
    // 物理边界：黄色虚线
    g.lineStyle(2, 0xffff00, 0.8);
    g.strokeRect(HUB_PHYS_BOUNDS.x, HUB_PHYS_BOUNDS.y, HUB_PHYS_BOUNDS.w, HUB_PHYS_BOUNDS.h);
    // 锚点：绿色十字 + 名称
    Object.entries(HUB_ANCHORS).forEach(([key, a]) => {
      g.lineStyle(2, 0x00ff66, 1);
      g.strokeCircle(a.x, a.y, HUB_INTERACT_RADIUS);
      g.lineBetween(a.x - 8, a.y, a.x + 8, a.y);
      g.lineBetween(a.x, a.y - 8, a.x, a.y + 8);
      const t = this.add.text(a.x + 6, a.y - 16, `${key} (${a.x},${a.y})`, {
        fontFamily: 'monospace', fontSize: '11px', color: '#66ff99',
        backgroundColor: '#000000aa', padding: { x: 3, y: 1 },
      });
      this.debugLabels.add(t);
    });
  }

  toggleDebug() {
    this._debugMode = !this._debugMode;
    this.debugGraphics.setVisible(this._debugMode);
    this.debugLabels.setVisible(this._debugMode);
    Audio.sfx.click();
  }

  // ——————————— 主循环 ———————————
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
      vx *= inv;
      vy *= inv;
    }
    this.player.setVelocity(vx * speed, vy * speed);

    // 朝向与动画
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

    // 寻找最近交互对象
    let nearest = null;
    let bestD = 999999;
    for (const s of this.stationObjs) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, s.x, s.y);
      if (d < bestD) { bestD = d; nearest = s; }
    }
    const dC = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.curator.x, this.curator.y + 16);
    if (dC < bestD) { bestD = dC; nearest = this.curator; }

    if (nearest && bestD < HUB_INTERACT_RADIUS) {
      this._near = nearest;
      const label = nearest.isCurator ? `E  与【${nearest.name}】交谈` : `E  进入【${nearest.name}】`;
      const yOff = nearest.isCurator ? -78 : -40;
      this.hintText
        .setPosition(nearest.x, nearest.y + yOff)
        .setText(label)
        .setVisible(true);
    } else {
      this._near = null;
      this.hintText.setVisible(false);
    }
  }

  // ——————————— 交互触发 ———————————
  tryInteract() {
    if (this._dialogOpen) return;
    if (!this._near) return;
    Audio.sfx.click();

    if (this._near.isCurator) {
      this.openCuratorDialog();
      return;
    }

    const target = this._near.target;
    let sceneData;
    if (target === 'MuseumScene') {
      const ac = SaveData.getActiveContract();
      if (!ac) {
        this.flashWarn('没有委托，先去委托板接一份。');
        return;
      }
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

    this.scene.launch('DialogScene', {
      pages: dlg.pages,
      speaker: dlg.speaker || '林默 · 馆长',
      portraitKey: CURATOR.portraitKey,
      portraitFrame: CURATOR.portraitFrame || 0,
      portraitTint: CURATOR.portraitTint || null,
      returnTo: 'HubScene',
      onComplete: () => {
        this._dialogOpen = false;
        this.refreshStatBar();
        this.refreshContractTip();
      },
    });
    this.scene.pause();
  }

  flashWarn(msg) {
    if (this._warnTxt) this._warnTxt.destroy();
    this._warnTxt = this.add
      .text(ROOM_W / 2, ROOM_H - 100, msg, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '14px',
        color: '#ff8c42',
        backgroundColor: '#1a1208ee',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(200);
    this.tweens.add({
      targets: this._warnTxt,
      alpha: 0,
      duration: 1500,
      delay: 800,
      onComplete: () => this._warnTxt && this._warnTxt.destroy(),
    });
  }
}
