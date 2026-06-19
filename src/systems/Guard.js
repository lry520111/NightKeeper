// 守卫 AI - 夜行者：归藏
// 巡逻 / 视野扇形 / 警觉值 / 视线遮挡 / 追击 + A* 寻路
import Phaser from 'phaser';
import { findPath, smoothPath, pixelToCell, cellToPixel, hasLineOfSight, nearestWalkable } from './Pathfinding.js';

// ——— 视野参数 ———
const VIEW_RANGE = 210;          // 视野距离（像素）— 看得更远
const VIEW_HALF_ANGLE = Math.PI / 5.2; // 视野半角（约 35° → 总 70°）— 视野更宽
const TURN_SPEED = 3.6;          // 朝向转动速度（弧度/秒）— 转头更快
const PATROL_SPEED = 52;         // 巡逻速度 — 放慢以减压
const CHASE_SPEED = 110;         // 追击速度 — 玩家有更多反应空间
const WAIT_AT_WAYPOINT_MS = 700; // 路径点停顿 — 停得更短
// ★ 警惕性增强：被探照灯照到后 ~0.4秒 触发 “被发现了”
const ALERT_FILL_RATE = 240;     // 每秒警觉值（满 100）— 锈心 ~0.42 秒满
const ALERT_DECAY_RATE = 18;     // 每秒衰减 — 一旦警觉，很难躲回
const ALERT_FULL = 100;
const ALERT_SUSPICIOUS = 1;      // 大于 0 即视为可疑（>0 显示黄锈）
const ALARM_RADIUS = 220;        // 警觉满后通知半径（像素）
const ALARM_ALERT_BUMP = 70;     // 联动友军被推到的警觉值（直接进入怀疑/追击）
// 颜色（视野锥）
const COLOR_GREEN = 0x6bcf6b;
const COLOR_YELLOW = 0xf2c14e;
const COLOR_RED = 0xe54b4b;

// ——— 战斗参数 ———
const GUARD_MAX_HP = 5;          // 普通近战需 5 刀（增强守卫耐久）
const GUARD_STAGGER_MS = 320;    // 被打中硬直 — 略缩短，避免无限连
const ATTACK_RANGE = 28;         // 守卫攻击距离
const ATTACK_WINDUP_MS = 560;    // 蓄力时间 — 出招更快
const ATTACK_HIT_HALF_ANGLE = Math.PI / 5; // 守卫挥刀扇形半角 36°
const ATTACK_COOLDOWN_MS = 850;  // 出招后冷却 — 攻击更频繁

// ——— A* 寻路参数 ———
const PATH_REACH_DIST = 12;          // 到达路径点的判定距离（像素）
const PATH_REPLAN_PATROL_MS = 800;   // 巡逻路径的最小重算间隔
const PATH_REPLAN_CHASE_MS  = 350;   // 追击路径的重算间隔（玩家在动，要更频繁）
const STUCK_CHECK_INTERVAL  = 220;   // 卡墙检测间隔（毫秒）
const STUCK_MIN_MOVE        = 2.5;   // 这段时间内位移不足此值就视为卡住

