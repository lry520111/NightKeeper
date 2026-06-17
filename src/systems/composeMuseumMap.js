// composeMuseumMap.js
// ——————————————————————————————————————————————————
// Cross-shaped museum map composer
//
// Layout (tile coordinates, 1 tile = 32px):
//
//                        ┌──────────┐
//                        │ room_06  │  Storage (target room, dead-end)
//                        │  20×20   │
//                        └────┬─────┘
//                             │ corridor_N
//   ┌───────────┐  ┌─────────┴──────────┐  ┌───────────┐
//   │  room_07  ├──┤      room_03       ├──┤  room_08  │
//   │  20×20    │  │   Compass Hall     │  │  25×18    │
//   │ Study     │  │      20×20         │  │ Ritual    │
//   └───────────┘  └─────────┬──────────┘  └───────────┘
//                            │ corridor_S
//   ┌───────────┐  ┌────────┴───────────┐  ┌───────────┐
//   │  room_04  ├──┤      room_01       ├──┤  room_02  │
//   │  25×18    │  │   Central Hall     │  │  25×18    │
//   │ Parlor    │  │      20×20         │  │ Gallery   │
//   └───────────┘  └────────┬───────────┘  └───────────┘
//                           │ corridor_exit
//                      ┌────┴────┐
//                      │  EXIT   │
//                      └─────────┘
//
// Grid layout (in tiles):
//   - Center column: X = 25 (room_07 width) + 6 (corridor) = 31 offset
//   - Actually let's use a coordinate system:
//
//   Row 0 (top):     room_06 at center
//   Row 1 (middle):  room_07 | corridor_W | room_03 | corridor_E | room_08
//   Row 2 (bottom):  room_04 | corridor_W | room_01 | corridor_E | room_02
//   Row 3 (exit):    exit corridor below room_01
//
// ——————————————————————————————————————————————————

import { getRoomTemplate } from '../data/roomTemplates.js';

// ===== Layout Constants =====
// All rooms are placed on a grid. The center hub rooms (room_01, room_03) are 20×20.
// Side rooms are 20×20 (room_07) or effectively treated as 20×18 (room_02, room_04, room_08 cropped to fit).
// For simplicity, we standardize side rooms to 20 tiles wide (scale the 25-wide rooms down to 20).

const ROOM_SIZE = 20;        // Standard room size (tiles)
const CORRIDOR_W = 6;        // Corridor width (tiles)
const CORRIDOR_H = 6;        // Corridor height (tiles)

// Horizontal layout:
// [side_room_left] [corridor_W] [center_room] [corridor_E] [side_room_right]
// 20 + 6 + 20 + 6 + 20 = 72 tiles wide

// Vertical layout:
// [room_06] [corridor_N] [room_03_row] [corridor_S] [room_01_row] [corridor_exit]
// 20 + 6 + 20 + 6 + 20 + 6 = 78 tiles tall (but room_06 is only in center column)

// Origin coordinates for each room (top-left corner in tile coords)
const LEFT_X = 0;
const CENTER_X = 26;  // 20 (left room) + 6 (corridor) = 26
const RIGHT_X = 52;   // 26 + 20 (center) + 6 (corridor) = 52

const ROW_TOP_Y = 0;       // room_06 (only center column)
const ROW_MID_Y = 26;      // room_07, room_03, room_08 (20 + 6 corridor = 26)
const ROW_BOT_Y = 52;      // room_04, room_01, room_02 (26 + 20 + 6 = 52)
const ROW_EXIT_Y = 72;     // exit corridor (52 + 20 = 72)

// Room placements
const PLACEMENTS = [
  // Top (dead-end target)
  { id: 'room_06', origin: { x: CENTER_X, y: ROW_TOP_Y } },

  // Middle row
  { id: 'room_07', origin: { x: LEFT_X,   y: ROW_MID_Y } },   // Study (left)
  { id: 'room_03', origin: { x: CENTER_X, y: ROW_MID_Y } },   // Compass Hall (center)
  { id: 'room_08', origin: { x: RIGHT_X,  y: ROW_MID_Y } },   // Ritual Gallery (right)

  // Bottom row
  { id: 'room_04', origin: { x: LEFT_X,   y: ROW_BOT_Y } },   // Parlor (left)
  { id: 'room_01', origin: { x: CENTER_X, y: ROW_BOT_Y } },   // Central Hall (center, spawn)
  { id: 'room_02', origin: { x: RIGHT_X,  y: ROW_BOT_Y } },   // Long Gallery (right)
];

