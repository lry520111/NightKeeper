// composeShipMap.js
// ——————————————————————————————————————————————————
// Smuggler Ship "沉鲸号" map composer — Full-map PNG version
//
// Uses a single pre-rendered full map image (ship_full.png, 1070×1470px)
// Collision data imported DIRECTLY from Godot annotations JSON in PIXEL coords.
// Source: ship_full_20260617_184234_230_annotations.json
//
// Image: 1070 × 1470 px
// Tile size: 32px → effective grid: ~33.4 × 45.9 tiles
// We use MAP_W=34, MAP_H=46 tiles (1088×1472 world px)
//
// IMPORTANT: walls[] uses PIXEL coordinates (wallsInPixels: true).
//   MuseumScene addWall detects this and skips tile→pixel conversion.
// ——————————————————————————————————————————————————

const TILE = 32;
const MAP_W = 34;
const MAP_H = 46;

// ===== Collision Walls =====
// Directly from annotations JSON collision layer — PIXEL coordinates.
// 88 rectangle shapes + 3 polygons decomposed into 24 rects = 112 total.
// Players CANNOT move through these areas.
function generateWalls() {
  return [
    // --- 88 Rectangle collision shapes (exact pixel bounds) ---
    { x: 138, y: 665, w: 72, h: 118 },
    { x: 236, y: 3, w: 572, h: 95 },
    { x: 822, y: 230, w: 41, h: 162 },
    { x: 825, y: 446, w: 29, h: 95 },
    { x: 868, y: 228, w: 179, h: 31 },
    { x: 1030, y: 259, w: 23, h: 268 },
    { x: 374, y: 328, w: 57, h: 41 },
    { x: 287, y: 383, w: 58, h: 37 },
    { x: 371, y: 458, w: 60, h: 40 },
    { x: 633, y: 463, w: 66, h: 32 },
    { x: 633, y: 337, w: 63, h: 29 },
    { x: 728, y: 383, w: 57, h: 29 },
    { x: 492, y: 705, w: 86, h: 69 },
    { x: 1001, y: 958, w: 37, h: 78 },
    { x: 992, y: 1039, w: 43, h: 57 },
    { x: 811, y: 909, w: 92, h: 32 },
    { x: 952, y: 904, w: 83, h: 28 },
    { x: 506, y: 1286, w: 60, h: 35 },
    { x: 310, y: 1094, w: 15, h: 123 },
    { x: 14, y: 861, w: 480, h: 20 },
    { x: 5, y: 884, w: 18, h: 310 },
    { x: 17, y: 1191, w: 452, h: 12 },
    { x: 310, y: 878, w: 18, h: 144 },
    { x: 581, y: 984, w: 26, h: 26 },
    { x: 463, y: 970, w: 20, h: 20 },
    { x: 492, y: 1053, w: 23, h: 23 },
    { x: 664, y: 878, w: 89, h: 72 },
    { x: 25, y: 895, w: 130, h: 236 },
    { x: 28, y: 1142, w: 41, h: 46 },
    { x: 23, y: 527, w: 474, h: 14 },
    { x: 14, y: 538, w: 14, h: 320 },
    { x: 115, y: 558, w: 123, h: 29 },
    { x: 316, y: 535, w: 26, h: 147 },
    { x: 319, y: 748, w: 20, h: 115 },
    { x: 664, y: 786, w: 23, h: 66 },
    { x: 664, y: 587, w: 26, h: 72 },
    { x: 382, y: 584, w: 20, h: 87 },
    { x: 379, y: 791, w: 26, h: 61 },
    { x: 23, y: 233, w: 218, h: 18 },
    { x: 221, y: 248, w: 17, h: 141 },
    { x: 224, y: 452, w: 12, h: 72 },
    { x: 23, y: 248, w: 20, h: 290 },
    { x: 46, y: 245, w: 172, h: 69 },
    { x: 582, y: 1362, w: 32, h: 103 },
    { x: 456, y: 1360, w: 32, h: 100 },
    { x: 997, y: 1209, w: 21, h: 130 },
    { x: 822, y: 1358, w: 156, h: 15 },
    { x: 976, y: 1335, w: 45, h: 36 },
    { x: 857, y: 1332, w: 17, h: 28 },
    { x: 850, y: 1213, w: 24, h: 43 },
    { x: 871, y: 1209, w: 133, h: 34 },
    { x: 475, y: 1183, w: 19, h: 24 },
    { x: 51, y: 1205, w: 19, h: 130 },
    { x: 57, y: 1335, w: 36, h: 36 },
    { x: 93, y: 1354, w: 158, h: 25 },
    { x: 196, y: 1207, w: 25, h: 40 },
    { x: 251, y: 1373, w: 26, h: 28 },
    { x: 270, y: 1388, w: 190, h: 21 },
    { x: 614, y: 1386, w: 59, h: 17 },
    { x: 675, y: 1367, w: 41, h: 36 },
    { x: 716, y: 1373, w: 60, h: 30 },
    { x: 786, y: 1352, w: 34, h: 70 },
    { x: 776, y: 1371, w: 12, h: 30 },
    { x: 328, y: 878, w: 53, h: 54 },
    { x: 381, y: 908, w: 28, h: 24 },
    { x: 388, y: 881, w: 106, h: 14 },
    { x: 336, y: 936, w: 43, h: 21 },
    { x: 407, y: 923, w: 27, h: 28 },
    { x: 328, y: 962, w: 38, h: 27 },
    { x: 705, y: 1096, w: 39, h: 55 },
    { x: 652, y: 1087, w: 23, h: 19 },
    { x: 673, y: 1109, w: 30, h: 49 },
    { x: 654, y: 1132, w: 19, h: 41 },
    { x: 588, y: 861, w: 462, h: 20 },
    { x: 1033, y: 527, w: 26, h: 678 },
    { x: 582, y: 1194, w: 475, h: 15 },
    { x: 752, y: 1094, w: 19, h: 117 },
    { x: 752, y: 876, w: 15, h: 143 },
    { x: 767, y: 974, w: 68, h: 39 },
    { x: 1006, y: 1136, w: 23, h: 41 },
    // New rects in this version (right-side interior walls)
    { x: 579, y: 527, w: 474, h: 18 },
    { x: 728, y: 539, w: 23, h: 129 },
    { x: 731, y: 749, w: 23, h: 112 },
    { x: 984, y: 588, w: 64, h: 57 },
    { x: 987, y: 689, w: 55, h: 109 },
    { x: 757, y: 786, w: 29, h: 81 },
    { x: 760, y: 818, w: 80, h: 49 },
    { x: 843, y: 832, w: 29, h: 26 },

    // --- 3 Polygon collision shapes (scanline decomposed at 16px, merged) ---
    // Polygon 0: Upper bridge interior wall - 3 rects
    { x: 296, y: 219, w: 464, h: 16 },
    { x: 296, y: 235, w: 480, h: 16 },
    { x: 488, y: 251, w: 80, h: 64 },
    // Polygon 1: Top-left bow corner - 11 rects
    { x: 40, y: 143, w: 32, h: 16 },
    { x: 40, y: 159, w: 16, h: 32 },
    { x: 40, y: 191, w: 32, h: 32 },
    { x: 56, y: 127, w: 16, h: 16 },
    { x: 72, y: 111, w: 16, h: 16 },
    { x: 88, y: 95, w: 16, h: 16 },
    { x: 104, y: 79, w: 32, h: 16 },
    { x: 120, y: 63, w: 48, h: 16 },
    { x: 152, y: 47, w: 48, h: 16 },
    { x: 184, y: 31, w: 48, h: 16 },
    { x: 216, y: 15, w: 16, h: 16 },
    // Polygon 2: Top-right bow corner - 10 rects
    { x: 821, y: 15, w: 16, h: 16 },
    { x: 869, y: 31, w: 16, h: 16 },
    { x: 885, y: 47, w: 32, h: 16 },
    { x: 917, y: 63, w: 32, h: 16 },
    { x: 933, y: 79, w: 32, h: 16 },
    { x: 965, y: 95, w: 16, h: 16 },
    { x: 981, y: 111, w: 16, h: 16 },
    { x: 981, y: 127, w: 32, h: 16 },
    { x: 997, y: 143, w: 32, h: 16 },
    { x: 1013, y: 159, w: 16, h: 64 },
  ];
}

