// BossRoomScene.js — 最终关卡：与 Boss 单挑，击败后撤离
// 由 MuseumScene（黑市左上角入口）跳转进入；data 携带 inventory/playerHP 等运行态
import Phaser from 'phaser';
import Audio from '../systems/AudioFx.js';
import Boss from '../systems/Boss.js';

const W = 1280;
const H = 720;
const PLAYER_SPEED = 190;
const PLAYER_MAX_HP = 10;
const ATTACK_RANGE = 92;
const ATTACK_ARC = Math.PI * 0.58;
const ATTACK_COOLDOWN = 260;
const ATTACK_DAMAGE = 1;
const SKILL_DAMAGE = 2;

// Blade skill / skill2 渲染常量（与 TrainingScene 同步，避免抖动）
const BLADE_SKILL_FW = 772;
const BLADE_SKILL_FH = 230;
const BLADE_SKILL_LEFT_ANCHOR_X = 648;
const BLADE_SKILL_ORIGIN_Y = 0.98;
const BLADE_SKILL_COOLDOWN = 1450;
const BLADE_SKILL_DURATION = 2180;
const BLADE_SKILL_FRAME_RECTS = [
  { x: 617, y: 135, w: 134, h: 90, ax: 648 },
  { x: 560, y: 105, w: 207, h: 120, ax: 613 },
  { x: 531, y: 93, w: 214, h: 137, ax: 614 },
  { x: 461, y: 52, w: 276, h: 178, ax: 594 },
  { x: 172, y: 59, w: 584, h: 171, ax: 522 },
  { x: 199, y: 78, w: 554, h: 152, ax: 308 },
  { x: 180, y: 49, w: 487, h: 181, ax: 288 },
  { x: 25, y: 45, w: 657, h: 179, ax: 206 },
  { x: 7, y: 2, w: 693, h: 220, ax: 161 },
  { x: 20, y: 41, w: 506, h: 181, ax: 176 },
  { x: 60, y: 75, w: 403, h: 127, ax: 184 },
];
const BLADE_SKILL_HIT_RECTS = [
  null,
  { x: 558, y: 103, w: 180, h: 92 },
  { x: 532, y: 90, w: 198, h: 103 },
  { x: 490, y: 70, w: 238, h: 126 },
  { x: 220, y: 78, w: 410, h: 132 },
  { x: 110, y: 86, w: 535, h: 122 },
  { x: 96, y: 72, w: 520, h: 132 },
  { x: 24, y: 72, w: 510, h: 135 },
  { x: 36, y: 82, w: 348, h: 128 },
  { x: 42, y: 96, w: 292, h: 104 },
  { x: 70, y: 105, w: 210, h: 92 },
];
const BLADE_SKILL_FRAME_Y_OFFSETS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 10];
const BLADE_SKILL_FRAME_X_OFFSETS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 14];