// Corridor definitions connecting rooms
// Each corridor: { id, rect: {x,y,w,h}, walls: [...] }
const CORRIDOR_TILE = 9; // Door position on 20-wide rooms (tile 9~10)

const CORRIDORS = [
  // === Vertical corridors (center column) ===
  // C_N: room_06 (south door) ↔ room_03 (north door)
  {
    id: 'c_06_03',
    rect: { x: CENTER_X + 7, y: ROW_TOP_Y + ROOM_SIZE, w: CORRIDOR_W, h: CORRIDOR_H },
    walls: [
      { x: CENTER_X + 7 - 1, y: ROW_TOP_Y + ROOM_SIZE, w: 1, h: CORRIDOR_H },
      { x: CENTER_X + 7 + CORRIDOR_W, y: ROW_TOP_Y + ROOM_SIZE, w: 1, h: CORRIDOR_H },
    ]
  },
  // C_S: room_03 (south door) ↔ room_01 (north door)
  {
    id: 'c_03_01',
    rect: { x: CENTER_X + 7, y: ROW_MID_Y + ROOM_SIZE, w: CORRIDOR_W, h: CORRIDOR_H },
    walls: [
      { x: CENTER_X + 7 - 1, y: ROW_MID_Y + ROOM_SIZE, w: 1, h: CORRIDOR_H },
      { x: CENTER_X + 7 + CORRIDOR_W, y: ROW_MID_Y + ROOM_SIZE, w: 1, h: CORRIDOR_H },
    ]
  },
  // C_EXIT: room_01 (south door) → exit
  {
    id: 'c_01_exit',
    rect: { x: CENTER_X + 7, y: ROW_BOT_Y + ROOM_SIZE, w: CORRIDOR_W, h: CORRIDOR_H },
    walls: [
      { x: CENTER_X + 7 - 1, y: ROW_BOT_Y + ROOM_SIZE, w: 1, h: CORRIDOR_H },
      { x: CENTER_X + 7 + CORRIDOR_W, y: ROW_BOT_Y + ROOM_SIZE, w: 1, h: CORRIDOR_H },
      { x: CENTER_X + 7, y: ROW_BOT_Y + ROOM_SIZE + CORRIDOR_H - 1, w: CORRIDOR_W, h: 1 }, // south wall (dead end = exit)
    ]
  },

  // === Horizontal corridors (middle row) ===
  // C_MW: room_07 (east door) ↔ room_03 (west door)
  {
    id: 'c_07_03',
    rect: { x: LEFT_X + ROOM_SIZE, y: ROW_MID_Y + 7, w: CORRIDOR_W, h: CORRIDOR_W },
    walls: [
      { x: LEFT_X + ROOM_SIZE, y: ROW_MID_Y + 7 - 1, w: CORRIDOR_W, h: 1 },
      { x: LEFT_X + ROOM_SIZE, y: ROW_MID_Y + 7 + CORRIDOR_W, w: CORRIDOR_W, h: 1 },
    ]
  },
  // C_ME: room_03 (east door) ↔ room_08 (west door)
  {
    id: 'c_03_08',
    rect: { x: CENTER_X + ROOM_SIZE, y: ROW_MID_Y + 7, w: CORRIDOR_W, h: CORRIDOR_W },
    walls: [
      { x: CENTER_X + ROOM_SIZE, y: ROW_MID_Y + 7 - 1, w: CORRIDOR_W, h: 1 },
      { x: CENTER_X + ROOM_SIZE, y: ROW_MID_Y + 7 + CORRIDOR_W, w: CORRIDOR_W, h: 1 },
    ]
  },

  // === Horizontal corridors (bottom row) ===
  // C_BW: room_04 (east door) ↔ room_01 (west door)
  {
    id: 'c_04_01',
    rect: { x: LEFT_X + ROOM_SIZE, y: ROW_BOT_Y + 7, w: CORRIDOR_W, h: CORRIDOR_W },
    walls: [
      { x: LEFT_X + ROOM_SIZE, y: ROW_BOT_Y + 7 - 1, w: CORRIDOR_W, h: 1 },
      { x: LEFT_X + ROOM_SIZE, y: ROW_BOT_Y + 7 + CORRIDOR_W, w: CORRIDOR_W, h: 1 },
    ]
  },
  // C_BE: room_01 (east door) ↔ room_02 (west door)
  {
    id: 'c_01_02',
    rect: { x: CENTER_X + ROOM_SIZE, y: ROW_BOT_Y + 7, w: CORRIDOR_W, h: CORRIDOR_W },
    walls: [
      { x: CENTER_X + ROOM_SIZE, y: ROW_BOT_Y + 7 - 1, w: CORRIDOR_W, h: 1 },
      { x: CENTER_X + ROOM_SIZE, y: ROW_BOT_Y + 7 + CORRIDOR_W, w: CORRIDOR_W, h: 1 },
    ]
  },
];

