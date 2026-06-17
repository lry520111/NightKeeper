// composeBlackmarketMap.js
// ——————————————————————————————————————————————————
// Underground Black Market map composer
//
// Layout concept: A maze-like underground bazaar with narrow alleys,
// hidden rooms, and multiple paths. The layout is an irregular grid
// simulating a converted underground parking structure / sewer system.
//
// Layout (tile coordinates, 1 tile = 32px):
//
//   ┌─────────────┐     ┌─────────────┐
//   │  stash_NW   │─────│  alley_N    │─────┐
//   │  (15×12)    │     │  (20×12)    │     │
//   └──────┬──────┘     └──────┬──────┘     │
//          │ corridor          │ corridor    │
//   ┌──────┴──────┐     ┌─────┴───────┐    │
//   │  den_W      │─────│  hub_center │────┤
//   │  (15×15)    │     │  (20×20)    │    │
//   └──────┬──────┘     └──────┬──────┘    │
//          │                   │            │
//          │            ┌──────┴──────┐    │
//          └────────────│  vault_S    │────┘
//                       │  (20×15)    │
//                       └─────────────┘
//                              │
//                         [EXIT/ENTRANCE]
//
// Total: 6 rooms connected by narrow corridors
// ——————————————————————————————————————————————————

// ===== Layout Constants =====
const TILE = 32;

// Room definitions (all in tile units)
const ROOMS = {
  stash_nw:   { w: 15, h: 12 },
  alley_n:    { w: 20, h: 12 },
  den_w:      { w: 15, h: 15 },
  hub_center: { w: 20, h: 20 },
  storage_e:  { w: 12, h: 15 },
  vault_s:    { w: 20, h: 15 },
};

const CORRIDOR_W = 4;  // Narrow corridors (black market feel)

// Compute positions
// Row 0 (top):    stash_nw | corridor | alley_n | corridor | (storage_e top half)
// Row 1 (middle): den_w    | corridor | hub_center | corridor | storage_e
// Row 2 (bottom):                       vault_s

const STASH_X = 0;
const STASH_Y = 0;

const ALLEY_X = ROOMS.stash_nw.w + CORRIDOR_W;  // 15 + 4 = 19
const ALLEY_Y = 0;

const DEN_X = 0;
const DEN_Y = ROOMS.stash_nw.h + CORRIDOR_W;    // 12 + 4 = 16

const HUB_X = ROOMS.den_w.w + CORRIDOR_W;       // 15 + 4 = 19
const HUB_Y = DEN_Y;                            // 16

const STORAGE_X = HUB_X + ROOMS.hub_center.w + CORRIDOR_W;  // 19 + 20 + 4 = 43
const STORAGE_Y = HUB_Y;                                     // 16

const VAULT_X = HUB_X;                          // 19
const VAULT_Y = HUB_Y + ROOMS.hub_center.h + CORRIDOR_W;    // 16 + 20 + 4 = 40

// Map total size
const MAP_W = STORAGE_X + ROOMS.storage_e.w;    // 43 + 12 = 55
const MAP_H = VAULT_Y + ROOMS.vault_s.h;        // 40 + 15 = 55

// Room placement array
const PLACEMENTS = [
  { id: 'stash_nw',   x: STASH_X,   y: STASH_Y,   w: ROOMS.stash_nw.w,   h: ROOMS.stash_nw.h },
  { id: 'alley_n',    x: ALLEY_X,   y: ALLEY_Y,   w: ROOMS.alley_n.w,    h: ROOMS.alley_n.h },
  { id: 'den_w',      x: DEN_X,     y: DEN_Y,     w: ROOMS.den_w.w,      h: ROOMS.den_w.h },
  { id: 'hub_center', x: HUB_X,     y: HUB_Y,     w: ROOMS.hub_center.w, h: ROOMS.hub_center.h },
  { id: 'storage_e',  x: STORAGE_X, y: STORAGE_Y, w: ROOMS.storage_e.w,  h: ROOMS.storage_e.h },
  { id: 'vault_s',    x: VAULT_X,   y: VAULT_Y,   w: ROOMS.vault_s.w,    h: ROOMS.vault_s.h },
];

