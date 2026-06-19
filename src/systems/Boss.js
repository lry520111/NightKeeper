// Boss.js — Boss 实体（最终关卡）
// 状态机：idle → chase → telegraph → skill → recover → idle
// 三个技能：
//   skill1 近战横扫（短距离 / 大角度 / 高伤害）
//   skill2 突进重击（中距离 / 直线冲刺 / 中伤害）
//   skill3 范围爆裂（中近距 / 圆形 AoE / 高伤害）
// 资源：boss_idle / boss_walk_{dir} / boss_skill1|2|3（由 BootScene 注册）

import Phaser from 'phaser';

// 由于 idle / walk / skill 三套贴图源尺寸不同（idle 289x352, walk ~159x198,
// skill ~189~232 x 220~227），如果统一用同一个 scale 系数会出现
// "放技能时缩小、待机时变大" 的视觉抖动。改为：所有动画都按
// "目标渲染高度" 动态反算 scale，保证 boss 在屏幕上的高度恒定。
// BOSS_TARGET_H 取原 idle 待机时的视觉高（289x352 * 0.34 ≈ 120px），
// 以待机作为玩家心目中的 "正常大小" 基准，整体显得更具压迫感。
const BOSS_TARGET_H = 120;
const BOSS_MAX_HP = 24;
const BOSS_BODY_W = 72;
const BOSS_BODY_H = 48;
const BOSS_BODY_OY = 132;         // 与脚部贴合
const BOSS_BODY_OX = 96;

const SPEED_CHASE = 95;

// 技能配置（毫秒）
//   tellMs   : 蓄力提示时长（玩家可看清并躲开）
//   activeFr : 命中帧索引（10 帧动画 0~9，命中只在该帧产生）
//   recoverMs: 招式硬直
const SKILLS = {
  skill1: { range: 110, halfArc: Math.PI * 0.55, damage: 1, tellMs: 380, activeFr: [4, 5, 6], recoverMs: 620, knock: 200 },
  skill2: { range: 360, halfWidth: 64,           damage: 2, tellMs: 460, activeFr: [3, 4, 5, 6], recoverMs: 720, knock: 320, dash: 320 },
  skill3: { range: 170, damage: 2,                tellMs: 600, activeFr: [5, 6, 7],   recoverMs: 820, knock: 260 },
};