// Map total size
const MAP_W = 72;  // 20 + 6 + 20 + 6 + 20
const MAP_H = 78;  // 20 + 6 + 20 + 6 + 20 + 6

/**
 * Offset a list of rects/points by origin
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
 * Add outer border walls (ultimate boundary)
 */
function addOuterBorder(walls, W, H) {
  const T = 1;
  walls.push({ x: 0, y: 0, w: W, h: T });         // top
  walls.push({ x: 0, y: H - T, w: W, h: T });     // bottom
  walls.push({ x: 0, y: 0, w: T, h: H });         // left
  walls.push({ x: W - T, y: 0, w: T, h: H });     // right
}

/**
 * Fill dead zones (areas between rooms that are not corridors)
 * These are solid walls preventing players from walking outside rooms/corridors
 */
function fillDeadZones(walls) {
  // Top row: only center column has room_06, left and right are dead zones
  // Left dead zone: X=0~25, Y=0~25
  walls.push({ x: 0, y: ROW_TOP_Y, w: CENTER_X, h: ROOM_SIZE + CORRIDOR_H });
  // Right dead zone: X=46~71, Y=0~25
  walls.push({ x: CENTER_X + ROOM_SIZE, y: ROW_TOP_Y, w: MAP_W - (CENTER_X + ROOM_SIZE), h: ROOM_SIZE + CORRIDOR_H });

  // Vertical corridor dead zones (areas beside vertical corridors in center column)
  // Between room_06 and room_03 (Y=20~25): left of corridor and right of corridor within center column
  const vcY1 = ROW_TOP_Y + ROOM_SIZE;
  walls.push({ x: CENTER_X, y: vcY1, w: 7, h: CORRIDOR_H }); // left of corridor within center
  walls.push({ x: CENTER_X + 7 + CORRIDOR_W, y: vcY1, w: ROOM_SIZE - 7 - CORRIDOR_W, h: CORRIDOR_H }); // right

  // Between room_03 and room_01 (Y=46~51)
  const vcY2 = ROW_MID_Y + ROOM_SIZE;
  walls.push({ x: CENTER_X, y: vcY2, w: 7, h: CORRIDOR_H });
  walls.push({ x: CENTER_X + 7 + CORRIDOR_W, y: vcY2, w: ROOM_SIZE - 7 - CORRIDOR_W, h: CORRIDOR_H });

  // Exit corridor dead zones (Y=72~77)
  const vcY3 = ROW_BOT_Y + ROOM_SIZE;
  walls.push({ x: CENTER_X, y: vcY3, w: 7, h: CORRIDOR_H });
  walls.push({ x: CENTER_X + 7 + CORRIDOR_W, y: vcY3, w: ROOM_SIZE - 7 - CORRIDOR_W, h: CORRIDOR_H });

  // Horizontal corridor dead zones (middle row Y=26~45)
  // Between left room and corridor_W: areas above/below the horizontal corridor
  const hcMidY = ROW_MID_Y + 7;
  // Left corridor area (X=20~25, Y=26~45): above corridor
  walls.push({ x: LEFT_X + ROOM_SIZE, y: ROW_MID_Y, w: CORRIDOR_W, h: 7 - 1 });
  // Left corridor area: below corridor
  walls.push({ x: LEFT_X + ROOM_SIZE, y: hcMidY + CORRIDOR_W + 1, w: CORRIDOR_W, h: ROOM_SIZE - 7 - CORRIDOR_W - 1 });
  // Right corridor area (X=46~51, Y=26~45): above corridor
  walls.push({ x: CENTER_X + ROOM_SIZE, y: ROW_MID_Y, w: CORRIDOR_W, h: 7 - 1 });
  // Right corridor area: below corridor
  walls.push({ x: CENTER_X + ROOM_SIZE, y: hcMidY + CORRIDOR_W + 1, w: CORRIDOR_W, h: ROOM_SIZE - 7 - CORRIDOR_W - 1 });

  // Horizontal corridor dead zones (bottom row Y=52~71)
  const hcBotY = ROW_BOT_Y + 7;
  // Left corridor area (X=20~25, Y=52~71): above corridor
  walls.push({ x: LEFT_X + ROOM_SIZE, y: ROW_BOT_Y, w: CORRIDOR_W, h: 7 - 1 });
  // Left corridor area: below corridor
  walls.push({ x: LEFT_X + ROOM_SIZE, y: hcBotY + CORRIDOR_W + 1, w: CORRIDOR_W, h: ROOM_SIZE - 7 - CORRIDOR_W - 1 });
  // Right corridor area (X=46~51, Y=52~71): above corridor
  walls.push({ x: CENTER_X + ROOM_SIZE, y: ROW_BOT_Y, w: CORRIDOR_W, h: 7 - 1 });
  // Right corridor area: below corridor
  walls.push({ x: CENTER_X + ROOM_SIZE, y: hcBotY + CORRIDOR_W + 1, w: CORRIDOR_W, h: ROOM_SIZE - 7 - CORRIDOR_W - 1 });

  // Exit corridor: left and right dead zones at bottom
  walls.push({ x: 0, y: ROW_BOT_Y + ROOM_SIZE, w: CENTER_X, h: CORRIDOR_H });
  walls.push({ x: CENTER_X + ROOM_SIZE, y: ROW_BOT_Y + ROOM_SIZE, w: MAP_W - (CENTER_X + ROOM_SIZE), h: CORRIDOR_H });
}

