// composeShipMap.js
// ——————————————————————————————————————————————————
// Smuggler Ship "沉鲸号" map composer
//
// Layout concept: A long narrow cargo ship with multiple decks/sections.
// The ship is oriented vertically (bow at top, stern at bottom).
// Players enter from the stern (bottom) and must reach the bow cargo hold.
//
// Layout (tile coordinates, 1 tile = 32px):
//
//   ┌─────────────────────────────────┐
//   │         bow_hold (18×12)        │  ← Target: main cargo
//   └───────────────┬─────────────────┘
//                   │ hatch
//   ┌───────┐  ┌───┴───────┐  ┌───────┐
//   │crew_L │──│ mid_deck  │──│crew_R │
//   │(10×10)│  │ (18×14)   │  │(10×10)│
//   └───────┘  └─────┬─────┘  └───────┘
//                     │ ladder
//   ┌───────┐  ┌─────┴─────┐  ┌───────┐
//   │engine │──│ cargo_hold│──│armory │
//   │(10×12)│  │ (18×16)   │  │(10×12)│
//   └───────┘  └─────┬─────┘  └───────┘
//                     │ gangway
//              ┌──────┴──────┐
//              │  stern_deck │  ← Entry point
//              │  (18×10)    │
//              └─────────────┘
//
// Total: 8 rooms connected by hatches/ladders
// Ship width: ~42 tiles, height: ~68 tiles
// ——————————————————————————————————————————————————

// ===== Layout Constants =====
const CORRIDOR_W = 3;  // Very narrow ship passages (hatches)

// Room dimensions
const ROOMS = {
  bow_hold:   { w: 18, h: 12 },
  crew_l:     { w: 10, h: 10 },
  mid_deck:   { w: 18, h: 14 },
  crew_r:     { w: 10, h: 10 },
  engine:     { w: 10, h: 12 },
  cargo_hold: { w: 18, h: 16 },
  armory:     { w: 10, h: 12 },
  stern_deck: { w: 18, h: 10 },
};

// Compute positions (center-aligned ship body)
const SIDE_W = ROOMS.crew_l.w;  // 10
const CENTER_W = ROOMS.mid_deck.w;  // 18
const SHIP_W = SIDE_W + CORRIDOR_W + CENTER_W + CORRIDOR_W + SIDE_W;  // 10+3+18+3+10 = 44

const LEFT_X = 0;
const CENTER_X = SIDE_W + CORRIDOR_W;  // 13
const RIGHT_X = CENTER_X + CENTER_W + CORRIDOR_W;  // 13+18+3 = 34

// Vertical positions (top to bottom)
const BOW_Y = 0;
const MID_Y = ROOMS.bow_hold.h + CORRIDOR_W;  // 12+3 = 15
const CARGO_Y = MID_Y + ROOMS.mid_deck.h + CORRIDOR_W;  // 15+14+3 = 32
const STERN_Y = CARGO_Y + ROOMS.cargo_hold.h + CORRIDOR_W;  // 32+16+3 = 51

// Bow hold is centered (no side rooms at top)
const BOW_X = CENTER_X;  // 13

const MAP_W = SHIP_W;  // 44
const MAP_H = STERN_Y + ROOMS.stern_deck.h;  // 51+10 = 61

// Room placements
const PLACEMENTS = [
  { id: 'bow_hold',   x: BOW_X,    y: BOW_Y,   w: ROOMS.bow_hold.w,   h: ROOMS.bow_hold.h },
  { id: 'crew_l',     x: LEFT_X,   y: MID_Y,   w: ROOMS.crew_l.w,     h: ROOMS.crew_l.h },
  { id: 'mid_deck',   x: CENTER_X, y: MID_Y,   w: ROOMS.mid_deck.w,   h: ROOMS.mid_deck.h },
  { id: 'crew_r',     x: RIGHT_X,  y: MID_Y,   w: ROOMS.crew_r.w,     h: ROOMS.crew_r.h },
  { id: 'engine',     x: LEFT_X,   y: CARGO_Y, w: ROOMS.engine.w,      h: ROOMS.engine.h },
  { id: 'cargo_hold', x: CENTER_X, y: CARGO_Y, w: ROOMS.cargo_hold.w,  h: ROOMS.cargo_hold.h },
  { id: 'armory',     x: RIGHT_X,  y: CARGO_Y, w: ROOMS.armory.w,      h: ROOMS.armory.h },
  { id: 'stern_deck', x: CENTER_X, y: STERN_Y, w: ROOMS.stern_deck.w,  h: ROOMS.stern_deck.h },
];

