// Boss.js — 最终关卡 Boss 实体
// 设计：四个技能循环释放；技能释放中和收招后的短时间霸体，其余时间可被打断进 hurt。

import Phaser from 'phaser';

const BOSS_TARGET_H = 120;
const BOSS_MAX_HP = 24;
const BOSS_BODY_W = 72;
const BOSS_BODY_H = 48;
const BOSS_BODY_OX = 96;
const BOSS_BODY_OY = 132;

const SPEED_CHASE = 82;
const ENGAGE_RANGE = 520;
const PREFERRED_DIST = 190;
const POST_SKILL_ARMOR_MS = 3200;
const THINK_AFTER_ARMOR_MS = 1200;
const HURT_LOCK_MS = 380;
const HURT_MAX_HITS = 3;
const HURT_BRITTLE_MS = 3200;
const MAX_SKILL_SAFETY_MS = 8000;

const SKILLS = {
  skill1: {
    tellMs: 560,
    recoverMs: 680,
    damage: 1,
    projectileSpeed: 486,        // 540 / (10f / 9fps) ≈ 3/4 地图高度
    projectileLife: 1300,        // 略大于动画时长（10帧/9fps ≈ 1.11s）
    hitRadius: 48,               // 增大判定圈匹配剑气视觉
    knock: 210,
    waveCount: 3,
    waveInterval: 220,
    cloneCount: 2,
    cloneCrescentCount: 3,
  },
  skill2: {
    tellMs: 520,
    recoverMs: 760,
    damage: 2,
    teleportFrame: 2,
    hitFrames: [2, 3, 4, 5, 6],
    radius: 122,
    knock: 280,
  },
  skill3: {
    tellMs: 720,
    recoverMs: 1000,
    damage: 1,
    soulCount: 5,
    soulHp: 3,
    soulHealInterval: 2200,
    soulHealAmount: 1,
    cloneRadius: 240,
    knock: 235,
  },
  skill4: {
    tellMs: 620,
    recoverMs: 900,
    damage: 2,
    waves: 7,
    intervalMs: 315,
    warningMs: 520,
    ellipseW: 240,
    ellipseH: 126,
    knock: 300,
  },
  skill5: {
    tellMs: 780,
    recoverMs: 900,
    damage: 2,
    doppelHp: 3,
    doppelSpeed: 110,
    doppelAttackRange: 60,
    doppelAttackCd: 900,
    knock: 240,
  },
};

const clamp = Phaser.Math.Clamp;

export default class Boss {
  constructor(scene, x, y) {
    this.scene = scene;
    this.dead = false;
    this.maxHp = BOSS_MAX_HP;
    this.hp = BOSS_MAX_HP;

    this.sprite = scene.physics.add.sprite(x, y, 'boss_idle_1');
    this._applyUniformScale();
    this.sprite.body.setSize(BOSS_BODY_W, BOSS_BODY_H).setOffset(BOSS_BODY_OX, BOSS_BODY_OY);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(this.sprite.y);
    if (scene.anims.exists('boss_idle')) this.sprite.play('boss_idle');

    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, () => this._applyUniformScale());
    this.sprite.on(Phaser.Animations.Events.ANIMATION_START, () => this._applyUniformScale());

    // 投射物组，统一管理重叠检测
    this._projectileGroup = scene.physics.add.group({ allowGravity: false });
    scene.physics.add.overlap(this._projectileGroup, scene.player, (proj, player) => {
      if (!proj.active || proj._spent || this.dead) return;
      const data = proj.getData('boss_data');
      if (!data) return;
      proj._spent = true;
      this._damagePlayer(data.amount, data.kx, data.ky, data.hitKey);
      proj.destroy();
    });

