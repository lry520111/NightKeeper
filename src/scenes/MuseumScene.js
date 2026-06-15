// MuseumScene - 博物馆关卡（Day1 雏形：移动 + 拾取 + 撤离）
// 后续 Day2-3 会在此基础上加入：守卫 AI / 视野系统 / 潜行机制
import Phaser from 'phaser';
import { RELICS } from '../data/relics.js';

const TILE = 32;
const MAP_W = 30; // 30 * 32 = 960
const MAP_H = 17; // 17 * 32 = 544

export default class MuseumScene extends Phaser.Scene {
  constructor() {
    super('MuseumScene');
    this.collectedRelics = [];
    this.totalRelicsOnMap = 0;
  }

  create() {
    this.cameras.main.fadeIn(500, 0, 0, 0);
    this.collectedRelics = [];

    // —— 1. 铺地板 ——
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        this.add.image(x * TILE, y * TILE, 'tex_floor').setOrigin(0, 0);
      }
    }

    // —— 2. 墙体（外圈 + 几道展厅隔墙） ——
    this.walls = this.physics.add.staticGroup();
    // 外圈
    for (let x = 0; x < MAP_W; x++) {
      this.spawnWall(x, 0);
      this.spawnWall(x, MAP_H - 1);
    }
    for (let y = 0; y < MAP_H; y++) {
      this.spawnWall(0, y);
      this.spawnWall(MAP_W - 1, y);
    }
    // 内部隔墙：把空间分成 3 个展厅
    // 竖墙 1 (x=10) 上半段
    for (let y = 1; y <= 6; y++) this.spawnWall(10, y);
    // 竖墙 2 (x=20) 下半段
    for (let y = 10; y <= MAP_H - 2; y++) this.spawnWall(20, y);
    // 横墙 (y=8) 中间一段
    for (let x = 5; x <= 24; x++) {
      if (x !== 12 && x !== 13 && x !== 18 && x !== 19) this.spawnWall(x, 8);
    }

    // —— 3. 文物（在每个展厅放一些） ——
    this.relicGroup = this.physics.add.group();
    const relicSpawns = [
      { x: 4, y: 3, relicIdx: 0 }, // 兔首
      { x: 7, y: 5, relicIdx: 4 }, // 玉琮
      { x: 15, y: 4, relicIdx: 1 }, // 大克鼎
      { x: 25, y: 3, relicIdx: 2 }, // 敦煌写经
      { x: 4, y: 13, relicIdx: 3 }, // 汝窑碗
      { x: 15, y: 12, relicIdx: 5 }, // 唐三彩
      { x: 25, y: 14, relicIdx: 6 }  // 清明上河图
    ];
    relicSpawns.forEach((s) => {
      const data = RELICS[s.relicIdx];
      const r = this.relicGroup.create(s.x * TILE + TILE / 2, s.y * TILE + TILE / 2, 'tex_relic');
      r.setData('relic', data);
      // 微微脉冲提示交互物
      this.tweens.add({
        targets: r,
        scale: { from: 1, to: 1.2 },
        duration: 800,
        yoyo: true,
        repeat: -1
      });
    });
    this.totalRelicsOnMap = relicSpawns.length;

    // —— 4. 撤离点（右下角） ——
    this.exitZone = this.physics.add
      .staticImage((MAP_W - 3) * TILE, (MAP_H - 3) * TILE, 'tex_exit')
      .setOrigin(0, 0);
    this.add
      .text(this.exitZone.x + 16, this.exitZone.y - 14, '撤离', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: '#7ae8e8'
      })
      .setOrigin(0.5);

    // —— 5. 玩家（左上角生成） ——
    this.player = this.physics.add.sprite(2 * TILE + TILE / 2, 2 * TILE + TILE / 2, 'tex_player');
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(14, 20);

    this.physics.add.collider(this.player, this.walls);

    // —— 6. 输入 ——
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      SHIFT: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      E: Phaser.Input.Keyboard.KeyCodes.E,
      ESC: Phaser.Input.Keyboard.KeyCodes.ESC
    });

    // —— 7. HUD ——
    this.createHUD();

    // —— 8. 倒计时（180 秒撤离时限） ——
    this.timeLeft = 180;
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.timeLeft--;
        this.timerText.setText(this.formatTime(this.timeLeft));
        if (this.timeLeft <= 30) this.timerText.setColor('#ff6b6b');
        if (this.timeLeft <= 0) this.endRun(false, '开馆铃响起，被保安发现……');
      }
    });

    // —— 9. ESC 返回标题 ——
    this.keys.ESC.on('down', () => {
      this.scene.start('TitleScene');
    });
  }

  spawnWall(tx, ty) {
    const w = this.walls.create(tx * TILE, ty * TILE, 'tex_wall').setOrigin(0, 0);
    w.refreshBody();
    return w;
  }

  createHUD() {
    // 顶部状态条背景
    this.add.rectangle(0, 0, 960, 28, 0x000000, 0.7).setOrigin(0, 0).setScrollFactor(0).setDepth(100);

    // 时间
    this.timerText = this.add
      .text(20, 14, '03:00', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#d4af37'
      })
      .setOrigin(0, 0.5)
      .setDepth(101);

    // 收集进度
    this.relicCountText = this.add
      .text(480, 14, '已得文物：0 / 0', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '14px',
        color: '#e8d27a'
      })
      .setOrigin(0.5)
      .setDepth(101);

    // 提示
    this.hintText = this.add
      .text(940, 14, 'WASD 移动  E 拾取/撤离  ESC 退出', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: '#a08434'
      })
      .setOrigin(1, 0.5)
      .setDepth(101);

    // 拾取提示（场景内浮动）
    this.pickupPrompt = this.add
      .text(0, 0, '', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: '#fff3b8',
        backgroundColor: '#000000aa',
        padding: { x: 6, y: 3 }
      })
      .setOrigin(0.5, 1)
      .setDepth(50)
      .setVisible(false);

    this.updateRelicHUD();
  }

  updateRelicHUD() {
    this.relicCountText.setText(`已得文物：${this.collectedRelics.length} / ${this.totalRelicsOnMap}`);
  }

  formatTime(s) {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  update() {
    if (!this.player || !this.player.body) return;

    // —— 移动 ——
    const speed = this.keys.SHIFT.isDown ? 80 : 160; // Shift 潜行
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

    // —— 检测附近可拾取文物 ——
    const nearestRelic = this.findNearest(this.relicGroup.getChildren(), 28);
    if (nearestRelic) {
      const data = nearestRelic.getData('relic');
      this.pickupPrompt
        .setText(`E  拾取  「${data.name}」`)
        .setPosition(nearestRelic.x, nearestRelic.y - 14)
        .setVisible(true);

      if (Phaser.Input.Keyboard.JustDown(this.keys.E)) {
        this.pickupRelic(nearestRelic);
      }
    } else {
      // 检测撤离点
      const inExit =
        Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          this.exitZone.x + 16,
          this.exitZone.y + 16
        ) < 24;
      if (inExit) {
        this.pickupPrompt
          .setText(this.collectedRelics.length > 0 ? `E  撤离（带回 ${this.collectedRelics.length} 件）` : 'E  撤离（空手而归）')
          .setPosition(this.exitZone.x + 16, this.exitZone.y - 6)
          .setVisible(true);
        if (Phaser.Input.Keyboard.JustDown(this.keys.E)) {
          this.endRun(true);
        }
      } else {
        this.pickupPrompt.setVisible(false);
      }
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
    this.collectedRelics.push(data);
    relic.destroy();
    this.updateRelicHUD();

    // 浮动文字反馈
    const ft = this.add
      .text(this.player.x, this.player.y - 24, `+ ${data.name}`, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '13px',
        color: '#fff3b8'
      })
      .setOrigin(0.5)
      .setDepth(60);
    this.tweens.add({
      targets: ft,
      y: ft.y - 30,
      alpha: 0,
      duration: 1200,
      onComplete: () => ft.destroy()
    });
  }

  endRun(success, reason) {
    if (this._ended) return;
    this._ended = true;

    this.physics.pause();
    const overlay = this.add.rectangle(0, 0, 960, 540, 0x000000, 0.85).setOrigin(0, 0).setDepth(200);
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
      .setDepth(201);

    if (reason) {
      this.add
        .text(480, 230, reason, { fontFamily: '"PingFang SC", serif', fontSize: '14px', color: '#a08434' })
        .setOrigin(0.5)
        .setDepth(201);
    }

    // 列出带回的文物
    const lines = this.collectedRelics.length
      ? this.collectedRelics.map((r) => `· ${r.name}（${r.dynasty}）`).join('\n')
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
      .setDepth(201);

    const btn = this.add
      .text(480, 460, '［ 回到标题 ］', { fontFamily: '"PingFang SC", serif', fontSize: '20px', color: '#e8d27a' })
      .setOrigin(0.5)
      .setDepth(201)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setColor('#fff3b8'));
    btn.on('pointerout', () => btn.setColor('#e8d27a'));
    btn.on('pointerdown', () => {
      this._ended = false;
      this.scene.start('TitleScene');
    });
  }
}