// Corridor definitions
const CORRIDORS = [
  // stash_nw → alley_n (horizontal, top row)
  {
    id: 'c_stash_alley',
    rect: { x: STASH_X + ROOMS.stash_nw.w, y: STASH_Y + 4, w: CORRIDOR_W, h: CORRIDOR_W },
    orientation: 'horizontal',
  },
  // stash_nw → den_w (vertical, left column)
  {
    id: 'c_stash_den',
    rect: { x: STASH_X + 5, y: STASH_Y + ROOMS.stash_nw.h, w: CORRIDOR_W, h: CORRIDOR_W },
    orientation: 'vertical',
  },
  // alley_n → hub_center (vertical, center column)
  {
    id: 'c_alley_hub',
    rect: { x: ALLEY_X + 8, y: ALLEY_Y + ROOMS.alley_n.h, w: CORRIDOR_W, h: CORRIDOR_W },
    orientation: 'vertical',
  },
  // den_w → hub_center (horizontal, middle row)
  {
    id: 'c_den_hub',
    rect: { x: DEN_X + ROOMS.den_w.w, y: DEN_Y + 5, w: CORRIDOR_W, h: CORRIDOR_W },
    orientation: 'horizontal',
  },
  // hub_center → storage_e (horizontal, middle row right)
  {
    id: 'c_hub_storage',
    rect: { x: HUB_X + ROOMS.hub_center.w, y: HUB_Y + 5, w: CORRIDOR_W, h: CORRIDOR_W },
    orientation: 'horizontal',
  },
  // hub_center → vault_s (vertical, center bottom)
  {
    id: 'c_hub_vault',
    rect: { x: HUB_X + 8, y: HUB_Y + ROOMS.hub_center.h, w: CORRIDOR_W, h: CORRIDOR_W },
    orientation: 'vertical',
  },
  // den_w → vault_s (diagonal shortcut - actually L-shaped via bottom-left)
  {
    id: 'c_den_vault',
    rect: { x: DEN_X + 5, y: DEN_Y + ROOMS.den_w.h, w: CORRIDOR_W, h: VAULT_Y - (DEN_Y + ROOMS.den_w.h) },
    orientation: 'vertical',
  },
];

/**
 * Generate corridor walls (side walls for each corridor)
 */
function generateCorridorWalls(corridor) {
  const r = corridor.rect;
  const walls = [];
  if (corridor.orientation === 'horizontal') {
    // Top and bottom walls
    walls.push({ x: r.x, y: r.y - 1, w: r.w, h: 1 });
    walls.push({ x: r.x, y: r.y + r.h, w: r.w, h: 1 });
  } else {
    // Left and right walls
    walls.push({ x: r.x - 1, y: r.y, w: 1, h: r.h });
    walls.push({ x: r.x + r.w, y: r.y, w: 1, h: r.h });
  }
  return walls;
}

/**
 * Generate room walls with door openings
 */
function generateRoomWalls(room) {
  const { x, y, w, h, id } = room;
  const walls = [];
  const doorWidth = CORRIDOR_W;

  // Determine which sides have doors based on connected corridors
  const doors = getRoomDoors(id);

  // North wall
  if (doors.N) {
    const doorX = doors.N.offset;
    walls.push({ x, y, w: doorX, h: 1 });
    walls.push({ x: x + doorX + doorWidth, y, w: w - doorX - doorWidth, h: 1 });
  } else {
    walls.push({ x, y, w, h: 1 });
  }

  // South wall
  if (doors.S) {
    const doorX = doors.S.offset;
    walls.push({ x, y: y + h - 1, w: doorX, h: 1 });
    walls.push({ x: x + doorX + doorWidth, y: y + h - 1, w: w - doorX - doorWidth, h: 1 });
  } else {
    walls.push({ x, y: y + h - 1, w, h: 1 });
  }

  // West wall
  if (doors.W) {
    const doorY = doors.W.offset;
    walls.push({ x, y, w: 1, h: doorY });
    walls.push({ x, y: y + doorY + doorWidth, w: 1, h: h - doorY - doorWidth });
  } else {
    walls.push({ x, y, w: 1, h });
  }

  // East wall
  if (doors.E) {
    const doorY = doors.E.offset;
    walls.push({ x: x + w - 1, y, w: 1, h: doorY });
    walls.push({ x: x + w - 1, y: y + doorY + doorWidth, w: 1, h: h - doorY - doorWidth });
  } else {
    walls.push({ x: x + w - 1, y, w: 1, h });
  }

  return walls;
}