    const uiW = scene.scale && scene.scale.width ? scene.scale.width : 1280;
    if (scene.textures.exists('ui_boss_hp')) {
      this._fixedBossHud = true;
      this._bossHpMaxWidth = 520;
      this.hpBg = scene.add.rectangle(uiW / 2 - this._bossHpMaxWidth / 2, 53, this._bossHpMaxWidth, 10, 0x100610, 0.9)
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(1999);
      this.hpBar = scene.add.rectangle(uiW / 2 - this._bossHpMaxWidth / 2, 53, this._bossHpMaxWidth, 10, 0xb03cff, 0.95)
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(2001);
      this.hpFrame = scene.add.image(uiW / 2, 52, 'ui_boss_hp')
        .setOrigin(0.5)
        .setDisplaySize(620, 65)
        .setScrollFactor(0)
        .setDepth(2000);
      this.nameTag = scene.add.text(uiW / 2, 23, '影鸦 · 夜鸢', {
        fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
        fontSize: '16px',
        color: '#ffd2d8',
        stroke: '#240608',
        strokeThickness: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2002);
    } else {
      this.hpBg = scene.add.rectangle(x, y - 110, 90, 8, 0x000000, 0.7)
        .setStrokeStyle(1, 0xc8324a, 0.9)
        .setDepth(900);
      this.hpBar = scene.add.rectangle(x - 44, y - 110, 88, 4, 0xff4458)
        .setOrigin(0, 0.5)
        .setDepth(901);
      this.nameTag = scene.add.text(x, y - 124, '影鸦 · 夜鸢', {
        fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
        fontSize: '14px',
        color: '#ffd2d8',
        stroke: '#240608',
        strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(901);
    }

    this.telegraph = scene.add.graphics().setDepth(800);
    this.telegraph.setVisible(false);

    this.state = 'idle';
    this.dir = 'down';
    this.facingX = -1;
    this._stateUntil = 0;
    this._nextThinkAt = scene.time.now + 650;
    this._activeSkill = null;
    this._skillOrder = ['skill1', 'skill2', 'skill3', 'skill4', 'skill5'];
    this._skillCursor = 0;
    this._skillFacingX = -1;
    this._skillTargetXY = { x, y };
    this._skillHitFrames = new Set();
    this._skillTimers = [];
    this._skillObjects = [];
    this._telegraphTimer = null;
    this._armorUntil = 0;
    this._invulnUntil = 0;
    this._armorFlashUntil = 0;
    this._hurtCount = 0;
    this._hurtBrittleUntil = 0;
    this._lastSkillEnteredAt = 0;
    this._skillFired = false;

    // 魂系统（技能三）
    this._souls = [];
    this._soulHealTimer = null;

    // 残影分身系统（技能五）
    this._doppelganger = null;

    this._uiFaded = false;
  }

  _applyUniformScale() {
    if (!this.sprite || !this.sprite.frame || !this.sprite.frame.height) return;
    this.sprite.setScale(BOSS_TARGET_H / this.sprite.frame.height);
  }

  _faceTo(tx, ty) {
    const dx = tx - this.sprite.x;
    const dy = ty - this.sprite.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      this.dir = dx >= 0 ? 'right' : 'left';
      this.facingX = dx >= 0 ? 1 : -1;
    } else {
      this.dir = dy >= 0 ? 'down' : 'up';
    }
  }

  _playLoop(key) {
    if (!this.scene.anims.exists(key)) return;
    const cur = this.sprite.anims.currentAnim;
    if (!cur || cur.key !== key) this.sprite.play(key, true);
  }

  update(dtSec, player) {
    if (this.dead || !this.sprite || !this.sprite.body) return;

    const now = this.scene.time.now;

    // 更新魂和残影分身（只要没死就一直运行）
    this._updateSouls(now);
    this._updateDoppelganger(now, player);

    // 手动检测圆形剑气碰撞（Phaser overlap 在 group.create 下不稳定）
    this._checkCrescentCollisions(player);

    const sx = this.sprite.x;
    const sy = this.sprite.y;
    const px = player ? player.x : sx;
    const py = player ? player.y : sy;
    const dist = Phaser.Math.Distance.Between(sx, sy, px, py);

    this._syncHud(now);

    if (this.state === 'hurt') {
      this.sprite.setVelocity(0, 0);
      if (now >= this._stateUntil) {
        this.state = 'idle';
        this._nextThinkAt = Math.max(this._nextThinkAt, now + 400);
        this._playLoop('boss_idle');
      }
      return;
    }

    if (now < this._hurtBrittleUntil) {
      // 受击脆断期间不会进入 telegraph，只移动/idle
    }

    if (this.state === 'telegraph') {
      if (now >= this._stateUntil) {
        this._enterSkillState(player);
      }
      // 看门狗：telegraph 超过安全时间强制恢复
      if (now - this._lastSkillEnteredAt > MAX_SKILL_SAFETY_MS) {
        this._forceRecover();
      }
      return;
    }

    if (this.state === 'skill') {
      // 看门狗：技能超过安全时间强制恢复
      if (now - this._lastSkillEnteredAt > MAX_SKILL_SAFETY_MS) {
        this._forceRecover();
      }
      return;
    }

    if (this.state === 'recover' && now >= this._stateUntil) {
      this.state = 'idle';
      this._playLoop('boss_idle');
    }

    if (!player || dist > ENGAGE_RANGE) {
      this.state = 'idle';
      this.sprite.setVelocity(0, 0);
      this._playLoop('boss_idle');
      return;
    }

    this._faceTo(px, py);
    if (now >= this._nextThinkAt && dist < ENGAGE_RANGE * 0.95) {
      this.sprite.setVelocity(0, 0);
      this._beginTelegraph(player);
      return;
    }

    if (dist > PREFERRED_DIST) {
      this.state = 'chase';
      const ang = Math.atan2(py - sy, px - sx);
      this.sprite.setVelocity(Math.cos(ang) * SPEED_CHASE, Math.sin(ang) * SPEED_CHASE);
      this._playLoop(`boss_walk_${this.dir}`);
    } else {
      this.state = 'idle';
      this.sprite.setVelocity(0, 0);
      this._playLoop('boss_idle');
    }
  }

  _syncHud(now) {
    const sx = this.sprite.x;
    const sy = this.sprite.y;
    if (this._fixedBossHud) {
      this.hpBar.width = this._bossHpMaxWidth * Math.max(0, this.hp / this.maxHp);
      this.hpBar.fillColor = this._isArmored(now) ? 0x875dff : 0xd941ff;
      this.nameTag.setColor(this._isArmored(now) ? '#cdb7ff' : '#ffd2d8');
      this.sprite.setDepth(sy);
      return;
    }
    this.hpBg.setPosition(sx, sy - 110);
    this.hpBar.setPosition(sx - 44, sy - 110);
    this.hpBar.width = 88 * Math.max(0, this.hp / this.maxHp);
    this.nameTag.setPosition(sx, sy - 124);
    this.nameTag.setColor(this._isArmored(now) ? '#cdb7ff' : '#ffd2d8');
    this.sprite.setDepth(sy);
  }

  _beginTelegraph(player) {
    if (this.scene.time.now < this._hurtBrittleUntil) return;
    const now = this.scene.time.now;
    const skillId = this._skillOrder[this._skillCursor % this._skillOrder.length];
    this._skillCursor += 1;

    // 如果场上有魂，有一定概率先瞬移到魂的位置再放技能（瞬移攻击替代本次技能）
    if (this._souls.some(s => s.alive) && Math.random() < 0.35) {
      this._tryTeleportToSoul(player);
      return;
    }

    this._activeSkill = skillId;
    this._skillFacingX = player.x >= this.sprite.x ? 1 : -1;
    this._skillTargetXY = { x: player.x, y: player.y };
    this._skillHitFrames = new Set();
    this.state = 'telegraph';
    this._lastSkillEnteredAt = now;
    this._skillFired = false;
    this._stateUntil = now + SKILLS[skillId].tellMs;
    this.sprite.setVelocity(0, 0);
    this._playLoop('boss_idle');
    this._drawTelegraph(skillId);

    if (this._telegraphTimer && this._telegraphTimer.remove) this._telegraphTimer.remove(false);
    this._telegraphTimer = this.scene.time.delayedCall(SKILLS[skillId].tellMs + 60, () => {
      if (this.dead || this.state !== 'telegraph' || this._activeSkill !== skillId) return;
      this._enterSkillState(this.scene.player);
    });
  }

  _drawTelegraph(skillId) {
    const g = this.telegraph;
    g.clear();
    g.setVisible(true);
    const sx = this.sprite.x;
    const sy = this.sprite.y - 18;

    g.lineStyle(2, 0xff7a8a, 0.8);
    g.fillStyle(0xff4458, 0.13);
    if (skillId === 'skill1') {
      // 环形剑气 + 分身标记
      g.strokeCircle(sx, sy, 210);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        g.lineBetween(sx, sy, sx + Math.cos(a) * 210, sy + Math.sin(a) * 210);
      }
    } else if (skillId === 'skill2') {
      g.fillCircle(this._skillTargetXY.x, this._skillTargetXY.y, SKILLS.skill2.radius);
      g.strokeCircle(this._skillTargetXY.x, this._skillTargetXY.y, SKILLS.skill2.radius);
    } else if (skillId === 'skill3') {
      // 魂阵：大范围预警圈
      g.lineStyle(2, 0x9b6dff, 0.75);
      g.strokeCircle(sx, sy, SKILLS.skill3.cloneRadius);
      g.fillStyle(0x7c55ff, 0.08);
      g.fillCircle(sx, sy, SKILLS.skill3.cloneRadius);
    } else if (skillId === 'skill5') {
      // 残影召唤：暗紫色预警
      g.lineStyle(2, 0x6644cc, 0.75);
      g.fillStyle(0x5533aa, 0.12);
      g.fillCircle(sx, sy, 160);
      g.strokeCircle(sx, sy, 160);
    } else {
      g.strokeCircle(this._skillTargetXY.x, this._skillTargetXY.y, 170);
      g.lineStyle(1, 0xff9a9a, 0.55);
      g.strokeCircle(this._skillTargetXY.x, this._skillTargetXY.y, 110);
    }
  }