// ===== Occlusion Zones =====
// Items (relics, props) spawn ONLY within these zones.
// Pixel coordinates directly from annotations JSON occlusion layer.
function generateOcclusionZones() {
  return [
    { x: 198, y: 909, w: 81, h: 35 },    // Zone 0: Lower-left storage
    { x: 377, y: 130, w: 43, h: 34 },    // Zone 1: Bridge left console
    { x: 661, y: 135, w: 46, h: 35 },    // Zone 2: Bridge right console
    { x: 917, y: 276, w: 58, h: 44 },    // Zone 3: Right upper room
    { x: 892, y: 1030, w: 28, h: 38 },   // Zone 4: Right lower storage
    { x: 860, y: 702, w: 23, h: 46 },    // Zone 5: Right mid corridor
    { x: 221, y: 622, w: 32, h: 26 },    // Zone 6: Left mid area
    { x: 753, y: 475, w: 38, h: 29 },    // Zone 7: Center-right vault
    { x: 768, y: 1286, w: 37, h: 32 },   // Zone 8: Stern right area
  ];
}

// ===== Placeable Positions =====
// Items, enemies, and loot spawn at these positions (centers of occlusion zones)
function generatePlaceable() {
  const points = [];
  const occZones = generateOcclusionZones();
  // Image scale: annotations are in 1070×1470 image pixels,
  // game world is MAP_W*TILE × MAP_H*TILE = 1088×1472
  const sX = (MAP_W * TILE) / 1070;
  const sY = (MAP_H * TILE) / 1470;

  const zoneRoomIds = [
    'lower_left_storage',
    'bridge_left',
    'bridge_right',
    'right_upper_cabin',
    'right_lower_storage',
    'right_mid_corridor',
    'left_mid_area',
    'center_vault',
    'stern_right',
  ];

  occZones.forEach((z, idx) => {
    const roomId = zoneRoomIds[idx] || `zone_${idx}`;
    // Convert pixel center (scaled) to tile coords for placeable
    const cx = Math.floor(((z.x + z.w / 2) * sX) / TILE);
    const cy = Math.floor(((z.y + z.h / 2) * sY) / TILE);
    points.push({ x: cx, y: cy, roomId });

    // Additional spawn points within zone
    const startTX = Math.floor((z.x * sX) / TILE);
    const startTY = Math.floor((z.y * sY) / TILE);
    const endTX = Math.ceil(((z.x + z.w) * sX) / TILE);
    const endTY = Math.ceil(((z.y + z.h) * sY) / TILE);
    for (let ty = startTY; ty < endTY; ty++) {
      for (let tx = startTX; tx < endTX; tx++) {
        if (tx !== cx || ty !== cy) {
          points.push({ x: tx, y: ty, roomId });
        }
      }
    }
  });

  return points;
}

