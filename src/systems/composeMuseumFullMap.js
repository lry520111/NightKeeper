// composeMuseumFullMap.js
// ——————————————————————————————————————————————————
// Museum "博物馆" map composer — Full-map PNG version
//
// Uses a single pre-rendered full map image (museum_full.png, 1122×1402px)
// Collision data imported DIRECTLY from Godot annotations JSON in PIXEL coords.
// Source: museum_full_20260618_181908_079_annotations.json
//
// Image: 1122 × 1402 px
// Tile size: 32px → effective grid: ~35.1 × 43.8 tiles
// We use MAP_W=36, MAP_H=44 tiles (1152×1408 world px)
//
// IMPORTANT: walls[] uses PIXEL coordinates (wallsInPixels: true).
//   MuseumScene addWall detects this and skips tile→pixel conversion.
//   imageWidth/imageHeight fields tell MuseumScene the original annotation
//   coordinate space for proper scaling.
// ——————————————————————————————————————————————————

const TILE = 32;
const MAP_W = 36;
const MAP_H = 44;
const IMG_W = 1122;
const IMG_H = 1402;

// ===== Collision Walls =====
// Directly from annotations JSON collision layer — PIXEL coordinates.
// 100 rectangle shapes. Players CANNOT move through these areas.
function generateWalls() {
  return [
    // --- 100 Rectangle collision shapes (exact pixel bounds from Godot) ---
    { x: 572, y: 1272, w: 13, h: 125 },
    { x: 496, y: 1270, w: 13, h: 130 },
    { x: 452, y: 1223, w: 18, h: 28 },
    { x: 611, y: 1225, w: 16, h: 21 },
    { x: 447, y: 1275, w: 47, h: 39 },
    { x: 322, y: 1254, w: 104, h: 36 },
    { x: 423, y: 1264, w: 13, h: 37 },
    { x: 436, y: 1272, w: 13, h: 29 },
    { x: 275, y: 1118, w: 15, h: 110 },
    { x: 277, y: 1223, w: 13, h: 26 },
    { x: 290, y: 1233, w: 8, h: 31 },
    { x: 298, y: 1241, w: 10, h: 34 },
    { x: 306, y: 1254, w: 16, h: 31 },
    { x: 441, y: 1124, w: 21, h: 36 },
    { x: 621, y: 1124, w: 19, h: 36 },
    { x: 585, y: 1277, w: 44, h: 40 },
    { x: 629, y: 1267, w: 11, h: 39 },
    { x: 640, y: 1259, w: 13, h: 37 },
    { x: 655, y: 1249, w: 115, h: 13 },
    { x: 770, y: 1238, w: 26, h: 32 },
    { x: 786, y: 1134, w: 21, h: 115 },
    { x: 288, y: 1176, w: 20, h: 41 },
    { x: 767, y: 1178, w: 21, h: 34 },
    { x: 405, y: 1087, w: 104, h: 55 },
    { x: 574, y: 1090, w: 113, h: 57 },
    { x: 734, y: 1090, w: 88, h: 54 },
    { x: 235, y: 1090, w: 115, h: 44 },
    { x: 230, y: 871, w: 34, h: 229 },
    { x: 481, y: 873, w: 13, h: 63 },
    { x: 483, y: 1011, w: 16, h: 81 },
    { x: 587, y: 1011, w: 14, h: 87 },
    { x: 593, y: 876, w: 13, h: 62 },
    { x: 807, y: 868, w: 18, h: 243 },
    { x: 504, y: 566, w: 73, h: 172 },
    { x: 454, y: 605, w: 167, h: 86 },
    { x: 481, y: 586, w: 122, h: 126 },
    { x: 603, y: 871, w: 84, h: 39 },
    { x: 739, y: 871, w: 78, h: 34 },
    { x: 259, y: 871, w: 89, h: 36 },
    { x: 395, y: 871, w: 88, h: 41 },
    { x: 853, y: 435, w: 16, h: 131 },
    { x: 587, y: 813, w: 178, h: 16 },
    { x: 754, y: 772, w: 16, h: 60 },
    { x: 345, y: 779, w: 16, h: 55 },
    { x: 348, y: 819, w: 133, h: 15 },
    { x: 275, y: 805, w: 13, h: 76 },
    { x: 272, y: 586, w: 13, h: 175 },
    { x: 22, y: 618, w: 247, h: 21 },
    { x: 97, y: 639, w: 115, h: 91 },
    { x: 19, y: 631, w: 16, h: 237 },
    { x: 19, y: 868, w: 232, h: 26 },
    { x: 27, y: 430, w: 18, h: 188 },
    { x: 37, y: 433, w: 248, h: 41 },
    { x: 267, y: 467, w: 18, h: 62 },
    { x: 280, y: 427, w: 21, h: 102 },
    { x: 335, y: 414, w: 15, h: 120 },
    { x: 342, y: 414, w: 81, h: 55 },
    { x: 567, y: 420, w: 109, h: 54 },
    { x: 765, y: 427, w: 23, h: 157 },
    { x: 827, y: 417, w: 26, h: 141 },
    { x: 846, y: 558, w: 20, h: 62 },
    { x: 853, y: 691, w: 13, h: 70 },
    { x: 848, y: 746, w: 73, h: 31 },
    { x: 864, y: 766, w: 18, h: 55 },
    { x: 817, y: 858, w: 57, h: 15 },
    { x: 861, y: 863, w: 19, h: 89 },
    { x: 869, y: 944, w: 81, h: 34 },
    { x: 942, y: 941, w: 146, h: 37 },
    { x: 1070, y: 759, w: 21, h: 182 },
    { x: 968, y: 743, w: 118, h: 36 },
    { x: 1059, y: 571, w: 34, h: 185 },
    { x: 866, y: 435, w: 201, h: 42 },
    { x: 1052, y: 435, w: 20, h: 146 },
    { x: 932, y: 558, w: 114, h: 36 },
    { x: 864, y: 558, w: 23, h: 41 },
    { x: 958, y: 686, w: 47, h: 20 },
    { x: 160, y: 5, w: 26, h: 425 },
    { x: 1059, y: 2, w: 27, h: 345 },
    { x: 181, y: 0, w: 680, h: 68 },
    { x: 859, y: 0, w: 193, h: 28 },
    { x: 950, y: 253, w: 23, h: 180 },
    { x: 966, y: 313, w: 112, h: 41 },
    { x: 853, y: 130, w: 19, h: 107 },
    { x: 859, y: 237, w: 31, h: 37 },
    { x: 885, y: 258, w: 83, h: 26 },
    { x: 945, y: 88, w: 78, h: 63 },
    { x: 189, y: 331, w: 57, h: 34 },
    { x: 301, y: 336, w: 156, h: 34 },
    { x: 512, y: 339, w: 169, h: 39 },
    { x: 744, y: 341, w: 78, h: 34 },
    { x: 606, y: 133, w: 18, h: 214 },
    { x: 796, y: 128, w: 21, h: 224 },
    { x: 358, y: 128, w: 23, h: 219 },
    { x: 181, y: 130, w: 70, h: 34 },
    { x: 306, y: 133, w: 146, h: 34 },
    { x: 525, y: 130, w: 143, h: 44 },
    { x: 739, y: 135, w: 54, h: 34 },
    { x: 872, y: 334, w: 86, h: 33 },
    { x: 916, y: 396, w: 55, h: 39 },
    { x: 853, y: 417, w: 71, h: 16 },
  ];
}