  _enterSkillState(player) {
    const skillId = this._activeSkill;
    if (!skillId) {
      this.state = 'idle';
      return;
    }

    this.state = 'skill';
    this._lastSkillEnteredAt = this.scene.time.now;
    this._skillFired = false;
    if (this._telegraphTimer && this._telegraphTimer.remove) {
      this._telegraphTimer.remove(false);
      this._telegraphTimer = null;
    }
    // 清理上次技能残留的计时器和物件（不清理魂和残影，它们独立存在）
    for (const timer of this._skillTimers) {
      if (timer && timer.remove) timer.remove(false);
    }
    this._skillTimers.length = 0;
    // 只销毁临时技能物件，保留魂/残影
    const soulSprites = new Set(this._souls.map(s => s.sprite));
    const dgSprite = this._doppelganger ? this._doppelganger.sprite : null;
    for (const obj of this._skillObjects) {
      if (obj && obj.destroy && obj !== dgSprite && !soulSprites.has(obj)) {
        obj.destroy();
      }
    }
    this._skillObjects.length = 0;
    this._skillHitFrames = new Set();
    this.telegraph.clear();
    this.telegraph.setVisible(false);
    this.sprite.setVelocity(0, 0);

    if (skillId === 'skill1') this._castSkill1(player);
    else if (skillId === 'skill2') this._castSkill2(player);
    else if (skillId === 'skill3') this._castSkill3(player);
    else if (skillId === 'skill5') this._castSkill5(player);
    else this._castSkill4(player);
  }

  _castSkill1(player) {
    const cfg = SKILLS.skill1;
    this._playBossAnim('boss_skill1', () => this._endSkill());

    // 3 波环形剑气，从 Boss 自身发出
    for (let w = 0; w < cfg.waveCount; w++) {
      this._addTimer(w * cfg.waveInterval, () => {
        if (this.dead) return;
        for (let i = 0; i < 8; i++) {
          this._spawnCrescentProjectile(i * Math.PI / 4, this.sprite.x, this.sprite.y - 38);
        }
      });
    }

    // 在地图别的位置生成 2 个分身，向玩家释放剑气
    this._addTimer(cfg.waveInterval * cfg.waveCount + 120, () => {
      if (this.dead) return;
      this._spawnSkill1Clones(player);
    });
  }

  _spawnSkill1Clones(player) {
    const cfg = SKILLS.skill1;
    for (let c = 0; c < cfg.cloneCount; c++) {
      const pos = this._pickSpawnPointFarFrom(player, 180, this.sprite.x, this.sprite.y, 200);
      // 分身标记
      const marker = this.scene.add.sprite(pos.x, pos.y, 'boss_death_6')
        .setOrigin(0.5)
        .setScale(0.8)
        .setAlpha(0.7)
        .setTint(0x6644cc)
        .setDepth(pos.y + 10);
      this._skillObjects.push(marker);

      // 分身出现动画
      this.scene.tweens.add({
        targets: marker,
        alpha: 0.9,
        scaleX: 0.45,
        scaleY: 0.45,
        duration: 200,
        ease: 'Back.easeOut',
      });

      // 分身向玩家发射 3 颗剑气
      this._addTimer(220 + c * 70, () => {
        if (this.dead) return;
        for (let i = 0; i < cfg.cloneCrescentCount; i++) {
          const ang = Math.atan2(player.y - pos.y, player.x - pos.x) + (i - 1) * 0.22;
          this._spawnCrescentProjectile(ang, pos.x, pos.y);
        }
      });

      // 分身消散
      this._addTimer(380 + c * 70, () => {
        this.scene.tweens.add({
          targets: marker,
          alpha: 0,
          scaleX: 0,
          scaleY: 0,
          duration: 350,
          ease: 'Sine.easeIn',
          onComplete: () => { if (marker && marker.active) marker.destroy(); },
        });
      });
    }
  }

  _pickSpawnPointFarFrom(player, minDistFromPlayer, fx, fy, minDistFromBoss) {
    const bounds = this.scene.physics.world.bounds;
    let x, y;
    for (let tries = 0; tries < 20; tries++) {
      x = Phaser.Math.Between(bounds.x + 90, bounds.right - 90);
      y = Phaser.Math.Between(bounds.y + 90, bounds.bottom - 90);
      const dp = Phaser.Math.Distance.Between(x, y, player.x, player.y);
      const db = Phaser.Math.Distance.Between(x, y, fx, fy);
      if (dp >= minDistFromPlayer && db >= minDistFromBoss) return { x, y };
    }
    // 兜底：远离玩家的角落
    if (player.x > (bounds.x + bounds.right) / 2) x = bounds.x + 100;
    else x = bounds.right - 100;
    if (player.y > (bounds.y + bounds.bottom) / 2) y = bounds.y + 100;
    else y = bounds.bottom - 100;
    return { x, y };
  }

