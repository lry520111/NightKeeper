// 守卫 AI - 夜行者：归藏
// 巡逻 / 视野扇形 / 警觉值 / 视线遮挡 / 追击
import Phaser from 'phaser';

// ——— 视野参数 ———
const VIEW_RANGE = 150;          // 视野距离（像素）
const VIEW_HALF_ANGLE = Math.PI / 6; // 视野半角（30° → 总60°）
const TURN_SPEED = 3.2;          // 朝向转动速度（弧度/秒）
const PATROL_SPEED = 50;         // 巡逻速度
const CHASE_SPEED = 110;         // 追击速度
const WAIT_AT_WAYPOINT_MS = 900; // 路径点停顿
const ALERT_FILL_RATE = 65;      // 每秒警觉值（满 100）
const ALERT_DECAY_RATE = 25;     // 每秒衰减
const ALERT_FULL = 100;
const ALERT_SUSPICIOUS = 1;      // 大于 0 即视为可疑（>0 显示黄锥）

// 颜色（视野锥）
const COLOR_GREEN = 0x6bcf6b;
const COLOR_YELLOW = 0xf2c14e;
const COLOR_RED = 0xe54b4b;

// ——— 战斗参数 ———
const GUARD_MAX_HP = 2;          // 普通近战需 2 刀
const GUARD_STAGGER_MS = 380;    // 被打中硬直
const ATTACK_RANGE = 26;         // 守卫攻击距离
const ATTACK_WINDUP_MS = 700;    // 蓄力时间
const ATTACK_HIT_HALF_ANGLE = Math.PI / 5; // 守卫挥刀扇形半角 36°
const ATTACK_COOLDOWN_MS = 1100; // 出招后冷却

export default class Guard {
  /**
   * @param {Phaser.Scene} scene
   * @param {{x:number,y:number}[]} waypoints  世界坐标
   */
  constructor(scene, waypoints) {
    this.scene = scene;
    this.waypoints = waypoints;
    this.wpIdx = 0;
    this.alert = 0;
    this.state = 'patrol'; // patrol | suspicious | chase
    this.prevState = 'patrol';
    this.waitUntil = 0;
    this.chaseUntil = 0;
    this.onStateChange = null; // (newState, oldState, guard) => void

    // —— 战斗状态 ——
    this.hp = GUARD_MAX_HP;
    this.dead = false;
    this.staggerUntil = 0;        // 硬直结束时间
    this.attackPhase = 'idle';    // idle | windup | recover
    this.attackPhaseUntil = 0;    // 当前阶段结束时间
    this.attackedThisSwing = false; // 本次挥刀是否已结算命中
    this.onHitPlayer = null;      // (guard) => void
    this.onWindupStart = null;    // (guard) => void  用于警报音效

    // —— 行走帧切换 ——
    this._walkPhase = 0;
    this._walkAccum = 0;
    this._lastX = 0;
    this._lastY = 0;

    const start = waypoints[0];
    this.sprite = scene.physics.add.sprite(start.x, start.y, 'tex_guard');
    this.sprite.setCollideWorldBounds(true);
    this.sprite.body.setSize(12, 18).setOffset(2, 4);
    this.sprite.setDepth(5);

    // 朝向（弧度）：初始指向第二个点
    const next = waypoints[1] || { x: start.x + 1, y: start.y };
    this.facing = Math.atan2(next.y - start.y, next.x - start.x);

    // —— 视野锥渲染 ——
    this.coneGfx = scene.add.graphics();
    this.coneGfx.setDepth(4); // 在墙之上、玩家之下

    // 守卫提灯光晕（在光照系统中读取）
    this.lightKey = 'tex_light_guard';

    this._lastX = start.x;
    this._lastY = start.y;
  }

  destroy() {
    this.sprite.destroy();
    this.coneGfx.destroy();
    if (this.windupGfx) this.windupGfx.destroy();
  }

  // —— 玩家攻击造成伤害 ——
  takeDamage(amount, knockX = 0, knockY = 0) {
    if (this.dead) return false;
    this.hp -= amount;
    this.staggerUntil = this.scene.time.now + GUARD_STAGGER_MS;
    // 击退
    if (this.sprite.body) {
      this.sprite.setVelocity(knockX * 120, knockY * 120);
    }
    // 闪红
    this.sprite.setTint(0xff5555);
    this.scene.time.delayedCall(160, () => {
      if (this.sprite && !this.dead) this.sprite.clearTint();
    });
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    // 受击立即拉满警觉
    this.alert = ALERT_FULL;
    return false;
  }

