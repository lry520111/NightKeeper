// split-characters.mjs
// Split all_characters.png (1254x1254) into 5 individual character spritesheets.
// Layout (auto-detected by inspect-characters.mjs):
//   Upper half (y=63..591, 4 rows): 2 character blocks, each 6 cols x 4 rows
//     - Left  block (x≈24..570)   = player_idle  (6 frames idle anim x 4 directions? actually treat as 6-frame run)
//     - Right block (x≈660..1224) = player_run   (6 frames run anim x 4 directions)
//   Lower half (y=691..1227, 4 rows): 3 character blocks, each 5 cols x 4 rows
//     - Left   (x≈ 0..400)   = guard
//     - Middle (x≈400..820)  = thug
//     - Right  (x≈820..1254) = sailor
//
// Each output PNG is a clean spritesheet with white background made transparent.
//
// Usage: node tools/split-characters.mjs

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const INPUT = path.resolve('public/assets/characters/all_characters.png');
const OUT_DIR = path.resolve('public/assets/characters/Characters_free');

console.log('[split] reading:', INPUT);
const src = PNG.sync.read(fs.readFileSync(INPUT));
console.log(`[split] source: ${src.width} x ${src.height}, channels=${src.data.length / (src.width * src.height)}`);

const SRC_CH = src.data.length / (src.width * src.height);

// ==== Whitespace -> alpha helper ====
// 三级处理：
//   1) 纯白 (min(R,G,B) >= 245)              → alpha = 0
//   2) 近白 (min(R,G,B) in [215, 245))       → alpha 渐变 (0..255)，去除反走样白边
//   3) 其它                                  → alpha 保持原值
// 这样既能彻底去掉白底，又能让角色边缘平滑过渡，避免"白色光环"。
const PURE_WHITE_MIN = 245;
const NEAR_WHITE_MIN = 215;

function whitenessAlpha(r, g, b) {
  const m = Math.min(r, g, b);
  if (m >= PURE_WHITE_MIN) return 0;
  if (m >= NEAR_WHITE_MIN) {
    // 线性渐变：m=245 → α=0，m=215 → α=255
    const t = (PURE_WHITE_MIN - m) / (PURE_WHITE_MIN - NEAR_WHITE_MIN);
    return Math.max(0, Math.min(255, Math.round(t * 255)));
  }
  return 255;
}

// Read RGB(A) at (x,y) from src
function readPixel(x, y) {
  const idx = (y * src.width + x) * SRC_CH;
  return [src.data[idx], src.data[idx + 1], src.data[idx + 2], SRC_CH === 4 ? src.data[idx + 3] : 255];
}

// ==== Block definitions (auto-derived from inspect data) ====
// Upper half: 4 row bands at y=[63,185], [204,321], [340,457], [475,591]
// We use a unified upper region: y=50..600 (covers all 4 rows + a bit padding)
const UPPER_Y0 = 50;
const UPPER_Y1 = 600;

// Lower half: 4 row bands at y=[691,813], [835,950], [972,1090], [1110,1227]
// Unified region: y=680..1240
const LOWER_Y0 = 680;
const LOWER_Y1 = 1240;

// Upper X: left block ~24..570 (6 cols), right block ~670..1225 (6 cols)
// We pick generous bounds so frames align with content centers.
// Frame width = blockW / 6, frame height = blockH / 4
// Force integer-divisible frame sizes by snapping bounds.
function alignBlock(x0, x1, y0, y1, cols, rows) {
  // Adjust width to be divisible by cols
  let w = x1 - x0;
  let h = y1 - y0;
  w = w - (w % cols);
  h = h - (h % rows);
  return { x: x0, y: y0, w, h, cols, rows, fw: w / cols, fh: h / rows };
}

const blocks = {
  player_idle: alignBlock(20, 580, UPPER_Y0, UPPER_Y1, 6, 4),
  player_run:  alignBlock(665, 1225, UPPER_Y0, UPPER_Y1, 6, 4),
  guard:       alignBlock(15, 395, LOWER_Y0, LOWER_Y1, 5, 4),
  thug:        alignBlock(415, 815, LOWER_Y0, LOWER_Y1, 5, 4),
  sailor:      alignBlock(825, 1230, LOWER_Y0, LOWER_Y1, 5, 4),
};

// ==== Crop one block out, white→transparent (with edge feather) ====
function cropBlock(name, b) {
  const out = new PNG({ width: b.w, height: b.h });
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const sx = b.x + x;
      const sy = b.y + y;
      const [r, g, b0, a] = readPixel(sx, sy);
      const dst = (y * b.w + x) * 4;
      const wAlpha = whitenessAlpha(r, g, b0);
      out.data[dst] = r;
      out.data[dst + 1] = g;
      out.data[dst + 2] = b0;
      // 取原 alpha 与白底剔除 alpha 的较小值
      out.data[dst + 3] = Math.min(a, wAlpha);
    }
  }
  const outPath = path.join(OUT_DIR, name + '.png');
  fs.writeFileSync(outPath, PNG.sync.write(out));
  console.log(`[split] wrote ${name}.png  → block ${b.w}x${b.h}, frame ${b.fw}x${b.fh} (cols=${b.cols} rows=${b.rows})`);
  return { name, ...b, file: outPath };
}

console.log('\n[split] cropping...');
const results = {};
for (const [name, b] of Object.entries(blocks)) {
  results[name] = cropBlock(name, b);
}

// ==== Print BootScene loader hints ====
console.log('\n[split] suggested BootScene loader code:');
console.log('-----------------------------------------');
for (const [name, b] of Object.entries(blocks)) {
  console.log(`this.load.spritesheet('hero_${name}', 'assets/characters/Characters_free/${name}.png', { frameWidth: ${b.fw}, frameHeight: ${b.fh} });`);
}
console.log('-----------------------------------------');
console.log('\n[split] done.');