// Corridor/hatch definitions
const CORRIDORS = [
  // bow_hold → mid_deck (vertical hatch)
  {
    id: 'hatch_bow_mid',
    rect: { x: CENTER_X + 7, y: BOW_Y + ROOMS.bow_hold.h, w: CORRIDOR_W, h: CORRIDOR_W },
    orientation: 'vertical',
  },
  // crew_l → mid_deck (horizontal passage)
  {
    id: 'pass_crewl_mid',
    rect: { x: LEFT_X + ROOMS.crew_l.w, y: MID_Y + 3, w: CORRIDOR_W, h: CORRIDOR_W },
    orientation: 'horizontal',
  },
  // mid_deck → crew_r (horizontal passage)
  {
    id: 'pass_mid_crewr',
    rect: { x: CENTER_X + ROOMS.mid_deck.w, y: MID_Y + 3, w: CORRIDOR_W, h: CORRIDOR_W },
    orientation: 'horizontal',
  },
  // mid_deck → cargo_hold (vertical ladder)
  {
    id: 'ladder_mid_cargo',
    rect: { x: CENTER_X + 7, y: MID_Y + ROOMS.mid_deck.h, w: CORRIDOR_W, h: CORRIDOR_W },
    orientation: 'vertical',
  },
  // engine → cargo_hold (horizontal)
  {
    id: 'pass_engine_cargo',
    rect: { x: LEFT_X + ROOMS.engine.w, y: CARGO_Y + 4, w: CORRIDOR_W, h: CORRIDOR_W },
    orientation: 'horizontal',
  },
  // cargo_hold → armory (horizontal)
  {
    id: 'pass_cargo_armory',
    rect: { x: CENTER_X + ROOMS.cargo_hold.w, y: CARGO_Y + 4, w: CORRIDOR_W, h: CORRIDOR_W },
    orientation: 'horizontal',
  },
  // cargo_hold → stern_deck (vertical gangway)
  {
    id: 'gangway_cargo_stern',
    rect: { x: CENTER_X + 7, y: CARGO_Y + ROOMS.cargo_hold.h, w: CORRIDOR_W, h: CORRIDOR_W },
    orientation: 'vertical',
  },
];

/**
 * Generate corridor walls
 */
function generateCorridorWalls(corridor) {
  const r = corridor.rect;
  const walls = [];
  if (corridor.orientation === 'horizontal') {
    walls.push({ x: r.x, y: r.y - 1, w: r.w, h: 1 });
    walls.push({ x: r.x, y: r.y + r.h, w: r.w, h: 1 });
  } else {
    walls.push({ x: r.x - 1, y: r.y, w: 1, h: r.h });
    walls.push({ x: r.x + r.w, y: r.y, w: 1, h: r.h });
  }
  return walls;
}

/**
 * Get door positions for each room
 */
function getRoomDoors(roomId) {
  const doors = {};
  switch (roomId) {
    case 'bow_hold':
      doors.S = { offset: 7 };   // → mid_deck
      break;
    case 'crew_l':
      doors.E = { offset: 3 };   // → mid_deck
      break;
    case 'mid_deck':
      doors.N = { offset: 7 };   // ← bow_hold
      doors.W = { offset: 3 };   // ← crew_l
      doors.E = { offset: 3 };   // → crew_r
      doors.S = { offset: 7 };   // → cargo_hold
      break;
    case 'crew_r':
      doors.W = { offset: 3 };   // ← mid_deck
      break;
    case 'engine':
      doors.E = { offset: 4 };   // → cargo_hold
      break;
    case 'cargo_hold':
      doors.N = { offset: 7 };   // ← mid_deck
      doors.W = { offset: 4 };   // ← engine
      doors.E = { offset: 4 };   // → armory
      doors.S = { offset: 7 };   // → stern_deck
      break;
    case 'armory':
      doors.W = { offset: 4 };   // ← cargo_hold
      break;
    case 'stern_deck':
      doors.N = { offset: 7 };   // ← cargo_hold
      break;
  }
  return doors;
}

/**
 * Generate room walls with door openings
 */
