// BossRoomScene.js — 最终关卡：与 Boss 单挑，击败后撤离
// 由 MuseumScene（黑市左上角入口）跳转进入；data 携带 inventory/playerHP 等运行态
import Phaser from 'phaser';
import Audio from '../systems/AudioFx.js';
import Boss from '../systems/Boss.js';

const W = 1280;
const H = 720;
const PLAYER_SPEED = 190;
const PLAYER_MAX_HP = 6;
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

    // —— 3. 玩家（默认持刀）——
    const spawnX = W / 2;
    const spawnY = H - PAD - 70;
    const useKnife = this.textures.exists('hero_knife');
    if (useKnife) {
      this.player = this.physics.add.sprite(spawnX, spawnY, 'hero_knife', 0);
      this.player.setScale(0.265);
      this.player.body.setSize(86, 44).setOffset(85, 208);
      this._heroAnimPrefix = 'hero_knife';
      this._useKnifeHero = true;
    } else {
      this.player = this.physics.add.sprite(spawnX, spawnY, 'hero_hongfa', 0);
      this.player.setScale(1.05);
      this.player.body.setSize(22, 12).setOffset(21, 48);
      this._heroAnimPrefix = 'hero';
      this._useKnifeHero = false;
    }
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(this.player.y);
    this.physics.add.collider(this.player, this.walls);
    this._playerDir = 'up';
    this._lastFacingX = 1;
    this.playerHP = Math.min(PLAYER_MAX_HP, this._returnPayload.playerHP || PLAYER_MAX_HP);
    this.playerMaxHP = PLAYER_MAX_HP;
    this._playerInvulnUntil = 0;
    if (this.anims.exists(`${this._heroAnimPrefix}_idle_up`)) this.player.play(`${this._heroAnimPrefix}_idle_up`);

    // —— 4. Boss ——
    this.boss = new Boss(this, W / 2, PAD + 220);
    this.physics.add.collider(this.boss.sprite, this.walls);

    // —— 5. 撤离出口（击败 boss 后才出现，位于地图顶部中央）——
    this._exitReady = false;
    this.exitZone = null;

    // —— 6. 输入 ——
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,J,U,Y,E,SPACE,ESC');

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
    this.hud = this.add.text(18, 14, '夜行 · 终章   WASD 移动  J 普攻  U/Y 技能  E 撤离（需击败 Boss）', {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '14px',
      color: '#ffe9a6',
      backgroundColor: '#120b05cc',
      padding: { x: 10, y: 6 },
    }).setDepth(2000).setScrollFactor(0);

    // 玩家血条
    this.hpBg = this.add.rectangle(18, 44, 220, 14, 0x000000, 0.8).setOrigin(0, 0).setDepth(2000).setStrokeStyle(1, 0x80c8ff, 0.6);
    this.hpBar = this.add.rectangle(20, 46, 216, 10, 0x6bcf6b).setOrigin(0, 0).setDepth(2001);
    this.hpText = this.add.text(130, 51, `${this.playerHP} / ${this.playerMaxHP}`, {
      fontFamily: '"Consolas", monospace',
      fontSize: '12px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(2002);
  }

  _updateHUD() {
    if (!this.hpBar) return;
    this.hpBar.width = 216 * Math.max(0, this.playerHP / this.playerMaxHP);
    this.hpBar.fillColor = this.playerHP > this.playerMaxHP * 0.5 ? 0x6bcf6b
      : this.playerHP > this.playerMaxHP * 0.25 ? 0xf2c14e : 0xe54b4b;
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
    if (!this.player || !this.player.body) return;
    const now = time;
    const dtSec = this._lastTime ? Math.min(0.05, (now - this._lastTime) / 1000) : 0.016;
    this._lastTime = now;

    // 全局快捷键
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      this._returnToHubOnRetreat();
      return;
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
    const speed = skill2Active ? 0 : (skillActive ? PLAYER_SPEED * 0.12 : (attacking ? PLAYER_SPEED * 0.35 : PLAYER_SPEED));
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

    // 撤离判定
    if (this._exitReady && this.exitZone) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.exitZone.x, this.exitZone.y);
      if (dist < 36) {
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

    this._updateHUD();
  }

  updatePlayerAnim(attacking) {
    const useDirectional = this._useKnifeHero;
    if (attacking) {
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
    this._cooldownUntil = time + ATTACK_COOLDOWN;
    this._attackUntil = time + 210;
    this._attackDir = this._playerDir;

    const angle = dirToAngle(this._playerDir);
    const sx = this.player.x;
    const sy = this.player.y - 8;
    this._drawSlash(sx, sy, angle);
    if (Audio && Audio.sfx && Audio.sfx.slash) Audio.sfx.slash();

    if (this.boss && !this.boss.dead) {
      const dx = this.boss.sprite.x - sx;
      const dy = (this.boss.sprite.y - 18) - sy;
      const dist = Math.hypot(dx, dy);
      const diff = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - angle));
      if (dist <= ATTACK_RANGE && (diff <= ATTACK_ARC / 2 || dist < 36)) {
        this._hitBoss(ATTACK_DAMAGE, angle, 80);
      }
    }
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
    this.boss.takeDamage(amount, kx, ky);
    this.cameras.main.shake(70, 0.0024);
    this._spawnHitText(this.boss.sprite.x, this.boss.sprite.y - 60, `-${amount}`);
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
      this._resolveBladeHit(fx, fi, facingX);
    };
    fx.on(Phaser.Animations.Events.ANIMATION_UPDATE, onFrame);
    this._resolveBladeHit(fx, 0, facingX);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return; cleaned = true;
      fx.off(Phaser.Animations.Events.ANIMATION_UPDATE, onFrame);
      if (this._bladeSkillSprite === fx) this._bladeSkillSprite = null;
      if (this.player && this.player.active) {
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
    const bs = this.boss.sprite;
    const target = new Phaser.Geom.Rectangle(bs.x - 36, bs.y - 80, 72, 100);
    if (!Phaser.Geom.Rectangle.Overlaps(hitRect, target)) return;
    if (this._bladeSkillHitFrames) this._bladeSkillHitFrames.add(fi);
    const aim = facingX < 0 ? Math.PI : 0;
    this._hitBoss(SKILL_DAMAGE, aim, 140);
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
      this._resolveSkill2Hit(fx, fi, facingX);
    };
    fx.on(Phaser.Animations.Events.ANIMATION_UPDATE, onFrame);
    this._resolveSkill2Hit(fx, 0, facingX);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return; cleaned = true;
      fx.off(Phaser.Animations.Events.ANIMATION_UPDATE, onFrame);
      if (this._skill2Sprite === fx) this._skill2Sprite = null;
      if (this.player && this.player.active) {
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
    const bs = this.boss.sprite;
    const target = new Phaser.Geom.Rectangle(bs.x - 36, bs.y - 80, 72, 100);
    if (!Phaser.Geom.Rectangle.Overlaps(hitRect, target)) return;
    this._skill2HitFrames.add(fi);
    const aim = facingX < 0 ? Math.PI : 0;
    this._hitBoss(SKILL_DAMAGE, aim, 160);
  }

  // ===========================================================
  // 来自 Boss 的伤害
  // ===========================================================
  applyBossDamageToPlayer(amount, kx, ky, skillId) {
    const now = this.time.now;
    if (now < this._playerInvulnUntil) return;
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
}
