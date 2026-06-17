// composeShipMap.js
// ——————————————————————————————————————————————————
// Smuggler Ship "沉鲸号" map composer — Full-map PNG version
//
// Uses a single pre-rendered full map image (ship_full.png, 1070×1470px)
// Collision walls are placed ONLY where visible walls exist in the artwork.
// Doors (yellow-striped openings) are left passable.
//
// Image: 1070 × 1470 px
// Tile size: 32px → effective grid: ~33.4 × 45.9 tiles
// We use MAP_W=34, MAP_H=46 tiles (1088×1472 world px)
//
// Coordinate system: tile (0,0) = top-left of image
// ——————————————————————————————————————————————————

const TILE = 32;
const MAP_W = 34;
const MAP_H = 46;

// ===== Room Bounds (logical areas for gameplay) =====
const ROOM_BOUNDS = {
  bridge:           { x: 3, y: 2, w: 28, h: 6 },    // Section 1: Bridge/wheelhouse
  security_office:  { x: 2, y: 9, w: 5, h: 9 },     // Section 2: Left security office
  vault_main:       { x: 8, y: 9, w: 18, h: 9 },    // Section 2: Main relic vault
  captain_quarters: { x: 27, y: 9, w: 5, h: 9 },    // Section 2: Right captain's quarters
  crew_quarters:    { x: 2, y: 20, w: 9, h: 9 },    // Section 3: Left crew quarters
  operations:       { x: 12, y: 20, w: 10, h: 9 },   // Section 3: Center operations room
  armory:           { x: 23, y: 20, w: 9, h: 9 },    // Section 3: Right armory
  engine_room:      { x: 2, y: 31, w: 9, h: 9 },    // Section 4: Left engine room
  cargo_hold:       { x: 12, y: 31, w: 10, h: 9 },   // Section 4: Center cargo hold
  storage:          { x: 23, y: 31, w: 9, h: 9 },    // Section 4: Right storage
  stern_deck:       { x: 2, y: 42, w: 30, h: 3 },    // Section 5: Stern entry deck
};