/**
 * Get door positions for each room
 */
function getRoomDoors(roomId) {
  const doors = {};
  switch (roomId) {
    case 'stash_nw':
      doors.E = { offset: 4 };   // → alley_n
      doors.S = { offset: 5 };   // → den_w
      break;
    case 'alley_n':
      doors.W = { offset: 4 };   // ← stash_nw (via corridor, relative to alley_n's local Y)
      doors.S = { offset: 8 };   // → hub_center
      break;
    case 'den_w':
      doors.N = { offset: 5 };   // ← stash_nw
      doors.E = { offset: 5 };   // → hub_center
      doors.S = { offset: 5 };   // → vault_s (L-shaped)
      break;
    case 'hub_center':
      doors.N = { offset: 8 };   // ← alley_n
      doors.W = { offset: 5 };   // ← den_w
      doors.E = { offset: 5 };   // → storage_e
      doors.S = { offset: 8 };   // → vault_s
      break;
    case 'storage_e':
      doors.W = { offset: 5 };   // ← hub_center
      break;
    case 'vault_s':
      doors.N = { offset: 8 };   // ← hub_center
      doors.S = { offset: 8 };   // → EXIT
      break;
  }
  return doors;
}

/**
 * Generate obstacles for each room (furniture, crates, market stalls)
 */
function generateRoomObstacles(room) {
  const { x, y, w, h, id } = room;
  const obstacles = [];

  switch (id) {
    case 'stash_nw':
      // Crate stacks along walls
      obstacles.push({ x: x + 1, y: y + 1, w: 3, h: 2 });
      obstacles.push({ x: x + 1, y: y + 5, w: 2, h: 3 });
      obstacles.push({ x: x + w - 4, y: y + 1, w: 3, h: 2 });
      break;

    case 'alley_n':
      // Market stalls (narrow tables)
      obstacles.push({ x: x + 3, y: y + 3, w: 5, h: 1 });
      obstacles.push({ x: x + 3, y: y + 7, w: 5, h: 1 });
      obstacles.push({ x: x + 12, y: y + 3, w: 5, h: 1 });
      obstacles.push({ x: x + 12, y: y + 7, w: 5, h: 1 });
      break;

    case 'den_w':
      // Gambling tables and chairs
      obstacles.push({ x: x + 5, y: y + 5, w: 3, h: 3 });
      obstacles.push({ x: x + 10, y: y + 9, w: 2, h: 2 });
      // Bar counter
      obstacles.push({ x: x + 1, y: y + 11, w: 6, h: 1 });
      break;

    case 'hub_center':
      // Central fountain/statue (meeting point)
      obstacles.push({ x: x + 8, y: y + 8, w: 4, h: 4 });
      // Vendor stalls around edges
      obstacles.push({ x: x + 2, y: y + 2, w: 3, h: 2 });
      obstacles.push({ x: x + 15, y: y + 2, w: 3, h: 2 });
      obstacles.push({ x: x + 2, y: y + 16, w: 3, h: 2 });
      obstacles.push({ x: x + 15, y: y + 16, w: 3, h: 2 });
      break;

    case 'storage_e':
      // Shelving units
      obstacles.push({ x: x + 2, y: y + 2, w: 2, h: 5 });
      obstacles.push({ x: x + 7, y: y + 2, w: 2, h: 5 });
      obstacles.push({ x: x + 2, y: y + 9, w: 2, h: 4 });
      obstacles.push({ x: x + 7, y: y + 9, w: 2, h: 4 });
      break;

    case 'vault_s':
      // Heavy safe and crates (target room)
      obstacles.push({ x: x + 8, y: y + 2, w: 4, h: 3 });  // Main vault
      obstacles.push({ x: x + 1, y: y + 1, w: 3, h: 2 });
      obstacles.push({ x: x + 15, y: y + 1, w: 3, h: 2 });
      obstacles.push({ x: x + 1, y: y + 10, w: 4, h: 3 });
      break;
  }

  return obstacles;
}

