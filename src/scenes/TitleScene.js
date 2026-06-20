// TitleScene - 标题菜单
import Phaser from 'phaser';
import Codex from '../systems/Codex.js';
import SaveSlots from '../systems/SaveSlots.js';
import { RELICS } from '../data/relics.js';
import Audio from '../systems/AudioFx.js';

const TITLE_SHOTS = [
  { key: 'title_anim_01', duration: 4000, start: 1.04, end: 1.1, offsetX: -78, panX: 18, panY: 14, fog: true, shimmer: true },
  { key: 'title_anim_02', duration: 3000, start: 1.08, end: 1.18, offsetX: -165, panX: 10, panY: 0, zoom: true, sweep: true, sweepAlpha: 0.1, relicGlow: true },
  { key: 'title_anim_03', duration: 5000, start: 1.0, end: 1.0, panX: 0, panY: 0, comic: true },
  { key: 'title_anim_04', duration: 6000, start: 1.0, end: 1.05, offsetX: -18, panX: 30, panY: 0, zoom: true, alarm: true, cluePanels: ['title_panel_6_1', 'title_panel_6_2', 'title_panel_6_3', 'title_panel_6_4'], clueSide: 'left', lantern: true, investigation: true },
  { key: 'title_anim_06', duration: 6000, start: 1.05, end: 1.12, offsetX: -42, panX: 10, panY: 3, zoom: true, cluePanels: ['title_panel_8_1', 'title_panel_8_2', 'title_panel_8_3', 'title_panel_8_4'], clueSide: 'right', ship: true, fog: true },
  { key: 'title_bg_09', duration: 10000, start: 1.0, end: 1.0, panX: 0, panY: 0, convergencePanels: ['title_panel_10_1', 'title_panel_10_2'], convergence: true },
  { key: 'title_anim_10', duration: 9000, start: 1.06, end: 1.1, panX: 0, panY: 0, zoom: true, returned: true, sweep: true, sweepAlpha: 0.08 },
];

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    const { width, height } = this.scale;

    // —— BGM: title screen music ——
    Audio.init();
    Audio.bgm.play('bgm_title', { loop: true, fade: 1000, volume: 0.35 });

    // 背景
    this.add.rectangle(0, 0, width, height, 0x050505).setOrigin(0, 0).setDepth(-100);
    this._createTitlePseudoAnimation(width, height);
    this.add.rectangle(0, 0, width, height, 0x030303, 0.16).setOrigin(0, 0);
    this._createTitleMenuOverlay(width, height);

    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  _createTitleMenuOverlay(width, height) {
    const panelH = Math.min(470, Math.round(height * 0.64));
    this._menuHiddenY = -panelH - 18;
    this._menuOpenY = 0;
    this._menuOpen = false;
    this._menuAnimating = false;
    this._menuSelected = 0;

    this._menuHint = this.add.text(width - 26, height - 28, 'TAB / ENTER', {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '12px',
      color: '#8a7030'
    })
      .setOrigin(1, 0.5)
      .setDepth(42)
      .setAlpha(0.62);

    this._menuLayer = this.add.container(0, this._menuHiddenY).setDepth(40);
    const shadow = this.add.rectangle(width / 2, panelH + 10, width, 24, 0x000000, 0.34).setOrigin(0.5, 0);
    const panel = this.add.rectangle(width / 2, 0, width, panelH, 0x2b2b2b, 0.64).setOrigin(0.5, 0);
    const topLine = this.add.rectangle(width / 2, 0, width, 2, 0x4d3b18, 0.9).setOrigin(0.5, 0);
    const bottomLine = this.add.rectangle(width / 2, panelH - 2, width * 0.74, 2, 0xd4af37, 0.78).setOrigin(0.5, 0);
    this._menuLayer.add([shadow, panel, topLine, bottomLine]);

    const title = this.add.text(width / 2, 70, '夜　行　者', {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '46px',
      color: '#d6b35a',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    const subtitle = this.add.text(width / 2, 116, '— 归　藏 —', {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '18px',
      color: '#9f833f'
    }).setOrigin(0.5);
    const tagline = this.add.text(width / 2, 140, '一段被盗国宝的追回行动', {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '12px',
      color: '#776334'
    }).setOrigin(0.5);
    this._menuLayer.add([title, subtitle, tagline]);

    const items = this._buildTitleMenuItems();
    this._menuButtons = [];
    const centerX = width / 2;
    const totalGap = items.reduce((sum, item) => sum + (item.gapBelow || 0), 0);
    let cursorY = 294 - totalGap / 2;

    items.forEach((item, index) => {
      const y = cursorY;
      const marker = this.add.text(centerX - 138, y, '◆', {
        fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
        fontSize: '13px',
        color: '#e0c16a'
      }).setOrigin(0.5).setVisible(false);
      const label = this.add.text(centerX, y, item.label, {
        fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
        fontSize: item.size || '16px',
        color: item.color || '#9e8240'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      const hint = item.hint ? this.add.text(centerX + 138, y + 1, item.hint, {
        fontFamily: 'Georgia, "Microsoft YaHei", serif',
        fontSize: '11px',
        color: '#5f5436',
        fontStyle: 'italic'
      }).setOrigin(0, 0.5) : null;

      label.on('pointerover', () => this._setTitleMenuSelection(index));
      label.on('pointerdown', () => {
        this._setTitleMenuSelection(index);
        this._confirmTitleMenuSelection();
      });
      this._menuLayer.add(hint ? [marker, label, hint] : [marker, label]);
      this._menuButtons.push({
        marker,
        label,
        hint,
        action: item.action,
        baseColor: item.color || '#9e8240'
      });
      cursorY += item.gapBelow || 0;
    });

    const progress = this._titleProgressText();
    const progressText = this.add.text(width / 2, panelH - 58, progress, {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '12px',
      color: '#8a7030'
    }).setOrigin(0.5);
    const controls = this.add.text(width / 2, panelH - 30, 'W/S 或 ↑/↓ 选择　·　Enter/Space 确认　·　Tab/Esc 收起', {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '11px',
      color: '#65562b'
    }).setOrigin(0.5);
    this._menuLayer.add([progressText, controls]);

    this._setTitleMenuSelection(0);
    this._bindTitleMenuKeys();
  }

  _buildTitleMenuItems() {
    return [
      {
        label: '［ 继续夜行 ］',
        size: '22px',
        color: '#e8d27a',
        gapBelow: 40,
        action: () => {
          const seen = (() => {
            try { return localStorage.getItem(SaveSlots.slotKey('nightkeeper:seenIntro')) === '1'; }
            catch { return false; }
          })();
          SaveSlots.touchActive();
          this._fadeToScene(seen ? 'HubScene' : 'IntroScene', null, 400);
        }
      },
      {
        label: '［ 存档管理 ］',
        size: '16px',
        color: '#a08434',
        gapBelow: 32,
        action: () => this._fadeToScene('SaveSlotsScene')
      },
      {
        label: '［ 文物图鉴 ］',
        size: '16px',
        color: '#a08434',
        gapBelow: 28,
        action: () => this._fadeToScene('CodexScene')
      },
      {
        label: '［ 重看序章 ］',
        size: '13px',
        color: '#7a6228',
        gapBelow: 24,
        action: () => this._fadeToScene('IntroScene')
      },
      {
        label: '［ 结局预览 · 开发 ］',
        size: '12px',
        color: '#5a4a20',
        gapBelow: 22,
        action: () => this._fadeToScene('EndingPreviewScene')
      },
      {
        label: '［ Boss 房 · 开发 ］',
        size: '12px',
        color: '#5a4a20',
        gapBelow: 0,
        action: () => this._fadeToScene('BossRoomScene', {
          biome: 'blackmarket',
          inventory: { items: [], totalValue: 0 },
          playerHP: 6,
          runStats: { kills: 0, alerts: 0, devEntry: true },
          bonusGold: 0,
          bonusRep: 0
        })
      }
    ];
  }

  _titleProgressText() {
    const activeSlot = SaveSlots.getActiveSlot();
    const slotLabel = activeSlot ? `当前存档：${activeSlot.name}` : '归藏待启';
    const state = Codex.getState();
    const found = Object.keys(state.relics).length;
    return found > 0
      ? `${slotLabel}  ·  仓库 ${found} / ${RELICS.length}  ·  追回行动 ${state.runs.success} 次`
      : `${slotLabel}  ·  共 ${RELICS.length} 件国宝待归仓`;
  }

  _bindTitleMenuKeys() {
    this.input.keyboard.on('keydown-TAB', (event) => {
      if (event && event.preventDefault) event.preventDefault();
      this._toggleTitleMenu();
    });
    this.input.keyboard.on('keydown-ESC', () => {
      if (this._menuOpen) this._toggleTitleMenu(false);
    });
    this.input.keyboard.on('keydown-ENTER', () => {
      if (!this._menuOpen) this._toggleTitleMenu(true);
      else this._confirmTitleMenuSelection();
    });
    this.input.keyboard.on('keydown-SPACE', () => {
      if (!this._menuOpen) this._toggleTitleMenu(true);
      else this._confirmTitleMenuSelection();
    });
    this.input.keyboard.on('keydown-UP', () => this._moveTitleMenuSelection(-1));
    this.input.keyboard.on('keydown-W', () => this._moveTitleMenuSelection(-1));
    this.input.keyboard.on('keydown-DOWN', () => this._moveTitleMenuSelection(1));
    this.input.keyboard.on('keydown-S', () => this._moveTitleMenuSelection(1));
  }

  _toggleTitleMenu(forceOpen = null) {
    if (this._menuAnimating || !this._menuLayer) return;
    const opening = forceOpen === null ? !this._menuOpen : !!forceOpen;
    if (opening === this._menuOpen) return;

    Audio.init();
    Audio.sfx.click();
    this._menuAnimating = true;
    this.tweens.killTweensOf(this._menuLayer);

    if (opening) {
      this.tweens.add({ targets: this._menuHint, alpha: 0, duration: 180, ease: 'Sine.out' });
      this._menuLayer.setVisible(true);
      this.tweens.add({
        targets: this._menuLayer,
        y: this._menuOpenY,
        duration: 460,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this._menuOpen = true;
          this._menuAnimating = false;
        }
      });
    } else {
      this.tweens.add({
        targets: this._menuLayer,
        y: this._menuHiddenY,
        duration: 340,
        ease: 'Sine.easeIn',
        onComplete: () => {
          this._menuOpen = false;
          this._menuAnimating = false;
          this.tweens.add({ targets: this._menuHint, alpha: 0.62, duration: 260, ease: 'Sine.out' });
        }
      });
    }
  }

  _moveTitleMenuSelection(delta) {
    if (!this._menuOpen || !this._menuButtons || !this._menuButtons.length) return;
    const next = Phaser.Math.Wrap(this._menuSelected + delta, 0, this._menuButtons.length);
    this._setTitleMenuSelection(next);
  }

  _setTitleMenuSelection(index) {
    this._menuSelected = index;
    if (!this._menuButtons) return;
    this._menuButtons.forEach((button, i) => {
      const selected = i === index;
      const baseColor = button.baseColor || '#9e8240';
      button.marker.setVisible(selected);
      button.label.setColor(selected ? '#e0c16a' : baseColor);
      if (button.hint) button.hint.setColor(selected ? '#8a7030' : '#5f5436');
      button.label.setScale(selected ? 1.04 : 1);
    });
  }

  _confirmTitleMenuSelection() {
    if (!this._menuOpen || !this._menuButtons) return;
    const button = this._menuButtons[this._menuSelected];
    if (!button || typeof button.action !== 'function') return;
    Audio.init();
    Audio.sfx.click();
    button.action();
  }

  _fadeToScene(sceneKey, data = null, duration = 300) {
    this.cameras.main.fadeOut(duration, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (data) this.scene.start(sceneKey, data);
      else this.scene.start(sceneKey);
    });
  }

  _showTitleMenuNotice(message) {
    if (this._menuNotice) this._menuNotice.destroy();
    const { width } = this.scale;
    this._menuNotice = this.add.text(width / 2, Math.min(520, this.scale.height - 84), message, {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '13px',
      color: '#d6b35a'
    })
      .setOrigin(0.5)
      .setDepth(44)
      .setAlpha(0);
    this.tweens.add({
      targets: this._menuNotice,
      alpha: { from: 0, to: 1 },
      yoyo: true,
      hold: 600,
      duration: 180,
      ease: 'Sine.out',
      onComplete: () => {
        if (this._menuNotice) {
          this._menuNotice.destroy();
          this._menuNotice = null;
        }
      }
    });
  }

  _createTitlePseudoAnimation(width, height) {
    if (!this.textures.exists('title_anim_01')) return;

    this._titleBgA = this.add.image(width / 2, height / 2, 'title_anim_01')
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(-30);
    this._titleBgB = this.add.image(width / 2, height / 2, 'title_anim_01')
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(-31);
    this._titleActiveBg = null;
    this._titleShotIndex = -1;

    this._titleAlarm = this.add.rectangle(0, 0, width, height, 0x8f0d0d, 0)
      .setOrigin(0, 0)
      .setDepth(-12)
      .setBlendMode(Phaser.BlendModes.ADD);
    this._titleFlash = this.add.rectangle(0, 0, width, height, 0xffffff, 0)
      .setOrigin(0, 0)
      .setDepth(-11);
    this._titleSweep = this.add.rectangle(-width * 0.35, height / 2, width * 0.18, height * 1.35, 0xffd56a, 0)
      .setOrigin(0.5)
      .setAngle(-12)
      .setDepth(-13)
      .setBlendMode(Phaser.BlendModes.ADD);
    this._titleRelicGlow = this.add.circle(width * 0.695, height * 0.49, Math.min(width, height) * 0.14, 0xd4af37, 0)
      .setDepth(-8)
      .setBlendMode(Phaser.BlendModes.ADD);

    this._createTitleAtmosphere(width, height);

    const playNext = () => {
      this._clearTitleComicPanels();
      this._titleShotIndex = (this._titleShotIndex + 1) % TITLE_SHOTS.length;
      const shot = TITLE_SHOTS[this._titleShotIndex];
      const next = this._titleActiveBg === this._titleBgA ? this._titleBgB : this._titleBgA;
      const prev = this._titleActiveBg;
      this._titleActiveBg = next;

      this.tweens.killTweensOf(next);
      this._setupTitleShotImage(next, shot, width, height);
      next.setDepth(-30).setAlpha(0);
      if (prev) prev.setDepth(-31);

      this.tweens.add({
        targets: next,
        alpha: shot.comic ? 0 : 1,
        duration: 900,
        ease: 'Sine.out'
      });
      if (prev) {
        this.tweens.killTweensOf(prev);
        this.tweens.add({
          targets: prev,
          alpha: 0,
          duration: 900,
          ease: 'Sine.inOut'
        });
      }

      this._playTitleShotAccent(shot, width, height);
      this._playTitleShotAtmosphere(shot, width, height);
      if (shot.comic) this._playTitleComicPanels(shot, width, height);
      if (shot.cluePanels) this._playTitleCluePanels(shot, width, height);
      if (shot.convergence) this._playTitleConvergence(shot, width, height);
      if (shot.returned) this._playTitleReturnedHighlights(shot, width, height);
      this._titleShotTimer = this.time.delayedCall(shot.duration, playNext);
    };

    playNext();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this._titleShotTimer) this._titleShotTimer.remove(false);
    });
  }

  _setupTitleShotImage(image, shot, width, height) {
    image.setTexture(shot.key);
    const baseScale = this._coverScale(shot.key, width, height);
    const startScale = baseScale * (shot.start || 1);
    const endScale = shot.zoom ? baseScale * (shot.end || shot.start || 1) : startScale;
    const offsetX = shot.offsetX || 0;
    const offsetY = shot.offsetY || 0;
    const startX = width / 2 + offsetX - (shot.panX || 0) * 0.35;
    const startY = height / 2 + offsetY - (shot.panY || 0) * 0.35;
    const endX = width / 2 + offsetX + (shot.panX || 0);
    const endY = height / 2 + offsetY + (shot.panY || 0);
    image
      .setPosition(startX, startY)
      .setScale(startScale);

    this.tweens.add({
      targets: image,
      x: endX,
      y: endY,
      scale: endScale,
      duration: shot.duration + 1100,
      ease: 'Sine.inOut'
    });
  }

  _coverScale(key, width, height) {
    const tex = this.textures.get(key);
    const src = tex && tex.getSourceImage();
    if (!src || !src.width || !src.height) return 1;
    return Math.max(width / src.width, height / src.height);
  }

  _playTitleShotAccent(shot, width, height) {
    this.tweens.killTweensOf([this._titleAlarm, this._titleFlash, this._titleSweep, this._titleRelicGlow]);
    this._titleAlarm.setAlpha(0);
    this._titleFlash.setAlpha(0);
    this._titleSweep.setAlpha(0).setX(-width * 0.35);
    this._titleRelicGlow.setAlpha(0);

    if (shot.flash) {
      this.tweens.add({
        targets: this._titleFlash,
        alpha: { from: 0.75, to: 0 },
        duration: 280,
        ease: 'Quad.out'
      });
    }

    if (shot.alarm) {
      this.tweens.add({
        targets: this._titleAlarm,
        alpha: { from: 0.02, to: 0.22 },
        duration: 430,
        ease: 'Sine.inOut',
        yoyo: true,
        repeat: Math.max(2, Math.floor(shot.duration / 860))
      });
    }

    if (shot.sweep) {
      this._titleSweep.setY(height * 0.48);
      this.tweens.add({
        targets: this._titleSweep,
        x: width * 1.35,
        alpha: { from: 0.0, to: shot.sweepAlpha || 0.16 },
        duration: Math.min(shot.duration - 300, 2400),
        ease: 'Sine.inOut',
        yoyo: true
      });
    }

    if (shot.relicGlow) {
      this._titleRelicGlow
        .setPosition(width * 0.695, height * 0.49)
        .setScale(1);
      this.tweens.add({
        targets: this._titleRelicGlow,
        alpha: { from: 0.035, to: 0.09 },
        scale: { from: 0.94, to: 1.05 },
        duration: 1700,
        ease: 'Sine.inOut',
        yoyo: true,
        repeat: Math.max(1, Math.floor(shot.duration / 1800))
      });
    }
  }

  _playTitleShotAtmosphere(shot, width, height) {
    if (!this._titleReflectionLines) return;

    this.tweens.killTweensOf([...this._titleReflectionLines, ...(this._titleRelicDust || [])]);
    for (const line of this._titleReflectionLines) {
      line.setAlpha(0);
    }
    for (const dust of this._titleRelicDust || []) {
      dust.setAlpha(0);
    }

    if (shot.relicGlow) {
      this._titleRelicDust.forEach((dust, idx) => {
        dust.setPosition(dust._baseX, dust._baseY);
        this.tweens.add({
          targets: dust,
          x: dust._baseX + Phaser.Math.Between(-8, 8),
          y: dust._baseY - 28 - idx * 2,
          alpha: { from: 0.04, to: dust._maxAlpha },
          duration: 2100 + idx * 130,
          delay: idx * 90,
          ease: 'Sine.inOut',
          yoyo: true,
          repeat: Math.max(1, Math.floor(shot.duration / 2300))
        });
      });
    }

    if (!shot.shimmer) return;

    this._titleReflectionLines.forEach((line, idx) => {
      line.setX(line._baseX).setY(line._baseY);
      this.tweens.add({
        targets: line,
        x: line._baseX + 14 + idx * 3,
        alpha: { from: 0.0, to: line._maxAlpha },
        duration: 1600 + idx * 220,
        delay: idx * 180,
        ease: 'Sine.inOut',
        yoyo: true,
        repeat: Math.max(1, Math.floor(shot.duration / 2200))
      });
    });
  }

  _playTitleComicPanels(shot, width, height) {
    const key = shot.key;
    const tex = this.textures.get(key);
    const src = tex && tex.getSourceImage();
    if (!src || !src.width || !src.height) return;

    this._titleComicObjects = [];
    this._titleComicTimers = [];

    const scale = this._coverScale(key, width, height);
    const offsetX = shot.offsetX || 0;
    const offsetY = shot.offsetY || 0;
    const baseX = width / 2 + offsetX;
    const baseY = height / 2 + offsetY;
    const left = baseX - src.width * scale / 2;
    const top = baseY - src.height * scale / 2;
    const toScreen = ([x, y]) => [left + x * scale, top + y * scale];

    const makeMask = (points) => {
      const g = this.add.graphics().setDepth(-2).setAlpha(0);
      g.fillStyle(0xffffff, 1);
      g.beginPath();
      const first = toScreen(points[0]);
      g.moveTo(first[0], first[1]);
      for (let i = 1; i < points.length; i++) {
        const p = toScreen(points[i]);
        g.lineTo(p[0], p[1]);
      }
      g.closePath();
      g.fillPath();
      const mask = g.createGeometryMask();
      this._titleComicObjects.push(g);
      return mask;
    };

    const makePanel = (points, fromX, fromY, delay, duration) => {
      const image = this.add.image(baseX + fromX, baseY + fromY, key)
        .setOrigin(0.5)
        .setScale(scale)
        .setAlpha(0)
        .setDepth(-26);
      image.setMask(makeMask(points));
      this._titleComicObjects.push(image);
      this.tweens.add({
        targets: image,
        x: baseX,
        y: baseY,
        alpha: 1,
        delay,
        duration,
        ease: 'Cubic.easeOut'
      });
      return image;
    };

    const leftPanel = makePanel(
      [[6, 6], [448, 6], [696, 934], [6, 934]],
      -36,
      0,
      100,
      360
    );
    const midPanel = makePanel(
      [[456, 6], [1217, 6], [948, 934], [698, 934]],
      0,
      -34,
      1000,
      280
    );
    const rightPanel = makePanel(
      [[1226, 6], [1666, 6], [1666, 934], [956, 934]],
      24,
      0,
      2100,
      180
    );

    const relicGlow = this.add.circle(width * 0.22, height * 0.43, Math.min(width, height) * 0.08, 0xd4af37, 0)
      .setDepth(-24)
      .setBlendMode(Phaser.BlendModes.ADD);
    this._titleComicObjects.push(relicGlow);
    this.tweens.add({
      targets: relicGlow,
      alpha: { from: 0, to: 0.08 },
      scale: { from: 0.92, to: 1.04 },
      delay: 160,
      duration: 900,
      ease: 'Sine.inOut',
      yoyo: true,
      repeat: 1
    });

    const redAlarm = this.add.rectangle(0, 0, width, height, 0xa40000, 0)
      .setOrigin(0, 0)
      .setDepth(-20)
      .setBlendMode(Phaser.BlendModes.ADD);
    const focusDim = this.add.rectangle(0, 0, width, height, 0x000000, 0)
      .setOrigin(0, 0)
      .setDepth(-21);
    this._titleComicObjects.push(redAlarm, focusDim);

    this._titleComicTimers.push(this.time.delayedCall(1000, () => {
      this.tweens.add({
        targets: redAlarm,
        alpha: { from: 0.02, to: 0.08 },
        duration: 260,
        ease: 'Sine.inOut',
        yoyo: true,
        repeat: 1
      });
    }));

    this._titleComicTimers.push(this.time.delayedCall(2000, () => {
      this._titleFlash.setAlpha(0.82);
      this.tweens.add({
        targets: this._titleFlash,
        alpha: 0,
        duration: 105,
        ease: 'Quad.out'
      });
    }));

    this._titleComicTimers.push(this.time.delayedCall(2100, () => {
      this.cameras.main.shake(300, 0.0022);
      this.tweens.add({
        targets: [leftPanel, midPanel],
        alpha: 0.58,
        duration: 260,
        ease: 'Sine.out'
      });
    }));

    this._titleComicTimers.push(this.time.delayedCall(2500, () => {
      this.tweens.add({
        targets: redAlarm,
        alpha: { from: 0.02, to: 0.18 },
        duration: 360,
        ease: 'Sine.inOut',
        yoyo: true,
        repeat: 5
      });
      this.tweens.add({
        targets: focusDim,
        alpha: { from: 0, to: 0.14 },
        duration: 520,
        ease: 'Sine.inOut',
        yoyo: true,
        repeat: 2
      });
    }));

    this._titleComicTimers.push(this.time.delayedCall(Math.max(0, shot.duration - 500), () => {
      this.tweens.add({
        targets: this._titleComicObjects.filter((obj) => obj && obj.alpha !== undefined),
        alpha: 0,
        duration: 500,
        ease: 'Sine.inOut'
      });
    }));

    return { leftPanel, midPanel, rightPanel };
  }

  _playTitleCluePanels(shot, width, height) {
    this._titleComicObjects = this._titleComicObjects || [];
    this._titleComicTimers = this._titleComicTimers || [];
    const baseKey = shot.key;
    const scale = this._coverScale(baseKey, width, height) * (shot.start || 1);
    const offsetX = shot.offsetX || 0;
    const offsetY = shot.offsetY || 0;
    const panX = shot.panX || 0;
    const panY = shot.panY || 0;
    const startX = width / 2 + offsetX - panX * 0.35;
    const startY = height / 2 + offsetY - panY * 0.35;
    const delays = [800, 1600, 2500, 3400];
    const slideFromX = shot.clueSide === 'right' ? 90 : -90;

    (shot.cluePanels || []).forEach((key, i) => {
      if (!this.textures.exists(key)) return;
      const panel = this.add.image(startX + slideFromX, startY, key)
        .setOrigin(0.5)
        .setScale(scale)
        .setAlpha(0)
        .setDepth(-24);
      this._titleComicObjects.push(panel);

      this.tweens.add({
        targets: panel,
        x: startX,
        alpha: 1,
        delay: delays[i] || 4200,
        duration: 340,
        ease: 'Cubic.easeOut'
      });
    });

    const flickers = [];
    const color = shot.clueSide === 'right' ? 0x8fb7d5 : 0xd49a3c;
    for (let i = 0; i < 4; i++) {
      const light = this.add.circle(
        width * Phaser.Math.FloatBetween(0.52, 0.84),
        height * Phaser.Math.FloatBetween(0.22, 0.72),
        Phaser.Math.FloatBetween(20, 42),
        color,
        0
      )
        .setDepth(-18)
        .setBlendMode(Phaser.BlendModes.ADD);
      flickers.push(light);
      this._titleComicObjects.push(light);
      this.tweens.add({
        targets: light,
        alpha: { from: 0.015, to: 0.065 },
        duration: 900 + i * 170,
        delay: 400 + i * 220,
        ease: 'Sine.inOut',
        yoyo: true,
        repeat: Math.max(2, Math.floor(shot.duration / 1600))
      });
    }

    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0)
      .setOrigin(0, 0)
      .setDepth(-19);
    this._titleComicObjects.push(dim);
    this._titleComicTimers.push(this.time.delayedCall(Math.max(0, shot.duration - 550), () => {
      this.tweens.add({
        targets: dim,
        alpha: 0.22,
        duration: 500,
        ease: 'Sine.inOut'
      });
    }));
  }

  _playTitleConvergence(shot, width, height) {
    this._titleComicObjects = this._titleComicObjects || [];
    this._titleComicTimers = this._titleComicTimers || [];
    const bgScale = this._coverScale(shot.key, width, height) * (shot.start || 1);
    const baseX = width / 2 + (shot.offsetX || 0);
    const baseY = height / 2 + (shot.offsetY || 0);

    // 10-1 / 10-2 一起原地淡入，不再滑动
    const panels = shot.convergencePanels || [];
    let p10_1 = null;
    let p10_2 = null;

    if (panels[0] && this.textures.exists(panels[0])) {
      p10_1 = this.add.image(baseX, baseY, panels[0])
        .setOrigin(0.5)
        .setScale(bgScale)
        .setAlpha(0)
        .setDepth(-23);
      this._titleComicObjects.push(p10_1);
    }
    if (panels[1] && this.textures.exists(panels[1])) {
      p10_2 = this.add.image(baseX, baseY, panels[1])
        .setOrigin(0.5)
        .setScale(bgScale)
        .setAlpha(0)
        .setDepth(-22);
      this._titleComicObjects.push(p10_2);
    }

    // 两幅面板一起淡入
    this.tweens.add({
      targets: [p10_1, p10_2].filter(Boolean),
      alpha: 1,
      delay: 2000,
      duration: 900,
      ease: 'Sine.out'
    });

    // === 人物（hero.png，图层必须在 10-1 和 10-2 之上）===
    // 位置与大小参考 参考.png（1672×941 画布中 hero.png 的定位）
    const heroTex = this.textures.exists('title_hero_09') ? 'title_hero_09' : null;
    const hero = heroTex
      ? this.add.image(width * 0.515, height * 0.825, heroTex)
        .setOrigin(0.5, 1)
        .setScale(1.25)
        .setAlpha(0)
        .setDepth(-15)
      : null;

    if (hero) {
      this._titleComicObjects.push(hero);
      // 人物随画布淡入
      this.tweens.add({
        targets: hero,
        alpha: 1,
        duration: 900,
        delay: 400,
        ease: 'Sine.out'
      });
      // 极缓慢放大，增加呼吸感
      this.tweens.add({
        targets: hero,
        scale: 1.30,
        duration: 6200,
        delay: 3400,
        ease: 'Sine.inOut'
      });
    }

    // 面板抖动缩放（淡入完成后立即开始）
    this.tweens.add({
      targets: [p10_1, p10_2].filter(Boolean),
      scale: bgScale * 1.025,
      duration: 4000,
      delay: 3000,
      ease: 'Sine.inOut'
    });

    // 光晕效果
    const rim = this.add.circle(width * 0.505, height * 0.58, Math.min(width, height) * 0.075, 0xd4af37, 0)
      .setDepth(-17)
      .setBlendMode(Phaser.BlendModes.ADD);
    this._titleComicObjects.push(rim);
    this.tweens.add({
      targets: rim,
      alpha: { from: 0, to: 0.055 },
      scale: { from: 0.9, to: 1.06 },
      delay: 5000,
      duration: 1200,
      ease: 'Sine.inOut',
      yoyo: true,
      repeat: 1
    });

    // 扫光
    this._titleComicTimers.push(this.time.delayedCall(6000, () => {
      this._titleSweep
        .setPosition(width * 0.46, height * 0.58)
        .setAngle(-24)
        .setAlpha(0);
      this.tweens.add({
        targets: this._titleSweep,
        x: width * 0.56,
        alpha: { from: 0, to: 0.11 },
        duration: 400,
        ease: 'Sine.inOut',
        yoyo: true
      });
    }));

    // 收尾压暗
    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0)
      .setOrigin(0, 0)
      .setDepth(-16);
    this._titleComicObjects.push(dim);
    this._titleComicTimers.push(this.time.delayedCall(7300, () => {
      this.tweens.add({ targets: dim, alpha: 0.24, duration: 500, ease: 'Sine.inOut' });
    }));
  }

  _playTitleReturnedHighlights(shot, width, height) {
    this._titleComicObjects = this._titleComicObjects || [];
    this._titleComicTimers = this._titleComicTimers || [];
    const points = [
      { x: 0.5, y: 0.45, r: 0.16, delay: 600, alpha: 0.075 },
      { x: 0.23, y: 0.5, r: 0.09, delay: 1800, alpha: 0.045 },
      { x: 0.78, y: 0.52, r: 0.09, delay: 3000, alpha: 0.045 },
      { x: 0.5, y: 0.22, r: 0.04, delay: 4200, alpha: 0.035 },
    ];
    for (const p of points) {
      const glow = this.add.circle(width * p.x, height * p.y, Math.min(width, height) * p.r, 0xd4af37, 0)
        .setDepth(-18)
        .setBlendMode(Phaser.BlendModes.ADD);
      this._titleComicObjects.push(glow);
      this.tweens.add({
        targets: glow,
        alpha: p.alpha,
        scale: { from: 0.92, to: 1.04 },
        delay: p.delay,
        duration: 900,
        ease: 'Sine.inOut',
        yoyo: true
      });
    }

    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0)
      .setOrigin(0, 0)
      .setDepth(-16);
    this._titleComicObjects.push(dim);
    // 缓慢变黑：提前 3000ms 开始，2500ms 内渐变至全黑
    this._titleComicTimers.push(this.time.delayedCall(Math.max(0, shot.duration - 3000), () => {
      this.tweens.add({ targets: dim, alpha: 1, duration: 2500, ease: 'Sine.inOut' });
    }));
  }

  _clearTitleComicPanels() {
    if (this._titleComicTimers) {
      for (const timer of this._titleComicTimers) {
        if (timer) timer.remove(false);
      }
      this._titleComicTimers = [];
    }
    if (this._titleComicObjects) {
      for (const obj of this._titleComicObjects) {
        if (!obj || !obj.destroy) continue;
        this.tweens.killTweensOf(obj);
        obj.destroy();
      }
      this._titleComicObjects = [];
    }
  }

  _createTitleAtmosphere(width, height) {
    const fogKey = this.textures.exists('tex_fog') ? 'tex_fog' : null;
    if (fogKey) {
      for (let i = 0; i < 5; i++) {
        const fog = this.add.image(
          Phaser.Math.Between(-80, width + 80),
          Phaser.Math.Between(Math.round(height * 0.55), height + 60),
          fogKey
        )
          .setDepth(-14)
          .setAlpha(0.08 + i * 0.018)
          .setScale(1.6 + i * 0.35)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: fog,
          x: fog.x + Phaser.Math.Between(80, 180),
          alpha: { from: fog.alpha, to: fog.alpha * 0.35 },
          duration: 9000 + i * 1800,
          ease: 'Sine.inOut',
          yoyo: true,
          repeat: -1
        });
      }
    }

    this._titleReflectionLines = [];
    const reflectionYs = [0.72, 0.765, 0.81, 0.855];
    reflectionYs.forEach((ratio, idx) => {
      const line = this.add.rectangle(
        width * (0.35 + idx * 0.08),
        height * ratio,
        width * (0.18 + idx * 0.05),
        2,
        idx % 2 === 0 ? 0xd4af37 : 0x8f7c46,
        0
      )
        .setDepth(-9)
        .setBlendMode(Phaser.BlendModes.ADD);
      line._baseX = line.x;
      line._baseY = line.y;
      line._maxAlpha = 0.055 + idx * 0.012;
      this._titleReflectionLines.push(line);
    });

    this._titleRelicDust = [];
    for (let i = 0; i < 18; i++) {
      const dust = this.add.circle(
        width * Phaser.Math.FloatBetween(0.625, 0.765),
        height * Phaser.Math.FloatBetween(0.22, 0.55),
        Phaser.Math.FloatBetween(0.7, 1.6),
        0xf0c86a,
        0
      )
        .setDepth(-7)
        .setBlendMode(Phaser.BlendModes.ADD);
      dust._baseX = dust.x;
      dust._baseY = dust.y;
      dust._maxAlpha = Phaser.Math.FloatBetween(0.08, 0.18);
      this._titleRelicDust.push(dust);
    }

    for (let i = 0; i < 34; i++) {
      const dust = this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.FloatBetween(0.6, 1.8),
        0xd8b45a,
        Phaser.Math.FloatBetween(0.06, 0.18)
      )
        .setDepth(-10)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: dust,
        y: dust.y - Phaser.Math.Between(20, 70),
        x: dust.x + Phaser.Math.Between(-18, 18),
        alpha: { from: dust.alpha, to: dust.alpha * 0.25 },
        duration: Phaser.Math.Between(3500, 9000),
        ease: 'Sine.inOut',
        yoyo: true,
        repeat: -1
      });
    }
  }
}
