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
import SaveData from '../systems/SaveData.js';
import { getBiome } from '../data/biomes.js';
import { getRoomTemplate } from '../data/roomTemplates.js';
import BLACKMARKET_TEMPLATE from '../data/blackmarketLayout.js';
import { composeMuseumMap } from '../systems/composeMuseumMap.js';
import { composeMuseumFullMap } from '../systems/composeMuseumFullMap.js';
import { composeBlackmarketMap } from '../systems/composeBlackmarketMap.js';
import { composeShipMap } from '../systems/composeShipMap.js';
import SecurityCamera from '../systems/SecurityCamera.js';
import SpikeTrap from '../systems/SpikeTrap.js';

const TILE = 32;
const MAP_W = 30; // 30 * 32 = 960
const MAP_H = 17; // 17 * 32 = 544
const HERO_BLADE_SKILL = {
  cost: 34,
  cooldownMs: 1900,
  animMs: 2180,
  damage: 1,
  knockMul: 2.4
};
const HERO_BLADE_SKILL_FW = 772;
const HERO_BLADE_SKILL_FH = 230;
const HERO_BLADE_SKILL_LEFT_ANCHOR_X = 648;
const HERO_BLADE_SKILL_ORIGIN_Y = 0.98;
const HERO_BLADE_SKILL_FRAME_RECTS = [
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
const HERO_BLADE_SKILL_HIT_RECTS = [
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
const HERO_BLADE_SKILL_FRAME_Y_OFFSETS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 10];
const HERO_BLADE_SKILL_FRAME_X_OFFSETS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 14];

// 光照层颜色（近似纯黑、略带紫调，像月夜）
const angleToDir4 = (angle = 0) => {
  const x = Math.cos(angle);
  const y = Math.sin(angle);
  if (Math.abs(x) >= Math.abs(y)) return x >= 0 ? 'right' : 'left';
  return y >= 0 ? 'down' : 'up';
};

const DARKNESS = 0x081828; // deep blue fallback (biome overrides this)

export default class MuseumScene extends Phaser.Scene {
  constructor() {
    super('MuseumScene');
    this.totalRelicsOnMap = 0;
  }

  init(data) {
    // biome 优先从进入参数读；其次从当前委托读；否则默认 museum
    let biomeId = (data && data.biome) || null;
    if (!biomeId) {
      const ac = SaveData.getActiveContract && SaveData.getActiveContract();
      if (ac && ac.biome) biomeId = ac.biome;
    }
    this.biome = getBiome(biomeId || 'museum');

    // —— 场景渲染模式选择 ——
    // composed 模式：使用 composeMuseumMap 拼接的多房间复合地图（推荐，地图复杂度高）
    // template 模式：使用 src/data/roomTemplates.js 中预定义的单张房间贴图（验证 / 调试用）
    // procedural 模式：走原有 generateLevel + 像素贴图拼接逻辑（最早期实现，回退备用）
    //
    // 默认 composed 模式，调用方可显式 useComposed:false + template:'room_xx' 单房间调试
    this.useComposed = (data && data.useComposed !== undefined)
      ? !!data.useComposed
      : (!data || data.template === undefined); // 没显式传 template 时默认走复合
    this.useTemplate = !this.useComposed
      && ((data && data.useTemplate !== undefined) ? !!data.useTemplate : true);

    if (this.biome && this.biome.id === 'blackmarket') {
      this.useComposed = false;
      this.useTemplate = true;
      this._template = BLACKMARKET_TEMPLATE;
      this.templateId = BLACKMARKET_TEMPLATE.id;
      return;
    }

    if (this.useComposed) {
      // 复合模式：根据 biome 选择对应的地图组合器
      try {
        const biomeId = this.biome && this.biome.id;
        if (biomeId === 'blackmarket') {
          this._template = composeBlackmarketMap();
        } else if (biomeId === 'ship') {
          this._template = composeShipMap();
        } else {
          this._template = composeMuseumFullMap();
        }
        this.templateId = this._template.id;
      } catch (err) {
        console.warn('[MuseumScene] compose map failed, fallback to single room:', err);
        this.useComposed = false;
        this.useTemplate = true;
      }
    }

    if (!this.useComposed) {
      this.templateId = (data && data.template) || (this.biome && this.biome.id === 'museum' ? 'room_01' : null);
      if (this.templateId) {
        const tpl = getRoomTemplate(this.templateId);
        if (!tpl) {
          // 安全回退到程序化生成
          this.useTemplate = false;
          this.templateId = null;
        } else {
          this._template = tpl;
        }
      } else {
        this.useTemplate = false;
      }
    }
  }

  create() {
    // —— 视口：与 HubScene 保持一致，使用 1280×720 全画布，避免任务房出现大黑边。
    //   HUD/遮罩/线索面板等屏幕固定元素，统一以 SCREEN_W/SCREEN_H 为锚点。
    this.cameras.main.setViewport(0, 0, 1280, 720);
    this.cameras.main.fadeIn(500, 0, 0, 0);

    // —— BGM: play biome-specific music (loop, no state-based switching) ——
    const bgmMap = { museum: 'bgm_museum', blackmarket: 'bgm_blackmarket', ship: 'bgm_ship' };
    const bgmKey = bgmMap[this.biome.id] || 'bgm_museum';
    Audio.bgm.play(bgmKey, { loop: true, fade: 1000, volume: 0.4 });

    this.inventory = new Inventory();
    this._ended = false;
    // 局内统计（上送给 ResultScene 计入 SaveData.stats，用于多结局判定）
    this._runStats = { kills: 0, alerts: 0 };

    // —— 0. 生成关卡布局 ——
    // template 模式：从房间贴图模板构造 level；procedural 模式：原程序化生成
    let level;
    let mapW = MAP_W;
    let mapH = MAP_H;
    if ((this.useTemplate || this.useComposed) && this._template) {
      level = this._buildLevelFromTemplate(this._template);
      mapW = this._template.tilesW;
      mapH = this._template.tilesH;
    } else {
      level = generateLevel({
        width: MAP_W,
        height: MAP_H,
        seed: (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0,
        relicCount: this.biome.relicCount || 7,
        relicPoolSize: RELICS.length,
        guardCount: this.biome.guardCount || 5
      });
    }
    this._level = level;
    this._mapW = mapW;
    this._mapH = mapH;

    // —— 物理世界与相机适配模板尺寸（房间不是 30×17 时需要居中并缩放视口） ——
    const worldW = mapW * TILE;
    const worldH = mapH * TILE;
    this.physics.world.setBounds(0, 0, worldW, worldH);
    if (this.useTemplate || this.useComposed) {
      // 视口 1280×720：分轴判断是否需要跟随
      //   · 某轴 worldSize > viewport → 该轴需要跟随玩家（大地图）
      //   · 某轴 worldSize ≤ viewport → 该轴居中显示（不跟随，否则相机贴边出现单侧黑边）
      const viewW = 1280;
      const viewH = 720;
      const followX = worldW > viewW;
      const followY = worldH > viewH;
      const needFollow = followX || followY;

      if (!needFollow) {
        // 两轴都比视口小 → 整图居中
        this.cameras.main.centerOn(worldW / 2, worldH / 2);
      }
      this._cameraNeedFollow = needFollow;
      this._cameraFollowX = followX;
      this._cameraFollowY = followY;
      // 用于不跟随轴上的"相机居中偏移"（让窄世界水平/垂直居中显示在 1280×720 视口里）
      this._cameraFixedScrollX = followX ? null : (worldW - viewW) / 2;
      this._cameraFixedScrollY = followY ? null : (worldH - viewH) / 2;

      if (needFollow) {
        // ★ 关键：bounds 至少覆盖 viewport，避免 worldSize<viewport 的轴被 Phaser 强制 clamp 到 0 → 单侧黑边
        const bx = followX ? 0 : (worldW - viewW) / 2;
        const by = followY ? 0 : (worldH - viewH) / 2;
        const bw = followX ? worldW : viewW;
        const bh = followY ? worldH : viewH;
        this.cameras.main.setBounds(bx, by, bw, bh);
      }
    }

    if ((this.useTemplate || this.useComposed) && this._template) {
      // —— 1T. 房间贴图：单房间整张铺底；复合地图按 children 分别铺 ——
      this._roomBgs = [];
      const tpl = this._template;
      if (tpl.children && tpl.children.length) {
        // 复合模式：先铺走廊地板色，再铺各房间贴图
        // 走廊装饰：地砖纹理 + 墙壁边框 + 灯具
        // Skip corridor/doorway decorations for full-map PNG (artwork already has them)
        if (tpl.corridors && tpl.corridors.length && !tpl.wallsInPixels) {
          for (const c of tpl.corridors) {
            const cx = c.x * TILE;
            const cy = c.y * TILE;
            const cw = c.w * TILE;
            const ch = c.h * TILE;
            // Determine orientation by aspect ratio (wider = horizontal)
            const isHorizontal = c.w > c.h;

            // 1) 走廊底色（根据 biome 调整）
            const biomeId = this.biome && this.biome.id;
            const corridorColors = biomeId === 'blackmarket'
              ? { bg: 0x0a0712, dark: 0x181420, light: 0x241a30, grout: 0x050308, accent: 0xc070ff }
              : biomeId === 'ship'
              ? { bg: 0x1a2a38, dark: 0x2a1c10, light: 0x3a2818, grout: 0x0a1420, accent: 0x7ad8ff }
              : { bg: 0x1a1210, dark: 0x2a1a14, light: 0x3a2820, grout: 0x0f0a08, accent: 0x8b6914 };
            const corridorBg = this.add.rectangle(cx, cy, cw, ch, corridorColors.bg)
              .setOrigin(0, 0).setDepth(0);
            this._roomBgs.push(corridorBg);

            // 2) 棋盘格地砖纹理
            const gfxFloor = this.add.graphics().setDepth(0.02);
            for (let ty = 0; ty < c.h; ty++) {
              for (let tx = 0; tx < c.w; tx++) {
                const dark = (tx + ty) % 2 === 0;
                gfxFloor.fillStyle(dark ? corridorColors.dark : corridorColors.light, dark ? 0.9 : 0.7);
                gfxFloor.fillRect(cx + tx * TILE, cy + ty * TILE, TILE, TILE);
                // tile border (subtle grout lines)
                gfxFloor.lineStyle(1, corridorColors.grout, 0.5);
                gfxFloor.strokeRect(cx + tx * TILE, cy + ty * TILE, TILE, TILE);
              }
            }
            this._roomBgs.push(gfxFloor);


            // 3) 走廊两侧墙壁装饰条
            const wallBaseColor = biomeId === 'blackmarket' ? 0x0a0810 :
                                  biomeId === 'ship' ? 0x0a1420 : 0x1a1008;
            const carpetColor = biomeId === 'blackmarket' ? 0x3a1050 :
                                biomeId === 'ship' ? 0x1a384a : 0x6b1a1a;
            const carpetBorder = biomeId === 'blackmarket' ? 0x6030a0 :
                                 biomeId === 'ship' ? 0x3a6888 : 0x8b3030;
            const gfxWalls = this.add.graphics().setDepth(0.08);
            if (isHorizontal) {
              // 上下墙壁装饰
              gfxWalls.fillStyle(wallBaseColor, 0.95);
              gfxWalls.fillRect(cx, cy - TILE * 0.3, cw, TILE * 0.3);
              gfxWalls.lineStyle(2, corridorColors.accent, 0.8);
              gfxWalls.lineBetween(cx, cy, cx + cw, cy);
              gfxWalls.fillStyle(wallBaseColor, 0.95);
              gfxWalls.fillRect(cx, cy + ch, cw, TILE * 0.3);
              gfxWalls.lineStyle(2, corridorColors.accent, 0.8);
              gfxWalls.lineBetween(cx, cy + ch, cx + cw, cy + ch);
              // 中间地毯/管道条
              const carpetW = cw * 0.3;
              const carpetX = cx + (cw - carpetW) / 2;
              gfxWalls.fillStyle(carpetColor, 0.5);
              gfxWalls.fillRect(carpetX, cy + TILE * 0.5, carpetW, ch - TILE);
              gfxWalls.lineStyle(1, carpetBorder, 0.4);
              gfxWalls.strokeRect(carpetX, cy + TILE * 0.5, carpetW, ch - TILE);
            } else {
              // 左右墙壁装饰
              gfxWalls.fillStyle(wallBaseColor, 0.95);
              gfxWalls.fillRect(cx - TILE * 0.3, cy, TILE * 0.3, ch);
              gfxWalls.lineStyle(2, corridorColors.accent, 0.8);
              gfxWalls.lineBetween(cx, cy, cx, cy + ch);
              gfxWalls.fillStyle(wallBaseColor, 0.95);
              gfxWalls.fillRect(cx + cw, cy, TILE * 0.3, ch);
              gfxWalls.lineStyle(2, corridorColors.accent, 0.8);
              gfxWalls.lineBetween(cx + cw, cy, cx + cw, cy + ch);
              // 中间地毯/管道条
              const carpetH = ch * 0.3;
              const carpetY = cy + (ch - carpetH) / 2;
              gfxWalls.fillStyle(carpetColor, 0.5);
              gfxWalls.fillRect(cx + TILE * 0.5, carpetY, cw - TILE, carpetH);
              gfxWalls.lineStyle(1, carpetBorder, 0.4);
              gfxWalls.strokeRect(cx + TILE * 0.5, carpetY, cw - TILE, carpetH);
            }
            this._roomBgs.push(gfxWalls);

            // 4) 走廊灯具（壁灯效果）
            const lampCount = Math.max(1, Math.floor(Math.max(c.w, c.h) / 3));
            for (let i = 0; i < lampCount; i++) {
              const t = (i + 0.5) / lampCount;
              let lx, ly;
              if (isHorizontal) {
                lx = cx + t * cw;
                ly = cy + 2; // top wall
              } else {
                lx = cx + 2;
                ly = cy + t * ch;
              }
              // lamp glow (warm circle)
              const glow = this.add.circle(lx, ly, 12, 0xffaa44, 0.15).setDepth(0.09);
              // lamp fixture (small rectangle)
              const fixture = this.add.rectangle(lx, ly, 6, 6, 0xd4a030).setDepth(0.1).setAlpha(0.8);
              this._roomBgs.push(glow, fixture);
            }
          }
        }

        // 5) 门洞拱门装饰（标识入口）— 大尺寸明显门框
        // Skip for full-map PNG (artwork already contains door visuals)
        if (tpl.doorways && tpl.doorways.length && !tpl.wallsInPixels) {
          const gfxDoors = this.add.graphics().setDepth(0.15);
          for (const dw of tpl.doorways) {
            const dx = dw.x * TILE;
            const dy = dw.y * TILE;
            const dwW = dw.w * TILE;
            const dwH = dw.h * TILE;

            if (dw.orientation === 'vertical') {
              // Vertical doorway: tall door on W/E wall
              const doorW = dwW;  // full width of doorway tile
              const doorH = dwH;
              const doorX = dx;
              const doorY = dy;

              // Dark opening background (makes it look like a passage)
              gfxDoors.fillStyle(0x0a0a0a, 0.85);
              gfxDoors.fillRect(doorX + 8, doorY + 8, doorW - 16, doorH - 16);

              // Thick door frame (outer)
              gfxDoors.lineStyle(4, 0x6b4c2a, 1.0);
              gfxDoors.strokeRect(doorX + 4, doorY + 4, doorW - 8, doorH - 8);

              // Inner gold trim
              gfxDoors.lineStyle(2, 0xc9a84c, 0.9);
              gfxDoors.strokeRect(doorX + 8, doorY + 8, doorW - 16, doorH - 16);

              // Door panel lines (simulate wooden door planks)
              gfxDoors.lineStyle(1, 0x3d2b1a, 0.6);
              const panelX1 = doorX + doorW * 0.35;
              const panelX2 = doorX + doorW * 0.65;
              gfxDoors.lineBetween(panelX1, doorY + 12, panelX1, doorY + doorH - 12);
              gfxDoors.lineBetween(panelX2, doorY + 12, panelX2, doorY + doorH - 12);

              // Top arch decoration
              gfxDoors.fillStyle(0x7a5c3a, 0.95);
              gfxDoors.fillRect(doorX + 2, doorY, doorW - 4, 8);
              gfxDoors.fillRect(doorX + 2, doorY + doorH - 8, doorW - 4, 8);

              // Gold corner ornaments
              gfxDoors.fillStyle(0xd4af37, 0.8);
              gfxDoors.fillRect(doorX + 4, doorY + 4, 6, 6);
              gfxDoors.fillRect(doorX + doorW - 10, doorY + 4, 6, 6);
              gfxDoors.fillRect(doorX + 4, doorY + doorH - 10, 6, 6);
              gfxDoors.fillRect(doorX + doorW - 10, doorY + doorH - 10, 6, 6);

              // Center diamond ornament
              const midY = doorY + doorH / 2;
              const midX = doorX + doorW / 2;
              gfxDoors.fillStyle(0xd4af37, 0.7);
              gfxDoors.fillTriangle(midX, midY - 10, midX - 6, midY, midX + 6, midY);
              gfxDoors.fillTriangle(midX, midY + 10, midX - 6, midY, midX + 6, midY);

            } else {
              // Horizontal doorway: wide door on N/S wall
              const doorW = dwW;
              const doorH = dwH;
              const doorX = dx;
              const doorY = dy;

              // Dark opening background
              gfxDoors.fillStyle(0x0a0a0a, 0.85);
              gfxDoors.fillRect(doorX + 8, doorY + 8, doorW - 16, doorH - 16);

              // Thick door frame (outer)
              gfxDoors.lineStyle(4, 0x6b4c2a, 1.0);
              gfxDoors.strokeRect(doorX + 4, doorY + 4, doorW - 8, doorH - 8);

              // Inner gold trim
              gfxDoors.lineStyle(2, 0xc9a84c, 0.9);
              gfxDoors.strokeRect(doorX + 8, doorY + 8, doorW - 16, doorH - 16);

              // Door panel lines (horizontal planks)
              gfxDoors.lineStyle(1, 0x3d2b1a, 0.6);
              const panelY1 = doorY + doorH * 0.35;
              const panelY2 = doorY + doorH * 0.65;
              gfxDoors.lineBetween(doorX + 12, panelY1, doorX + doorW - 12, panelY1);
              gfxDoors.lineBetween(doorX + 12, panelY2, doorX + doorW - 12, panelY2);

              // Side pillars
              gfxDoors.fillStyle(0x7a5c3a, 0.95);
              gfxDoors.fillRect(doorX, doorY + 2, 8, doorH - 4);
              gfxDoors.fillRect(doorX + doorW - 8, doorY + 2, 8, doorH - 4);

              // Gold corner ornaments
              gfxDoors.fillStyle(0xd4af37, 0.8);
              gfxDoors.fillRect(doorX + 4, doorY + 4, 6, 6);
              gfxDoors.fillRect(doorX + doorW - 10, doorY + 4, 6, 6);
              gfxDoors.fillRect(doorX + 4, doorY + doorH - 10, 6, 6);
              gfxDoors.fillRect(doorX + doorW - 10, doorY + doorH - 10, 6, 6);

              // Center diamond ornament
              const midX = doorX + doorW / 2;
              const midY = doorY + doorH / 2;
              gfxDoors.fillStyle(0xd4af37, 0.7);
              gfxDoors.fillTriangle(midX, midY - 6, midX - 10, midY, midX + 10, midY);
              gfxDoors.fillTriangle(midX, midY + 6, midX - 10, midY, midX + 10, midY);
            }
          }
          this._roomBgs.push(gfxDoors);
        }
        // 各房间贴图 / 程序化地板
        for (const child of tpl.children) {
          const cw = child.tilesW * TILE;
          const ch = child.tilesH * TILE;
          const cx = child.origin.x * TILE;
          const cy = child.origin.y * TILE;

          if (child.procedural) {
            // Procedural room: render with biome floor tiles
            this._renderProceduralRoom(child, cx, cy, cw, ch);
          } else {
            // Image-based room: use room texture
            const bg = this.add.image(cx, cy, child.id)
              .setOrigin(0, 0)
              .setDepth(0.1);
            if (bg.width > 0 && bg.height > 0) {
              bg.setScale(cw / bg.width, ch / bg.height);
            }
            this._roomBgs.push(bg);
          }
        }
      } else {
        // 单房间模式：保留原行为
        const texKey = tpl.id;
        const bg = this.add.image(0, 0, texKey)
          .setOrigin(0, 0)
          .setDepth(0);
        const srcW = bg.width;
        const srcH = bg.height;
        if (srcW > 0 && srcH > 0) {
          bg.setScale(worldW / srcW, worldH / srcH);
        }
        this._roomBgs.push(bg);
        if (tpl.objectLayer && this.textures.exists(tpl.objectLayer)) {
          const objectLayer = this.add.image(0, 0, tpl.objectLayer)
            .setOrigin(0, 0)
            .setDepth(6);
          if (objectLayer.width > 0 && objectLayer.height > 0) {
            objectLayer.setScale(worldW / objectLayer.width, worldH / objectLayer.height);
          }
          this._templateObjectLayer = objectLayer;
          this._templateObjectDepth = 6;
        }
        this._roomBg = bg; // 兼容旧引用
      }

      // —— 2T. 墙体 / 障碍物：用不可见的矩形静态物体作为碰撞 ——
      //
      // 阶段一改造：消除"空气墙"
      //   规则一：墙体（外圈承重墙）保持完整厚度，但每段两端各缩 1 像素，
      //          消除外墙四角的"卡角"问题（玩家贴墙拐弯时容易卡）
      //   规则二：障碍物（家具/展柜）统一内缩 PAD 像素，让玩家可以擦边
      //   规则三：1×1 / 1×2 / 2×1 的瘦小装饰（立柱、盆景、单凳）直接跳过碰撞
      //          这类装饰视觉很小，挡住走位会非常恼人
      this.walls = this.physics.add.staticGroup();

      // —— 墙体：内缩使面积减小约15%（保持中心不变，各维度×0.92） ——
      const WALL_SHRINK = Math.sqrt(0.85); // ~0.922, area reduction ~15%
      const usePixelWalls = !!tpl.wallsInPixels;
      // Image scale correction: annotations are in original image pixels,
      // but the image is rendered at worldW×worldH.
      // Use template's imageWidth/imageHeight if available, fallback to legacy ship dims.
      const imgW = (tpl.imageWidth) || 1070;
      const imgH = (tpl.imageHeight) || 1470;
      const imgScaleX = usePixelWalls ? (worldW / imgW) : 1;
      const imgScaleY = usePixelWalls ? (worldH / imgH) : 1;

      const addWall = (rx, ry, rw, rh) => {
        let cx, cy, W, H;
        if (usePixelWalls) {
          // Pixel mode: rx,ry = top-left pixel in original image; rw,rh = pixel size
          // Apply image scale to match rendered position
          const sx = rx * imgScaleX;
          const sy = ry * imgScaleY;
          const sw = rw * imgScaleX;
          const sh = rh * imgScaleY;
          W = sw * WALL_SHRINK;
          H = sh * WALL_SHRINK;
          cx = sx + sw / 2;
          cy = sy + sh / 2;
        } else {
          // Tile mode: rx,ry = tile coords; rw,rh = tile size
          const fullW = rw * TILE;
          const fullH = rh * TILE;
          W = fullW * WALL_SHRINK;
          H = fullH * WALL_SHRINK;
          cx = rx * TILE + fullW / 2;
          cy = ry * TILE + fullH / 2;
        }
        if (W <= 0 || H <= 0) return;
        const rect = this.add.rectangle(cx, cy, W, H, 0xff0000, 0);
        this.physics.add.existing(rect, true);
        rect.body.updateFromGameObject();
        rect._dbgTag = 'wall';
        this.walls.add(rect);
      };
      for (const r of (this._template.walls || [])) addWall(r.x, r.y, r.w || 1, r.h || 1);

      // —— 障碍物：过滤小装饰 + 面积缩小15%（保持中心不变） ——
      for (const r of (this._template.obstacles || [])) {
        const rw = r.w || 1;
        const rh = r.h || 1;
        // 过滤瘦小装饰：面积≤3 (1×1, 1×2, 2×1, 1×3, 3×1) 全跳过
        // 这些通常是立柱、单凳、香炉、小盆景，挡走位极不友好
        if (rw * rh <= 3) continue;
        const w = Math.max(8, rw * TILE * WALL_SHRINK);
        const h = Math.max(8, rh * TILE * WALL_SHRINK);
        const cx = r.x * TILE + (rw * TILE) / 2;
        const cy = r.y * TILE + (rh * TILE) / 2;
        const rect = this.add.rectangle(cx, cy, w, h, 0xff0000, 0);
        this.physics.add.existing(rect, true);
        rect.body.updateFromGameObject();
        rect._dbgTag = 'obstacle';
        this.walls.add(rect);
      }

      for (const r of (this._template.pixelColliders || [])) {
        const w = Math.max(1, r.w || 1);
        const h = Math.max(1, r.h || 1);
        const rect = this.add.rectangle(r.x + w / 2, r.y + h / 2, w, h, 0xff0000, 0);
        this.physics.add.existing(rect, true);
        rect.body.updateFromGameObject();
        rect._dbgTag = r.tag || 'pixelCollider';
        this.walls.add(rect);
      }
    } else {
      // —— 1. 铺地板（biome 提供贴图序列，伪噪声选变体避免重复感）——
      const floorKeys = (this.biome && this.biome.floorKeys && this.biome.floorKeys.length)
        ? this.biome.floorKeys
        : ['tex_floor', 'tex_floor', 'tex_floor', 'tex_floor_a', 'tex_floor_b'];
      for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
          const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
          const idx = h % floorKeys.length;
          this.add.image(x * TILE, y * TILE, floorKeys[idx]).setOrigin(0, 0).setDepth(0);
        }
      }

      // —— 2. 墙体（由关卡生成器产出，biome 决定贴图套装）——
      this.walls = this.physics.add.staticGroup();
      const wallTopKey = (this.biome && this.biome.wallTopKey) || 'tex_wall_top';
      const wallKey = (this.biome && this.biome.wallKey) || 'tex_wall';
      for (const key of level.walls) {
        const [sx, sy] = key.split(',').map(Number);
        const isTop = sy === 0;
        this.spawnWall(sx, sy, isTop ? wallTopKey : wallKey);
      }
    }