const SKILL2_FW = 821;
const SKILL2_FH = 320;
const SKILL2_ANCHOR_X = 495;
const SKILL2_SCALE = 0.66;
const SKILL2_FINAL_OFFSET_X = -105;
const SKILL2_COOLDOWN = 2400;
const SKILL2_DURATION = 3150;
const SKILL2_FRAME_X_OFFSETS = Array(22).fill(0);
const SKILL2_FRAME_Y_OFFSETS = [0, 0, 9, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const SKILL2_HIT_RECTS = [
  null, null, null, null,
  { x: 250, y: 145, w: 360, h: 175 },
  null, null, null,
  { x: 235, y: 100, w: 260, h: 215 },
  null, null, null,
  { x: 230, y: 70, w: 390, h: 250 },
  null, null, null,
  { x: 250, y: 45, w: 385, h: 270 },
  null, null,
  { x: 230, y: 45, w: 420, h: 275 },
  null, null, null,
];

const dirToAngle = (d) => {
  if (d === 'left') return Math.PI;
  if (d === 'up') return -Math.PI / 2;
  if (d === 'down') return Math.PI / 2;
  return 0;
};

export default class BossRoomScene extends Phaser.Scene {
  constructor() {
    super('BossRoomScene');
  }

  init(data) {
    this._returnPayload = data || {};
  }

  create() {
    this.cameras.main.setViewport(0, 0, W, H);
    this.cameras.main.fadeIn(420, 0, 0, 0);

    Audio.init();
    if (Audio.bgm && Audio.bgm.stop) Audio.bgm.stop(400);
    // 沿用黑市/博物馆 BGM 中较紧张的一种
    const bgmKey = (this._returnPayload.biome === 'blackmarket') ? 'bgm_blackmarket' : 'bgm_museum';
    if (Audio.bgm && Audio.bgm.play) Audio.bgm.play(bgmKey, { loop: true, fade: 600, volume: 0.45 });

    // —— 1. 背景：boss_room 等比铺满 1280×720 ——
    if (this.textures.exists('boss_room_bg')) {
      const bg = this.add.image(W / 2, H / 2, 'boss_room_bg').setDepth(-50);
      // 按"包含"等比例缩放至填满画面
      const tex = this.textures.get('boss_room_bg').getSourceImage();
      const sx = W / tex.width;
      const sy = H / tex.height;
      const s = Math.max(sx, sy);
      bg.setScale(s);
    } else {
      this.add.rectangle(W / 2, H / 2, W, H, 0x14080a).setDepth(-50);
    }

    // —— 2. 边缘碰撞箱：内部可活动区 (PADDING~W-PADDING) × (PADDING~H-PADDING) ——
    const PAD = 60;
    this.physics.world.setBounds(PAD, PAD, W - PAD * 2, H - PAD * 2);
    this.walls = this.physics.add.staticGroup();
    const wallThick = 32;
    // 上
    this._addWall(W / 2, PAD - wallThick / 2, W, wallThick);
    // 下
    this._addWall(W / 2, H - PAD + wallThick / 2, W, wallThick);
    // 左
    this._addWall(PAD - wallThick / 2, H / 2, wallThick, H);
    // 右
    this._addWall(W - PAD + wallThick / 2, H / 2, wallThick, H);

    // —— 3. 玩家（C键切换：持刀 / 弓 / 原始）——
    this._charConfigs = {};
    this._charTypes = [];
    if (this.textures.exists('hero_knife')) {
      this._charTypes.push('knife');
      this._charConfigs.knife = { tex:'hero_knife', scale:0.265, bodyW:86, bodyH:44, bodyOx:85, bodyOy:208, prefix:'hero_knife', directional:true };
    }
    if (this.textures.exists('hero_hongfa')) {
      this._charTypes.push('hongfa');
      this._charConfigs.hongfa = { tex:'hero_hongfa', scale:1.05, bodyW:22, bodyH:12, bodyOx:21, bodyOy:48, prefix:'hero', directional:false };
    }
    if (this.textures.exists('hero_bow_walk_down_1')) {
      this._charTypes.push('bow');
      this._charConfigs.bow = { tex:'hero_bow_walk_down_1', scale:0.28, bodyW:36, bodyH:22, bodyOx:55, bodyOy:193, prefix:'hero_bow', directional:true };
    }
    this._charIndex = 0;
    const spawnX = W / 2;
    const spawnY = H - PAD - 70;
    this.player = this.physics.add.sprite(spawnX, spawnY, 'hero_knife', 0);
    this._applyCharConfig(0);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(this.player.y);
    this.physics.add.collider(this.player, this.walls);
    this._playerDir = 'up';
    this._lastFacingX = 1;
    this.playerHP = PLAYER_MAX_HP;
    this.playerMaxHP = PLAYER_MAX_HP;
    this._playerInvulnUntil = 0;

    // 鼠标瞄准追踪
    this._mouseWorldX = W / 2;
    this._mouseWorldY = H / 2;
    this.input.on('pointermove', (pointer) => {
      const cam = this.cameras.main;
      this._mouseWorldX = pointer.x + cam.scrollX;
      this._mouseWorldY = pointer.y + cam.scrollY;
    });
    this.input.on('pointerdown', (pointer) => {
      if (pointer.leftButtonDown()) {
        this.tryAttack(this.time.now);
      }
    });
    this._projectiles = [];

    // —— 4. Boss ——
    this.boss = new Boss(this, W / 2, PAD + 220);
    this.physics.add.collider(this.boss.sprite, this.walls);

    // —— 5. 撤离出口（击败 boss 后才出现，位于地图顶部中央）——
    this._exitReady = false;
    this.exitZone = null;

    // —— 6. 输入 ——
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,J,U,Y,E,C,M,SPACE,ESC,G');

    // —— 7. HUD ——
    this._buildHUD();

    // —— 8. 攻击/技能状态 ——
    this._cooldownUntil = 0;
    this._attackUntil = 0;
    this._skillUntil = 0;
    this._skillCooldownUntil = 0;
    this._skill2Until = 0;
    this._skill2CooldownUntil = 0;
    this._skill2HitFrames = new Set();
    this._bossArmorTextUntil = 0;

    this._lastTime = 0;

    // 入场提示
    this._toast('影 鸦 现 身  —  击 败 它 才 能 撤 离');
  }

  _addWall(cx, cy, w, h) {
    const r = this.add.rectangle(cx, cy, w, h, 0x000000, 0);
    this.physics.add.existing(r, true);
    r.body.updateFromGameObject();
    this.walls.add(r);
    return r;
  }

  _buildHUD() {
    this.hud = this.add.text(W / 2, H - 28, 'WASD 移动   J/Space 普攻   U/Y 技能   G 无敌   C 角色   M 设置   E 撤离（击败 Boss 后）', {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '14px',
      color: '#ffe9a6',
      backgroundColor: '#120b05cc',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setDepth(2000).setScrollFactor(0);

    if (this.textures.exists('ui_hero_hp')) {
      this._heroHpMaxWidth = 178;
      this.heroHpFrame = this.add.image(16, 18, 'ui_hero_hp')
        .setOrigin(0, 0)
        .setDisplaySize(306, 106)
        .setDepth(2000)
        .setScrollFactor(0);
      this.hpBg = this.add.rectangle(118, 57, this._heroHpMaxWidth, 15, 0x130606, 0.9)
        .setOrigin(0, 0.5)
        .setDepth(2001)
        .setScrollFactor(0);
      this.hpBar = this.add.rectangle(118, 57, this._heroHpMaxWidth, 15, 0xc84132, 0.96)
        .setOrigin(0, 0.5)
        .setDepth(2002)
        .setScrollFactor(0);
      this.hpText = this.add.text(207, 57, `${this.playerHP} / ${this.playerMaxHP}`, {
        fontFamily: '"Consolas", monospace',
        fontSize: '12px',
        color: '#fff4d0',
        stroke: '#210604',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(2003).setScrollFactor(0);
    } else {
      this._heroHpMaxWidth = 216;
      this.hpBg = this.add.rectangle(18, 44, 220, 14, 0x000000, 0.8).setOrigin(0, 0).setDepth(2000).setStrokeStyle(1, 0x80c8ff, 0.6);
      this.hpBar = this.add.rectangle(20, 46, this._heroHpMaxWidth, 10, 0x6bcf6b).setOrigin(0, 0).setDepth(2001);
      this.hpText = this.add.text(130, 51, `${this.playerHP} / ${this.playerMaxHP}`, {
      fontFamily: '"Consolas", monospace',
      fontSize: '12px',
      color: '#ffffff',
      }).setOrigin(0.5).setDepth(2002);
    }
  }

  _updateHUD() {
    if (!this.hpBar) return;
    const maxW = this._heroHpMaxWidth || 216;
    this.hpBar.width = maxW * Math.max(0, this.playerHP / this.playerMaxHP);
    this.hpBar.fillColor = this.playerHP > this.playerMaxHP * 0.5 ? 0xd94b3d
      : this.playerHP > this.playerMaxHP * 0.25 ? 0xf2a642 : 0x8f1f2a;
    this.hpText.setText(`${this.playerHP} / ${this.playerMaxHP}`);
  }

  _toast(msg, duration = 2200) {
    const t = this.add.text(W / 2, 84, msg, {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '20px',
      color: '#ffd0d4',
      stroke: '#240608',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(2500);
    this.tweens.add({
      targets: t, alpha: 0, y: 70,
      duration, delay: 200,
      onComplete: () => t.destroy(),
    });
  }

  // ===========================================================
  // update
  // ===========================================================
  update(time) {
    if (this._settingsOpen) { this._updateSettings(); return; }
    if (!this.player || !this.player.body) return;
    if (this._ended) return;
    const now = time;
    const dtSec = this._lastTime ? Math.min(0.05, (now - this._lastTime) / 1000) : 0.016;
    this._lastTime = now;

    // —— 处理飞行弹射物（弓箭等） ——
    if (this._projectiles && this._projectiles.length > 0) {
      for (let i = this._projectiles.length - 1; i >= 0; i--) {
        const p = this._projectiles[i];
        p.g.x += p.vx * dtSec;
        p.g.y += p.vy * dtSec;
        p.life -= dtSec * 1000;
        if (p.skipFrames > 0) { p.skipFrames--; continue; }
        let hit = false;
        // 打击 Boss
        if (this.boss && !this.boss.dead && !hit) {
          const bs = this.boss.sprite;
          if (bs && bs.active && Math.hypot(p.g.x - bs.x, p.g.y - bs.y) < 48) {
            this._hitBoss(1, Math.atan2(p.vy, p.vx), 60);
            hit = true;
          }
        }
        // 打击魂
        if (this.boss && !this.boss.dead && !hit) {
          const souls = this.boss.getSoulSprites();
          for (const s of souls) {
            if (!s || !s.active) continue;
            if (Math.hypot(p.g.x - s.x, p.g.y - s.y) < 28) {
              this.boss.damageSoul(s);
              hit = true;
              break;
            }
          }
        }
        // 打击残影
        if (this.boss && !this.boss.dead && !hit) {
          const dg = this.boss.getDoppelgangerSprite();
          if (dg && dg.active && Math.hypot(p.g.x - dg.x, p.g.y - dg.y) < 32) {
            this.boss.damageDoppelganger();
            hit = true;
          }
        }
        const oob = p.g.x < 0 || p.g.x > W || p.g.y < 0 || p.g.y > H;
        if (hit || oob || p.life <= 0) {
          if (p.g && p.g.active) p.g.destroy();
          this._projectiles.splice(i, 1);
          if (hit) {
            this.cameras.main.shake(40, 0.0015);
            if (this.boss && !this.boss.dead) this._spawnHitText(p.g.x, p.g.y - 10, '-1');
          }
        }
      }
    }

    // 撤离判定（优先于其他操作，放置 skill 动画期间按 E 失效）
    if (this._exitReady && this.exitZone) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.exitZone.x, this.exitZone.y);
      if (dist < 48) {
        if (!this._exitPrompt) {
          this._exitPrompt = this.add.text(this.exitZone.x, this.exitZone.y - 36, 'E  撤  离', {
            fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
            fontSize: '15px',
            color: '#caffe2',
            backgroundColor: '#0c1410dd',
            padding: { x: 8, y: 4 },
          }).setOrigin(0.5).setDepth(1800);
        }
        if (Phaser.Input.Keyboard.JustDown(this.keys.E)) {
          this._completeRun();
          return;
        }
      } else if (this._exitPrompt) {
        this._exitPrompt.destroy();
        this._exitPrompt = null;
      }
    }

    // 全局快捷键
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      this._returnToHubOnRetreat();
      return;
    }

    // 作弊：G 键切换无敌
    if (Phaser.Input.Keyboard.JustDown(this.keys.G)) {
      this._godMode = !this._godMode;
      this._toast(this._godMode ? '［作弊］无敌模式 开启' : '［作弊］无敌模式 关闭', 1200);
    }

    // M 键切换设置面板
    if (Phaser.Input.Keyboard.JustDown(this.keys.M)) {
      this._toggleSettings();
    }

    // C 键切换角色
    if (Phaser.Input.Keyboard.JustDown(this.keys.C)) {
      this._switchCharacter();
    }

    // 玩家动作
    if (Phaser.Input.Keyboard.JustDown(this.keys.J) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.tryAttack(time);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.U)) this.tryBladeSkill(time);
    if (Phaser.Input.Keyboard.JustDown(this.keys.Y)) this.trySkill2(time);

    // 移动
    let vx = 0, vy = 0;
    if (this.cursors.left.isDown || this.keys.A.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) vx += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) vy += 1;
    if (vx && vy) { vx *= Math.SQRT1_2; vy *= Math.SQRT1_2; }

    const attacking = time < this._attackUntil;
    const skillActive = time < this._skillUntil;
    const skill2Active = time < this._skill2Until;
    const speed = (skill2Active || skillActive) ? 0 : (attacking ? PLAYER_SPEED * 0.35 : PLAYER_SPEED);
    this.player.setVelocity(vx * speed, vy * speed);

    if (vx || vy) {
      if (Math.abs(vx) > Math.abs(vy)) this._playerDir = vx > 0 ? 'right' : 'left';
      else this._playerDir = vy > 0 ? 'down' : 'up';
      if (vx > 0) this._lastFacingX = 1;
      else if (vx < 0) this._lastFacingX = -1;
    }

    this.updatePlayerAnim(attacking || skillActive || skill2Active);
    this.player.setDepth(this.player.y);

    // Boss 更新
    if (this.boss && !this.boss.dead) {
      this.boss.update(dtSec, this.player);
    }

    this._updateHUD();
  }

  updatePlayerAnim(attacking) {
    const useDirectional = this._useKnifeHero || this._useBowHero;
    if (attacking) {
      if (this._useBowHero) {
        const shootDir = this._attackDir || this._playerDir;
        const shootKey = `hero_bow_shoot_${shootDir}`;
        if (this.anims.exists(shootKey)) {
          if (!this.player.anims.currentAnim || this.player.anims.currentAnim.key !== shootKey) {
            this.player.play(shootKey, true);
          }
          this.player.setFlipX(false);
        }
        return;
      }
      if (this._useKnifeHero) {
        const dir4 = this._attackDir || this._playerDir;
        const proKey = `hero_pro_attack_${dir4}`;
        if (this.anims.exists(proKey)) {
          if (!this.player.anims.currentAnim || this.player.anims.currentAnim.key !== proKey) {
            this.player.play(proKey, true);
          }
          this.player.setFlipX(false);
          return;
        }
      }
      const key = useDirectional
        ? `${this._heroAnimPrefix}_attack_${this._attackDir || this._playerDir}`
        : 'hero_attack';
      if (this.anims.exists(key) &&
          (!this.player.anims.currentAnim || this.player.anims.currentAnim.key !== key)) {
        this.player.play(key, true);
      }
      this.player.setFlipX(!useDirectional && this._playerDir !== 'left');
      return;
    }
    const moving = Math.abs(this.player.body.velocity.x) > 1 || Math.abs(this.player.body.velocity.y) > 1;
    const animDir = useDirectional ? this._playerDir : (this._playerDir === 'left' ? 'right' : this._playerDir);
    const key = moving ? `${this._heroAnimPrefix}_walk_${animDir}` : `${this._heroAnimPrefix}_idle_${animDir}`;
    if (this.anims.exists(key) && (!this.player.anims.currentAnim || this.player.anims.currentAnim.key !== key)) {
      this.player.play(key);
    }
    this.player.setFlipX(!useDirectional && this._playerDir === 'left');
  }

  // ===========================================================
  // 玩家攻击
  // ===========================================================
  tryAttack(time) {
    if (time < this._cooldownUntil) return;
    if (time < this._skillUntil || time < this._skill2Until) return;

    // —— 弓：射箭到鼠标指向的位置 ——
    if (this._useBowHero) {
      this._cooldownUntil = time + 1000;
      this._attackUntil = time + 400;
      const aim = Math.atan2(
        this._mouseWorldY - this.player.y,
        this._mouseWorldX - this.player.x
      );
      if (Math.abs(Math.cos(aim)) > Math.abs(Math.sin(aim))) {
        this._attackDir = Math.cos(aim) > 0 ? 'right' : 'left';
      } else {
        this._attackDir = Math.sin(aim) > 0 ? 'down' : 'up';
      }
      this._spawnBowProjectile(aim);
      if (Audio && Audio.sfx && Audio.sfx.bow) Audio.sfx.bow();
      return;
    }

    this._cooldownUntil = time + ATTACK_COOLDOWN;
    this._attackUntil = time + 480;
    this._attackDir = this._playerDir;

    const angle = dirToAngle(this._playerDir);
    const sx = this.player.x;
    const sy = this.player.y - 8;
    this._drawSlash(sx, sy, angle);
    if (Audio && Audio.sfx && Audio.sfx.slash) Audio.sfx.slash();

    // 攻击 Boss
    if (this.boss && !this.boss.dead) {
      const bs = this.boss.sprite;
      const dx = bs.x - sx;
      const dy = (bs.y - 18) - sy;
      const dist = Math.hypot(dx, dy);
      const diff = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - angle));
      if ((dist <= ATTACK_RANGE + 30 && (diff <= ATTACK_ARC / 2 + 0.25 || dist < 48)) || dist < 40) {
        this._hitBoss(ATTACK_DAMAGE, angle, 80);
      }
    }

    // 攻击魂
    if (this.boss && !this.boss.dead) {
      const soulSprites = this.boss.getSoulSprites();
      for (const soulSpr of soulSprites) {
        if (!soulSpr || !soulSpr.active) continue;
        const dx = soulSpr.x - sx;
        const dy = soulSpr.y - sy;
        const dist = Math.hypot(dx, dy);
        const diff = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - angle));
        if ((dist <= ATTACK_RANGE + 30 && (diff <= ATTACK_ARC / 2 + 0.25 || dist < 52)) || dist < 44) {
          const hit = this.boss.damageSoul(soulSpr);
          if (hit) {
            this.cameras.main.shake(45, 0.0018);
            this._spawnHitText(soulSpr.x, soulSpr.y - 24, `-1`);
          }
        }
      }
    }

    // 攻击残影
    if (this.boss && !this.boss.dead) {
      const dgSpr = this.boss.getDoppelgangerSprite();
      if (dgSpr && dgSpr.active) {
        const dx = dgSpr.x - sx;
        const dy = dgSpr.y - sy;
        const dist = Math.hypot(dx, dy);
        const diff = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - angle));
        if ((dist <= ATTACK_RANGE + 30 && (diff <= ATTACK_ARC / 2 + 0.25 || dist < 52)) || dist < 44) {
          const hit = this.boss.damageDoppelganger();
          if (hit) {
            this.cameras.main.shake(45, 0.0018);
            this._spawnHitText(dgSpr.x, dgSpr.y - 30, `-1`);
          }
        }
      }
    }
  }

  // ——————————— 角色切换 ———————————
  _applyCharConfig(index) {
    const type = this._charTypes[index];
    if (!type) return;
    const cfg = this._charConfigs[type];
    if (!cfg) return;

    if (this.player._proFrameNormalizer) {
      this.player.off('animationupdate', this.player._proFrameNormalizer);
      this.player.off('animationstart', this.player._proFrameNormalizer);
      this.player.off('animationcomplete', this.player._proAnimCompleteNormalizer);
      this.player._proFrameNormalizer = null;
      this.player._proAnimCompleteNormalizer = null;
    }
    if (this.player._bowFrameNormalizer) {
      this.player.off('animationupdate', this.player._bowFrameNormalizer);
      this.player._bowFrameNormalizer = null;
    }

    this.player.setTexture(cfg.tex, 0);
    this.player.setScale(cfg.scale);
    this.player.body.setSize(cfg.bodyW, cfg.bodyH).setOffset(cfg.bodyOx, cfg.bodyOy);
    this._useKnifeHero = (type === 'knife');
    this._useBowHero = (type === 'bow');
    this._heroAnimPrefix = cfg.prefix;

    const proScaleMul = 1.9;
    const proFixedScale = cfg.scale * proScaleMul;
    const _isProBlockAnimKey = (key) => (
      typeof key === 'string'
      && (key.startsWith('hero_pro_attack') || key.startsWith('hero_block'))
    );
    const proNormalizer = (anim) => {
      if (!anim || typeof anim.key !== 'string') return;
      if (_isProBlockAnimKey(anim.key)) {
        if (this.player.scale !== proFixedScale) this.player.setScale(proFixedScale);
      } else {
        if (this.player.scale !== cfg.scale) this.player.setScale(cfg.scale);
      }
    };
    const proAnimCompleteNormalizer = (anim) => {
      if (!anim || typeof anim.key !== 'string') return;
      if (_isProBlockAnimKey(anim.key)) {
        if (this.player.scale !== cfg.scale) this.player.setScale(cfg.scale);
      }
    };
    this.player.on('animationupdate', proNormalizer);
    this.player.on('animationstart', proNormalizer);
    this.player.on('animationcomplete', proAnimCompleteNormalizer);
    this.player._proFrameNormalizer = proNormalizer;
    this.player._proAnimCompleteNormalizer = proAnimCompleteNormalizer;

    if (type === 'bow') {
      const refTex = this.textures.get(cfg.tex);
      const refH = (refTex && refTex.getSourceImage && refTex.getSourceImage().height) || 204;
      const bowNormalizer = (anim, frame) => {
        if (!frame || !frame.frame || !frame.frame.realHeight) return;
        const fh = frame.frame.realHeight;
        if (fh <= 0) return;
        const s = cfg.scale * (refH / fh);
        if (Math.abs(this.player.scale - s) > 0.001) this.player.setScale(s);
      };
      this.player.on('animationupdate', bowNormalizer);
      this.player._bowFrameNormalizer = bowNormalizer;
    }

    const dir = this._playerDir || 'up';
    if (this.anims.exists(`${cfg.prefix}_idle_${dir}`)) this.player.play(`${cfg.prefix}_idle_${dir}`);
  }

  _switchCharacter() {
    if (this._charTypes.length < 2) return;
    if (Audio && Audio.sfx && Audio.sfx.click) Audio.sfx.click();
    this._charIndex = (this._charIndex + 1) % this._charTypes.length;
    this._applyCharConfig(this._charIndex);
  }

  _spawnBowProjectile(aim) {
    const px = this.player.x + Math.cos(aim) * 10;
    const py = this.player.y + Math.sin(aim) * 10;
    const speed = 520;
    const g = this.add.graphics().setDepth(430);
    g.fillStyle(0xffeebb, 1).fillRect(-7, -1.2, 14, 2.4);
    g.fillStyle(0x8b5a3c, 1).fillRect(5, -2, 2.5, 4);
    g.fillStyle(0x3a3a3a, 1).fillCircle(-7, 0, 1.5);
    g.x = px;
    g.y = py;
    g.rotation = aim;
    this._projectiles.push({
      g,
      vx: Math.cos(aim) * speed,
      vy: Math.sin(aim) * speed,
      life: 1500,
      skipFrames: 2,  // 跳过前 2 帧碰撞检测（防止出生帧自伤）
    });
  }

  tryBladeSkill(time) {
    if (time < this._skillCooldownUntil || time < this._attackUntil || time < this._skill2Until) return;
    this._skillCooldownUntil = time + BLADE_SKILL_COOLDOWN;
    this._skillUntil = time + BLADE_SKILL_DURATION;
    const facingX = this._playerDir === 'left' ? -1 : (this._playerDir === 'right' ? 1 : this._lastFacingX);
    this._lastFacingX = facingX;
    this._playBladeSkillFx(facingX);
    if (Audio && Audio.sfx && Audio.sfx.slash) Audio.sfx.slash();
  }

  trySkill2(time) {
    if (time < this._skill2CooldownUntil || time < this._attackUntil || time < this._skillUntil) return;
    this._skill2CooldownUntil = time + SKILL2_COOLDOWN;
    this._skill2Until = time + SKILL2_DURATION;
    const facingX = this._playerDir === 'left' ? -1 : (this._playerDir === 'right' ? 1 : this._lastFacingX);
    this._lastFacingX = facingX;
    this._playSkill2Fx(facingX);
    if (Audio && Audio.sfx && Audio.sfx.slash) Audio.sfx.slash();
  }

  _drawSlash(x, y, angle) {
    const g = this.add.graphics().setDepth(420);
    const start = angle - ATTACK_ARC / 2;
    const end = angle + ATTACK_ARC / 2;
    g.lineStyle(14, 0x2da9ff, 0.35);
    g.beginPath(); g.arc(x, y, ATTACK_RANGE * 0.72, start, end); g.strokePath();
    g.lineStyle(6, 0xbef6ff, 0.78);
    g.beginPath(); g.arc(x, y, ATTACK_RANGE * 0.82, start + 0.06, end - 0.06); g.strokePath();
    g.lineStyle(2, 0xffffff, 0.9);
    g.beginPath(); g.arc(x, y, ATTACK_RANGE * 0.9, start + 0.12, end - 0.12); g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, scaleX: 1.08, scaleY: 1.08, duration: 150, onComplete: () => g.destroy() });
  }

  _hitBoss(amount, angle, knockMul = 80) {
    if (!this.boss || this.boss.dead) return;
    const kx = Math.cos(angle) * knockMul;
    const ky = Math.sin(angle) * knockMul;
    const applied = this.boss.takeDamage(amount, kx, ky);
    if (applied) {
      this.cameras.main.shake(70, 0.0024);
      this._spawnHitText(this.boss.sprite.x, this.boss.sprite.y - 60, `-${amount}`);
      return;
    }
    const now = this.time.now;
    if (now >= this._bossArmorTextUntil) {
      this._bossArmorTextUntil = now + 520;
      this._spawnHitText(this.boss.sprite.x, this.boss.sprite.y - 62, '霸体');
    }
  }

  _spawnHitText(x, y, text) {
    const t = this.add.text(x, y, text, {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '18px',
      color: '#fff5a6',
      stroke: '#321008',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(1500);
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 600, onComplete: () => t.destroy() });
  }

  // ============== Blade Skill FX (与 TrainingScene 一致) ==============
  _playBladeSkillFx(facingX) {
    const animKey = facingX > 0 ? 'hero_blade_skill_right_anim' : 'hero_blade_skill_anim';
    const texKey = facingX > 0 ? 'hero_blade_skill_right' : 'hero_blade_skill';
    if (!this.anims.exists(animKey)) return;
    if (this._bladeSkillSprite) this._bladeSkillSprite.destroy();

    this.player.setVisible(false);
    const playerFootY = this.player.y + this.player.displayHeight / 2;
    const baseFxX = this.player.x;
    const originX = this._getBladeAnchorX(facingX) / BLADE_SKILL_FW;
    const fx = this.add.sprite(baseFxX, playerFootY, texKey, 0)
      .setOrigin(originX, BLADE_SKILL_ORIGIN_Y)
      .setScale(0.62)
      .setDepth(this.player.y + 2);
    fx.play(animKey);
    this._bladeSkillSprite = fx;
    this._bladeSkillHitFrames = new Set();

    const onFrame = (anim, frame) => {
      const fi = Math.max(0, (frame && frame.index ? frame.index - 1 : 0));
      fx.setScale(fi < 4 || fi === 10 ? 0.62 : 0.48);
      fx.x = baseFxX + this._getBladeFrameXOff(fi, facingX) * fx.scaleX;
      fx.y = playerFootY + (BLADE_SKILL_FRAME_Y_OFFSETS[fi] || 0);
      // 同步 player 物理身体到技能动画位置
      if (this.player && this.player.body && !this._ended) {
        this.player.setPosition(fx.x, fx.y - this.player.displayHeight / 2);
      }
      this._resolveBladeHit(fx, fi, facingX);
    };
    fx.on(Phaser.Animations.Events.ANIMATION_UPDATE, onFrame);
    this._resolveBladeHit(fx, 0, facingX);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return; cleaned = true;
      fx.off(Phaser.Animations.Events.ANIMATION_UPDATE, onFrame);
      if (this._bladeSkillSprite === fx) this._bladeSkillSprite = null;
      // 死亡后不再恢复 player 位置/可见性
      if (!this._ended && this.player && this.player.active) {
        const endR = this._getBladeFrameRect(10, facingX);
        const oPx = this._getBladeAnchorX(facingX);
        const fs = 0.62;
        const finalX = fx.x + ((endR.ax || oPx) - oPx) * fs;
        const finalFootY = playerFootY + (BLADE_SKILL_FRAME_Y_OFFSETS[10] || 0);
        this.player.setPosition(finalX, finalFootY - this.player.displayHeight / 2);
        this.player.setVisible(true);
      }
      if (fx && fx.active) fx.destroy();
    };
    fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, cleanup);
    this.time.delayedCall(BLADE_SKILL_DURATION + 160, cleanup);
  }

  _getBladeAnchorX(facingX) {
    return facingX > 0 ? BLADE_SKILL_FW - BLADE_SKILL_LEFT_ANCHOR_X : BLADE_SKILL_LEFT_ANCHOR_X;
  }
  _getBladeFrameRect(fi, facingX) {
    const r = BLADE_SKILL_FRAME_RECTS[Math.max(0, Math.min(fi, BLADE_SKILL_FRAME_RECTS.length - 1))];
    if (facingX <= 0) return r;
    return { x: BLADE_SKILL_FW - r.x - r.w, y: r.y, w: r.w, h: r.h, ax: BLADE_SKILL_FW - r.ax };
  }
  _getBladeFrameXOff(fi, facingX) {
    const x = BLADE_SKILL_FRAME_X_OFFSETS[Math.max(0, Math.min(fi, BLADE_SKILL_FRAME_X_OFFSETS.length - 1))] || 0;
    return facingX > 0 ? -x : x;
  }
  _getBladeHitWorldRect(fx, fi, facingX) {
    const r = BLADE_SKILL_HIT_RECTS[Math.max(0, Math.min(fi, BLADE_SKILL_HIT_RECTS.length - 1))];
    if (!r) return null;
    const rect = facingX <= 0 ? r : { x: BLADE_SKILL_FW - r.x - r.w, y: r.y, w: r.w, h: r.h };
    const s = fx.scaleX;
    const ox = this._getBladeAnchorX(facingX);
    const oy = BLADE_SKILL_FH * BLADE_SKILL_ORIGIN_Y;
    const x0 = fx.x + (rect.x - ox) * s;
    const x1 = fx.x + (rect.x + rect.w - ox) * s;
    const y0 = fx.y + (rect.y - oy) * s;
    const y1 = fx.y + (rect.y + rect.h - oy) * s;
    return new Phaser.Geom.Rectangle(Math.min(x0, x1), y0, Math.abs(x1 - x0), y1 - y0);
  }
  _resolveBladeHit(fx, fi, facingX) {
    if (!this.boss || this.boss.dead) return;
    if (this._bladeSkillHitFrames && this._bladeSkillHitFrames.has(fi)) return;
    const hitRect = this._getBladeHitWorldRect(fx, fi, facingX);
    if (!hitRect) return;

    // 攻击 Boss
    const bs = this.boss.sprite;
    const target = new Phaser.Geom.Rectangle(bs.x - 36, bs.y - 80, 72, 100);
    if (Phaser.Geom.Rectangle.Overlaps(hitRect, target)) {
      if (this._bladeSkillHitFrames) this._bladeSkillHitFrames.add(fi);
      const aim = facingX < 0 ? Math.PI : 0;
      this._hitBoss(SKILL_DAMAGE, aim, 140);
    }

    // 攻击魂
    const soulSprites = this.boss.getSoulSprites();
    for (const soulSpr of soulSprites) {
      if (!soulSpr || !soulSpr.active) continue;
      const sTarget = new Phaser.Geom.Rectangle(soulSpr.x - 24, soulSpr.y - 28, 48, 56);
      if (Phaser.Geom.Rectangle.Overlaps(hitRect, sTarget)) {
        const hit = this.boss.damageSoul(soulSpr);
        if (hit) {
          this.cameras.main.shake(40, 0.0015);
          this._spawnHitText(soulSpr.x, soulSpr.y - 24, '-1');
        }
      }
    }

    // 攻击残影
    const dgSpr = this.boss.getDoppelgangerSprite();
    if (dgSpr && dgSpr.active) {
      const dTarget = new Phaser.Geom.Rectangle(dgSpr.x - 24, dgSpr.y - 30, 48, 60);
      if (Phaser.Geom.Rectangle.Overlaps(hitRect, dTarget)) {
        const hit = this.boss.damageDoppelganger();
        if (hit) {
          this.cameras.main.shake(40, 0.0015);
          this._spawnHitText(dgSpr.x, dgSpr.y - 30, '-1');
        }
      }
    }
  }

  // ============== Skill2 FX ==============
  _playSkill2Fx(facingX) {
    const animKey = facingX > 0 ? 'hero_skill2_left_anim' : 'hero_skill2_right_anim';
    const texKey = facingX > 0 ? 'hero_skill2_left' : 'hero_skill2_right';
    if (!this.anims.exists(animKey)) return;
    if (this._skill2Sprite) this._skill2Sprite.destroy();

    this.player.setVisible(false);
    this.player.setVelocity(0, 0);
    this._skill2HitFrames = new Set();

    const playerFootY = this.player.y + this.player.displayHeight / 2;
    const baseFxX = this.player.x;
    const baseFxY = playerFootY;
    const fx = this.add.sprite(baseFxX, baseFxY, texKey, 0)
      .setOrigin(this._getSkill2AnchorX(facingX) / SKILL2_FW, 1)
      .setScale(SKILL2_SCALE)
      .setDepth(this.player.y + 4);
    fx.play(animKey);
    this._skill2Sprite = fx;

    const onFrame = (anim, frame) => {
      const fi = Math.max(0, (frame && frame.index ? frame.index - 1 : 0));
      fx.x = baseFxX + this._getSkill2FrameXOff(fi, facingX);
      fx.y = baseFxY + (SKILL2_FRAME_Y_OFFSETS[fi] || 0);
      // 同步 player 物理身体到技能动画位置
      if (this.player && this.player.body && !this._ended) {
        this.player.setPosition(fx.x, fx.y - this.player.displayHeight / 2);
      }
      this._resolveSkill2Hit(fx, fi, facingX);
    };
    fx.on(Phaser.Animations.Events.ANIMATION_UPDATE, onFrame);
    this._resolveSkill2Hit(fx, 0, facingX);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return; cleaned = true;
      fx.off(Phaser.Animations.Events.ANIMATION_UPDATE, onFrame);
      if (this._skill2Sprite === fx) this._skill2Sprite = null;
      // 死亡后不再恢复 player 位置/可见性
      if (!this._ended && this.player && this.player.active) {
        const lastFi = SKILL2_FRAME_X_OFFSETS.length - 1;
        const finalFxX = baseFxX + this._getSkill2FrameXOff(lastFi, facingX);
        const finalFxY = baseFxY + (SKILL2_FRAME_Y_OFFSETS[lastFi] || 0);
        const finalDx = Math.abs(SKILL2_FINAL_OFFSET_X) * SKILL2_SCALE * (facingX > 0 ? 1 : -1);
        this.player.setPosition(finalFxX + finalDx, finalFxY - this.player.displayHeight / 2);
        this.player.setVisible(true);
      }
      if (fx && fx.active) fx.destroy();
    };
    fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, cleanup);
    this.time.delayedCall(SKILL2_DURATION + 250, cleanup);
  }

  _getSkill2AnchorX(facingX) {
    return facingX > 0 ? SKILL2_FW - SKILL2_ANCHOR_X : SKILL2_ANCHOR_X;
  }
  _getSkill2FrameXOff(fi, facingX) {
    const x = SKILL2_FRAME_X_OFFSETS[Math.max(0, Math.min(fi, SKILL2_FRAME_X_OFFSETS.length - 1))] || 0;
    return facingX > 0 ? x : -x;
  }
  _getSkill2HitWorldRect(fx, fi, facingX) {
    const r = SKILL2_HIT_RECTS[Math.max(0, Math.min(fi, SKILL2_HIT_RECTS.length - 1))];
    if (!r) return null;
    const rect = facingX < 0 ? r : { x: SKILL2_FW - r.x - r.w, y: r.y, w: r.w, h: r.h };
    const s = fx.scaleX;
    const ox = this._getSkill2AnchorX(facingX);
    const oy = SKILL2_FH;
    const x0 = fx.x + (rect.x - ox) * s;
    const x1 = fx.x + (rect.x + rect.w - ox) * s;
    const y0 = fx.y + (rect.y - oy) * s;
    const y1 = fx.y + (rect.y + rect.h - oy) * s;
    return new Phaser.Geom.Rectangle(Math.min(x0, x1), y0, Math.abs(x1 - x0), y1 - y0);
  }
  _resolveSkill2Hit(fx, fi, facingX) {
    if (!this.boss || this.boss.dead) return;
    if (this._skill2HitFrames && this._skill2HitFrames.has(fi)) return;
    const hitRect = this._getSkill2HitWorldRect(fx, fi, facingX);
    if (!hitRect) return;

    // 攻击 Boss
    const bs = this.boss.sprite;
    const target = new Phaser.Geom.Rectangle(bs.x - 36, bs.y - 80, 72, 100);
    if (Phaser.Geom.Rectangle.Overlaps(hitRect, target)) {
      this._skill2HitFrames.add(fi);
      const aim = facingX < 0 ? Math.PI : 0;
      this._hitBoss(SKILL_DAMAGE, aim, 160);
    }

    // 攻击魂
    const soulSprites = this.boss.getSoulSprites();
    for (const soulSpr of soulSprites) {
      if (!soulSpr || !soulSpr.active) continue;
      const sTarget = new Phaser.Geom.Rectangle(soulSpr.x - 24, soulSpr.y - 28, 48, 56);
      if (Phaser.Geom.Rectangle.Overlaps(hitRect, sTarget)) {
        const hit = this.boss.damageSoul(soulSpr);
        if (hit) {
          this.cameras.main.shake(40, 0.0015);
          this._spawnHitText(soulSpr.x, soulSpr.y - 24, '-1');
        }
      }
    }

    // 攻击残影
    const dgSpr = this.boss.getDoppelgangerSprite();
    if (dgSpr && dgSpr.active) {
      const dTarget = new Phaser.Geom.Rectangle(dgSpr.x - 24, dgSpr.y - 30, 48, 60);
      if (Phaser.Geom.Rectangle.Overlaps(hitRect, dTarget)) {
        const hit = this.boss.damageDoppelganger();
        if (hit) {
          this.cameras.main.shake(40, 0.0015);
          this._spawnHitText(dgSpr.x, dgSpr.y - 30, '-1');
        }
      }
    }
  }

  // ===========================================================
  // 来自 Boss 的伤害
  // ===========================================================
  applyBossDamageToPlayer(amount, kx, ky, skillId) {
    const now = this.time.now;
    if (now < this._playerInvulnUntil) return;

    // 无敌作弊
    if (this._godMode) {
      this._playerInvulnUntil = now + 200;
      return;
    }

    // 主角释放技能时 75% 概率格挡
    if ((now < this._skillUntil || now < this._skill2Until) && Math.random() < 0.75) {
      // 格挡成功
      this._spawnHitText(this.player.x, this.player.y - 28, '格挡');
      // 轻微弹反特效
      this.player.setTintFill(0xaaccff);
      this.time.delayedCall(100, () => { if (this.player && this.player.active) this.player.clearTint(); });
      this.cameras.main.shake(50, 0.003);
      this._playerInvulnUntil = now + 250;
      return;
    }

    this._playerInvulnUntil = now + 600;
    this.playerHP = Math.max(0, this.playerHP - amount);

    // 击退
    if (this.player && this.player.body) {
      this.player.body.setVelocity(kx, ky);
      this.time.delayedCall(150, () => {
        if (this.player && this.player.body) this.player.body.setVelocity(0, 0);
      });
    }
    // 闪烁
    this.player.setTintFill(0xff5566);
    this.time.delayedCall(120, () => { if (this.player && this.player.active) this.player.clearTint(); });
    this.cameras.main.shake(180, 0.006);
    if (Audio && Audio.sfx && Audio.sfx.hurt) Audio.sfx.hurt();

    if (this.playerHP <= 0) {
      this._gameOver();
    }
  }

  // ===========================================================
  // Boss 死亡 → 出现撤离点
  // ===========================================================
  onBossDefeated() {
    if (this._exitReady) return;
    this._exitReady = true;
    this._toast('影 鸦 已 倒  —  撤 离 之 路 已 开');

    // 撤离出口（地图顶部中央）
    const ex = W / 2;
    const ey = 90;
    const ring = this.add.graphics().setDepth(900);
    ring.fillStyle(0x3affc8, 0.18); ring.fillCircle(ex, ey, 36);
    ring.lineStyle(2, 0x3affc8, 0.85); ring.strokeCircle(ex, ey, 36);
    this.tweens.add({ targets: ring, alpha: 0.55, yoyo: true, repeat: -1, duration: 900 });
    this.exitZone = { x: ex, y: ey, gfx: ring };

    const tag = this.add.text(ex, ey - 56, '撤  离', {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '18px',
      color: '#caffe2',
      stroke: '#0a1d18',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(901);
    this.exitZone.tag = tag;
  }

  _completeRun() {
    if (this._ended) return;
    this._ended = true;
    this.player.setVelocity(0, 0);
    // 开发者入口：不写存档，直接回标题
    if (this._returnPayload.runStats && this._returnPayload.runStats.devEntry) {
      this._toast('［开发］Boss 已击败，返回标题');
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('TitleScene'));
      return;
    }
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      // 携带原 inventory 直接结算成功
      const inv = this._returnPayload.inventory || { items: [], totalValue: 0 };
      const items = inv.items || [];
      const value = (typeof inv.totalValue === 'function') ? inv.totalValue() : (inv.totalValue || 0);
      // 通关额外奖励
      const bonusGold = 200;
      const bonusRep = 25;
      this.scene.start('ResultScene', {
        success: true,
        items,
        value,
        reason: '击败影鸦，归藏夜行圆满',
        bonusGold,
        bonusRep,
        runStats: this._returnPayload.runStats || { kills: 1, alerts: 0, bossKilled: true },
      });
    });
  }

  _gameOver() {
    if (this._ended) return;
    this._ended = true;
    this.player.setVisible(false);
    // 开发者入口：不写存档，直接回标题
    if (this._returnPayload.runStats && this._returnPayload.runStats.devEntry) {
      this._toast('［开发］阵亡，返回标题');
      this.cameras.main.fadeOut(800, 60, 0, 6);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('TitleScene'));
      return;
    }
    this.cameras.main.fadeOut(900, 60, 0, 6);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('ResultScene', {
        success: false,
        items: [],
        value: 0,
        reason: '在影鸦的爪下倒下……',
        runStats: this._returnPayload.runStats || { kills: 0, alerts: 0 },
      });
    });
  }

  _returnToHubOnRetreat() {
    if (this._ended) return;
    this._ended = true;
    this.cameras.main.fadeOut(420, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('HubScene');
    });
  }

  // ===========================================================
  // 设置面板（M 键）
  // ===========================================================
  _toggleSettings() {
    if (this._settingsOpen) {
      this._closeSettings();
      return;
    }
    this._openSettings();
  }

  _openSettings() {
    if (this._settingsOpen) return;
    this._settingsOpen = true;

    // 半透明遮罩
    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setDepth(3000);
    const panel = this.add.rectangle(W / 2, H / 2, 420, 260, 0x1a1220, 0.92)
      .setStrokeStyle(2, 0xd4af37, 0.8).setDepth(3001);

    const title = this.add.text(W / 2, H / 2 - 95, '⚙ 设  置', {
      fontFamily: '"PingFang SC","Microsoft YaHei",serif',
      fontSize: '20px', color: '#ffe9a6',
    }).setOrigin(0.5).setDepth(3002);

    const closeHint = this.add.text(W / 2, H / 2 + 115, 'M / ESC 关闭  ·  W/S 切换  ·  ← → 调整', {
      fontFamily: '"PingFang SC","Microsoft YaHei",serif',
      fontSize: '12px', color: '#9a8a6a',
    }).setOrigin(0.5).setDepth(3002);

    this._settingsData = { bg, panel, title, closeHint, selected: 0 };
    this._settingsBgmVol = 0.50;
    this._settingsSfxVol = 0.50;
    this._drawSettingsSliders();
  }

  _drawSettingsSliders() {
    const d = this._settingsData;
    if (!d) return;
    if (d.bgmLabel) { d.bgmLabel.destroy(); d.barBgBgm.destroy(); d.barBgm.destroy(); }
    if (d.sfxLabel) { d.sfxLabel.destroy(); d.barBgSfx.destroy(); d.barSfx.destroy(); }

    const cx = W / 2;
    const cy = H / 2;
    const bw = 240;
    const selBgm = d.selected === 0;

    d.bgmLabel = this.add.text(cx - bw / 2, cy - 55, `BGM 音量  ${Math.round(this._settingsBgmVol * 100)}%`, {
      fontFamily: '"PingFang SC","Microsoft YaHei",serif',
      fontSize: '14px', color: selBgm ? '#fff4b8' : '#b0a080',
    }).setDepth(3002);
    d.barBgBgm = this.add.rectangle(cx, cy - 32, bw, 10, 0x0d0808, 0.9)
      .setStrokeStyle(1, selBgm ? 0xf0d060 : 0x554428, 0.7).setDepth(3002);
    d.barBgm = this.add.rectangle(cx - bw / 2, cy - 32, bw * this._settingsBgmVol, 8, selBgm ? 0xf0d060 : 0x8a7a44, 1)
      .setOrigin(0, 0.5).setDepth(3003);

    const selSfx = d.selected === 1;
    d.sfxLabel = this.add.text(cx - bw / 2, cy + 10, `SFX 音量  ${Math.round(this._settingsSfxVol * 100)}%`, {
      fontFamily: '"PingFang SC","Microsoft YaHei",serif',
      fontSize: '14px', color: selSfx ? '#fff4b8' : '#b0a080',
    }).setDepth(3002);
    d.barBgSfx = this.add.rectangle(cx, cy + 33, bw, 10, 0x0d0808, 0.9)
      .setStrokeStyle(1, selSfx ? 0xf0d060 : 0x554428, 0.7).setDepth(3002);
    d.barSfx = this.add.rectangle(cx - bw / 2, cy + 33, bw * this._settingsSfxVol, 8, selSfx ? 0xf0d060 : 0x8a7a44, 1)
      .setOrigin(0, 0.5).setDepth(3003);
  }

  _closeSettings() {
    const d = this._settingsData;
    if (d) {
      const items = [d.bg, d.panel, d.title, d.closeHint, d.bgmLabel, d.barBgBgm, d.barBgm, d.sfxLabel, d.barBgSfx, d.barSfx];
      items.forEach(item => { if (item && item.destroy) item.destroy(); });
    }
    this._settingsOpen = false;
    this._settingsData = null;
  }

  _updateSettings() {
    if (!this._settingsOpen || !this._settingsData) return;

    const d = this._settingsData;
    // W/S 切换选项
    if (Phaser.Input.Keyboard.JustDown(this.keys.W) || Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
      d.selected = (d.selected === 0) ? 1 : 0;
      if (Audio && Audio.sfx && Audio.sfx.click) Audio.sfx.click();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.S) || Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
      d.selected = (d.selected === 1) ? 0 : 1;
      if (Audio && Audio.sfx && Audio.sfx.click) Audio.sfx.click();
    }

    // ← → 调整音量
    const step = this.cursors.shift.isDown ? 0.02 : 0.02;
    let changed = false;
    if (this.cursors.left.isDown || this.keys.A.isDown) {
      if (d.selected === 0) { this._settingsBgmVol = Math.max(0, this._settingsBgmVol - step); changed = true; }
      else { this._settingsSfxVol = Math.max(0, this._settingsSfxVol - step); changed = true; }
    }
    if (this.cursors.right.isDown || this.keys.D.isDown) {
      if (d.selected === 0) { this._settingsBgmVol = Math.min(1, this._settingsBgmVol + step); changed = true; }
      else { this._settingsSfxVol = Math.min(1, this._settingsSfxVol + step); changed = true; }
    }
    if (changed) {
      if (Audio && Audio.bgm && Audio.bgm.setVolume) Audio.bgm.setVolume(this._settingsBgmVol);
      if (Audio && Audio.setVolume) Audio.setVolume(this._settingsSfxVol);
      this._drawSettingsSliders();
    }

    // M 或 ESC 关闭
    if (Phaser.Input.Keyboard.JustDown(this.keys.M) || Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      this._closeSettings();
      return;
    }
  }
}
