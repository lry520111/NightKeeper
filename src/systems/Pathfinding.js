// 网格 A* 寻路 + 路径平滑
// 用于守卫 AI：把世界像素转成 walkGrid 单元格坐标，跑 A* 出一条 tile 路径，再做"漏斗式"平滑。
//
// walkGrid 是一个二维数组 grid[y][x]：true = 可走，false = 障碍。
// 网格分辨率由调用方决定（推荐 cellSize = 16 或 8 像素，越细越精准但越慢）。

/**
 * 像素 → 网格单元
 */
export function pixelToCell(px, py, cellSize) {
  return {
    x: Math.floor(px / cellSize),
    y: Math.floor(py / cellSize)
  };
}

/**
 * 网格单元 → 世界像素（取格子中心）
 */
export function cellToPixel(cx, cy, cellSize) {
  return {
    x: cx * cellSize + cellSize / 2,
    y: cy * cellSize + cellSize / 2
  };
}

function inBounds(grid, x, y) {
  return y >= 0 && y < grid.length && x >= 0 && x < grid[0].length;
}

function walkable(grid, x, y) {
  return inBounds(grid, x, y) && grid[y][x] === true;
}

/**
 * Bresenham 风格的视线检测：从 (x0,y0) 到 (x1,y1) 是否一路畅通。
 * 用于路径平滑——能直接走到的两点，中间的拐点都可省掉。
 */
export function hasLineOfSight(grid, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1;
  let sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  // 上限保护，防止异常输入造成死循环
  let safety = dx + dy + 4;
  while (safety-- > 0) {
    if (!walkable(grid, x, y)) return false;
    if (x === x1 && y === y1) return true;
    const e2 = err * 2;
    let stepped = false;
    if (e2 > -dy) { err -= dy; x += sx; stepped = true; }
    if (e2 <  dx) { err += dx; y += sy; stepped = true; }
    if (!stepped) return true;
  }
  return false;
}

/**
 * 寻找最近的可走单元（如果传入点本身落在墙里，往外螺旋搜半径 maxRadius 内的格子）
 */
export function nearestWalkable(grid, cx, cy, maxRadius = 6) {
  if (walkable(grid, cx, cy)) return { x: cx, y: cy };
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        // 只取环上的点
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        if (walkable(grid, cx + dx, cy + dy)) return { x: cx + dx, y: cy + dy };
      }
    }
  }
  return null;
}

// 二叉堆（最小堆）—— 比每次 sort 快得多，适合频繁 chase 重算
class MinHeap {
  constructor() { this.data = []; }
  push(node) {
    this.data.push(node);
    this._siftUp(this.data.length - 1);
  }
  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this._siftDown(0);
    }
    return top;
  }
  size() { return this.data.length; }
  _siftUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.data[p].f <= this.data[i].f) break;
      [this.data[p], this.data[i]] = [this.data[i], this.data[p]];
      i = p;
    }
  }
  _siftDown(i) {
    const n = this.data.length;
    while (true) {
      const l = i * 2 + 1;
      const r = i * 2 + 2;
      let s = i;
      if (l < n && this.data[l].f < this.data[s].f) s = l;
      if (r < n && this.data[r].f < this.data[s].f) s = r;
      if (s === i) break;
      [this.data[s], this.data[i]] = [this.data[i], this.data[s]];
      i = s;
    }
  }
}

/**
 * 4 邻域 A* 寻路（避免对角穿墙角）。
 * 返回 tile 数组 [{x,y}, ...]（含起点和终点），找不到返回 null。
 *
 * @param {boolean[][]} grid    grid[y][x] = true 可走
 * @param {number} sx           起点 cell x
 * @param {number} sy           起点 cell y
 * @param {number} tx           终点 cell x
 * @param {number} ty           终点 cell y
 * @param {number} [maxNodes]   节点扩展上限，防止超大地图卡顿
 */
export function findPath(grid, sx, sy, tx, ty, maxNodes = 4000) {
  if (!grid || grid.length === 0) return null;
  const H = grid.length;
  const W = grid[0].length;

  // 起点/终点落墙里就找最近的可走点
  const s = nearestWalkable(grid, sx, sy, 6);
  const t = nearestWalkable(grid, tx, ty, 6);
  if (!s || !t) return null;
  if (s.x === t.x && s.y === t.y) return [{ x: s.x, y: s.y }];

  const open = new MinHeap();
  // 用扁平索引存 cameFrom / gScore，比 Map 快
  const idx = (x, y) => y * W + x;
  const cameFrom = new Int32Array(W * H).fill(-1);
  const gScore = new Float32Array(W * H).fill(Infinity);
  const closed = new Uint8Array(W * H);

  const heur = (x, y) => Math.abs(x - t.x) + Math.abs(y - t.y); // Manhattan
  gScore[idx(s.x, s.y)] = 0;
  open.push({ x: s.x, y: s.y, f: heur(s.x, s.y) });

  const NEI = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let expanded = 0;

  while (open.size() > 0 && expanded < maxNodes) {
    const cur = open.pop();
    const cIdx = idx(cur.x, cur.y);
    if (closed[cIdx]) continue;
    closed[cIdx] = 1;
    expanded++;

    if (cur.x === t.x && cur.y === t.y) {
      // 重建路径
      const path = [];
      let curIdx = cIdx;
      while (curIdx !== -1) {
        const cx = curIdx % W;
        const cy = (curIdx - cx) / W;
        path.push({ x: cx, y: cy });
        curIdx = cameFrom[curIdx];
      }
      return path.reverse();
    }

    for (const [dx, dy] of NEI) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!walkable(grid, nx, ny)) continue;
      const nIdx = idx(nx, ny);
      if (closed[nIdx]) continue;
      const tentative = gScore[cIdx] + 1;
      if (tentative < gScore[nIdx]) {
        cameFrom[nIdx] = cIdx;
        gScore[nIdx] = tentative;
        const f = tentative + heur(nx, ny);
        open.push({ x: nx, y: ny, f });
      }
    }
  }
  return null; // 找不到
}

/**
 * 路径平滑（漏斗算法的简化版）：移除中间能直接看见后继点的拐点
 * 输入 tile 路径，输出更稀疏的关键点路径
 */
export function smoothPath(grid, path) {
  if (!path || path.length <= 2) return path;
  const out = [path[0]];
  let i = 0;
  while (i < path.length - 1) {
    let j = path.length - 1;
    // 从最远一个能直视的点开始接
    while (j > i + 1 && !hasLineOfSight(grid, path[i].x, path[i].y, path[j].x, path[j].y)) {
      j--;
    }
    out.push(path[j]);
    i = j;
  }
  return out;
}

/**
 * 把 tile 路径转成世界像素路径（每个点取格子中心）
 */
export function pathToWorld(path, cellSize) {
  if (!path) return null;
  return path.map((p) => cellToPixel(p.x, p.y, cellSize));
}

/**
 * 一站式：从世界像素起点到终点，返回平滑后的世界像素路径。
 * 失败返回 null。
 */
export function findWorldPath(grid, cellSize, sxPx, syPx, txPx, tyPx) {
  const s = pixelToCell(sxPx, syPx, cellSize);
  const t = pixelToCell(txPx, tyPx, cellSize);
  const tilePath = findPath(grid, s.x, s.y, t.x, t.y);
  if (!tilePath) return null;
  const smoothed = smoothPath(grid, tilePath);
  return pathToWorld(smoothed, cellSize);
}
