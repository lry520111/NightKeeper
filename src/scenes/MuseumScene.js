// MuseumScene - 博物馆关卡
// 当前实现：移动 + 拾取 + 撤离 + 光照系统 + 守卫 AI / 视野锥 / 警觉值
import Phaser from 'phaser';
import { RELICS, RARITY_COLOR } from '../data/relics.js';
import Guard from '../systems/Guard.js';
import Inventory, { INV_COLS, INV_ROWS } from '../systems/Inventory.js';
import { generateLevel } from '../systems/LevelGenerator.js';
import Codex from '../systems/Codex.js';
import Audio from '../systems/AudioFx.js';
import AICompanion, { quipForPickup } from '../systems/AICompanion.js';

const TILE = 32;
const MAP_W = 30; // 30 * 32 = 960
const MAP_H = 17; // 17 * 32 = 544

// 光照层颜色（接近纯黑、略带紫调，像月夜）
const DARKNESS = 0x05060a;

export default class MuseumScene extends Phaser.Scene {
  constructor() {
    super('MuseumScene');
    this.totalRelicsOnMap = 0;
  }

  create() {
    this.cameras.main.fadeIn(500, 0, 0, 0);
    this.inventory = new Inventory();
    this._ended = false;

    // —— 0. 程序化生成关卡布局（每局不同） ——
    const level = generateLevel({
      width: MAP_W,
      height: MAP_H,
      seed: (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0,
      relicCount: 7,
      relicPoolSize: RELICS.length,
      guardCount: 3
    });
    this._level = level;

    // —— 1. 铺地板（伪噪声选择变体，避免重复感） ——
    const floorKeys = ['tex_floor', 'tex_floor', 'tex_floor', 'tex_floor_a', 'tex_floor_b'];
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        // 用位运算生成伪随机索引，保证每个位置出现稳定贴图
        const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        const idx = h % floorKeys.length;
        this.add.image(x * TILE, y * TILE, floorKeys[idx]).setOrigin(0, 0).setDepth(0);
      }
    }

    // —— 2. 墙体（由关卡生成器产出） ——
    this.walls = this.physics.add.staticGroup();
    for (const key of level.walls) {
      const [sx, sy] = key.split(',').map(Number);
      const isTop = sy === 0;
      this.spawnWall(sx, sy, isTop ? 'tex_wall_top' : 'tex_wall');
    }

    // —— 3. 文物（带展柜底座 + 类型化贴图，位置随机） ——
    this.relicGroup = this.physics.add.group();
    const relicSpawns = level.relicSpawns;
    relicSpawns.forEach((s) => {
      const data = RELICS[s.relicIdx];
      const cx = s.x * TILE + TILE / 2;
      const cy = s.y * TILE + TILE / 2;
      // 展柜底座
      const base = this.add.image(cx, cy, 'tex_case').setDepth(1);
      // 文物本体
      const r = this.relicGroup.create(cx, cy - 2, data.icon || 'tex_relic');
      r.setData('relic', data).setDepth(2);
      r.body.setSize(12, 12);
      r.setData('basePos', { x: cx, y: cy - 2 });
      // 微微浮动呼吸
      this.tweens.add({
        targets: r,
        y: cy - 4,
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      });
      r.setData('caseRef', base);
    });
    this.totalRelicsOnMap = relicSpawns.length;