// ===== Wall Definitions =====
// ONLY placed where actual walls are visible in the artwork.
// Each wall segment is broken at door openings so players can pass through.
function generateWalls() {
  const walls = [];

  // ============================================================
  // OUTER HULL — follows the ship's visible boundary
  // ============================================================

  // --- Top bow (curved, approximated as stepped blocks) ---
  // The bow narrows at the top. From the image:
  // Row 0-1: only center ~20 tiles are hull roof
  walls.push({ x: 5, y: 0, w: 24, h: 1 });   // Very top edge
  // Row 1: hull sides taper in
  walls.push({ x: 3, y: 1, w: 2, h: 1 });    // Left bow curve
  walls.push({ x: 29, y: 1, w: 2, h: 1 });   // Right bow curve

  // --- Left hull wall (y=2 to y=44) ---
  walls.push({ x: 1, y: 2, w: 1, h: 42 });

  // --- Right hull wall (y=2 to y=44) ---
  walls.push({ x: 32, y: 2, w: 1, h: 42 });

  // --- Bottom stern ---
  walls.push({ x: 2, y: 44, w: 30, h: 1 });  // Bottom edge
  // Bottom corners
  walls.push({ x: 1, y: 44, w: 1, h: 1 });
  walls.push({ x: 32, y: 44, w: 1, h: 1 });

  // ============================================================
  // SECTION 1→2 DIVIDER (y=8, between bridge and vault level)
  // From image: horizontal wall at y=8 with 3 door openings
  // Doors visible at approximately: x=8-9, x=16-17, x=24-25
  // ============================================================
  walls.push({ x: 2, y: 8, w: 6, h: 1 });    // Left of door 1 (x=2..7)
  // DOOR at x=8..9
  walls.push({ x: 10, y: 8, w: 6, h: 1 });   // Between door 1 and 2 (x=10..15)
  // DOOR at x=16..17
  walls.push({ x: 18, y: 8, w: 6, h: 1 });   // Between door 2 and 3 (x=18..23)
  // DOOR at x=24..25
  walls.push({ x: 26, y: 8, w: 6, h: 1 });   // Right of door 3 (x=26..31)

  // ============================================================
  // SECTION 2 INTERNAL VERTICAL WALLS
  // Left wall (security office | vault): x=7, from y=9 to y=18
  // Door opening at approximately y=12..14
  // ============================================================
  walls.push({ x: 7, y: 9, w: 1, h: 3 });    // Top segment (y=9..11)
  // DOOR at y=12..14
  walls.push({ x: 7, y: 15, w: 1, h: 3 });   // Bottom segment (y=15..17)

  // Right wall (vault | captain's quarters): x=26, from y=9 to y=18
  // Door opening at approximately y=12..14
  walls.push({ x: 26, y: 9, w: 1, h: 3 });   // Top segment (y=9..11)
  // DOOR at y=12..14
  walls.push({ x: 26, y: 15, w: 1, h: 3 });  // Bottom segment (y=15..17)

  // ============================================================
  // SECTION 2→3 DIVIDER (y=19, between vault level and ops level)
  // From image: horizontal wall at y=19 with 4 door openings
  // Doors at approximately: x=5-6, x=13-14, x=19-20, x=27-28
  // ============================================================
  walls.push({ x: 2, y: 19, w: 3, h: 1 });   // x=2..4
  // DOOR at x=5..6
  walls.push({ x: 7, y: 19, w: 6, h: 1 });   // x=7..12
  // DOOR at x=13..14
  walls.push({ x: 15, y: 19, w: 4, h: 1 });  // x=15..18
  // DOOR at x=19..20
  walls.push({ x: 21, y: 19, w: 6, h: 1 });  // x=21..26
  // DOOR at x=27..28
  walls.push({ x: 29, y: 19, w: 3, h: 1 });  // x=29..31

  // ============================================================
  // SECTION 3 INTERNAL VERTICAL WALLS
  // Left wall (crew | operations): x=11, from y=20 to y=29
  // Door opening at approximately y=23..25
  // ============================================================
  walls.push({ x: 11, y: 20, w: 1, h: 3 });  // Top segment (y=20..22)
  // DOOR at y=23..25
  walls.push({ x: 11, y: 26, w: 1, h: 3 });  // Bottom segment (y=26..28)

  // Right wall (operations | armory): x=22, from y=20 to y=29
  // Door opening at approximately y=23..25
  walls.push({ x: 22, y: 20, w: 1, h: 3 });  // Top segment (y=20..22)
  // DOOR at y=23..25
  walls.push({ x: 22, y: 26, w: 1, h: 3 });  // Bottom segment (y=26..28)

  // ============================================================
  // SECTION 3→4 DIVIDER (y=30, between ops level and cargo level)
  // From image: horizontal wall at y=30 with 4 door openings
  // Doors at approximately: x=5-6, x=13-14, x=19-20, x=27-28
  // ============================================================
  walls.push({ x: 2, y: 30, w: 3, h: 1 });   // x=2..4
  // DOOR at x=5..6
  walls.push({ x: 7, y: 30, w: 6, h: 1 });   // x=7..12
  // DOOR at x=13..14
  walls.push({ x: 15, y: 30, w: 4, h: 1 });  // x=15..18
  // DOOR at x=19..20
  walls.push({ x: 21, y: 30, w: 6, h: 1 });  // x=21..26
  // DOOR at x=27..28
  walls.push({ x: 29, y: 30, w: 3, h: 1 });  // x=29..31

  // ============================================================
  // SECTION 4 INTERNAL VERTICAL WALLS
  // Left wall (engine | cargo): x=11, from y=31 to y=40
  // Door opening at approximately y=34..36
  // ============================================================
  walls.push({ x: 11, y: 31, w: 1, h: 3 });  // Top segment (y=31..33)
  // DOOR at y=34..36
  walls.push({ x: 11, y: 37, w: 1, h: 3 });  // Bottom segment (y=37..39)

  // Right wall (cargo | storage): x=22, from y=31 to y=40
  // Door opening at approximately y=34..36
  walls.push({ x: 22, y: 31, w: 1, h: 3 });  // Top segment (y=31..33)
  // DOOR at y=34..36
  walls.push({ x: 22, y: 37, w: 1, h: 3 });  // Bottom segment (y=37..39)

  // ============================================================
  // SECTION 4→5 DIVIDER (y=41, between cargo level and stern deck)
  // From image: horizontal wall at y=41 with 3 door openings
  // Doors at approximately: x=8-9, x=16-17, x=24-25
  // ============================================================
  walls.push({ x: 2, y: 41, w: 6, h: 1 });   // Left of door 1 (x=2..7)
  // DOOR at x=8..9
  walls.push({ x: 10, y: 41, w: 6, h: 1 });  // Between door 1 and 2 (x=10..15)
  // DOOR at x=16..17
  walls.push({ x: 18, y: 41, w: 6, h: 1 });  // Between door 2 and 3 (x=18..23)
  // DOOR at x=24..25
  walls.push({ x: 26, y: 41, w: 6, h: 1 });  // Right of door 3 (x=26..31)

  return walls;
}