/**
 * Main entry: compose cross-shaped museum map
 */
export function composeMuseumMap() {
  const walls = [];
  const obstacles = [];
  const placeable = [];
  const children = [];
  let safe = null;

  // 0) Outer border
  addOuterBorder(walls, MAP_W, MAP_H);

  // 1) Place each room
  for (const p of PLACEMENTS) {
    const tpl = getRoomTemplate(p.id);
    if (!tpl) continue;

    // For rooms wider than 20 (room_02, room_04, room_08 are 25×18),
    // we scale them to fit 20×20 slot. The image will be stretched.
    const fitW = ROOM_SIZE;
    const fitH = ROOM_SIZE;

    children.push({
      id: tpl.id,
      origin: p.origin,
      tilesW: fitW,
      tilesH: fitH,
      srcTilesW: tpl.tilesW,
      srcTilesH: tpl.tilesH,
    });

    // Scale walls/obstacles from source room size to fit size
    const scaleX = fitW / tpl.tilesW;
    const scaleY = fitH / tpl.tilesH;

    const scaledWalls = (tpl.walls || []).map(r => ({
      x: Math.round(r.x * scaleX) + p.origin.x,
      y: Math.round(r.y * scaleY) + p.origin.y,
      w: Math.max(1, Math.round((r.w || 1) * scaleX)),
      h: Math.max(1, Math.round((r.h || 1) * scaleY)),
    }));
    walls.push(...scaledWalls);

    const scaledObstacles = (tpl.obstacles || []).map(r => ({
      x: Math.round(r.x * scaleX) + p.origin.x,
      y: Math.round(r.y * scaleY) + p.origin.y,
      w: Math.max(1, Math.round((r.w || 1) * scaleX)),
      h: Math.max(1, Math.round((r.h || 1) * scaleY)),
    }));
    obstacles.push(...scaledObstacles);

    const scaledPlaceable = (tpl.placeable || []).map(pt => ({
      x: Math.round(pt.x * scaleX) + p.origin.x,
      y: Math.round(pt.y * scaleY) + p.origin.y,
      roomId: p.id,
    }));
    placeable.push(...scaledPlaceable);

    if (tpl.special && tpl.special.safe) {
      safe = {
        x: Math.round(tpl.special.safe.x * scaleX) + p.origin.x,
        y: Math.round(tpl.special.safe.y * scaleY) + p.origin.y,
      };
    }
  }

  // 2) Corridors: add walls + patrol points
  for (const c of CORRIDORS) {
    walls.push(...c.walls);
    const r = c.rect;
    // Patrol points in corridor center
    const midX = Math.floor(r.x + r.w / 2);
    const midY = Math.floor(r.y + r.h / 2);
    placeable.push({ x: midX, y: midY, roomId: '__corridor__' });
  }

  // 3) Fill dead zones (solid walls in areas with no rooms/corridors)
  fillDeadZones(walls);

  // 4) Player spawn (center of room_01) and exit
  const room01Origin = PLACEMENTS.find(p => p.id === 'room_01').origin;
  const spawn = { x: room01Origin.x + 10, y: room01Origin.y + 17 };
  const exit = { x: CENTER_X + 10, y: ROW_EXIT_Y + CORRIDOR_H - 2 };

  // 5) Room bounds for guard patrol constraints
  const roomBounds = {};
  for (const p of PLACEMENTS) {
    const tpl = getRoomTemplate(p.id);
    if (!tpl) continue;
    roomBounds[p.id] = {
      x: p.origin.x + 1,
      y: p.origin.y + 1,
      w: ROOM_SIZE - 2,
      h: ROOM_SIZE - 2,
    };
  }

  // 6) Compute doorway positions for visual decoration (archways / door frames)
  // Each doorway: { x, y, w, h, orientation: 'horizontal'|'vertical' }
  // horizontal = door spans left-right (on N/S wall), vertical = door spans top-bottom (on W/E wall)
  const doorways = [];
  // Horizontal corridors connect left-right rooms (their doorways are vertical arches)
  const horizontalCorridorIds = new Set(['c_07_03', 'c_03_08', 'c_04_01', 'c_01_02']);
  for (const c of CORRIDORS) {
    const r = c.rect;
    if (horizontalCorridorIds.has(c.id)) {
      // Horizontal corridor → vertical doorways at left and right ends (3 tiles wide for visibility)
      doorways.push({ x: r.x - 1, y: r.y, w: 3, h: r.h, orientation: 'vertical' });
      doorways.push({ x: r.x + r.w - 2, y: r.y, w: 3, h: r.h, orientation: 'vertical' });
    } else {
      // Vertical corridor → horizontal doorways at top and bottom ends (3 tiles tall)
      doorways.push({ x: r.x, y: r.y - 1, w: r.w, h: 3, orientation: 'horizontal' });
      doorways.push({ x: r.x, y: r.y + r.h - 2, w: r.w, h: 3, orientation: 'horizontal' });
    }
  }

  return {
    id: 'composed_museum',
    name: 'NightKeeper Cross Museum',
    tilesW: MAP_W,
    tilesH: MAP_H,
    tags: ['composed', 'museum'],
    children,
    corridors: CORRIDORS.map(c => ({ ...c.rect, id: c.id })),
    doorways,
    roomBounds,
    walls,
    obstacles,
    placeable,
    special: {
      playerSpawn: spawn,
      exit,
      ...(safe ? { safe } : {}),
    },
  };
}

export default composeMuseumMap;