export default class Guard {
  /**
   * @param {Phaser.Scene} scene
   * @param {{x:number,y:number}[]} waypoints  世界坐标
   * @param {string} [style]  样式 id：'museum' | 'thug' | 'sailor'，决定贴图
   */
  constructor(scene, waypoints, style = 'museum') {
    this.scene = scene;
    this.waypoints = waypoints;
    this.style = style;

    // —— Nightkeeper 新版独立帧动画（museum / sailor）：优先级最高 ——
    //   museum → nkguard  船员 → nkpirate  打手 → 仍走旧链路
    this.nkAnimPrefix = style === 'sailor' ? 'nkpirate'
      : (style === 'museum' ? 'nkguard' : null);
    this.useNew = !!this.nkAnimPrefix
      && scene.anims && scene.anims.exists(`${this.nkAnimPrefix}_idle_down`);

    // 解析对应贴图组（museum 沿用旧 key，保持兼容）
    this.texIdle = style === 'thug' ? 'tex_guard_thug'
      : style === 'sailor' ? 'tex_guard_sailor'
      : 'tex_guard';
    this.texWalk = style === 'thug' ? 'tex_guard_thug_walk'
      : style === 'sailor' ? 'tex_guard_sailor_walk'
      : 'tex_guard_walk';

    // —— 高质量 spritesheet 贴图（thug 仍用此链路） ——
    this.hqKey = style === 'thug'
      ? (scene.textures && scene.textures.exists('enemy_thug_blackmarket') ? 'enemy_thug_blackmarket' : 'enemy_thug')
      : style === 'sailor' ? 'enemy_sailor'
      : 'enemy_guard';
    this.hqAnimPrefix = style === 'thug' ? 'thug'
      : style === 'sailor' ? 'sailor'
      : 'guard';
    // 仅在没有新版动画时启用 HQ
    this.useHQ = !this.useNew && scene.textures && scene.textures.exists(this.hqKey);

    // —— LimeZu 精美贴图配置（按风格分配不同 LimeZu 角色）——
    this.lzKey = style === 'thug' ? 'lz_bob_idle'
      : style === 'sailor' ? 'lz_alex_idle'
      : 'lz_amelia_idle';
    this.lzAnimPrefix = style === 'thug' ? 'bob'
      : style === 'sailor' ? 'alex'
      : 'amelia';
    this.useLZ = !this.useNew && !this.useHQ && scene.textures && scene.textures.exists(this.lzKey);

    this.wpIdx = 0;
    this.alert = 0;
    this.state = 'patrol'; // patrol | suspicious | chase
    this.prevState = 'patrol';
    this.waitUntil = 0;
    this.chaseUntil = 0;
    this.onStateChange = null; // (newState, oldState, guard) => void
    // ★ 巡逻硬约束（世界像素矩形）：守卫不能走出该区域，迫近边界会被拉回
    this.patrolBounds = null;

    // —— 战斗状态 ——
    this.hp = GUARD_MAX_HP;
    this.dead = false;
    this.staggerUntil = 0;
    this.attackPhase = 'idle';
    this.attackPhaseUntil = 0;
    this.attackedThisSwing = false;
    this.onHitPlayer = null;
    this.onWindupStart = null;

    // —— 行走帧切换（旧贴图模式专用） ——
    this._walkPhase = 0;
    this._walkAccum = 0;
    this._lastX = 0;
    this._lastY = 0;

    // —— A* 寻路状态 ——
    this._currentPath = null;       // 世界像素路径数组（不含起点）
    this._pathTargetIdx = 0;        // 当前正在走的 path 节点
    this._lastPlanTime = 0;         // 上次规划路径的时间戳
    this._stuckCheckTime = 0;       // 上次卡墙检测的时间
    this._stuckCheckPos = { x: 0, y: 0 };
    // —— 卡墙后的「反向逃离」机制（防止守卫一直怼墙）——
    this._reverseUntil = 0;         // 反向移动持续到的时间戳
    this._reverseAngle = 0;         // 反向移动的角度（来自卡住瞬间 facing 的反方向）
    this._stuckCount = 0;           // 连续卡住次数（决定反向移动时长）

    const start = waypoints[0];
    // —— 初始生成点：选择路径中点附近的点，避免守卫刚刷出来就贴脸玩家 ——
    const startIdx = waypoints.length >= 2 ? Math.floor(waypoints.length / 2) : 0;
    const startPos = waypoints[startIdx];
    this.wpIdx = (startIdx + 1) % waypoints.length;

    // —— 创建 sprite：优先级 useNew > useHQ > useLZ > 旧 canvas 贴图 ——
    let initTex, initFrame;
    if (this.useNew) {
      // 新版用 4 个独立 PNG，初始用 down1 帧
      initTex = `${this.nkAnimPrefix === 'nkguard' ? 'nk_guard' : 'nk_pirate'}_down_1`;
      initFrame = 0;
    } else if (this.useHQ) {
      initTex = this.hqKey;
      initFrame = 0;
    } else if (this.useLZ) {
      initTex = this.lzKey;
      initFrame = 18;
    } else {
      initTex = this.texIdle;
      initFrame = 0;
    }
    this.sprite = scene.physics.add.sprite(startPos.x, startPos.y, initTex, initFrame);
    this.sprite.setCollideWorldBounds(true);

    if (this.useNew) {
      // 新版 PNG 帧大约 200~256px，body 设为脚部小框
      // 先按 sprite 当前显示尺寸推算（贴图加载后 sprite 已知 width/height）
      const sw = this.sprite.width || 200;
      const sh = this.sprite.height || 200;
      const bw = Math.max(28, sw * 0.22);
      const bh = Math.max(20, sh * 0.18);
      this.sprite.body.setSize(bw, bh)
        .setOffset((sw - bw) / 2, sh - bh - sh * 0.05);
    } else if (this.useHQ) {
      if (this.style === 'thug' && this.hqKey === 'enemy_thug_blackmarket') {
        this.sprite.body.setSize(86, 44).setOffset(69, 176);
      } else if (this.style === 'sailor') {
        this.sprite.body.setSize(50, 40).setOffset(90, 170);
      } else {
        this.sprite.body.setSize(60, 50).setOffset(85, 160);
      }
    } else if (this.useLZ) {
      this.sprite.body.setSize(10, 12).setOffset(3, 18);
    } else {
      this.sprite.body.setSize(12, 18).setOffset(2, 4);
    }
    this.sprite.setDepth(5);

    // —— 缩放：新版独立帧用 0.18，HQ 229px 用旧规则 ——
    let scale;
    if (this.useNew) {
      scale = 0.20; // 新版 PNG 大约 200~256px，缩到合理大小
    } else if (this.useHQ) {
      scale = (this.style === 'thug' && this.hqKey === 'enemy_thug_blackmarket')
        ? 0.3 : (this.style === 'sailor' ? 0.28 : 0.21);
    } else if (this.useLZ) {
      scale = 1.5;
    } else {
      scale = 1.7;
    }
    this.sprite.setScale(scale);

    // 当前 4 方向
    this._dir4 = 'down';
    if (this.useNew) {
      const animKey = `${this.nkAnimPrefix}_idle_down`;
      if (scene.anims.exists(animKey)) this.sprite.play(animKey);
    } else if (this.useHQ) {
      const animKey = `${this.hqAnimPrefix}_idle_down`;
      if (scene.anims.exists(animKey)) this.sprite.play(animKey);
    } else if (this.useLZ) {
      const animKey = `${this.lzAnimPrefix}_idle_down`;
      if (scene.anims.exists(animKey)) this.sprite.play(animKey);
    }

    // 朝向（弧度）：初始指向下一个路径点
    const next = waypoints[this.wpIdx] || { x: startPos.x + 1, y: startPos.y };
    this.facing = Math.atan2(next.y - startPos.y, next.x - startPos.x);

    // —— 视野锥渲染 ——
    this.coneGfx = scene.add.graphics();
    this.coneGfx.setDepth(4);

    // 守卫提灯光晕（在光照系统中读取）
    this.lightKey = 'tex_light_guard';

    // —— 血条：仅在受击后临时显示 ——
    this.hpBarGfx = scene.add.graphics();
    this.hpBarGfx.setDepth(7);
    this.hpBarShowUntil = 0;

    this._lastX = startPos.x;
    this._lastY = startPos.y;
    this._stuckCheckPos.x = startPos.x;
    this._stuckCheckPos.y = startPos.y;
  }

