// HubLayout - generated from others/hub_02_20260617_044649_861.
// Source annotations: hub_02_20260618_013010_307_annotations.json

export const ROOM_W = 1280;
export const ROOM_H = 720;

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

// Red-box centers from the provided 1143x640 screenshot, converted to 1280x720 canvas space.
export const HUB_ANCHORS = {
  contract: { x: 254, y: 253 },
  loadout:  { x: 1042, y: 295 },
  vault:    { x: 256, y: 540 },
  depart:   { x: 1045, y: 616 },
  curator:  { x: 640, y: 427 },
  player:   { x: 650, y: 527 },
};

export const HUB_COLLIDERS = [];

export const HUB_PHYS_BOUNDS = {
  x: 40,
  y: 67,
  w: 1200,
  h: 613,
};

export const HUB_INTERACT_RADIUS = 120;

export const HUB_GRID = { cols: 32, rows: 16, tileSize: 32, offsetX: 0, offsetY: 0 };

const HUB_GODOT_COLLIDER_SOURCE_RECTS = [
  {
    x: 77,
    y: 758,
    w: 33,
    h: 36,
    tag: "godot_collision_01"
  },
  {
    x: 1471,
    y: 322,
    w: 51,
    h: 61,
    tag: "godot_collision_02"
  },
  {
    x: 1228,
    y: 797,
    w: 34,
    h: 36,
    tag: "godot_collision_03"
  },
  {
    x: 1448,
    y: 798,
    w: 41,
    h: 37,
    tag: "godot_collision_04"
  },
  {
    x: 1490,
    y: 748,
    w: 51,
    h: 66,
    tag: "godot_collision_05"
  },
  {
    x: 1168,
    y: 768,
    w: 53,
    h: 48,
    tag: "godot_collision_06"
  },
  {
    x: 190,
    y: 306,
    w: 56,
    h: 97,
    tag: "godot_collision_07"
  },
  {
    x: 218,
    y: 286,
    w: 234,
    h: 54,
    tag: "godot_collision_08"
  },
  {
    x: 252,
    y: 345,
    w: 33,
    h: 42,
    tag: "godot_collision_09"
  },
  {
    x: 310,
    y: 343,
    w: 37,
    h: 28,
    tag: "godot_collision_10"
  },
  {
    x: 371,
    y: 343,
    w: 39,
    h: 38,
    tag: "godot_collision_11"
  },
  {
    x: 419,
    y: 343,
    w: 42,
    h: 41,
    tag: "godot_collision_12"
  },
  {
    x: 458,
    y: 293,
    w: 50,
    h: 111,
    tag: "godot_collision_13"
  },
  {
    x: 154,
    y: 326,
    w: 26,
    h: 47,
    tag: "godot_collision_14"
  },
  {
    x: 655,
    y: 304,
    w: 373,
    h: 101,
    tag: "godot_collision_15"
  },
  {
    x: 1216,
    y: 303,
    w: 237,
    h: 104,
    tag: "godot_collision_16"
  },
  {
    x: 1566,
    y: 446,
    w: 47,
    h: 57,
    tag: "godot_collision_17"
  },
  {
    x: 1559,
    y: 264,
    w: 45,
    h: 40,
    tag: "godot_collision_18"
  },
  {
    x: 1154,
    y: 260,
    w: 40,
    h: 43,
    tag: "godot_collision_19"
  },
  {
    x: 1223,
    y: 735,
    w: 267,
    h: 64,
    tag: "godot_collision_20"
  },
  {
    x: 1560,
    y: 762,
    w: 35,
    h: 34,
    tag: "godot_collision_21"
  },
  {
    x: 55,
    y: 450,
    w: 49,
    h: 50,
    tag: "godot_collision_22"
  },
  {
    x: 163,
    y: 637,
    w: 293,
    h: 86,
    tag: "godot_collision_23"
  },
  {
    x: 805,
    y: 286,
    w: 60,
    h: 29,
    tag: "godot_collision_24"
  },
  {
    x: 67,
    y: 260,
    w: 45,
    h: 44,
    tag: "godot_collision_25"
  },
  {
    x: 484,
    y: 256,
    w: 39,
    h: 43,
    tag: "godot_collision_26"
  }
];

export const HUB_GODOT_COLLIDERS = HUB_GODOT_COLLIDER_SOURCE_RECTS.map(fromSourceRect);

const HUB_OCCLUSION_SOURCE_RECTS = [
  {
    x: 1478,
    y: 565,
    w: 48,
    h: 139,
    tag: "godot_adjust_01"
  },
  {
    x: 1497,
    y: 666,
    w: 40,
    h: 79,
    tag: "godot_adjust_02"
  },
  {
    x: 1184,
    y: 572,
    w: 45,
    h: 137,
    tag: "godot_adjust_03"
  },
  {
    x: 1162,
    y: 708,
    w: 56,
    h: 57,
    tag: "godot_adjust_04"
  },
  {
    x: 76,
    y: 662,
    w: 37,
    h: 96,
    tag: "godot_adjust_05"
  },
  {
    x: 1555,
    y: 367,
    w: 65,
    h: 82,
    tag: "godot_adjust_06"
  },
  {
    x: 1549,
    y: 173,
    w: 58,
    h: 87,
    tag: "godot_adjust_07"
  },
  {
    x: 1464,
    y: 235,
    w: 65,
    h: 108,
    tag: "godot_adjust_08"
  },
  {
    x: 1212,
    y: 150,
    w: 243,
    h: 153,
    tag: "godot_adjust_09"
  },
  {
    x: 1146,
    y: 181,
    w: 51,
    h: 94,
    tag: "godot_adjust_10"
  },
  {
    x: 1223,
    y: 529,
    w: 270,
    h: 236,
    tag: "godot_adjust_11"
  },
  {
    x: 1559,
    y: 660,
    w: 36,
    h: 110,
    tag: "godot_adjust_12"
  },
  {
    x: 51,
    y: 366,
    w: 56,
    h: 97,
    tag: "godot_adjust_13"
  },
  {
    x: 160,
    y: 514,
    w: 298,
    h: 123,
    tag: "godot_adjust_14"
  },
  {
    x: 659,
    y: 254,
    w: 371,
    h: 94,
    tag: "godot_adjust_15"
  },
  {
    x: 805,
    y: 220,
    w: 62,
    h: 74,
    tag: "godot_adjust_16"
  },
  {
    x: 154,
    y: 243,
    w: 30,
    h: 81,
    tag: "godot_adjust_17"
  },
  {
    x: 201,
    y: 154,
    w: 266,
    h: 150,
    tag: "godot_adjust_18"
  },
  {
    x: 65,
    y: 171,
    w: 51,
    h: 99,
    tag: "godot_adjust_19"
  },
  {
    x: 471,
    y: 180,
    w: 54,
    h: 81,
    tag: "godot_adjust_20"
  }
];

export const HUB_OCCLUSION_REGIONS = HUB_OCCLUSION_SOURCE_RECTS.map(fromSourceRect);
