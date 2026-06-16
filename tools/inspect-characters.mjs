// inspect-characters.mjs
// One-shot script to analyze the layout of all_characters.png
// Output: row/column projection histogram, detected character blocks
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const inputPath = path.resolve('public/assets/characters/all_characters.png');
console.log('[inspect] reading:', inputPath);

const buf = fs.readFileSync(inputPath);
const png = PNG.sync.read(buf);
const { width, height, data } = png;
console.log(`[inspect] image: ${width} x ${height}, channels=${data.length / (width * height)}`);

// Detect "content" pixels (non-white, non-near-white)
// Threshold: a pixel is "content" if any of R/G/B is below 240
const channels = data.length / (width * height);
function isContent(x, y) {
  const idx = (y * width + x) * channels;
  const r = data[idx], g = data[idx + 1], b = data[idx + 2];
  return r < 235 || g < 235 || b < 235;
}

// Row projection: count of content pixels per row
const rowCount = new Array(height).fill(0);
const colCount = new Array(width).fill(0);
for (let y = 0; y < height; y++) {
  let row = 0;
  for (let x = 0; x < width; x++) {
    if (isContent(x, y)) {
      row++;
      colCount[x]++;
    }
  }
  rowCount[y] = row;
}

// Find horizontal "bands" (continuous rows with content)
function findBands(arr, minSize, threshold) {
  const bands = [];
  let start = -1;
  for (let i = 0; i < arr.length; i++) {
    const active = arr[i] > threshold;
    if (active && start < 0) start = i;
    else if (!active && start >= 0) {
      if (i - start >= minSize) bands.push([start, i - 1]);
      start = -1;
    }
  }
  if (start >= 0 && arr.length - start >= minSize) bands.push([start, arr.length - 1]);
  return bands;
}

const rowBands = findBands(rowCount, 20, 5);
console.log(`\n[inspect] horizontal bands (rows with content), threshold=5px, minSize=20:`);
rowBands.forEach((b, i) => {
  console.log(`  band ${i}: y=${b[0]}..${b[1]}, height=${b[1] - b[0] + 1}`);
});

// For each horizontal band, find vertical sub-bands (column projection within that band)
console.log(`\n[inspect] per-band column analysis:`);
rowBands.forEach((band, bi) => {
  const [y0, y1] = band;
  const localCol = new Array(width).fill(0);
  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < width; x++) {
      if (isContent(x, y)) localCol[x]++;
    }
  }
  const colBands = findBands(localCol, 20, 3);
  console.log(`  band ${bi} (y=${y0}..${y1}): found ${colBands.length} column blocks`);
  colBands.forEach((cb, ci) => {
    const [x0, x1] = cb;
    console.log(`    block ${ci}: x=${x0}..${x1}, w=${x1 - x0 + 1}, h=${y1 - y0 + 1}`);
  });
});

// Sample a few pixel colors to detect background
console.log(`\n[inspect] corner pixel samples (RGB):`);
const samples = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1], [width >> 1, height >> 1]];
for (const [x, y] of samples) {
  const idx = (y * width + x) * channels;
  console.log(`  (${x},${y}) = rgb(${data[idx]}, ${data[idx + 1]}, ${data[idx + 2]})`);
}
