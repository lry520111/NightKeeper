import Phaser from 'phaser';
import Audio from '../systems/AudioFx.js';

const W = 1280;
const H = 720;
const PLAYER_SPEED = 190;
const ATTACK_RANGE = 92;
const ATTACK_ARC = Math.PI * 0.58;
const ATTACK_COOLDOWN = 260;
const BLADE_SKILL_RANGE = 280;
const BLADE_SKILL_HALF_WIDTH = 78;
const BLADE_SKILL_COOLDOWN = 1450;
const BLADE_SKILL_DURATION = 2180;
const BLADE_SKILL_FW = 772;
const BLADE_SKILL_FH = 230;
const BLADE_SKILL_LEFT_ANCHOR_X = 648;
const BLADE_SKILL_ORIGIN_Y = 0.98;
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

const DUMMIES = [
  { x: 180, y: 270, name: '左侧木桩一' },
  { x: 170, y: 360, name: '左侧木桩二' },
  { x: 180, y: 450, name: '左侧木桩三' },
  { x: 640, y: 375, name: '中央木桩' },
  { x: 1110, y: 260, name: '右侧木桩一' },
  { x: 1120, y: 350, name: '右侧木桩二' },
  { x: 1110, y: 440, name: '右侧木桩三' },
];

const dirToAngle = (dir) => {
  if (dir === 'left') return Math.PI;
  if (dir === 'up') return -Math.PI / 2;
  if (dir === 'down') return Math.PI / 2;
  return 0;
};

export default class TrainingScene extends Phaser.Scene {
  constructor() {
    super('TrainingScene');
  }