  _spawnCrescentProjectile(angle, originX, originY) {
    const cfg = SKILLS.skill1;
    const sx = (originX != null ? originX : this.sprite.x) + Math.cos(angle) * 28;
    const sy = (originY != null ? originY : this.sprite.y) + Math.sin(angle) * 20;
    const baseDepth = originY != null ? originY : this.sprite.y;
    const fx = this._projectileGroup.create(sx, sy, 'boss_crescent_1');
    if (!fx) return;

    // 视觉放大 + 面朝飞行方向
    fx.setOrigin(0.5)
      .setScale(0.85)
      .setRotation(angle)
      .setDepth(baseDepth + 8);

    // 播动画（不循环，播完即销毁）
    if (this.scene.anims.exists('boss_crescent')) {
      fx.play('boss_crescent');
      fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        if (fx && fx.active) fx.destroy();
      });
    }

    // 物理体：用略大的圆形判定，中心对齐精灵原点
    if (fx.body) {
      fx.body.setAllowGravity(false);
      const halfW = fx.width / 2;
      const halfH = fx.height / 2;
      fx.body.setCircle(cfg.hitRadius, Math.max(0, halfW - cfg.hitRadius), Math.max(0, halfH - cfg.hitRadius));
      fx.setVelocity(Math.cos(angle) * cfg.projectileSpeed, Math.sin(angle) * cfg.projectileSpeed);
      fx.body.enable = true;
    }

    fx.setData('boss_data', {
      amount: cfg.damage,
      kx: Math.cos(angle) * cfg.knock,
      ky: Math.sin(angle) * cfg.knock,
      hitKey: `skill1-${angle.toFixed(2)}-${Date.now()}`,
    });
    this._skillObjects.push(fx);
    // 保底定时销毁
    this._addTimer(cfg.projectileLife, () => {
      if (fx && fx.active) fx.destroy();
    });
  }

  /**
   * 手动检测圆形剑气与玩家的碰撞（替代不稳定的 Phaser group overlap）
   */
  _checkCrescentCollisions(player) {
    if (!player || !player.active || this.dead) return;
    const children = this._projectileGroup.getChildren();
    for (let i = children.length - 1; i >= 0; i--) {
      const fx = children[i];
      if (!fx || !fx.active || fx._spent) continue;
      const data = fx.getData && fx.getData('boss_data');
      if (!data) continue;
      const dx = fx.x - player.x;
      const dy = fx.y - player.y;
      const dist = Math.hypot(dx, dy);
      const hitRange = SKILLS.skill1.hitRadius + 32; // 玩家半宽约 32px
      if (dist < hitRange) {
        fx._spent = true;
        this._damagePlayer(data.amount, data.kx, data.ky, data.hitKey);
        fx.destroy();
      }
    }
  }

  _castSkill2(player) {
    this._skillHitFrames.clear();
    let teleported = false;
    const onFrame = (anim, frame) => {
      const fi = Math.max(0, (frame && frame.index ? frame.index - 1 : 0));
      if (!teleported && fi >= SKILLS.skill2.teleportFrame) {
        teleported = true;
        this._teleportNearPlayer(player);
      }
      if (SKILLS.skill2.hitFrames.includes(fi) && !this._skillHitFrames.has(fi)) {
        this._skillHitFrames.add(fi);
        this._tryCircleHit(SKILLS.skill2, this.sprite.x, this.sprite.y - 24, 'skill2');
      }
    };
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, onFrame);
    this._playBossAnim('boss_skill2', () => {
      this.sprite.off(Phaser.Animations.Events.ANIMATION_UPDATE, onFrame);
      this._endSkill();
    });
  }

  _teleportNearPlayer(player) {
    if (!player) return;
    const bounds = this.scene.physics.world.bounds;
    const facing = player.x >= this.sprite.x ? 1 : -1;
    const x = clamp(player.x - facing * 92, bounds.x + 80, bounds.right - 80);
    const y = clamp(player.y + 16, bounds.y + 90, bounds.bottom - 60);
    this.sprite.setPosition(x, y);
    this._faceTo(player.x, player.y);
    this._flashAt(x, y);
  }

  _castSkill3(player) {
    // 清理旧的魂
    this._clearAllSouls();
    const cfg = SKILLS.skill3;
    this._playBossAnim('boss_skill3', () => this._endSkill());
    this._addTimer(160, () => this._spawnSouls(player, cfg));
  }

  // ===================== 魂系统 =====================
  _spawnSouls(player, cfg) {
    if (this.dead) return;
    const cx = player ? player.x : this.sprite.x;
    const cy = player ? player.y : this.sprite.y;
    const bounds = this.scene.physics.world.bounds;

    // 生成魂时顺带给 boss 播一个小特效
    this._flashAt(this.sprite.x, this.sprite.y);

    for (let i = 0; i < cfg.soulCount; i++) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / cfg.soulCount);
      const x = clamp(cx + Math.cos(a) * cfg.cloneRadius, bounds.x + 80, bounds.right - 80);
      const y = clamp(cy + Math.sin(a) * cfg.cloneRadius, bounds.y + 90, bounds.bottom - 70);
      this._createSoul(x, y, i, cfg);
    }

    // 启动治疗定时器
    if (this._soulHealTimer && this._soulHealTimer.remove) this._soulHealTimer.remove(false);
    this._startSoulHealLoop(cfg);
  }

  _createSoul(x, y, index, cfg) {
    // 魂使用独立贴图 hun/1.png
    const texKey = this.scene.textures.exists('boss_soul_1') ? 'boss_soul_1' : 'boss_skill3_1';
    const soulSprite = this.scene.add.sprite(x, y, texKey)
      .setOrigin(0.5)
      .setScale(0.48)
      .setAlpha(0.82)
      .setDepth(y + 20);

    // 魂的物理碰撞体（用于玩家攻击）
    this.scene.physics.add.existing(soulSprite, false);
    if (soulSprite.body) {
      soulSprite.body.setCircle(30, Math.max(0, soulSprite.width / 2 - 30), Math.max(0, soulSprite.height / 2 - 30));
      soulSprite.body.setImmovable(true);
      soulSprite.body.setAllowGravity(false);
      soulSprite.body.enable = true;
    }

    // 悬停动画
    this.scene.tweens.add({
      targets: soulSprite,
      y: y - 8,
      duration: 1100 + index * 180,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 出现光效
    this._flashAt(x, y);

    const soul = {
      sprite: soulSprite,
      hp: cfg.soulHp,
      maxHp: cfg.soulHp,
      alive: true,
      flashTimer: 0,
    };
    this._souls.push(soul);
    // 魂不归 _skillObjects 管，以免被 _enterSkillState 误清
  }

  _startSoulHealLoop(cfg) {
    const tick = () => {
      if (this.dead) return;
      let anyAlive = false;
      for (const s of this._souls) {
        if (s.alive) {
          anyAlive = true;
          this._doBossHeal(cfg.soulHealAmount, s.sprite.x, s.sprite.y);
        }
      }
      if (anyAlive) {
        this._soulHealTimer = this.scene.time.delayedCall(cfg.soulHealInterval, tick);
      } else {
        this._soulHealTimer = null;
      }
    };
    this._soulHealTimer = this.scene.time.delayedCall(cfg.soulHealInterval, tick);
  }

  _doBossHeal(amount, fromX, fromY) {
    if (this.dead || this.hp >= this.maxHp) return;
    const healed = Math.min(amount, this.maxHp - this.hp);
    if (healed <= 0) return;
    this.hp += healed;

    // 治疗线特效：魂 → Boss
    const line = this.scene.add.graphics().setDepth(850);
    line.lineStyle(2, 0x88cc66, 0.55);
    line.lineBetween(fromX, fromY, this.sprite.x, this.sprite.y - 30);
    this.scene.tweens.add({
      targets: line,
      alpha: 0,
      duration: 500,
      onComplete: () => line.destroy(),
    });

    // Boss 治疗闪烁
    this.sprite.setTint(0xaaffaa);
    this.scene.time.delayedCall(150, () => {
      if (this.sprite && !this.dead) this.sprite.clearTint();
    });

    // 治疗数字
    if (typeof this.scene._spawnHitText === 'function') {
      this.scene._spawnHitText(this.sprite.x, this.sprite.y - 45, `+${healed}`);
    }
  }

  _updateSouls(now) {
    for (const s of this._souls) {
      if (!s.alive || !s.sprite || !s.sprite.active) continue;
      s.sprite.setDepth(s.sprite.y);
      // 受击闪白恢复
      if (s.flashTimer > 0 && now > s.flashTimer) {
        s.sprite.clearTint();
        s.flashTimer = 0;
      }
    }
    // 清理已销毁的魂对象
    this._souls = this._souls.filter(s => s.alive || (s.sprite && s.sprite.active));
  }

  _clearAllSouls() {
    if (this._soulHealTimer && this._soulHealTimer.remove) {
      this._soulHealTimer.remove(false);
      this._soulHealTimer = null;
    }
    for (const s of this._souls) {
      if (s.sprite && s.sprite.active) {
        this.scene.tweens.killTweensOf(s.sprite);
        s.sprite.destroy();
      }
    }
    this._souls.length = 0;
  }

  /**
   * Boss 瞬移到魂的位置，先预警再瞬移，1 秒后触发攻击动画
   */
  _tryTeleportToSoul(player) {
    const alive = this._souls.filter(s => s.alive && s.sprite && s.sprite.active);
    if (alive.length === 0) return false;
    const target = alive[Math.floor(Math.random() * alive.length)];

    // 进入 telegraph 状态（短暂）
    const now = this.scene.time.now;
    this.state = 'telegraph';
    this._activeSkill = 'teleport_soul'; // 特殊标记
    this._lastSkillEnteredAt = now;
    this._stateUntil = now + 9999999; // 防止自动进入 _enterSkillState
    this._skillFired = false;
    this.sprite.setVelocity(0, 0);
    this.telegraph.clear();
    this.telegraph.setVisible(false);

    // 阶段 1：在目标魂位置播预警动画（shunyi 1→2→3）
    this._playShunyiWarning(target.sprite.x, target.sprite.y, () => {
      if (this.dead) return;
      // 阶段 2：瞬移
      this._flashAt(this.sprite.x, this.sprite.y);
      this.sprite.setPosition(target.sprite.x, target.sprite.y - 16);
      this._faceTo(player.x, player.y);
      this._flashAt(target.sprite.x, target.sprite.y - 16);
      this.sprite.setVelocity(0, 0);

      // 进入 skill 状态
      this.state = 'skill';
      this._lastSkillEnteredAt = this.scene.time.now;

      // 阶段 3：1 秒后播放攻击动画（hun 4→5→6→7 / tele_attack）
      this._addTimer(1000, () => {
        if (this.dead) return;
        this._playTeleAttack(player);
      });
    });

    return true;
  }

  /**
   * 播放瞬移预警动画（shunyi 1→2→3 出现，4→5 消失）
   */
  _playShunyiWarning(x, y, onComplete) {
    const warnSprite = this.scene.add.sprite(x, y, 'boss_shunyi_1')
      .setOrigin(0.5)
      .setAlpha(0.85)
      .setDepth(y + 100);
    // 与 Boss 本体同缩放
    if (warnSprite.frame && warnSprite.frame.height) {
      warnSprite.setScale(BOSS_TARGET_H / warnSprite.frame.height);
    } else {
      warnSprite.setScale(0.7);
    }
    this._skillObjects.push(warnSprite);

    if (this.scene.anims.exists('boss_shunyi_appear')) {
      warnSprite.play('boss_shunyi_appear');
      warnSprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        // 播消失动画
        if (this.scene.anims.exists('boss_shunyi_fade')) {
          warnSprite.play('boss_shunyi_fade');
          warnSprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
            warnSprite.destroy();
            onComplete();
          });
        } else {
          warnSprite.destroy();
          onComplete();
        }
      });
    } else {
      // 无动画时的兜底：延迟后回调
      this._addTimer(800, () => {
        warnSprite.destroy();
        onComplete();
      });
    }
  }

  /**
   * 播放瞬移后攻击动画（hun/tele_attack 4 帧），带圆形命中检测
   */
  _playTeleAttack(player) {
    const cfg = SKILLS.skill2; // 复用 skill2 的伤害/范围/击退参数
    const sx = this.sprite.x;
    const sy = this.sprite.y;
    this._skillHitFrames = new Set();

    const atkSprite = this.scene.add.sprite(sx, sy, 'boss_tele_attack_1')
      .setOrigin(0.5)
      .setAlpha(0.9)
      .setDepth(sy + 30);
    // 与 Boss 本体同缩放
    if (atkSprite.frame && atkSprite.frame.height) {
      atkSprite.setScale(BOSS_TARGET_H / atkSprite.frame.height);
    } else {
      atkSprite.setScale(0.7);
    }
    this._skillObjects.push(atkSprite);

    if (this.scene.anims.exists('boss_tele_attack')) {
      // 逐帧命中检测
      const hitFrames = [0, 1, 2, 3]; // 所有帧都可命中
      let frameIndex = 0;
      const onFrame = () => {
        frameIndex += 1;
        if (hitFrames.includes(frameIndex - 1)) {
          this._tryCircleHit(cfg, sx, sy - 24, `tele_attack_${frameIndex}`);
        }
      };
      atkSprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, onFrame);
      atkSprite.play('boss_tele_attack');
      atkSprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        atkSprite.off(Phaser.Animations.Events.ANIMATION_UPDATE, onFrame);
        this.scene.tweens.add({
          targets: atkSprite,
          alpha: 0,
          scaleX: 0.3,
          scaleY: 0.3,
          duration: 350,
          onComplete: () => { if (atkSprite && atkSprite.active) atkSprite.destroy(); },
        });
        this._endSkill();
      });
    } else {
      // 兜底：延迟结束
      this._addTimer(600, () => {
        this.scene.tweens.add({
          targets: atkSprite,
          alpha: 0,
          duration: 350,
          onComplete: () => { if (atkSprite && atkSprite.active) atkSprite.destroy(); },
        });
        this._endSkill();
      });
    }
  }

  /**
   * 获取所有活着的魂精灵（供 BossRoomScene 碰撞检测）
   */
  getSoulSprites() {
    return this._souls.filter(s => s.alive && s.sprite && s.sprite.active).map(s => s.sprite);
  }

  /**
   * 伤害魂（由玩家攻击调用），返回是否成功命中
   */
  damageSoul(soulSprite) {
    const soul = this._souls.find(s => s.alive && s.sprite === soulSprite);
    if (!soul) return false;
    soul.hp -= 1;
    soul.flashTimer = this.scene.time.now + 120;
    soul.sprite.setTintFill(0xffffff);

    if (soul.hp <= 0) {
      this._destroySoulWithFx(soul);
    }
    return true;
  }

  _destroySoulWithFx(soul) {
    soul.alive = false;
    const sx = soul.sprite.x;
    const sy = soul.sprite.y;
    this.scene.tweens.killTweensOf(soul.sprite);
    soul.sprite.stop();
    soul.sprite.setVisible(false);
    if (soul.sprite.body) soul.sprite.body.enable = false;

    // 消失动画：使用 death-sprites 9.png 和 10.png
    const fx1 = this.scene.add.sprite(sx, sy, 'boss_death_9')
      .setOrigin(0.5).setScale(0.55).setAlpha(0.85).setDepth(sy + 30);
    const fx2 = this.scene.add.sprite(sx, sy - 4, 'boss_death_10')
      .setOrigin(0.5).setScale(0.55).setAlpha(0.7).setDepth(sy + 30);

    this.scene.tweens.add({
      targets: fx1,
      alpha: 0, scaleX: 0.2, scaleY: 0.2, y: sy - 18,
      duration: 450, ease: 'Sine.easeIn',
      onComplete: () => { if (fx1 && fx1.active) fx1.destroy(); },
    });
    this.scene.tweens.add({
      targets: fx2,
      alpha: 0, scaleX: 0.3, scaleY: 0.3, y: sy - 14,
      duration: 520, delay: 60, ease: 'Sine.easeIn',
      onComplete: () => { if (fx2 && fx2.active) fx2.destroy(); },
    });

    // 延迟销毁魂本体
    this.scene.time.delayedCall(480, () => {
      if (soul.sprite && soul.sprite.active) soul.sprite.destroy();
    });
  }

  // ===================== 残影分身系统（技能五） =====================
  _castSkill5(player) {
    const cfg = SKILLS.skill5;

    // 召唤时用的动画：death-sprites 6.png 光效
    const summonFx = this.scene.add.sprite(this.sprite.x, this.sprite.y, 'boss_death_6')
      .setOrigin(0.5)
      .setScale(0.1)
      .setAlpha(0.9)
      .setTint(0x7755cc)
      .setDepth(this.sprite.y + 30);
    this._skillObjects.push(summonFx);
    this.scene.tweens.add({
      targets: summonFx,
      scaleX: 1.4,
      scaleY: 1.4,
      alpha: 0,
      duration: 600,
      ease: 'Sine.easeOut',
      onComplete: () => { if (summonFx && summonFx.active) summonFx.destroy(); },
    });

    // Boss 播技能本身动画
    this._playBossAnim('boss_skill1', () => this._endSkill());

    // 延迟生成残影
    this._addTimer(350, () => {
      if (this.dead) return;
      this._createDoppelganger(player, cfg);
    });
  }

  _createDoppelganger(player, cfg) {
    // 清理旧残影
    this._destroyDoppelganger();

    // 残影在 Boss 附近出现
    const dx = player.x >= this.sprite.x ? -70 : 70;
    const spx = clamp(this.sprite.x + dx, 90, 1190);
    const spy = clamp(this.sprite.y + 30, 100, 600);

    // 使用玩家纹理的暗色版本
    const texKey = this.scene._useKnifeHero ? 'hero_knife' : 'hero_hongfa';
    const sprite = this.scene.physics.add.sprite(spx, spy, texKey, 0)
      .setOrigin(0.5)
      .setDepth(spy);
    if (this.scene._useKnifeHero) {
      sprite.setScale(0.265);
      sprite.body.setSize(86, 44).setOffset(85, 208);
    } else {
      sprite.setScale(1.05);
      sprite.body.setSize(22, 12).setOffset(21, 48);
    }
    sprite.setTint(0x5533aa);
    sprite.setAlpha(0.78);
    sprite.setCollideWorldBounds(true);

    // 初始方向
    const dir = player.x >= spx ? 'right' : 'left';

    // 出现闪效
    this._flashAt(spx, spy);

    // 播 idle 动画
    this._playDoppelAnim(this._getDoppelAnimKey('idle', dir));

    this._doppelganger = {
      sprite,
      hp: cfg.doppelHp,
      maxHp: cfg.doppelHp,
      alive: true,
      nextAttackAt: 0,
      flashTimer: 0,
      attacking: false,
      dir,
    };
    // 残影不归 _skillObjects 管，以免被 _enterSkillState 误清

    // 残影与玩家的碰撞伤害（加入攻击动画）
    this.scene.physics.add.overlap(sprite, player, () => {
      if (!this._doppelganger || !this._doppelganger.alive || this.dead) return;
      const dg = this._doppelganger;
      const now = this.scene.time.now;
      if (now < dg.nextAttackAt || dg.attacking) return;
      dg.nextAttackAt = now + cfg.doppelAttackCd;
      dg.attacking = true;
      dg.sprite.setVelocity(0, 0);
      this._playDoppelAnim(this._getDoppelAnimKey('attack', dg.dir), true);
      // 攻击动画完成后恢复
      this.scene.time.delayedCall(400, () => {
        if (dg && dg.alive) dg.attacking = false;
      });
      this._damagePlayer(cfg.damage, (player.x >= dg.sprite.x ? 1 : -1) * cfg.knock, -80, 'doppelganger');
    });
  }

  _updateDoppelganger(now, player) {
    const dg = this._doppelganger;
    if (!dg || !dg.alive || !dg.sprite || !dg.sprite.active || !player) return;

    // 攻击动画期间暂停移动
    if (dg.attacking) {
      dg.sprite.setVelocity(0, 0);
      dg.sprite.setDepth(dg.sprite.y);
      return;
    }

    // 追踪玩家
    const ang = Math.atan2(player.y - dg.sprite.y, player.x - dg.sprite.x);
    dg.sprite.setVelocity(Math.cos(ang) * SKILLS.skill5.doppelSpeed, Math.sin(ang) * SKILLS.skill5.doppelSpeed);
    dg.sprite.setDepth(dg.sprite.y);

    // 根据速度方向播放行走动画
    const vx = dg.sprite.body.velocity.x;
    const vy = dg.sprite.body.velocity.y;
    const speed = Math.hypot(vx, vy);
    if (speed > 10) {
      const newDir = Math.abs(vx) >= Math.abs(vy)
        ? (vx >= 0 ? 'right' : 'left')
        : (vy >= 0 ? 'down' : 'up');
      dg.dir = newDir;
      this._playDoppelAnim(this._getDoppelAnimKey('walk', dg.dir));
    } else {
      this._playDoppelAnim(this._getDoppelAnimKey('idle', dg.dir));
    }

    // 恢复闪白
    if (dg.flashTimer > 0 && now > dg.flashTimer) {
      dg.sprite.setTint(0x5533aa);
      dg.flashTimer = 0;
    }
  }

  _destroyDoppelganger() {
    if (!this._doppelganger) return;
    if (this._doppelganger.sprite && this._doppelganger.sprite.active) {
      this.scene.tweens.killTweensOf(this._doppelganger.sprite);
      this._doppelganger.sprite.destroy();
    }
    this._doppelganger = null;
  }

  /**
   * 获取残影分身的动画 key（根据当前英雄类型）
   */
  _getDoppelAnimKey(type, dir) {
    const useKnife = this.scene._useKnifeHero;
    if (useKnife) {
      return `hero_knife_${type}_${dir}`;
    }
    // hongfa 模式
    if (type === 'walk') return `hero_walk_${dir}`;
    if (type === 'idle') return `hero_idle_${dir}`;
    if (type === 'attack') return 'hero_attack'; // hongfa attack 不分方向，用 flipX
    return `hero_${type}_${dir}`;
  }

  /**
   * 为残影分身播放动画
   */
  _playDoppelAnim(key, force = false) {
    const dg = this._doppelganger;
    if (!dg || !dg.sprite || !dg.sprite.active) return;
    if (!this.scene.anims.exists(key)) return;
    const cur = dg.sprite.anims.currentAnim;
    if (!force && cur && cur.key === key) return;
    // hongfa 攻击动画需要用 flipX 来控制方向
    if (key === 'hero_attack') {
      dg.sprite.setFlipX(dg.dir === 'left');
    }
    dg.sprite.play(key, force ? false : true);
  }

  /**
   * 获取残影精灵（供 BossRoomScene 碰撞检测）
   */
  getDoppelgangerSprite() {
    if (this._doppelganger && this._doppelganger.alive && this._doppelganger.sprite && this._doppelganger.sprite.active) {
      return this._doppelganger.sprite;
    }
    return null;
  }

  /**
   * 伤害残影（由玩家攻击调用）
   */
  damageDoppelganger() {
    const dg = this._doppelganger;
    if (!dg || !dg.alive) return false;
    dg.hp -= 1;
    dg.flashTimer = this.scene.time.now + 130;
    dg.sprite.setTintFill(0xffffff);

    if (dg.hp <= 0) {
      // 残影被摧毁
      const sx = dg.sprite.x;
      const sy = dg.sprite.y;
      dg.alive = false;
      dg.sprite.setVelocity(0, 0);
      this._flashAt(sx, sy);

      this.scene.tweens.add({
        targets: dg.sprite,
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: 500,
        ease: 'Sine.easeIn',
        onComplete: () => {
          if (dg.sprite && dg.sprite.active) dg.sprite.destroy();
          this._doppelganger = null;
        },
      });
    }
    return true;
  }

  _castSkill4(player) {
    const cfg = SKILLS.skill4;
    this.sprite.setVisible(false);
    if (this.sprite.body) this.sprite.body.enable = false;
    this._flashAt(this.sprite.x, this.sprite.y);

    for (let i = 0; i < cfg.waves; i++) {
      this._addTimer(i * cfg.intervalMs, () => {
        if (this.dead) return;
        const p = this._pickShadowStrikePoint(player, i);
        this._warnAndStrike(p.x, p.y, i);
      });
    }

    const totalMs = (cfg.waves - 1) * cfg.intervalMs + cfg.warningMs + 520;
    this._addTimer(totalMs, () => {
      if (this.dead) return;
      const p = this._pickReappearPoint(player);
      this.sprite.setPosition(p.x, p.y);
      this.sprite.setVisible(true);
      if (this.sprite.body) this.sprite.body.enable = true;
      this._flashAt(p.x, p.y);
      this._endSkill();
    });
  }

  _pickShadowStrikePoint(player, wave) {
    const bounds = this.scene.physics.world.bounds;
    const baseX = player ? player.x : this.sprite.x;
    const baseY = player ? player.y : this.sprite.y;
    const angle = wave * 1.85;
    const radius = wave % 2 === 0 ? 80 : 165;
    const jitterX = Math.cos(angle) * radius + Phaser.Math.Between(-45, 45);
    const jitterY = Math.sin(angle) * radius * 0.65 + Phaser.Math.Between(-28, 28);
    return {
      x: clamp(baseX + jitterX, bounds.x + 130, bounds.right - 130),
      y: clamp(baseY + jitterY, bounds.y + 120, bounds.bottom - 100),
    };
  }

  _pickReappearPoint(player) {
    const bounds = this.scene.physics.world.bounds;
    const px = player ? player.x : this.sprite.x;
    const py = player ? player.y : this.sprite.y;
    const side = Phaser.Math.Between(0, 1) ? 1 : -1;
    return {
      x: clamp(px + side * 185, bounds.x + 90, bounds.right - 90),
      y: clamp(py + Phaser.Math.Between(-60, 60), bounds.y + 100, bounds.bottom - 70),
    };
  }

  _warnAndStrike(x, y, wave) {
    const cfg = SKILLS.skill4;
    const warn = this.scene.add.ellipse(x, y, cfg.ellipseW, cfg.ellipseH, 0xff9a9a, 0.2)
      .setStrokeStyle(2, 0xffb6b6, 0.8)
      .setDepth(760);
    this._skillObjects.push(warn);
    this.scene.tweens.add({ targets: warn, alpha: 0.42, yoyo: true, repeat: 2, duration: 120 });

    this._addTimer(cfg.warningMs, () => {
      if (warn && warn.active) warn.destroy();
      if (this.dead) return;
      const fx = this.scene.add.sprite(x, y, 'boss_shadow_dash_1')
        .setOrigin(0.5)
        .setScale(0.72)
        .setRotation(wave % 2 ? -0.18 : 0.18)
        .setDepth(y + 12);
      this._skillObjects.push(fx);
      const hitKey = `skill4-${wave}`;
      const onFrame = (anim, frame) => {
        const fi = Math.max(0, (frame && frame.index ? frame.index - 1 : 0));
        if (fi >= 3 && fi <= 6) this._tryEllipseHit(cfg, x, y, hitKey);
      };
      fx.on(Phaser.Animations.Events.ANIMATION_UPDATE, onFrame);
      fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        fx.off(Phaser.Animations.Events.ANIMATION_UPDATE, onFrame);
        fx.destroy();
      });
      if (this.scene.anims.exists('boss_shadow_dash')) fx.play('boss_shadow_dash');
    });
  }

  _playBossAnim(key, onComplete) {
    if (!this.sprite || !this.sprite.active) {
      onComplete();
      return;
    }
    if (!this.scene.anims.exists(key)) {
      this._addTimer(420, onComplete);
      return;
    }
    const anim = this.scene.anims.get(key);
    const frames = (anim && anim.frames) ? anim.frames.length : 10;
    const frameRate = (anim && anim.frameRate) ? anim.frameRate : 8;
    const fallbackMs = Math.ceil((frames / frameRate) * 1000) + 160;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE, finish);
      onComplete();
    };
    // 先注册事件再播放，避免竞态：动画瞬间完成时事件丢失
    this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE, finish);
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, finish);
    this.sprite.play(key, false);
    this._addTimer(fallbackMs, finish);
    // 兜底兜底：一旦主定时器没触发，用更长延时兜底
    this._addTimer(fallbackMs + 520, finish);
  }

  _tryCircleHit(cfg, x, y, hitKey) {
    const player = this.scene.player;
    if (!player || !player.active || this._skillHitFrames.has(hitKey)) return;
    const dist = Phaser.Math.Distance.Between(x, y, player.x, player.y);
    if (dist > cfg.radius) return;
    this._skillHitFrames.add(hitKey);
    const dx = player.x - x;
    const dy = player.y - y;
    const len = Math.hypot(dx, dy) || 1;
    this._damagePlayer(cfg.damage, dx / len * cfg.knock, dy / len * cfg.knock, hitKey);
  }

  _tryEllipseHit(cfg, x, y, hitKey) {
    const player = this.scene.player;
    if (!player || !player.active || this._skillHitFrames.has(hitKey)) return;
    const nx = (player.x - x) / (cfg.ellipseW / 2);
    const ny = (player.y - y) / (cfg.ellipseH / 2);
    if (nx * nx + ny * ny > 1) return;
    this._skillHitFrames.add(hitKey);
    const dx = player.x - x;
    const dy = player.y - y;
    const len = Math.hypot(dx, dy) || 1;
    this._damagePlayer(cfg.damage, dx / len * cfg.knock, dy / len * cfg.knock, hitKey);
  }

  _damagePlayer(amount, kx, ky, skillId) {
    if (typeof this.scene.applyBossDamageToPlayer === 'function') {
      this.scene.applyBossDamageToPlayer(amount, kx, ky, skillId);
    }
  }

  _endSkill() {
    if (this.dead) return;
    if (this._skillFired) return; // 防止重复 endSkill
    this._skillFired = true;
    const cfg = SKILLS[this._activeSkill] || { recoverMs: 500 };
    const now = this.scene.time.now;
    this.state = 'recover';
    this._stateUntil = now + cfg.recoverMs;
    this._activeSkill = null;
    this._armorUntil = now + POST_SKILL_ARMOR_MS;
    this._nextThinkAt = this._armorUntil + THINK_AFTER_ARMOR_MS;
    this._lastSkillEnteredAt = 0;
    // 清理残留技能计时器（物件自清理，避免过早销毁动画）
    for (const timer of this._skillTimers) {
      if (timer && timer.remove) timer.remove(false);
    }
    this._skillTimers.length = 0;
    if (this._telegraphTimer && this._telegraphTimer.remove) {
      this._telegraphTimer.remove(false);
      this._telegraphTimer = null;
    }
    this.telegraph.clear();
    this.telegraph.setVisible(false);
    if (this.sprite && this.sprite.body) this.sprite.body.enable = true;
    this.sprite.setVisible(true);
    this.sprite.off(Phaser.Animations.Events.ANIMATION_UPDATE);
    this.sprite.stop();
    this._playLoop('boss_idle');
  }

  takeDamage(amount, knockX = 0, knockY = 0) {
    if (this.dead) return false;
    const now = this.scene.time.now;

    // 霸体状态（telegraph/skill/recover）：仍然掉血，但不打断技能、不播 hurt 动画
    if (this._isArmored(now)) {
      if (now < this._invulnUntil) return false;
      this._invulnUntil = now + 120;
      this.hp = Math.max(0, this.hp - amount);
      this._flashArmor();
      // 显示伤害数字
      if (typeof this.scene._spawnHitText === 'function') {
        this.scene._spawnHitText(this.sprite.x, this.sprite.y - 45, `${-amount}`);
      }
      if (this.hp <= 0) {
        this._die();
      }
      return true;
    }

    if (now < this._invulnUntil) return false;
    if (now < this._hurtBrittleUntil) return false;

    // 连续受击计数：仍在 hurt 中再次被命中
    if (this.state === 'hurt') {
      this._hurtCount += 1;
      if (this._hurtCount >= HURT_MAX_HITS) {
        this._forceExitHurt();
        return true; // 伤害已结算，但立刻退出 hurt
      }
    }

    this._invulnUntil = now + 120;
    this.hp = Math.max(0, this.hp - amount);
    this._playHurt(knockX, knockY);

    if (this.hp <= 0) {
      this._die();
      return true;
    }
    return true;
  }

  _isArmored(now = this.scene.time.now) {
    return this.state === 'telegraph'
      || this.state === 'skill'
      || this.state === 'recover'
      || now < this._armorUntil;
  }

  _playHurt(knockX, knockY) {
    const now = this.scene.time.now;
    this.state = 'hurt';
    this._stateUntil = now + HURT_LOCK_MS;
    this._nextThinkAt = now + HURT_LOCK_MS + 700;
    this._hurtCount = 1;
    this.sprite.setVelocity(knockX, knockY);
    this.scene.time.delayedCall(110, () => {
      if (this.sprite && this.sprite.body && !this.dead) this.sprite.setVelocity(0, 0);
    });

    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => {
      if (this.sprite && !this.dead) this.sprite.clearTint();
    });
    if (this.scene.anims.exists('boss_hurt')) this.sprite.play('boss_hurt', true);
  }

  _forceExitHurt() {
    const now = this.scene.time.now;
    this.state = 'idle';
    this._stateUntil = 0;
    this._activeSkill = null;
    this._hurtBrittleUntil = now + HURT_BRITTLE_MS;
    this._nextThinkAt = this._hurtBrittleUntil + 400;
    this._hurtCount = 0;
    this.sprite.setVelocity(0, 0);
    this.sprite.clearTint();
    this.sprite.off(Phaser.Animations.Events.ANIMATION_UPDATE);
    this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE);
    this.sprite.stop();
    this.telegraph.clear();
    this.telegraph.setVisible(false);
    if (this.sprite && this.sprite.body) this.sprite.body.enable = true;
    this.sprite.setVisible(true);
    this._playLoop('boss_idle');
  }

  // 状态看门狗恢复：当技能卡死时，无条件清理所有计时器并回到 idle
  _forceRecover() {
    const now = this.scene.time.now;
    // 清理所有残留计时器和物件
    for (const timer of this._skillTimers) {
      if (timer && timer.remove) timer.remove(false);
    }
    this._skillTimers.length = 0;
    for (const obj of this._skillObjects) {
      if (obj && obj.destroy) obj.destroy();
    }
    this._skillObjects.length = 0;
    if (this._telegraphTimer && this._telegraphTimer.remove) {
      this._telegraphTimer.remove(false);
      this._telegraphTimer = null;
    }
    this._activeSkill = null;
    this._skillFired = false;
    this.state = 'idle';
    this._stateUntil = 0;
    this._lastSkillEnteredAt = 0;
    this._nextThinkAt = now + 450;
    this._armorUntil = 0;
    this._hurtBrittleUntil = 0;
    this.sprite.setVelocity(0, 0);
    this.sprite.clearTint();
    this.sprite.off(Phaser.Animations.Events.ANIMATION_UPDATE);
    this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE);
    this.telegraph.clear();
    this.telegraph.setVisible(false);
    if (this.sprite && this.sprite.body) this.sprite.body.enable = true;
    this.sprite.setVisible(true);
    this._playLoop('boss_idle');
  }

  _flashArmor() {
    const now = this.scene.time.now;
    if (now < this._armorFlashUntil) return;
    this._armorFlashUntil = now + 240;
    this.sprite.setTint(0x8a6cff);
    this.scene.time.delayedCall(90, () => {
      if (this.sprite && !this.dead) this.sprite.clearTint();
    });
  }

  _flashAt(x, y) {
    const g = this.scene.add.graphics().setDepth(y + 20);
    g.fillStyle(0x9b4dff, 0.32);
    g.fillCircle(x, y - 34, 36);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: 1.8,
      scaleY: 1.8,
      duration: 260,
      ease: 'Sine.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  _addTimer(delay, callback) {
    const timer = this.scene.time.delayedCall(delay, callback);
    this._skillTimers.push(timer);
    return timer;
  }

  _clearSkillRuntime() {
    if (this._telegraphTimer && this._telegraphTimer.remove) {
      this._telegraphTimer.remove(false);
      this._telegraphTimer = null;
    }
    for (const timer of this._skillTimers) {
      if (timer && timer.remove) timer.remove(false);
    }
    this._skillTimers.length = 0;
    for (const obj of this._skillObjects) {
      if (obj && obj.destroy) obj.destroy();
    }
    this._skillObjects.length = 0;
  }

  _die() {
    this.dead = true;
    this._clearSkillRuntime();
    this._clearAllSouls();
    this._destroyDoppelganger();
    this.sprite.setVisible(true);
    if (this.sprite.body) this.sprite.body.enable = true;
    this.sprite.setVelocity(0, 0);
    this.sprite.off(Phaser.Animations.Events.ANIMATION_UPDATE);
    this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE);
    this.sprite.stop();
    this.telegraph.clear();
    this.telegraph.setVisible(false);

    // 播放死亡动画（12 帧），动画结束后淡出 UI
    if (this.scene.anims.exists('boss_death')) {
      this.sprite.play('boss_death', false);
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        this.sprite.setAlpha(0);
        this._fadeOutUI();
      });
      // 兜底：2s 后强制淡出
      this.scene.time.delayedCall(2200, () => {
        if (this.sprite && this.sprite.active && this.sprite.alpha > 0.1) {
          this.sprite.stop();
          this.sprite.setAlpha(0);
          this._fadeOutUI();
        }
      });
    } else {
      // 无死亡动画时直接淡出
      if (this.scene.anims.exists('boss_hurt')) this.sprite.play('boss_hurt', true);
      this.scene.time.delayedCall(260, () => this._fadeOutUI());
    }
  }

  _fadeOutUI() {
    if (this._uiFaded) return;
    this._uiFaded = true;
    this.scene.tweens.add({
      targets: [this.hpBar, this.hpBg, this.nameTag],
      alpha: 0,
      duration: 800,
      ease: 'Sine.easeIn',
      onComplete: () => {
        if (typeof this.scene.onBossDefeated === 'function') {
          this.scene.onBossDefeated();
        }
      },
    });
  }

  destroy() {
    this._clearSkillRuntime();
    this._clearAllSouls();
    this._destroyDoppelganger();
    if (this.sprite) this.sprite.destroy();
    if (this.hpBg) this.hpBg.destroy();
    if (this.hpBar) this.hpBar.destroy();
    if (this.hpFrame) this.hpFrame.destroy();
    if (this.nameTag) this.nameTag.destroy();
    if (this.telegraph) this.telegraph.destroy();
  }
}
