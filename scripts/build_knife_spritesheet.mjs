// 将 others/持刀1-sprites/ 下的单帧图片合并为精灵表
// 布局：12行 × 5列，116×123 每帧
// Row 0-3: walk_down/right/up/left (5帧)
// Row 4-7: idle_down/right/up/left (4帧+补白)
// Row 8-11: attack_down/right/up/left (4帧+补白)

import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '..', 'others', '持刀1-sprites');
const outDir = join(__dirname, '..', 'public', 'assets', 'characters', 'hero');

mkdirSync(outDir, { recursive: true });

const FRAME_W = 116;
const FRAME_H = 123;
const COLS = 5;
const ROWS = 12;

// 文件名映射规则
const rowDefs = [
  // [dirname, filePattern, count]
  { dir: 'down',  pattern: '向下走',     count: 5 },  // row 0
  { dir: 'right', pattern: '向右走',     count: 5 },  // row 1
  { dir: 'up',    pattern: '向上走',     count: 5 },  // row 2
  { dir: 'left',  pattern: '向左走',     count: 5 },  // row 3
  { dir: 'down',  pattern: '向下时待机', count: 4 },  // row 4
  { dir: 'right', pattern: '向右时待机', count: 4 },  // row 5
  { dir: 'up',    pattern: '向上时待机', count: 4 },  // row 6
  { dir: 'left',  pattern: '向左时待机', count: 4 },  // row 7
  { dir: 'down',  pattern: '向下挥刀',   count: 4 },  // row 8
  { dir: 'right', pattern: '向右挥刀',   count: 4 },  // row 9
  { dir: 'up',    pattern: '向上挥刀',   count: 4 },  // row 10
  { dir: 'left',  pattern: '向左挥刀',   count: 4 },  // row 11
];

// 列出源文件夹所有文件
const allFiles = readdirSync(srcDir).filter(f => f.endsWith('.png'));

// 按行定义组装帧文件路径
const framePaths = [];
for (const rowDef of rowDefs) {
  const { pattern, count } = rowDef;
  for (let i = 1; i <= count; i++) {
    const fileName = `${pattern}${i}.png`;
    const filePath = join(srcDir, fileName);
    if (allFiles.includes(fileName)) {
      framePaths.push(filePath);
    } else {
      console.error(`Missing file: ${fileName}`);
      process.exit(1);
    }
  }
  // 补白到5列（用透明帧）
  for (let i = count; i < COLS; i++) {
    framePaths.push(null);
  }
}

console.log(`Total frames: ${framePaths.filter(Boolean).length}, null pads: ${framePaths.filter(f => f === null).length}`);

// 创建输出画布
const canvasW = COLS * FRAME_W;
const canvasH = ROWS * FRAME_H;

// 读取所有帧为 Buffer
const frameBuffers = await Promise.all(
  framePaths.map(async (path) => {
    if (path === null) {
      // 创建透明帧
      return await sharp({
        create: {
          width: FRAME_W,
          height: FRAME_H,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      }).png().toBuffer();
    }
    // 读取并确保为 RGBA PNG，统一尺寸
    return await sharp(path)
      .resize(FRAME_W, FRAME_H, { fit: 'fill' })
      .ensureAlpha()
      .png()
      .toBuffer();
  })
);

// 组合：逐行逐列将帧拼到合成图
const compositeImages = [];
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const idx = row * COLS + col;
    if (idx < frameBuffers.length) {
      compositeImages.push({
        input: frameBuffers[idx],
        top: row * FRAME_H,
        left: col * FRAME_W,
      });
    }
  }
}

const outPath = join(outDir, 'hongfa_knife.png');
await sharp({
  create: {
    width: canvasW,
    height: canvasH,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  }
})
  .composite(compositeImages)
  .png()
  .toFile(outPath);

console.log(`Sprite sheet saved: ${outPath} (${canvasW}x${canvasH})`);

// 生成动画名映射
function getAnimName(def) {
  if (def.pattern.includes('走')) return `walk_${def.dir}`;
  if (def.pattern.includes('待机')) return `idle_${def.dir}`;
  if (def.pattern.includes('挥刀')) return `attack_${def.dir}`;
  return def.pattern;
}

// 也输出一份元数据 JSON，方便后续查阅
const meta = {
  frameWidth: FRAME_W,
  frameHeight: FRAME_H,
  columns: COLS,
  rows: ROWS,
  totalWidth: canvasW,
  totalHeight: canvasH,
  animations: rowDefs.map((def, row) => ({
    row,
    animation: getAnimName(def),
    frames: def.count,
    startFrame: row * COLS,
    endFrame: row * COLS + def.count - 1,
  })),
};

const metaPath = join(outDir, 'hongfa_knife.json');
writeFileSync(metaPath, JSON.stringify(meta, null, 2));
console.log(`Metadata saved: ${metaPath}`);
