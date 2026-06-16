// composeMuseumMap.js
// ——————————————————————————————————————————————————
// 关卡组装器：把多个房间模板紧致拼接成"垂直长条"复合地图
//
// ★ 紧致化目标 ★：
//   - 整张地图宽度 = 单房间宽度（20 瓦片），完全消除左右黑边
//   - 房间之间用 8 格宽 × 6 格高 的"束腰走廊"连接（居中对齐房间门洞）
//   - 地图最外圈封一道连续墙体 → 玩家任何情况下都无法越界（终极保险）
//
// —————————— 布局 ——————————
//
//   X = 0~19（20 列）                                 Y
//   ┌────────────────────┐                           0
//   │     room_06        │   储藏间（最深处）
//   │     20 × 20        │
//   ├────────────────────┤                           20
//   │  ▓▓▓▓ C2 ▓▓▓▓     │   走廊 8×6（X=6~13，中线 9~10 对齐房间 9~10 门洞）
//   ├────────────────────┤                           26
//   │     room_03        │   罗盘大厅（中转）
//   │     20 × 20        │
//   ├────────────────────┤                           46
//   │  ▓▓▓▓ C1 ▓▓▓▓     │
//   ├────────────────────┤                           52
//   │     room_01        │   中央展柜（玩家出生）
//   │     20 × 20        │
//   ├────────────────────┤                           72
//   │  ▓▓▓▓ C0 ▓▓▓▓     │   走廊尽头 = 撤离点
//   └────────────────────┘                           78
//
//   总尺寸：20 × 78（640 × 2496 像素）— 高度跨度 ~3.5 屏，提供路径感
// ——————————————————————————————————————————————————

import { getRoomTemplate } from '../data/roomTemplates.js';

// 房间放置（紧致：x=0 紧贴左边）
const PLACEMENTS = [
  { id: 'room_06', origin: { x: 0, y: 0  } },  // 储藏间
  { id: 'room_03', origin: { x: 0, y: 26 } },  // 罗盘大厅
  { id: 'room_01', origin: { x: 0, y: 52 } }   // 中央展柜
];

// 走廊定义：6 格宽（X=7~12，中线 9~10 对齐房间门洞 tile 9~10）
//   注：x=7,w=6 → 占 X=7,8,9,10,11,12，对齐感最好
const CORRIDOR_X = 7;
const CORRIDOR_W = 6;

const CORRIDORS = [
  // C2: room_06 南门 ↔ room_03 北门（Y=20~25, 高 6）
  {
    id: 'c_06_03',
    rect:  { x: CORRIDOR_X, y: 20, w: CORRIDOR_W, h: 6 },
    walls: [
      { x: CORRIDOR_X - 1,        y: 20, w: 1, h: 6 }, // 西墙
      { x: CORRIDOR_X + CORRIDOR_W, y: 20, w: 1, h: 6 } // 东墙
    ]
  },
  // C1: room_03 南门 ↔ room_01 北门（Y=46~51）
  {
    id: 'c_03_01',
    rect:  { x: CORRIDOR_X, y: 46, w: CORRIDOR_W, h: 6 },
    walls: [
      { x: CORRIDOR_X - 1,        y: 46, w: 1, h: 6 },
      { x: CORRIDOR_X + CORRIDOR_W, y: 46, w: 1, h: 6 }
    ]
  },
  // C0: room_01 南门 → 撤离点（Y=72~77，南端封死）
  {
    id: 'c_01_exit',
    rect:  { x: CORRIDOR_X, y: 72, w: CORRIDOR_W, h: 6 },
    walls: [
      { x: CORRIDOR_X - 1,        y: 72, w: 1, h: 6 },
      { x: CORRIDOR_X + CORRIDOR_W, y: 72, w: 1, h: 6 },
      { x: CORRIDOR_X,            y: 77, w: CORRIDOR_W, h: 1 } // 南端封板
    ]
  }
];

// 复合地图整体尺寸
const MAP_W = 20;
const MAP_H = 78;

/**
 * 把房间模板的局部坐标平移到世界坐标
 */
function offsetList(list, origin) {
  if (!list) return [];
  return list.map((r) => {
    if (typeof r.w === 'number' || typeof r.h === 'number') {
      return { x: r.x + origin.x, y: r.y + origin.y, w: r.w || 1, h: r.h || 1 };
    }
    return { x: r.x + origin.x, y: r.y + origin.y };
  });
}

/**
 * 添加地图最外圈"边界封死墙"——四面厚墙，玩家无论如何都越不出去（终极保险）
 *
 * @param {Array} walls  墙体收集数组
 * @param {number} W     地图宽（瓦片）
 * @param {number} H     地图高（瓦片）
 */