  destroy() {
    this.sprite.destroy();
    this.coneGfx.destroy();
    if (this.windupGfx) this.windupGfx.destroy();
    if (this.hpBarGfx) this.hpBarGfx.destroy();
  }

  // ★ 设置守卫的活动范围（世界像素矩形）★
  setPatrolBounds(rect) {
    if (!rect) {
      this.patrolBounds = null;
      return;
    }
    const margin = 8;
    this.patrolBounds = {
      x: rect.x + margin,
      y: rect.y + margin,
      x2: rect.x + rect.w - margin,
      y2: rect.y + rect.h - margin
    };
  }

  // 把守卫位置/速度限制在 patrolBounds 内
  // 触发后：清空当前路径，强制切到下一个 waypoint，避免在边界打转
  enforceBounds() {
    const b = this.patrolBounds;
    if (!b || !this.sprite || !this.sprite.body) return;
    let { x, y } = this.sprite;
    let vx = this.sprite.body.velocity.x;
    let vy = this.sprite.body.velocity.y;
    let clamped = false;
    if (x < b.x)  { x = b.x;  if (vx < 0) vx = 0; clamped = true; }
    if (x > b.x2) { x = b.x2; if (vx > 0) vx = 0; clamped = true; }
    if (y < b.y)  { y = b.y;  if (vy < 0) vy = 0; clamped = true; }
    if (y > b.y2) { y = b.y2; if (vy > 0) vy = 0; clamped = true; }
    if (clamped) {
      this.sprite.x = x;
      this.sprite.y = y;
      this.sprite.body.setVelocity(vx, vy);
      // ★ 反向逃离期间：保留 clamp，但不换 waypoint（避免覆盖反向逻辑）
      if (this.scene.time.now < this._reverseUntil) return;
      // ★ 关键修复：撞到边界时换 waypoint + 清空路径，下一帧重新规划 ★
      if (this.state !== 'chase') {
        this._currentPath = null;
        this._pathTargetIdx = 0;
        this.wpIdx = (this.wpIdx + 1) % this.waypoints.length;
        // 等一拍再走（避免立刻又撞回去）
        this.waitUntil = this.scene.time.now + 200;
      }
    }
  }