  die() {
    this.dead = true;
    this.sprite.setTint(0x666666);
    this.sprite.setAlpha(0.55);
    if (this.sprite.body) {
      this.sprite.body.setVelocity(0, 0);
      this.sprite.body.enable = false;
    }
    this.coneGfx.clear();
    if (this.windupGfx) this.windupGfx.clear();
    if (typeof this.onStateChange === 'function') {
      this.onStateChange('dead', this.state, this);
    }
  }

  // —— 主更新 ——
  update(dt, player, walls) {
    if (!this.sprite.active || this.dead) return false;

    const seePlayer = this.canSee(player, walls);

    // —— 警觉值变化 ——
    if (seePlayer) {
      // 距离越近、玩家越在锥心 → 增速越快
      const dx = player.x - this.sprite.x;
      const dy = player.y - this.sprite.y;
      const dist = Math.hypot(dx, dy);
      const distFactor = Phaser.Math.Clamp(1 - dist / VIEW_RANGE, 0.2, 1);
      // 玩家潜行时减半（Shift）
      const sneak = this.scene.keys && this.scene.keys.SHIFT.isDown ? 0.45 : 1;
      this.alert = Math.min(ALERT_FULL, this.alert + ALERT_FILL_RATE * distFactor * sneak * dt);
    } else {
      this.alert = Math.max(0, this.alert - ALERT_DECAY_RATE * dt);
    }

    // —— 状态切换 ——
    const oldState = this.state;
    if (this.alert >= ALERT_FULL) {
      this.state = 'chase';
      this.chaseUntil = this.scene.time.now + 4000; // 进入追击 4 秒
    } else if (this.alert > ALERT_SUSPICIOUS) {
      // 看不到时按追击逻辑保留惯性，看到则进入怀疑
      if (seePlayer) this.state = 'suspicious';
    } else if (this.state !== 'chase' || this.scene.time.now > this.chaseUntil) {
      this.state = 'patrol';
    }
    if (this.state !== oldState) {
      if (typeof this.onStateChange === 'function') {
        this.onStateChange(this.state, oldState, this);
      }
      this.prevState = oldState;
    }

    // —— 硬直期间不行动 ——
    const inStagger = this.scene.time.now < this.staggerUntil;

    // —— 行为 ——
    if (inStagger) {
      // 硬直：保留击退速度，逐渐衰减
      this.sprite.setVelocity(this.sprite.body.velocity.x * 0.85, this.sprite.body.velocity.y * 0.85);
    } else if (this.state === 'chase') {
      this.behaviorChase(dt, player);
    } else if (this.state === 'suspicious') {
      this.behaviorSuspicious(dt, player);
    } else {
      this.behaviorPatrol(dt);
    }

    // —— 视野锥渲染 ——
    this.drawCone();

    // —— 攻击蓄力提示渲染 ——
    this.drawWindup();

    // —— 行走帧切换（依据实际位移） ——
    this.updateWalkFrame(dt);

    // 接触致死保留：贴脸即抓
    return this.touchPlayer(player);
  }

  updateWalkFrame(dt) {
    if (this.dead) return;
    const moved = Math.hypot(this.sprite.x - this._lastX, this.sprite.y - this._lastY);
    this._lastX = this.sprite.x;
    this._lastY = this.sprite.y;
    if (moved > 0.4) {
      this._walkAccum += dt;
      const stepTime = this.state === 'chase' ? 0.10 : 0.22;
      if (this._walkAccum >= stepTime) {
        this._walkAccum = 0;
        this._walkPhase = 1 - this._walkPhase;
        this.sprite.setTexture(this._walkPhase ? 'tex_guard_walk' : 'tex_guard');
      }
      this.sprite.setFlipX(Math.cos(this.facing) < 0);
    } else if (this._walkPhase !== 0) {
      this._walkPhase = 0;
      this._walkAccum = 0;
      this.sprite.setTexture('tex_guard');
    }
  }