  create() {
    Audio.init();
    Audio.bgm.stop(400);

    this.add.image(W / 2, H / 2, 'training_ground')
      .setDisplaySize(W, H)
      .setDepth(-20);

    this.physics.world.setBounds(34, 54, W - 68, H - 100);
    this.obstacles = this.physics.add.staticGroup();
    this.dummies = [];
    DUMMIES.forEach((spec) => this.createDummy(spec));

    const useSwordHero = this.textures.exists('hero_sword');
    this.player = this.physics.add.sprite(W / 2, H - 175, useSwordHero ? 'hero_sword' : 'hero_hongfa', 0);
    this._useSwordHero = useSwordHero;
    this._heroAnimPrefix = useSwordHero ? 'hero_sword' : 'hero';
    if (useSwordHero) {
      this.player.setScale(0.43);
      this.player.body.setSize(52, 28).setOffset(46, 124);
    } else {
      this.player.setScale(1.05);
      this.player.body.setSize(22, 12).setOffset(21, 48);
    }
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(this.player.y);
    this.physics.add.collider(this.player, this.obstacles);

    this._playerDir = 'up';
    this._attackUntil = 0;
    this._cooldownUntil = 0;
    this._skillUntil = 0;
    this._skillCooldownUntil = 0;
    this._lastFacingX = 1;
    const idleUp = `${this._heroAnimPrefix}_idle_up`;
    if (this.anims.exists(idleUp)) this.player.play(idleUp);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,J,U,E,ESC,SPACE');

    this.hud = this.add.text(18, 16, '训练场  WASD移动  J/空格攻击  U持刀技能  靠近下方门按E返回大厅', {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '14px',
      color: '#ffe9a6',
      backgroundColor: '#120b05cc',
      padding: { x: 10, y: 6 },
    }).setDepth(500);

    this.exitHint = this.add.text(W / 2, H - 46, 'E 返回大厅', {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '15px',
      color: '#fff4bf',
      backgroundColor: '#120b05dd',
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setDepth(500).setVisible(false);

    this.comboText = this.add.text(W - 22, 16, '命中 0', {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '14px',
      color: '#d8f7ff',
      backgroundColor: '#061114cc',
      padding: { x: 10, y: 6 },
    }).setOrigin(1, 0).setDepth(500);

    this._hits = 0;
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  createDummy(spec) {
    const c = this.add.container(spec.x, spec.y).setDepth(spec.y);
    const shadow = this.add.ellipse(0, 26, 58, 16, 0x000000, 0.28);
    const post = this.add.rectangle(0, 0, 18, 70, 0x8b5a2b).setStrokeStyle(2, 0x3b2415);
    const arms = this.add.rectangle(0, -16, 58, 10, 0x9b6834).setStrokeStyle(2, 0x3b2415);
    const head = this.add.circle(0, -44, 13, 0xb7803b).setStrokeStyle(2, 0x3b2415);
    const sash = this.add.rectangle(0, -8, 52, 5, 0xb6322a);
    const hpBg = this.add.rectangle(0, -66, 58, 5, 0x140a06, 0.9).setStrokeStyle(1, 0xcaa35a, 0.7);
    const hpBar = this.add.rectangle(-28, -66, 56, 3, 0x72e28a).setOrigin(0, 0.5);
    c.add([shadow, post, arms, head, sash, hpBg, hpBar]);

    const block = this.add.rectangle(spec.x, spec.y + 18, 38, 18, 0xff0000, 0);
    this.physics.add.existing(block, true);
    block.body.updateFromGameObject();
    this.obstacles.add(block);

    this.dummies.push({
      ...spec,
      hp: 5,
      maxHp: 5,
      container: c,
      hpBar,
      block,
    });
  }

  update(time) {
    if (!this.player || !this.player.body) return;

    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      this.returnToHub();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.J) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.tryAttack(time);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.U)) {
      this.tryBladeSkill(time);
    }

    const nearExit = this.player.y > H - 92 && Math.abs(this.player.x - W / 2) < 130;
    this.exitHint.setVisible(nearExit);
    if (nearExit && Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      this.returnToHub();
      return;
    }

    let vx = 0;
    let vy = 0;
    if (this.cursors.left.isDown || this.keys.A.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) vx += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) vy += 1;
    if (vx && vy) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }

    const attacking = time < this._attackUntil;
    const skillActive = time < this._skillUntil;
    const speed = skillActive ? PLAYER_SPEED * 0.12 : (attacking ? PLAYER_SPEED * 0.35 : PLAYER_SPEED);
    this.player.setVelocity(vx * speed, vy * speed);

    if (vx || vy) {
      if (Math.abs(vx) > Math.abs(vy)) this._playerDir = vx > 0 ? 'right' : 'left';
      else this._playerDir = vy > 0 ? 'down' : 'up';
      if (vx > 0) this._lastFacingX = 1;
      else if (vx < 0) this._lastFacingX = -1;
    }

    this.updatePlayerAnim(attacking || skillActive);
    this.player.setDepth(this.player.y);
  }

  updatePlayerAnim(attacking) {
    if (attacking) {
      const attackKey = this._useSwordHero
        ? `hero_sword_attack_${this._attackDir || this._playerDir}`
        : 'hero_attack';
      if (this.anims.exists(attackKey) &&
          (!this.player.anims.currentAnim || this.player.anims.currentAnim.key !== attackKey)) {
        this.player.play(attackKey, true);
      }
      this.player.setFlipX(!this._useSwordHero && this._playerDir !== 'left');
      return;
    }

    const moving = Math.abs(this.player.body.velocity.x) > 1 || Math.abs(this.player.body.velocity.y) > 1;
    const animDir = this._useSwordHero ? this._playerDir : (this._playerDir === 'left' ? 'right' : this._playerDir);
    const key = moving ? `${this._heroAnimPrefix}_walk_${animDir}` : `${this._heroAnimPrefix}_idle_${animDir}`;
    if (this.anims.exists(key) && (!this.player.anims.currentAnim || this.player.anims.currentAnim.key !== key)) {
      this.player.play(key);
    }
    this.player.setFlipX(!this._useSwordHero && this._playerDir === 'left');
  }

  tryAttack(time) {
    if (time < this._cooldownUntil) return;
    if (time < this._skillUntil) return;
    this._cooldownUntil = time + ATTACK_COOLDOWN;
    this._attackUntil = time + 210;
    this._attackDir = this._playerDir;

    const angle = dirToAngle(this._playerDir);
    const sx = this.player.x;
    const sy = this.player.y - 8;
    this.drawSlash(sx, sy, angle);

    let hitCount = 0;
    for (const d of this.dummies) {
      const dx = d.x - sx;
      const dy = (d.y - 18) - sy;
      const dist = Math.hypot(dx, dy);
      const diff = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - angle));
      if (dist <= ATTACK_RANGE && (diff <= ATTACK_ARC / 2 || dist < 36)) {
        this.hitDummy(d, angle);
        hitCount += 1;
      }
    }
    if (hitCount > 0) {
      this._hits += hitCount;
      this.comboText.setText(`命中 ${this._hits}`);
      this.cameras.main.shake(45, 0.0018);
    }
  }

  tryBladeSkill(time) {
    if (time < this._skillCooldownUntil || time < this._attackUntil) return;
    this._skillCooldownUntil = time + BLADE_SKILL_COOLDOWN;
    this._skillUntil = time + BLADE_SKILL_DURATION;

    const facingX = this._playerDir === 'left' ? -1 : (this._playerDir === 'right' ? 1 : this._lastFacingX);
    this._lastFacingX = facingX;
    this.playBladeSkillFx(facingX);
    if (Audio && Audio.sfx && Audio.sfx.slash) Audio.sfx.slash();
  }

  playBladeSkillFx(facingX) {
    const animKey = facingX > 0 ? 'hero_blade_skill_right_anim' : 'hero_blade_skill_anim';
    const texKey = facingX > 0 ? 'hero_blade_skill_right' : 'hero_blade_skill';
    if (!this.anims.exists(animKey)) return;
    if (this._bladeSkillSprite) this._bladeSkillSprite.destroy();

    this.player.setVisible(false);
    const playerFootY = this.player.y + this.player.displayHeight / 2;
    const baseFxX = this.player.x;
    const originX = this.getBladeSkillAnchorX(facingX) / BLADE_SKILL_FW;
    const fx = this.add.sprite(baseFxX, playerFootY, texKey, 0)
      .setOrigin(originX, BLADE_SKILL_ORIGIN_Y)
      .setScale(0.62)
      .setDepth(this.player.y + 2);
    fx.play(animKey);
    this._bladeSkillSprite = fx;

    const onFrame = (anim, frame) => {
      const frameIndex = Math.max(0, (frame && frame.index ? frame.index - 1 : 0));
      fx.setScale(frameIndex < 4 || frameIndex === 10 ? 0.62 : 0.48);
      fx.x = baseFxX + this.getBladeSkillFrameXOffset(frameIndex, facingX) * fx.scaleX;
      fx.y = playerFootY + this.getBladeSkillFrameYOffset(frameIndex);
      this.resolveBladeSkillFrameHit(fx, frameIndex, facingX);
    };
    fx.on(Phaser.Animations.Events.ANIMATION_UPDATE, onFrame);
    this.resolveBladeSkillFrameHit(fx, 0, facingX);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      fx.off(Phaser.Animations.Events.ANIMATION_UPDATE, onFrame);
      if (this._bladeSkillSprite === fx) this._bladeSkillSprite = null;
      if (this.player && this.player.active) {
        const endRect = this.getBladeSkillFrameRect(10, facingX);
        const originPx = this.getBladeSkillAnchorX(facingX);
        const finalScale = 0.62;
        const finalX = fx.x + ((endRect.ax || originPx) - originPx) * finalScale;
        const finalFootY = playerFootY + this.getBladeSkillFrameYOffset(10);
        this.player.setPosition(finalX, finalFootY - this.player.displayHeight / 2);
        this.player.setVisible(true);
      }
      if (fx && fx.active) fx.destroy();
    };
    fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, cleanup);
    this.time.delayedCall(BLADE_SKILL_DURATION + 160, cleanup);
  }

  getBladeSkillAnchorX(facingX) {
    return facingX > 0 ? BLADE_SKILL_FW - BLADE_SKILL_LEFT_ANCHOR_X : BLADE_SKILL_LEFT_ANCHOR_X;
  }

  getBladeSkillFrameRect(frameIndex, facingX) {
    const r = BLADE_SKILL_FRAME_RECTS[Math.max(0, Math.min(frameIndex, BLADE_SKILL_FRAME_RECTS.length - 1))];
    if (facingX <= 0) return r;
    return {
      x: BLADE_SKILL_FW - r.x - r.w,
      y: r.y,
      w: r.w,
      h: r.h,
      ax: BLADE_SKILL_FW - r.ax,
    };
  }

  getBladeSkillHitRect(frameIndex, facingX) {
    const r = BLADE_SKILL_HIT_RECTS[Math.max(0, Math.min(frameIndex, BLADE_SKILL_HIT_RECTS.length - 1))];
    if (!r) return null;
    if (facingX <= 0) return r;
    return {
      x: BLADE_SKILL_FW - r.x - r.w,
      y: r.y,
      w: r.w,
      h: r.h,
    };
  }

  getBladeSkillFrameYOffset(frameIndex) {
    return BLADE_SKILL_FRAME_Y_OFFSETS[Math.max(0, Math.min(frameIndex, BLADE_SKILL_FRAME_Y_OFFSETS.length - 1))] || 0;
  }

  getBladeSkillFrameXOffset(frameIndex, facingX) {
    const x = BLADE_SKILL_FRAME_X_OFFSETS[Math.max(0, Math.min(frameIndex, BLADE_SKILL_FRAME_X_OFFSETS.length - 1))] || 0;
    return facingX > 0 ? -x : x;
  }

  getBladeSkillWorldRect(fx, frameIndex, facingX, useHitRect = false) {
    const r = useHitRect
      ? this.getBladeSkillHitRect(frameIndex, facingX)
      : this.getBladeSkillFrameRect(frameIndex, facingX);
    if (!r) return null;
    const s = fx.scaleX;
    const ox = this.getBladeSkillAnchorX(facingX);
    const oy = BLADE_SKILL_FH * BLADE_SKILL_ORIGIN_Y;
    const x0 = fx.x + (r.x - ox) * s;
    const x1 = fx.x + (r.x + r.w - ox) * s;
    const y0 = fx.y + (r.y - oy) * s;
    const y1 = fx.y + (r.y + r.h - oy) * s;
    return new Phaser.Geom.Rectangle(Math.min(x0, x1), y0, Math.abs(x1 - x0), y1 - y0);
  }

  resolveBladeSkillFrameHit(fx, frameIndex, facingX) {
    const hitRect = this.getBladeSkillWorldRect(fx, frameIndex, facingX, true);
    if (!hitRect) return;
    const aim = facingX < 0 ? Math.PI : 0;
    let hitCount = 0;
    for (const d of this.dummies) {
      const targetRect = new Phaser.Geom.Rectangle(d.x - 26, d.y - 66, 52, 92);
      if (!Phaser.Geom.Rectangle.Overlaps(hitRect, targetRect)) continue;
      this.hitDummy(d, aim);
      hitCount += 1;
    }
    if (hitCount > 0) {
      this._hits += hitCount;
      this.comboText.setText(`命中 ${this._hits}`);
      this.cameras.main.shake(90, 0.003);
    }
  }

  hitDummy(dummy, angle) {
    dummy.hp = Math.max(0, dummy.hp - 1);
    dummy.hpBar.width = 56 * (dummy.hp / dummy.maxHp);
    if (dummy.hp === 0) {
      dummy.hp = dummy.maxHp;
      this.time.delayedCall(180, () => {
        dummy.hpBar.width = 56;
      });
    }

    this.tweens.add({
      targets: dummy.container,
      x: dummy.x + Math.cos(angle) * 6,
      y: dummy.y + Math.sin(angle) * 4,
      duration: 55,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    this.spawnHitSpark(dummy.x, dummy.y - 22);
  }

  drawSlash(x, y, angle) {
    const g = this.add.graphics().setDepth(420);
    const start = angle - ATTACK_ARC / 2;
    const end = angle + ATTACK_ARC / 2;
    g.lineStyle(14, 0x2da9ff, 0.35);
    g.beginPath();
    g.arc(x, y, ATTACK_RANGE * 0.72, start, end);
    g.strokePath();
    g.lineStyle(6, 0xbef6ff, 0.78);
    g.beginPath();
    g.arc(x, y, ATTACK_RANGE * 0.82, start + 0.06, end - 0.06);
    g.strokePath();
    g.lineStyle(2, 0xffffff, 0.9);
    g.beginPath();
    g.arc(x, y, ATTACK_RANGE * 0.9, start + 0.12, end - 0.12);
    g.strokePath();

    this.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 150,
      onComplete: () => g.destroy(),
    });
  }

  spawnHitSpark(x, y) {
    for (let i = 0; i < 6; i++) {
      const p = this.add.rectangle(x, y, 4, 2, 0xfff1a1).setDepth(430);
      const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const d = Phaser.Math.Between(12, 28);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        alpha: 0,
        duration: 180,
        onComplete: () => p.destroy(),
      });
    }
  }

  returnToHub() {
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('HubScene');
    });
  }
}