function generateRoomWalls(room) {
  const { x, y, w, h, id } = room;
  const walls = [];
  const doorWidth = CORRIDOR_W;
  const doors = getRoomDoors(id);

  // North wall
  if (doors.N) {
    const doorX = doors.N.offset;
    if (doorX > 0) walls.push({ x, y, w: doorX, h: 1 });
    if (doorX + doorWidth < w) walls.push({ x: x + doorX + doorWidth, y, w: w - doorX - doorWidth, h: 1 });
  } else {
    walls.push({ x, y, w, h: 1 });
  }

  // South wall
  if (doors.S) {
    const doorX = doors.S.offset;
    if (doorX > 0) walls.push({ x, y: y + h - 1, w: doorX, h: 1 });
    if (doorX + doorWidth < w) walls.push({ x: x + doorX + doorWidth, y: y + h - 1, w: w - doorX - doorWidth, h: 1 });
  } else {
    walls.push({ x, y: y + h - 1, w, h: 1 });
  }

  // West wall
  if (doors.W) {
    const doorY = doors.W.offset;
    if (doorY > 0) walls.push({ x, y, w: 1, h: doorY });
    if (doorY + doorWidth < h) walls.push({ x, y: y + doorY + doorWidth, w: 1, h: h - doorY - doorWidth });
  } else {
    walls.push({ x, y, w: 1, h });
  }

  // East wall
  if (doors.E) {
    const doorY = doors.E.offset;
    if (doorY > 0) walls.push({ x: x + w - 1, y, w: 1, h: doorY });
    if (doorY + doorWidth < h) walls.push({ x: x + w - 1, y: y + doorY + doorWidth, w: 1, h: h - doorY - doorWidth });
  } else {
    walls.push({ x: x + w - 1, y, w: 1, h });
  }

  return walls;
}

/**
 * Generate obstacles for each room
 */
function generateRoomObstacles(room) {
  const { x, y, w, h, id } = room;
  const obstacles = [];

  switch (id) {
    case 'bow_hold':
      // Large cargo containers
      obstacles.push({ x: x + 2, y: y + 2, w: 4, h: 3 });
      obstacles.push({ x: x + 12, y: y + 2, w: 4, h: 3 });
      obstacles.push({ x: x + 7, y: y + 7, w: 4, h: 3 });
      break;

    case 'crew_l':
      // Bunk beds
      obstacles.push({ x: x + 1, y: y + 1, w: 3, h: 2 });
      obstacles.push({ x: x + 1, y: y + 4, w: 3, h: 2 });
      obstacles.push({ x: x + 1, y: y + 7, w: 3, h: 2 });
      break;

    case 'mid_deck':
      // Navigation table center
      obstacles.push({ x: x + 7, y: y + 5, w: 4, h: 3 });
      // Pillars (structural supports)
      obstacles.push({ x: x + 3, y: y + 3, w: 1, h: 1 });
      obstacles.push({ x: x + 14, y: y + 3, w: 1, h: 1 });
      obstacles.push({ x: x + 3, y: y + 10, w: 1, h: 1 });
      obstacles.push({ x: x + 14, y: y + 10, w: 1, h: 1 });
      break;

    case 'crew_r':
      // Lockers and supplies
      obstacles.push({ x: x + 6, y: y + 1, w: 3, h: 2 });
      obstacles.push({ x: x + 6, y: y + 4, w: 3, h: 2 });
      obstacles.push({ x: x + 6, y: y + 7, w: 3, h: 2 });
      break;

    case 'engine':
      // Engine machinery
      obstacles.push({ x: x + 2, y: y + 2, w: 6, h: 4 });
      // Pipes
      obstacles.push({ x: x + 1, y: y + 8, w: 2, h: 3 });
      obstacles.push({ x: x + 7, y: y + 8, w: 2, h: 3 });
      break;

    case 'cargo_hold':
      // Stacked crates (main loot area)
      obstacles.push({ x: x + 2, y: y + 2, w: 3, h: 3 });
      obstacles.push({ x: x + 13, y: y + 2, w: 3, h: 3 });
      obstacles.push({ x: x + 2, y: y + 10, w: 3, h: 3 });
      obstacles.push({ x: x + 13, y: y + 10, w: 3, h: 3 });
      // Center aisle clear for movement
      obstacles.push({ x: x + 7, y: y + 6, w: 4, h: 4 });
      break;

    case 'armory':
      // Weapon racks
      obstacles.push({ x: x + 1, y: y + 1, w: 8, h: 1 });
      obstacles.push({ x: x + 1, y: y + 5, w: 8, h: 1 });
      obstacles.push({ x: x + 1, y: y + 9, w: 8, h: 1 });
      break;

    case 'stern_deck':
      // Railing and anchor mechanism
      obstacles.push({ x: x + 2, y: y + 1, w: 14, h: 1 });
      // Winch
      obstacles.push({ x: x + 8, y: y + 5, w: 2, h: 2 });
      break;
  }

  return obstacles;
}