/**
 * Generate placeable positions for each room
 */
function generatePlaceable(room) {
  const { x, y, w, h, id } = room;
  const points = [];
  // Generate a grid of candidate positions avoiding edges
  const margin = 2;
  const step = 3;
  for (let ty = margin; ty < h - margin; ty += step) {
    for (let tx = margin; tx < w - margin; tx += step) {
      points.push({ x: x + tx, y: y + ty, roomId: id });
    }
  }
  return points;
}

/**
 * Fill dead zones between rooms with solid walls
 */
function fillDeadZones(walls) {
  // The map is 55×55 tiles. Rooms and corridors occupy specific areas.
  // Everything else should be solid wall (underground rock/concrete).
  // We'll use a bitmap approach: mark all room/corridor tiles, then fill the rest.

  const occupied = new Set();

  // Mark room tiles
  for (const room of PLACEMENTS) {
    for (let ty = room.y; ty < room.y + room.h; ty++) {
      for (let tx = room.x; tx < room.x + room.w; tx++) {
        occupied.add(`${tx},${ty}`);
      }
    }
  }

  // Mark corridor tiles
  for (const c of CORRIDORS) {
    const r = c.rect;
    for (let ty = r.y; ty < r.y + r.h; ty++) {
      for (let tx = r.x; tx < r.x + r.w; tx++) {
        occupied.add(`${tx},${ty}`);
      }
    }
  }

  // Fill unoccupied areas with wall blocks (scan in chunks for efficiency)
  const CHUNK = 5;
  for (let cy = 0; cy < MAP_H; cy += CHUNK) {
    for (let cx = 0; cx < MAP_W; cx += CHUNK) {
      const cw = Math.min(CHUNK, MAP_W - cx);
      const ch = Math.min(CHUNK, MAP_H - cy);
      // Check if entire chunk is unoccupied
      let allEmpty = true;
      for (let ty = cy; ty < cy + ch && allEmpty; ty++) {
        for (let tx = cx; tx < cx + cw && allEmpty; tx++) {
          if (occupied.has(`${tx},${ty}`)) allEmpty = false;
        }
      }
      if (allEmpty) {
        walls.push({ x: cx, y: cy, w: cw, h: ch });
      } else {
        // Check individual tiles
        for (let ty = cy; ty < cy + ch; ty++) {
          for (let tx = cx; tx < cx + cw; tx++) {
            if (!occupied.has(`${tx},${ty}`)) {
              walls.push({ x: tx, y: ty, w: 1, h: 1 });
            }
          }
        }
      }
    }
  }
}

// Room ID to texture key mapping
const ROOM_TEXTURE_MAP = {
  stash_nw:   'bm_01',
  alley_n:    'bm_02',
  den_w:      'bm_03',
  hub_center: 'bm_04',
  storage_e:  'bm_05',
  vault_s:    'bm_06',
};

/**
 * Main entry: compose black market map
 */
