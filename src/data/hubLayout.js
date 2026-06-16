// HubLayout - 行动前室房间布局（背景图驱动版本）
//
// 设计思路：
//   · 整个大厅由一张精美的预渲染背景图 (public/assets/hub/hub_cover.png) 直接铺满
//   · 所有视觉细节（地板、墙、家具、灯笼、装饰）都画在背景图里
//   · 代码侧只负责三件事：
//       1) 交互锚点 (HUB_ANCHORS) —— 委托榜/配装台/保险柜/任务门/馆长/玩家初始
//       2) 碰撞矩形 (HUB_COLLIDERS) —— 玩家不能踩进去的家具/墙体
//       3) 玩家活动边界 (HUB_PHYS_BOUNDS) —— 整个画布外圈
//
// 坐标系：屏幕像素坐标，画布 1280 × 720，背景图按 setDisplaySize(1280, 720) 铺满
// 所有数值都是基于 hub_cover.png 视觉参考定位（可在游戏中按 F1 进入调试模式实时调整）
//
// v3 调整：画布从 960×540 等比放大到 1280×720（×4/3），所有锚点/碰撞/边界同步缩放，
//          这样大厅可以铺满整个画面，不再出现四周黑边，UI 文字也更清晰。

export const ROOM_W = 1280;
export const ROOM_H = 720;

// —— 交互锚点（屏幕像素坐标，玩家走到此处会触发交互提示）——
// 锚点放在"玩家能站立的开放地面"，靠近背景图标签但不与家具碰撞框重叠
export const HUB_ANCHORS = {
  // 4 个交互台（玩家从中央地毯往四角走的"门口"位置）
  contract: { x: 244, y: 352 },   // 委托榜（西北：地毯西北角，公告板前的过道）
  loadout:  { x: 1020, y: 352 },   // 配装台（东北：地毯东北角，工作台前的过道）
  vault:    { x: 236, y: 446 },   // 保险柜（西南：地毯西南角，柜门前）
  depart:   { x: 1038, y: 420 },   // 任务门（东南：地毯东南角，红帘门前）

  // 馆长（馆长桌前方一格，玩家从地毯北上即可触发）
  curator:  { x: 640, y: 427 },

  // 玩家初始位置（中央地毯偏南）
  player:   { x: 640, y: 560 },
};

// —— 碰撞矩形（玩家不能进入的区域）——
// 设计原则：只标"家具实体的前脸"（玩家正面会撞到的最小区域），
// 给玩家从中央地毯走向 4 个角的所有通道留足空间（至少 80 像素宽）
export const HUB_COLLIDERS = [
  // ===== 四面墙（背景图边缘的石砖墙）=====
  { x: 0,    y: 0,   w: 1280, h: 80,  tag: 'wall_top' },     // 顶墙
  { x: 0,    y: 666, w: 1280, h: 54,  tag: 'wall_bottom' },  // 底墙
  { x: 0,    y: 0,   w: 54,   h: 720, tag: 'wall_left' },    // 左墙
  { x: 1226, y: 0,   w: 54,   h: 720, tag: 'wall_right' },   // 右墙

  // ===== 北墙书架（仅顶部一条，不挡通道）=====
  { x: 293, y: 80,  w: 720, h: 120, tag: 'shelf_north' },   // 北墙整排书架/橱柜（高度只到 y=200）

  // ===== 西北：委托榜公告板（仅墙边狭长一块）=====
  { x: 80,  y: 187, w: 267, h: 147, tag: 'contract_board' }, // 公告板（避开锚点 373,413）

  // ===== 东北：配装台工作台（仅墙边狭长一块）=====
  { x: 933, y: 187, w: 267, h: 147, tag: 'loadout_rack' },   // 配装架（避开锚点 927,413）

  // ===== 中央：馆长办公桌（窄长条，桌子前留出对话位置）=====
  { x: 520, y: 307, w: 240, h: 80,  tag: 'curator_desk' },   // 桌子前脸

  // ===== 西南：保险柜（柜体）=====
  { x: 80,  y: 613, w: 267, h: 67,  tag: 'vault_safe' },     // 保险柜底座

  // ===== 东南：任务门红帘 + 装饰桌（避开锚点 927,567）=====
  { x: 933, y: 613, w: 267, h: 67,  tag: 'depart_door' },    // 任务门门廊
];

// —— 物理世界边界（玩家整体活动范围）——
export const HUB_PHYS_BOUNDS = {
  x: 40,
  y: 67,
  w: 1200,
  h: 613,
};

// —— 锚点交互触发距离（加大到 120 让交互更宽容）——
export const HUB_INTERACT_RADIUS = 120;

// —— 旧 tilemap 数据保留导出（避免外部引用报错）——
export const HUB_GRID = { cols: 32, rows: 16, tileSize: 32, offsetX: 0, offsetY: 0 };

export const HUB_MAP_SOURCE = { w: 1672, h: 941 };

const scaleX = (value) => Math.round((value / HUB_MAP_SOURCE.w) * ROOM_W);
const scaleY = (value) => Math.round((value / HUB_MAP_SOURCE.h) * ROOM_H);
const fromSourceRect = (rect) => ({
  x: scaleX(rect.x),
  y: scaleY(rect.y),
  w: scaleX(rect.w),
  h: scaleY(rect.h),
  tag: rect.tag,
});