const ENGAGE_RANGE = 420;   // 进入战斗距离
const PREFERRED_DIST = 130; // 偏好攻击距离
const SKILL_PICK_INTERVAL = 1300;

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
    // 每次动画切帧后重新套用统一 scale —— 因为不同帧的 sourceImage 尺寸可能不同
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, () => this._applyUniformScale());
    this.sprite.on(Phaser.Animations.Events.ANIMATION_START,  () => this._applyUniformScale());

    // —— HP 条 ——
    this.hpBg = scene.add.rectangle(x, y - 110, 90, 8, 0x000000, 0.7).setStrokeStyle(1, 0xc8324a, 0.9).setDepth(900);
    this.hpBar = scene.add.rectangle(x - 44, y - 110, 88, 4, 0xff4458).setOrigin(0, 0.5).setDepth(901);
    this.nameTag = scene.add.text(x, y - 124, '影 鸦  ·  夜 鸢', {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '14px',
      color: '#ffd2d8',
      stroke: '#240608',
      strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(901);

    // —— Telegraph 提示图形（蓄力时绘制范围） ——
    this.telegraph = scene.add.graphics().setDepth(800);
    this.telegraph.setVisible(false);

    // —— 状态机 ——
    this.state = 'idle';
    this.dir = 'down';
    this.facingX = -1;
    this._stateUntil = 0;
    this._nextThinkAt = 0;
    this._activeSkill = null;
    this._skillFx = null;          // 技能动画精灵
    this._skillHitFrames = new Set();
    this._skillStartXY = null;
    this._skillTargetXY = null;
    this._skillFacingX = -1;
    this._lastDamageTime = 0;
    this._invulnUntil = 0;
  }

  // ——— 让所有动画状态保持一致的渲染高度 ———
  // 不同贴图源尺寸不同：idle 289x352, walk ~159x198, skill ~189~232 x 220~227
  // 通过反算 scale = 目标高 / 当前帧 sourceImage 高，让 boss 在屏幕上的视觉高度恒定。
  _applyUniformScale() {
    if (!this.sprite || !this.sprite.frame) return;
    // Phaser 中 frame.height = 当前帧贴图的真实像素高（对单图 spritesheet 等价于图片高）
    const h = this.sprite.frame.height;
    if (!h) return;
    const s = BOSS_TARGET_H / h;
    this.sprite.setScale(s);
  }

  // ——— 朝向计算 ———
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

  // ——— 主循环 ———
  update(dtSec, player) {
    if (this.dead || !this.sprite || !this.sprite.body) return;
    const now = this.scene.time.now;
    const sx = this.sprite.x;
    const sy = this.sprite.y;
    const px = player ? player.x : sx;
    const py = player ? player.y : sy;
    const dist = Phaser.Math.Distance.Between(sx, sy, px, py);

    // 持续刷新 HUD
    this.hpBg.setPosition(sx, sy - 110);
    this.hpBar.setPosition(sx - 44, sy - 110);
    this.hpBar.width = 88 * Math.max(0, this.hp / this.maxHp);
    this.nameTag.setPosition(sx, sy - 124);
    this.sprite.setDepth(sy);

    // 状态切换
    if (this.state === 'telegraph' && now >= this._stateUntil) {
      this._enterSkillState();
    } else if (this.state === 'skill') {
      this._tickSkill(player);
    } else if (this.state === 'recover' && now >= this._stateUntil) {
      this.state = 'idle';
      this.telegraph.clear(); this.telegraph.setVisible(false);
    } else if (this.state === 'idle' || this.state === 'chase') {
      // 距离过远→idle；进入战斗范围→ chase；接近偏好距离→开始技能选择
      if (!player || dist > ENGAGE_RANGE) {
        this.state = 'idle';
        this.sprite.setVelocity(0, 0);
        this._playLoop('boss_idle');
      } else if (dist > PREFERRED_DIST) {
        this.state = 'chase';
        this._faceTo(px, py);
        const ang = Math.atan2(py - sy, px - sx);
        this.sprite.setVelocity(Math.cos(ang) * SPEED_CHASE, Math.sin(ang) * SPEED_CHASE);
        this._playLoop(`boss_walk_${this.dir}`);
        if (now >= this._nextThinkAt && dist < ENGAGE_RANGE * 0.9) {
          this._nextThinkAt = now + SKILL_PICK_INTERVAL;
        }
      } else {
        // 进入近距：选择技能
        this.sprite.setVelocity(0, 0);
        this._faceTo(px, py);
        this._playLoop('boss_idle');
        if (now >= this._nextThinkAt) {
          this._beginTelegraph(player);
          this._nextThinkAt = now + SKILL_PICK_INTERVAL;
        }
      }
    }
  }

  // ——— 蓄力（玩家可看见即将释放的技能范围） ———
  _beginTelegraph(player) {
    if (!player) return;
    // 根据距离选择不同技能
    const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, player.x, player.y);
    let skillId;
    if (dist < 95) skillId = 'skill1';
    else if (dist < 200) skillId = 'skill3';
    else skillId = 'skill2';
    // 加随机性
    if (Math.random() < 0.25) {
      const pool = ['skill1', 'skill2', 'skill3'];
      skillId = pool[Math.floor(Math.random() * pool.length)];
    }

    this._activeSkill = skillId;
    this._skillFacingX = (player.x >= this.sprite.x) ? 1 : -1;
    this._skillStartXY = { x: this.sprite.x, y: this.sprite.y };
    this._skillTargetXY = { x: player.x, y: player.y };
    this.state = 'telegraph';
    this._stateUntil = this.scene.time.now + SKILLS[skillId].tellMs;
    this.sprite.setVelocity(0, 0);
    this._playLoop('boss_idle');
    this._drawTelegraph(skillId);
  }

  _drawTelegraph(skillId) {
    const g = this.telegraph;
    g.clear(); g.setVisible(true);
    const sx = this.sprite.x;
    const sy = this.sprite.y - 14;
    const facing = this._skillFacingX;
    if (skillId === 'skill1') {
      const cfg = SKILLS.skill1;
      const ang0 = facing > 0 ? -cfg.halfArc : Math.PI - cfg.halfArc;
      const ang1 = facing > 0 ? cfg.halfArc : Math.PI + cfg.halfArc;
      g.fillStyle(0xff4458, 0.18); g.lineStyle(2, 0xff6478, 0.85);
      g.beginPath(); g.moveTo(sx, sy);
      g.arc(sx, sy, cfg.range, ang0, ang1); g.closePath();
      g.fillPath(); g.strokePath();
    } else if (skillId === 'skill2') {
      const cfg = SKILLS.skill2;
      const w = cfg.range, h = cfg.halfWidth * 2;
      const x0 = facing > 0 ? sx : sx - w;
      g.fillStyle(0xff4458, 0.16); g.lineStyle(2, 0xff6478, 0.85);
      g.fillRect(x0, sy - cfg.halfWidth, w, h);
      g.strokeRect(x0, sy - cfg.halfWidth, w, h);
    } else {
      const cfg = SKILLS.skill3;
      g.fillStyle(0xff4458, 0.18); g.lineStyle(2, 0xff6478, 0.85);
      g.fillCircle(sx, sy, cfg.range);
      g.strokeCircle(sx, sy, cfg.range);
    }
  }

  _enterSkillState() {
    const skillId = this._activeSkill;
    if (!skillId) { this.state = 'idle'; return; }
    this.state = 'skill';
    this._skillHitFrames = new Set();

    // 切换到技能动画（覆盖在精灵上）
    const animKey = `boss_${skillId}`;
    if (this.scene.anims.exists(animKey)) {
      this.sprite.play(animKey);
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        this._endSkill();
      });
    } else {
      this.scene.time.delayedCall(400, () => this._endSkill());
    }

    // skill2 突进
    if (skillId === 'skill2') {
      const cfg = SKILLS.skill2;
      const sx = this.sprite.x;
      const sy = this.sprite.y;
      const tx = this._skillTargetXY.x;
      const ty = this._skillTargetXY.y;
      const ang = Math.atan2(ty - sy, tx - sx);
      const dashDist = cfg.dash;
      this.scene.tweens.add({
        targets: this.sprite,
        x: sx + Math.cos(ang) * dashDist,
        y: sy + Math.sin(ang) * dashDist,
        duration: 420,
        ease: 'Cubic.easeOut',
      });
    }
  }

  _tickSkill(player) {
    if (!this.sprite || !this.sprite.anims) return;
    const cur = this.sprite.anims.currentFrame;
    if (!cur) return;
    const idx = cur.index - 1; // 0-based
    const cfg = SKILLS[this._activeSkill];
    if (cfg.activeFr.indexOf(idx) >= 0 && !this._skillHitFrames.has(idx)) {
      this._skillHitFrames.add(idx);
      this._tryHitPlayer(this._activeSkill, player);
    }
  }

  _tryHitPlayer(skillId, player) {
    if (!player || !player.body) return;
    if (typeof this.scene.applyBossDamageToPlayer !== 'function') return;
    const sx = this.sprite.x;
    const sy = this.sprite.y;
    const px = player.x;
    const py = player.y;
    const cfg = SKILLS[skillId];

    let hit = false;
    if (skillId === 'skill1') {
      const dist = Phaser.Math.Distance.Between(sx, sy, px, py);
      if (dist <= cfg.range) {
        const ang = Math.atan2(py - sy, px - sx);
        const baseAng = this._skillFacingX > 0 ? 0 : Math.PI;
        if (Math.abs(Phaser.Math.Angle.Wrap(ang - baseAng)) <= cfg.halfArc) hit = true;
      }
    } else if (skillId === 'skill2') {
      // 矩形（前方 cfg.range × 2*halfWidth）
      const facing = this._skillFacingX;
      const x0 = facing > 0 ? sx : sx - cfg.range;
      const rect = new Phaser.Geom.Rectangle(x0, sy - cfg.halfWidth, cfg.range, cfg.halfWidth * 2);
      if (rect.contains(px, py)) hit = true;
    } else if (skillId === 'skill3') {
      const dist = Phaser.Math.Distance.Between(sx, sy, px, py);
      if (dist <= cfg.range) hit = true;
    }
    if (hit) {
      const dx = px - sx, dy = py - sy;
      const len = Math.hypot(dx, dy) || 1;
      const kx = dx / len * cfg.knock;
      const ky = dy / len * cfg.knock;
      this.scene.applyBossDamageToPlayer(cfg.damage, kx, ky, skillId);
    }
  }

  _endSkill() {
    this.state = 'recover';
    this._stateUntil = this.scene.time.now + (SKILLS[this._activeSkill] || {}).recoverMs || 500;
    this._activeSkill = null;
    this.telegraph.clear(); this.telegraph.setVisible(false);
    if (this.scene.anims.exists('boss_idle')) this.sprite.play('boss_idle');
  }

  // ——— 受击 ———
  takeDamage(amount, knockX = 0, knockY = 0) {
    if (this.dead) return false;
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this._invulnUntil = now + 80;
    this.hp = Math.max(0, this.hp - amount);
    this._lastDamageTime = now;

    // 受击闪烁
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.sprite && !this.dead) this.sprite.clearTint();
    });

    // 击退（受蓄力/技能限制）
    if (this.state !== 'skill' && this.state !== 'telegraph') {
      this.sprite.body.setVelocity(knockX, knockY);
      this.scene.time.delayedCall(120, () => {
        if (this.sprite && this.sprite.body && !this.dead) this.sprite.body.setVelocity(0, 0);
      });
    }

    if (this.hp <= 0) {
      this._die();
      return true;
    }
    return false;
  }

  _die() {
    this.dead = true;
    this.sprite.setVelocity(0, 0);
    this.telegraph.clear(); this.telegraph.setVisible(false);
    if (this.scene.anims.exists('boss_idle')) this.sprite.play('boss_idle');
    this.scene.tweens.add({
      targets: [this.sprite, this.hpBar, this.hpBg, this.nameTag],
      alpha: 0,
      duration: 1200,
      ease: 'Sine.easeIn',
      onComplete: () => {
        if (typeof this.scene.onBossDefeated === 'function') {
          this.scene.onBossDefeated();
        }
      },
    });
  }

  destroy() {
    if (this.sprite) this.sprite.destroy();
    if (this.hpBg) this.hpBg.destroy();
    if (this.hpBar) this.hpBar.destroy();
    if (this.nameTag) this.nameTag.destroy();
    if (this.telegraph) this.telegraph.destroy();
  }
}