/**
 * Generate placeable positions
 */
function generatePlaceable(room) {
  const { x, y, w, h, id } = room;
  const points = [];
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
 * Fill dead zones (areas outside the ship hull)
 */
function fillDeadZones(walls) {
  const occupied = new Set();

  for (const room of PLACEMENTS) {
    for (let ty = room.y; ty < room.y + room.h; ty++) {
      for (let tx = room.x; tx < room.x + room.w; tx++) {
        occupied.add(`${tx},${ty}`);
      }
    }
  }

  for (const c of CORRIDORS) {
    const r = c.rect;
    for (let ty = r.y; ty < r.y + r.h; ty++) {
      for (let tx = r.x; tx < r.x + r.w; tx++) {
        occupied.add(`${tx},${ty}`);
      }
    }
  }

  const CHUNK = 5;
  for (let cy = 0; cy < MAP_H; cy += CHUNK) {
    for (let cx = 0; cx < MAP_W; cx += CHUNK) {
      const cw = Math.min(CHUNK, MAP_W - cx);
      const ch = Math.min(CHUNK, MAP_H - cy);
      let allEmpty = true;
      for (let ty = cy; ty < cy + ch && allEmpty; ty++) {
        for (let tx = cx; tx < cx + cw && allEmpty; tx++) {
          if (occupied.has(`${tx},${ty}`)) allEmpty = false;
        }
      }
      if (allEmpty) {
        walls.push({ x: cx, y: cy, w: cw, h: ch });
      } else {
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
  bow_hold:   'ss_02',  // cargo hold image for bow
  crew_l:     'ss_03',  // crew quarters
  mid_deck:   'ss_01',  // main deck
  crew_r:     'ss_08',  // lounge / right crew area
  engine:     'ss_06',  // engine room
  cargo_hold: 'ss_05',  // captain cabin / main cargo
  armory:     'ss_07',  // armory / storage
  stern_deck: 'ss_04',  // stern corridor / entry deck
};

/**
 * Main entry: compose smuggler ship map
 */
export function composeShipMap() {
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
    const roomWalls = generateRoomWalls(room);
    walls.push(...roomWalls);

    const roomObs = generateRoomObstacles(room);
    obstacles.push(...roomObs);

    const roomPlaceable = generatePlaceable(room);
    placeable.push(...roomPlaceable);

    // Use room image texture
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

  // 3) Fill dead zones (ocean/hull exterior)
  fillDeadZones(walls);

  // 4) Special positions
  const spawn = { x: CENTER_X + 9, y: STERN_Y + 7 };  // Stern deck entry
  const exit = { x: CENTER_X + 9, y: STERN_Y + ROOMS.stern_deck.h - 2 };

  // 5) Room bounds
  const roomBounds = {};
  for (const room of PLACEMENTS) {
    roomBounds[room.id] = {
      x: room.x + 1,
      y: room.y + 1,
      w: room.w - 2,
      h: room.h - 2,
    };
  }

  // 6) Doorways
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

  // 7) Water zones (unique to ship - areas that slow player)
  const waterZones = [
    // Engine room has water leaks
    { x: LEFT_X + 3, y: CARGO_Y + 7, w: 5, h: 4 },
    // Cargo hold bilge water
    { x: CENTER_X + 6, y: CARGO_Y + 12, w: 6, h: 3 },
  ];

  // 8) Porthole positions (decorative light sources)
  const portholes = [
    { x: CENTER_X, y: MID_Y + 4 },
    { x: CENTER_X + ROOMS.mid_deck.w - 1, y: MID_Y + 4 },
    { x: CENTER_X, y: MID_Y + 10 },
    { x: CENTER_X + ROOMS.mid_deck.w - 1, y: MID_Y + 10 },
    { x: CENTER_X, y: CARGO_Y + 5 },
    { x: CENTER_X + ROOMS.cargo_hold.w - 1, y: CARGO_Y + 5 },
    { x: CENTER_X, y: CARGO_Y + 11 },
    { x: CENTER_X + ROOMS.cargo_hold.w - 1, y: CARGO_Y + 11 },
  ];

  return {
    id: 'composed_ship',
    name: 'Smuggler Ship 沉鲸号',
    tilesW: MAP_W,
    tilesH: MAP_H,
    tags: ['composed', 'ship'],
    children,
    corridors: CORRIDORS.map(c => ({ ...c.rect, id: c.id })),
    doorways,
    roomBounds,
    walls,
    obstacles,
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