  // —— 玩家攻击造成伤害 ——
  takeDamage(amount, knockX = 0, knockY = 0) {
    if (this.dead) return false;
    this.hp -= amount;
    this.staggerUntil = this.scene.time.now + GUARD_STAGGER_MS;
    if (this.sprite.body) {
      this.sprite.setVelocity(knockX * 200, knockY * 200);
    }
    if (this.useHQ) {
      const hurtKey = `${this.hqAnimPrefix}_hurt`;
      if (this.scene.anims.exists(hurtKey)) this.sprite.play(hurtKey);
    }
    this.sprite.setTint(0xff5555);
    this.scene.time.delayedCall(160, () => {
      if (this.sprite && !this.dead) this.sprite.clearTint();
    });
    this.hpBarShowUntil = this.scene.time.now + 2500;
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    this.alert = ALERT_FULL;
    this.state = 'chase';
    this.chaseUntil = this.scene.time.now + 8000;
    if (typeof this.onAlarm === 'function') {
      this.onAlarm(this, ALARM_RADIUS);
    }
    return false;
  }

  die() {
    this.dead = true;
    const deathKey = this.useHQ ? `${this.hqAnimPrefix}_death` : null;
    const hasDeathAnim = deathKey && this.scene.anims.exists(deathKey);
    if (hasDeathAnim) {
      this.sprite.clearTint();
      this.sprite.setAlpha(1);
      this.sprite.play(deathKey, true);
    } else {
      this.sprite.setTint(0x666666);
      this.sprite.setAlpha(0.55);
    }
    if (this.sprite.body) {
      this.sprite.body.setVelocity(0, 0);
      this.sprite.body.enable = false;
    }
    this.coneGfx.clear();
    if (this.windupGfx) this.windupGfx.clear();
    if (this.hpBarGfx) this.hpBarGfx.clear();
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
      const dx = player.x - this.sprite.x;
      const dy = player.y - this.sprite.y;
      const dist = Math.hypot(dx, dy);
      const distFactor = Phaser.Math.Clamp(1 - dist / VIEW_RANGE, 0.2, 1);
      const sneak = this.scene.keys && this.scene.keys.SHIFT.isDown ? 0.45 : 1;
      this.alert = Math.min(ALERT_FULL, this.alert + ALERT_FILL_RATE * distFactor * sneak * dt);
    } else {
      this.alert = Math.max(0, this.alert - ALERT_DECAY_RATE * dt);
    }

    // —— 状态切换 ——
    const oldState = this.state;
    if (this.alert >= ALERT_FULL) {
      this.state = 'chase';
      this.chaseUntil = this.scene.time.now + 6000;
      if (oldState !== 'chase' && typeof this.onAlarm === 'function') {
        this.onAlarm(this, ALARM_RADIUS);
      }
    } else if (this.alert > ALERT_SUSPICIOUS) {
      if (seePlayer) this.state = 'suspicious';
    } else if (this.state !== 'chase' || this.scene.time.now > this.chaseUntil) {
      this.state = 'patrol';
    }
    if (this.state !== oldState) {
      if (typeof this.onStateChange === 'function') {
        this.onStateChange(this.state, oldState, this);
      }
      this.prevState = oldState;
      // 状态变了 → 路径作废
      this._currentPath = null;
      this._pathTargetIdx = 0;
    }

    // —— 硬直期间不行动 ——
    const inStagger = this.scene.time.now < this.staggerUntil;

    // —— 行为 ——
    if (inStagger) {
      this.sprite.setVelocity(this.sprite.body.velocity.x * 0.85, this.sprite.body.velocity.y * 0.85);
    } else if (this.scene.time.now < this._reverseUntil) {
      // ★ 反向逃离：上一轮被判定为卡墙，强制朝反方向冲一段时间，避免一直怼墙 ★
      const spd = this.state === 'chase' ? CHASE_SPEED * 0.85 : PATROL_SPEED * 1.0;
      const vx = Math.cos(this._reverseAngle) * spd;
      const vy = Math.sin(this._reverseAngle) * spd;
      this.sprite.setVelocity(vx, vy);
      // 朝向也跟着转（视觉合理）
      this.facing = this.lerpAngle(this.facing, this._reverseAngle, TURN_SPEED * 1.6 * dt);
      // 期间清空路径，反向结束后下一帧自然重规划
      this._currentPath = null;
      this._pathTargetIdx = 0;
    } else if (this.state === 'chase') {
      this.behaviorChase(dt, player, walls);
    } else if (this.state === 'suspicious') {
      this.behaviorSuspicious(dt, player);
    } else {
      this.behaviorPatrol(dt);
    }