const HUB_GODOT_COLLIDER_SOURCE_RECTS = [
  { x: 64, y: 184, w: 56, h: 127, tag: 'godot_collision_01' },
  { x: 50, y: 422, w: 59, h: 82, tag: 'godot_collision_02' },
  { x: 77, y: 758, w: 33, h: 36, tag: 'godot_collision_03' },
  { x: 163, y: 616, w: 291, h: 110, tag: 'godot_collision_04' },
  { x: 661, y: 307, w: 365, h: 98, tag: 'godot_collision_05' },
  { x: 810, y: 275, w: 53, h: 30, tag: 'godot_collision_06' },
  { x: 1153, y: 157, w: 53, h: 144, tag: 'godot_collision_07' },
  { x: 1215, y: 290, w: 237, h: 121, tag: 'godot_collision_08' },
  { x: 1471, y: 322, w: 51, h: 61, tag: 'godot_collision_09' },
  { x: 1558, y: 196, w: 59, h: 116, tag: 'godot_collision_10' },
  { x: 1568, y: 439, w: 54, h: 64, tag: 'godot_collision_11' },
  { x: 1560, y: 749, w: 39, h: 44, tag: 'godot_collision_12' },
  { x: 1232, y: 715, w: 253, h: 80, tag: 'godot_collision_13' },
  { x: 1228, y: 797, w: 34, h: 36, tag: 'godot_collision_14' },
  { x: 1448, y: 798, w: 41, h: 37, tag: 'godot_collision_15' },
  { x: 1490, y: 748, w: 51, h: 66, tag: 'godot_collision_16' },
  { x: 1168, y: 768, w: 53, h: 48, tag: 'godot_collision_17' },
  { x: 190, y: 306, w: 56, h: 97, tag: 'godot_collision_18' },
  { x: 218, y: 286, w: 234, h: 54, tag: 'godot_collision_19' },
  { x: 252, y: 345, w: 33, h: 42, tag: 'godot_collision_20' },
  { x: 310, y: 343, w: 37, h: 28, tag: 'godot_collision_21' },
  { x: 371, y: 343, w: 39, h: 38, tag: 'godot_collision_22' },
  { x: 419, y: 343, w: 42, h: 41, tag: 'godot_collision_23' },
  { x: 458, y: 293, w: 50, h: 111, tag: 'godot_collision_24' },
  { x: 469, y: 194, w: 58, h: 106, tag: 'godot_collision_25' },
  { x: 154, y: 326, w: 26, h: 47, tag: 'godot_collision_26' },
  { x: 48, y: 132, w: 1572, h: 94, tag: 'godot_collision_27' },
  { x: 532, y: 197, w: 57, h: 53, tag: 'godot_collision_28' },
  { x: 603, y: 199, w: 131, h: 56, tag: 'godot_collision_29' },
  { x: 937, y: 212, w: 119, h: 38, tag: 'godot_collision_30' },
  { x: 1075, y: 207, w: 61, h: 43, tag: 'godot_collision_31' },
  { x: 1487, y: 199, w: 39, h: 43, tag: 'godot_collision_32' },
  { x: 142, y: 191, w: 47, h: 47, tag: 'godot_collision_33' },
  { x: 7, y: 152, w: 39, h: 767, tag: 'godot_collision_34' },
  { x: 1624, y: 144, w: 43, h: 777, tag: 'godot_collision_35' },
];

export const HUB_GODOT_COLLIDERS = HUB_GODOT_COLLIDER_SOURCE_RECTS.map(fromSourceRect);

const HUB_OCCLUSION_SOURCE_RECTS = [
  { x: 49, y: 371, w: 60, h: 49, tag: 'godot_adjust_01' },
  { x: 163, y: 516, w: 289, h: 97, tag: 'godot_adjust_02_vault_front' },
  { x: 806, y: 222, w: 57, h: 52, tag: 'godot_adjust_03_chair' },
  { x: 655, y: 249, w: 151, h: 56, tag: 'godot_adjust_04_desk_left' },
  { x: 866, y: 249, w: 159, h: 56, tag: 'godot_adjust_05_desk_right' },
  { x: 1567, y: 356, w: 55, h: 81, tag: 'godot_adjust_06_right_plant' },
  { x: 1232, y: 534, w: 245, h: 177, tag: 'godot_adjust_07_depart_gate' },
  { x: 1478, y: 565, w: 48, h: 139, tag: 'godot_adjust_08_depart_sign' },
  { x: 1497, y: 666, w: 40, h: 79, tag: 'godot_adjust_09_depart_post' },
  { x: 1560, y: 663, w: 38, h: 82, tag: 'godot_adjust_10_lamp' },
  { x: 1184, y: 572, w: 45, h: 137, tag: 'godot_adjust_11_depart_lamp' },
  { x: 1162, y: 708, w: 56, h: 57, tag: 'godot_adjust_12_depart_post' },
  { x: 76, y: 662, w: 37, h: 96, tag: 'godot_adjust_13_left_lamp' },
  { x: 155, y: 245, w: 32, h: 64, tag: 'godot_adjust_14_contract_lamp' },
  { x: 52, y: 902, w: 529, h: 39, tag: 'godot_adjust_15' },
  { x: 537, y: 872, w: 44, h: 38, tag: 'godot_adjust_16' },
  { x: 1086, y: 872, w: 44, h: 68, tag: 'godot_adjust_17' },
  { x: 1130, y: 904, w: 533, h: 34, tag: 'godot_adjust_18' },
  { x: 580, y: 901, w: 554, h: 36, tag: 'godot_adjust_19' },
];

export const HUB_OCCLUSION_REGIONS = HUB_OCCLUSION_SOURCE_RECTS.map(fromSourceRect);