export function composeBlackmarketMap() {
  const walls = [];
  const obstacles = [];
  const placeable = [];
  const children = [];

  // 0) Outer border
  walls.push({ x: 0, y: 0, w: MAP_W, h: 1 });
  walls.push({ x: 0, y: MAP_H - 1, w: MAP_W, h: 1 });
  walls.push({ x: 0, y: 0, w: 1, h: MAP_H });
  walls.push({ x: MAP_W - 1, y: 0, w: 1, h: MAP_H });

  // 1) Place rooms
  for (const room of PLACEMENTS) {
    // Room walls
    const roomWalls = generateRoomWalls(room);
    walls.push(...roomWalls);

    // Room obstacles
    const roomObs = generateRoomObstacles(room);
    obstacles.push(...roomObs);

    // Placeable points
    const roomPlaceable = generatePlaceable(room);
    placeable.push(...roomPlaceable);

    // Children (for rendering - use room image texture)
    const textureKey = ROOM_TEXTURE_MAP[room.id];
    children.push({
      id: textureKey || room.id,
      origin: { x: room.x, y: room.y },
      tilesW: room.w,
      tilesH: room.h,
      procedural: !textureKey,  // Use image if texture exists, otherwise procedural
    });
  }

  // 2) Corridors
  for (const c of CORRIDORS) {
    const corridorWalls = generateCorridorWalls(c);
    walls.push(...corridorWalls);

    // Corridor patrol point
    const r = c.rect;
    placeable.push({
      x: Math.floor(r.x + r.w / 2),
      y: Math.floor(r.y + r.h / 2),
      roomId: '__corridor__'
    });

    children.push({
      id: c.id,
      origin: { x: r.x, y: r.y },
      tilesW: r.w,
      tilesH: r.h,
      procedural: true,
    });
  }

  // 3) Fill dead zones
  fillDeadZones(walls);

  // 4) Special positions
  const spawn = { x: VAULT_X + 10, y: VAULT_Y + 12 };  // Enter from vault_s south
  const exit = { x: VAULT_X + 10, y: VAULT_Y + ROOMS.vault_s.h - 2 };

  // 5) Room bounds for guard patrol
  const roomBounds = {};
  for (const room of PLACEMENTS) {
    roomBounds[room.id] = {
      x: room.x + 1,
      y: room.y + 1,
      w: room.w - 2,
      h: room.h - 2,
    };
  }

  // 6) Doorways for decoration
  const doorways = [];
  for (const c of CORRIDORS) {
    const r = c.rect;
    if (c.orientation === 'horizontal') {
      doorways.push({ x: r.x - 1, y: r.y, w: 2, h: r.h, orientation: 'vertical' });
      doorways.push({ x: r.x + r.w - 1, y: r.y, w: 2, h: r.h, orientation: 'vertical' });
    } else {
      doorways.push({ x: r.x, y: r.y - 1, w: r.w, h: 2, orientation: 'horizontal' });
      doorways.push({ x: r.x, y: r.y + r.h - 1, w: r.w, h: 2, orientation: 'horizontal' });
    }
  }

  // 7) Neon light positions (unique to black market)
  const neonLights = [
    { x: HUB_X + 10, y: HUB_Y + 1, color: 0xc070ff, text: '黑市' },
    { x: ALLEY_X + 10, y: ALLEY_Y + 1, color: 0xff4070, text: '赝品巷' },
    { x: DEN_X + 7, y: DEN_Y + 1, color: 0x40ff70, text: '赌坊' },
    { x: STORAGE_X + 6, y: STORAGE_Y + 1, color: 0xffaa30, text: '仓库' },
  ];

  return {
    id: 'composed_blackmarket',
    name: 'Underground Black Market',
    tilesW: MAP_W,
    tilesH: MAP_H,
    tags: ['composed', 'blackmarket'],
    children,
    corridors: CORRIDORS.map(c => ({ ...c.rect, id: c.id })),
    doorways,
    roomBounds,
    walls,
    obstacles,
    placeable,
    neonLights,
    special: {
      playerSpawn: spawn,
      exit,
    },
  };
}

export default composeBlackmarketMap;
