// IntroScene - 片头动画（电影级 · 基于 6 张分镜图）
// 6 张高质量国风分镜（1280x720 推荐）+ Ken Burns 镜头推拉 + 飘雪粒子 +
// 卷轴金边 + 水墨渐隐转场 + 打字机字幕。
// 任意时刻 SPACE/ENTER/点击 翻页；ESC 直接跳过；播完写入 localStorage。
//
// 美术资源：
//   public/assets/intro/01.png ~ 06.png（横版，建议 1280x720）

import Phaser from 'phaser';
import Audio from '../systems/AudioFx.js';

const W = 960;
const H = 540;

// 6 段叙事文字 + 对应分镜图键名
const SCRIPT = [
  {
    key: 'intro_01',
    file: 'assets/intro/01.png',
    title: '· 一 · 长夜',
    body: '近百年间，故土被劫，宝物流离。\n它们辗转黑市、私窟、海外密仓——无声蒙尘。',
    // Ken Burns: 起始/结束的缩放与位移（相对图中心）
    cam: { from: { s: 1.05, x: 0,   y:  20 }, to: { s: 1.18, x:  20, y: -10 } }
  },
  {
    key: 'intro_02',
    file: 'assets/intro/02.png',
    title: '· 二 · 流离',
    body: '青铜尊、唐三彩、万卷古帛……\n散落于异邦霓虹之下，无人识其归处。',
    cam: { from: { s: 1.18, x:  20, y: 0 },   to: { s: 1.04, x: -20, y: 10 } }
  },
  {
    key: 'intro_03',
    file: 'assets/intro/03.png',
    title: '· 三 · 集结',
    body: '于是，一群无名之人聚于飞檐之上——\n他们自称：「夜行司」。',
    cam: { from: { s: 1.10, x: -10, y: 10 },  to: { s: 1.22, x:  10, y: -20 } }
  },
  {
    key: 'intro_04',
    file: 'assets/intro/04.png',
    title: '· 四 · 入局',
    body: '走私货船、地下黑市、盗墓据点……\n哪里有失散之物，那里就是他们的去处。',
    cam: { from: { s: 1.20, x:  20, y: 0 },   to: { s: 1.05, x: -10, y: 10 } }
  },
  {
    key: 'intro_05',
    file: 'assets/intro/05.png',
    title: '· 五 · 取回',
    body: '怀抱失而复得的青铜，回身望向苍月——\n今夜，你接过这枚令牌。',
    cam: { from: { s: 1.06, x: 0,   y: 0 },   to: { s: 1.18, x:  10, y: -10 } }
  },
  {
    key: 'intro_06',
    file: 'assets/intro/06.png',
    title: '· 六 · 归藏',
    body: '让流离的国宝，回它该在的地方。\n——归藏，自此始。',
    cam: { from: { s: 1.10, x: 0,   y:  10 }, to: { s: 1.22, x: 0,   y: -10 } }
  }
];

const PAGE_DURATION = 4500; // 文字打完后保留多久（ms）
const TYPE_SPEED    = 42;   // 每字间隔（ms）
const KEN_BURNS_MS  = 9000; // 单张图镜头推进总时长

export default class IntroScene extends Phaser.Scene {
  constructor() { super('IntroScene'); }

  preload() {
    // 加载 6 张分镜图（如失败，showPage 会用纯黑底兜底）
    for (const p of SCRIPT) this.load.image(p.key, p.file);
    // 静默吞掉缺图错误，避免控制台一片红
    this.load.on('loaderror', (file) => {
      console.warn('[Intro] 资源加载失败:', file.key);
    });
  }