    // —— 卡墙检测：长时间几乎没动 → 重新规划 ——
    this.checkStuck();

    // —— 视野锥渲染 ——
    this.drawCone();

    // —— 攻击蓄力提示渲染 ——
    this.drawWindup();

    // —— 血条渲染 ——
    this.drawHpBar();

    // —— 行走帧切换（依据实际位移） ——
    this.updateWalkFrame(dt);

    // —— 硬约束：守卫不能走出自己房间的矩形范围 ——
    this.enforceBounds();

    return this.touchPlayer(player);
  }

  // —— 卡墙检测：每隔一段时间看看实际位移，若太小就清路径
  checkStuck() {
    const now = this.scene.time.now;
    if (now - this._stuckCheckTime < STUCK_CHECK_INTERVAL) return;
    this._stuckCheckTime = now;
    // 反向逃离期间不做卡墙判断（避免刚启动反向就又被判定卡住）
    if (now < this._reverseUntil) {
      this._stuckCheckPos.x = this.sprite.x;
      this._stuckCheckPos.y = this.sprite.y;
      return;
    }
    if (this.state === 'patrol' && now < this.waitUntil) {
      // 主动停顿期间不算
      this._stuckCheckPos.x = this.sprite.x;
      this._stuckCheckPos.y = this.sprite.y;
      return;
    }
    const dx = this.sprite.x - this._stuckCheckPos.x;
    const dy = this.sprite.y - this._stuckCheckPos.y;
    const moved = Math.hypot(dx, dy);
    this._stuckCheckPos.x = this.sprite.x;
    this._stuckCheckPos.y = this.sprite.y;
    // 想走但没走动 → 卡住，触发重规划
    const wantsToMove = this.attackPhase === 'idle'
      && (this.state === 'chase' || (this.state === 'patrol' && now >= this.waitUntil));
    if (wantsToMove && moved < STUCK_MIN_MOVE) {
      this._currentPath = null;
      this._pathTargetIdx = 0;
      // 巡逻卡住时跳到下一个 waypoint
      if (this.state === 'patrol') {
        this.wpIdx = (this.wpIdx + 1) % this.waypoints.length;
        this.waitUntil = now + 150;
      }
      // ★ 启动「反向逃离」：朝当前 facing 的反方向冲一段时间 ★
      //   连续卡得越多，反向时长越长，并加少量随机抖动避免对称死锁
      this._stuckCount = Math.min(this._stuckCount + 1, 4);
      const baseDur = 320;
      const dur = baseDur + this._stuckCount * 90;     // 320 / 410 / 500 / 590 / 680
      const jitter = (Math.random() - 0.5) * 0.6;       // ±0.3 弧度（约 ±17°）
      this._reverseAngle = this.facing + Math.PI + jitter;
      this._reverseUntil = now + dur;
    } else if (moved >= STUCK_MIN_MOVE) {
      // 顺利移动了 → 清零卡住计数
      this._stuckCount = 0;
    }
  }

  // —— A* 路径计算（基于场景的 walkGrid） ——
  // 成功返回路径世界像素数组（不含起点），失败返回 null
  planPathTo(targetX, targetY) {
    const grid = this.scene && this.scene._walkGrid;
    const cell = this.scene && this.scene._walkGridCell;
    if (!grid || !cell) return null;
    const s = pixelToCell(this.sprite.x, this.sprite.y, cell);
    const t = pixelToCell(targetX, targetY, cell);
    const tilePath = findPath(grid, s.x, s.y, t.x, t.y);
    if (!tilePath || tilePath.length === 0) return null;
    const smoothed = smoothPath(grid, tilePath);
    // 跳过起点格自己；若只剩一个点（终点格==起点格）就直接给终点
    const worldPath = [];
    for (let i = 1; i < smoothed.length; i++) {
      worldPath.push(cellToPixel(smoothed[i].x, smoothed[i].y, cell));
    }
    if (worldPath.length === 0) {
      worldPath.push({ x: targetX, y: targetY });
    } else {
      // 让最后一个点更精准（直接对齐目标坐标）
      worldPath[worldPath.length - 1] = { x: targetX, y: targetY };
    }
    return worldPath;
  }

  // —— 沿当前 path 走一步：维护朝向、速度，到达节点就推进
  followPath(speed, dt) {
    if (!this._currentPath || this._currentPath.length === 0) {
      this.sprite.setVelocity(0, 0);
      return false;
    }
    if (this._pathTargetIdx >= this._currentPath.length) {
      this.sprite.setVelocity(0, 0);
      return true; // 已走完
    }
    const node = this._currentPath[this._pathTargetIdx];
    const dx = node.x - this.sprite.x;
    const dy = node.y - this.sprite.y;
    const dist = Math.hypot(dx, dy);
    if (dist < PATH_REACH_DIST) {
      this._pathTargetIdx++;
      if (this._pathTargetIdx >= this._currentPath.length) {
        this.sprite.setVelocity(0, 0);
        return true;
      }
    }
    const cur = this._currentPath[this._pathTargetIdx];
    const ang = Math.atan2(cur.y - this.sprite.y, cur.x - this.sprite.x);
    this.facing = this.lerpAngle(this.facing, ang, TURN_SPEED * dt);
    this.sprite.setVelocity(Math.cos(this.facing) * speed, Math.sin(this.facing) * speed);
    return false;
  }

  // —— 巡逻：A* 到下一个 waypoint，到了就停顿，再去下一个 ——
  behaviorPatrol(dt) {
    const now = this.scene.time.now;
    if (now < this.waitUntil) {
      this.sprite.setVelocity(0, 0);
      this.facing += Math.sin(now / 380) * 0.025;
      return;
    }
    const target = this.waypoints[this.wpIdx];
    if (!target) return;

    // 没有路径或到该重算的时间 → 规划一条
    const needPlan = !this._currentPath
      || this._pathTargetIdx >= this._currentPath.length
      || (now - this._lastPlanTime) > PATH_REPLAN_PATROL_MS * 6; // 巡逻路径很稳，少重算
    if (needPlan) {
      const path = this.planPathTo(target.x, target.y);
      if (path && path.length > 0) {
        this._currentPath = path;
        this._pathTargetIdx = 0;
        this._lastPlanTime = now;
      } else {
        // 无 walkGrid 或寻不到路 → fallback：直线（保留原有兜底）
        this._currentPath = [{ x: target.x, y: target.y }];
        this._pathTargetIdx = 0;
        this._lastPlanTime = now;
      }
    }

    // 接近 waypoint 时（不一定要走完整段路径）：到了就停顿换下一个
    const dx = target.x - this.sprite.x;
    const dy = target.y - this.sprite.y;
    const distToWp = Math.hypot(dx, dy);
    if (distToWp < 10) {
      this.sprite.setVelocity(0, 0);
      const waitTime = 400 + Math.floor(Math.random() * 1400);
      this.waitUntil = now + waitTime;
      this.wpIdx = (this.wpIdx + 1) % this.waypoints.length;
      this._currentPath = null;
      this._pathTargetIdx = 0;
      return;
    }

    // 沿路径走
    const reached = this.followPath(PATROL_SPEED, dt);
    if (reached) {
      // 路径走完但 waypoint 还没到（罕见，可能是 grid 与目标偏差）→ 直线补足
      const ang = Math.atan2(dy, dx);
      this.facing = this.lerpAngle(this.facing, ang, TURN_SPEED * dt);
      this.sprite.setVelocity(Math.cos(this.facing) * PATROL_SPEED, Math.sin(this.facing) * PATROL_SPEED);
    }
  }

  // —— 怀疑：站定，朝玩家方向转过去 ——
  behaviorSuspicious(dt, player) {
    this.sprite.setVelocity(0, 0);
    const ang = Math.atan2(player.y - this.sprite.y, player.x - this.sprite.x);
    this.facing = this.lerpAngle(this.facing, ang, TURN_SPEED * 1.4 * dt);
  }

  // —— 追击：A* 跟随玩家，进入攻击距离则蓄力出刀 ——
  behaviorChase(dt, player, walls) {
    const now = this.scene.time.now;
    const dx = player.x - this.sprite.x;
    const dy = player.y - this.sprite.y;
    const dist = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);

    // 攻击状态机
    if (this.attackPhase === 'windup') {
      this.sprite.setVelocity(0, 0);
      this.facing = this.lerpAngle(this.facing, ang, TURN_SPEED * 1.4 * dt);
      if (now >= this.attackPhaseUntil) {
        this.attackPhase = 'recover';
        this.attackPhaseUntil = now + 220;
        this.tryHitPlayer(player);
      }
      return;
    }
    if (this.attackPhase === 'recover') {
      this.sprite.setVelocity(0, 0);
      if (now >= this.attackPhaseUntil) {
        this.attackPhase = 'idle';
        this.attackPhaseUntil = now + ATTACK_COOLDOWN_MS;
      }
      return;
    }
    if (now >= this.attackPhaseUntil && dist <= ATTACK_RANGE) {
      this.attackPhase = 'windup';
      this.attackPhaseUntil = now + ATTACK_WINDUP_MS;
      this.attackedThisSwing = false;
      this.sprite.setVelocity(0, 0);
      if (typeof this.onWindupStart === 'function') {
        this.onWindupStart(this);
      }
      return;
    }

    // —— 追击移动：
    //   1) 玩家直线可达（无墙阻挡）→ 直接冲，最丝滑
    //   2) 玩家被墙挡 → 走 A* 路径
    const directLOS = !this.rayHitsWall(this.sprite.x, this.sprite.y, player.x, player.y, walls);
    if (directLOS) {
      // 清空路径，直冲
      this._currentPath = null;
      this._pathTargetIdx = 0;
      this.facing = this.lerpAngle(this.facing, ang, TURN_SPEED * 1.8 * dt);
      this.sprite.setVelocity(Math.cos(this.facing) * CHASE_SPEED, Math.sin(this.facing) * CHASE_SPEED);
      return;
    }

    // 被墙挡 → 用 A*
    const needPlan = !this._currentPath
      || this._pathTargetIdx >= this._currentPath.length
      || (now - this._lastPlanTime) > PATH_REPLAN_CHASE_MS;
    if (needPlan) {
      const path = this.planPathTo(player.x, player.y);
      if (path && path.length > 0) {
        this._currentPath = path;
        this._pathTargetIdx = 0;
        this._lastPlanTime = now;
      } else {
        // 寻不到路 → 退化为直线追
        this._currentPath = null;
        this.facing = this.lerpAngle(this.facing, ang, TURN_SPEED * 1.8 * dt);
        this.sprite.setVelocity(Math.cos(this.facing) * CHASE_SPEED, Math.sin(this.facing) * CHASE_SPEED);
        return;
      }
    }
    this.followPath(CHASE_SPEED, dt);
  }

  // —— 行走帧切换 / 动画选择 ——
  updateWalkFrame(dt) {
    if (this.dead) return;
    const dx = this.sprite.x - this._lastX;
    const dy = this.sprite.y - this._lastY;
    const moved = Math.hypot(dx, dy);
    const bvx = this.sprite.body ? this.sprite.body.velocity.x : 0;
    const bvy = this.sprite.body ? this.sprite.body.velocity.y : 0;
    const speed = Math.hypot(bvx, bvy);
    this._lastX = this.sprite.x;
    this._lastY = this.sprite.y;

    // —— Nightkeeper 新版独立帧动画 ——
    if (this.useNew) {
      let dir = this._dir4 || 'down';
      if (speed > 2) {
        if (Math.abs(bvx) > Math.abs(bvy)) dir = bvx > 0 ? 'right' : 'left';
        else dir = bvy > 0 ? 'down' : 'up';
      } else if (moved > 0.15) {
        if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'right' : 'left';
        else dir = dy > 0 ? 'down' : 'up';
      } else if (typeof this.facing === 'number') {
        const fx = Math.cos(this.facing);
        const fy = Math.sin(this.facing);
        if (Math.abs(fx) > Math.abs(fy)) dir = fx > 0 ? 'right' : 'left';
        else dir = fy > 0 ? 'down' : 'up';
      }
      this._dir4 = dir;
      const moving = speed > 2 || moved > 0.15;
      const animKey = moving
        ? `${this.nkAnimPrefix}_walk_${dir}`
        : `${this.nkAnimPrefix}_idle_${dir}`;
      if (this.scene.anims.exists(animKey)) {
        const cur = this.sprite.anims.currentAnim;
        if (!cur || cur.key !== animKey) this.sprite.play(animKey);
      }
      this.sprite.setFlipX(false);
      return;
    }

    if (this.useHQ) {
      let dir = this._dir4 || 'down';
      if (speed > 2) {
        if (Math.abs(bvx) > Math.abs(bvy)) dir = bvx > 0 ? 'right' : 'left';
        else dir = bvy > 0 ? 'down' : 'up';
      } else if (moved > 0.15) {
        if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'right' : 'left';
        else dir = dy > 0 ? 'down' : 'up';
      } else if (typeof this.facing === 'number') {
        const fx = Math.cos(this.facing);
        const fy = Math.sin(this.facing);
        if (Math.abs(fx) > Math.abs(fy)) dir = fx > 0 ? 'right' : 'left';
        else dir = fy > 0 ? 'down' : 'up';
      }
      this._dir4 = dir;
      const moving = speed > 2 || moved > 0.15;
      if (this.attackPhase === 'windup' || this.attackPhase === 'recover') {
        const directionalAtkKey = `${this.hqAnimPrefix}_attack_${dir}`;
        const atkKey = this.scene.anims.exists(directionalAtkKey)
          ? directionalAtkKey
          : `${this.hqAnimPrefix}_attack`;
        if (this.scene.anims.exists(atkKey)) {
          const cur = this.sprite.anims.currentAnim;
          if (!cur || cur.key !== atkKey) this.sprite.play(atkKey);
        }
      } else {
        const movePrefix = (this.state === 'chase' && this.scene.anims.exists(`${this.hqAnimPrefix}_run_${dir}`))
          ? 'run'
          : 'walk';
        const animKey = moving
          ? `${this.hqAnimPrefix}_${movePrefix}_${dir}`
          : `${this.hqAnimPrefix}_idle_${dir}`;
        if (this.scene.anims.exists(animKey)) {
          const cur = this.sprite.anims.currentAnim;
          if (!cur || cur.key !== animKey || !this.sprite.anims.isPlaying) this.sprite.play(animKey);
        }
      }
      this.sprite.setFlipX(false);
      return;
    }

    if (this.useLZ) {
      let dir = this._dir4 || 'down';
      if (moved > 0.4) {
        if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'right' : 'left';
        else dir = dy > 0 ? 'down' : 'up';
      } else if (typeof this.facing === 'number') {
        const fx = Math.cos(this.facing);
        const fy = Math.sin(this.facing);
        if (Math.abs(fx) > Math.abs(fy)) dir = fx > 0 ? 'right' : 'left';
        else dir = fy > 0 ? 'down' : 'up';
      }
      this._dir4 = dir;
      const moving = moved > 0.4;
      const animKey = moving
        ? `${this.lzAnimPrefix}_run_${dir}`
        : `${this.lzAnimPrefix}_idle_${dir}`;
      const fallback = `${this.lzAnimPrefix}_idle_${dir}`;
      const target = this.scene.anims.exists(animKey) ? animKey : fallback;
      if (this.scene.anims.exists(target)) {
        const cur = this.sprite.anims.currentAnim;
        if (!cur || cur.key !== target) this.sprite.play(target);
      }
      this.sprite.setFlipX(false);
      return;
    }

    // —— 旧贴图模式 ——
    if (moved > 0.4) {
      this._walkAccum += dt;
      const stepTime = this.state === 'chase' ? 0.10 : 0.22;
      if (this._walkAccum >= stepTime) {
        this._walkAccum = 0;
        this._walkPhase = 1 - this._walkPhase;
        this.sprite.setTexture(this._walkPhase ? this.texWalk : this.texIdle);
      }
      if (Math.abs(dx) > 0.05) {
        this.sprite.setFlipX(dx < 0);
      }
    } else if (this._walkPhase !== 0) {
      this._walkPhase = 0;
      this._walkAccum = 0;
      this.sprite.setTexture(this.texIdle);
    }
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
    const t = 1 - left / total;
    const cx = this.sprite.x;
    const cy = this.sprite.y;
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
    g.lineStyle(1.5, 0xff5050, 0.55 + 0.4 * t);
    g.strokePath();
  }

  // —— 血条渲染 ——
  drawHpBar() {
    const g = this.hpBarGfx;
    if (!g) return;
    g.clear();
    if (this.dead) return;
    if (this.scene.time.now > this.hpBarShowUntil) return;
    const w = 22;
    const h = 3;
    const x = this.sprite.x - w / 2;
    const y = this.sprite.y - 16;
    const ratio = Phaser.Math.Clamp(this.hp / GUARD_MAX_HP, 0, 1);
    g.fillStyle(0x000000, 0.7);
    g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(0x6a1818, 0.95);
    g.fillRect(x, y, w, h);
    g.fillStyle(0xff4848, 1);
    g.fillRect(x, y, w * ratio, h);
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
    const ps = this.scene && this.scene.playerState;
    if (ps && ps.smokedUntil && this.scene.time.now < ps.smokedUntil) {
      if (dist > 30) return false;
    }
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

  // —— 贴身接触 ——
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

  // —— 被同伴叫醒：直接拉到怀疑级 ——
  receiveAlarm(fromGuard) {
    if (this.dead) return;
    if (this.state === 'chase') return;
    this.alert = Math.max(this.alert, ALARM_ALERT_BUMP);
    if (fromGuard && fromGuard.sprite) {
      const ang = Math.atan2(fromGuard.sprite.y - this.sprite.y, fromGuard.sprite.x - this.sprite.x);
      this.facing = ang;
    }
  }
}