// ===== Occlusion Zones =====
// Relic spawn positions derived from occlusion layer in annotations JSON.
// Source: museum_full_20260618_181908_079_annotations.json
// Items spawn ONLY within these zones (not inside collision walls).
function generateOcclusionZones() {
  return [
    { x: 647, y: 959, w: 24, h: 16 },    // Zone 0: South hall right display
    { x: 734, y: 965, w: 28, h: 26 },    // Zone 1: South hall far right
    { x: 295, y: 1025, w: 40, h: 41 },   // Zone 2: Lobby left display
    { x: 478, y: 279, w: 29, h: 21 },    // Zone 3: North hall center
    { x: 694, y: 279, w: 32, h: 31 },    // Zone 4: North hall right
    { x: 144, y: 571, w: 29, h: 26 },    // Zone 5: West gallery
    { x: 1020, y: 795, w: 34, h: 42 },   // Zone 6: East wing lower
    { x: 999, y: 266, w: 42, h: 26 },    // Zone 7: Garden / east upper
    { x: 423, y: 498, w: 31, h: 36 },    // Zone 8: Central atrium
  ];
}

// ===== Placeable Positions =====
// Spawn points for items/enemies within the museum rooms.
// Derived from occlusion zones (safe display areas outside collision walls).
function generatePlaceable() {
  const points = [];
  const occZones = generateOcclusionZones();
  const sX = (MAP_W * TILE) / IMG_W;
  const sY = (MAP_H * TILE) / IMG_H;

  const zoneRoomIds = [
    'south_hall_right',
    'south_hall_right',
    'lobby',
    'north_hall_center',
    'north_hall_right',
    'west_gallery',
    'east_wing_lower',
    'garden',
    'central_atrium',
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
    for (let ty = startTY; ty <= endTY; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
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
  north_hall_left:   { x: 6, y: 2, w: 5, h: 8 },
  north_hall_center: { x: 12, y: 2, w: 7, h: 8 },
  north_hall_right:  { x: 20, y: 2, w: 5, h: 8 },
  garden:            { x: 27, y: 2, w: 6, h: 6 },
  central_atrium:    { x: 9, y: 13, w: 16, h: 14 },
  west_gallery:      { x: 1, y: 14, w: 7, h: 13 },
  east_wing_upper:   { x: 27, y: 14, w: 7, h: 9 },
  east_wing_lower:   { x: 27, y: 24, w: 7, h: 7 },
  south_hall_left:   { x: 9, y: 28, w: 6, h: 6 },
  south_hall_center: { x: 15, y: 28, w: 3, h: 6 },
  south_hall_right:  { x: 19, y: 28, w: 6, h: 6 },
  lobby:             { x: 9, y: 35, w: 16, h: 5 },
  entrance:          { x: 10, y: 40, w: 8, h: 4 },
};

// ===== Doorway Definitions =====
function generateDoorways() {
  return [
    // North halls to central atrium
    { x: 12, y: 10, w: 3, h: 1, orientation: 'horizontal' },
    { x: 18, y: 10, w: 3, h: 1, orientation: 'horizontal' },
    // West gallery to central atrium
    { x: 8, y: 18, w: 1, h: 3, orientation: 'vertical' },
    // East wing to central atrium
    { x: 25, y: 18, w: 1, h: 3, orientation: 'vertical' },
    // Central atrium to south halls
    { x: 14, y: 27, w: 4, h: 1, orientation: 'horizontal' },
    // South halls to lobby
    { x: 14, y: 34, w: 4, h: 1, orientation: 'horizontal' },
    // Lobby to entrance
    { x: 14, y: 39, w: 3, h: 1, orientation: 'horizontal' },
  ];
}

/**
 * Main entry: compose museum full map
 */
export function composeMuseumFullMap() {
  const walls = generateWalls();
  const obstacles = [];
  const occlusionZones = generateOcclusionZones();
  const placeable = generatePlaceable();
  const doorways = generateDoorways();

  const children = [
    {
      id: 'museum_full',
      origin: { x: 0, y: 0 },
      tilesW: MAP_W,
      tilesH: MAP_H,
      procedural: false,
    },
  ];

  // Player spawns at the entrance (bottom of map)
  const spawn = { x: 16, y: 42 };
  const exit = { x: 16, y: 43 };

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
    id: 'composed_museum_full',
    name: 'Museum 博物馆',
    tilesW: MAP_W,
    tilesH: MAP_H,
    tags: ['composed', 'museum'],
    // Flag: walls use pixel coordinates, not tile coordinates
    wallsInPixels: true,
    // Original image dimensions for proper scale correction
    imageWidth: IMG_W,
    imageHeight: IMG_H,
    children,
    corridors,
    doorways,
    roomBounds,
    walls,
    obstacles,
    occlusionZones,
    placeable,
    special: {
      playerSpawn: spawn,
      exit,
    },
  };
}

export default composeMuseumFullMap;