// ===== Obstacle Definitions (furniture, machinery — from artwork) =====
// These are passable-blocking objects visible in the image
function generateObstacles() {
  const obs = [];

  // --- Section 1: Bridge ---
  // Top instrument panel row (visible equipment along top wall)
  obs.push({ x: 5, y: 2, w: 24, h: 2 });

  // --- Section 2: Vault ---
  // Central vault safe (large dark object at top-center of vault)
  obs.push({ x: 14, y: 9, w: 5, h: 2 });
  // Glass display cases (6 visible cyan-glowing cases)
  obs.push({ x: 9, y: 12, w: 2, h: 2 });    // Case 1
  obs.push({ x: 12, y: 12, w: 2, h: 2 });   // Case 2
  obs.push({ x: 18, y: 12, w: 2, h: 2 });   // Case 3
  obs.push({ x: 21, y: 12, w: 2, h: 2 });   // Case 4
  obs.push({ x: 10, y: 15, w: 2, h: 2 });   // Case 5
  obs.push({ x: 20, y: 15, w: 2, h: 2 });   // Case 6

  // Security office furniture (left room)
  obs.push({ x: 2, y: 10, w: 3, h: 2 });    // Monitor bank
  obs.push({ x: 2, y: 15, w: 3, h: 2 });    // Equipment rack

  // Captain's quarters furniture (right room)
  obs.push({ x: 28, y: 10, w: 3, h: 2 });   // Desk
  obs.push({ x: 28, y: 15, w: 3, h: 2 });   // Bed/cabinet

  // --- Section 3: Operations level ---
  // Crew quarters - bunks (left room)
  obs.push({ x: 2, y: 21, w: 3, h: 2 });    // Bunk row 1
  obs.push({ x: 2, y: 24, w: 3, h: 2 });    // Bunk row 2
  obs.push({ x: 6, y: 21, w: 3, h: 2 });    // Lockers

  // Operations room - central table + pillars
  obs.push({ x: 15, y: 23, w: 3, h: 3 });   // Planning table
  obs.push({ x: 13, y: 21, w: 1, h: 1 });   // Pillar
  obs.push({ x: 20, y: 21, w: 1, h: 1 });   // Pillar
  obs.push({ x: 13, y: 27, w: 1, h: 1 });   // Pillar
  obs.push({ x: 20, y: 27, w: 1, h: 1 });   // Pillar

  // Armory (right room)
  obs.push({ x: 24, y: 21, w: 7, h: 1 });   // Weapon rack top
  obs.push({ x: 24, y: 25, w: 3, h: 2 });   // Workbench
  obs.push({ x: 29, y: 25, w: 2, h: 2 });   // Ammo crates

  // --- Section 4: Cargo level ---
  // Engine room (left room)
  obs.push({ x: 2, y: 32, w: 4, h: 4 });    // Main engine
  obs.push({ x: 2, y: 37, w: 3, h: 2 });    // Pipes

  // Cargo hold (center room) - crate clusters
  obs.push({ x: 13, y: 32, w: 2, h: 2 });   // Crates top-left
  obs.push({ x: 19, y: 32, w: 2, h: 2 });   // Crates top-right
  obs.push({ x: 13, y: 37, w: 2, h: 2 });   // Crates bottom-left
  obs.push({ x: 19, y: 37, w: 2, h: 2 });   // Crates bottom-right
  obs.push({ x: 16, y: 35, w: 1, h: 1 });   // Center crate

  // Storage (right room)
  obs.push({ x: 24, y: 32, w: 7, h: 1 });   // Shelving
  obs.push({ x: 24, y: 36, w: 3, h: 2 });   // Locked crates
  obs.push({ x: 29, y: 37, w: 2, h: 2 });   // Corner crates

  // --- Section 5: Stern deck ---
  // Winch mechanism (center)
  obs.push({ x: 15, y: 42, w: 3, h: 2 });

  return obs;
}

