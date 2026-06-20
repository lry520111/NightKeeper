// BootScene - 资源加载与全局配色
// 阶段一：所有贴图均通过 canvas 程序化生成，提升像素辨识度，并生成光照系统所需的光晕/光锥贴图
import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // —— LimeZu Modern Interiors 角色 sprite sheet（原版 16×32 像素风）——
    //   每张 384×32，单帧 16×32 → 24 帧 × 1 行
    //   方向顺序（实测）：right(0-5) / up(6-11) / left(12-17) / down(18-23)
    //   每方向 6 帧 walk 循环；idle_anim 与 run 都按此布局
    const charDir = 'assets/characters/Characters_free/';
    this.load.spritesheet('lz_adam_idle', charDir + 'Adam_idle_anim_16x16.png', {
      frameWidth: 16,
      frameHeight: 32
    });
    this.load.spritesheet('lz_adam_run', charDir + 'Adam_run_16x16.png', {
      frameWidth: 16,
      frameHeight: 32
    });
    // amelia → 守卫
    this.load.spritesheet('lz_amelia_idle', charDir + 'Amelia_idle_anim_16x16.png', {
      frameWidth: 16,
      frameHeight: 32
    });
    // alex → 水手
    this.load.spritesheet('lz_alex_idle', charDir + 'Alex_idle_anim_16x16.png', {
      frameWidth: 16,
      frameHeight: 32
    });
    // bob → 打手
    this.load.spritesheet('lz_bob_idle', charDir + 'Bob_idle_anim_16x16.png', {
      frameWidth: 16,
      frameHeight: 32
    });
    this.load.spritesheet('hero_hongfa', 'assets/characters/hero/hongfa.png', {
      frameWidth: 64,
      frameHeight: 64
    });
    this.load.spritesheet('hero_sword', 'assets/characters/hero/hongfa_sword.png', {
      frameWidth: 256,
      frameHeight: 256
    });
    this.load.spritesheet('hero_knife', 'assets/characters/hero/hongfa_knife.png', {
      frameWidth: 256,
      frameHeight: 256
    });
    // Bow hero frames (individual images, loaded as single-frame images)
    this.load.image('hero_bow_1', 'assets/characters/hero/1.png');
    this.load.image('hero_bow_2', 'assets/characters/hero/2.png');
    this.load.image('hero_bow_3', 'assets/characters/hero/3.png');
    this.load.image('hero_bow_4', 'assets/characters/hero/4.png');
    // Bow hero 4-direction walk frames (6 frames per direction)
    {
      const dirs = ['down', 'up', 'left', 'right'];
      for (const d of dirs) {
        for (let i = 1; i <= 6; i++) {
          this.load.image(`hero_bow_walk_${d}_${i}`, `assets/characters/hero/walk_bow/${d}${i}.png`);
        }
      }
    }
    this.load.spritesheet('hero_blade_skill', 'assets/effects/hero_blade_skill.png', {
      frameWidth: 772,
      frameHeight: 230
    });
    this.load.spritesheet('hero_blade_skill_right', 'assets/effects/hero_blade_skill_right.png', {
      frameWidth: 772,
      frameHeight: 230
    });
    // —— 第二技能（hero skill2）特效精灵表 ——
    this.load.spritesheet('hero_skill2_right', 'assets/effects/hero_skill2_right.png', {
      frameWidth: 821,
      frameHeight: 320
    });
    this.load.spritesheet('hero_skill2_left', 'assets/effects/hero_skill2_left.png', {
      frameWidth: 821,
      frameHeight: 320
    });
    this.load.spritesheet('curator_idle', 'assets/characters/curator/curator_idle.png', {
      frameWidth: 148,
      frameHeight: 287
    });

    // —— 高质量敌人 spritesheet（229×229 每帧，5列×6行）——
    // Row 1: walk_down, Row 2: walk_right, Row 3: walk_up, Row 4: walk_left, Row 5: attack, Row 6: hurt
    const enemyDir = 'assets/characters/enemies/';
    this.load.spritesheet('enemy_guard', enemyDir + 'gaurds.png', {
      frameWidth: 229,
      frameHeight: 229
    });
    this.load.spritesheet('enemy_thug', enemyDir + 'fighters.png', {
      frameWidth: 229,
      frameHeight: 229
    });
    this.load.spritesheet('enemy_thug_blackmarket', enemyDir + 'enemy_thug_blackmarket.png', {
      frameWidth: 224,
      frameHeight: 224
    });
    this.load.spritesheet('enemy_sailor', enemyDir + 'pirates_processed.png', {
      frameWidth: 229,
      frameHeight: 229
    });

    // —— TX 像素艺术贴图集
    // —— TX 像素艺术贴图集（用于 HubScene 大厅地面/墙体的真实贴图替换） ——
    // 仅作为切图来源，运行时不直接当作图像使用
    const tilesDir = 'assets/tiles/Texture/';
    this.load.image('tx_src_wall', tilesDir + 'TX Tileset Wall.png');
    this.load.image('tx_src_ground', tilesDir + 'TX Tileset Stone Ground.png');
    this.load.image('tx_src_props', tilesDir + 'TX Props.png');
    this.load.image('tx_src_struct', tilesDir + 'TX Struct.png');
    this.load.image('tx_src_plant', tilesDir + 'TX Plant.png');

    // —— Hub 大厅整张背景图（pre-rendered scene）——
    // 高质量预渲染场景图，覆盖整个画布；碰撞与交互锚点在 hubLayout.js 中定义
    this.load.image('hub_cover', 'assets/maps/hub02/hub_overall.jpg');
    this.load.image('hub_surface', 'assets/maps/hub02/hub_overall.jpg');
    this.load.image('hub_object', 'assets/maps/hub02/hub_object.png');
    this.load.image('training_ground', 'assets/maps/training/training_ground.png');

    const titleShots = [
      'shot01_museum_exterior.png',
      'shot02_relic_case.png',
      'shot03_theft_panels.png',
      'shot04_blackmarket.png',
      'shot05_blackmarket_panels.png',
      'shot06_ship.png',
      'shot07_ship_panels.png',
      'shot08_protagonist_hall.png',
      'shot09_protagonist_panels.png',
      'shot10_relic_returned.png',
    ];
    titleShots.forEach((file, idx) => {
      this.load.image(`title_anim_${String(idx + 1).padStart(2, '0')}`, `assets/title/${file}`);
    });
    const titlePanels = [
      ['title_panel_6_1', 'shot05_panel_1.png'],
      ['title_panel_6_2', 'shot05_panel_2.png'],
      ['title_panel_6_3', 'shot05_panel_3.png'],
      ['title_panel_6_4', 'shot05_panel_4.png'],
      ['title_panel_8_1', 'shot07_panel_1.png'],
      ['title_panel_8_2', 'shot07_panel_2.png'],
      ['title_panel_8_3', 'shot07_panel_3.png'],
      ['title_panel_8_4', 'shot07_panel_4.png'],
      ['title_panel_10_1', 'shot09_panel_blackmarket.png'],
      ['title_panel_10_2', 'shot09_panel_ship.png'],
      ['title_hero_cutout', 'title_hero_cutout.png'],
    ];
    titlePanels.forEach(([key, file]) => {
      this.load.image(key, `assets/title/${file}`);
    });

    // —— 任务关卡（博物馆）8 张高质量房间贴图 ——
    // 与 hub_02 同画风（深色砖墙 + 暗红/暗金中式纹饰），运行时按 roomTemplates 拼接
    // 室内尺寸、门洞坐标、墙体碰撞均在 src/data/roomTemplates.js 中以世界像素为单位标注
    for (let i = 1; i <= 8; i++) {
      const id = i.toString().padStart(2, '0');
      this.load.image(`room_${id}`, `assets/rooms/${id}.png`);
    }

    // —— 黑市 (Black Market) 6 张房间贴图 ——
    const bmRooms = ['bm_01', 'bm_02', 'bm_03', 'bm_04', 'bm_05', 'bm_06'];
    for (const id of bmRooms) {
      this.load.image(id, `assets/rooms/blackmarket/${id}.png`);
    }
    this.load.image('blackmarket_map', 'assets/maps/blackmarket/undermarket1.jpg');
    this.load.image('blackmarket_object', 'assets/maps/blackmarket/undermarket1_object.png');
    this.load.image('safe_closed', 'assets/props/safe/close.png');
    this.load.image('safe_open1', 'assets/props/safe/open1.png');
    this.load.image('safe_open2', 'assets/props/safe/open2.png');
    this.load.image('safe_open3', 'assets/props/safe/open3.png');
    this.load.image('chest_closed', 'assets/props/chest/close.png');
    this.load.image('chest_open1', 'assets/props/chest/open1.png');
    this.load.image('chest_open2', 'assets/props/chest/open2.png');
    this.load.image('chest_open3', 'assets/props/chest/open3.png');

    // —— 博物馆 (Museum) 完整地图 ——
    this.load.image('museum_full', 'assets/rooms/museum_full.png');

    // —— 走私船 (Smuggler Ship) 完整地图 ——
    this.load.image('ship_full', 'assets/rooms/ship_full.png');
    // Legacy: 8 张分块房间贴图（保留兼容）
    const ssRooms = ['ss_01', 'ss_02', 'ss_03', 'ss_04', 'ss_05', 'ss_06', 'ss_07', 'ss_08'];
    for (const id of ssRooms) {
      this.load.image(id, `assets/rooms/ship/${id}.png`);
    }

    // —— 文物高清贴图 (Relic PNG sprites) ——
    const relicPngs = ['head', 'bell', 'bluewhite', 'jade', 'mask', 'scroll', 'seal', 'vase'];
    for (const name of relicPngs) {
      this.load.image(`tex_relic_${name}`, `assets/relics/relic_${name}.png`);
    }

    // —— Hero 目录下的新版守卫 / 船员四向行走帧 (4 dirs × 6 frames) ——
    // guard/   → 博物馆守卫贴图
    // pirates/ → 走私船船员贴图
    const nkDirs = ['down', 'left', 'right', 'up'];
    for (const dir of nkDirs) {
      for (let i = 1; i <= 6; i++) {
        this.load.image(`nk_guard_${dir}_${i}`, `assets/characters/hero/guard/${dir}${i}.png`);
        this.load.image(`nk_pirate_${dir}_${i}`, `assets/characters/hero/pirates/${dir}${i}.png`);
      }
    }

    // —— Boss 房间地图 + Boss 角色贴图 ——
    // 房间背景图（玩家/Boss 在其上方战斗，边缘放一圈碰撞箱）
    this.load.image('boss_room_bg', 'assets/rooms/boss_room.png');

    // Boss 待机 (idle) 7 帧
    for (let i = 1; i <= 7; i++) {
      this.load.image(`boss_idle_${i}`, `assets/characters/enemies/boss_new/boss/%E5%BE%85%E6%9C%BA/idle-sprites/${i}.png`);
    }
    // Boss 四向行走（每方向 7 帧）
    for (const d of nkDirs) {
      for (let i = 1; i <= 7; i++) {
        this.load.image(`boss_walk_${d}_${i}`, `assets/characters/enemies/boss_new/boss/%E5%9B%9B%E5%90%91%E8%A1%8C%E8%B5%B0/walk/${d}${i}.png`);
      }
    }
    // Boss 三个技能（各 10 帧）
    for (let s = 1; s <= 3; s++) {
      for (let i = 1; i <= 10; i++) {
        this.load.image(`boss_skill${s}_${i}`, `assets/characters/enemies/boss_new/boss/skill${s}/skill${s}-sprites/${i}.png`);
      }
    }
  }

  create() {
    // —— Remove white background from relic PNG textures ——
    this._removeRelicPngBackground();

    // —— 角色 / 物件贴图 ——
    this.makePlayerTexture();
    this.makePlayerWalkTexture();    // 玩家行走第二帧（双腿换位）
    this.makeGuardTexture();
    this.makeGuardWalkTexture();     // 守卫行走第二帧
    // 黑市打手 / 走私船船员
    this.makeGuardThug();
    this.makeGuardThugWalk();
    this.makeGuardSailor();
    this.makeGuardSailorWalk();
    this.makeExitTexture();
    this.makeWallTexture();
    this.makeWallTopTexture();   // 墙顶（带瓦片纹理）
    this.makeFloorTexture();
    this.makeFloorVarA();        // 地板变体A（带龟裂）
    this.makeFloorVarB();        // 地板变体B（带回纹砖）
    // —— Hub 大厅专用：从 TX 图集裁剪真实像素艺术贴图 ——
    this.makeHubTilesFromTX();
    // 黑市 biome 专用贴图
    this.makeBlackmarketWall();
    this.makeBlackmarketWallTop();
    this.makeBlackmarketFloor();
    this.makeBlackmarketFloorA();
    this.makeBlackmarketFloorB();
    // 走私船 biome 专用贴图
    this.makeShipWall();
    this.makeShipWallTop();
    this.makeShipFloor();
    this.makeShipFloorA();
    this.makeShipFloorB();
    this.makeCarpetTexture();    // 红地毯（撤离前导引）
    this.makeDisplayCaseTexture();

    // —— 装饰物贴图 ——
    this.makeLanternTexture();   // 红灯笼
    this.makePlaqueTexture();    // 牌匾
    this.makeScreenTexture();    // 屏风
    this.makeIncenseTexture();   // 香炉
    this.makeClueTexture();      // 剧情碎片（信纸残页）

    // 文物按类型差异化绘制
    this.makeRelicVase();      // 瓶罐类（碗、唐三彩）
    this.makeRelicScroll();    // 卷轴类（写经、清明上河图）
    this.makeRelicHead();      // 兽首
    this.makeRelicDing();      // 鼎
    this.makeRelicJade();      // 玉琮
    this.makeRelicSeal();      // 印玺
    // 兜底通用文物贴图
    this.makeRectTexture('tex_relic', 12, 12, 0xd4af37, 0xfff3b8);

    // —— 光照系统贴图 ——
    this.makeLightTexture('tex_light_lg', 320);  // 玩家手电筒大光圈（增大）
    this.makeLightTexture('tex_light_sm', 180);  // 玩家潜行小光圈（增大）
    this.makeLightTexture('tex_light_xs', 90);   // 文物/小物件微光（增大）
    this.makeLightTexture('tex_light_guard', 110); // 守卫提灯光晕
    this.makeLightTexture('tex_light_lantern', 90); // 灯笼光晕
    this.makeLightWarmTexture('tex_light_warm', 110); // 暖红色光晕（灯笼用）

    // —— 战斗 / HUD 贴图 ——
    this.makeBladeSlashTexture();   // 玩家挥刀刀光（扇形白光）
    this.makeBlockShieldTexture();  // 格挡光晕（蓝色弧线）
    this.makeHeartTexture();        // 红心（HP 单位）
    this.makeStaminaPipTexture();   // 体力珠（绿）
    this.makeAlertMarkTexture();    // 守卫头顶"！"
    this.makeSneakIconTexture();    // 潜行图标
    this.makeSprintIconTexture();   // 疾跑图标

    // —— 粒子 / 特效贴图 ——
    this.makeDustParticle();        // 拾取金粉
    this.makeSparkParticle();       // 攻击溅火星
    this.makeBloodParticle();       // 受击红粒
    this.makeGlowRingTexture();     // 撤离门光环
    this.makeFootstepTexture();     // 脚印拖痕
    this.makeVignetteTexture();     // 屏幕暗角（周边压暗）
    this.makeFogTexture();          // 雾气云团（氛围用）

    // —— 注册 LimeZu 角色动画（供 HubScene/对话使用）——
    this.registerLZAnims();
    this.registerHeroAnims();
    this.registerNkGuardAnims();
    this.registerCuratorAnims();
    this.registerEnemyAnims();

    // —— 像素美术保护：所有像素纹理（tex_* / lz_*）强制 NEAREST 过滤 ——
    // 全局 pixelArt 已关（让 UI 文字高清），像素纹理需要在此单独设置，否则会被 LINEAR 模糊
    // 注意：room_* 与 hub_cover 是高分辨率场景图，不能 NEAREST，否则缩放后呈锯齿
    const Filter = Phaser.Textures.FilterMode || { NEAREST: 0 };
    const NEAREST = (Filter.NEAREST !== undefined) ? Filter.NEAREST : 0;
    Object.keys(this.textures.list).forEach((key) => {
      if (key.startsWith('tex_') || key.startsWith('lz_') || key.startsWith('hero_') || key.startsWith('enemy_') || key.startsWith('curator_')) {
        const t = this.textures.get(key);
        if (t && typeof t.setFilter === 'function') t.setFilter(NEAREST);
      }
    });

    this.scene.start('TitleScene');
  }

  // ——————————— 通用工具 ———————————


  /**
   * Remove white/light background from relic PNG textures using flood-fill from edges.
   * This ensures only the connected background region is removed, preserving interior details.
   */
  _removeRelicPngBackground() {
    const relicKeys = ['tex_relic_head', 'tex_relic_bell', 'tex_relic_bluewhite',
      'tex_relic_jade', 'tex_relic_mask', 'tex_relic_scroll', 'tex_relic_seal', 'tex_relic_vase'];
    // Tolerance: how different a pixel can be from "white" and still count as background
    const tolerance = 60; // allows removal of light grays (RGB ~195+)

    for (const key of relicKeys) {
      if (!this.textures.exists(key)) continue;
      const src = this.textures.get(key).getSourceImage();
      const w = src.width;
      const h = src.height;

      // Draw source image onto a temporary canvas
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(src, 0, 0);

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      const visited = new Uint8Array(w * h);

      // Check if a pixel is "background-like" (close to white/light gray)
      const isBgPixel = (idx) => {
        const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
        if (a === 0) return true; // already transparent
        // Check if pixel is light enough (close to white)
        return r >= (255 - tolerance) && g >= (255 - tolerance) && b >= (255 - tolerance);
      };

      // Flood fill from edges to mark connected background pixels
      const queue = [];
      // Seed from all edge pixels
      for (let x = 0; x < w; x++) {
        queue.push(x); // top row
        queue.push((h - 1) * w + x); // bottom row
      }
      for (let y = 1; y < h - 1; y++) {
        queue.push(y * w); // left column
        queue.push(y * w + (w - 1)); // right column
      }

      // BFS flood fill
      let head = 0;
      while (head < queue.length) {
        const pos = queue[head++];
        if (pos < 0 || pos >= w * h) continue;
        if (visited[pos]) continue;
        const idx = pos * 4;
        if (!isBgPixel(idx)) continue;

        visited[pos] = 1;
        data[idx + 3] = 0; // make transparent

        const x = pos % w;
        const y = (pos - x) / w;
        // 4-connected neighbors
        if (x > 0) queue.push(pos - 1);
        if (x < w - 1) queue.push(pos + 1);
        if (y > 0) queue.push(pos - w);
        if (y < h - 1) queue.push(pos + w);
      }

      ctx.putImageData(imageData, 0, 0);

      // Remove old texture and re-add with processed canvas
      this.textures.remove(key);
      this.textures.addCanvas(key, canvas);
    }
  }

  /**
   * 用 canvas 创建并注册一张贴图
   */
  makeCanvasTexture(key, w, h, draw) {
    // Skip if texture already loaded (e.g. PNG from preload overrides canvas fallback)
    if (this.textures.exists(key)) return;
    const tex = this.textures.createCanvas(key, w, h);
    const ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false;
    draw(ctx, w, h);
    tex.refresh();
  }

  /**
   * 旧版：纯色 + 描边矩形（兼容保留）
   */
  makeRectTexture(key, w, h, fill, border) {
    const g = this.add.graphics();
    g.fillStyle(fill, 1);
    g.fillRect(0, 0, w, h);
    g.lineStyle(1, border, 1);
    g.strokeRect(0, 0, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  /**
   * 从 TX 像素艺术图集中裁剪 32x32 瓷砖，注册为 Hub 大厅专用 key
   *  · tex_hub_floor_a / tex_hub_floor_b ← TX Tileset Stone Ground
   *  · tex_hub_wall / tex_hub_wall_top  ← TX Tileset Wall
   *  · tex_hub_arch / tex_hub_armor / tex_hub_weapon_rack / tex_hub_throne
   *    tex_hub_bush / tex_hub_pot / tex_hub_chest / tex_hub_pillar ← TX Props/Struct/Plant
   * 若源图未加载（兜底安全），则回退用浅灰色块占位。
   */
  makeHubTilesFromTX() {
    const sliceTo = (dstKey, srcKey, sx, sy, sw, sh, dw = sw, dh = sh) => {
      // 兜底：若源未就绪，画占位
      if (!this.textures.exists(srcKey)) {
        this.makeCanvasTexture(dstKey, dw, dh, (ctx) => {
          ctx.fillStyle = '#5a5044';
          ctx.fillRect(0, 0, dw, dh);
          ctx.strokeStyle = '#332b22';
          ctx.strokeRect(0, 0, dw, dh);
        });
        return;
      }
      const srcImg = this.textures.get(srcKey).getSourceImage();
      const tex = this.textures.createCanvas(dstKey, dw, dh);
      const ctx = tex.getContext();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(srcImg, sx, sy, sw, sh, 0, 0, dw, dh);
      tex.refresh();
    };

    // ===== 地面（来源 256x256，每基础块约 32x32） =====
    sliceTo('tex_hub_floor_a', 'tx_src_ground', 0, 0, 32, 32);
    sliceTo('tex_hub_floor_b', 'tx_src_ground', 32, 0, 32, 32);

    // ===== 墙体（来源 512x512） =====
    sliceTo('tex_hub_wall', 'tx_src_wall', 32, 224, 32, 32);
    sliceTo('tex_hub_wall_top', 'tx_src_wall', 64, 32, 32, 32);

    // ===== 家具/装饰（来源 TX Props.png 512x512） =====
    // 大致按图集肉眼网格估算坐标，若有偏移可调整下列数字
    // 王座（馆长椅）：左侧带高靠背的石椅，约 32x64
    sliceTo('tex_hub_throne', 'tx_src_props', 192, 192, 32, 64);
    // 盔甲架（人形）：约 32x96
    sliceTo('tex_hub_armor', 'tx_src_props', 288, 32, 32, 96);
    // 武器架（带剑、长矛）：约 32x96
    sliceTo('tex_hub_weapon_rack', 'tx_src_props', 320, 128, 32, 96);
    // 陶罐（中等）：约 32x32
    sliceTo('tex_hub_pot', 'tx_src_props', 64, 224, 32, 32);
    // 木箱：约 32x32
    sliceTo('tex_hub_chest', 'tx_src_props', 32, 0, 32, 32);
    // 大石坛（大厅中央装饰，可选）：约 96x64
    sliceTo('tex_hub_altar', 'tx_src_props', 320, 320, 96, 64);
    // 立式石碑：约 32x64
    sliceTo('tex_hub_pillar', 'tx_src_props', 96, 0, 32, 64);

    // ===== 拱门（来源 TX Struct.png 512x512） =====
    // 大石拱门（任务门用）：约 96x96
    sliceTo('tex_hub_arch', 'tx_src_struct', 384, 0, 96, 96);

    // ===== 植物（来源 TX Plant.png 512x512） =====
    // 灌木丛：约 32x32
    sliceTo('tex_hub_bush', 'tx_src_plant', 32, 192, 32, 32);
  }

  // ——————————— 光晕（径向渐变） ———————————

  makeLightTexture(key, size) {
    this.makeCanvasTexture(key, size, size, (ctx, w, h) => {
      const cx = w / 2;
      const cy = h / 2;
      const r = w / 2;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0.0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.45, 'rgba(255,255,255,0.55)');
      grad.addColorStop(0.85, 'rgba(255,255,255,0.08)');
      grad.addColorStop(1.0, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    });
  }

  // 暖色光晕（灯笼专用，纯白蒙版下用 tint 上色不够，这里直接画暖白）
  makeLightWarmTexture(key, size) {
    this.makeCanvasTexture(key, size, size, (ctx, w, h) => {
      const cx = w / 2;
      const cy = h / 2;
      const r = w / 2;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0.0, 'rgba(255,230,180,1)');
      grad.addColorStop(0.4, 'rgba(255,180,120,0.5)');
      grad.addColorStop(0.85, 'rgba(255,140,80,0.08)');
      grad.addColorStop(1.0, 'rgba(255,140,80,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    });
  }

  // ——————————— 角色贴图 ———————————

  // 玩家：守夜人，黑衣 + 金色腰带 + 黑头巾
  makePlayerTexture() {
    this.makeCanvasTexture('tex_player', 16, 24, (ctx) => {
      // 头巾
      ctx.fillStyle = '#1a1a22';
      ctx.fillRect(4, 2, 8, 6);
      // 脸（少量）
      ctx.fillStyle = '#c9a878';
      ctx.fillRect(5, 6, 6, 3);
      // 眼睛
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(6, 7, 1, 1);
      ctx.fillRect(9, 7, 1, 1);
      // 身体（黑衣）
      ctx.fillStyle = '#2b2b3a';
      ctx.fillRect(3, 9, 10, 9);
      // 腰带（金）
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(3, 14, 10, 1);
      // 腿
      ctx.fillStyle = '#1a1a22';
      ctx.fillRect(4, 18, 3, 5);
      ctx.fillRect(9, 18, 3, 5);
      // 高光勾边
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(3, 9, 1, 5);
      ctx.fillRect(12, 9, 1, 5);
    });
  }

  // 玩家：行走第二帧（双腿换位 + 头部上下 1px）
  makePlayerWalkTexture() {
    this.makeCanvasTexture('tex_player_walk', 16, 24, (ctx) => {
      // 头巾（上移 1px）
      ctx.fillStyle = '#1a1a22';
      ctx.fillRect(4, 1, 8, 6);
      // 脸
      ctx.fillStyle = '#c9a878';
      ctx.fillRect(5, 5, 6, 3);
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(6, 6, 1, 1);
      ctx.fillRect(9, 6, 1, 1);
      // 身体
      ctx.fillStyle = '#2b2b3a';
      ctx.fillRect(3, 8, 10, 9);
      // 腰带
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(3, 13, 10, 1);
      // 腿（左短右长，营造踏步差）
      ctx.fillStyle = '#1a1a22';
      ctx.fillRect(4, 17, 3, 4);  // 左腿抬起
      ctx.fillRect(9, 17, 3, 6);  // 右腿落地
      // 高光
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(3, 8, 1, 5);
      ctx.fillRect(12, 8, 1, 5);
    });
  }

  // 守卫：红衣 + 红巾 + 持灯
  makeGuardTexture() {
    this.makeCanvasTexture('tex_guard', 16, 24, (ctx) => {
      // 红头巾
      ctx.fillStyle = '#7a1f1f';
      ctx.fillRect(4, 2, 8, 5);
      ctx.fillStyle = '#a82e2e';
      ctx.fillRect(4, 2, 8, 1);
      // 脸
      ctx.fillStyle = '#d8b890';
      ctx.fillRect(5, 5, 6, 3);
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(6, 6, 1, 1);
      ctx.fillRect(9, 6, 1, 1);
      // 红衣
      ctx.fillStyle = '#8a2828';
      ctx.fillRect(3, 8, 10, 10);
      // 衣领
      ctx.fillStyle = '#e8c87a';
      ctx.fillRect(7, 8, 2, 2);
      // 腰带
      ctx.fillStyle = '#3a2418';
      ctx.fillRect(3, 14, 10, 1);
      // 腿
      ctx.fillStyle = '#3a2418';
      ctx.fillRect(4, 18, 3, 5);
      ctx.fillRect(9, 18, 3, 5);
      // 高光
      ctx.fillStyle = '#a83838';
      ctx.fillRect(3, 8, 1, 6);
    });
  }

  // 守卫：行走第二帧
  makeGuardWalkTexture() {
    this.makeCanvasTexture('tex_guard_walk', 16, 24, (ctx) => {
      // 红头巾（上移 1px）
      ctx.fillStyle = '#7a1f1f';
      ctx.fillRect(4, 1, 8, 5);
      ctx.fillStyle = '#a82e2e';
      ctx.fillRect(4, 1, 8, 1);
      // 脸
      ctx.fillStyle = '#d8b890';
      ctx.fillRect(5, 4, 6, 3);
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(6, 5, 1, 1);
      ctx.fillRect(9, 5, 1, 1);
      // 红衣
      ctx.fillStyle = '#8a2828';
      ctx.fillRect(3, 7, 10, 10);
      ctx.fillStyle = '#e8c87a';
      ctx.fillRect(7, 7, 2, 2);
      ctx.fillStyle = '#3a2418';
      ctx.fillRect(3, 13, 10, 1);
      // 腿（与原帧反向）
      ctx.fillStyle = '#3a2418';
      ctx.fillRect(4, 17, 3, 6);
      ctx.fillRect(9, 17, 3, 4);
      // 高光
      ctx.fillStyle = '#a83838';
      ctx.fillRect(3, 7, 1, 6);
    });
  }

  // ——————————— 场景贴图 ———————————

  // 撤离点：朱红色双扇门，带金钉
  makeExitTexture() {
    this.makeCanvasTexture('tex_exit', 32, 32, (ctx) => {
      // 门外阴影
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, 32, 32);
      // 门框（深棕）
      ctx.fillStyle = '#3a1f10';
      ctx.fillRect(2, 1, 28, 30);
      // 朱红门扇
      ctx.fillStyle = '#a02828';
      ctx.fillRect(4, 3, 24, 27);
      // 中缝
      ctx.fillStyle = '#3a1010';
      ctx.fillRect(15, 3, 2, 27);
      // 门扇高光（左右各一条）
      ctx.fillStyle = '#c83838';
      ctx.fillRect(4, 3, 1, 27);
      ctx.fillRect(27, 3, 1, 27);
      // 上沿明亮
      ctx.fillStyle = '#d04848';
      ctx.fillRect(4, 3, 24, 1);
      // 金色门钉（两扇各 6 颗）
      ctx.fillStyle = '#f0d060';
      const studs = [
        [8, 8], [11, 8], [8, 14], [11, 14], [8, 20], [11, 20],
        [20, 8], [23, 8], [20, 14], [23, 14], [20, 20], [23, 20]
      ];
      for (const [sx, sy] of studs) {
        ctx.fillRect(sx, sy, 2, 2);
      }
      // 门钉高光
      ctx.fillStyle = '#fff3b8';
      for (const [sx, sy] of studs) {
        ctx.fillRect(sx, sy, 1, 1);
      }
      // 门环（金色圆环简化为方块）
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(12, 16, 2, 3);
      ctx.fillRect(18, 16, 2, 3);
    });
  }

  // 墙体：深色砖纹
  makeWallTexture() {
    this.makeCanvasTexture('tex_wall', 32, 32, (ctx) => {
      // 底色
      ctx.fillStyle = '#1a1a22';
      ctx.fillRect(0, 0, 32, 32);
      // 砖缝
      ctx.fillStyle = '#0e0e16';
      // 上排砖
      ctx.fillRect(0, 10, 32, 1);
      ctx.fillRect(10, 0, 1, 11);
      // 下排砖（错缝）
      ctx.fillRect(0, 21, 32, 1);
      ctx.fillRect(20, 11, 1, 10);
      ctx.fillRect(0, 21, 1, 11);
      ctx.fillRect(16, 21, 1, 11);
      // 砖块高光
      ctx.fillStyle = '#2a2a36';
      ctx.fillRect(1, 1, 8, 1);
      ctx.fillRect(11, 1, 20, 1);
      ctx.fillRect(1, 12, 18, 1);
      ctx.fillRect(21, 12, 10, 1);
      ctx.fillRect(1, 22, 14, 1);
      ctx.fillRect(17, 22, 14, 1);
    });
  }

  // 墙顶（屋檐瓦）
  makeWallTopTexture() {
    this.makeCanvasTexture('tex_wall_top', 32, 32, (ctx) => {
      // 屋檐板
      ctx.fillStyle = '#1a1a22';
      ctx.fillRect(0, 4, 32, 28);
      // 顶部瓦片底色
      ctx.fillStyle = '#0a0a10';
      ctx.fillRect(0, 0, 32, 5);
      // 瓦片高光
      ctx.fillStyle = '#2a2a36';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(i * 8 + 1, 0, 6, 1);
        ctx.fillRect(i * 8 + 1, 4, 6, 1);
      }
      // 瓦片分隔
      ctx.fillStyle = '#0a0a10';
      for (let i = 1; i < 4; i++) {
        ctx.fillRect(i * 8 - 1, 0, 1, 5);
      }
      // 下方砖纹
      ctx.fillStyle = '#0e0e16';
      ctx.fillRect(0, 16, 32, 1);
      ctx.fillRect(16, 5, 1, 12);
      ctx.fillRect(0, 27, 32, 1);
      ctx.fillStyle = '#2a2a36';
      ctx.fillRect(1, 6, 14, 1);
      ctx.fillRect(17, 6, 14, 1);
      ctx.fillRect(1, 18, 30, 1);
    });
  }

  // ——————————— 装饰物贴图 ———————————

  // 红灯笼（顶部带细绳从屋檐垂下）
  makeLanternTexture() {
    this.makeCanvasTexture('tex_lantern', 16, 24, (ctx) => {
      // 悬挂绳
      ctx.fillStyle = '#3a2818';
      ctx.fillRect(7, 0, 2, 4);
      // 顶盖
      ctx.fillStyle = '#2a1810';
      ctx.fillRect(4, 4, 8, 2);
      // 灯笼主体
      ctx.fillStyle = '#c82828';
      ctx.fillRect(3, 6, 10, 12);
      // 高光
      ctx.fillStyle = '#e84848';
      ctx.fillRect(3, 6, 1, 10);
      ctx.fillRect(4, 6, 8, 1);
      // 暗面
      ctx.fillStyle = '#8a1818';
      ctx.fillRect(12, 7, 1, 10);
      // 中心金条
      ctx.fillStyle = '#f0d060';
      ctx.fillRect(7, 7, 2, 10);
      // 底盖 + 流苏
      ctx.fillStyle = '#2a1810';
      ctx.fillRect(4, 18, 8, 2);
      ctx.fillStyle = '#f0d060';
      ctx.fillRect(7, 20, 2, 4);
    });
  }

  // 牌匾（横置黑底金字）
  makePlaqueTexture() {
    this.makeCanvasTexture('tex_plaque', 64, 20, (ctx) => {
      // 木框
      ctx.fillStyle = '#3a1f10';
      ctx.fillRect(0, 0, 64, 20);
      // 内框
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(2, 2, 60, 16);
      // 边线高光
      ctx.fillStyle = '#7a4a28';
      ctx.fillRect(0, 0, 64, 1);
      ctx.fillRect(0, 0, 1, 20);
      // 金字（用方块象形几个汉字）
      ctx.fillStyle = '#d4af37';
      // "博"
      ctx.fillRect(8, 6, 6, 1);
      ctx.fillRect(10, 5, 2, 9);
      ctx.fillRect(8, 9, 6, 1);
      ctx.fillRect(8, 13, 6, 1);
      // "古"
      ctx.fillRect(20, 5, 6, 1);
      ctx.fillRect(22, 5, 2, 9);
      ctx.fillRect(20, 9, 6, 1);
      ctx.fillRect(20, 13, 6, 1);
      // "通"
      ctx.fillRect(32, 5, 6, 1);
      ctx.fillRect(34, 5, 2, 9);
      ctx.fillRect(32, 9, 6, 1);
      ctx.fillRect(32, 13, 6, 1);
      // "今"
      ctx.fillRect(44, 5, 6, 1);
      ctx.fillRect(46, 5, 2, 9);
      ctx.fillRect(44, 9, 6, 1);
      ctx.fillRect(44, 13, 6, 1);
      // 金钉装饰
      ctx.fillStyle = '#f0d060';
      ctx.fillRect(56, 4, 2, 2);
      ctx.fillRect(56, 14, 2, 2);
    });
  }

  // 屏风（三折）
  makeScreenTexture() {
    this.makeCanvasTexture('tex_screen', 48, 28, (ctx) => {
      // 三扇底色
      const colors = ['#3a2818', '#4a3220', '#3a2818'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = colors[i];
        ctx.fillRect(i * 16, 0, 16, 26);
        // 边框
        ctx.fillStyle = '#1a0e08';
        ctx.fillRect(i * 16, 0, 16, 1);
        ctx.fillRect(i * 16, 25, 16, 1);
        ctx.fillRect(i * 16, 0, 1, 26);
        ctx.fillRect(i * 16 + 15, 0, 1, 26);
        // 内画（金色山纹）
        ctx.fillStyle = '#a8843a';
        ctx.fillRect(i * 16 + 4, 14, 2, 1);
        ctx.fillRect(i * 16 + 5, 13, 2, 1);
        ctx.fillRect(i * 16 + 7, 11, 2, 1);
        ctx.fillRect(i * 16 + 9, 13, 2, 1);
        ctx.fillRect(i * 16 + 10, 14, 2, 1);
        // 落款（朱红方块）
        ctx.fillStyle = '#a82e2e';
        ctx.fillRect(i * 16 + 11, 18, 2, 2);
      }
      // 底座
      ctx.fillStyle = '#1a0e08';
      ctx.fillRect(0, 26, 48, 2);
    });
  }

  // 香炉（小型，带袅袅烟）
  makeIncenseTexture() {
    this.makeCanvasTexture('tex_incense', 16, 18, (ctx) => {
      // 烟（淡灰）
      ctx.fillStyle = 'rgba(180,180,180,0.4)';
      ctx.fillRect(7, 0, 1, 4);
      ctx.fillRect(8, 1, 1, 3);
      // 炉口
      ctx.fillStyle = '#3a2818';
      ctx.fillRect(3, 6, 10, 2);
      // 炉身
      ctx.fillStyle = '#5a4028';
      ctx.fillRect(2, 8, 12, 6);
      ctx.fillStyle = '#8a6438';
      ctx.fillRect(2, 8, 12, 1);
      ctx.fillRect(2, 8, 1, 6);
      // 三足
      ctx.fillStyle = '#3a2818';
      ctx.fillRect(3, 14, 2, 3);
      ctx.fillRect(7, 14, 2, 3);
      ctx.fillRect(11, 14, 2, 3);
      // 纹饰
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(7, 11, 2, 1);
    });
  }

  // 剧情碎片：泛黄信纸残页
  makeClueTexture() {
    this.makeCanvasTexture('tex_clue', 16, 16, (ctx) => {
      // 阴影
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(2, 13, 13, 2);
      // 纸张主体（米黄）
      ctx.fillStyle = '#e8d8a8';
      ctx.fillRect(2, 2, 12, 12);
      // 高光（左上角）
      ctx.fillStyle = '#f8ecc4';
      ctx.fillRect(2, 2, 12, 1);
      ctx.fillRect(2, 2, 1, 12);
      // 暗边（右下）
      ctx.fillStyle = '#a89060';
      ctx.fillRect(2, 13, 12, 1);
      ctx.fillRect(13, 2, 1, 12);
      // 撕角（右下）
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.clearRect(12, 12, 2, 2);
      ctx.clearRect(13, 11, 1, 1);
      // 字迹（墨黑短线）
      ctx.fillStyle = '#2a1810';
      ctx.fillRect(4, 5, 7, 1);
      ctx.fillRect(4, 7, 5, 1);
      ctx.fillRect(4, 9, 8, 1);
      ctx.fillRect(4, 11, 4, 1);
      // 朱砂印
      ctx.fillStyle = '#a82828';
      ctx.fillRect(10, 11, 2, 2);
    });
  }

  // 地板：木纹（主）
  makeFloorTexture() {
    this.makeCanvasTexture('tex_floor', 32, 32, (ctx) => {
      ctx.fillStyle = '#2a2018';
      ctx.fillRect(0, 0, 32, 32);
      // 木板分隔
      ctx.fillStyle = '#1a1410';
      ctx.fillRect(0, 10, 32, 1);
      ctx.fillRect(0, 21, 32, 1);
      // 木纹
      ctx.fillStyle = '#3a2e22';
      ctx.fillRect(3, 3, 14, 1);
      ctx.fillRect(20, 5, 8, 1);
      ctx.fillRect(5, 14, 18, 1);
      ctx.fillRect(2, 17, 10, 1);
      ctx.fillRect(8, 24, 16, 1);
      ctx.fillRect(20, 27, 8, 1);
      // 暗斑
      ctx.fillStyle = '#1e1610';
      ctx.fillRect(12, 7, 2, 1);
      ctx.fillRect(25, 18, 2, 1);
      ctx.fillRect(6, 26, 2, 1);
    });
  }

  // 地板变体A：带龟裂、几处磨损
  makeFloorVarA() {
    this.makeCanvasTexture('tex_floor_a', 32, 32, (ctx) => {
      ctx.fillStyle = '#2a2018';
      ctx.fillRect(0, 0, 32, 32);
      // 木板分隔
      ctx.fillStyle = '#1a1410';
      ctx.fillRect(0, 14, 32, 1);
      // 木纹
      ctx.fillStyle = '#3a2e22';
      ctx.fillRect(2, 4, 18, 1);
      ctx.fillRect(6, 8, 10, 1);
      ctx.fillRect(12, 18, 18, 1);
      ctx.fillRect(4, 22, 14, 1);
      ctx.fillRect(8, 28, 18, 1);
      // 龟裂
      ctx.fillStyle = '#0e0a06';
      ctx.fillRect(15, 5, 1, 7);
      ctx.fillRect(15, 12, 4, 1);
      ctx.fillRect(19, 12, 1, 5);
      // 磨损亮斑
      ctx.fillStyle = '#3e3022';
      ctx.fillRect(22, 24, 4, 2);
      ctx.fillRect(4, 16, 3, 1);
    });
  }

  // 地板变体B：嵌入回纹砖（中央方形纹饰）
  makeFloorVarB() {
    this.makeCanvasTexture('tex_floor_b', 32, 32, (ctx) => {
      ctx.fillStyle = '#2a2018';
      ctx.fillRect(0, 0, 32, 32);
      // 木板分隔
      ctx.fillStyle = '#1a1410';
      ctx.fillRect(0, 6, 32, 1);
      ctx.fillRect(0, 26, 32, 1);
      // 中心嵌砖底色
      ctx.fillStyle = '#3a2818';
      ctx.fillRect(6, 8, 20, 18);
      // 回纹外框
      ctx.fillStyle = '#5a4028';
      ctx.fillRect(6, 8, 20, 1);
      ctx.fillRect(6, 25, 20, 1);
      ctx.fillRect(6, 8, 1, 18);
      ctx.fillRect(25, 8, 1, 18);
      // 内层金线（暗金）
      ctx.fillStyle = '#7a5a28';
      ctx.fillRect(9, 11, 14, 1);
      ctx.fillRect(9, 22, 14, 1);
      ctx.fillRect(9, 11, 1, 12);
      ctx.fillRect(22, 11, 1, 12);
      // 中心方点
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(15, 16, 2, 2);
    });
  }

  // 黑市：铁皮绣蚀墙
  makeBlackmarketWall() {
    this.makeCanvasTexture('tex_wall_bm', 32, 32, (ctx) => {
      // 底色：冷灰铁
      ctx.fillStyle = '#1a1620';
      ctx.fillRect(0, 0, 32, 32);
      // 铁皮拼接缝
      ctx.fillStyle = '#0a0810';
      ctx.fillRect(0, 0, 32, 1);
      ctx.fillRect(0, 16, 32, 1);
      ctx.fillRect(0, 31, 32, 1);
      ctx.fillRect(0, 0, 1, 32);
      ctx.fillRect(31, 0, 1, 32);
      // 铆钉点（四个角）
      ctx.fillStyle = '#3a3450';
      ctx.fillRect(2, 2, 2, 2);
      ctx.fillRect(28, 2, 2, 2);
      ctx.fillRect(2, 28, 2, 2);
      ctx.fillRect(28, 28, 2, 2);
      ctx.fillRect(2, 18, 2, 2);
      ctx.fillRect(28, 18, 2, 2);
      // 绣蚀班驳
      ctx.fillStyle = '#3a2218';
      ctx.fillRect(8, 6, 3, 1);
      ctx.fillRect(20, 9, 4, 1);
      ctx.fillRect(12, 22, 5, 1);
      ctx.fillRect(24, 25, 3, 1);
      // 高光
      ctx.fillStyle = '#2c2638';
      ctx.fillRect(1, 1, 30, 1);
      ctx.fillRect(1, 17, 30, 1);
    });
  }

  // 黑市墙顶：铁皮护栏 + 霉苔底
  makeBlackmarketWallTop() {
    this.makeCanvasTexture('tex_wall_bm_top', 32, 32, (ctx) => {
      // 顶部护栏底
      ctx.fillStyle = '#0a0810';
      ctx.fillRect(0, 0, 32, 5);
      // 护栏金属光
      ctx.fillStyle = '#3a3450';
      ctx.fillRect(0, 1, 32, 1);
      ctx.fillRect(0, 4, 32, 1);
      // 护栏竹节划分
      ctx.fillStyle = '#0a0810';
      for (let i = 0; i < 32; i += 4) ctx.fillRect(i, 0, 1, 5);
      // 下方铁皮主体
      ctx.fillStyle = '#1a1620';
      ctx.fillRect(0, 5, 32, 27);
      // 拼接缝
      ctx.fillStyle = '#0a0810';
      ctx.fillRect(0, 18, 32, 1);
      ctx.fillRect(15, 5, 1, 13);
      ctx.fillRect(0, 31, 32, 1);
      // 高光
      ctx.fillStyle = '#2c2638';
      ctx.fillRect(1, 6, 14, 1);
      ctx.fillRect(17, 6, 14, 1);
      ctx.fillRect(1, 19, 30, 1);
      // 零星霉苔（纪徵性）
      ctx.fillStyle = '#2a3a18';
      ctx.fillRect(7, 12, 2, 1);
      ctx.fillRect(22, 25, 2, 1);
    });
  }

  // 黑市地面：阳沟水泥
  makeBlackmarketFloor() {
    this.makeCanvasTexture('tex_floor_bm', 32, 32, (ctx) => {
      ctx.fillStyle = '#181420';
      ctx.fillRect(0, 0, 32, 32);
      // 水泥拼缝
      ctx.fillStyle = '#0a0712';
      ctx.fillRect(0, 16, 32, 1);
      ctx.fillRect(16, 0, 1, 32);
      // 斑驳ストーン
      ctx.fillStyle = '#22182c';
      ctx.fillRect(4, 4, 2, 1);
      ctx.fillRect(20, 6, 3, 1);
      ctx.fillRect(8, 22, 2, 1);
      ctx.fillRect(24, 24, 2, 1);
      ctx.fillRect(11, 11, 1, 1);
      ctx.fillRect(25, 13, 1, 1);
      // 极薄震茶光
      ctx.fillStyle = '#241a30';
      ctx.fillRect(2, 13, 4, 1);
      ctx.fillRect(20, 28, 6, 1);
    });
  }

  // 黑市地面变体A：震肤裂纹 + 血迹点
  makeBlackmarketFloorA() {
    this.makeCanvasTexture('tex_floor_bm_a', 32, 32, (ctx) => {
      ctx.fillStyle = '#181420';
      ctx.fillRect(0, 0, 32, 32);
      // 主裂纹
      ctx.fillStyle = '#0a0712';
      ctx.fillRect(6, 5, 1, 7);
      ctx.fillRect(6, 12, 6, 1);
      ctx.fillRect(11, 12, 1, 5);
      ctx.fillRect(20, 18, 1, 9);
      ctx.fillRect(15, 22, 6, 1);
      // 零散点点
      ctx.fillStyle = '#22182c';
      ctx.fillRect(2, 26, 2, 1);
      ctx.fillRect(28, 4, 2, 1);
      // 血迹（暗红）
      ctx.fillStyle = '#3a0a14';
      ctx.fillRect(13, 8, 2, 1);
      ctx.fillRect(15, 9, 1, 1);
    });
  }

  // 黑市地面变体B：下水道格栅
  makeBlackmarketFloorB() {
    this.makeCanvasTexture('tex_floor_bm_b', 32, 32, (ctx) => {
      ctx.fillStyle = '#181420';
      ctx.fillRect(0, 0, 32, 32);
      // 中心格栅
      ctx.fillStyle = '#0a0712';
      ctx.fillRect(8, 8, 16, 16);
      // 格栅条
      ctx.fillStyle = '#241a30';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(8, 10 + i * 4, 16, 1);
      }
      // 边框冷光
      ctx.fillStyle = '#3a2050';
      ctx.fillRect(8, 8, 16, 1);
      ctx.fillRect(8, 23, 16, 1);
      ctx.fillRect(8, 8, 1, 16);
      ctx.fillRect(23, 8, 1, 16);
      // 下水道中心点
      ctx.fillStyle = '#5a3070';
      ctx.fillRect(15, 15, 2, 2);
    });
  }

  // ——————————— 走私船 biome ———————————

  // 走私船墙：铆钉钢板 + 锈蚀
  makeShipWall() {
    this.makeCanvasTexture('tex_wall_sp', 32, 32, (ctx) => {
      // 底色：海军灰
      ctx.fillStyle = '#1a2a38';
      ctx.fillRect(0, 0, 32, 32);
      // 钢板拼接缝（横竖）
      ctx.fillStyle = '#0a1420';
      ctx.fillRect(0, 0, 32, 1);
      ctx.fillRect(0, 16, 32, 1);
      ctx.fillRect(0, 31, 32, 1);
      ctx.fillRect(0, 0, 1, 32);
      ctx.fillRect(31, 0, 1, 32);
      // 铆钉（六颗）
      ctx.fillStyle = '#6a8aa8';
      ctx.fillRect(3, 3, 2, 2);
      ctx.fillRect(27, 3, 2, 2);
      ctx.fillRect(3, 19, 2, 2);
      ctx.fillRect(27, 19, 2, 2);
      ctx.fillRect(15, 11, 2, 2);
      ctx.fillRect(15, 27, 2, 2);
      // 铆钉高光
      ctx.fillStyle = '#a8c8e8';
      ctx.fillRect(3, 3, 1, 1);
      ctx.fillRect(27, 3, 1, 1);
      ctx.fillRect(3, 19, 1, 1);
      ctx.fillRect(27, 19, 1, 1);
      ctx.fillRect(15, 11, 1, 1);
      ctx.fillRect(15, 27, 1, 1);
      // 锈蚀斑
      ctx.fillStyle = '#5a3018';
      ctx.fillRect(9, 7, 3, 1);
      ctx.fillRect(20, 22, 4, 1);
      ctx.fillRect(11, 25, 2, 1);
      // 顶部高光
      ctx.fillStyle = '#2c4258';
      ctx.fillRect(1, 1, 30, 1);
      ctx.fillRect(1, 17, 30, 1);
    });
  }

  // 走私船墙顶：钢板甲板 + 缆绳
  makeShipWallTop() {
    this.makeCanvasTexture('tex_wall_sp_top', 32, 32, (ctx) => {
      // 顶部缆绳暗槽
      ctx.fillStyle = '#0a1420';
      ctx.fillRect(0, 0, 32, 5);
      // 缆绳金属环
      ctx.fillStyle = '#6a8aa8';
      ctx.fillRect(2, 1, 2, 2);
      ctx.fillRect(14, 1, 2, 2);
      ctx.fillRect(28, 1, 2, 2);
      // 缆绳本体（褐绳）
      ctx.fillStyle = '#7a5a30';
      ctx.fillRect(0, 3, 32, 1);
      ctx.fillStyle = '#a88848';
      ctx.fillRect(0, 2, 32, 1);
      // 主体钢板
      ctx.fillStyle = '#1a2a38';
      ctx.fillRect(0, 5, 32, 27);
      // 拼接缝
      ctx.fillStyle = '#0a1420';
      ctx.fillRect(0, 18, 32, 1);
      ctx.fillRect(15, 5, 1, 13);
      ctx.fillRect(0, 31, 32, 1);
      // 高光
      ctx.fillStyle = '#2c4258';
      ctx.fillRect(1, 6, 14, 1);
      ctx.fillRect(17, 6, 14, 1);
      ctx.fillRect(1, 19, 30, 1);
      // 锈斑
      ctx.fillStyle = '#5a3018';
      ctx.fillRect(8, 12, 2, 1);
      ctx.fillRect(22, 24, 3, 1);
    });
  }

  // 走私船地板：木甲板（深棕橫纹）
  makeShipFloor() {
    this.makeCanvasTexture('tex_floor_sp', 32, 32, (ctx) => {
      ctx.fillStyle = '#3a2818';
      ctx.fillRect(0, 0, 32, 32);
      // 三块横向甲板
      ctx.fillStyle = '#1a1208';
      ctx.fillRect(0, 10, 32, 1);
      ctx.fillRect(0, 21, 32, 1);
      // 木纹高光
      ctx.fillStyle = '#5a4028';
      ctx.fillRect(0, 0, 32, 1);
      ctx.fillRect(0, 11, 32, 1);
      ctx.fillRect(0, 22, 32, 1);
      // 木板纹理（轻随机）
      ctx.fillStyle = '#2a1c10';
      ctx.fillRect(5, 4, 8, 1);
      ctx.fillRect(18, 14, 10, 1);
      ctx.fillRect(7, 26, 6, 1);
      ctx.fillRect(20, 28, 8, 1);
      // 钉子
      ctx.fillStyle = '#6a8aa8';
      ctx.fillRect(2, 1, 1, 1);
      ctx.fillRect(29, 12, 1, 1);
      ctx.fillRect(15, 23, 1, 1);
    });
  }

  // 走私船地板变体A：水渍 + 海盐
  makeShipFloorA() {
    this.makeCanvasTexture('tex_floor_sp_a', 32, 32, (ctx) => {
      ctx.fillStyle = '#3a2818';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#1a1208';
      ctx.fillRect(0, 10, 32, 1);
      ctx.fillRect(0, 21, 32, 1);
      ctx.fillStyle = '#5a4028';
      ctx.fillRect(0, 0, 32, 1);
      ctx.fillRect(0, 11, 32, 1);
      // 大片水渍（深蓝）
      ctx.fillStyle = '#1a384a';
      ctx.fillRect(8, 13, 12, 6);
      ctx.fillRect(10, 12, 8, 1);
      ctx.fillRect(10, 19, 8, 1);
      // 水面反光
      ctx.fillStyle = '#5a8aa8';
      ctx.fillRect(11, 14, 4, 1);
      ctx.fillRect(13, 17, 5, 1);
      // 海盐结晶（白点）
      ctx.fillStyle = '#a8c8e8';
      ctx.fillRect(3, 26, 1, 1);
      ctx.fillRect(27, 5, 1, 1);
      ctx.fillRect(22, 28, 1, 1);
    });
  }

  // 走私船地板变体B：散落货箱钉 + 锁链
  makeShipFloorB() {
    this.makeCanvasTexture('tex_floor_sp_b', 32, 32, (ctx) => {
      ctx.fillStyle = '#3a2818';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#1a1208';
      ctx.fillRect(0, 10, 32, 1);
      ctx.fillRect(0, 21, 32, 1);
      ctx.fillStyle = '#5a4028';
      ctx.fillRect(0, 0, 32, 1);
      ctx.fillRect(0, 11, 32, 1);
      // 锁链横穿（金属）
      ctx.fillStyle = '#6a8aa8';
      ctx.fillRect(6, 16, 2, 1);
      ctx.fillRect(9, 16, 2, 1);
      ctx.fillRect(12, 16, 2, 1);
      ctx.fillRect(15, 16, 2, 1);
      ctx.fillRect(18, 16, 2, 1);
      ctx.fillRect(21, 16, 2, 1);
      ctx.fillRect(24, 16, 2, 1);
      // 锁链高光
      ctx.fillStyle = '#a8c8e8';
      ctx.fillRect(6, 16, 1, 1);
      ctx.fillRect(12, 16, 1, 1);
      ctx.fillRect(18, 16, 1, 1);
      ctx.fillRect(24, 16, 1, 1);
      // 散落钉子
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(4, 5, 1, 2);
      ctx.fillRect(26, 25, 1, 2);
    });
  }

  // ——————————— 敌人样式（黑市打手 / 走私船船员）———————————

  // 黑市打手：黑夹克 + 红头巾 + 凶相
  makeGuardThug() {
    this.makeCanvasTexture('tex_guard_thug', 16, 24, (ctx) => {
      // 红头巾（飘带式）
      ctx.fillStyle = '#a02020';
      ctx.fillRect(4, 2, 8, 4);
      ctx.fillStyle = '#d83838';
      ctx.fillRect(4, 2, 8, 1);
      ctx.fillRect(11, 5, 2, 3);   // 飘带
      // 脸（偏黄）
      ctx.fillStyle = '#c8a878';
      ctx.fillRect(5, 5, 6, 3);
      // 凶眼（细一点）
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(6, 6, 1, 1);
      ctx.fillRect(9, 6, 1, 1);
      // 黑夹克
      ctx.fillStyle = '#181820';
      ctx.fillRect(3, 8, 10, 10);
      // 内衬白
      ctx.fillStyle = '#a8a8b0';
      ctx.fillRect(7, 8, 2, 3);
      // 腰带（金扣）
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(3, 14, 10, 1);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(7, 14, 2, 1);
      // 黑裤
      ctx.fillStyle = '#0a0a14';
      ctx.fillRect(4, 18, 3, 5);
      ctx.fillRect(9, 18, 3, 5);
      // 高光
      ctx.fillStyle = '#3a3a48';
      ctx.fillRect(3, 8, 1, 6);
    });
  }

  makeGuardThugWalk() {
    this.makeCanvasTexture('tex_guard_thug_walk', 16, 24, (ctx) => {
      ctx.fillStyle = '#a02020';
      ctx.fillRect(4, 1, 8, 4);
      ctx.fillStyle = '#d83838';
      ctx.fillRect(4, 1, 8, 1);
      ctx.fillRect(11, 4, 2, 3);
      ctx.fillStyle = '#c8a878';
      ctx.fillRect(5, 4, 6, 3);
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(6, 5, 1, 1);
      ctx.fillRect(9, 5, 1, 1);
      ctx.fillStyle = '#181820';
      ctx.fillRect(3, 7, 10, 10);
      ctx.fillStyle = '#a8a8b0';
      ctx.fillRect(7, 7, 2, 3);
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(3, 13, 10, 1);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(7, 13, 2, 1);
      ctx.fillStyle = '#0a0a14';
      ctx.fillRect(4, 17, 3, 6);
      ctx.fillRect(9, 17, 3, 4);
      ctx.fillStyle = '#3a3a48';
      ctx.fillRect(3, 7, 1, 6);
    });
  }

  // 走私船船员：海军蓝 + 水手帽 + 横纹衫
  makeGuardSailor() {
    this.makeCanvasTexture('tex_guard_sailor', 16, 24, (ctx) => {
      // 水手帽（白边蓝顶）
      ctx.fillStyle = '#1a3a6a';
      ctx.fillRect(4, 1, 8, 4);
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(3, 4, 10, 1);   // 白色帽檐
      ctx.fillStyle = '#3a5a8a';
      ctx.fillRect(4, 1, 8, 1);    // 帽子高光
      // 红色帽徽
      ctx.fillStyle = '#d83838';
      ctx.fillRect(7, 2, 2, 1);
      // 脸（晒红）
      ctx.fillStyle = '#d8a878';
      ctx.fillRect(5, 5, 6, 3);
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(6, 6, 1, 1);
      ctx.fillRect(9, 6, 1, 1);
      // 横纹衫（白底蓝纹）
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(3, 8, 10, 10);
      ctx.fillStyle = '#1a3a6a';
      ctx.fillRect(3, 9, 10, 1);
      ctx.fillRect(3, 12, 10, 1);
      ctx.fillRect(3, 15, 10, 1);
      // 衣领（V 字）
      ctx.fillStyle = '#1a3a6a';
      ctx.fillRect(7, 8, 2, 1);
      // 腰带
      ctx.fillStyle = '#3a2418';
      ctx.fillRect(3, 17, 10, 1);
      // 蓝裤
      ctx.fillStyle = '#0a1a3a';
      ctx.fillRect(4, 18, 3, 5);
      ctx.fillRect(9, 18, 3, 5);
      // 高光
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(3, 8, 1, 1);
    });
  }

  makeGuardSailorWalk() {
    this.makeCanvasTexture('tex_guard_sailor_walk', 16, 24, (ctx) => {
      ctx.fillStyle = '#1a3a6a';
      ctx.fillRect(4, 0, 8, 4);
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(3, 3, 10, 1);
      ctx.fillStyle = '#3a5a8a';
      ctx.fillRect(4, 0, 8, 1);
      ctx.fillStyle = '#d83838';
      ctx.fillRect(7, 1, 2, 1);
      ctx.fillStyle = '#d8a878';
      ctx.fillRect(5, 4, 6, 3);
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(6, 5, 1, 1);
      ctx.fillRect(9, 5, 1, 1);
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(3, 7, 10, 10);
      ctx.fillStyle = '#1a3a6a';
      ctx.fillRect(3, 8, 10, 1);
      ctx.fillRect(3, 11, 10, 1);
      ctx.fillRect(3, 14, 10, 1);
      ctx.fillStyle = '#1a3a6a';
      ctx.fillRect(7, 7, 2, 1);
      ctx.fillStyle = '#3a2418';
      ctx.fillRect(3, 16, 10, 1);
      // 腿（反向）
      ctx.fillStyle = '#0a1a3a';
      ctx.fillRect(4, 17, 3, 6);
      ctx.fillRect(9, 17, 3, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(3, 7, 1, 1);
    });
  }

  // 红地毯（铺在撤离门前）
  makeCarpetTexture() {
    this.makeCanvasTexture('tex_carpet', 32, 32, (ctx) => {
      ctx.fillStyle = '#6a1818';
      ctx.fillRect(0, 0, 32, 32);
      // 边缘金线
      ctx.fillStyle = '#a8843a';
      ctx.fillRect(0, 0, 32, 1);
      ctx.fillRect(0, 31, 32, 1);
      ctx.fillRect(0, 0, 1, 32);
      ctx.fillRect(31, 0, 1, 32);
      // 内框
      ctx.fillStyle = '#7a2828';
      ctx.fillRect(2, 2, 28, 28);
      // 暗金回纹简化
      ctx.fillStyle = '#a8843a';
      ctx.fillRect(4, 4, 6, 1);
      ctx.fillRect(22, 4, 6, 1);
      ctx.fillRect(4, 27, 6, 1);
      ctx.fillRect(22, 27, 6, 1);
      ctx.fillRect(4, 4, 1, 4);
      ctx.fillRect(27, 4, 1, 4);
      ctx.fillRect(4, 24, 1, 4);
      ctx.fillRect(27, 24, 1, 4);
      // 中央纹章（简化龙鳞菱形）
      ctx.fillStyle = '#c89848';
      ctx.fillRect(15, 13, 2, 6);
      ctx.fillRect(13, 15, 6, 2);
      ctx.fillStyle = '#e8b858';
      ctx.fillRect(15, 15, 2, 2);
    });
  }

  // 展柜（玻璃柜）：放在文物下面作为底座
  makeDisplayCaseTexture() {
    this.makeCanvasTexture('tex_case', 28, 28, (ctx) => {
      // 玻璃半透
      ctx.fillStyle = 'rgba(120, 180, 200, 0.18)';
      ctx.fillRect(2, 2, 24, 24);
      // 木质底座
      ctx.fillStyle = '#3a2418';
      ctx.fillRect(0, 22, 28, 6);
      ctx.fillStyle = '#5a3828';
      ctx.fillRect(0, 22, 28, 1);
      // 玻璃边框
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(2, 2, 24, 1);
      ctx.fillRect(2, 2, 1, 22);
      ctx.fillRect(25, 2, 1, 22);
      // 玻璃高光
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(5, 5, 1, 14);
      ctx.fillRect(7, 5, 1, 8);
    });
  }

  // ——————————— 文物贴图（按类型差异化） ———————————

  // 兽首（兔首）：金色立体头型
  makeRelicHead() {
    this.makeCanvasTexture('tex_relic_head', 16, 16, (ctx) => {
      // 耳朵
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(4, 1, 2, 5);
      ctx.fillRect(10, 1, 2, 5);
      // 头
      ctx.fillRect(3, 5, 10, 8);
      // 高光
      ctx.fillStyle = '#fff3b8';
      ctx.fillRect(3, 5, 1, 5);
      ctx.fillRect(4, 1, 1, 4);
      ctx.fillRect(10, 1, 1, 4);
      // 眼睛（红宝石）
      ctx.fillStyle = '#a82e2e';
      ctx.fillRect(5, 8, 2, 2);
      ctx.fillRect(9, 8, 2, 2);
      // 底座
      ctx.fillStyle = '#8a6420';
      ctx.fillRect(2, 13, 12, 2);
    });
  }

  // 鼎：三足两耳
  makeRelicDing() {
    this.makeCanvasTexture('tex_relic_ding', 32, 32, (ctx) => {
      const p = (x, y, w, h, c) => {
        ctx.fillStyle = c;
        ctx.fillRect(x, y, w, h);
      };
      const outline = '#172522';
      const dark = '#29382f';
      const bronze = '#52684f';
      const mid = '#6f805f';
      const light = '#9daf83';
      const patina = '#74bdb5';
      const patina2 = '#b7ece6';
      const shadow = '#1a201f';

      p(6, 4, 4, 8, outline);
      p(22, 4, 4, 8, outline);
      p(7, 5, 2, 6, patina);
      p(23, 5, 2, 6, patina);
      p(8, 7, 3, 2, patina2);
      p(21, 7, 3, 2, patina2);

      p(9, 6, 14, 2, outline);
      p(8, 8, 16, 2, outline);
      p(10, 7, 12, 1, patina2);
      p(9, 8, 14, 1, patina);

      p(7, 10, 18, 2, outline);
      p(6, 12, 20, 3, outline);
      p(5, 15, 22, 6, outline);
      p(6, 21, 20, 2, outline);
      p(8, 23, 16, 2, outline);

      p(8, 11, 16, 2, mid);
      p(7, 13, 18, 3, bronze);
      p(6, 16, 20, 4, bronze);
      p(7, 20, 18, 2, dark);
      p(9, 22, 14, 1, shadow);
      p(9, 12, 13, 1, light);
      p(7, 14, 2, 5, mid);
      p(23, 14, 2, 5, dark);

      p(11, 14, 3, 1, light);
      p(18, 14, 3, 1, light);
      p(10, 16, 2, 2, dark);
      p(14, 16, 4, 1, light);
      p(20, 16, 2, 2, dark);
      p(12, 19, 8, 1, light);

      p(7, 23, 3, 6, outline);
      p(15, 23, 3, 7, outline);
      p(23, 23, 3, 6, outline);
      p(8, 23, 1, 5, mid);
      p(16, 23, 1, 6, mid);
      p(24, 23, 1, 5, mid);
      p(6, 29, 5, 1, patina);
      p(14, 30, 5, 1, patina);
      p(22, 29, 5, 1, patina);
    });
  }

  // 卷轴
  makeRelicScroll() {
    this.makeCanvasTexture('tex_relic_scroll', 16, 16, (ctx) => {
      // 轴芯（深棕）
      ctx.fillStyle = '#3a2818';
      ctx.fillRect(2, 4, 12, 8);
      // 纸面（米黄）
      ctx.fillStyle = '#e8d8a8';
      ctx.fillRect(2, 6, 12, 4);
      // 文字痕迹
      ctx.fillStyle = '#3a2818';
      ctx.fillRect(4, 7, 1, 1);
      ctx.fillRect(6, 7, 1, 1);
      ctx.fillRect(8, 7, 1, 1);
      ctx.fillRect(10, 7, 1, 1);
      ctx.fillRect(5, 8, 1, 1);
      ctx.fillRect(7, 8, 1, 1);
      ctx.fillRect(9, 8, 1, 1);
      ctx.fillRect(11, 8, 1, 1);
      // 轴端（金）
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(1, 4, 2, 8);
      ctx.fillRect(13, 4, 2, 8);
      // 高光
      ctx.fillStyle = '#fff3b8';
      ctx.fillRect(1, 4, 1, 1);
      ctx.fillRect(13, 4, 1, 1);
    });
  }

  // 瓷器/瓶罐
  makeRelicVase() {
    this.makeCanvasTexture('tex_relic_vase', 16, 16, (ctx) => {
      // 瓶口
      ctx.fillStyle = '#5a8a8a';
      ctx.fillRect(6, 1, 4, 2);
      // 瓶颈
      ctx.fillStyle = '#7aa8a8';
      ctx.fillRect(7, 3, 2, 2);
      // 瓶身
      ctx.fillStyle = '#7aa8a8';
      ctx.fillRect(4, 5, 8, 9);
      // 高光（汝窑天青）
      ctx.fillStyle = '#aed8d8';
      ctx.fillRect(4, 5, 1, 7);
      ctx.fillRect(5, 5, 1, 1);
      // 暗面
      ctx.fillStyle = '#3a5a5a';
      ctx.fillRect(11, 6, 1, 8);
      // 底座
      ctx.fillStyle = '#3a2818';
      ctx.fillRect(5, 14, 6, 1);
    });
  }

  // 玉琮：内圆外方
  makeRelicJade() {
    this.makeCanvasTexture('tex_relic_jade', 16, 16, (ctx) => {
      // 外方
      ctx.fillStyle = '#5a8a5a';
      ctx.fillRect(2, 3, 12, 10);
      // 高光
      ctx.fillStyle = '#8ac88a';
      ctx.fillRect(2, 3, 12, 1);
      ctx.fillRect(2, 3, 1, 10);
      // 暗面
      ctx.fillStyle = '#3a5a3a';
      ctx.fillRect(13, 4, 1, 9);
      ctx.fillRect(3, 12, 11, 1);
      // 内圆（黑）
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(6, 6, 4, 4);
      // 纹饰
      ctx.fillStyle = '#2a4a2a';
      ctx.fillRect(4, 5, 1, 1);
      ctx.fillRect(11, 5, 1, 1);
      ctx.fillRect(4, 11, 1, 1);
      ctx.fillRect(11, 11, 1, 1);
    });
  }

  // 印玺
  makeRelicSeal() {
    this.makeCanvasTexture('tex_relic_seal', 16, 16, (ctx) => {
      // 印钮
      ctx.fillStyle = '#9a9a9a';
      ctx.fillRect(6, 2, 4, 4);
      ctx.fillStyle = '#cacaca';
      ctx.fillRect(6, 2, 1, 3);
      // 印身
      ctx.fillStyle = '#7a7a7a';
      ctx.fillRect(3, 6, 10, 7);
      // 高光
      ctx.fillStyle = '#aaaaaa';
      ctx.fillRect(3, 6, 10, 1);
      ctx.fillRect(3, 6, 1, 6);
      // 印面（朱砂）
      ctx.fillStyle = '#a82e2e';
      ctx.fillRect(4, 12, 8, 2);
    });
  }

  // ——————————— 战斗 / HUD 贴图 ———————————

  // 玩家挥刀的扇形刀光（白光弧 + 末端淡出）
  makeBladeSlashTexture() {
    this.makeCanvasTexture('tex_blade_slash', 56, 56, (ctx, w, h) => {
      const cx = w / 2;
      const cy = h / 2;
      // 整体扇形（朝右，半角约 30°，半径 26）
      const r = 26;
      const a0 = -Math.PI / 5;
      const a1 = Math.PI / 5;
      // 渐变填充：刀身近白、远端淡蓝
      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
      grad.addColorStop(0.0, 'rgba(255,255,255,0.85)');
      grad.addColorStop(0.6, 'rgba(220,235,255,0.55)');
      grad.addColorStop(1.0, 'rgba(180,200,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const steps = 18;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const a = a0 + (a1 - a0) * t;
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      // 锐利刃线
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const midA = (a0 + a1) / 2;
      ctx.moveTo(cx + Math.cos(midA) * 4, cy + Math.sin(midA) * 4);
      ctx.lineTo(cx + Math.cos(midA) * (r - 2), cy + Math.sin(midA) * (r - 2));
      ctx.stroke();
    });
  }

  // 格挡光晕：青蓝色环带
  makeBlockShieldTexture() {
    this.makeCanvasTexture('tex_block_shield', 40, 40, (ctx, w, h) => {
      const cx = w / 2;
      const cy = h / 2;
      // 朝右的扇形护盾（半角 45°）
      const r = 18;
      const a0 = -Math.PI / 4;
      const a1 = Math.PI / 4;
      // 外圈青色
      ctx.strokeStyle = 'rgba(120,200,255,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a1);
      ctx.stroke();
      // 内圈白色
      ctx.strokeStyle = 'rgba(220,240,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 3, a0, a1);
      ctx.stroke();
      // 内填淡光
      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
      grad.addColorStop(0, 'rgba(120,200,255,0.0)');
      grad.addColorStop(0.7, 'rgba(120,200,255,0.18)');
      grad.addColorStop(1, 'rgba(120,200,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const steps = 16;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const a = a0 + (a1 - a0) * t;
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    });
  }

  // 红心（HUD 血量单位）
  makeHeartTexture() {
    this.makeCanvasTexture('tex_heart', 14, 12, (ctx) => {
      // 心形像素拼
      ctx.fillStyle = '#c81e2a';
      ctx.fillRect(2, 2, 4, 2);
      ctx.fillRect(8, 2, 4, 2);
      ctx.fillRect(1, 4, 12, 3);
      ctx.fillRect(2, 7, 10, 1);
      ctx.fillRect(3, 8, 8, 1);
      ctx.fillRect(4, 9, 6, 1);
      ctx.fillRect(5, 10, 4, 1);
      ctx.fillRect(6, 11, 2, 1);
      // 高光
      ctx.fillStyle = '#ff6878';
      ctx.fillRect(3, 3, 1, 1);
      ctx.fillRect(2, 4, 2, 1);
      // 暗边
      ctx.fillStyle = '#7a0e16';
      ctx.fillRect(11, 5, 1, 2);
      ctx.fillRect(10, 7, 1, 1);
    });
  }

  // 体力珠（小绿珠）
  makeStaminaPipTexture() {
    this.makeCanvasTexture('tex_stamina', 8, 8, (ctx) => {
      // 圆点
      ctx.fillStyle = '#3a8a3a';
      ctx.fillRect(2, 1, 4, 6);
      ctx.fillRect(1, 2, 6, 4);
      // 高光
      ctx.fillStyle = '#a8e8a8';
      ctx.fillRect(2, 2, 1, 1);
      ctx.fillRect(3, 1, 1, 1);
      // 暗
      ctx.fillStyle = '#1a4a1a';
      ctx.fillRect(5, 5, 1, 1);
      ctx.fillRect(4, 6, 2, 1);
    });
  }

  // 守卫被发现/警觉时头顶的"！"（红底白字）
  makeAlertMarkTexture() {
    this.makeCanvasTexture('tex_alert_mark', 10, 14, (ctx) => {
      // 黑描边
      ctx.fillStyle = '#000';
      ctx.fillRect(3, 0, 4, 14);
      ctx.fillRect(2, 1, 6, 12);
      // 红底
      ctx.fillStyle = '#e54b4b';
      ctx.fillRect(3, 1, 4, 12);
      // 白色"！"主干
      ctx.fillStyle = '#fffbe6';
      ctx.fillRect(4, 2, 2, 7);
      // 白点
      ctx.fillRect(4, 10, 2, 2);
    });
  }

  // 潜行图标（脚印）
  makeSneakIconTexture() {
    this.makeCanvasTexture('tex_icon_sneak', 14, 14, (ctx) => {
      ctx.fillStyle = '#7ae8e8';
      // 脚掌
      ctx.fillRect(4, 5, 6, 5);
      // 脚趾
      ctx.fillRect(3, 3, 2, 2);
      ctx.fillRect(6, 2, 2, 2);
      ctx.fillRect(9, 3, 2, 2);
      // 后跟描边
      ctx.fillStyle = '#3a8a8a';
      ctx.fillRect(4, 9, 6, 1);
    });
  }

  // ——————————— 粒子 / 特效贴图 ———————————

  // 金粉粒子（拾取时四散）
  makeDustParticle() {
    this.makeCanvasTexture('tex_dust', 6, 6, (ctx) => {
      const grad = ctx.createRadialGradient(3, 3, 0, 3, 3, 3);
      grad.addColorStop(0, 'rgba(255,243,184,1)');
      grad.addColorStop(0.5, 'rgba(212,175,55,0.85)');
      grad.addColorStop(1, 'rgba(212,175,55,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 6, 6);
    });
  }

  // 攻击溅火星（白蓝色）
  makeSparkParticle() {
    this.makeCanvasTexture('tex_spark', 5, 5, (ctx) => {
      const grad = ctx.createRadialGradient(2.5, 2.5, 0, 2.5, 2.5, 2.5);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.6, 'rgba(180,220,255,0.7)');
      grad.addColorStop(1, 'rgba(120,180,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 5, 5);
    });
  }

  // 受击红粒
  makeBloodParticle() {
    this.makeCanvasTexture('tex_blood', 5, 5, (ctx) => {
      const grad = ctx.createRadialGradient(2.5, 2.5, 0, 2.5, 2.5, 2.5);
      grad.addColorStop(0, 'rgba(255,80,80,1)');
      grad.addColorStop(0.6, 'rgba(180,30,30,0.85)');
      grad.addColorStop(1, 'rgba(120,10,10,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 5, 5);
    });
  }

  // 撤离门光环（青蓝色环）
  makeGlowRingTexture() {
    this.makeCanvasTexture('tex_glow_ring', 64, 64, (ctx, w, h) => {
      const cx = w / 2;
      const cy = h / 2;
      const grad = ctx.createRadialGradient(cx, cy, 18, cx, cy, 30);
      grad.addColorStop(0, 'rgba(122,232,232,0)');
      grad.addColorStop(0.5, 'rgba(122,232,232,0.55)');
      grad.addColorStop(0.9, 'rgba(60,160,180,0.18)');
      grad.addColorStop(1, 'rgba(60,160,180,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    });
  }

  // 脚印拖痕（半透明小点）
  makeFootstepTexture() {
    this.makeCanvasTexture('tex_footstep', 4, 4, (ctx) => {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(1, 0, 2, 4);
      ctx.fillRect(0, 1, 4, 2);
    });
  }

  // 屏幕暗角：四角向内的渐变蒙版（用于受击 / 心跳时叠加）
  makeVignetteTexture() {
    this.makeCanvasTexture('tex_vignette', 256, 256, (ctx, w, h) => {
      const cx = w / 2;
      const cy = h / 2;
      const grad = ctx.createRadialGradient(cx, cy, w * 0.3, cx, cy, w * 0.62);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.7, 'rgba(80,0,0,0.35)');
      grad.addColorStop(1, 'rgba(80,0,0,0.85)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    });
  }

  // Fog cloud texture: thick semi-transparent blob for atmospheric fog overlay
  makeFogTexture() {
    // Large white fog cloud - soft overlapping ellipses
    this.makeCanvasTexture('tex_fog_cloud', 320, 160, (ctx, w, h) => {
      const drawBlob = (cx, cy, rx, ry, alpha) => {
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
        grad.addColorStop(0, `rgba(240,245,255,${alpha})`);
        grad.addColorStop(0.3, `rgba(220,230,245,${alpha * 0.75})`);
        grad.addColorStop(0.6, `rgba(200,215,235,${alpha * 0.4})`);
        grad.addColorStop(1, 'rgba(180,200,220,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      };
      drawBlob(w * 0.25, h * 0.5, w * 0.34, h * 0.48, 0.55);
      drawBlob(w * 0.5, h * 0.45, w * 0.38, h * 0.44, 0.5);
      drawBlob(w * 0.75, h * 0.55, w * 0.3, h * 0.46, 0.4);
      drawBlob(w * 0.15, h * 0.6, w * 0.24, h * 0.38, 0.35);
      drawBlob(w * 0.6, h * 0.5, w * 0.42, h * 0.5, 0.3);
    });

    // Smaller white wisp for variety
    this.makeCanvasTexture('tex_fog_wisp', 160, 80, (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.48);
      grad.addColorStop(0, 'rgba(235,240,250,0.45)');
      grad.addColorStop(0.4, 'rgba(210,220,240,0.25)');
      grad.addColorStop(0.7, 'rgba(190,205,225,0.1)');
      grad.addColorStop(1, 'rgba(170,190,210,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    });
  }

  // 疾跑图标（>>）
  makeSprintIconTexture() {
    this.makeCanvasTexture('tex_icon_sprint', 14, 14, (ctx) => {
      ctx.fillStyle = '#f2c14e';
      // 第一个箭头
      ctx.fillRect(2, 4, 1, 1);
      ctx.fillRect(3, 5, 1, 1);
      ctx.fillRect(4, 6, 1, 1);
      ctx.fillRect(5, 7, 1, 1);
      ctx.fillRect(4, 8, 1, 1);
      ctx.fillRect(3, 9, 1, 1);
      ctx.fillRect(2, 10, 1, 1);
      // 第二个箭头
      ctx.fillRect(7, 4, 1, 1);
      ctx.fillRect(8, 5, 1, 1);
      ctx.fillRect(9, 6, 1, 1);
      ctx.fillRect(10, 7, 1, 1);
      ctx.fillRect(9, 8, 1, 1);
      ctx.fillRect(8, 9, 1, 1);
      ctx.fillRect(7, 10, 1, 1);
    });
  }

  // ——————————— LimeZu 角色动画注册 ———————————
  // LimeZu Modern Interiors v2.2 标准 sheet：384×32（24 帧 × 1 行）
  //   实测方向顺序：right(0-5) / up(6-11) / left(12-17) / down(18-23)
  //   每方向 6 帧；idle 与 run sheet 共用此布局
  // Hongfa hero sheet: 5 rows x 5 columns, 64x64 per frame.
  // Row 1 down, row 2 right, row 3 up, row 4 attack, row 5 hurt/down.
  registerHeroAnims() {
    const makeAnim = (key, start, end, frameRate = 10, repeat = -1) => {
      if (this.anims.exists(key)) return;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers('hero_hongfa', { start, end }),
        frameRate,
        repeat
      });
    };

    makeAnim('hero_idle_down', 0, 0, 1);
    makeAnim('hero_walk_down', 0, 4, 10);
    makeAnim('hero_idle_right', 5, 5, 1);
    makeAnim('hero_walk_right', 5, 9, 10);
    makeAnim('hero_idle_up', 10, 10, 1);
    makeAnim('hero_walk_up', 10, 14, 10);
    makeAnim('hero_attack', 15, 19, 12, 0);
    makeAnim('hero_hurt_down', 20, 24, 8, 0);

    const makeSwordAnim = (key, row, startCol, endCol, frameRate = 10, repeat = -1, force = false) => {
      if (force && this.anims.exists(key)) this.anims.remove(key);
      if (this.anims.exists(key)) return;
      const start = row * 4 + startCol;
      const end = row * 4 + endCol;
      const frames = this.anims.generateFrameNumbers('hero_sword', { start, end })
        .map((frame, index) => ({
          ...frame,
          duration: key.includes('_attack_') && index === 1 ? 120 : 0
        }));
      this.anims.create({
        key,
        frames,
        frameRate,
        repeat
      });
    };

    // Sword hero sheet: 12 rows x 4 columns, 64x64 per frame.
    // Rows 1-4: walk down/right/up/left; rows 5-8: idle down/right/up/left;
    // rows 9-12: attack down/right/up/left.
    makeSwordAnim('hero_sword_walk_down', 0, 0, 3, 10);
    makeSwordAnim('hero_sword_walk_right', 1, 0, 3, 10);
    makeSwordAnim('hero_sword_walk_up', 2, 0, 3, 10);
    makeSwordAnim('hero_sword_walk_left', 3, 0, 3, 10);
    makeSwordAnim('hero_sword_idle_down', 4, 0, 3, 4);
    makeSwordAnim('hero_sword_idle_right', 5, 0, 3, 4);
    makeSwordAnim('hero_sword_idle_up', 6, 0, 3, 4);
    makeSwordAnim('hero_sword_idle_left', 7, 0, 3, 4);
    makeSwordAnim('hero_sword_attack_down', 8, 0, 3, 10, 0, true);
    makeSwordAnim('hero_sword_attack_right', 9, 0, 3, 10, 0, true);
    makeSwordAnim('hero_sword_attack_up', 10, 0, 3, 10, 0, true);
    makeSwordAnim('hero_sword_attack_left', 11, 0, 3, 10, 0, true);

    // —— 持刀主角 (hero_knife): 12行×5列, 116×123每帧 ——
    // Row 0-3: walk_down/right/up/left (5帧)
    // Row 4-7: idle_down/right/up/left (4帧)
    // Row 8-11: attack_down/right/up/left (4帧)
    if (this.textures.exists('hero_knife')) {
      const makeKnifeAnim = (key, row, startCol, endCol, frameRate = 10, repeat = -1, force = false) => {
        if (force && this.anims.exists(key)) this.anims.remove(key);
        if (this.anims.exists(key)) return;
        const start = row * 4 + startCol;
        const end = row * 4 + endCol;
        const frames = this.anims.generateFrameNumbers('hero_knife', { start, end })
          .map((frame, index) => ({
            ...frame,
            duration: key.includes('_attack_') && index === 1 ? 120 : 0
          }));
        this.anims.create({
          key,
          frames,
          frameRate,
          repeat
        });
      };
      makeKnifeAnim('hero_knife_walk_down', 0, 0, 3, 10);
      makeKnifeAnim('hero_knife_walk_right', 1, 0, 3, 10);
      makeKnifeAnim('hero_knife_walk_up', 2, 0, 3, 10);
      makeKnifeAnim('hero_knife_walk_left', 3, 0, 3, 10);
      makeKnifeAnim('hero_knife_idle_down', 4, 0, 3, 4);
      makeKnifeAnim('hero_knife_idle_right', 5, 0, 3, 4);
      makeKnifeAnim('hero_knife_idle_up', 6, 0, 3, 4);
      makeKnifeAnim('hero_knife_idle_left', 7, 0, 3, 4);
      makeKnifeAnim('hero_knife_attack_down', 8, 0, 3, 10, 0, true);
      makeKnifeAnim('hero_knife_attack_right', 9, 0, 3, 10, 0, true);
      makeKnifeAnim('hero_knife_attack_up', 10, 0, 3, 10, 0, true);
      makeKnifeAnim('hero_knife_attack_left', 11, 0, 3, 10, 0, true);
    }

    // —— Bow hero animations (individual image frames) ——
    if (this.textures.exists('hero_bow_1')) {
      // Idle animation: frames 1 and 2 (holding bow at side) — legacy non-directional
      if (!this.anims.exists('hero_bow_idle')) {
        this.anims.create({
          key: 'hero_bow_idle',
          frames: [
            { key: 'hero_bow_1' },
            { key: 'hero_bow_2' }
          ],
          frameRate: 3,
          repeat: -1
        });
      }
      // Shoot animation: frames 1 -> 3 -> 4 (draw bow, release)
      if (!this.anims.exists('hero_bow_shoot')) {
        this.anims.create({
          key: 'hero_bow_shoot',
          frames: [
            { key: 'hero_bow_1', duration: 80 },
            { key: 'hero_bow_3', duration: 200 },
            { key: 'hero_bow_4', duration: 120 },
            { key: 'hero_bow_1', duration: 80 }
          ],
          frameRate: 10,
          repeat: 0
        });
      }
    }

    // —— Bow hero 4-direction walk / idle (pixel-art frames in walk_bow/) ——
    if (this.textures.exists('hero_bow_walk_down_1')) {
      const dirs = ['down', 'up', 'left', 'right'];
      for (const d of dirs) {
        const walkKey = `hero_bow_walk_${d}`;
        if (!this.anims.exists(walkKey)) {
          this.anims.create({
            key: walkKey,
            frames: [1, 2, 3, 4, 5, 6].map(i => ({ key: `hero_bow_walk_${d}_${i}` })),
            frameRate: 10,
            repeat: -1
          });
        }
        // Static idle per direction = first frame of walk cycle
        const idleKey = `hero_bow_idle_${d}`;
        if (!this.anims.exists(idleKey)) {
          this.anims.create({
            key: idleKey,
            frames: [{ key: `hero_bow_walk_${d}_1` }],
            frameRate: 1,
            repeat: -1
          });
        }
        // Per-direction shoot animation reuses walk frames so sprite size stays consistent.
        // 3 (raise/draw) -> 5 (release) -> 1 (recover) feels like a quick bow loose.
        const shootKey = `hero_bow_shoot_${d}`;
        if (!this.anims.exists(shootKey)) {
          this.anims.create({
            key: shootKey,
            frames: [
              { key: `hero_bow_walk_${d}_3`, duration: 90 },
              { key: `hero_bow_walk_${d}_5`, duration: 140 },
              { key: `hero_bow_walk_${d}_1`, duration: 90 }
            ],
            frameRate: 12,
            repeat: 0
          });
        }
      }
    }

    const bladeSkillFrameDurations = {
      6: 190,  // fifth from last
      7: 210,  // fourth from last
      8: 230,  // third from last
      10: 170  // final frame
    };
    const makeBladeSkillFrames = (textureKey) => (
      this.anims.generateFrameNumbers(textureKey, { start: 0, end: 10 })
        .map((frame, index) => ({
          ...frame,
          duration: bladeSkillFrameDurations[index] || 0
        }))
    );

    if (!this.anims.exists('hero_blade_skill_anim')) {
      this.anims.create({
        key: 'hero_blade_skill_anim',
        frames: makeBladeSkillFrames('hero_blade_skill'),
        frameRate: 8,
        repeat: 0
      });
    }
    if (!this.anims.exists('hero_blade_skill_right_anim')) {
      this.anims.create({
        key: 'hero_blade_skill_right_anim',
        frames: makeBladeSkillFrames('hero_blade_skill_right'),
        frameRate: 8,
        repeat: 0
      });
    }

    // —— 第二技能（hero skill2）22 帧动画 ——
    if (this.textures.exists('hero_skill2_right') && this.textures.exists('hero_skill2_left')) {
      const makeSkill2Frames = (textureKey) => (
        this.anims.generateFrameNumbers(textureKey, { start: 0, end: 21 })
      );
      for (const [key, tex] of [
        ['hero_skill2_right_anim', 'hero_skill2_right'],
        ['hero_skill2_left_anim',  'hero_skill2_left']
      ]) {
        if (this.anims.exists(key)) this.anims.remove(key);
        this.anims.create({
          key,
          frames: makeSkill2Frames(tex),
          frameRate: 8,
          repeat: 0
        });
      }
    }
  }

  registerCuratorAnims() {
    if (!this.textures.exists('curator_idle') || this.anims.exists('curator_idle_down')) return;
    this.anims.create({
      key: 'curator_idle_down',
      frames: this.anims.generateFrameNumbers('curator_idle', { start: 0, end: 3 }),
      frameRate: 4,
      repeat: -1
    });
  }

  // High-quality enemy spritesheet animations (229×229 per frame, 5 cols × 6 rows).
  // Layout: Row1=walk_down, Row2=walk_right, Row3=walk_up, Row4=walk_left, Row5=attack, Row6=hurt
  registerEnemyAnims() {
    const dirs = [
      { name: 'down',  row: 0 },
      { name: 'right', row: 1 },
      { name: 'up',    row: 2 },
      { name: 'left',  row: 3 }
    ];

    if (this.textures.exists('enemy_thug_blackmarket')) {
      const makeThugAnim = (key, row, startCol, endCol, frameRate = 10, repeat = -1, force = true) => {
        if (force && this.anims.exists(key)) this.anims.remove(key);
        if (this.anims.exists(key)) return;
        const start = row * 6 + startCol;
        const end = row * 6 + endCol;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers('enemy_thug_blackmarket', { start, end }),
          frameRate,
          repeat
        });
      };

      for (const { name, row } of dirs) {
        makeThugAnim(`thug_idle_${name}`, row, 0, 0, 1);
        makeThugAnim(`thug_walk_${name}`, row, 0, 3, 6);
        makeThugAnim(`thug_run_${name}`, row + 4, 0, 3, 8);
        makeThugAnim(`thug_attack_${name}`, row + 8, 0, 3, 7, 0);
      }
      makeThugAnim('thug_death', 12, 0, 5, 6, 0);
    }

    const sheets = [
      { key: 'enemy_guard', prefix: 'guard' },
      ...(this.textures.exists('enemy_thug_blackmarket') ? [] : [{ key: 'enemy_thug',  prefix: 'thug'  }]),
      { key: 'enemy_sailor', prefix: 'sailor' }
    ];
    for (const { key, prefix } of sheets) {
      if (!this.textures.exists(key)) continue;
      // Walk animations (4 directions, 5 frames each)
      for (const { name, row } of dirs) {
        const start = row * 5;
        const end = start + 4;
        // idle = first frame of walk direction
        const idleKey = `${prefix}_idle_${name}`;
        if (!this.anims.exists(idleKey)) {
          this.anims.create({
            key: idleKey,
            frames: this.anims.generateFrameNumbers(key, { start, end: start }),
            frameRate: 1,
            repeat: -1
          });
        }
        // walk/run animation
        const walkKey = `${prefix}_walk_${name}`;
        if (!this.anims.exists(walkKey)) {
          this.anims.create({
            key: walkKey,
            frames: this.anims.generateFrameNumbers(key, { start, end }),
            frameRate: 7,
            repeat: -1
          });
        }
      }
      // Attack animation (row 5, frames 20-24)
      const atkKey = `${prefix}_attack`;
      if (!this.anims.exists(atkKey)) {
        this.anims.create({
          key: atkKey,
          frames: this.anims.generateFrameNumbers(key, { start: 20, end: 24 }),
          frameRate: 8,
          repeat: 0
        });
      }
      // Hurt animation (row 6, frames 25-29)
      const hurtKey = `${prefix}_hurt`;
      if (!this.anims.exists(hurtKey)) {
        this.anims.create({
          key: hurtKey,
          frames: this.anims.generateFrameNumbers(key, { start: 25, end: 29 }),
          frameRate: 6,
          repeat: 0
        });
      }
    }
  }

  // —— Nightkeeper 新版守卫 / 船员动画（每方向 6 张独立 PNG）——
  // 资产：assets/characters/hero/guard/{down|left|right|up}{1..6}.png
  //       assets/characters/hero/pirates/{down|left|right|up}{1..6}.png
  // 动画键：nkguard_walk_<dir> / nkguard_idle_<dir>
  //         nkpirate_walk_<dir> / nkpirate_idle_<dir>
  registerNkGuardAnims() {
    const dirs = ['down', 'left', 'right', 'up'];
    const sets = [
      { prefix: 'nk_guard',  animPrefix: 'nkguard'  },
      { prefix: 'nk_pirate', animPrefix: 'nkpirate' }
    ];
    for (const { prefix, animPrefix } of sets) {
      // 检查首帧是否成功加载，没有就跳过
      if (!this.textures.exists(`${prefix}_down_1`)) continue;
      for (const dir of dirs) {
        const frameKeys = [];
        for (let i = 1; i <= 6; i++) {
          frameKeys.push({ key: `${prefix}_${dir}_${i}` });
        }
        // walk: 6 帧循环
        const walkKey = `${animPrefix}_walk_${dir}`;
        if (!this.anims.exists(walkKey)) {
          this.anims.create({
            key: walkKey,
            frames: frameKeys,
            frameRate: 9,
            repeat: -1
          });
        }
        // idle: 仅第 1 帧（站立）
        const idleKey = `${animPrefix}_idle_${dir}`;
        if (!this.anims.exists(idleKey)) {
          this.anims.create({
            key: idleKey,
            frames: [{ key: `${prefix}_${dir}_1` }],
            frameRate: 1,
            repeat: -1
          });
        }
      }
    }
  }

  // LimeZu character animations.
  registerLZAnims() {
    // 实测精灵表行序（base 是该方向首帧索引）
    const dirs = [
      { name: 'right', base: 0 },
      { name: 'up',    base: 6 },
      { name: 'left',  base: 12 },
      { name: 'down',  base: 18 }
    ];
    // 所有角色一致：每方向 6 帧
    const charSpec = {
      adam:   { hasRun: true  },
      amelia: { hasRun: false },
      alex:   { hasRun: false },
      bob:    { hasRun: false }
    };
    for (const ch of Object.keys(charSpec)) {
      const spec = charSpec[ch];
      const idleKey = `lz_${ch}_idle`;
      if (!this.textures.exists(idleKey)) continue;
      for (const d of dirs) {
        const base = d.base;
        const end  = base + 5; // 每方向 6 帧
        // idle 动画
        const idleAnim = `${ch}_idle_${d.name}`;
        if (!this.anims.exists(idleAnim)) {
          this.anims.create({
            key: idleAnim,
            frames: this.anims.generateFrameNumbers(idleKey, { start: base, end }),
            frameRate: 6,
            repeat: -1
          });
        }
        // run 动画
        if (spec.hasRun && this.textures.exists(`lz_${ch}_run`)) {
          const runAnim = `${ch}_run_${d.name}`;
          if (!this.anims.exists(runAnim)) {
            this.anims.create({
              key: runAnim,
              frames: this.anims.generateFrameNumbers(`lz_${ch}_run`, { start: base, end }),
              frameRate: 12,
              repeat: -1
            });
          }
        } else {
          // NPC 没有专门的 run 表：将 run 别名指向 idle
          const runAlias = `${ch}_run_${d.name}`;
          if (!this.anims.exists(runAlias)) {
          this.anims.create({
              key: runAlias,
              frames: this.anims.generateFrameNumbers(idleKey, { start: base, end }),
              frameRate: 9,
              repeat: -1
            });
          }
        }
      }
    }

    // —— Boss 动画注册 ——
    this._registerBossAnims();
  }

  _registerBossAnims() {
    // idle（7 帧循环）
    if (!this.anims.exists('boss_idle') && this.textures.exists('boss_idle_1')) {
      this.anims.create({
        key: 'boss_idle',
        frames: Array.from({ length: 7 }, (_, i) => ({ key: `boss_idle_${i + 1}` })),
        frameRate: 7,
        repeat: -1,
      });
    }
    // walk 四向（每方向 7 帧循环）
    const dirs = ['down', 'left', 'right', 'up'];
    for (const d of dirs) {
      const animKey = `boss_walk_${d}`;
      if (!this.anims.exists(animKey) && this.textures.exists(`boss_walk_${d}_1`)) {
        this.anims.create({
          key: animKey,
          frames: Array.from({ length: 7 }, (_, i) => ({ key: `boss_walk_${d}_${i + 1}` })),
          frameRate: 10,
          repeat: -1,
        });
      }
    }
    // skill1/2/3（每技能 10 帧不循环）
    for (let s = 1; s <= 3; s++) {
      const animKey = `boss_skill${s}`;
      if (!this.anims.exists(animKey) && this.textures.exists(`boss_skill${s}_1`)) {
        this.anims.create({
          key: animKey,
          frames: Array.from({ length: 10 }, (_, i) => ({ key: `boss_skill${s}_${i + 1}` })),
          frameRate: 12,
          repeat: 0,
        });
      }
    }
  }
}