// ===== Room Bounds (logical areas for gameplay) =====
const ROOM_BOUNDS = {
  bridge:         { x: 7, y: 0, w: 19, h: 7 },
  left_upper:     { x: 0, y: 7, w: 9, h: 9 },
  center_upper:   { x: 9, y: 7, w: 14, h: 9 },
  right_upper:    { x: 23, y: 7, w: 10, h: 10 },
  left_mid:       { x: 0, y: 16, w: 9, h: 11 },
  center_mid:     { x: 9, y: 16, w: 14, h: 11 },
  right_mid:      { x: 23, y: 16, w: 10, h: 11 },
  left_lower:     { x: 0, y: 27, w: 9, h: 11 },
  center_lower:   { x: 9, y: 27, w: 14, h: 11 },
  right_lower:    { x: 23, y: 27, w: 10, h: 11 },
  stern:          { x: 0, y: 38, w: 34, h: 8 },
};

// ===== Doorway Definitions =====
function generateDoorways() {
  return [
    { x: 8, y: 10, w: 1, h: 2, orientation: 'vertical' },
    { x: 22, y: 10, w: 1, h: 2, orientation: 'vertical' },
    { x: 10, y: 16, w: 3, h: 1, orientation: 'horizontal' },
    { x: 16, y: 16, w: 4, h: 1, orientation: 'horizontal' },
    { x: 10, y: 27, w: 3, h: 1, orientation: 'horizontal' },
    { x: 16, y: 27, w: 4, h: 1, orientation: 'horizontal' },
  ];
}

// ===== Water Zones =====
function generateWaterZones() {
  return [
    { x: 2, y: 32, w: 4, h: 3 },
  ];
}

// ===== Porthole Positions =====
function generatePortholes() {
  return [
    { x: 0, y: 12 }, { x: 0, y: 20 },
    { x: 0, y: 30 }, { x: 0, y: 35 },
    { x: 33, y: 12 }, { x: 33, y: 20 },
    { x: 33, y: 30 }, { x: 33, y: 35 },
  ];
}

/**
 * Main entry: compose smuggler ship map
 */
export function composeShipMap() {
  const walls = generateWalls();
  const obstacles = [];
  const occlusionZones = generateOcclusionZones();
  const placeable = generatePlaceable();
  const doorways = generateDoorways();
  const waterZones = generateWaterZones();
  const portholes = generatePortholes();

  const children = [
    {
      id: 'ship_full',
      origin: { x: 0, y: 0 },
      tilesW: MAP_W,
      tilesH: MAP_H,
      procedural: false,
    },
  ];

  const spawn = { x: 17, y: 43 };
  const exit = { x: 17, y: 44 };

  const roomBounds = {};
  for (const [id, bounds] of Object.entries(ROOM_BOUNDS)) {
    roomBounds[id] = { ...bounds };
  }

  const corridors = doorways.map((d, i) => ({
    id: `door_${i}`,
    x: d.x,
    y: d.y,
    w: d.w,
    h: d.h,
  }));

  return {
    id: 'composed_ship',
    name: 'Smuggler Ship 沉鲸号',
    tilesW: MAP_W,
    tilesH: MAP_H,
    tags: ['composed', 'ship'],
    // Flag: walls use pixel coordinates, not tile coordinates
    wallsInPixels: true,
    children,
    corridors,
    doorways,
    roomBounds,
    walls,
    obstacles,
    occlusionZones,
    placeable,
    waterZones,
    portholes,
    special: {
      playerSpawn: spawn,
      exit,
    },
  };
}

export default composeShipMap;