  // —— 巡逻：往下一路径点走，停顿，再下一点 ——
  behaviorPatrol(dt) {
    const now = this.scene.time.now;
    if (now < this.waitUntil) {
      this.sprite.setVelocity(0, 0);
      // 停顿时缓慢左右扫视
      this.facing += Math.sin(now / 380) * 0.025;
      return;
    }
    const target = this.waypoints[this.wpIdx];
    const dx = target.x - this.sprite.x;
    const dy = target.y - this.sprite.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) {
      this.sprite.setVelocity(0, 0);
      this.waitUntil = now + WAIT_AT_WAYPOINT_MS;
      this.wpIdx = (this.wpIdx + 1) % this.waypoints.length;
      return;
    }
    const ang = Math.atan2(dy, dx);
    this.facing = this.lerpAngle(this.facing, ang, TURN_SPEED * dt);
    this.sprite.setVelocity(Math.cos(this.facing) * PATROL_SPEED, Math.sin(this.facing) * PATROL_SPEED);
  }

  // —— 怀疑：站定，朝玩家方向转过去，但暂不移动 ——
  behaviorSuspicious(dt, player) {
    this.sprite.setVelocity(0, 0);
    const ang = Math.atan2(player.y - this.sprite.y, player.x - this.sprite.x);
    this.facing = this.lerpAngle(this.facing, ang, TURN_SPEED * 1.4 * dt);
  }

  // —— 追击：向玩家方向冲，进入攻击距离则蓄力出刀 ——
  behaviorChase(dt, player) {
    const now = this.scene.time.now;
    const dx = player.x - this.sprite.x;
    const dy = player.y - this.sprite.y;
    const dist = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);

    // 攻击状态机
    if (this.attackPhase === 'windup') {
      // 蓄力：站定，朝向玩家
      this.sprite.setVelocity(0, 0);
      this.facing = this.lerpAngle(this.facing, ang, TURN_SPEED * 1.4 * dt);
      if (now >= this.attackPhaseUntil) {
        // 挥刀结算（一次扇形检测）
        this.attackPhase = 'recover';
        this.attackPhaseUntil = now + 220; // 收招
        this.tryHitPlayer(player);
      }
      return;
    }
    if (this.attackPhase === 'recover') {
      this.sprite.setVelocity(0, 0);
      if (now >= this.attackPhaseUntil) {
        this.attackPhase = 'idle';
        this.attackPhaseUntil = now + ATTACK_COOLDOWN_MS; // 进入冷却
      }
      return;
    }
    // idle / cooldown
    if (now >= this.attackPhaseUntil && dist <= ATTACK_RANGE) {
      // 进入蓄力
      this.attackPhase = 'windup';
      this.attackPhaseUntil = now + ATTACK_WINDUP_MS;
      this.attackedThisSwing = false;
      this.sprite.setVelocity(0, 0);
      if (typeof this.onWindupStart === 'function') {
        this.onWindupStart(this);
      }
      return;
    }
    // 普通追击移动
    this.facing = this.lerpAngle(this.facing, ang, TURN_SPEED * 1.8 * dt);
    this.sprite.setVelocity(Math.cos(this.facing) * CHASE_SPEED, Math.sin(this.facing) * CHASE_SPEED);
  }

  // —— 守卫挥刀命中判定 ——
  tryHitPlayer(player) {
    if (this.attackedThisSwing) return;
    this.attackedThisSwing = true;
    const dx = player.x - this.sprite.x;
    const dy = player.y - this.sprite.y;
    const dist = Math.hypot(dx, dy);
    if (dist > ATTACK_RANGE + 6) return;
    const ang = Math.atan2(dy, dx);
    const diff = Math.abs(Phaser.Math.Angle.Wrap(ang - this.facing));
    if (diff > ATTACK_HIT_HALF_ANGLE) return;
    // 通知场景结算（玩家可能格挡）
    if (typeof this.onHitPlayer === 'function') {
      this.onHitPlayer(this);
    }
  }

  // —— 蓄力提示：扇形红色警示 ——
  drawWindup() {
    if (!this.windupGfx) {
      this.windupGfx = this.scene.add.graphics();
      this.windupGfx.setDepth(6);
    }
    const g = this.windupGfx;
    g.clear();
    if (this.attackPhase !== 'windup') return;
    const now = this.scene.time.now;
    const total = ATTACK_WINDUP_MS;
    const left = Math.max(0, this.attackPhaseUntil - now);
    const t = 1 - left / total; // 0→1
    const cx = this.sprite.x;
    const cy = this.sprite.y;
    // 扇形充能
    g.fillStyle(0xff3030, 0.28 + 0.25 * t);
    g.beginPath();
    g.moveTo(cx, cy);
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const a = this.facing - ATTACK_HIT_HALF_ANGLE + (ATTACK_HIT_HALF_ANGLE * 2) * k;
      g.lineTo(cx + Math.cos(a) * ATTACK_RANGE, cy + Math.sin(a) * ATTACK_RANGE);
    }
    g.closePath();
    g.fillPath();
    // 边线随充能加深
    g.lineStyle(1.5, 0xff5050, 0.55 + 0.4 * t);
    g.strokePath();
  }

  // —— 视线检测：扇形 + 射线遮挡 ——
  canSee(player, walls) {
    const dx = player.x - this.sprite.x;
    const dy = player.y - this.sprite.y;
    const dist = Math.hypot(dx, dy);
    if (dist > VIEW_RANGE) return false;

    const ang = Math.atan2(dy, dx);
    const diff = Math.abs(Phaser.Math.Angle.Wrap(ang - this.facing));
    if (diff > VIEW_HALF_ANGLE) return false;

    // 射线 vs 墙体（用墙的 AABB 求交）
    return !this.rayHitsWall(this.sprite.x, this.sprite.y, player.x, player.y, walls);
  }

  rayHitsWall(x1, y1, x2, y2, walls) {
    if (!walls) return false;
    const line = new Phaser.Geom.Line(x1, y1, x2, y2);
    const arr = walls.getChildren();
    for (const w of arr) {
      const b = w.body;
      if (!b) continue;
      const rect = new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height);
      if (Phaser.Geom.Intersects.LineToRectangle(line, rect)) return true;
    }
    return false;
  }

  // —— \u8d34\u8eab\u63a5\u89e6\uff08\u5b88\u536b\u62b5\u8fd1\u73a9\u5bb6\uff09\uff1a
  // \u4ec5\u5728 chase \u72b6\u6001\u4e0b\u751f\u6548\uff0c\u907f\u514d\u5de1\u903b\u4e2d\u4e0d\u5c0f\u5fc3\u649e\u5230\u4e5f\u88ab\u5224\u5b9a\u4e3a\u88ab\u6293
  touchPlayer(player) {
    if (this.state !== 'chase') return false;
    if (this.scene.time.now < this.staggerUntil) return false;
    return Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, player.x, player.y) < 14;
  }

  // —— 玩家是否在守卫背后（90°内）——
  isPlayerBehind(player) {
    const dx = player.x - this.sprite.x;
    const dy = player.y - this.sprite.y;
    const ang = Math.atan2(dy, dx);
    const diff = Math.abs(Phaser.Math.Angle.Wrap(ang - (this.facing + Math.PI)));
    return diff < Math.PI / 4;
  }

  // —— 视野锥绘制 ——
  drawCone() {
    const g = this.coneGfx;
    g.clear();

    let color = COLOR_GREEN;
    let alpha = 0.16;
    if (this.state === 'chase') {
      color = COLOR_RED;
      alpha = 0.32;
    } else if (this.alert > ALERT_SUSPICIOUS) {
      color = COLOR_YELLOW;
      alpha = 0.22 + 0.12 * (this.alert / ALERT_FULL);
    }

    // 锥面（扇形）
    g.fillStyle(color, alpha);
    g.beginPath();
    const cx = this.sprite.x;
    const cy = this.sprite.y;
    g.moveTo(cx, cy);
    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = this.facing - VIEW_HALF_ANGLE + (VIEW_HALF_ANGLE * 2) * t;
      g.lineTo(cx + Math.cos(a) * VIEW_RANGE, cy + Math.sin(a) * VIEW_RANGE);
    }
    g.closePath();
    g.fillPath();

    // 锥边线（深一点）
    g.lineStyle(1, color, Math.min(0.7, alpha + 0.25));
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(this.facing - VIEW_HALF_ANGLE) * VIEW_RANGE, cy + Math.sin(this.facing - VIEW_HALF_ANGLE) * VIEW_RANGE);
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(this.facing + VIEW_HALF_ANGLE) * VIEW_RANGE, cy + Math.sin(this.facing + VIEW_HALF_ANGLE) * VIEW_RANGE);
    g.strokePath();
  }

  // —— 工具：角度插值 ——
  lerpAngle(a, b, t) {
    const diff = Phaser.Math.Angle.Wrap(b - a);
    return a + diff * Math.min(1, t);
  }

  // —— 给光照系统的提灯位置 ——
  getLightInfo() {
    return { x: this.sprite.x, y: this.sprite.y, key: this.lightKey, alpha: 0.8 };
  }

  // —— 给 HUD 显示警觉条用 ——
  getAlertRatio() {
    return this.alert / ALERT_FULL;
  }
}