  create() {
    Audio.init();

    // —— 0. 黑色幕布 ——
    this.add.rectangle(0, 0, W, H, 0x000000).setOrigin(0, 0).setDepth(-100);

    // —— 1. 分镜图容器（用于 Ken Burns） ——
    // 每张图都建立一个 image，但只有当前页可见。
    this.frames = SCRIPT.map((p) => {
      const img = this.add.image(W / 2, H / 2, p.key)
        .setOrigin(0.5)
        .setDepth(0)
        .setAlpha(0);
      // 等比缩放到刚好填满屏幕（cover 模式）
      img.on('addedtoscene', () => this._fitCover(img));
      // 立即 fit 一次
      this._fitCover(img);
      return img;
    });

    // —— 2. 暗角（vignette） ——
    const vignette = this.add.graphics().setDepth(20).setScrollFactor(0);
    vignette.fillStyle(0x000000, 1);
    // 用四条渐变矩形叠出暗角效果（避免依赖 mask）
    const edge = 120;
    vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.85, 0.85, 0, 0);
    vignette.fillRect(0, 0, W, edge);
    vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.85, 0.85);
    vignette.fillRect(0, H - edge, W, edge);
    vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.85, 0, 0.85, 0);
    vignette.fillRect(0, 0, edge, H);
    vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.85, 0, 0.85);
    vignette.fillRect(W - edge, 0, edge, H);

    // —— 3. 飘雪/尘粒 粒子 ——
    this._createSnowTexture();
    this.snow = this.add.particles(0, 0, 'tex_snow', {
      x: { min: 0, max: W },
      y: -20,
      lifespan: 7000,
      speedY: { min: 18, max: 38 },
      speedX: { min: -10, max: 10 },
      scale: { start: 0.4, end: 0.8 },
      alpha: { start: 0.45, end: 0 },
      quantity: 1,
      frequency: 220,
      blendMode: 'ADD'
    }).setDepth(15);

    // —— 4. 卷轴金边（顶部 / 底部条幅） ——
    this.scrollTop = this.add.rectangle(W / 2, 0, W, 64, 0x0a0805, 0.92)
      .setOrigin(0.5, 0).setDepth(50);
    this.scrollBot = this.add.rectangle(W / 2, H, W, 64, 0x0a0805, 0.92)
      .setOrigin(0.5, 1).setDepth(50);
    this.add.rectangle(W / 2, 64, W, 1, 0xd4af37).setAlpha(0.55).setDepth(51);
    this.add.rectangle(W / 2, H - 64, W, 1, 0xd4af37).setAlpha(0.55).setDepth(51);

    // 顶部小标题（朝代意象）
    this.add.text(W / 2, 32, '夜  行  司  ·  归  藏', {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '14px',
      color: '#a08434',
      letterSpacing: 6
    }).setOrigin(0.5).setDepth(52);

    // —— 5. 章节标号（左下） & 跳过提示（右下） ——
    this.titleTxt = this.add.text(38, H - 48, '', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '16px',
      color: '#d4af37',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5).setDepth(60).setAlpha(0);

    this.skipHint = this.add.text(W - 24, H - 32, 'SPACE/点击 继续    ESC 跳过', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '12px',
      color: '#6b5824'
    }).setOrigin(1, 0.5).setDepth(60);

    // —— 6. 正文（打字机·居中底部） ——
    this.bodyShadow = this.add.text(W / 2 + 1, H - 105 + 1, '', {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '20px',
      color: '#000000',
      align: 'center',
      lineSpacing: 12
    }).setOrigin(0.5, 0).setDepth(59).setAlpha(0.6);

    this.bodyTxt = this.add.text(W / 2, H - 105, '', {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '20px',
      color: '#fff3b8',
      align: 'center',
      lineSpacing: 12,
      stroke: '#1a1208',
      strokeThickness: 3
    }).setOrigin(0.5, 0).setDepth(60);

    // —— 7. 进度点 ——
    this.dots = [];
    const dotW = SCRIPT.length * 14;
    for (let i = 0; i < SCRIPT.length; i++) {
      const d = this.add.rectangle(W / 2 - dotW / 2 + i * 14 + 6, H - 32, 6, 6, 0x3d3520)
        .setDepth(60);
      this.dots.push(d);
    }

    // —— 8. 转场遮罩（水墨渐隐用） ——
    this.transition = this.add.rectangle(0, 0, W, H, 0x000000, 0)
      .setOrigin(0, 0).setDepth(40);

    this.pageIdx = -1;

    // —— 9. 输入 ——
    this.input.keyboard.on('keydown-SPACE', () => this.advance());
    this.input.keyboard.on('keydown-ENTER', () => this.advance());
    this.input.keyboard.on('keydown-ESC',   () => this.finish());
    this.input.on('pointerdown', () => this.advance());

    // —— 10. 卷轴拉开后再开始 ——
    this.scrollTop.scaleY = 4;
    this.scrollBot.scaleY = 4;
    this.cameras.main.fadeIn(500, 0, 0, 0);
    this.tweens.add({
      targets: [this.scrollTop, this.scrollBot],
      scaleY: 1,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => this.showPage(0)
    });
  }

  /** 把图片"cover"地填满 W x H */
  _fitCover(img) {
    const tex = img.texture;
    if (!tex || !tex.source[0]) return;
    const iw = tex.getSourceImage().width || 1;
    const ih = tex.getSourceImage().height || 1;
    const s = Math.max(W / iw, H / ih);
    img.setScale(s);
  }

  /** 程序生成飘雪/灰尘小贴图（4x4 软圆点） */
  _createSnowTexture() {
    if (this.textures.exists('tex_snow')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 2);
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(4, 4, 4);
    g.generateTexture('tex_snow', 8, 8);
    g.destroy();
  }

  showPage(i) {
    if (i >= SCRIPT.length) { this.finish(); return; }
    const prev = this.pageIdx;
    this.pageIdx = i;
    const data = SCRIPT[i];

    // 清理旧的定时器/补间
    if (this._typing)  { this._typing.remove(false);  this._typing = null; }
    if (this._autoNext){ this._autoNext.remove(false); this._autoNext = null; }
    if (this._kenBurns){ this._kenBurns.stop(); this._kenBurns = null; }

    // 进度点
    this.dots.forEach((d, k) => d.setFillStyle(k <= i ? 0xd4af37 : 0x3d3520));

    // 当前帧 / 上一帧
    const cur = this.frames[i];
    const old = prev >= 0 ? this.frames[prev] : null;

    // 重置当前帧的初始位置（Ken Burns 起点）
    const baseScale = cur.scale; // _fitCover 的基础值
    const c0 = data.cam.from;
    cur.setScale(baseScale * c0.s);
    cur.setPosition(W / 2 + c0.x, H / 2 + c0.y);
    cur.setAlpha(0);

    // 标题/正文先隐（关键：alpha 要重置为 1，否则上一页淡出后就再也看不见了）
    this.titleTxt.setText(data.title).setAlpha(0);
    this.bodyTxt.setText('').setAlpha(1);
    this.bodyShadow.setText('').setAlpha(0.6);

    Audio.sfx.click && Audio.sfx.click();

    // —— 水墨渐隐切换：先把转场遮罩拉黑，再逐渐透明 ——
    if (old) {
      // 旧帧顺势淡出
      this.tweens.add({ targets: old, alpha: 0, duration: 700, ease: 'Sine.easeIn' });
    }

    this.transition.setFillStyle(0x000000).setAlpha(prev < 0 ? 0 : 0.55);
    this.tweens.add({
      targets: this.transition,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut'
    });

    // 新帧淡入
    this.tweens.add({
      targets: cur,
      alpha: 1,
      duration: 900,
      ease: 'Cubic.easeOut'
    });

    // 标题滑入
    this.titleTxt.setX(20);
    this.tweens.add({
      targets: this.titleTxt,
      x: 38,
      alpha: 1,
      duration: 700,
      delay: 200,
      ease: 'Cubic.easeOut'
    });

    // —— Ken Burns 镜头：缓慢推进/位移 ——
    const c1 = data.cam.to;
    this._kenBurns = this.tweens.add({
      targets: cur,
      scale: baseScale * c1.s,
      x: W / 2 + c1.x,
      y: H / 2 + c1.y,
      duration: KEN_BURNS_MS,
      ease: 'Sine.easeInOut'
    });

    // 文字延迟一点开始打字（让镜头先出来）
    this.time.delayedCall(700, () => this.startTyping(data.body));
  }

  startTyping(text) {
    let idx = 0;
    this._typing = this.time.addEvent({
      delay: TYPE_SPEED,
      loop: true,
      callback: () => {
        idx++;
        const slice = text.slice(0, idx);
        this.bodyTxt.setText(slice);
        this.bodyShadow.setText(slice);
        if (idx >= text.length) {
          this._typing.remove(false);
          this._typing = null;
          this._autoNext = this.time.delayedCall(PAGE_DURATION, () => this.advance());
        }
      }
    });
  }

  advance() {
    if (this._typing) {
      // 立即补完
      const t = SCRIPT[this.pageIdx].body;
      this._typing.remove(false);
      this._typing = null;
      this.bodyTxt.setText(t);
      this.bodyShadow.setText(t);
      this._autoNext = this.time.delayedCall(900, () => this.advance());
      return;
    }
    if (this._autoNext) { this._autoNext.remove(false); this._autoNext = null; }

    // 出场：转场遮罩拉黑 → 切下一页
    this.tweens.add({
      targets: [this.bodyTxt, this.bodyShadow, this.titleTxt],
      alpha: 0,
      duration: 350
    });
    this.tweens.add({
      targets: this.transition,
      alpha: 1,
      duration: 600,
      ease: 'Cubic.easeIn',
      onComplete: () => this.showPage(this.pageIdx + 1)
    });
  }

  finish() {
    try { localStorage.setItem('nightkeeper:seenIntro', '1'); } catch (e) { /* ignore */ }
    // 卷轴合上 → 黑屏 → 进 Hub
    this.tweens.add({
      targets: [this.scrollTop, this.scrollBot],
      scaleY: 4,
      duration: 700,
      ease: 'Cubic.easeIn'
    });
    this.cameras.main.fadeOut(900, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('HubScene'));
  }
}