function addOuterBorder(walls, W, H) {
  const T = 1; // 厚度 1 格（够大约 32 像素，玩家 body 10 像素无法穿过）
  walls.push({ x: 0,          y: 0,         w: W, h: T });          // 上边
  walls.push({ x: 0,          y: H - T,     w: W, h: T });          // 下边
  walls.push({ x: 0,          y: 0,         w: T, h: H });          // 左边
  walls.push({ x: W - T,      y: 0,         w: T, h: H });          // 右边
}

/**
 * 主入口：组装紧致化复合博物馆地图
 */
export function composeMuseumMap() {
  const walls = [];
  const obstacles = [];
  const placeable = [];
  const children = [];
  let safe = null;

  // —— 0) 最外圈封死墙（终极保险）——
  addOuterBorder(walls, MAP_W, MAP_H);

  // —— 1) 处理每个房间贴图 ——
  for (const p of PLACEMENTS) {
    const tpl = getRoomTemplate(p.id);
    if (!tpl) continue;
    children.push({
      id: tpl.id,
      origin: p.origin,
      tilesW: tpl.tilesW,
      tilesH: tpl.tilesH
    });
    walls.push(...offsetList(tpl.walls, p.origin));
    obstacles.push(...offsetList(tpl.obstacles, p.origin));
    // ★ 给 placeable 点加 roomId 标签，用于守卫巡逻分组（每个守卫只在自己房间内活动）
    const roomPlaceable = offsetList(tpl.placeable, p.origin).map((pt) => ({
      ...pt,
      roomId: p.id
    }));
    placeable.push(...roomPlaceable);
    if (tpl.special && tpl.special.safe) {
      safe = { x: tpl.special.safe.x + p.origin.x, y: tpl.special.safe.y + p.origin.y };
    }
  }

  // —— 2) 走廊：添加两侧墙体 + 候选格 + 房间外区域填墙 ——
  for (const c of CORRIDORS) {
    walls.push(...c.walls);
    const r = c.rect;
    // 走廊范围两侧（X=0 ~ CORRIDOR_X-1 和 X=CORRIDOR_X+CORRIDOR_W+1 ~ MAP_W-1）
    // 这两片在视觉上是地图外的"无房间"区域，补成实心墙挡住
    // 走廊横向范围：CORRIDOR_X-1 (墙) ~ CORRIDOR_X+CORRIDOR_W (墙)
    // 即 X=6 (墙) 和 X=13 (墙)，所以 X=0~5 和 X=14~19 是需要填实的死区
    const yStart = r.y;
    const yEnd = r.y + r.h;
    // 左死区
    if (CORRIDOR_X - 1 > 0) {
      walls.push({ x: 0, y: yStart, w: CORRIDOR_X - 1, h: r.h });
    }
    // 右死区
    const rightStart = CORRIDOR_X + CORRIDOR_W + 1; // = 14
    if (rightStart < MAP_W) {
      walls.push({ x: rightStart, y: yStart, w: MAP_W - rightStart, h: r.h });
    }
    // 走廊中线巡逻点（仅作为放置候选，不参与守卫巡逻 → roomId='__corridor__'）
    const midX = Math.floor(r.x + r.w / 2);
    for (let yy = r.y + 1; yy < r.y + r.h - 1; yy += 2) {
      placeable.push({ x: midX, y: yy, roomId: '__corridor__' });
    }
  }

  // —— 3) 玩家出生 / 撤离锚点 ——
  const room01 = PLACEMENTS.find((p) => p.id === 'room_01');
  const spawn = room01
    ? { x: 10 + room01.origin.x, y: 17 + room01.origin.y }
    : { x: 10, y: 65 };

  // 撤离点设在 C0 走廊尽头（X=10, Y=76）
  const exit = { x: 10, y: 76 };

  // ★ 房间区域信息（供守卫巡逻硬约束使用）——每个房间是一个金牌区：
  // 守卫只能在自己房间的矩形范围内移动，走出则被拉回。内缩 1 格避开墙到身体反弹卡额
  const roomBounds = {};
  for (const p of PLACEMENTS) {
    const tpl = getRoomTemplate(p.id);
    if (!tpl) continue;
    roomBounds[p.id] = {
      x: p.origin.x + 1,
      y: p.origin.y + 1,
      w: tpl.tilesW - 2,
      h: tpl.tilesH - 2
    };
  }

  return {
    id: 'composed_museum',
    name: '夜行者复合博物馆',
    tilesW: MAP_W,
    tilesH: MAP_H,
    tags: ['composed', 'museum'],
    children,
    corridors: CORRIDORS.map((c) => ({ ...c.rect })),
    roomBounds,
    walls,
    obstacles,
    placeable,
    special: {
      playerSpawn: spawn,
      exit,
      ...(safe ? { safe } : {})
    }
  };
}

export default composeMuseumMap;