    // —— 3. 文物（带展柜底座 + 类型化贴图，位置随机） ——
    this.relicGroup = this.physics.add.group();
    const relicSpawns = level.relicSpawns;
    relicSpawns.forEach((s) => {
      const data = RELICS[s.relicIdx];
      const cx = s.x * TILE + TILE / 2;
      const cy = s.y * TILE + TILE / 2;
      // 展柜底座
      const base = this.add.image(cx, cy, 'tex_case').setDepth(1).setScale(1.4);
      // 文物本体
      const iconKey = data.icon || 'tex_relic';
      const r = this.relicGroup.create(cx, cy - 2, iconKey);
      r.setData('relic', data).setDepth(2);
      this._fitRelicSprite(r, iconKey);
      r.body.setSize(16, 16);
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

    // —— 3.5 容器（文物可能装在容器里；另有补给箱/陷阱箱） ——
    this.containerGroup = this.physics.add.staticGroup();
    this.containers = [];
    if (level.containers && level.containers.length) {
      // 把容器里"装的文物"也算进总数（决定通关进度显示）
      const relicInBox = level.containers.filter((c) => typeof c.relicIdx === 'number').length;
      this.totalRelicsOnMap += relicInBox;
      for (const cd of level.containers) this.spawnContainer(cd);
    }

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

    // —— 4.5 装饰物（灯笼 / 牌区 / 屏风 / 香炉）——
    // 模板 / 复合模式下房间贴图自带装饰，跳过程序化装饰以避免与贴图重叠
    if (!this.useTemplate && !this.useComposed) {
      this.decorLights = this.placeDecorations();
    } else {
      this.decorLights = [];
      this.lanterns = [];
    }    // —— 5. 玩家（C键切换：持刀 ↔ 原始 > LimeZu兜底）——
    this._charConfigs = {};
    this._charTypes = [];
    if (this.textures.exists('hero_knife')) {
      this._charTypes.push('knife');
      this._charConfigs.knife = { tex:'hero_knife', scale:0.2, bodyW:100, bodyH:50, bodyOx:78, bodyOy:204, prefix:'hero_knife', directional:true };
    }
    if (this.textures.exists('hero_hongfa')) {
      this._charTypes.push('hongfa');
      this._charConfigs.hongfa = { tex:'hero_hongfa', scale:0.85, bodyW:22, bodyH:12, bodyOx:21, bodyOy:48, prefix:'hero', directional:false };
    }
    this._useLZPlayer = this._charTypes.length === 0 && this.textures.exists('lz_adam_idle');
    this._useHeroPlayer = this._charTypes.length > 0 || this._useLZPlayer;
    this._charIndex = 0;
    const initTex = this._charTypes.length > 0 ? this._charConfigs[this._charTypes[0]].tex
      : (this._useLZPlayer ? 'lz_adam_idle' : 'tex_player');
    this.player = this.physics.add.sprite(
      level.spawn.x * TILE + TILE / 2,
      level.spawn.y * TILE + TILE / 2,
      initTex,
      this._charTypes.length > 0 ? 0 : (this._useLZPlayer ? 18 : 0)
    );
    this.player.setCollideWorldBounds(true);
    if (this._charTypes.length > 0) {
      this._applyCharConfig(0);
    } else if (this._useLZPlayer) {
      this.player.body.setSize(10, 12).setOffset(3, 18);
      this.player.setScale(1.7);
    } else {
      this.player.body.setSize(12, 18).setOffset(2, 4);
      this.player.setScale(1.7);
    }
    this._useKnifeHero = false;
    this.player.setDepth(5);
    if (this._templateObjectLayer) {
      this._playerFrontDepth = 7;
      this._playerBackDepth = 5;
      this.player.setDepth(this._playerFrontDepth);
    }
    // 标记
    if (this._charTypes.length > 0) {
      const initType = this._charTypes[0];
      const prefix = this._charConfigs[initType].prefix;
      if (this.anims.exists(`${prefix}_idle_down`)) this.player.play(`${prefix}_idle_down`);
    } else if (this._useLZPlayer && this.anims.exists('adam_idle_down')) {
      this.player.play('adam_idle_down');
    }
    // 玩家朝向（弧度），鼠标方向决定光锥朝向
    this.player.setData('aim', 0);
    // 贴图水平朝向：1=面向右，-1=面向左（兼容旧贴图）
    this._playerFacingX = 1;
    // 当前播放的方向（LimeZu 模式下使用）
    this._playerDir4 = 'down';
    // 行走帧切换计时（旧贴图模式仍使用）
    this._playerWalkPhase = 0;
    this._playerWalkAccum = 0;

    this.physics.add.collider(this.player, this.walls);
    // 容器与玩家碰撞（容器在玩家之前生成，统一在此挂载）
    if (this.containerGroup) {
      this.physics.add.collider(this.player, this.containerGroup);
    }

    // —— 相机跟随（模板 / 复合模式下房间可能大于视口）——
    if ((this.useTemplate || this.useComposed) && this._cameraNeedFollow) {
      this.cameras.main.startFollow(this.player, true, 0.18, 0.18);
      this.cameras.main.setDeadzone(120, 80);
    }    // —— 玩家战斗 / 状态属性 ——
    // 装备的武器（在 effects 里读取，默认 starter）
    const equippedWeapon = (this._loadoutEff && this._loadoutEff.weapon) || null;
    // 初始弹药：远程武器才有
    const initialAmmo = (equippedWeapon && equippedWeapon.kind === 'ranged')
      ? (equippedWeapon.ammoMax || 0) : 0;

    this.playerState = {
      hpMax: 3,
      hp: 3,
      stamMax: 100,
      stam: 100,
      stealth: false,        // Shift
      sprint: false,         // Ctrl
      blocking: false,       // K（按住）
      attackUntil: 0,        // 攻击动画/判定有效期
      attackAnimUntil: 0,    // 主角攻击帧图播放保护，避免被走路动画立刻覆盖
      attackHitDone: false,  // 本次挥刀是否已结算
      attackDir: 0,          // 本次攻击方向（弧度）
      attackCooldownUntil: 0,// 出招冷却结束
      invulnUntil: 0,        // 受击无敌帧
      staggerUntil: 0,       // 受击僵直结束（期间禁止键盘控制 velocity）
      attackRange: (equippedWeapon && equippedWeapon.range) || 32,   // 本次挥刀范围（近战）
      attackArc:   (equippedWeapon && equippedWeapon.arc) || (Math.PI / 3),
      bladeSkillUntil: 0,
      bladeSkillCooldownUntil: 0,
      ammo: initialAmmo,     // 远程弹药剩余
      qinggongUntil: 0,      // 轻功符效果结束时间
      qinggongMul: 1         // 轻功期间的速度倍率
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
      U: Phaser.Input.Keyboard.KeyCodes.U,
      K: Phaser.Input.Keyboard.KeyCodes.K,
      TAB: Phaser.Input.Keyboard.KeyCodes.TAB,
      ESC: Phaser.Input.Keyboard.KeyCodes.ESC,
      H: Phaser.Input.Keyboard.KeyCodes.H,
      G: Phaser.Input.Keyboard.KeyCodes.G,
      V: Phaser.Input.Keyboard.KeyCodes.V,
      C: Phaser.Input.Keyboard.KeyCodes.C,
      F1: Phaser.Input.Keyboard.KeyCodes.F1,
      F2: Phaser.Input.Keyboard.KeyCodes.F2
    });
    // 防止 Tab/Ctrl/F1/F2 默认行为（页面焦点切换 / 浏览器快捷键 / 帮助页面）
    this.input.keyboard.addCapture('TAB');
    this.input.keyboard.addCapture('CTRL');
    this.input.keyboard.addCapture(Phaser.Input.Keyboard.KeyCodes.F1);
    this.input.keyboard.addCapture(Phaser.Input.Keyboard.KeyCodes.F2);
    this.keys.TAB.on('down', () => this.toggleInventoryPanel());
    this.keys.H.on('down', () => this.useMedkit());
    this.keys.G.on('down', () => this.useSmokeBomb());
    this.keys.V.on('down', () => this.useQinggong());
    this.keys.C.on('down', () => this._switchCharacter());
    // F1/F2: toggle debug collision visualization
    this.input.keyboard.on('keydown', (evt) => {
      const code = evt.keyCode || evt.key;
      if (code === Phaser.Input.Keyboard.KeyCodes.F1 || code === Phaser.Input.Keyboard.KeyCodes.F2 ||
          code === 112 || code === 113) {
        if (evt.preventDefault) evt.preventDefault();
        this.toggleDebugColliders();
      }
    });

    // 鼠标左键 = 近战攻击（与 J 等价）；鼠标右键 = 远程攻击（装备远程武器时）
    this.input.on('pointerdown', (ptr) => {
      if (this._ended) return;
      // 即时刷新 aim：避免使用上一帧的过期方向，导致"点左边却往右打"
      if (this.player && this.player.active) {
        const aimNow = Math.atan2(ptr.worldY - this.player.y, ptr.worldX - this.player.x);
        this.player.setData('aim', aimNow);
      }
      if (ptr.leftButtonDown()) {
        this.tryPlayerAttack();
      } else if (ptr.rightButtonDown && ptr.rightButtonDown()) {
        this.tryPlayerRangedAttack();
      }
    });
    // 禁用鼠标右键默认弹出菜单
    this.input.mouse.disableContextMenu();

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

    // —— 装备效果：在所有依赖前提前解析一次 ——
    this._loadoutEff = SaveData.resolveEffects();

    // Fix: re-initialize ammo now that _loadoutEff is available
    if (this._loadoutEff && this._loadoutEff.weapon && this._loadoutEff.weapon.kind === 'ranged') {
      this.playerState.ammo = this._loadoutEff.weapon.ammoMax || 0;
    }

    // —— 10. 倒计时（180 秒撤离时限；信标可缩短） ——
    this.timeLeft = Math.round(180 * (this._loadoutEff.extractCdMul || 1));
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
    this.vignette = this.add.image(640, 360, 'tex_vignette')
      .setDisplaySize(1280, 720)
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
  //  从房间模板构造一个与 generateLevel(...) 输出兼容的 level 对象
  //  关键字段：walls(Set"x,y") / floors(Array{x,y}) / spawn / exit / rooms / relicSpawns / containers / guardPaths
  // ————————————————————————————————————————
  _buildLevelFromTemplate(tpl) {
    const W = tpl.tilesW;
    const H = tpl.tilesH;

    // 1) 展开墙体 + 障碍物 → 瓦片占用集合
    const walls = new Set();
    const k = (x, y) => `${x},${y}`;
    const fillRect = (r) => {
      for (let yy = r.y; yy < r.y + (r.h || 1); yy++) {
        for (let xx = r.x; xx < r.x + (r.w || 1); xx++) walls.add(k(xx, yy));
      }
    };
    for (const r of (tpl.walls || [])) fillRect(r);
    for (const r of (tpl.obstacles || [])) fillRect(r);

    // 2) 计算 floors（所有非墙非障碍且在房间内的格子）
    const floors = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!walls.has(k(x, y))) floors.push({ x, y });
      }
    }

    // 3) 出生点 / 撤离点
    const spawn = (tpl.special && tpl.special.playerSpawn) || { x: Math.floor(W / 2), y: H - 2 };
    const exit  = (tpl.special && tpl.special.exit)        || { x: Math.floor(W / 2), y: 1 };

    // 4) 文物刷新：从 placeable 列表中随机抽 N 个，加上保险箱（若有）
    // ★ 增加物资数量：relicCount 翻倍 ★
    const baseRelicCount = (this.biome && this.biome.relicCount) || 5;
    const relicCount = baseRelicCount * 2;
    const placeable = (tpl.placeable || []).slice();
    // 过滤掉与出生/撤离重叠的格子
    const occupied = new Set([k(spawn.x, spawn.y), k(exit.x, exit.y)]);
    for (let i = placeable.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [placeable[i], placeable[j]] = [placeable[j], placeable[i]];
    }
    const relicSpawns = [];
    const usedRelicIdx = new Set();
    for (const cell of placeable) {
      if (relicSpawns.length >= relicCount) break;
      if (occupied.has(k(cell.x, cell.y))) continue;
      // 随机不重复文物
      let idx, tries = 0;
      do { idx = Math.floor(Math.random() * RELICS.length); tries++; }
      while (usedRelicIdx.has(idx) && tries < 12 && usedRelicIdx.size < RELICS.length);
      usedRelicIdx.add(idx);
      relicSpawns.push({ x: cell.x, y: cell.y, relicIdx: idx });
      occupied.add(k(cell.x, cell.y));
    }

    // 5) 容器：保险箱（07 号专用）+ 其他普通木箱
    const containers = [];
    if (tpl.special && tpl.special.safe) {
      const s = tpl.special.safe;
      // 保险箱固定刷一件高价值文物
      let safeRelicIdx = 0;
      let bestVal = -1;
      RELICS.forEach((r, i) => { if ((r.value || 0) > bestVal && !usedRelicIdx.has(i)) { bestVal = r.value || 0; safeRelicIdx = i; } });
      usedRelicIdx.add(safeRelicIdx);
      containers.push({ x: s.x, y: s.y, kind: 'safe', relicIdx: safeRelicIdx });
      occupied.add(k(s.x, s.y));
    }

    // For full-map PNG mode (wallsInPixels), pick container positions from walkable
    // floors OUTSIDE the relic display zones to avoid visual overlap with relics.
    // NOTE: Chests are now placed AFTER guard paths are generated (see below).
    if (tpl.wallsInPixels) {
      // Build a set of tiles used by placeable (relic zones) to exclude them
      const relicZoneTiles = new Set();
      for (const cell of placeable) relicZoneTiles.add(k(cell.x, cell.y));
      // Store candidates for later use (after guard paths are determined)
      this._containerCandidates = floors.filter(f =>
        !relicZoneTiles.has(k(f.x, f.y)) && !occupied.has(k(f.x, f.y))
      );
      this._containerOccupied = occupied;
    } else {
      for (const cell of placeable) {
        if (containers.length >= 6 + (tpl.special && tpl.special.safe ? 1 : 0)) break;
        if (occupied.has(k(cell.x, cell.y))) continue;
        // 50% 概率放普通木箱（含补给）— 增加物资密度
        if (Math.random() < 0.5) {
          containers.push({ x: cell.x, y: cell.y, kind: 'plain', lootKind: 'medkit' });
          occupied.add(k(cell.x, cell.y));
        }
      }
    }

    // 6) 守卫巡逻路径
    const guardCount = (this.biome && this.biome.guardCount) || 2;
    const guardPaths = [];
    const guardBounds = []; // 与 guardPaths 同序，每条路径对应一个 room 矩形约束
    const allPlaceable = (tpl.placeable || []);

    // 按 roomId 分桶（走廊点 '__corridor__' 不参与守卫巡逻）
    const buckets = new Map();
    for (const pt of allPlaceable) {
      const rid = pt.roomId;
      if (!rid || rid === '__corridor__') continue;
      if (!buckets.has(rid)) buckets.set(rid, []);
      buckets.get(rid).push(pt);
    }

    // 复合地图带 roomBounds；单房间模式 fallback 到整个房间边界
    const roomBoundsMap = (tpl.roomBounds) || {};
    const fallbackBounds = { x: 1, y: 1, w: W - 2, h: H - 2 };

    const biomeId = this.biome && this.biome.id;

    if (biomeId === 'ship' && buckets.size > 0) {
      // ★ 走私船特殊模式：船员自由穿梭全船各区域 ★
      // 每个船员的巡逻路径从不同区域随机抽取点，形成贯穿全船的长距离路线
      const roomIds = Array.from(buckets.keys());
      const allPoints = [];
      for (const [, pts] of buckets) {
        // Each room contributes its center point
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        allPoints.push({ x: Math.round(cx), y: Math.round(cy) });
        // Also add individual points for variety
        pts.forEach(p => allPoints.push({ x: p.x, y: p.y }));
      }

      for (let i = 0; i < guardCount; i++) {
        // Build a path that visits 6-10 waypoints across different areas
        const waypointCount = 6 + Math.floor(Math.random() * 5); // 6~10 waypoints
        const path = [];
        const usedIndices = new Set();

        // Start from a different offset for each guard
        const startOffset = Math.floor(i * allPoints.length / guardCount);

        for (let w = 0; w < waypointCount; w++) {
          // Pick points spread across the map, avoiding duplicates
          let idx = (startOffset + Math.floor(w * allPoints.length / waypointCount)
            + Math.floor(Math.random() * 3)) % allPoints.length;
          // Find next unused index
          let attempts = 0;
          while (usedIndices.has(idx) && attempts < allPoints.length) {
            idx = (idx + 1) % allPoints.length;
            attempts++;
          }
          if (!usedIndices.has(idx)) {
            usedIndices.add(idx);
            path.push(allPoints[idx]);
          }
        }

        if (path.length >= 2) {
          guardPaths.push(path.map((p) => ({ x: p.x, y: p.y })));
          // ★ No patrolBounds for ship crew — they roam freely ★
          guardBounds.push(null);
        }
      }
    } else if (buckets.size > 0) {
      // 非走私船复合地图：每个有 placeable 的房间分配一个守卫（最多 guardCount 个）
      const roomIds = Array.from(buckets.keys());
      const pickCount = Math.min(guardCount, roomIds.length);
      for (let i = 0; i < pickCount; i++) {
        const rid = roomIds[i];
        const corners = buckets.get(rid);
        if (corners.length < 2) continue;
        // 在该房间内取 4 个角形成环路（不够 4 个就重复填充）
        const n = corners.length;
        const path = [];
        for (let k = 0; k < 4; k++) {
          path.push(corners[Math.floor(k * n / 4) % n]);
        }
        guardPaths.push(path.map((p) => ({ x: p.x, y: p.y })));
        guardBounds.push(roomBoundsMap[rid] || fallbackBounds);
      }
    } else {
      // 单房间模式 fallback：原逻辑（4 角环路）
      const corners = allPlaceable.slice();
      if (corners.length >= 4) {
        const n = corners.length;
        for (let i = 0; i < guardCount; i++) {
          const offset = Math.floor(i * (n / Math.max(guardCount, 1)));
          const path = [
            corners[(offset) % n],
            corners[(offset + Math.floor(n / 4)) % n],
            corners[(offset + Math.floor(n / 2)) % n],
            corners[(offset + Math.floor((3 * n) / 4)) % n]
          ];
          guardPaths.push(path.map((p) => ({ x: p.x, y: p.y })));
          guardBounds.push(fallbackBounds);
        }
      }
    }

    // 7) rooms 字段（用于装饰回避，模板模式下基本不会再调用）：把整个房间内部当成一个 room
    const rooms = [{ x: 1, y: 1, w: W - 2, h: H - 2 }];

    // 8) Place chests near guard spawn points (for wallsInPixels mode)
    //    Only 2 chests total, placed adjacent to 2 different guards' starting positions.
    if (tpl.wallsInPixels && guardPaths.length >= 2 && this._containerCandidates) {
      const candidates = this._containerCandidates;
      const occupied = this._containerOccupied;
      // Pick 2 guards (first and a middle one) to place chests near
      const guardIndices = [0, Math.min(Math.floor(guardPaths.length / 2), guardPaths.length - 1)];
      for (const gi of guardIndices) {
        if (containers.length >= 2) break; // max 2 chests
        const guardStart = guardPaths[gi][0]; // first waypoint of this guard
        // Find the closest candidate tile to this guard's start position
        let bestDist = Infinity;
        let bestCell = null;
        for (const cell of candidates) {
          if (occupied.has(k(cell.x, cell.y))) continue;
          const dx = cell.x - guardStart.x;
          const dy = cell.y - guardStart.y;
          const dist = dx * dx + dy * dy;
          // Place within 1~4 tiles of the guard (not on top, not too far)
          if (dist >= 1 && dist <= 16 && dist < bestDist) {
            bestDist = dist;
            bestCell = cell;
          }
        }
        if (bestCell) {
          containers.push({ x: bestCell.x, y: bestCell.y, kind: 'plain', lootKind: 'medkit' });
          occupied.add(k(bestCell.x, bestCell.y));
        }
      }
      // Clean up temp references
      delete this._containerCandidates;
      delete this._containerOccupied;
    }

    return {
      walls,
      floors,
      relicSpawns,
      containers,
      exit,
      spawn,
      rooms,
      guardPaths,
      guardBounds
    };
  }

  // ————————————————————————————————————————
  //  调试模式：F2 切换碰撞箱可视化（红色半透明矩形 + 关键锚点）
  // ————————————————————————————————————————
  updateTemplateObjectDepth() {
    if (!this.player || !this._templateObjectLayer || !this._template) return;
    const regions = this._template.adjustRegions || [];
    if (!regions.length) {
      this.player.setDepth(this._playerFrontDepth || 7);
      return;
    }

    const body = this.player.body;
    const px = body ? body.center.x : this.player.x;
    const py = body ? body.bottom : this.player.y;
    const behindObject = regions.some((r) =>
      px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
    );

    this.player.setDepth(behindObject ? (this._playerBackDepth || 5) : (this._playerFrontDepth || 7));
  }

  toggleDebugColliders() {
    console.log('[DEBUG] toggleDebugColliders called, walls:', this.walls ? this.walls.getChildren().length : 'null');
    if (!this._dbgGfx) {
      this._dbgGfx = this.add.graphics().setDepth(200);
    }
    this._dbgVisible = !this._dbgVisible;
    const g = this._dbgGfx;
    g.clear();
    if (!this._dbgVisible) {
      if (this._dbgTexts) { this._dbgTexts.forEach((t) => t.destroy()); this._dbgTexts = []; }
      return;
    }
    // 画所有 wall 静态体（红色半透明）
    if (this.walls) {
      g.fillStyle(0xff3030, 0.35);
      g.lineStyle(1, 0xff8080, 0.9);
      this.walls.getChildren().forEach((w) => {
        const b = w.body;
        if (!b) return;
        g.fillRect(b.x, b.y, b.width, b.height);
        g.strokeRect(b.x, b.y, b.width, b.height);
      });
    }
    // 画守卫巡逻点
    if (this.guards) {
      g.fillStyle(0x30c0ff, 0.7);
      for (const gd of this.guards) {
        for (const p of (gd.waypoints || [])) g.fillCircle(p.x, p.y, 4);
      }
    }
    // 画文物刷新点
    if (this._template && this._template.adjustRegions) {
      g.fillStyle(0x7a3eb1, 0.28);
      g.lineStyle(1, 0xc084fc, 0.95);
      for (const r of this._template.adjustRegions) {
        g.fillRect(r.x, r.y, r.w, r.h);
        g.strokeRect(r.x, r.y, r.w, r.h);
      }
    }
    if (this.relicGroup) {
      g.fillStyle(0xffd060, 0.9);
      this.relicGroup.getChildren().forEach((r) => g.fillCircle(r.x, r.y, 3));
    }
    // 画出生与撤离锚点
    if (this._level) {
      g.fillStyle(0x60ff60, 1);
      g.fillRect(this._level.spawn.x * TILE + 8, this._level.spawn.y * TILE + 8, 16, 16);
      g.fillStyle(0x60ffff, 1);
      g.fillRect(this._level.exit.x * TILE + 8, this._level.exit.y * TILE + 8, 16, 16);
    }
    // 提示
    this._dbgTexts = this._dbgTexts || [];
    const tip = this.add.text(8, 8, 'DEBUG · F1 关闭 · 红:墙体  蓝点:巡逻  金点:文物  绿块:出生  青块:撤离',
      { fontFamily: '"PingFang SC"', fontSize: '11px', color: '#ffeeaa', backgroundColor: '#000000aa', padding: { x: 4, y: 2 } })
      .setScrollFactor(0).setDepth(201);
    this._dbgTexts.push(tip);
  }

  // ————————————————————————————————————————
  //  守卫部署：使用生成器产出的巡逻路径点（瓦片坐标转为世界坐标）
  // ————————————————————————————————————————
  spawnGuards() {
    this.guards = [];
    const paths = (this._level && this._level.guardPaths) || [];
    const bounds = (this._level && this._level.guardBounds) || [];
    for (let i = 0; i < paths.length; i++) {
      const tilePath = paths[i];
      if (!tilePath || tilePath.length < 2) continue;
      const worldPath = tilePath.map((p) => ({
        x: p.x * TILE + TILE / 2,
        y: p.y * TILE + TILE / 2
      }));
      const guardStyle = (this.biome && this.biome.guardStyle) || 'museum';
      const g = new Guard(this, worldPath, guardStyle);
      // ★ 给守卫硬约束：只能在自己房间的世界像素矩形内活动 ★
      const bnd = bounds[i];
      if (bnd) {
        g.setPatrolBounds({
          x: bnd.x * TILE,
          y: bnd.y * TILE,
          w: bnd.w * TILE,
          h: bnd.h * TILE
        });
      }
      g.onStateChange = (newSt, oldSt, guard) => this.onGuardStateChange(newSt, oldSt, guard);
      // 警觉拉满时通知附近同伴一起搜
      g.onAlarm = (caller, radius) => this.notifyNearbyGuards(caller, radius);
      this.guards.push(g);
    }

    // ★ 为所有守卫添加与墙壁的物理碰撞，防止穿墙 ★
    if (this.walls) {
      for (const g of this.guards) {
        if (g.sprite && g.sprite.body) {
          this.physics.add.collider(g.sprite, this.walls);
        }
      }
    }

    // —— 初始化安保摄像头 ——
    this._setupSecurityCameras();
    // —— 初始化地刺陷阱 ——
    this._setupSpikeTraps();

    // —— Biome 特色机制 ——
    const biomeId = this.biome && this.biome.id;
    if (biomeId === 'museum') {
      // 红色警报特效（进入博物馆即触发）
      this._triggerAlarmEffect();
    } else if (biomeId === 'blackmarket') {
      // 黑市特色：霓虹灯光 + 暗门提示
      this._setupNeonLights();
      this._setupBlackmarketAmbience();
    } else if (biomeId === 'ship') {
      // 走私船特色：船体摇晃 + 水淹区域
      this._setupShipSway();
      this._setupWaterZones();
    }
  }

  // ——————————————————————————————————————
  //  守卫联动：当某个守卫警觉拉满，半径 radius 内的同伴一起进入警戒
  // ——————————————————————————————————————
  notifyNearbyGuards(caller, radius) {
    if (!this.guards || !caller || !caller.sprite) return;
    const r2 = radius * radius;
    for (const other of this.guards) {
      if (other === caller || other.dead || !other.sprite) continue;
      const dx = other.sprite.x - caller.sprite.x;
      const dy = other.sprite.y - caller.sprite.y;
      if (dx * dx + dy * dy > r2) continue;
      other.receiveAlarm(caller);
    }
  }


  // ——————————————————————————————————————
  //  Procedural Room Rendering: render rooms using biome floor/wall textures
  // ——————————————————————————————————————
  _renderProceduralRoom(child, cx, cy, cw, ch) {
    const floorKeys = (this.biome && this.biome.floorKeys) || ['tex_floor'];
    const wallKey = (this.biome && this.biome.wallKey) || 'tex_wall';

    // Background fill
    const bgColor = this.biome && this.biome.id === 'ship' ? 0x2a1c10 : 0x181420;
    const bg = this.add.rectangle(cx + cw / 2, cy + ch / 2, cw, ch, bgColor)
      .setOrigin(0.5, 0.5).setDepth(0.05);
    this._roomBgs.push(bg);

    // Floor tiles
    const gfx = this.add.graphics().setDepth(0.1);
    for (let ty = 0; ty < child.tilesH; ty++) {
      for (let tx = 0; tx < child.tilesW; tx++) {
        const px = cx + tx * TILE;
        const py = cy + ty * TILE;
        // Use biome floor texture if available, otherwise draw colored tiles
        const floorKey = floorKeys[(tx + ty * 3) % floorKeys.length];
        if (this.textures.exists(floorKey)) {
          const tile = this.add.image(px, py, floorKey).setOrigin(0, 0).setDepth(0.1);
          tile.setDisplaySize(TILE, TILE);
          this._roomBgs.push(tile);
        } else {
          // Fallback: colored tile pattern
          const dark = (tx + ty) % 2 === 0;
          gfx.fillStyle(dark ? bgColor : (bgColor + 0x111111), 0.9);
          gfx.fillRect(px, py, TILE, TILE);
        }
      }
    }
    this._roomBgs.push(gfx);

    // Room-specific decorations based on biome
    if (this.biome && this.biome.id === 'blackmarket') {
      this._decorateBlackmarketRoom(child, cx, cy, cw, ch);
    } else if (this.biome && this.biome.id === 'ship') {
      this._decorateShipRoom(child, cx, cy, cw, ch);
    }
  }

  // Decorate black market rooms with neon accents and grime
  _decorateBlackmarketRoom(child, cx, cy, cw, ch) {
    const gfx = this.add.graphics().setDepth(0.15);

    // Neon border glow (purple/pink)
    const neonColor = child.id.includes('hub') ? 0xc070ff :
                      child.id.includes('den') ? 0x40ff70 :
                      child.id.includes('alley') ? 0xff4070 : 0xffaa30;
    gfx.lineStyle(2, neonColor, 0.6);
    gfx.strokeRect(cx + 4, cy + 4, cw - 8, ch - 8);

    // Inner glow effect
    gfx.lineStyle(1, neonColor, 0.3);
    gfx.strokeRect(cx + 8, cy + 8, cw - 16, ch - 16);

    // Random grime spots
    gfx.fillStyle(0x0a0712, 0.4);
    for (let i = 0; i < 5; i++) {
      const gx = cx + 20 + Math.floor(Math.random() * (cw - 40));
      const gy = cy + 20 + Math.floor(Math.random() * (ch - 40));
      gfx.fillCircle(gx, gy, 8 + Math.random() * 12);
    }

    this._roomBgs.push(gfx);
  }

  // Decorate ship rooms with metal plates and portholes
  _decorateShipRoom(child, cx, cy, cw, ch) {
    // Skip decoration for full-map PNG (artwork already contains visual details)
    if (child.id === 'ship_full' || child.id === 'museum_full') return;

    const gfx = this.add.graphics().setDepth(0.15);

    // Steel plate seams
    gfx.lineStyle(1, 0x0a1420, 0.6);
    const seamSpacing = TILE * 3;
    for (let sx = cx + seamSpacing; sx < cx + cw; sx += seamSpacing) {
      gfx.lineBetween(sx, cy + 4, sx, cy + ch - 4);
    }
    for (let sy = cy + seamSpacing; sy < cy + ch; sy += seamSpacing) {
      gfx.lineBetween(cx + 4, sy, cx + cw - 4, sy);
    }

    // Rivets at intersections
    gfx.fillStyle(0x6a8aa8, 0.7);
    for (let sx = cx + seamSpacing; sx < cx + cw; sx += seamSpacing) {
      for (let sy = cy + seamSpacing; sy < cy + ch; sy += seamSpacing) {
        gfx.fillCircle(sx, sy, 2);
      }
    }

    // Rust stains
    gfx.fillStyle(0x5a3018, 0.3);
    for (let i = 0; i < 3; i++) {
      const rx = cx + 30 + Math.floor(Math.random() * (cw - 60));
      const ry = cy + 30 + Math.floor(Math.random() * (ch - 60));
      gfx.fillEllipse(rx, ry, 15 + Math.random() * 20, 8 + Math.random() * 10);
    }

    this._roomBgs.push(gfx);
  }

  // ——————————————————————————————————————
  //  Security Cameras: rotating beam that detects player
  // ——————————————————————————————————————
  _setupSecurityCameras() {
    this._cameras = [];
    if (!this._template || !this._template.children) return;
    const TILE_PX = TILE;

    // For full-map mode (single child covering entire map), use roomBounds instead
    const children = this._template.children;
    if (children.length === 1 && (children[0].id === 'ship_full' || children[0].id === 'museum_full') && this._template.roomBounds) {
      const bounds = this._template.roomBounds;
      // Place cameras in key rooms: vault, operations, cargo_hold
      const cameraRooms = ['vault_main', 'operations', 'cargo_hold', 'engine_room'];
      for (const roomId of cameraRooms) {
        const rb = bounds[roomId];
        if (!rb) continue;
        const ox = rb.x * TILE_PX;
        const oy = rb.y * TILE_PX;
        const rw = rb.w * TILE_PX;
        const rh = rb.h * TILE_PX;

        // Top-left corner camera
        const cam1 = new SecurityCamera(this, ox + 32, oy + 32, Math.PI / 4);
        cam1.onAlarm = () => this._onCameraAlarm();
        this._cameras.push(cam1);

        // Bottom-right corner camera for larger rooms
        if (rb.w >= 10 && rb.h >= 8) {
          const cam2 = new SecurityCamera(this, ox + rw - 32, oy + rh - 32, -Math.PI * 3 / 4);
          cam2.onAlarm = () => this._onCameraAlarm();
          this._cameras.push(cam2);
        }
      }
      return;
    }

    // Legacy: Place cameras at room corners (2 per large room, 1 per small room)
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const ox = child.origin.x * TILE_PX;
      const oy = child.origin.y * TILE_PX;
      const rw = child.tilesW * TILE_PX;
      const rh = child.tilesH * TILE_PX;

      // Top-left corner camera pointing down-right
      const cam1 = new SecurityCamera(this, ox + 32, oy + 32, Math.PI / 4);
      cam1.onAlarm = () => this._onCameraAlarm();
      this._cameras.push(cam1);

      // Bottom-right corner camera pointing up-left (only for larger rooms)
      if (child.tilesW >= 20 && child.tilesH >= 20) {
        const cam2 = new SecurityCamera(this, ox + rw - 32, oy + rh - 32, -Math.PI * 3 / 4);
        cam2.onAlarm = () => this._onCameraAlarm();
        this._cameras.push(cam2);
      }
    }
  }

  _updateSecurityCameras(delta) {
    if (!this._cameras || !this.player) return;
    for (const cam of this._cameras) {
      cam.update(delta, this.player);
    }
  }

  _onCameraAlarm() {
    // Alert all guards when camera detects player
    if (this.guards) {
      for (const g of this.guards) {
        if (!g.dead) {
          g.alert = 100;
          g.state = 'chase';
        }
      }
    }
    this._runStats.alerts++;
    this.showBubble(this.player, '被摄像头发现了！', { color: '#ff4444', fontSize: '14px', duration: 2000, dy: -30 });
  }

  // ——————————————————————————————————————
  //  Spike Traps: random floor spikes that pop up periodically
  // ——————————————————————————————————————
  _setupSpikeTraps() {
    this._spikeTraps = [];
    if (!this._level || !this._level.floors) return;
    const floors = this._level.floors;
    // Place 8~12 spike traps on random floor tiles (avoid spawn/exit)
    const spawn = this._level.spawn;
    const exit = this._level.exit;
    const candidates = floors.filter(f => {
      if (f.x === spawn.x && f.y === spawn.y) return false;
      if (f.x === exit.x && f.y === exit.y) return false;
      return true;
    });
    // Shuffle and pick
    const count = Math.min(10, Math.floor(candidates.length * 0.005) + 5);
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    for (let i = 0; i < count && i < candidates.length; i++) {
      const cell = candidates[i];
      const trap = new SpikeTrap(this, cell.x * TILE + TILE / 2, cell.y * TILE + TILE / 2);
      trap.onHitPlayer = () => {
        const ps = this.playerState;
        const now = this.time.now;
        if (now > ps.invulnUntil) {
          this.applyPlayerDamage(1, null, '踩到地刺！');
        }
      };
      this._spikeTraps.push(trap);
    }
  }

  _updateSpikeTraps(delta) {
    if (!this._spikeTraps || !this.player) return;
    for (const trap of this._spikeTraps) {
      trap.update(delta, this.player);
    }
  }

  // ——————————————————————————————————————
  //  Red Alert Effect: triggered immediately when entering museum
  // ——————————————————————————————————————
  _triggerAlarmEffect() {
    // Red flash overlay
    const { width, height } = this.cameras.main;
    this._alarmOverlay = this.add.rectangle(
      this.cameras.main.scrollX + width / 2,
      this.cameras.main.scrollY + height / 2,
      width * 3, height * 3,
      0xff0000, 0
    ).setDepth(150).setScrollFactor(0);

    // Alarm sequence: flash red 3 times then fade
    this.tweens.add({
      targets: this._alarmOverlay,
      alpha: { from: 0, to: 0.3 },
      duration: 200,
      yoyo: true,
      repeat: 4,
      onComplete: () => {
        // After flashing, keep a subtle red tint pulsing
        this.tweens.add({
          targets: this._alarmOverlay,
          alpha: { from: 0, to: 0.08 },
          duration: 1500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }
    });

    // Alarm text
    this.time.delayedCall(300, () => {
      const alarmText = this.add.text(640, 200, '⚠ 警报触发 ⚠', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#ff2222',
        stroke: '#000000',
        strokeThickness: 4,
        shadow: { offsetX: 2, offsetY: 2, color: '#ff0000', blur: 8, fill: true }
      }).setOrigin(0.5).setDepth(160).setScrollFactor(0).setAlpha(0);

      this.tweens.add({
        targets: alarmText,
        alpha: { from: 0, to: 1 },
        duration: 400,
        yoyo: true,
        hold: 1500,
        onComplete: () => alarmText.destroy()
      });
    });

    // Alert all guards slightly (they know intruder is here)
    this.time.delayedCall(1000, () => {
      if (this.guards) {
        for (const g of this.guards) {
          if (!g.dead) {
            g.alert = Math.max(g.alert, 30); // Raise baseline alertness
          }
        }
      }
    });
  }

  // ——————————————————————————————————————
  //  Black Market: Neon lights and ambience
  // ——————————————————————————————————————
  _setupNeonLights() {
    if (!this._template || !this._template.neonLights) return;
    this._neonGraphics = [];

    for (const neon of this._template.neonLights) {
      const px = neon.x * TILE;
      const py = neon.y * TILE;
      const color = neon.color || 0xc070ff;

      // Neon sign glow
      const glow = this.add.graphics().setDepth(12);
      glow.fillStyle(color, 0.15);
      glow.fillCircle(px, py, 60);
      glow.fillStyle(color, 0.08);
      glow.fillCircle(px, py, 100);

      // Neon text
      if (neon.text) {
        const txt = this.add.text(px, py - 10, neon.text, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#' + color.toString(16).padStart(6, '0'),
          stroke: '#000000',
          strokeThickness: 2,
        }).setOrigin(0.5).setDepth(13);

        // Flickering effect
        this.tweens.add({
          targets: txt,
          alpha: { from: 0.7, to: 1 },
          duration: 800 + Math.random() * 400,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        this._neonGraphics.push(txt);
      }

      // Pulsing glow
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.6, to: 1 },
        duration: 1200 + Math.random() * 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      this._neonGraphics.push(glow);
    }
  }

  _setupBlackmarketAmbience() {
    // Purple ambient overlay (very subtle)
    const { width, height } = this.cameras.main;
    this._bmOverlay = this.add.rectangle(
      width / 2, height / 2,
      width * 3, height * 3,
      0x200030, 0.05
    ).setDepth(140).setScrollFactor(0);

    // Subtle purple pulse
    this.tweens.add({
      targets: this._bmOverlay,
      alpha: { from: 0.03, to: 0.08 },
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Entry text
    this.time.delayedCall(500, () => {
      const entryText = this.add.text(640, 280, '欢迎来到地下黑市', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#c084fc',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(160).setScrollFactor(0).setAlpha(0);

      this.tweens.add({
        targets: entryText,
        alpha: { from: 0, to: 1 },
        duration: 600,
        yoyo: true,
        hold: 2000,
        onComplete: () => entryText.destroy()
      });
    });
  }

  // ——————————————————————————————————————
  //  Ship: Sway effect and water zones
  // ——————————————————————————————————————
  _setupShipSway() {
    // Gentle camera sway to simulate ship rocking
    this._shipSwayTime = 0;
    this._shipSwayEnabled = true;

    // Entry text
    this.time.delayedCall(500, () => {
      const entryText = this.add.text(640, 280, '登上「沉鲸号」', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#7ad8ff',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(160).setScrollFactor(0).setAlpha(0);

      this.tweens.add({
        targets: entryText,
        alpha: { from: 0, to: 1 },
        duration: 600,
        yoyo: true,
        hold: 2000,
        onComplete: () => entryText.destroy()
      });
    });

    // Ocean ambient overlay (blue tint)
    const { width, height } = this.cameras.main;
    this._shipOverlay = this.add.rectangle(
      width / 2, height / 2,
      width * 3, height * 3,
      0x001830, 0.04
    ).setDepth(140).setScrollFactor(0);

    this.tweens.add({
      targets: this._shipOverlay,
      alpha: { from: 0.02, to: 0.06 },
      duration: 4000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  _setupWaterZones() {
    if (!this._template || !this._template.waterZones) return;
    this._waterZones = [];

    for (const zone of this._template.waterZones) {
      const px = zone.x * TILE;
      const py = zone.y * TILE;
      const pw = zone.w * TILE;
      const ph = zone.h * TILE;

      // Water visual
      const gfx = this.add.graphics().setDepth(0.2);
      gfx.fillStyle(0x1a384a, 0.5);
      gfx.fillRect(px, py, pw, ph);
      // Water ripple lines
      gfx.lineStyle(1, 0x5a8aa8, 0.4);
      for (let wy = py + 8; wy < py + ph; wy += 12) {
        const waveOffset = Math.sin(wy * 0.1) * 4;
        gfx.lineBetween(px + 4 + waveOffset, wy, px + pw - 4 + waveOffset, wy);
      }

      this._waterZones.push({
        rect: new Phaser.Geom.Rectangle(px, py, pw, ph),
        graphics: gfx,
      });
    }
  }

  _updateShipSway(dtSec) {
    if (!this._shipSwayEnabled) return;
    this._shipSwayTime = (this._shipSwayTime || 0) + dtSec;
    // Gentle rotation sway (±1 degree)
    const angle = Math.sin(this._shipSwayTime * 0.8) * 0.008;
    this.cameras.main.setRotation(angle);
  }

  _updateWaterZones() {
    if (!this._waterZones || !this.player) return;
    let inWater = false;
    for (const zone of this._waterZones) {
      if (zone.rect.contains(this.player.x, this.player.y)) {
        inWater = true;
        break;
      }
    }
    // Slow player in water
    if (inWater && !this._playerInWater) {
      this._playerInWater = true;
      // Visual feedback: blue tint on player
      if (this.player.setTint) this.player.setTint(0x7ad8ff);
    } else if (!inWater && this._playerInWater) {
      this._playerInWater = false;
      if (this.player.clearTint) this.player.clearTint();
    }
    // Speed modifier is applied in movement code via this._playerInWater flag
  }

  spawnWall(tx, ty, key = 'tex_wall') {
    const WALL_SHRINK = Math.sqrt(0.85); // ~0.922, area reduction ~15%
    const w = this.walls.create(tx * TILE, ty * TILE, key).setOrigin(0, 0);
    w.refreshBody();
    // —— 区分外圈墙 / 内部墙的碰撞盒 ——
    // 外圈墙（地图边界）保持完整阻挡（缩小15%），防止玩家越界
    // 内部墙体（房间分隔、装饰短墙等）缩小碰撞盒，玩家可贴边擦过
    const isOuter = tx === 0 || ty === 0 || tx === MAP_W - 1 || ty === MAP_H - 1;
    if (isOuter) {
      const sz = Math.round(TILE * WALL_SHRINK);
      const off = Math.round((TILE - sz) / 2);
      w.body.setSize(sz, sz);
      w.body.setOffset(off, off);
    } else {
      const sz = Math.round(16 * WALL_SHRINK);
      const off = Math.round((TILE - sz) / 2);
      w.body.setSize(sz, sz);
      w.body.setOffset(off, off);
    }
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
    // 关卡相机视口现在是 1280×720 全画布（由 create() 中 setViewport 设置）。
    // 黑暗蒙版同样取全画布尺寸，erase 时把世界坐标转为屏幕坐标（蒙版 setScrollFactor(0)）。
    const W = 1280;
    const H = 720;

    // 暗色蒙版（覆盖全场景）
    this.darkness = this.add.renderTexture(0, 0, W, H);
    this.darkness.setOrigin(0, 0).setDepth(90).setScrollFactor(0);
    // Use biome ambient color instead of pure black background
    const ambientColor = (this.biome && this.biome.ambientColor) || 0x0c1a2a;
    this.cameras.main.setBackgroundColor(ambientColor);

    // —— Fog / atmosphere layer (below darkness, above world) ——
    this._setupFogLayer();

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
  //  Fog / Atmosphere: drifting fog clouds for moody ambience
  // ——————————————————————————————————————
  _setupFogLayer() {
    const biome = this.biome || {};
    const fogColor = biome.fogColor || 0xc8d8e8;
    const fogAlpha = biome.fogAlpha || 0.30;
    const fogSpeed = biome.fogSpeed || 0.2;

    // --- Partial-coverage fog: spawn clouds in clustered zones, not uniformly ---
    // Define fog zones per biome (areas where fog concentrates), leaving gaps for contrast
    const biomeId = biome.id || 'museum';
    let fogZones;
    if (biomeId === 'blackmarket') {
      // Purple haze clusters in alleyways and corners
      fogZones = [
        { x: 50, y: 150, w: 350, h: 200 },    // left alley
        { x: 700, y: 50, w: 400, h: 220 },     // top-right neon glow area
        { x: 400, y: 450, w: 500, h: 200 },    // bottom market floor
        { x: 1000, y: 350, w: 250, h: 250 },   // far-right corner
      ];
    } else if (biomeId === 'ship') {
      // Sea mist rolling in from edges, thicker at bottom (deck level)
      fogZones = [
        { x: 0, y: 400, w: 600, h: 300 },      // left deck mist
        { x: 600, y: 450, w: 680, h: 270 },    // right deck mist
        { x: 200, y: 50, w: 350, h: 180 },     // upper cabin haze
        { x: 900, y: 100, w: 300, h: 200 },    // starboard fog patch
        { x: 50, y: 250, w: 250, h: 150 },     // port side wisp
      ];
    } else {
      // Museum: scattered patches among exhibits
      fogZones = [
        { x: 100, y: 80, w: 400, h: 250 },     // top-left cluster
        { x: 800, y: 400, w: 450, h: 280 },    // bottom-right cluster
        { x: 500, y: 550, w: 350, h: 170 },    // bottom-center wisp
        { x: 1050, y: 60, w: 300, h: 200 },    // top-right patch
      ];
    }

    this._fogClouds = [];
    const fogKeys = ['tex_fog_cloud', 'tex_fog_wisp'];
    const cloudsPerZone = 4; // 4 clouds per zone = 16 total, but clustered

    for (const zone of fogZones) {
      for (let i = 0; i < cloudsPerZone; i++) {
        const key = fogKeys[i % fogKeys.length];
        if (!this.textures.exists(key)) continue;

        // Spawn within the zone bounds with some jitter
        const cx = zone.x + Math.random() * zone.w;
        const cy = zone.y + Math.random() * zone.h;

        const cloud = this.add.image(cx, cy, key);
        cloud.setOrigin(0.5, 0.5);
        cloud.setDepth(85);
        cloud.setScrollFactor(0.05 + Math.random() * 0.15);
        // Denser at zone center, lighter at edges
        const distFromCenter = Math.hypot(
          (cx - (zone.x + zone.w / 2)) / (zone.w / 2),
          (cy - (zone.y + zone.h / 2)) / (zone.h / 2)
        );
        const edgeFade = Math.max(0.2, 1.0 - distFromCenter * 0.6);
        cloud.setAlpha(fogAlpha * edgeFade * (0.6 + Math.random() * 0.4));
        cloud.setTint(fogColor);
        cloud.setScale(2.0 + Math.random() * 2.0, 1.0 + Math.random() * 0.8);
        cloud.setBlendMode(Phaser.BlendModes.NORMAL);

        // Drift slowly but stay roughly within zone area
        cloud.setData('vx', (Math.random() - 0.5) * fogSpeed * 12);
        cloud.setData('vy', (Math.random() - 0.5) * fogSpeed * 4);
        cloud.setData('baseAlpha', cloud.alpha);
        cloud.setData('phase', Math.random() * Math.PI * 2);
        // Store zone bounds for wrapping within zone
        cloud.setData('zoneX', zone.x - 80);
        cloud.setData('zoneW', zone.w + 160);
        cloud.setData('zoneY', zone.y - 40);
        cloud.setData('zoneH', zone.h + 80);

        this._fogClouds.push(cloud);
      }
    }

    // No full-screen atmosphere overlay — keep clear areas truly clear for contrast
    this._atmosphereOverlay = null;
  }

  /**
   * Update fog cloud positions each frame (called from update loop)
   */
  _updateFog(dtSec) {
    if (!this._fogClouds) return;
    for (const cloud of this._fogClouds) {
      const vx = cloud.getData('vx');
      const vy = cloud.getData('vy');
      const phase = cloud.getData('phase');
      const baseAlpha = cloud.getData('baseAlpha');

      cloud.x += vx * dtSec;
      cloud.y += vy * dtSec;

      // Gentle alpha oscillation
      cloud.setAlpha(baseAlpha * (0.7 + 0.3 * Math.sin(this.time.now * 0.001 + phase)));

      // Wrap within zone bounds (keeps fog clustered in specific areas)
      const zx = cloud.getData('zoneX');
      const zw = cloud.getData('zoneW');
      const zy = cloud.getData('zoneY');
      const zh = cloud.getData('zoneH');
      if (zx != null) {
        if (cloud.x > zx + zw) cloud.x = zx;
        if (cloud.x < zx) cloud.x = zx + zw;
        if (cloud.y > zy + zh) cloud.y = zy;
        if (cloud.y < zy) cloud.y = zy + zh;
      }
    }
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
    rt.fill(this.biome && this.biome.darkness ? this.biome.darkness : DARKNESS, 1);

    const px = this.player.x;
    const py = this.player.y;
    const aim = this.player.getData('aim') || 0;
    const isSneak = this.keys.SHIFT.isDown;

    // 2. 玩家近身环境光（小圆，始终亮）—— 叠加两次擦除，让玩家四周更明亮，避免摸黑感
    this.eraseAt(rt, 'tex_light_sm', px, py);
    this.eraseAt(rt, 'tex_light_sm', px, py);
    this.eraseAt(rt, 'tex_light_xs', px, py);

    // 2.5 夜视镜：在玩家中心叠加一圈较大的光，整体提亮
    if (this._loadoutEff && this._loadoutEff.visionBonus > 0) {
      // 用大光圈再擦一次，alpha 由 visionBonus 决定（0.45 → 中等亮度）
      this.eraseAt(rt, 'tex_light_lg', px, py);
    }

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

    // 6. 让暗部稍微透出一点世界色（避免完全死黑）—— 使用 biome 配置的透明度
    const darknessAlpha = (this.biome && this.biome.darknessAlpha) || 0.82;
    rt.setAlpha(darknessAlpha);
  }

  /**
   * 以中心坐标在 RT 上擦除一张光晕贴图
   * darkness RT 设了 setScrollFactor(0)（屏幕坐标固定），
   * 因此传入的世界坐标需要减去相机 scrollX/Y 才能正确投影到屏幕。
   */
  eraseAt(rt, key, x, y) {
    const tex = this.textures.get(key);
    if (!tex) return;
    const src = tex.getSourceImage();
    const w = src.width;
    const h = src.height;
    const cam = this.cameras.main;
    const sx = x - cam.scrollX;
    const sy = y - cam.scrollY;
    rt.erase(key, sx - w / 2, sy - h / 2);
  }

  createHUD() {
    // 顶部状态条背景
    this.add.rectangle(0, 0, 1280, 28, 0x000000, 0.85).setOrigin(0, 0).setScrollFactor(0).setDepth(100);
    // 顶部金线
    this.add.rectangle(0, 28, 1280, 1, 0xd4af37, 0.6).setOrigin(0, 0).setScrollFactor(0).setDepth(100);

    // —— 左下：血条 + 体力条 + 状态图标 ——
    const bx = 20;
    const by = 690;
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

    // 消耗品 HUD：医疗包计数 + 按键提示
    this.medkitHUD = this.add.text(bx + 170, by - 14, '', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '12px',
      color: '#7ae8e8',
      stroke: '#000',
      strokeThickness: 3
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(102);
    this.updateConsumableHUD();

    // 烟雾弹 / 轻功符 HUD（二行，紧接医疗包）
    this.smokeHUD = this.add.text(bx + 170, by - 28, '', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '11px',
      color: '#cdb98a',
      stroke: '#000',
      strokeThickness: 3
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(102);
    this.qinggongHUD = this.add.text(bx + 170, by - 42, '', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '11px',
      color: '#a0e8a8',
      stroke: '#000',
      strokeThickness: 3
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(102);

    // 武器 HUD：右下角显示当前兵刃 + 弹药
    this.weaponHUD = this.add.text(1280 - 14, 720 - 14, '', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '12px',
      color: '#fff3b8',
      stroke: '#000',
      strokeThickness: 3,
      align: 'right'
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(102);
    this.updateWeaponHUD();

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
      .text(640, 14, '已得文物：0 / 0', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '14px',
        color: '#e8d27a'
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101);

    // —— 进入提示：地图场景名 + 副标题（淡入淡出） ——
    if (this.biome) {
      const titleColor = this.biome.id === 'blackmarket' ? '#c084fc' : '#d4af37';
      const sceneTitle = this.add.text(640, 280, this.biome.name, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '32px',
        color: titleColor,
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 5
      }).setOrigin(0.5).setScrollFactor(0).setDepth(120).setAlpha(0);
      const sceneSub = this.add.text(640, 320, this.biome.subtitle || '', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '14px',
        color: '#e8d27a',
        stroke: '#000',
        strokeThickness: 3
      }).setOrigin(0.5).setScrollFactor(0).setDepth(120).setAlpha(0);
      this.tweens.add({ targets: [sceneTitle, sceneSub], alpha: 1, duration: 600, yoyo: false });
      this.time.delayedCall(2200, () => {
        this.tweens.add({
          targets: [sceneTitle, sceneSub],
          alpha: 0,
          duration: 700,
          onComplete: () => { sceneTitle.destroy(); sceneSub.destroy(); }
        });
      });
    }

    // 提示
    this.hintText = this.add
      .text(940, 14, 'WASD移动 · 鼠标瞄向 · Shift潜行 · Ctrl疾跑 · J/左键攻击 · K格挡 · E拾取 · F阅读 · Tab背包 · C切换角色', {
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
      .text(640, 660, '', {
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
    const px = 1280 - panelW - 16;
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

  // ——————————— 角色切换 ———————————
  _applyCharConfig(index) {
    const type = this._charTypes[index];
    if (!type) return;
    const cfg = this._charConfigs[type];
    if (!cfg) return;
    this.player.setTexture(cfg.tex, 0);
    this.player.setScale(cfg.scale);
    this.player.body.setSize(cfg.bodyW, cfg.bodyH).setOffset(cfg.bodyOx, cfg.bodyOy);
    this._useKnifeHero = (type === 'knife');
    this._heroAnimPrefix = cfg.prefix;
    const dir = this._playerDir4 || 'down';
    if (this.anims.exists(`${cfg.prefix}_idle_${dir}`)) this.player.play(`${cfg.prefix}_idle_${dir}`);
  }

  _switchCharacter() {
    if (this._ended || this._charTypes.length < 2) return;
    Audio.sfx.click();
    this._charIndex = (this._charIndex + 1) % this._charTypes.length;
    this._applyCharConfig(this._charIndex);
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
    if (now < ps.bladeSkillUntil) speed *= 0.15;
    else if (now < ps.attackUntil) speed *= 0.45;
    // 轻功符：期间统一乘以 qinggongMul（覆盖静步压低、同时与疾跑叠加）
    if (now < ps.qinggongUntil) speed = Math.max(speed, 230) * (ps.qinggongMul || 1.7);
    // 水域减速（走私船特色）
    if (this._playerInWater) speed *= 0.55;

    // —— 受击僵直：保留击退速度，禁止键盘接管，逐帧衰减 ——
    let vx = 0;
    let vy = 0;
    if (now < ps.staggerUntil) {
      const body = this.player.body;
      if (body) {
        this.player.setVelocity(body.velocity.x * 0.86, body.velocity.y * 0.86);
      }
      // 行走帧停在站立态
      if (this._playerWalkPhase !== 0) {
        this._playerWalkPhase = 0;
        this._playerWalkAccum = 0;
        if (!this._useHeroPlayer && !this._useLZPlayer) this.player.setTexture('tex_player');
      }
      // 僵直期间仍要驱动其他逻辑（攻击结算、守卫 update 等），所以这里不 return
    } else {

      if (this.cursors.left.isDown || this.keys.A.isDown) vx = -1;
      if (this.cursors.right.isDown || this.keys.D.isDown) vx = 1;
      if (this.cursors.up.isDown || this.keys.W.isDown) vy = -1;
      if (this.cursors.down.isDown || this.keys.S.isDown) vy = 1;

      if (vx !== 0 && vy !== 0) {
        vx *= 0.707;
        vy *= 0.707;
      }
      this.player.setVelocity(vx * speed, vy * speed);

    } // —— 僵直分支结束 ——

    // —— 鼠标 aim：仅用于攻击 / 光锥 / 远程瞄准，不再驱动贴图朝向 ——
    const ptr = this.input.activePointer;
    const aim = Math.atan2(ptr.worldY - this.player.y, ptr.worldX - this.player.x);
    this.player.setData('aim', aim);

    // —— 玩家行走帧切换 / LimeZu 四方向动画 ——
    const bodyVx = (this.player.body && this.player.body.velocity.x) || 0;
    const bodyVy = (this.player.body && this.player.body.velocity.y) || 0;
    const moving = Math.hypot(bodyVx, bodyVy) > 8 && now >= ps.staggerUntil;

    // —— 朝向：WASD 决定 4 方向贴图朝向，静止时保持上一次朝向 ——
    // 优先用键盘输入（更跟手），其次回退到 body 速度，最后保持原朝向
    let facingDir = this._playerDir4 || 'down';
    if (vx !== 0 || vy !== 0) {
      if (Math.abs(vx) >= Math.abs(vy)) facingDir = vx > 0 ? 'right' : 'left';
      else facingDir = vy > 0 ? 'down' : 'up';
    } else if (moving) {
      // 受击僵直被动滑行也算移动，按速度向量决定
      if (Math.abs(bodyVx) >= Math.abs(bodyVy)) facingDir = bodyVx > 0 ? 'right' : 'left';
      else facingDir = bodyVy > 0 ? 'down' : 'up';
    }
    this._playerDir4 = facingDir;
    // 暴露给攻击系统使用（_resolveMeleeAimAssist 回退方向）
    this._playerFacingAngle = ({ right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 })[facingDir];

    if (this._useHeroPlayer) {
      const attacking = now < (ps.attackAnimUntil || 0);
      const useDirectional = this._useKnifeHero;
      const prefix = this._useKnifeHero ? 'hero_knife' : 'hero';
      const swordDir = attacking ? angleToDir4(ps.attackDir || 0) : facingDir;
      const animDir = useDirectional ? swordDir : (facingDir === 'left' ? 'right' : facingDir);
      const wantAnim = useDirectional
        ? (attacking
            ? `${prefix}_attack_${swordDir}`
            : (moving ? `${prefix}_walk_${animDir}` : `${prefix}_idle_${animDir}`))
        : (attacking
            ? 'hero_attack'
            : (now < ps.staggerUntil ? 'hero_hurt_down' : (moving ? `hero_walk_${animDir}` : `hero_idle_${animDir}`)));
      if (this.anims.exists(wantAnim)) {
        const cur = this.player.anims.currentAnim;
        if (!cur || cur.key !== wantAnim) {
          this.player.play(wantAnim, attacking || wantAnim === 'hero_hurt_down');
        }
      }
      this.player.setFlipX(!useDirectional && (attacking ? Math.cos(ps.attackDir || 0) > 0 : facingDir === 'left'));
      if (moving) {
        this._playerWalkAccum += dtSec;
        const stepTime = ps.sprint ? 0.20 : ps.stealth ? 0.45 : 0.30;
        if (this._playerWalkAccum >= stepTime) {
          this._playerWalkAccum = 0;
          const mode = ps.sprint ? 'sprint' : ps.stealth ? 'stealth' : 'walk';
          Audio.sfx.footstep(mode);
        }
      } else {
        this._playerWalkAccum = 0;
      }
    } else if (this._useLZPlayer) {
      // —— LimeZu 模式：使用 WASD 朝向选 4 方向动画 ——
      const dir = facingDir;
      const wantAnim = moving ? `adam_run_${dir}` : `adam_idle_${dir}`;
      if (this.anims.exists(wantAnim)) {
        const cur = this.player.anims.currentAnim;
        if (!cur || cur.key !== wantAnim) {
          this.player.play(wantAnim);
        }
      }
      // 脚步音：移动时按节奏触发
      if (moving) {
        this._playerWalkAccum += dtSec;
        const stepTime = ps.sprint ? 0.20 : ps.stealth ? 0.45 : 0.30;
        if (this._playerWalkAccum >= stepTime) {
          this._playerWalkAccum = 0;
          const mode = ps.sprint ? 'sprint' : ps.stealth ? 'stealth' : 'walk';
          Audio.sfx.footstep(mode);
        }
      } else {
        this._playerWalkAccum = 0;
      }
      // LimeZu 模式不使用 flipX
      this.player.setFlipX(false);
    } else {
      // —— 兼容旧贴图模式 ——
      if (moving) {
        this._playerWalkAccum += dtSec;
        const stepTime = ps.sprint ? 0.10 : ps.stealth ? 0.30 : 0.18;
        if (this._playerWalkAccum >= stepTime) {
          this._playerWalkAccum = 0;
          this._playerWalkPhase = 1 - this._playerWalkPhase;
          this.player.setTexture(this._playerWalkPhase ? 'tex_player_walk' : 'tex_player');
          const mode = ps.sprint ? 'sprint' : ps.stealth ? 'stealth' : 'walk';
          Audio.sfx.footstep(mode);
        }
      } else {
        this._playerWalkAccum = 0;
        if (this._playerWalkPhase !== 0) {
          this._playerWalkPhase = 0;
          this.player.setTexture('tex_player');
        }
      }
      // 旧贴图：用 WASD 朝向决定水平翻转（左/右）
      if (facingDir === 'left') this._playerFacingX = -1;
      else if (facingDir === 'right') this._playerFacingX = 1;
      // up/down 时保留上一帧水平朝向，避免突变
      this.player.setFlipX(this._playerFacingX < 0);
    }
    this.updateTemplateObjectDepth();

    // —— 体力（疾跑消耗、格挡消耗、其余恢复） ——
    const isMoving = vx !== 0 || vy !== 0;
    if (ps.sprint && isMoving) ps.stam = Math.max(0, ps.stam - 28 * dtSec);
    else if (ps.blocking) ps.stam = Math.max(0, ps.stam - 14 * dtSec);
    else ps.stam = Math.min(ps.stamMax, ps.stam + 18 * dtSec);

    // —— 攻击输入（J 键） ——
    if (Phaser.Input.Keyboard.JustDown(this.keys.J)) {
      this.tryPlayerAttack();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.U)) {
      this.tryPlayerBladeSkill();
    }

    // —— 检测附近可拾取文物 ——
    const nearestRelic = this.findNearest(this.relicGroup.getChildren(), 28);
    // —— 检测附近可交互容器 ——
    const nearestContainer = this._findNearestContainer(36);

    if (this._puzzleActive) {
      // 密码小游戏开启时屏蔽 E 拾取/容器
      this.pickupPrompt.setVisible(false);
    } else if (nearestContainer && (!nearestRelic ||
        Phaser.Math.Distance.Between(this.player.x, this.player.y, nearestContainer.sprite.x, nearestContainer.sprite.y)
        < Phaser.Math.Distance.Between(this.player.x, this.player.y, nearestRelic.x, nearestRelic.y))) {
      // 容器优先级（同距离时）
      const c = nearestContainer;
      const tip = this._containerPromptText(c);
      this.pickupPrompt
        .setText(tip)
        .setPosition(c.sprite.x, c.sprite.y - 22)
        .setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.keys.E) && !c.opening && !c.opened) {
        this.tryOpenContainer(c);
      }
    } else if (nearestRelic) {
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

    // —— 安保摄像头更新 ——
    this._updateSecurityCameras(dtSec * 1000);
    // —— 地刺陷阱更新 ——
    this._updateSpikeTraps(dtSec * 1000);
    // —— 船体摇晃更新 ——
    this._updateShipSway(dtSec);
    // —— 水域减速检测 ——
    this._updateWaterZones();

    // —— 心跳：警觉越高越快；完全安全时停止 ——
    this.updateHeartbeat(maxAlert);

    // —— 玩家攻击判定结算（命中守卫） ——
    this.resolvePlayerAttack();

    // —— 推进远程投射物 ——
    this.updateProjectiles(dtSec);

    // —— HUD：血条 / 体力 / 状态图标 ——
    this.updatePlayerHUD();
    // —— 消耗品 / 武器 HUD（轻功倒计需要逐帧刷） ——
    this.updateConsumableHUD();

    // —— 剧情碎片交互 ——
    this.updateClueInteraction();

    // —— 光照刷新 ——
    this.updateLighting();

    // —— 雾气飘动 ——
    this._updateFog(dtSec);
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
    const x = 1280 - W - 16;
    const yEnd = 720 - H - 60;       // 最终位置
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

    // 提示"Tab 查看完整介绍"
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

    // —— 交给 ResultScene 统一结算（金币 / 仓库 / 委托 / 图鉴）——
    const items = this.inventory.list();
    const value = this.inventory.totalValue();
    // 把局内额外奖励（金币 / 声望）一起带过去
    const bonusGold = this._bonusGold || 0;
    const bonusRep = this._bonusRep || 0;
    // 局内统计，用于多结局判定
    const runStats = this._runStats || { kills: 0, alerts: 0 };
    this.cameras.main.fadeOut(450, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('ResultScene', { success, items, value, reason, bonusGold, bonusRep, runStats });
    });  }

  // ============================================================
  //  容器系统
  //  · plain  - 普通箱：1.5s 进度条直接打开
  //  · safe   - 保险柜：需「撬锁器」工具，4s 进度条
  //  · puzzle - 密码锁：触发 4 位密码小游戏
  //  · trap   - 陷阱箱：1.2s 后开启，10% 触发警报
  // ============================================================
  spawnContainer(cd) {
    const cx = cd.x * TILE + TILE / 2;
    const cy = cd.y * TILE + TILE / 2;
    // 用矩形 + emoji 字符画占位（贴图改造可以后期接素材）
    const colors = {
      plain:  { fill: 0x3a2814, edge: 0x6b5824, glyph: '📦' },
      safe:   { fill: 0x2a2a2a, edge: 0xd4af37, glyph: '🔒' },
      puzzle: { fill: 0x1f1230, edge: 0xc084fc, glyph: '🔢' },
      trap:   { fill: 0x3a1414, edge: 0xff8c42, glyph: '⚠' }
    };
    const col = colors[cd.kind] || colors.plain;
    let box;
    let glyph = null;
    if (cd.kind === 'safe' && this.textures.exists('safe_closed')) {
      box = this.add.image(cx, cy, 'safe_closed').setDepth(2);
    } else if (cd.kind === 'plain' && this.textures.exists('chest_closed')) {
      box = this.add.image(cx, cy, 'chest_closed').setDepth(2);
    } else {
      box = this.add.rectangle(cx, cy, 30, 28, col.fill, 1).setDepth(2);
      box.setStrokeStyle(2, col.edge, 0.9);
      glyph = this.add.text(cx, cy - 1, col.glyph, { fontSize: '20px' }).setOrigin(0.5).setDepth(3);
    }
    // 物理碰撞（与玩家的碰撞统一在玩家创建后挂到 containerGroup）
    const phys = this.physics.add.staticImage(cx, cy, 'tex_case').setDepth(2).setVisible(false);
    phys.body.setSize(20, 20);
    this.containerGroup.add(phys);

    const obj = {
      data: cd,
      sprite: box,
      glyph,
      phys,
      opened: false,
      opening: false
    };
    this.containers.push(obj);

    // 容器中心点的微弱光晕，便于黑暗中辨识
    if (this.staticLights) {
      this.staticLights.push({
        x: cx, y: cy, key: 'tex_light_xs', alpha: 0.35,
        tint: col.edge
      });
    }
    return obj;
  }

  _findNearestContainer(maxDist) {
    let best = null;
    let bd = maxDist;
    for (const c of this.containers) {
      if (c.opened) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, c.sprite.x, c.sprite.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  _containerPromptText(c) {
    if (c.opening) return '… 正在打开 …';
    const k = c.data.kind;
    if (k === 'plain')  return 'E  搜  普通木箱';
    if (k === 'safe') {
      const hasPick = !!(this._loadoutEff && this._loadoutEff.tools &&
        this._loadoutEff.tools.some((t) => t.id === 'lockpick'));
      return hasPick ? 'E  撬开  保险柜' : 'E  保险柜（需「撬锁器」）';
    }
    if (k === 'puzzle') return 'E  尝试解锁  密码箱';
    if (k === 'trap')   return 'E  搜  锈蚀木箱（小心！）';
    return 'E  打开';
  }

  tryOpenContainer(c) {
    const k = c.data.kind;
    if (k === 'safe') {
      const hasPick = !!(this._loadoutEff && this._loadoutEff.tools &&
        this._loadoutEff.tools.some((t) => t.id === 'lockpick'));
      if (!hasPick) {
        this._floatText(c.sprite.x, c.sprite.y - 18, '需要「撬锁器」', '#ff8c42');
        Audio.sfx.bad && Audio.sfx.bad();
        return;
      }
    }
    if (k === 'puzzle') { this._openPuzzleUI(c); return; }
    const dur = k === 'safe' ? 4000 : (k === 'trap' ? 1200 : 1500);
    this._beginOpenProgress(c, dur);
  }

  _beginOpenProgress(c, durationMs) {
    c.opening = true;
    Audio.sfx.click && Audio.sfx.click();
    // 进度条
    const px = c.sprite.x;
    const py = c.sprite.y - 22;
    const bg = this.add.rectangle(px, py, 36, 5, 0x000000, 0.7).setDepth(120);
    bg.setStrokeStyle(1, 0xa08434, 0.8);
    const bar = this.add.rectangle(px - 18, py, 0, 3, 0xd4af37).setOrigin(0, 0.5).setDepth(121);
    let elapsed = 0;
    const timer = this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        if (this._ended) { timer.remove(false); bg.destroy(); bar.destroy(); return; }
        // 玩家移动太远则中断
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, c.sprite.x, c.sprite.y);
        if (d > 48) {
          timer.remove(false);
          bg.destroy(); bar.destroy();
          c.opening = false;
          this._floatText(c.sprite.x, c.sprite.y - 18, '中断！', '#ff8c42');
          return;
        }
        elapsed += 50;
        bar.width = (elapsed / durationMs) * 36;
        if (elapsed >= durationMs) {
          timer.remove(false);
          bg.destroy(); bar.destroy();
          this._finishOpenContainer(c);
        }
      }
    });
  }

  _playSafeOpenAnimation(c) {
    if (!c || !c.sprite || !this.textures.exists('safe_open1')) return;
    c.sprite.setTexture('safe_open1');
    this.time.delayedCall(90, () => {
      if (c.sprite && c.sprite.active && this.textures.exists('safe_open2')) {
        c.sprite.setTexture('safe_open2');
      }
    });
    this.time.delayedCall(180, () => {
      if (c.sprite && c.sprite.active && this.textures.exists('safe_open3')) {
        c.sprite.setTexture('safe_open3');
      }
    });
  }

  _playChestOpenAnimation(c) {
    if (!c || !c.sprite || !this.textures.exists('chest_open1')) return;
    c.sprite.setTexture('chest_open1');
    this.time.delayedCall(90, () => {
      if (c.sprite && c.sprite.active && this.textures.exists('chest_open2')) {
        c.sprite.setTexture('chest_open2');
      }
    });
    this.time.delayedCall(180, () => {
      if (c.sprite && c.sprite.active && this.textures.exists('chest_open3')) {
        c.sprite.setTexture('chest_open3');
      }
    });
  }

  _finishOpenContainer(c) {
    c.opening = false;
    c.opened = true;
    const k = c.data.kind;
    // 视觉：箱子变暗
    if (k === 'safe') {
      this._playSafeOpenAnimation(c);
    } else if (k === 'plain') {
      this._playChestOpenAnimation(c);
    } else {
      c.sprite.setFillStyle(0x222018, 0.6);
      if (c.glyph) c.glyph.setAlpha(0.35).setText('·');
    }
    Audio.sfx.pickup && Audio.sfx.pickup('common');

    // 陷阱箱：10% 触发警报
    if (k === 'trap' && Math.random() < 0.10) {
      this._triggerAlarm(c.sprite.x, c.sprite.y);
    }

    // 装文物的容器：吐出文物到地面（自动尝试入背包；满则掉地上）
    if (typeof c.data.relicIdx === 'number') {
      const data = RELICS[c.data.relicIdx];
      this._dropRelicAt(c.sprite.x, c.sprite.y, data);
      return;
    }

    // 否则吐出战利品（金币/碎片/医疗包/声望）
    const lootKind = c.data.lootKind || 'gold';
    if (lootKind === 'gold') {
      const amt = 8 + Math.floor(Math.random() * 25);
      this._bonusGold = (this._bonusGold || 0) + amt;
      this._floatText(c.sprite.x, c.sprite.y - 18, `+ 金 ¥${amt}`, '#d4af37');
    } else if (lootKind === 'shard') {
      const amt = 12 + Math.floor(Math.random() * 18);
      this._bonusGold = (this._bonusGold || 0) + amt;
      this._floatText(c.sprite.x, c.sprite.y - 18, `+ 碎片  (¥${amt})`, '#a08434');
    } else if (lootKind === 'medkit') {
      // 进入消耗品库存，玩家后续按 H 使用
      const newCnt = SaveData.addConsumable('medkit', 1);
      this._floatText(c.sprite.x, c.sprite.y - 18, `+ 回春丸  × 1  (库存 ${newCnt})`, '#7ae8e8');
      this.updateConsumableHUD();
    } else if (lootKind === 'rep') {
      this._bonusRep = (this._bonusRep || 0) + 1;
      this._floatText(c.sprite.x, c.sprite.y - 18, '+ 声望', '#c084fc');
    }
  }

  _fitRelicSprite(sprite, iconKey) {
    if (!sprite || !iconKey || !this.textures.exists(iconKey)) return;
    const tex = this.textures.get(iconKey).getSourceImage();
    // PNG relic textures can be very large (512px+), scale to fit 24x24 game pixels
    const targetSize = 24;
    const scale = Math.min(targetSize / tex.width, targetSize / tex.height);
    sprite.setScale(scale);
  }

  /** 把文物作为可拾取物投到 (x,y) */
  _dropRelicAt(x, y, data) {
    const iconKey = data.icon || 'tex_relic';
    const r = this.relicGroup.create(x, y, iconKey);
    r.setData('relic', data).setDepth(2);
    this._fitRelicSprite(r, iconKey);
    if (r.body) r.body.setSize(12, 12);
    r.setData('basePos', { x, y });
    // 弹跳动画
    this.tweens.add({
      targets: r,
      y: y - 4,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });
    // 注册到静态光晕，便于在黑暗中可见
    if (this.staticLights) {
      this.staticLights.push({ x, y, key: 'tex_light_xs', alpha: 0.5 });
    }
    this._floatText(x, y - 18, `发现 ${data.name}！`, '#fff3b8');
  }

  _floatText(x, y, text, color = '#fff3b8') {
    const ft = this.add.text(x, y, text, {
      fontFamily: '"PingFang SC", serif',
      fontSize: '13px',
      color,
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(120);
    this.tweens.add({
      targets: ft,
      y: y - 26,
      alpha: 0,
      duration: 1100,
      onComplete: () => ft.destroy()
    });
  }

  /** 触发警报：把所有守卫警觉拉满（如有 alert API），否则只刷一段提示 */
  _triggerAlarm(x, y) {
    Audio.sfx.bad && Audio.sfx.bad();
    this._floatText(x, y - 28, '⚠ 警报触发！', '#ff4444');
    if (this.guards) {
      for (const g of this.guards) {
        // 通用：把警觉直接设为最大；若守卫未提供方法，则尝试常见字段
        if (typeof g.alert === 'function') g.alert(this.player);
        else if (typeof g.setAlertMax === 'function') g.setAlertMax();
        else if (g.alertValue != null) g.alertValue = g.alertMax || 100;
      }
    }
    // 屏幕红闪
    const flash = this.add.rectangle(0, 0, 1280, 720, 0xff0000, 0.35).setOrigin(0, 0).setScrollFactor(0).setDepth(180);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 600,
      onComplete: () => flash.destroy()
    });
  }

  // ——————————————————————————————————————
  //  4 位密码锁小游戏
  // ——————————————————————————————————————
  _openPuzzleUI(c) {
    if (this._puzzleActive) return;
    this._puzzleActive = true;
    const code = c.data.code || '0000';
    const W = 360;
    const H = 220;
    const x = 640 - W / 2;
    const y = 360 - H / 2;

    const layer = this.add.container(0, 0).setDepth(220).setScrollFactor(0);

    // 半透明遮罩（也阻断点击穿透）
    const mask = this.add.rectangle(0, 0, 1280, 720, 0x000000, 0.55).setOrigin(0, 0).setScrollFactor(0);    mask.setInteractive();
    layer.add(mask);

    // 面板背景
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1410, 0.96);
    bg.lineStyle(2, 0xc084fc, 0.9);
    bg.fillRoundedRect(x, y, W, H, 8);
    bg.strokeRoundedRect(x, y, W, H, 8);
    layer.add(bg);

    layer.add(this.add.text(640, y + 18, '· 密  码  锁 ·', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '16px',
      color: '#c084fc'
    }).setOrigin(0.5));
    layer.add(this.add.text(640, y + 40, '↑↓ 调整数字   ←→ 切换位   Enter 确认   ESC 放弃', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '11px',
      color: '#7a6228'
    }).setOrigin(0.5));

    // 4 位数字滚轮
    const digits = [0, 0, 0, 0];
    let cursor = 0;
    const digitTxts = [];
    const startX = 640 - 60;
    for (let i = 0; i < 4; i++) {
      const dt = this.add.text(startX + i * 40, y + 100, '0', {
        fontFamily: 'Georgia, serif',
        fontSize: '40px',
        color: '#e8d27a',
        backgroundColor: '#2a1f10',
        padding: { x: 8, y: 4 }
      }).setOrigin(0.5);
      digitTxts.push(dt);
      layer.add(dt);
    }

    const hint = this.add.text(640, y + H - 32, '提示：本箱密码为 4 位数字', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '12px',
      color: '#a08434'
    }).setOrigin(0.5);
    layer.add(hint);

    const refresh = () => {
      for (let i = 0; i < 4; i++) {
        digitTxts[i].setText(String(digits[i]));
        digitTxts[i].setBackgroundColor(i === cursor ? '#c084fc' : '#2a1f10');
        digitTxts[i].setColor(i === cursor ? '#1a1410' : '#e8d27a');
      }
    };
    refresh();

    let attempts = 0;

    const close = (success) => {
      this._puzzleActive = false;
      cleanupKeys();
      layer.destroy();
      if (success) {
        this._beginOpenProgress(c, 400); // 已破解：象征性 0.4s 完成动画
      }
    };

    const keyHandler = (event) => {
      if (event.code === 'ArrowUp')   { digits[cursor] = (digits[cursor] + 1) % 10; refresh(); }
      else if (event.code === 'ArrowDown') { digits[cursor] = (digits[cursor] + 9) % 10; refresh(); }
      else if (event.code === 'ArrowLeft') { cursor = (cursor + 3) % 4; refresh(); }
      else if (event.code === 'ArrowRight') { cursor = (cursor + 1) % 4; refresh(); }
      else if (event.code === 'Enter' || event.code === 'NumpadEnter') {
        attempts++;
        const guess = digits.join('');
        if (guess === code) {
          hint.setText('✓ 解锁成功').setColor('#7ae8e8');
          Audio.sfx.exit && Audio.sfx.exit();
          this.time.delayedCall(450, () => close(true));
        } else {
          // 给位级提示：每位是大了/小了/正确
          let cues = '';
          for (let i = 0; i < 4; i++) {
            if (digits[i] === Number(code[i])) cues += '✓';
            else cues += digits[i] > Number(code[i]) ? '↓' : '↑';
          }
          hint.setText(`✗ 错误（${cues}）  尝试 ${attempts}`).setColor('#ff8c42');
          Audio.sfx.bad && Audio.sfx.bad();
          // 5 次失败 → 自动放弃 + 触发轻微警报
          if (attempts >= 5) {
            this._triggerAlarm(c.sprite.x, c.sprite.y);
            this.time.delayedCall(450, () => close(false));
          }
        }
      } else if (event.code === 'Escape') {
        close(false);
      }
    };
    const cleanupKeys = () => { window.removeEventListener('keydown', keyHandler); };
    window.addEventListener('keydown', keyHandler);
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
      // 每当一名守卫进入追击状态，计为一次「被发现」
      if (this._runStats) this._runStats.alerts += 1;
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
    const mask = this.add.rectangle(0, 0, 1280, 720, 0x000000, 0.78).setOrigin(0, 0);
    const panel = this.add.rectangle(640, 360, 480, 280, 0x1a1410, 0.96).setStrokeStyle(2, 0xa08434);
    const title = this.add
      .text(640, 250, clue.title, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '22px',
        color: '#d4af37',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    const body = this.add
      .text(640, 360, clue.body, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '14px',
        color: '#fff3b8',
        align: 'center',
        wordWrap: { width: 420 },
        lineSpacing: 6
      })
      .setOrigin(0.5);
    const tip = this.add
      .text(640, 470, '按  F  /  ESC  收起', {
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
    if (now < ps.bladeSkillUntil) return;
    if (ps.blocking) return;        // 格挡中不能出刀

    // 装备的武器决定伤害 / 范围 / 冷却 / 耗体力
    const wp = (this._loadoutEff && this._loadoutEff.weapon) || null;
    const isMelee = !wp || wp.kind === 'melee';
    if (!isMelee) {
      // 左键 也能远程攻击（装备了远程武器时以远程为准）
      this.tryPlayerRangedAttack();
      return;
    }
    const cost = (wp && wp.staminaCost) || 14;
    if (ps.stam < cost) return;

    ps.stam = Math.max(0, ps.stam - cost);
    const baseAim = this.player.getData('aim') || 0;
    ps.attackRange = (wp && wp.range) || 32;
    ps.attackArc   = (wp && wp.arc)   || (Math.PI / 3);
    // —— 近身肉搏自动索敌：若 1.6 倍攻击距离内存在活守卫，则将攻击方向锁定到最近者 ——
    ps.attackDir = this._resolveMeleeAimAssist(baseAim, ps.attackRange);
    ps.attackUntil = now + 220;     // 判定窗口
    ps.attackAnimUntil = now + 420;
    ps.attackCooldownUntil = now + ((wp && wp.cooldownMs) || 360);
    ps.attackHitDone = false;
    if (this._useHeroPlayer) {
      if (this._useKnifeHero) {
        const attackKey = `hero_knife_attack_${angleToDir4(ps.attackDir)}`;
        if (this.anims.exists(attackKey)) this.player.play(attackKey, true);
        this.player.setFlipX(false);
      } else if (this.anims.exists('hero_attack')) {
        this.player.setFlipX(Math.cos(ps.attackDir) > 0);
        this.player.play('hero_attack', true);
      }
    }

    // 视觉：玩家前方扇形刀光
    this.spawnSlashGfx(ps.attackDir, ps.attackRange, ps.attackArc);
    if (Audio && Audio.sfx && Audio.sfx.slash) Audio.sfx.slash();
  }

  /** 远程攻击：装备远程武器时可用（鼠标右键 或 左键/J） */
  /** U key: wide hero blade skill using the imported 11-frame animation. */
  tryPlayerBladeSkill() {
    if (this._ended || !this.player || !this.playerState) return;
    const ps = this.playerState;
    const now = this.time.now;
    if (now < ps.bladeSkillCooldownUntil || now < ps.attackCooldownUntil) return;
    if (ps.blocking || now < ps.staggerUntil) return;
    if (ps.stam < HERO_BLADE_SKILL.cost) {
      this._floatText(this.player.x, this.player.y - 22, '体力不足', '#7fd8ff');
      if (Audio && Audio.sfx && Audio.sfx.bad) Audio.sfx.bad();
      return;
    }

    ps.stam = Math.max(0, ps.stam - HERO_BLADE_SKILL.cost);
    const dir = this._playerDir4 || 'right';
    const facingX = dir === 'left' ? -1 : (dir === 'right' ? 1 : (this._playerFacingX || 1));
    const aim = facingX < 0 ? Math.PI : 0;

    ps.attackDir = aim;
    ps.attackUntil = now + HERO_BLADE_SKILL.animMs;
    ps.attackAnimUntil = now + HERO_BLADE_SKILL.animMs;
    ps.attackCooldownUntil = now + 420;
    ps.attackHitDone = true;
    ps.bladeSkillUntil = now + HERO_BLADE_SKILL.animMs;
    ps.bladeSkillCooldownUntil = now + HERO_BLADE_SKILL.cooldownMs;
    this.playHeroBladeSkillFx(facingX);
    if (Audio && Audio.sfx && Audio.sfx.slash) Audio.sfx.slash();
    if (typeof this.updateWeaponHUD === 'function') this.updateWeaponHUD();
  }

  playHeroBladeSkillFx(facingX) {
    const animKey = facingX > 0 ? 'hero_blade_skill_right_anim' : 'hero_blade_skill_anim';
    const texKey = facingX > 0 ? 'hero_blade_skill_right' : 'hero_blade_skill';
    if (!this._useHeroPlayer || !this.anims.exists(animKey)) return;
    if (this._heroBladeSkillSprite) this._heroBladeSkillSprite.destroy();

    this.player.setVisible(false);
    const playerFootY = this.player.y + this.player.displayHeight / 2;
    const baseFxX = this.player.x;
    const originX = this.getHeroBladeSkillAnchorX(facingX) / HERO_BLADE_SKILL_FW;
    const fx = this.add.sprite(baseFxX, playerFootY, texKey, 0)
      .setOrigin(originX, HERO_BLADE_SKILL_ORIGIN_Y)
      .setScale(0.50)
      .setDepth(this.player.depth + 2);
    fx.play(animKey);
    this._heroBladeSkillSprite = fx;

    const onFrame = (anim, frame) => {
      const frameIndex = Math.max(0, (frame && frame.index ? frame.index - 1 : 0));
      fx.setScale(frameIndex < 4 || frameIndex === 10 ? 0.50 : 0.40);
      fx.x = baseFxX + this.getHeroBladeSkillFrameXOffset(frameIndex, facingX) * fx.scaleX;
      fx.y = playerFootY + this.getHeroBladeSkillFrameYOffset(frameIndex);
      this.resolveHeroBladeSkillFrameHit(fx, frameIndex, facingX);
    };
    fx.on(Phaser.Animations.Events.ANIMATION_UPDATE, onFrame);
    this.resolveHeroBladeSkillFrameHit(fx, 0, facingX);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      fx.off(Phaser.Animations.Events.ANIMATION_UPDATE, onFrame);
      if (this._heroBladeSkillSprite === fx) this._heroBladeSkillSprite = null;
      if (this.player && this.player.active) {
        const endRect = this.getHeroBladeSkillFrameRect(10, facingX);
        const originPx = this.getHeroBladeSkillAnchorX(facingX);
        const finalScale = 0.50;
        let targetX = fx.x + ((endRect.ax || originPx) - originPx) * finalScale;
        const finalFootY = playerFootY + this.getHeroBladeSkillFrameYOffset(10);
        let targetY = finalFootY - this.player.displayHeight / 2;

        // ── Anti-clip: step from original position toward target, stop before walls ──
        const startX = this.player.x;
        const startY = this.player.y;
        const dx = targetX - startX;
        const dy = targetY - startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1 && this.walls) {
          const steps = Math.ceil(dist / 8); // check every 8px
          const stepX = dx / steps;
          const stepY = dy / steps;
          const playerBody = this.player.body;
          const halfW = playerBody ? playerBody.width / 2 : 8;
          const halfH = playerBody ? playerBody.height / 2 : 8;
          let safeX = startX;
          let safeY = startY;
          for (let s = 1; s <= steps; s++) {
            const testX = startX + stepX * s;
            const testY = startY + stepY * s;
            // Check overlap with any wall body
            let blocked = false;
            for (const wall of this.walls.getChildren()) {
              if (!wall.body) continue;
              const wb = wall.body;
              // Simple AABB overlap test
              if (testX + halfW > wb.x && testX - halfW < wb.x + wb.width &&
                  testY + halfH > wb.y && testY - halfH < wb.y + wb.height) {
                blocked = true;
                break;
              }
            }
            if (blocked) break;
            safeX = testX;
            safeY = testY;
          }
          targetX = safeX;
          targetY = safeY;
        }

        this.player.setPosition(targetX, targetY);
        this.player.setVisible(true);
      }
      if (fx && fx.active) fx.destroy();
    };
    fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, cleanup);
    this.time.delayedCall(HERO_BLADE_SKILL.animMs + 120, cleanup);
  }

  getHeroBladeSkillAnchorX(facingX) {
    return facingX > 0 ? HERO_BLADE_SKILL_FW - HERO_BLADE_SKILL_LEFT_ANCHOR_X : HERO_BLADE_SKILL_LEFT_ANCHOR_X;
  }

  getHeroBladeSkillFrameRect(frameIndex, facingX) {
    const r = HERO_BLADE_SKILL_FRAME_RECTS[Math.max(0, Math.min(frameIndex, HERO_BLADE_SKILL_FRAME_RECTS.length - 1))];
    if (facingX <= 0) return r;
    return {
      x: HERO_BLADE_SKILL_FW - r.x - r.w,
      y: r.y,
      w: r.w,
      h: r.h,
      ax: HERO_BLADE_SKILL_FW - r.ax,
    };
  }

  getHeroBladeSkillHitRect(frameIndex, facingX) {
    const r = HERO_BLADE_SKILL_HIT_RECTS[Math.max(0, Math.min(frameIndex, HERO_BLADE_SKILL_HIT_RECTS.length - 1))];
    if (!r) return null;
    if (facingX <= 0) return r;
    return {
      x: HERO_BLADE_SKILL_FW - r.x - r.w,
      y: r.y,
      w: r.w,
      h: r.h,
    };
  }

  getHeroBladeSkillFrameYOffset(frameIndex) {
    return HERO_BLADE_SKILL_FRAME_Y_OFFSETS[Math.max(0, Math.min(frameIndex, HERO_BLADE_SKILL_FRAME_Y_OFFSETS.length - 1))] || 0;
  }

  getHeroBladeSkillFrameXOffset(frameIndex, facingX) {
    const x = HERO_BLADE_SKILL_FRAME_X_OFFSETS[Math.max(0, Math.min(frameIndex, HERO_BLADE_SKILL_FRAME_X_OFFSETS.length - 1))] || 0;
    return facingX > 0 ? -x : x;
  }

  getHeroBladeSkillWorldRect(fx, frameIndex, facingX, useHitRect = false) {
    const r = useHitRect
      ? this.getHeroBladeSkillHitRect(frameIndex, facingX)
      : this.getHeroBladeSkillFrameRect(frameIndex, facingX);
    if (!r) return null;
    const s = fx.scaleX;
    const ox = this.getHeroBladeSkillAnchorX(facingX);
    const oy = HERO_BLADE_SKILL_FH * HERO_BLADE_SKILL_ORIGIN_Y;
    const x0 = fx.x + (r.x - ox) * s;
    const x1 = fx.x + (r.x + r.w - ox) * s;
    const y0 = fx.y + (r.y - oy) * s;
    const y1 = fx.y + (r.y + r.h - oy) * s;
    return new Phaser.Geom.Rectangle(Math.min(x0, x1), y0, Math.abs(x1 - x0), y1 - y0);
  }

  resolveHeroBladeSkillFrameHit(fx, frameIndex, facingX) {
    if (!this.guards || !this.player) return;
    const hitRect = this.getHeroBladeSkillWorldRect(fx, frameIndex, facingX, true);
    if (!hitRect) return;
    const aim = facingX < 0 ? Math.PI : 0;
    const dirX = Math.cos(aim);
    const dirY = Math.sin(aim);
    let hitAny = false;

    for (const g of this.guards) {
      if (!g || g.dead || !g.sprite || !g.sprite.active) continue;
      const body = g.sprite.body;
      const targetRect = body
        ? new Phaser.Geom.Rectangle(body.x, body.y, body.width, body.height)
        : new Phaser.Geom.Rectangle(g.sprite.x - 18, g.sprite.y - 34, 36, 68);
      if (!Phaser.Geom.Rectangle.Overlaps(hitRect, targetRect)) continue;

      const kx = dirX * HERO_BLADE_SKILL.knockMul;
      const ky = dirY * HERO_BLADE_SKILL.knockMul;
      const dead = g.takeDamage(HERO_BLADE_SKILL.damage, kx, ky);
      if (dead) this._runStats.kills += 1;
      const hitText = dead ? '斩' : `-${HERO_BLADE_SKILL.damage}`;
      this.showBubble(g.sprite, hitText, { color: '#9ee8ff', fontSize: '17px', duration: 720, dy: -24 });
      this._spawnImpactRing(g.sprite.x, g.sprite.y, false);
      this.spawnHitSparks(g.sprite.x, g.sprite.y, false);
      hitAny = true;
    }

    if (hitAny) {
      this._applyHitstop(80);
      this.cameras.main.shake(130, 0.0045);
    }
  }

  tryPlayerRangedAttack() {
    if (this._ended) return;
    const ps = this.playerState;
    const now = this.time.now;
    if (now < ps.attackCooldownUntil) return;
    if (now < ps.bladeSkillUntil) return;
    if (ps.blocking) return;
    const wp = (this._loadoutEff && this._loadoutEff.weapon) || null;
    if (!wp || wp.kind !== 'ranged') {
      // 装备的不是远程武器，提示一下
      this._floatText(this.player.x, this.player.y - 22, '未装备远程兵刃', '#a08434');
      return;
    }
    if ((ps.ammo || 0) <= 0) {
      this._floatText(this.player.x, this.player.y - 22, '弹药耗尽', '#ff8c42');
      if (Audio && Audio.sfx && Audio.sfx.bad) Audio.sfx.bad();
      return;
    }
    const cost = (wp.staminaCost || 12);
    if (ps.stam < cost) return;

    ps.stam = Math.max(0, ps.stam - cost);
    ps.ammo -= 1;
    ps.attackDir = this.player.getData('aim') || 0;
    ps.attackAnimUntil = now + 360;
    ps.attackCooldownUntil = now + (wp.cooldownMs || 300);
    if (this._useHeroPlayer) {
      if (this._useKnifeHero) {
        const attackKey = `hero_knife_attack_${angleToDir4(ps.attackDir)}`;
        if (this.anims.exists(attackKey)) this.player.play(attackKey, true);
        this.player.setFlipX(false);
      } else if (this.anims.exists('hero_attack')) {
        this.player.setFlipX(Math.cos(ps.attackDir) < 0);
        this.player.play('hero_attack', true);
      }
    }

    this.spawnProjectile(wp, ps.attackDir);
    if (wp.noisy && Audio && Audio.sfx && Audio.sfx.slash) Audio.sfx.slash();
    this.updateWeaponHUD();
  }

  /** 生成一个玩家远程投射物。默认在 update() 里推进。 */
  spawnProjectile(weapon, aim) {
    if (!this._projectiles) this._projectiles = [];
    const px = this.player.x + Math.cos(aim) * 10;
    const py = this.player.y + Math.sin(aim) * 10;
    const isArrow = weapon.projectile === 'arrow';
    const color = isArrow ? 0xfff3b8 : 0xb8b8b8;
    const size = isArrow ? 6 : 4;
    // 用 graphics 画一个小当量体（避免依赖额外贴图）
    const g = this.add.graphics().setDepth(7);
    if (isArrow) {
      g.fillStyle(color, 1).fillRect(-size, -1, size * 2, 2);
      g.fillStyle(0x6b3a1c, 1).fillRect(size - 2, -1.5, 2, 3);
    } else {
      g.fillStyle(color, 1).fillCircle(0, 0, size);
      g.lineStyle(1, 0x4a4a4a, 1).strokeCircle(0, 0, size);
    }
    g.x = px;
    g.y = py;
    g.rotation = aim;

    this._projectiles.push({
      gfx: g,
      x: px,
      y: py,
      vx: Math.cos(aim) * weapon.speed,
      vy: Math.sin(aim) * weapon.speed,
      damage: weapon.damage || 1,
      range: weapon.range || 200,
      traveled: 0,
      knockMul: weapon.knockMul || 1,
      isArrow,
      noisy: !!weapon.noisy
    });
  }

  /** 逐帧推进玩家投射物与守卫、墙体的命中判定 */
  updateProjectiles(dtSec) {
    if (!this._projectiles || !this._projectiles.length) return;
    const next = [];
    for (const p of this._projectiles) {
      const dx = p.vx * dtSec;
      const dy = p.vy * dtSec;
      p.x += dx;
      p.y += dy;
      p.traveled += Math.hypot(dx, dy);
      p.gfx.x = p.x;
      p.gfx.y = p.y;

      // 超出射程或超出世界
      const bounds = this.physics.world.bounds;
      if (
        p.traveled > p.range ||
        p.x < bounds.x || p.x > bounds.x + bounds.width ||
        p.y < bounds.y || p.y > bounds.y + bounds.height
      ) {
        p.gfx.destroy();
        continue;
      }

      // 墙体拦截（用 walls group 的子体做点包含检测）
      let blocked = false;
      if (this.walls && this.walls.children) {
        const arr = this.walls.children.getArray();
        for (let i = 0; i < arr.length; i++) {
          const w = arr[i];
          if (!w.body) continue;
          const b = w.body;
          if (
            p.x >= b.x && p.x <= b.x + b.width &&
            p.y >= b.y && p.y <= b.y + b.height
          ) { blocked = true; break; }
        }
      }
      if (blocked) {
        // 火星作为撞壁反馈
        this.spawnHitSparks(p.x, p.y, false);
        p.gfx.destroy();
        continue;
      }

      // 守卫命中判定
      let hit = false;
      if (this.guards) {
        for (const g of this.guards) {
          if (g.dead) continue;
          const ddx = g.sprite.x - p.x;
          const ddy = g.sprite.y - p.y;
          if (Math.hypot(ddx, ddy) < 12) {
            const len = Math.max(1, Math.hypot(p.vx, p.vy));
            const dead = g.takeDamage(p.damage, (p.vx / len) * (p.knockMul || 1), (p.vy / len) * (p.knockMul || 1));
            if (dead) this._runStats.kills += 1;
            this.cameras.main.shake(60, 0.0025);
            this._spawnImpactRing(g.sprite.x, g.sprite.y, p.damage >= 3);
            this.spawnHitSparks(g.sprite.x, g.sprite.y, p.damage >= 3);
            this.showBubble(g.sprite, dead ? '竟!' : `-${p.damage}`,
              { color: dead ? '#ff8a8a' : '#ffe680', fontSize: '15px', duration: 600, dy: -20 });
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        p.gfx.destroy();
        continue;
      }

      next.push(p);
    }
    this._projectiles = next;
  }

  /** 每帧调用：攻击窗口内若命中则结算 */
  resolvePlayerAttack() {
    const ps = this.playerState;
    const now = this.time.now;
    if (now > ps.attackUntil || ps.attackHitDone) return;
    if (!this.guards) return;

    const HIT_RANGE = ps.attackRange || 32;
    const HIT_HALF = ps.attackArc || (Math.PI / 3); // 总角的一半
    const px = this.player.x;
    const py = this.player.y;
    const aim = ps.attackDir;
    const wp = (this._loadoutEff && this._loadoutEff.weapon) || null;
    const baseDmg = (wp && wp.damage) || 1;
    const knockMul = (wp && wp.knockMul) || 1;

    let hitAny = false;
    // 容差：守卫体积约 6px、贴图缩放后更大；范围 / 扇形稍微放宽
    const RANGE_PAD = 6;
    const ARC_PAD = Math.PI / 12; // +15° 容差
    for (const g of this.guards) {
      if (g.dead) continue;
      const dx = g.sprite.x - px;
      const dy = g.sprite.y - py;
      const dist = Math.hypot(dx, dy);
      if (dist > HIT_RANGE + RANGE_PAD) continue;
      const ang = Math.atan2(dy, dx);
      const diff = Math.abs(Phaser.Math.Angle.Wrap(ang - aim));
      if (diff > HIT_HALF + ARC_PAD) continue;

      // 背刺：玩家从守卫背后命中（玩家相对守卫的位置在守卫背向 90° 内）→ 一击必杀
      const isBackstab = g.isPlayerBehind(this.player);
      const dmg = isBackstab ? 99 : baseDmg;
      const kx = (dx / Math.max(1, dist)) * knockMul;
      const ky = (dy / Math.max(1, dist)) * knockMul;
      const dead = g.takeDamage(dmg, kx, ky);
      if (dead) this._runStats.kills += 1;

      // —— 命中 hitstop：瞭在这一下击中感 ——
      this._applyHitstop(isBackstab ? 90 : 55);

      // 反馈
      this.cameras.main.shake(isBackstab ? 140 : 90, isBackstab ? 0.006 : 0.0035);
      const hitText = isBackstab ? '击杀！' : (dead ? '杀！' : `-${dmg}`);
      const hitColor = isBackstab ? '#ff5050' : (dead ? '#ff8a8a' : '#ffe680');
      this.showBubble(g.sprite, hitText,
        { color: hitColor, fontSize: isBackstab ? '20px' : '16px', duration: 700, dy: -22 });
      if (isBackstab) this.showPlayerQuip('一击毙之，了无声息。', '#ff8a8a');

      // 冲击环：玩家事件明确能看到
      this._spawnImpactRing(g.sprite.x, g.sprite.y, isBackstab);

      // 火星粒子
      this.spawnHitSparks(g.sprite.x, g.sprite.y, isBackstab);

      hitAny = true;
      ps.attackHitDone = true;
      break;
    }

    // 没打到也消耗了 attack 状态（不重复结算）
    if (!hitAny) ps.attackHitDone = true;
  }

  /** 近身肉搏自动索敌：在 ~1.6 倍攻击距离内寻找最近活守卫并锁定方向。
   *  优先级：鼠标方向夹角内最近 > 任意方向最近；若都无，则维持原始 baseAim。 */
  _resolveMeleeAimAssist(baseAim, range) {
    // 没敌人则使用「贴图朝向」作为攻击方向，避免鼠标乱晃乱挥
    const fallback = (typeof this._playerFacingAngle === 'number') ? this._playerFacingAngle : baseAim;
    if (!this.guards || this.guards.length === 0) return fallback;
    const px = this.player.x, py = this.player.y;
    const R = (range || 32) * 1.7;          // 略放宽索敌距离
    const R2 = R * R;
    const CONE_HALF = Math.PI / 2.4;         // 75° 视为玩家"意图所指"（更宽容）

    let bestInCone = null;     let bestInConeDist = Infinity;
    let bestAny    = null;     let bestAnyDist    = Infinity;
    // 同时计算"贴图朝向"内最近，作为次优先目标
    let bestInFace = null;     let bestInFaceDist = Infinity;
    const FACE_HALF = Math.PI / 2;           // 90° 算"面前"

    for (const g of this.guards) {
      // 修复：Guard 用 this.dead 标记死亡，没有 alive 字段
      if (!g || g.dead || !g.sprite || !g.sprite.active) continue;
      const dx = g.sprite.x - px;
      const dy = g.sprite.y - py;
      const d2 = dx * dx + dy * dy;
      if (d2 > R2) continue;
      // 任意方向最近
      if (d2 < bestAnyDist) { bestAnyDist = d2; bestAny = g; }
      const ang = Math.atan2(dy, dx);
      // 鼠标方向夹角内最近（最高优先）
      const diffMouse = Math.abs(Phaser.Math.Angle.Wrap(ang - baseAim));
      if (diffMouse <= CONE_HALF && d2 < bestInConeDist) {
        bestInConeDist = d2; bestInCone = g;
      }
      // 贴图朝向夹角内最近（次优先）
      const diffFace = Math.abs(Phaser.Math.Angle.Wrap(ang - fallback));
      if (diffFace <= FACE_HALF && d2 < bestInFaceDist) {
        bestInFaceDist = d2; bestInFace = g;
      }
    }
    // 优先级：鼠标方向锁敌 > 角色面向锁敌 > 范围内最近 > 贴图朝向
    const target = bestInCone || bestInFace || bestAny;
    if (!target) return fallback;
    return Math.atan2(target.sprite.y - py, target.sprite.x - px);
  }

  /** 玩家挥刀视觉特效 */
  spawnSlashGfx(aim, range, arc) {
    const HIT_RANGE = range || 32;
    const HIT_HALF = arc || (Math.PI / 3);
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
    ps.staggerUntil = now + 380;   // 受击僵直 380ms：期间不受控，击退额外由 setVelocity 驱动
    // 受击反馈
    this.cameras.main.shake(180, 0.008);
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
      // 击退（加大力度，配合 staggerUntil 期间不被覆盖）
      if (source && source.sprite) {
        const dx = this.player.x - source.sprite.x;
        const dy = this.player.y - source.sprite.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        this.player.setVelocity((dx / len) * 320, (dy / len) * 320);
      }
    }
    if (ps.hp <= 0) {
      this.endRun(false, reasonHint || '伤重不支，倒在博物馆中……');
    }
  }

  /** 命中时停（hitstop）：让 tween 短时近乎冻结，配合震屏制造打击瞬间凝滞感
   *  不暂停物理，避免击退/僵直被中断；持续 ms 毫秒后恢复。
   */
  _applyHitstop(ms = 60) {
    if (this._hitstopActive) return;
    this._hitstopActive = true;
    const old = this.tweens.timeScale;
    this.tweens.timeScale = 0.08;
    this.time.delayedCall(ms, () => {
      this.tweens.timeScale = old;
      this._hitstopActive = false;
    });
  }

  /** 冲击波环：命中位置弹出一个白圈，强化"打中"反馈 */
  _spawnImpactRing(x, y, big = false) {
    const ring = this.add.circle(x, y, big ? 12 : 8, 0xffffff, 0)
      .setStrokeStyle(big ? 3 : 2, big ? 0xff6060 : 0xfff3b8, 0.95)
      .setDepth(8);
    this.tweens.add({
      targets: ring,
      scale: big ? 3.6 : 2.8,
      alpha: { from: 1, to: 0 },
      duration: big ? 280 : 220,
      ease: 'Cubic.out',
      onComplete: () => ring.destroy()
    });
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

  /** 消耗品 HUD（医疗包 / 烟雾弹 / 轻功符 库存显示） */
  updateConsumableHUD() {
    const stocks = SaveData.getConsumables() || {};
    if (this.medkitHUD) {
      const n = stocks.medkit || 0;
      this.medkitHUD.setText(n > 0 ? `⚕ × ${n}　H 使用` : '⚕ × 0');
    }
    if (this.smokeHUD) {
      const n = stocks.smoke_bomb || 0;
      this.smokeHUD.setText(n > 0 ? `💨 × ${n}　G 投放` : '');
    }
    if (this.qinggongHUD) {
      const n = stocks.qinggong_talisman || 0;
      const ps = this.playerState;
      const remain = ps && ps.qinggongUntil > this.time.now
        ? Math.ceil((ps.qinggongUntil - this.time.now) / 1000) : 0;
      if (remain > 0) {
        this.qinggongHUD.setText(`🍃 轻功 · ${remain}s`);
      } else if (n > 0) {
        this.qinggongHUD.setText(`🍃 × ${n}　V 启用`);
      } else {
        this.qinggongHUD.setText('');
      }
    }
  }

  /** 武器 HUD：名称 + （远程）弹药 · 冷却 */
  updateWeaponHUD() {
    if (!this.weaponHUD) return;
    const wp = (this._loadoutEff && this._loadoutEff.weapon) || null;
    if (!wp) { this.weaponHUD.setText(''); return; }
    if (wp.kind === 'ranged') {
      const ps = this.playerState || {};
      this.weaponHUD.setText(`${wp.icon || ''} ${wp.name}　弹 ${ps.ammo || 0}/${wp.ammoMax}　右键 发射`);
    } else {
      this.weaponHUD.setText(`${wp.icon || ''} ${wp.name}　左键/J 挥刀`);
    }
  }

  /** 按 H 使用一枚医疗包：HP +1、库存 -1 */
  useMedkit() {
    if (this._ended) return;
    const ps = this.playerState;
    if (!ps) return;
    if (ps.hp >= ps.hpMax) {
      this._floatText(this.player.x, this.player.y - 22, '身体无恕，不需回春丸', '#a08434');
      return;
    }
    if (!SaveData.consumeConsumable('medkit')) {
      this._floatText(this.player.x, this.player.y - 22, '回春丸库存为空', '#a08434');
      return;
    }
    ps.hp = Math.min(ps.hpMax, ps.hp + 1);
    this._floatText(this.player.x, this.player.y - 22, '+1 HP', '#7ae8e8');
    if (Audio && Audio.sfx && Audio.sfx.heal) Audio.sfx.heal();
    this.updatePlayerHUD();
    this.updateConsumableHUD();
  }

  /** 烟雾弹：在玩家脚下弹起一团烟雾，半径内的守卫警觉大幅下降，并同时遮住玩家许久 */
  useSmokeBomb() {
    if (this._ended) return;
    if (!SaveData.consumeConsumable('smoke_bomb')) {
      this._floatText(this.player.x, this.player.y - 22, '袖中无烟', '#a08434');
      return;
    }
    const RADIUS = 96;
    const DURATION = 4500;
    const ALERT_DROP = 0.6;
    const px = this.player.x;
    const py = this.player.y;

    // 对半径内守卫警觉下调
    if (this.guards) {
      for (const g of this.guards) {
        if (g.dead) continue;
        if (Phaser.Math.Distance.Between(px, py, g.sprite.x, g.sprite.y) <= RADIUS) {
          // 总警觉量为 1，这里下调 ALERT_DROP
          if (typeof g.alert === 'number') {
            g.alert = Math.max(0, g.alert - ALERT_DROP);
          } else if (typeof g.alertValue === 'number') {
            g.alertValue = Math.max(0, g.alertValue - (g.alertMax || 100) * ALERT_DROP);
          }
        }
      }
    }

    // 玩家获得一段掩护期：警觉逸出为 0，并为玩家准备一个"烟雾"状态供 Guard 读取
    const ps = this.playerState;
    ps.smokedUntil = this.time.now + DURATION;

    // 烟雾视觉效果（多层烟雾圈）
    for (let i = 0; i < 3; i++) {
      const cloud = this.add.circle(
        px + (Math.random() - 0.5) * 24,
        py + (Math.random() - 0.5) * 18,
        RADIUS * 0.45,
        0xb8b8c0,
        0.45
      ).setDepth(9);
      this.tweens.add({
        targets: cloud,
        scale: 1.6 + Math.random() * 0.4,
        alpha: 0,
        duration: DURATION,
        ease: 'Cubic.out',
        onComplete: () => cloud.destroy()
      });
    }

    this._floatText(px, py - 22, '迷烟起 · 守卫警觉骤降', '#cdb98a');
    if (Audio && Audio.sfx && Audio.sfx.click) Audio.sfx.click();
    this.updateConsumableHUD();
  }

  /** 轻功符：三息内造成达到疾跑速度且足下无声（警觉增长为 0） */
  useQinggong() {
    if (this._ended) return;
    const ps = this.playerState;
    if (ps && ps.qinggongUntil > this.time.now) {
      this._floatText(this.player.x, this.player.y - 22, '轻功未歇', '#a08434');
      return;
    }
    if (!SaveData.consumeConsumable('qinggong_talisman')) {
      this._floatText(this.player.x, this.player.y - 22, '轻功符库存为空', '#a08434');
      return;
    }
    const DURATION = 3500;
    const SPEED_MUL = 1.7;
    ps.qinggongUntil = this.time.now + DURATION;
    ps.qinggongMul = SPEED_MUL;

    // 视觉：脚下一点绿意光环
    const ring = this.add.circle(this.player.x, this.player.y, 18, 0xa0e8a8, 0.4).setDepth(8);
    this.tweens.add({
      targets: ring,
      scale: 2.2,
      alpha: 0,
      duration: 500,
      onComplete: () => ring.destroy()
    });
    this._floatText(this.player.x, this.player.y - 22, '轻功起 · 足下无声', '#a0e8a8');
    if (Audio && Audio.sfx && Audio.sfx.click) Audio.sfx.click();
    this.updateConsumableHUD();
  }
}