// ===== Doorway Definitions (passable openings in walls) =====
function generateDoorways() {
  const doorways = [];

  // Section 1→2 doors (y=8, 3 openings)
  doorways.push({ x: 8, y: 8, w: 2, h: 1, orientation: 'horizontal' });
  doorways.push({ x: 16, y: 8, w: 2, h: 1, orientation: 'horizontal' });
  doorways.push({ x: 24, y: 8, w: 2, h: 1, orientation: 'horizontal' });

  // Section 2 vertical doors
  doorways.push({ x: 7, y: 12, w: 1, h: 3, orientation: 'vertical' });   // Security → Vault
  doorways.push({ x: 26, y: 12, w: 1, h: 3, orientation: 'vertical' });  // Vault → Captain

  // Section 2→3 doors (y=19, 4 openings)
  doorways.push({ x: 5, y: 19, w: 2, h: 1, orientation: 'horizontal' });
  doorways.push({ x: 13, y: 19, w: 2, h: 1, orientation: 'horizontal' });
  doorways.push({ x: 19, y: 19, w: 2, h: 1, orientation: 'horizontal' });
  doorways.push({ x: 27, y: 19, w: 2, h: 1, orientation: 'horizontal' });

  // Section 3 vertical doors
  doorways.push({ x: 11, y: 23, w: 1, h: 3, orientation: 'vertical' });  // Crew → Ops
  doorways.push({ x: 22, y: 23, w: 1, h: 3, orientation: 'vertical' });  // Ops → Armory

  // Section 3→4 doors (y=30, 4 openings)
  doorways.push({ x: 5, y: 30, w: 2, h: 1, orientation: 'horizontal' });
  doorways.push({ x: 13, y: 30, w: 2, h: 1, orientation: 'horizontal' });
  doorways.push({ x: 19, y: 30, w: 2, h: 1, orientation: 'horizontal' });
  doorways.push({ x: 27, y: 30, w: 2, h: 1, orientation: 'horizontal' });

  // Section 4 vertical doors
  doorways.push({ x: 11, y: 34, w: 1, h: 3, orientation: 'vertical' });  // Engine → Cargo
  doorways.push({ x: 22, y: 34, w: 1, h: 3, orientation: 'vertical' });  // Cargo → Storage

  // Section 4→5 doors (y=41, 3 openings)
  doorways.push({ x: 8, y: 41, w: 2, h: 1, orientation: 'horizontal' });
  doorways.push({ x: 16, y: 41, w: 2, h: 1, orientation: 'horizontal' });
  doorways.push({ x: 24, y: 41, w: 2, h: 1, orientation: 'horizontal' });

  return doorways;
}

// ===== Placeable Positions (for items, enemies, loot) =====
function generatePlaceable() {
  const points = [];
  for (const [roomId, bounds] of Object.entries(ROOM_BOUNDS)) {
    const margin = 2;
    const step = 3;
    for (let ty = bounds.y + margin; ty < bounds.y + bounds.h - margin; ty += step) {
      for (let tx = bounds.x + margin; tx < bounds.x + bounds.w - margin; tx += step) {
        points.push({ x: tx, y: ty, roomId });
      }
    }
  }
  return points;
}

// ===== Water Zones =====
function generateWaterZones() {
  return [
    { x: 5, y: 36, w: 4, h: 3 },   // Engine room leaks
    { x: 15, y: 38, w: 3, h: 2 },   // Cargo hold bilge
  ];
}

// ===== Porthole Positions =====
function generatePortholes() {
  return [
    { x: 1, y: 12 }, { x: 1, y: 16 },
    { x: 1, y: 23 }, { x: 1, y: 27 },
    { x: 1, y: 34 }, { x: 1, y: 38 },
    { x: 32, y: 12 }, { x: 32, y: 16 },
    { x: 32, y: 23 }, { x: 32, y: 27 },
    { x: 32, y: 34 }, { x: 32, y: 38 },
  ];
}

/**
 * Main entry: compose smuggler ship map
 */
export function composeShipMap() {
  const walls = generateWalls();
  const obstacles = generateObstacles();
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

  const spawn = { x: 17, y: 43 };   // Stern deck center
  const exit = { x: 17, y: 44 };    // Bottom gangway

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
    children,
    corridors,
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