    // —— 4. 撤离点（位置由生成器提供） ——
    const exitTx = level.exit.x;
    const exitTy = level.exit.y;
    // 门前三格红地毯（从门口向左铺）
    for (let i = 1; i <= 3; i++) {
      this.add.image((exitTx - i) * TILE, exitTy * TILE, 'tex_carpet')
        .setOrigin(0, 0).setDepth(0.5);
    }
    this.exitZone = this.physics.add
      .staticImage(exitTx * TILE, exitTy * TILE, 'tex_exit')
      .setOrigin(0, 0)
      .setDepth(1);
    this.add
      .text(this.exitZone.x + 16, this.exitZone.y - 14, '撤 离', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: '#7ae8e8'
      })
      .setOrigin(0.5)
      .setDepth(2);

    // —— 4.5 装饰物（灯笼 / 牌匾 / 屏风 / 香炉） ——
    this.decorLights = this.placeDecorations();

    // —— 5. 玩家（出生点由生成器提供） ——
    this.player = this.physics.add.sprite(
      level.spawn.x * TILE + TILE / 2,
      level.spawn.y * TILE + TILE / 2,
      'tex_player'
    );
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(12, 18).setOffset(2, 4);
    this.player.setDepth(5);
    // 玩家朝向（弧度），鼠标方向决定光锥朝向
    this.player.setData('aim', 0);
    // 行走帧切换计时（每 0.18 秒翻一帧）
    this._playerWalkPhase = 0;
    this._playerWalkAccum = 0;

    this.physics.add.collider(this.player, this.walls);

    // —— 玩家战斗 / 状态属性 ——
    this.playerState = {
      hpMax: 3,
      hp: 3,
      stamMax: 100,
      stam: 100,
      stealth: false,        // Shift
      sprint: false,         // Ctrl
      blocking: false,       // K（按住）
      attackUntil: 0,        // 攻击动画/判定有效期
      attackHitDone: false,  // 本次挥刀是否已结算
      attackDir: 0,          // 本次攻击方向（弧度）
      attackCooldownUntil: 0,// 出招冷却结束
      invulnUntil: 0         // 受击无敌帧
    };

    // —— 6. 输入 ——
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      SHIFT: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      CTRL: Phaser.Input.Keyboard.KeyCodes.CTRL,
      E: Phaser.Input.Keyboard.KeyCodes.E,
      F: Phaser.Input.Keyboard.KeyCodes.F,
      J: Phaser.Input.Keyboard.KeyCodes.J,
      K: Phaser.Input.Keyboard.KeyCodes.K,
      TAB: Phaser.Input.Keyboard.KeyCodes.TAB,
      ESC: Phaser.Input.Keyboard.KeyCodes.ESC
    });
    // 防止 Tab/Ctrl 默认行为（页面焦点切换 / 浏览器快捷键）
    this.input.keyboard.addCapture('TAB');
    this.input.keyboard.addCapture('CTRL');
    this.keys.TAB.on('down', () => this.toggleInventoryPanel());

    // 鼠标左键 = 攻击（与 J 等价）
    this.input.on('pointerdown', (ptr) => {
      if (ptr.leftButtonDown && !this._ended) this.tryPlayerAttack();
    });

    // —— 7. 守卫 AI（在光照系统之前创建，便于把守卫提灯加入静态光源） ——
    this.spawnGuards();
    // 守卫命中玩家：交给场景结算（含格挡 / 无敌帧）
    if (this.guards) {
      for (const g of this.guards) {
        g.onHitPlayer = (guard) => this.onGuardHitPlayer(guard);
        g.onWindupStart = () => Audio.sfx.guardWindup();
      }
    }

    // —— 7.5 剧情碎片（在玩家出生点之外随机散布 1-2 份） ——
    this.spawnClueFragments();

    // —— 8. 光照系统 ——
    this.createLightSystem(relicSpawns);

    // —— 9. HUD ——
    this.createHUD();

    // —— 10. 倒计时（180 秒撤离时限） ——
    this.timeLeft = 180;
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this._ended) return;
        this.timeLeft--;
        this.timerText.setText(this.formatTime(this.timeLeft));
        if (this.timeLeft <= 30) this.timerText.setColor('#ff6b6b');
        if (this.timeLeft <= 0) this.endRun(false, '开馆铃响起，被保安发现……');
      }
    });

    // —— 11. ESC 返回标题 ——
    this.keys.ESC.on('down', () => {
      Audio.heartbeat.stop();
      Audio.stopAmbience();
      this.scene.start('TitleScene');
    });

    // —— 12. 帧时间 ——
    this._lastTime = this.time.now;

    // —— 13. 音效系统启动与脚步定时 ——
    Audio.init();
    Audio.startAmbience();
    this._stepAccum = 0;

    // —— 14. 屏幕暗角（受击 / 心跳闪动） ——
    this.vignette = this.add.image(480, 270, 'tex_vignette')
      .setDisplaySize(960, 540)
      .setScrollFactor(0)
      .setDepth(120)
      .setAlpha(0);

    // —— 15. 撤离门光环（青蓝色呼吸） ——
    this.exitGlow = this.add.image(this.exitZone.x + 16, this.exitZone.y + 16, 'tex_glow_ring')
      .setDepth(0.6)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: this.exitGlow,
      scale: { from: 0.9, to: 1.15 },
      alpha: { from: 0.55, to: 0.95 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });

    // —— 16. 场景卸载时清理音频 ——
    this.events.once('shutdown', () => {
      Audio.heartbeat.stop();
      Audio.stopAmbience();
    });
  }

  // ————————————————————————————————————————
  //  守卫部署：使用生成器产出的巡逻路径点（瓦片坐标转为世界坐标）
  // ————————————————————————————————————————
  spawnGuards() {
    this.guards = [];
    const paths = (this._level && this._level.guardPaths) || [];
    for (const tilePath of paths) {
      if (!tilePath || tilePath.length < 2) continue;
      const worldPath = tilePath.map((p) => ({
        x: p.x * TILE + TILE / 2,
        y: p.y * TILE + TILE / 2
      }));
      const g = new Guard(this, worldPath);
      g.onStateChange = (newSt, oldSt, guard) => this.onGuardStateChange(newSt, oldSt, guard);
      this.guards.push(g);
    }
  }
  spawnWall(tx, ty, key = 'tex_wall') {
    const w = this.walls.create(tx * TILE, ty * TILE, key).setOrigin(0, 0);
    w.refreshBody();
    w.setDepth(3);
    return w;
  }

  // ——————————————————————————————————————
  //  装饰物布置：灯笼 / 牌匾 / 屏风 / 香炉
  //  全部基于程序化生成的关卡数据动态布置，避免叠在墙上或挡通道
  //  返回灯笼对应的暖色光晕配置数组，由光照系统消费
  // ——————————————————————————————————————
  placeDecorations() {
    const decorLights = [];
    const level = this._level;
    const walls = (level && level.walls) || new Set();
    const isWall = (x, y) => walls.has(`${x},${y}`);
    const isFloor = (x, y) =>
      x > 0 && y > 0 && x < MAP_W - 1 && y < MAP_H - 1 && !isWall(x, y);

    // —— 1. 灯笼：吊在"上方墙体下沿" ——
    // 规则：找上方有墙、自身是空地的格子，作为灯笼候选位
    this.lanterns = [];
    const lanternXs = [4, 9, 15, 21, 26];
    for (const lx of lanternXs) {
      // 自上而下找第一个"墙下方紧邻空地"的位置
      let found = null;
      for (let y = 1; y < MAP_H - 1; y++) {
        if (isWall(lx, y - 1) && isFloor(lx, y)) {
          found = { x: lx, y };
          break;
        }
      }
      if (!found) continue;
      const wx = found.x * TILE + TILE / 2;
      const wy = found.y * TILE + 4;
      const lan = this.add.image(wx, wy, 'tex_lantern').setOrigin(0.5, 0).setDepth(4);
      this.tweens.add({
        targets: lan,
        angle: { from: -3, to: 3 },
        duration: 1800 + Math.random() * 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      });
      this.lanterns.push(lan);
      decorLights.push({
        ref: lan,
        x: wx,
        y: wy + 12,
        key: 'tex_light_warm',
        alpha: 0.6,
        flicker: true
      });
    }

    // —— 2. 牌匾：挂在中部水平隔墙的中央位置 ——
    if (level && typeof level.midRow === 'number') {
      const cx = Math.floor(MAP_W / 2);
      const wy = level.midRow * TILE + TILE - 6;
      this.add
        .image(cx * TILE, wy, 'tex_plaque')
        .setOrigin(0.5, 1)
        .setDepth(4);
    }

    // —— 3. 屏风：在每个房间随机位置摆 1 个，最多 4 个 ——
    const rooms = (level && level.rooms) || [];
    const usedDecorCells = new Set();
    let screenCount = 0;
    for (const room of rooms) {
      if (screenCount >= 4) break;
      if (room.w < 3 || room.h < 3) continue;
      for (let tries = 0; tries < 8; tries++) {
        const rx = room.x + 1 + Math.floor(Math.random() * Math.max(1, room.w - 2));
        const ry = room.y + 1 + Math.floor(Math.random() * Math.max(1, room.h - 2));
        const cellKey = `${rx},${ry}`;
        if (!isFloor(rx, ry) || usedDecorCells.has(cellKey)) continue;
        usedDecorCells.add(cellKey);
        this.add
          .image(rx * TILE + TILE / 2, ry * TILE + TILE / 2, 'tex_screen')
          .setOrigin(0.5, 0.5)
          .setDepth(2.5);
        screenCount++;
        break;
      }
    }

    // —— 4. 香炉：每个房间挑一个内角放 1 个，最多 4 个 ——
    let incenseCount = 0;
    for (const room of rooms) {
      if (incenseCount >= 4) break;
      const corners = [
        { x: room.x + 1, y: room.y + 1 },
        { x: room.x + room.w - 2, y: room.y + 1 },
        { x: room.x + 1, y: room.y + room.h - 2 },
        { x: room.x + room.w - 2, y: room.y + room.h - 2 }
      ];
      for (let i = corners.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [corners[i], corners[j]] = [corners[j], corners[i]];
      }
      for (const c of corners) {
        const ck = `${c.x},${c.y}`;
        if (!isFloor(c.x, c.y) || usedDecorCells.has(ck)) continue;
        usedDecorCells.add(ck);
        this.add
          .image(c.x * TILE + TILE / 2, c.y * TILE + TILE / 2, 'tex_incense')
          .setOrigin(0.5, 0.5)
          .setDepth(2.5);
        incenseCount++;
        break;
      }
    }

    return decorLights;
  }

  // ——————————————————————————————————————
  //  光照系统：黑色 RenderTexture + ERASE 模式挖光斑
  // ——————————————————————————————————————
  createLightSystem(relicSpawns) {
    const W = this.scale.width;
    const H = this.scale.height;

    // 暗色蒙版（覆盖全场景）
    this.darkness = this.add.renderTexture(0, 0, W, H);
    this.darkness.setOrigin(0, 0).setDepth(90).setScrollFactor(0);
    // 略微调亮蒙版下面的世界，让墙体保留一丝可见性
    this.cameras.main.setBackgroundColor(0x000000);

    // 文物固定光晕：保留位置以便每帧绘制
    this.staticLights = relicSpawns.map((s) => ({
      x: s.x * TILE + TILE / 2,
      y: s.y * TILE + TILE / 2,
      key: 'tex_light_xs',
      alpha: 0.55
    }));

    // 装饰灯笼的暖光晕（进入静态光源）
    if (this.decorLights) {
      for (const L of this.decorLights) {
        this.staticLights.push(L);
      }
    }

    // 撤离点光晕
    this.staticLights.push({
      x: this.exitZone.x + 16,
      y: this.exitZone.y + 16,
      key: 'tex_light_sm',
      alpha: 0.7,
      tint: 0x7ae8e8
    });
  }

  // ——————————————————————————————————————
  //  守卫提灯光晕：每帧动态加入光照
  // ——————————————————————————————————————
  drawGuardLights(rt) {
    if (!this.guards) return;
    for (const g of this.guards) {
      const info = g.getLightInfo();
      this.eraseAt(rt, info.key, info.x, info.y);
    }
  }

  /**
   * 每帧重绘暗色蒙版 + 玩家光锥 + 静态光晕
   * 实现思路：RT 先填满不透明黑暗，再用 erase() 把光晕图案"擦"出来
   */
  updateLighting() {
    if (!this.darkness) return;
    const rt = this.darkness;

    // 1. 重新填充黑暗（不透明，让 erase 形成清晰光斑）
    rt.clear();
    rt.fill(DARKNESS, 1);

    const px = this.player.x;
    const py = this.player.y;
    const aim = this.player.getData('aim') || 0;
    const isSneak = this.keys.SHIFT.isDown;

    // 2. 玩家近身环境光（小圆，始终亮）
    this.eraseAt(rt, 'tex_light_sm', px, py);

    // 3. 朝向光锥（鼠标方向延伸的大光晕）
    const coneKey = isSneak ? 'tex_light_sm' : 'tex_light_lg';
    const coneDist = isSneak ? 35 : 75;
    const cx = px + Math.cos(aim) * coneDist;
    const cy = py + Math.sin(aim) * coneDist;
    this.eraseAt(rt, coneKey, cx, cy);

    // 4. 静态光晕（文物 / 撤离点 / 灯笼）：靠近时显形；灯笼始终亮且带闪烁
    for (const L of this.staticLights) {
      const isLantern = L.key === 'tex_light_warm';
      // 灯笼范围更大，永远点亮；其他光源限制在玩家附近显现
      const visibleRange = isLantern ? 1e9 : 260;
      const d = Phaser.Math.Distance.Between(px, py, L.x, L.y);
      if (d > visibleRange) continue;

      // 灯笼随灯笼贴图同步轻微位移（摇曳）
      let lx = L.x;
      let ly = L.y;
      if (isLantern && L.ref) {
        // 灯笼贴图绕顶部旋转，光晕中心也跟着摆
        const swing = Math.sin(L.ref.angle * 0.0174533) * 6;
        lx = L.ref.x + swing;
        ly = L.ref.y + 12;
      }

      // 闪烁：灯笼用多次 erase 模拟亮度变化（更亮）
      this.eraseAt(rt, L.key || 'tex_light_xs', lx, ly);
      if (isLantern) {
        const flick = 0.85 + Math.sin(this.time.now * 0.008 + L.x * 0.13) * 0.15;
        if (flick > 0.92) {
          // 偶尔再叠一次擦除，制造"亮一下"的效果
          this.eraseAt(rt, L.key, lx, ly);
        }
      }
    }

    // 5. 守卫提灯光晕
    this.drawGuardLights(rt);

    // 6. 让暗部稍微透出一点世界色（避免完全死黑）
    rt.setAlpha(0.94);
  }

  /**
   * 以中心坐标在 RT 上擦除一张光晕贴图
   */
  eraseAt(rt, key, x, y) {
    const tex = this.textures.get(key);
    if (!tex) return;
    const src = tex.getSourceImage();
    const w = src.width;
    const h = src.height;
    rt.erase(key, x - w / 2, y - h / 2);
  }

  createHUD() {
    // 顶部状态条背景
    this.add.rectangle(0, 0, 960, 28, 0x000000, 0.85).setOrigin(0, 0).setScrollFactor(0).setDepth(100);
    // 顶部金线
    this.add.rectangle(0, 28, 960, 1, 0xd4af37, 0.6).setOrigin(0, 0).setScrollFactor(0).setDepth(100);

    // —— 左下：血条 + 体力条 + 状态图标 ——
    const bx = 20;
    const by = 510;
    this.add.text(bx, by - 14, '气', {
      fontFamily: '"PingFang SC", serif', fontSize: '11px', color: '#ff8a8a'
    }).setScrollFactor(0).setDepth(101);
    this.hpBarBg = this.add.rectangle(bx + 18, by - 9, 140, 8, 0x2a0d0d, 0.9)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(101)
      .setStrokeStyle(1, 0x6b2a2a, 0.8);
    this.hpBar = this.add.rectangle(bx + 19, by - 9, 138, 6, 0xe54b4b, 1)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(102);

    this.add.text(bx, by + 4, '力', {
      fontFamily: '"PingFang SC", serif', fontSize: '11px', color: '#7ae8c8'
    }).setScrollFactor(0).setDepth(101);
    this.stamBarBg = this.add.rectangle(bx + 18, by + 9, 140, 6, 0x0d2a22, 0.9)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(101)
      .setStrokeStyle(1, 0x2a6b54, 0.8);
    this.stamBar = this.add.rectangle(bx + 19, by + 9, 138, 4, 0x6bcfa8, 1)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(102);

    // 状态图标（潜行 / 疾跑 / 格挡）
    this.statusIcon = this.add.text(bx + 170, by, '', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '13px',
      color: '#fff3b8',
      stroke: '#000',
      strokeThickness: 3
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(102);

    // 时间
    this.timerText = this.add
      .text(20, 14, '03:00', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#d4af37'
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(101);

    // 收集进度
    this.relicCountText = this.add
      .text(480, 14, '已得文物：0 / 0', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '14px',
        color: '#e8d27a'
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101);

    // 提示
    this.hintText = this.add
      .text(940, 14, 'WASD移动 · 鼠标瞄向 · Shift潜行 · Ctrl疾跑 · J/左键攻击 · K格挡 · E拾取 · F阅读 · Tab背包', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '11px',
        color: '#a08434'
      })      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(101);

    // 拾取提示
    this.pickupPrompt = this.add
      .text(0, 0, '', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: '#fff3b8',
        backgroundColor: '#000000cc',
        padding: { x: 6, y: 3 }
      })
      .setOrigin(0.5, 1)
      .setDepth(110)
      .setVisible(false);

    // 剧情碎片阅读提示（屏幕下部居中）
    this.cluePromptText = this.add
      .text(480, 500, '', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '13px',
        color: '#d4af37',
        backgroundColor: '#000000cc',
        padding: { x: 8, y: 4 }
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(110)
      .setVisible(false);

    // —— 警觉条（顶部状态栏下方、居中靠左，避开 alertBar 被场景遮挡） ——
    this.add.text(20, 42, '警觉', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '12px',
      color: '#a08434'
    }).setScrollFactor(0).setDepth(101);
    this.alertBarBg = this.add.rectangle(56, 48, 160, 8, 0x222222, 0.85)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
    this.alertBarBg.setStrokeStyle(1, 0x6b5824, 0.7);
    this.alertBar = this.add.rectangle(57, 48, 0, 6, 0x6bcf6b, 1)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(102);

    this.updateRelicHUD();
  }

  // ——————————————————————————————————————
  //  背包面板：Tab 键开/关，4×6 网格 + 物品矩形
  // ——————————————————————————————————————
  toggleInventoryPanel() {
    if (this._ended) return;
    if (this.invPanel && this.invPanel.visible) {
      this.invPanel.setVisible(false);
      return;
    }
    if (!this.invPanel) this.buildInventoryPanel();
    this.invPanel.setVisible(true);
    this.refreshInventoryPanel();
  }

  buildInventoryPanel() {
    // 容器，统一控制显示/隐藏；放在屏幕右上角
    const cell = 28; // 单格像素
    const padding = 14;
    const panelW = INV_COLS * cell + padding * 2;
    const panelH = INV_ROWS * cell + padding * 2 + 26; // 顶部留标题
    const px = 960 - panelW - 16;
    const py = 56;

    this.invPanel = this.add.container(px, py).setDepth(150).setScrollFactor(0);

    // 背景：暗金风格
    const bg = this.add.rectangle(0, 0, panelW, panelH, 0x0a0a12, 0.94)
      .setOrigin(0, 0).setStrokeStyle(2, 0xd4af37, 0.7);
    this.invPanel.add(bg);

    // 标题
    const title = this.add.text(panelW / 2, 6, '行 囊', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '14px',
      color: '#d4af37',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0);
    this.invPanel.add(title);

    // 网格底
    this._invCellSize = cell;
    this._invOriginX = padding;
    this._invOriginY = 26;
    for (let r = 0; r < INV_ROWS; r++) {
      for (let c = 0; c < INV_COLS; c++) {
        const cx = this._invOriginX + c * cell;
        const cy = this._invOriginY + r * cell;
        const slot = this.add.rectangle(cx, cy, cell, cell, 0x1a1a26, 1)
          .setOrigin(0, 0)
          .setStrokeStyle(1, 0x3a3a4a, 0.9);
        this.invPanel.add(slot);
      }
    }

    // 动态层：用一个子容器装物品块，刷新时清空重绘
    this._invDynamic = this.add.container(0, 0);
    this.invPanel.add(this._invDynamic);

    // 底部价值
    this._invValueText = this.add.text(panelW / 2, panelH - 16, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '11px',
      color: '#e8d27a'
    }).setOrigin(0.5, 0);
    this.invPanel.add(this._invValueText);
  }

  refreshInventoryPanel() {
    if (!this.invPanel || !this._invDynamic) return;
    this._invDynamic.removeAll(true);
    const cell = this._invCellSize;
    const ox = this._invOriginX;
    const oy = this._invOriginY;

    for (const it of this.inventory.items) {
      const x = ox + it.x * cell;
      const y = oy + it.y * cell;
      const w = it.w * cell;
      const h = it.h * cell;
      const colorHex = (RARITY_COLOR[it.relic.rarity] || '#a08434').replace('#', '0x');
      const color = parseInt(colorHex, 16);
      // 背景色块（带透明度）
      const block = this.add.rectangle(x + 1, y + 1, w - 2, h - 2, color, 0.28)
        .setOrigin(0, 0)
        .setStrokeStyle(1, color, 0.95);
      this._invDynamic.add(block);
      // 文物图标（若有），居中缩放贴图
      const iconKey = it.relic.icon;
      if (iconKey && this.textures.exists(iconKey)) {
        const icon = this.add.image(x + w / 2, y + h / 2, iconKey).setOrigin(0.5);
        const tex = this.textures.get(iconKey).getSourceImage();
        const scale = Math.min((w - 6) / tex.width, (h - 6) / tex.height, 2);
        icon.setScale(scale);
        this._invDynamic.add(icon);
      }
      // 文物名称（小字）
      const nameTxt = this.add.text(x + 2, y + h - 11, it.relic.name, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '9px',
        color: '#fff3b8',
        stroke: '#000',
        strokeThickness: 2
      }).setOrigin(0, 0);
      // 限制名字宽度
      if (nameTxt.width > w - 4) nameTxt.setScale((w - 4) / nameTxt.width, 1);
      this._invDynamic.add(nameTxt);
    }

    const used = this.inventory.usedCells();
    const total = this.inventory.totalCells();
    const value = this.inventory.totalValue();
    this._invValueText.setText(`格数 ${used}/${total}    价值 ¥${value}`);
  }

  updateRelicHUD() {
    const got = this.inventory.items.length;
    const used = this.inventory.usedCells();
    const total = this.inventory.totalCells();
    const value = this.inventory.totalValue();
    this.relicCountText.setText(
      `文物 ${got}/${this.totalRelicsOnMap}    ·    背包 ${used}/${total}    ·    价值 ${value}`
    );
  }

  formatTime(s) {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  update() {
    if (!this.player || !this.player.body || this._ended) return;

    // —— 战斗状态读入 ——
    const ps = this.playerState;
    const now = this.time.now;
    // 帧时间（必须在所有用到 dtSec 的逻辑之前求得，否则 TDZ 会让 update 报错中断）
    const dtSec = Math.min(0.05, (now - (this._lastTime || now)) / 1000);
    ps.stealth = this.keys.SHIFT.isDown;
    // 疾跑：体力 > 0 且按 Ctrl 且未在格挡
    ps.blocking = this.keys.K.isDown && ps.stam > 5;
    ps.sprint = this.keys.CTRL.isDown && !ps.stealth && !ps.blocking && ps.stam > 0;

    // —— 移动速度（受 静步 / 疾跑 / 格挡 影响） ——
    let speed = 160;
    if (ps.stealth) speed = 80;
    else if (ps.sprint) speed = 230;
    if (ps.blocking) speed = 60;
    // 攻击挥刀瞬间略减速
    if (now < ps.attackUntil) speed *= 0.45;

    let vx = 0;
    let vy = 0;
    if (this.cursors.left.isDown || this.keys.A.isDown) vx = -1;
    if (this.cursors.right.isDown || this.keys.D.isDown) vx = 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) vy = -1;
    if (this.cursors.down.isDown || this.keys.S.isDown) vy = 1;

    if (vx !== 0 && vy !== 0) {
      vx *= 0.707;
      vy *= 0.707;
    }
    this.player.setVelocity(vx * speed, vy * speed);

    // —— 玩家行走帧切换 ——
    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      this._playerWalkAccum += dtSec;
      const stepTime = ps.sprint ? 0.10 : ps.stealth ? 0.30 : 0.18;
      if (this._playerWalkAccum >= stepTime) {
        this._playerWalkAccum = 0;
        this._playerWalkPhase = 1 - this._playerWalkPhase;
        this.player.setTexture(this._playerWalkPhase ? 'tex_player_walk' : 'tex_player');
        // 脚步音：随帧切换同步发出
        const mode = ps.sprint ? 'sprint' : ps.stealth ? 'stealth' : 'walk';
        Audio.sfx.footstep(mode);
      }
      // 朝向反转（鼠标在左 → 翻转贴图）
      const aimNow = this.player.getData('aim') || 0;
      this.player.setFlipX(Math.cos(aimNow) < 0);
    } else {
      this._playerWalkAccum = 0;
      if (this._playerWalkPhase !== 0) {
        this._playerWalkPhase = 0;
        this.player.setTexture('tex_player');
      }
    }

    // —— 体力（疾跑消耗、格挡消耗、其余恢复） ——
    const isMoving = vx !== 0 || vy !== 0;
    if (ps.sprint && isMoving) ps.stam = Math.max(0, ps.stam - 28 * dtSec);
    else if (ps.blocking) ps.stam = Math.max(0, ps.stam - 14 * dtSec);
    else ps.stam = Math.min(ps.stamMax, ps.stam + 18 * dtSec);

    // —— 攻击输入（J 键） ——
    if (Phaser.Input.Keyboard.JustDown(this.keys.J)) {
      this.tryPlayerAttack();
    }

    // —— 朝向：鼠标方向 ——
    const ptr = this.input.activePointer;
    const aim = Math.atan2(ptr.worldY - this.player.y, ptr.worldX - this.player.x);
    this.player.setData('aim', aim);

    // —— 检测附近可拾取文物 ——
    const nearestRelic = this.findNearest(this.relicGroup.getChildren(), 28);
    if (nearestRelic) {
      const data = nearestRelic.getData('relic');
      this.pickupPrompt
        .setText(`E  拾取  「${data.name}」`)
        .setPosition(nearestRelic.x, nearestRelic.y - 18)
        .setVisible(true);

      if (Phaser.Input.Keyboard.JustDown(this.keys.E)) {
        this.pickupRelic(nearestRelic);
      }
    } else {
      const inExit =
        Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          this.exitZone.x + 16,
          this.exitZone.y + 16
        ) < 30;
      if (inExit) {
        const cnt = this.inventory.items.length;
        this.pickupPrompt
          .setText(cnt > 0 ? `E  撤离（带回 ${cnt} 件，价值 ${this.inventory.totalValue()}）` : 'E  撤离（空手而归）')
          .setPosition(this.exitZone.x + 16, this.exitZone.y - 6)
          .setVisible(true);
        if (Phaser.Input.Keyboard.JustDown(this.keys.E)) {
          this.endRun(true);
        }
      } else {
        this.pickupPrompt.setVisible(false);
      }
    }

    // —— 守卫 AI 更新 ——
    this._lastTime = now;
    let maxAlert = 0;
    let caught = false;
    if (this.guards) {
      for (const g of this.guards) {
        const c = g.update(dtSec, this.player, this.walls);
        // 抓到：仅活的守卫且玩家未在无敌帧时计入；保留原直接致死语义改为扣血
        if (c && !g.dead && now > ps.invulnUntil) {
          this.applyPlayerDamage(1, g, '被守卫扑住！');
        }
        if (c) caught = c && false; // 不再立即结束（改为血量制）
        if (g.getAlertRatio() > maxAlert) maxAlert = g.getAlertRatio();
      }
    }
    this.updateAlertBar(maxAlert);

    // —— 心跳：警觉越高越快；完全安全时停止 ——
    this.updateHeartbeat(maxAlert);

    // —— 玩家攻击判定结算（命中守卫） ——
    this.resolvePlayerAttack();

    // —— HUD：血条 / 体力 / 状态图标 ——
    this.updatePlayerHUD();

    // —— 剧情碎片交互 ——
    this.updateClueInteraction();

    // —— 光照刷新 ——
    this.updateLighting();
  }

  updateAlertBar(ratio) {
    if (!this.alertBar) return;
    const w = Math.max(0, Math.min(1, ratio)) * 158;
    this.alertBar.width = w;
    let color = 0x6bcf6b;
    if (ratio > 0.99) color = 0xe54b4b;
    else if (ratio > 0.05) color = 0xf2c14e;
    this.alertBar.fillColor = color;
  }

  /** 警觉驱动心跳 + 屏幕轻微压暗 */
  updateHeartbeat(ratio) {
    // 警觉 > 0.5 启动心跳，越高越快
    if (ratio > 0.5) {
      const bpm = 90 + Math.floor(ratio * 80); // 90~170 BPM
      Audio.heartbeat.start(bpm);
      Audio.heartbeat.setBpm(bpm);
    } else {
      Audio.heartbeat.stop();
    }
    // 诡异屏幕压暗
    if (this.vignette) {
      const target = ratio * 0.32;
      const cur = this.vignette.alpha;
      // 平滑逼近
      this.vignette.setAlpha(cur + (target - cur) * 0.08);
    }
  }

  findNearest(arr, maxDist) {
    let nearest = null;
    let nd = maxDist;
    for (const o of arr) {
      if (!o.active) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, o.x, o.y);
      if (d < nd) {
        nd = d;
        nearest = o;
      }
    }
    return nearest;
  }

  pickupRelic(relic) {
    const data = relic.getData('relic');
    const item = this.inventory.tryAdd(data);
    if (!item) {
      // 背包装不下：弹出提示，保留文物
      Audio.sfx.bad();
      const ft = this.add
        .text(this.player.x, this.player.y - 24, '背包已满！', {
          fontFamily: '"PingFang SC", serif',
          fontSize: '14px',
          color: '#ff6b6b',
          stroke: '#000000',
          strokeThickness: 3
        })
        .setOrigin(0.5)
        .setDepth(110);
      this.tweens.add({
        targets: ft,
        y: ft.y - 24,
        alpha: 0,
        duration: 1000,
        onComplete: () => ft.destroy()
      });
      return;
    }
    // 拾取音效 + 金粉粒子
    Audio.sfx.pickup(data.rarity || 'rare');
    this.spawnPickupBurst(relic.x, relic.y, data.rarity || 'rare');

    // 移除文物对应位置的固定光晕
    this.staticLights = this.staticLights.filter(
      (L) => Phaser.Math.Distance.Between(L.x, L.y, relic.x, relic.y) > 4
    );
    relic.destroy();
    this.updateRelicHUD();
    if (this.invPanel && this.invPanel.visible) this.refreshInventoryPanel();

    // 浮动文字反馈（带价值）
    const ft = this.add
      .text(this.player.x, this.player.y - 24, `+ ${data.name}  (¥${data.value})`, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '13px',
        color: '#fff3b8',
        stroke: '#000000',
        strokeThickness: 2
      })
      .setOrigin(0.5)
      .setDepth(110);
    this.tweens.add({
      targets: ft,
      y: ft.y - 30,
      alpha: 0,
      duration: 1200,
      onComplete: () => ft.destroy()
    });

    // 主角内心闪话（接 AICompanion mock，错开浮动文字时间）
    this.time.delayedCall(220, () => {
      if (this._ended) return;
      const line = quipForPickup(data);
      this.showPlayerQuip(line);
    });

    // 夜枭批语卡片（异步调用 AICompanion）：为本件文物动态展示一句「AI 生成」的备注
    AICompanion.getRelicLore(data).then((lore) => {
      if (this._ended || !lore) return;
      this.showLoreCard(data, lore);
    });
  }

  /** 在屏幕右下角滑出一张「夜枭批语」卡，停留后消失 */
  showLoreCard(relic, lore) {
    const W = 300;
    const H = 78;
    const x = 960 - W - 16;
    const yEnd = 540 - H - 60;       // 最终位置
    const yStart = yEnd + 30;        // 从下方升起

    const layer = this.add.container(x, yStart).setScrollFactor(0).setDepth(140).setAlpha(0);

    // 背板
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1410, 0.92);
    bg.lineStyle(1, 0xd4af37, 0.85);
    bg.fillRoundedRect(0, 0, W, H, 6);
    bg.strokeRoundedRect(0, 0, W, H, 6);
    layer.add(bg);

    // 左上角：贴身划边 + 文物名
    const title = this.add.text(12, 8, relic.name, {
      fontFamily: '"PingFang SC", serif',
      fontSize: '13px',
      color: '#e8d27a',
      fontStyle: 'bold'
    });
    layer.add(title);

    // 右上角仔：夜枭语调标签
    const tag = this.add.text(W - 12, 10, '· 夜枭批语 ·', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#7a5a28'
    }).setOrigin(1, 0);
    layer.add(tag);

    // 下部批语（quote）
    const q = lore.quote || '——夜枭未至，旧物先言。';
    const quoteTxt = this.add.text(12, 30, q, {
      fontFamily: '"PingFang SC", serif',
      fontSize: '12px',
      color: '#d4af37',
      fontStyle: 'italic',
      wordWrap: { width: W - 24 }
    });
    layer.add(quoteTxt);

    // 提示“Tab 查看完整介绍”
    const hint = this.add.text(W - 12, H - 14, 'Tab 查阅详情', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '10px',
      color: '#6b5824'
    }).setOrigin(1, 0);
    layer.add(hint);

    // 动画：从下方滑起 → 停留 → 深入底部消失
    this.tweens.add({
      targets: layer,
      y: yEnd,
      alpha: 1,
      duration: 320,
      ease: 'Cubic.out'
    });
    this.time.delayedCall(2800, () => {
      this.tweens.add({
        targets: layer,
        y: yEnd + 20,
        alpha: 0,
        duration: 360,
        ease: 'Cubic.in',
        onComplete: () => layer.destroy()
      });
    });
  }

  /** 拾取金粉爆发粒子 */
  spawnPickupBurst(x, y, rarity) {
    const count = rarity === 'legendary' ? 22 : rarity === 'epic' ? 16 : 10;
    const tint = rarity === 'legendary' ? 0xffe070 : rarity === 'epic' ? 0xc084fc : 0xfff3b8;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const dist = 14 + Math.random() * 22;
      const dx = Math.cos(a) * dist;
      const dy = Math.sin(a) * dist - 8; // 轻微上飘
      const dur = 500 + Math.random() * 400;
      const sp = this.add.image(x, y, 'tex_dust')
        .setTint(tint)
        .setDepth(8)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.6 + Math.random() * 0.8);
      this.tweens.add({
        targets: sp,
        x: x + dx,
        y: y + dy,
        alpha: { from: 1, to: 0 },
        scale: { from: sp.scaleX, to: 0.2 },
        duration: dur,
        ease: 'Sine.out',
        onComplete: () => sp.destroy()
      });
    }
    // 中心闪光
    const flash = this.add.circle(x, y, 12, 0xffffff, 0.8).setDepth(7);
    this.tweens.add({
      targets: flash,
      scale: 3,
      alpha: 0,
      duration: 280,
      onComplete: () => flash.destroy()
    });
  }

  endRun(success, reason) {
    if (this._ended) return;
    this._ended = true;

    // 停止音频循环
    Audio.heartbeat.stop();
    if (success) Audio.sfx.exit();
    else Audio.sfx.fail();

    this.physics.pause();
    this.add.rectangle(0, 0, 960, 540, 0x000000, 0.88)
      .setOrigin(0, 0).setDepth(200).setScrollFactor(0);
    const title = success ? '撤　离　成　功' : '行　动　失　败';
    const titleColor = success ? '#d4af37' : '#ff6b6b';

    this.add
      .text(480, 180, title, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '40px',
        color: titleColor,
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201);

    if (reason) {
      this.add
        .text(480, 230, reason, {
          fontFamily: '"PingFang SC", serif',
          fontSize: '14px',
          color: '#a08434'
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(201);
    }

    const items = this.inventory.list();
    // —— 入库：记录撤离结果到 Codex（只有成功时文物才会被收入仓库） ——
    let newDiscoveries = [];
    if (success) {
      // 记录前快照"已发现"集合，差集即为本局新发现
      const beforeSet = new Set(Codex.discoveredIds());
      Codex.recordRun({
        success: true,
        items,
        value: this.inventory.totalValue()
      });
      newDiscoveries = items.filter((r) => r && r.id && !beforeSet.has(r.id));
    } else {
      Codex.recordRun({ success: false });
    }

    const lines = items.length
      ? items
          .map((r) => {
            const isNew = newDiscoveries.some((n) => n.id === r.id);
            return `${isNew ? '★ ' : '· '}${r.name}（${r.dynasty}）  ¥${r.value}`;
          })
          .join('\n')
      : '此行空手而归。';
    this.add
      .text(480, 320, lines, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '15px',
        color: '#e8d27a',
        align: 'center',
        lineSpacing: 6
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201);

    if (success && items.length) {
      this.add
        .text(480, 410, `合计价值：¥ ${this.inventory.totalValue()}`, {
          fontFamily: 'Georgia, serif',
          fontSize: '20px',
          color: '#d4af37',
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(201);

      // "新发现"提示（图鉴解锁感）
      if (newDiscoveries.length) {
        this.add
          .text(
            480,
            438,
            `★ 新入仓库 ${newDiscoveries.length} 件 · 仓库累计 ${Codex.discoveredIds().length} / ${RELICS.length}`,
            {
              fontFamily: '"PingFang SC", serif',
              fontSize: '13px',
              color: '#7ae8e8'
            }
          )
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(201);
      }
    }

    const btn = this.add
      .text(380, 470, '［ 再来一局 ］', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '20px',
        color: '#e8d27a'
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setColor('#fff3b8'));
    btn.on('pointerout', () => btn.setColor('#e8d27a'));
    btn.on('pointerdown', () => {
      this._ended = false;
      this.scene.restart();
    });

    const btn2 = this.add
      .text(580, 470, '［ 回到标题 ］', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '20px',
        color: '#a08434'
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201)
      .setInteractive({ useHandCursor: true });
    btn2.on('pointerover', () => btn2.setColor('#fff3b8'));
    btn2.on('pointerout', () => btn2.setColor('#a08434'));
    btn2.on('pointerdown', () => {
      this._ended = false;
      this.scene.start('TitleScene');
    });

    // 关卡种子（小字，便于复现 / 分享）
    if (this._level && typeof this._level.seed === 'number') {
      this.add
        .text(480, 510, `关卡种子：${this._level.seed.toString(16).padStart(8, '0')}`, {
          fontFamily: 'Georgia, serif',
          fontSize: '11px',
          color: '#6b5824'
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(201);
    }
  }

  // ============================================================
  //  互动 / 对话系统
  //  - 守卫气泡：状态切换时（巡逻→怀疑→追击→失去）触发不同台词
  //  - 拾取闪话：玩家拾取文物按品级触发主角内心独白
  //  - 剧情碎片：地图随机生成"线索物"，按 F 阅读，揭示守夜人组织剧情
  // ============================================================

  /**
   * 在世界坐标 (x,y) 上方弹出一个气泡，duration 后自动消失
   * @param {{x:number,y:number}} target 跟随目标（持续锚定）；若为 null 则 (x,y) 静止
   * @param {string} text 文本
   * @param {object} opts { color, fontSize, duration, dy }
   */
  showBubble(target, text, opts = {}) {
    const color = opts.color || '#fffbe6';
    const fontSize = opts.fontSize || '12px';
    const duration = opts.duration || 1800;
    const dy = opts.dy != null ? opts.dy : -22;

    const initX = target ? target.x : opts.x || 0;
    const initY = (target ? target.y : opts.y || 0) + dy;

    const bg = this.add.graphics().setDepth(115);
    const txt = this.add
      .text(initX, initY, text, {
        fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
        fontSize,
        color,
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
        wordWrap: { width: 180 }
      })
      .setOrigin(0.5, 1)
      .setDepth(116);

    const drawBg = () => {
      bg.clear();
      const pad = 4;
      const b = txt.getBounds();
      bg.fillStyle(0x1a1410, 0.78);
      bg.lineStyle(1, 0xa08434, 0.7);
      bg.fillRoundedRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2, 3);
      bg.strokeRoundedRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2, 3);
    };
    drawBg();

    // 跟随目标 + 渐升
    const startTime = this.time.now;
    const updater = this.time.addEvent({
      delay: 30,
      loop: true,
      callback: () => {
        if (target && target.active !== false) {
          txt.x = target.x;
          txt.y = target.y + dy - (this.time.now - startTime) * 0.008;
        }
        drawBg();
      }
    });

    this.tweens.add({
      targets: [txt, bg],
      alpha: { from: 1, to: 0 },
      duration: 400,
      delay: duration - 400,
      onComplete: () => {
        updater.remove();
        txt.destroy();
        bg.destroy();
      }
    });
  }

  /**
   * 守卫状态切换的回调：根据新旧状态选取台词
   */
  onGuardStateChange(newState, oldState, guard) {
    let line = null;
    let color = '#fffbe6';
    if (oldState === 'patrol' && newState === 'suspicious') {
      const opts = ['嗯？是谁？', '什么动静……', '有人吗？', '谁在那里？'];
      line = Phaser.Math.RND.pick(opts);
      color = '#f2c14e';
    } else if (newState === 'chase') {
      const opts = ['有贼！', '站住！', '抓贼！', '果然有人！'];
      line = Phaser.Math.RND.pick(opts);
      color = '#ff6b6b';
      Audio.sfx.alert();
    } else if ((oldState === 'chase' || oldState === 'suspicious') && newState === 'patrol') {
      const opts = ['……是错觉吗？', '老眼昏花。', '什么都没有。', '风声而已。'];
      line = Phaser.Math.RND.pick(opts);
      color = '#bbbbbb';
    }
    if (line) {
      this.showBubble(guard.sprite, line, { color, fontSize: '12px', duration: 1600, dy: -18 });
    }
  }

  /**
   * 拾取闪话：根据文物品级返回主角内心独白
   */
  pickupQuip(data) {
    const r = data.rarity;
    const pool = {
      legendary: ['神器在手……不能落他人之手。', '此物当还于天地。', '终于找到你了。'],
      epic: ['真品，份量十足。', '收好，别让它再流落。', '这一件，足够了。'],
      rare: ['小心翼翼……', '可惜，差一口气。', '暂且收好。']
    };
    const arr = pool[r] || pool.rare;
    return Phaser.Math.RND.pick(arr);
  }

  /**
   * 在玩家头顶弹出主角独白
   */
  showPlayerQuip(text, color = '#fff3b8') {
    this.showBubble(this.player, text, { color, fontSize: '12px', duration: 1600, dy: -22 });
  }

  // —— 剧情碎片 ——
  /**
   * 在关卡的空地随机散布若干"线索物"（旧日记 / 信件残页）
   * 由 createLevel 调用一次
   */
  spawnClueFragments() {
    if (!this._level) return;
    this.clues = this.physics.add.staticGroup();

    const allClues = this._cluePool || (this._cluePool = [
      {
        title: '泛黄日记・残页',
        body: '……癸丑年腊月，洋兵入园，先生手携三件，藏于井下。\n后人若得此页，望循"井"字寻之。',
        flag: 'diary_well'
      },
      {
        title: '守夜人手札',
        body: '我等非贼。我等只取流亡之物，归之于民。\n第一条戒律：不杀。第二条：不留。第三条：物归原处。',
        flag: 'creed'
      },
      {
        title: '拍卖行密信',
        body: '六月廿三，子时三刻。后院，红灯三盏。\n带白玉来——只此一次。',
        flag: 'auction'
      },
      {
        title: '老馆长的便笺',
        body: '若你看到这页，说明我已不在。\n第七展柜的螭吻……是赝品。真品在我家中佛龛之下。',
        flag: 'fake_chiwen'
      }
    ]);

    // 随机抽 2 张
    const picks = Phaser.Utils.Array.Shuffle(allClues.slice()).slice(0, 2);

    // 用 floor 坐标候选（程序化生成器提供的可行走地块），过滤掉撤离点 / 文物附近
    const floors = (this._level.floors || []).slice();
    const occupied = new Set();
    if (this._level.exit) occupied.add(`${this._level.exit.x},${this._level.exit.y}`);
    if (this._level.spawn) occupied.add(`${this._level.spawn.x},${this._level.spawn.y}`);
    for (const r of (this._level.relics || [])) occupied.add(`${r.x},${r.y}`);

    Phaser.Utils.Array.Shuffle(floors);
    const placed = [];
    for (const f of floors) {
      if (placed.length >= picks.length) break;
      const k = `${f.x},${f.y}`;
      if (occupied.has(k)) continue;
      // 距离玩家出生点至少 5 格
      if (this._level.spawn) {
        const d = Math.abs(f.x - this._level.spawn.x) + Math.abs(f.y - this._level.spawn.y);
        if (d < 5) continue;
      }
      placed.push(f);
      occupied.add(k);
    }

    for (let i = 0; i < placed.length && i < picks.length; i++) {
      const t = placed[i];
      const cx = t.x * TILE + TILE / 2;
      const cy = t.y * TILE + TILE / 2;
      const sp = this.clues.create(cx, cy, 'tex_clue').setDepth(6);
      sp.setData('clue', picks[i]);
      // 轻微闪烁吸引注意
      this.tweens.add({
        targets: sp,
        alpha: { from: 0.6, to: 1 },
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      });
    }
  }

  /**
   * 每帧检测玩家是否站在线索物附近，并处理 F 键阅读
   */
  updateClueInteraction() {
    if (!this.clues) return;
    const nearest = this.findNearest(this.clues.getChildren(), 26);
    if (nearest) {
      const data = nearest.getData('clue');
      if (this.cluePromptText) {
        this.cluePromptText.setText(`F  阅读  「${data.title}」`).setVisible(true);
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.F)) {
        this.openClueModal(data);
        nearest.destroy();
      }
    } else if (this.cluePromptText) {
      this.cluePromptText.setVisible(false);
    }
  }

  /**
   * 弹出阅读弹窗（暂停游戏内时间感，靠玩家关闭）
   */
  openClueModal(clue) {
    if (this._clueOpen) return;
    this._clueOpen = true;
    this.physics.pause();
    Audio.sfx.paper();


    const layer = this.add.container(0, 0).setDepth(190).setScrollFactor(0);
    const mask = this.add.rectangle(0, 0, 960, 540, 0x000000, 0.78).setOrigin(0, 0);
    const panel = this.add.rectangle(480, 270, 480, 280, 0x1a1410, 0.96).setStrokeStyle(2, 0xa08434);
    const title = this.add
      .text(480, 160, clue.title, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '22px',
        color: '#d4af37',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    const body = this.add
      .text(480, 270, clue.body, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '14px',
        color: '#fff3b8',
        align: 'center',
        wordWrap: { width: 420 },
        lineSpacing: 6
      })
      .setOrigin(0.5);
    const tip = this.add
      .text(480, 380, '按  F  /  ESC  收起', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: '#a08434'
      })
      .setOrigin(0.5);

    layer.add([mask, panel, title, body, tip]);

    // 记下已读 flag（供未来"图鉴解锁剧情"使用）
    try {
      const KEY = 'nk_clues_v1';
      const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (clue.flag && !arr.includes(clue.flag)) {
        arr.push(clue.flag);
        localStorage.setItem(KEY, JSON.stringify(arr));
      }
    } catch (e) { /* ignore */ }

    const close = () => {
      if (!this._clueOpen) return;
      this._clueOpen = false;
      layer.destroy();
      this.physics.resume();
    };
    // 一次性按键监听
    const onF = () => { close(); this.input.keyboard.off('keydown-F', onF); this.input.keyboard.off('keydown-ESC', onESC); };
    const onESC = () => { close(); this.input.keyboard.off('keydown-F', onF); this.input.keyboard.off('keydown-ESC', onESC); };
    // 延迟一帧避免本帧的 JustDown 立即关闭
    this.time.delayedCall(120, () => {
      this.input.keyboard.on('keydown-F', onF);
      this.input.keyboard.on('keydown-ESC', onESC);
    });
  }

  // ============================================================
  //  玩家战斗系统：攻击 / 格挡 / 受伤 / HUD
  // ============================================================

  /** J 键 / 鼠标左键调用：发起一次近战 */
  tryPlayerAttack() {
    if (this._ended) return;
    const ps = this.playerState;
    const now = this.time.now;
    if (now < ps.attackCooldownUntil) return;
    if (ps.blocking) return;        // 格挡中不能出刀
    if (ps.stam < 12) return;       // 体力不足

    ps.stam = Math.max(0, ps.stam - 14);
    ps.attackDir = this.player.getData('aim') || 0;
    ps.attackUntil = now + 220;     // 判定窗口
    ps.attackCooldownUntil = now + 360;
    ps.attackHitDone = false;

    // 视觉：玩家前方扇形刀光
    this.spawnSlashGfx(ps.attackDir);
    Audio.sfx.slash();
  }

  /** 每帧调用：攻击窗口内若命中则结算 */
  resolvePlayerAttack() {
    const ps = this.playerState;
    const now = this.time.now;
    if (now > ps.attackUntil || ps.attackHitDone) return;
    if (!this.guards) return;

    const HIT_RANGE = 32;
    const HIT_HALF = Math.PI / 3; // 60° 总
    const px = this.player.x;
    const py = this.player.y;
    const aim = ps.attackDir;

    let hitAny = false;
    for (const g of this.guards) {
      if (g.dead) continue;
      const dx = g.sprite.x - px;
      const dy = g.sprite.y - py;
      const dist = Math.hypot(dx, dy);
      if (dist > HIT_RANGE) continue;
      const ang = Math.atan2(dy, dx);
      const diff = Math.abs(Phaser.Math.Angle.Wrap(ang - aim));
      if (diff > HIT_HALF) continue;

      // 背刺：玩家从守卫背后命中（玩家相对守卫的位置在守卫背向 90° 内）→ 一击必杀
      const isBackstab = g.isPlayerBehind(this.player);
      const dmg = isBackstab ? 99 : 1;
      const dead = g.takeDamage(dmg, dx / Math.max(1, dist), dy / Math.max(1, dist));

      // 反馈
      this.cameras.main.shake(80, 0.003);
      this.showBubble(g.sprite, isBackstab ? '！' : (dead ? '×' : '!'),
        { color: isBackstab ? '#ff5050' : '#fff3b8', fontSize: '18px', duration: 700, dy: -20 });
      if (isBackstab) this.showPlayerQuip('一击毙之，了无声息。', '#ff8a8a');

      // 火星粒子
      this.spawnHitSparks(g.sprite.x, g.sprite.y, isBackstab);

      hitAny = true;
      ps.attackHitDone = true;
      break;
    }

    // 没打到也消耗了 attack 状态（不重复结算）
    if (!hitAny) ps.attackHitDone = true;
  }

  /** 玩家挥刀视觉特效 */
  spawnSlashGfx(aim) {
    const HIT_RANGE = 32;
    const HIT_HALF = Math.PI / 3;
    const g = this.add.graphics().setDepth(7);
    const px = this.player.x;
    const py = this.player.y;
    g.fillStyle(0xfff3b8, 0.55);
    g.beginPath();
    g.moveTo(px, py);
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const a = aim - HIT_HALF + (HIT_HALF * 2) * k;
      g.lineTo(px + Math.cos(a) * HIT_RANGE, py + Math.sin(a) * HIT_RANGE);
    }
    g.closePath();
    g.fillPath();
    g.lineStyle(1.5, 0xffffff, 0.85);
    g.strokePath();
    this.tweens.add({
      targets: g,
      alpha: 0,
      duration: 180,
      onComplete: () => g.destroy()
    });
  }

  /** 守卫挥刀命中玩家：判断格挡 → 扣血或弹反 */
  onGuardHitPlayer(guard) {
    if (this._ended) return;
    const ps = this.playerState;
    const now = this.time.now;
    if (now < ps.invulnUntil) return;

    // 格挡判定：玩家正面 90° 内来袭 + K 按住 + 体力 ≥ 18
    const fromX = guard.sprite.x;
    const fromY = guard.sprite.y;
    const ang = Math.atan2(fromY - this.player.y, fromX - this.player.x);
    const aim = this.player.getData('aim') || 0;
    const diff = Math.abs(Phaser.Math.Angle.Wrap(ang - aim));
    const blockOk = ps.blocking && ps.stam >= 18 && diff < Math.PI / 4;

    if (blockOk) {
      // 完美格挡：守卫硬直、玩家消耗体力，不扣血
      ps.stam = Math.max(0, ps.stam - 22);
      guard.staggerUntil = now + 600;
      guard.attackPhase = 'recover';
      guard.attackPhaseUntil = now + 320;
      this.cameras.main.shake(60, 0.002);
      this.showBubble(this.player, '挡！', { color: '#7ae8c8', fontSize: '16px', duration: 600, dy: -22 });
      // 闪光
      const f = this.add.circle(this.player.x, this.player.y, 18, 0xffffff, 0.8).setDepth(8);
      this.tweens.add({ targets: f, scale: 2, alpha: 0, duration: 220, onComplete: () => f.destroy() });
      Audio.sfx.block();
      this.spawnHitSparks(this.player.x, this.player.y, false);
      ps.invulnUntil = now + 250;
      return;
    }

    this.applyPlayerDamage(1, guard, '挨了一刀！');
  }

  /** 统一的玩家受伤入口 */
  applyPlayerDamage(amount, source, reasonHint) {
    const ps = this.playerState;
    const now = this.time.now;
    if (now < ps.invulnUntil) return;
    ps.hp = Math.max(0, ps.hp - amount);
    ps.invulnUntil = now + 700;
    // 受击反馈
    this.cameras.main.shake(120, 0.005);
    this.cameras.main.flash(140, 200, 0, 0);
    Audio.sfx.hurt();
    // 血粒子
    this.spawnBloodParticles(this.player.x, this.player.y);
    // 屏幕暗角闪动
    if (this.vignette) {
      this.vignette.setAlpha(0.85);
      this.tweens.add({ targets: this.vignette, alpha: 0.15, duration: 500, ease: 'Cubic.out' });
    }
    if (this.player) {
      this.player.setTint(0xff5555);
      this.time.delayedCall(180, () => {
        if (this.player && this.player.active) this.player.clearTint();
      });
      // 击退
      if (source && source.sprite) {
        const dx = this.player.x - source.sprite.x;
        const dy = this.player.y - source.sprite.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        this.player.setVelocity((dx / len) * 200, (dy / len) * 200);
      }
    }
    if (ps.hp <= 0) {
      this.endRun(false, reasonHint || '伤重不支，倒在博物馆中……');
    }
  }

  /** 火星粒子（攻击命中 / 格挡） */
  spawnHitSparks(x, y, big = false) {
    const count = big ? 14 : 8;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * 16;
      const sp = this.add.image(x, y, 'tex_spark')
        .setDepth(8)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.7 + Math.random() * 0.8);
      if (big) sp.setTint(0xff8060);
      this.tweens.add({
        targets: sp,
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist,
        alpha: { from: 1, to: 0 },
        scale: 0.2,
        duration: 320 + Math.random() * 160,
        onComplete: () => sp.destroy()
      });
    }
  }

  /** 血粒子（玩家受击） */
  spawnBloodParticles(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 16;
      const sp = this.add.image(x, y, 'tex_blood')
        .setDepth(8)
        .setScale(0.7 + Math.random() * 0.7);
      this.tweens.add({
        targets: sp,
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist + 4,
        alpha: { from: 1, to: 0 },
        scale: 0.3,
        duration: 360 + Math.random() * 200,
        onComplete: () => sp.destroy()
      });
    }
  }

  /** HUD 实时刷新：血条、体力条、状态图标 */
  updatePlayerHUD() {
    const ps = this.playerState;
    if (this.hpBar) {
      const w = (ps.hp / ps.hpMax) * 138;
      this.hpBar.width = Math.max(0, w);
      this.hpBar.fillColor = ps.hp <= 1 ? 0xff3030 : 0xe54b4b;
    }
    if (this.stamBar) {
      const w = (ps.stam / ps.stamMax) * 138;
      this.stamBar.width = Math.max(0, w);
      this.stamBar.fillColor = ps.stam < 18 ? 0xa0a0a0 : 0x6bcfa8;
    }
    if (this.statusIcon) {
      const tags = [];
      if (ps.blocking) tags.push('〔格挡〕');
      else if (ps.stealth) tags.push('〔潜行〕');
      else if (ps.sprint) tags.push('〔疾跑〕');
      this.statusIcon.setText(tags.join(' '));
    }
  }
}
