// LevelGenerator - 博物馆关卡程序化生成
// 输入：种子 + 地图尺寸；输出：墙体瓦片表、文物点、守卫巡逻路径、撤离点
// 设计目标：每局布局不同，但保证从左上出生点到右下撤离点必然连通
//
// 返回结构：
// {
//   walls:       Set<string>     键 "x,y"
//   relicSpawns: Array<{x,y,relicIdx}>
//   exit:        {x,y}
//   spawn:       {x,y}
//   guardPaths:  Array<Array<{x,y}>>   每条 = 一名守卫的巡逻点（瓦片坐标）
//   rooms:       Array<{x,y,w,h}>      仅供调试/装饰参考
// }

// ——————————————————————————————————————
//  伪随机：基于种子的 mulberry32
// ——————————————————————————————————————
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const k = (x, y) => `${x},${y}`;

/**
 * 主生成入口
 * @param {object} opts
 * @param {number} opts.width   地图宽（瓦片）
 * @param {number} opts.height  地图高（瓦片）
 * @param {number} opts.seed    种子（默认 Date.now()）
 * @param {number} opts.relicCount  目标文物数量（默认 7）
 * @param {number} opts.relicPoolSize  文物池大小（用于随机 relicIdx，默认 7）
 * @param {number} opts.guardCount  守卫数量（默认 3）
 */
export function generateLevel(opts) {
  const W = opts.width;
  const H = opts.height;
  const seed = (opts.seed ?? Date.now()) >>> 0;
  const rng = makeRng(seed);
  const relicCount = opts.relicCount ?? 7;
  const relicPoolSize = opts.relicPoolSize ?? 7;
  const guardCount = opts.guardCount ?? 3;

  const walls = new Set();

  // 1. 外圈墙
  for (let x = 0; x < W; x++) {
    walls.add(k(x, 0));
    walls.add(k(x, H - 1));
  }
  for (let y = 0; y < H; y++) {
    walls.add(k(0, y));
    walls.add(k(W - 1, y));
  }

  // 2. 内部分隔：把内部 (1..W-2, 1..H-2) 分成几个矩形展厅
  // 用一条横向主走廊（水平隔墙）+ 若干竖向隔墙划分上下两层
  const innerLeft = 1;
  const innerRight = W - 2;
  const innerTop = 1;
  const innerBottom = H - 2;

  // 横向主隔墙位置（中央偏移随机）
  const midRow = Math.floor((innerTop + innerBottom) / 2) + (Math.floor(rng() * 3) - 1);

  // 竖向隔墙数量（2~3 道）
  const vCount = 2 + (rng() < 0.5 ? 0 : 1);
  const vCols = pickDistinctCols(rng, vCount, innerLeft + 4, innerRight - 4, 5);

  // 上层水平段：在 (innerTop+1, midRow-1) 之间画竖墙
  for (const col of vCols) {
    for (let y = innerTop; y < midRow; y++) walls.add(k(col, y));
  }
  // 下层水平段
  // 用不同的列分割，使布局不对称
  const vColsBottom = pickDistinctCols(rng, vCount, innerLeft + 4, innerRight - 4, 5);
  for (const col of vColsBottom) {
    for (let y = midRow + 1; y <= innerBottom; y++) walls.add(k(col, y));
  }

  // 中间那行水平隔墙
  for (let x = innerLeft; x <= innerRight; x++) walls.add(k(x, midRow));

  // 3. 在每段隔墙上随机开门（去掉一格）
  // 上层每条竖隔墙开 1~2 扇门
  for (const col of vCols) {
    const doorCount = 1 + (rng() < 0.4 ? 1 : 0);
    const doors = pickDistinctYs(rng, doorCount, innerTop + 1, midRow - 1);
    for (const dy of doors) walls.delete(k(col, dy));
  }
  for (const col of vColsBottom) {
    const doorCount = 1 + (rng() < 0.4 ? 1 : 0);
    const doors = pickDistinctYs(rng, doorCount, midRow + 1, innerBottom - 1);
    for (const dy of doors) walls.delete(k(col, dy));
  }
  // 中间水平隔墙开 2~3 扇门
  const hDoorCount = 2 + Math.floor(rng() * 2);
  const hDoors = pickDistinctYs(rng, hDoorCount, innerLeft + 2, innerRight - 2);
  for (const dx of hDoors) walls.delete(k(dx, midRow));

  // 4. 出生点 / 撤离点
  // 出生：左上区域；撤离：右下区域
  const spawn = { x: 2, y: 2 };
  const exit = { x: W - 3, y: H - 3 };
  // 强制清空出生点和撤离点周围 1 格
  clearArea(walls, spawn.x - 1, spawn.y - 1, 3, 3, W, H);
  clearArea(walls, exit.x - 1, exit.y - 1, 3, 3, W, H);

  // 5. 连通性校验：从 spawn 洪水填充，检查能到 exit
  // 不通则在中间水平隔墙再开一扇门重试，最多 5 次
  let attempt = 0;
  while (!isConnected(walls, spawn, exit, W, H) && attempt < 8) {
    // 在中间水平隔墙再开一扇随机门
    const dx = innerLeft + 1 + Math.floor(rng() * (innerRight - innerLeft - 2));
    walls.delete(k(dx, midRow));
    // 同时给所有竖隔墙再加一扇门
    for (const col of vCols) {
      const dy = innerTop + 1 + Math.floor(rng() * (midRow - innerTop - 1));
      walls.delete(k(col, dy));
    }
    for (const col of vColsBottom) {
      const dy = midRow + 1 + Math.floor(rng() * (innerBottom - midRow - 1));
      walls.delete(k(col, dy));
    }
    attempt++;
  }

  // 6. 计算"房间"区域：上下层的格子按竖隔墙切分
  const upperRooms = splitIntoRooms(innerLeft, innerTop, innerRight, midRow - 1, vCols);
  const lowerRooms = splitIntoRooms(innerLeft, midRow + 1, innerRight, innerBottom, vColsBottom);
  const rooms = [...upperRooms, ...lowerRooms];

  // 7. 在每个房间里挑可用空地放文物
  // 排除：墙体、出生点附近 4 格、撤离点附近 3 格
  const blocked = new Set(walls);
  forEachInRect(spawn.x - 2, spawn.y - 2, 4, 4, (x, y) => blocked.add(k(x, y)));
  forEachInRect(exit.x - 2, exit.y - 2, 3, 3, (x, y) => blocked.add(k(x, y)));

  const relicSpawns = [];
  const usedRelicIdx = new Set();
  const candidateRooms = shuffleArr(rooms.slice(), rng);
  let relicNeed = relicCount;
  for (const room of candidateRooms) {
    if (relicNeed <= 0) break;
    // 每个房间 1~2 件
    const want = 1 + (rng() < 0.4 ? 1 : 0);
    for (let i = 0; i < want && relicNeed > 0; i++) {
      const cell = pickRoomCell(room, blocked, rng, relicSpawns);
      if (!cell) break;
      let idx;
      // 文物种类尽量不重复
      let tries = 0;
      do {
        idx = Math.floor(rng() * relicPoolSize);
        tries++;
      } while (usedRelicIdx.has(idx) && tries < 12 && usedRelicIdx.size < relicPoolSize);
      usedRelicIdx.add(idx);
      relicSpawns.push({ x: cell.x, y: cell.y, relicIdx: idx });
      blocked.add(k(cell.x, cell.y));
      relicNeed--;
    }
  }

  // 若房间不够，回退到全图随机
  while (relicNeed > 0) {
    const x = 2 + Math.floor(rng() * (W - 4));
    const y = 2 + Math.floor(rng() * (H - 4));
    if (blocked.has(k(x, y))) continue;
    const idx = Math.floor(rng() * relicPoolSize);
    relicSpawns.push({ x, y, relicIdx: idx });
    blocked.add(k(x, y));
    relicNeed--;
  }

  // 8. 守卫巡逻路径：从房间集合里挑几个，用矩形周长四角作为巡逻点
  const guardRooms = pickGuardRooms(rooms, guardCount, rng, spawn);
  const guardPaths = guardRooms.map((room) => buildPatrolPath(room, walls, W, H));

  return {
    walls,
    relicSpawns,
    exit,
    spawn,
    guardPaths,
    rooms,
    seed,
    midRow,
    vColsTop: vCols,
    vColsBottom
  };
}

// ——————————————————————————————————————
//  辅助函数
// ——————————————————————————————————————
function pickDistinctCols(rng, count, lo, hi, minGap) {
  const picks = [];
  let tries = 0;
  while (picks.length < count && tries < 80) {
    const c = lo + Math.floor(rng() * (hi - lo + 1));
    if (picks.every((p) => Math.abs(p - c) >= minGap)) picks.push(c);
    tries++;
  }
  picks.sort((a, b) => a - b);
  return picks;
}

function pickDistinctYs(rng, count, lo, hi) {
  if (lo > hi) return [];
  const picks = new Set();
  let tries = 0;
  while (picks.size < count && tries < 40) {
    picks.add(lo + Math.floor(rng() * (hi - lo + 1)));
    tries++;
  }
  return [...picks];
}

function clearArea(walls, x0, y0, w, h, W, H) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (x <= 0 || y <= 0 || x >= W - 1 || y >= H - 1) continue;
      walls.delete(k(x, y));
    }
  }
}

function isConnected(walls, a, b, W, H) {
  const visited = new Set();
  const queue = [a];
  visited.add(k(a.x, a.y));
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length) {
    const c = queue.shift();
    if (c.x === b.x && c.y === b.y) return true;
    for (const [dx, dy] of dirs) {
      const nx = c.x + dx;
      const ny = c.y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const key = k(nx, ny);
      if (visited.has(key)) continue;
      if (walls.has(key)) continue;
      visited.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return false;
}

function splitIntoRooms(left, top, right, bottom, divCols) {
  if (top > bottom) return [];
  const rooms = [];
  const sortedCols = [...divCols].sort((a, b) => a - b);
  let prev = left;
  for (const c of sortedCols) {
    if (c - prev >= 2) {
      rooms.push({ x: prev, y: top, w: c - prev, h: bottom - top + 1 });
    }
    prev = c + 1;
  }
  if (right - prev >= 1) {
    rooms.push({ x: prev, y: top, w: right - prev + 1, h: bottom - top + 1 });
  }
  return rooms;
}

function forEachInRect(x, y, w, h, fn) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) fn(xx, yy);
  }
}

function pickRoomCell(room, blocked, rng, existing) {
  for (let tries = 0; tries < 30; tries++) {
    const x = room.x + Math.floor(rng() * room.w);
    const y = room.y + Math.floor(rng() * room.h);
    if (blocked.has(k(x, y))) continue;
    // 不要离已有文物太近
    let tooClose = false;
    for (const e of existing) {
      if (Math.abs(e.x - x) + Math.abs(e.y - y) < 3) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    return { x, y };
  }
  return null;
}

function shuffleArr(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickGuardRooms(rooms, count, rng, spawn) {
  // 优先选离出生点远的房间；再随机
  const sorted = [...rooms].sort((A, B) => {
    const da = Math.abs(A.x + A.w / 2 - spawn.x) + Math.abs(A.y + A.h / 2 - spawn.y);
    const db = Math.abs(B.x + B.w / 2 - spawn.x) + Math.abs(B.y + B.h / 2 - spawn.y);
    return db - da;
  });
  // 取前 N+1 个再洗牌挑 N 个，保持随机性
  const pool = sorted.slice(0, Math.min(sorted.length, count + 2));
  shuffleArr(pool, rng);
  return pool.slice(0, Math.min(count, pool.length));
}

function buildPatrolPath(room, walls, W, H) {
  // 在房间内取一个收缩 1 格的矩形四角，过滤掉踩到墙的角
  const x0 = Math.max(1, room.x + 1);
  const y0 = Math.max(1, room.y + 1);
  const x1 = Math.min(W - 2, room.x + room.w - 2);
  const y1 = Math.min(H - 2, room.y + room.h - 2);

  // 房间太小直接退化为中心来回
  if (x1 <= x0 || y1 <= y0) {
    const cx = Math.floor((room.x + room.x + room.w - 1) / 2);
    const cy = Math.floor((room.y + room.y + room.h - 1) / 2);
    return [{ x: cx, y: cy }, { x: Math.min(cx + 1, W - 2), y: cy }];
  }

  const corners = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 }
  ].filter((p) => !walls.has(k(p.x, p.y)));

  if (corners.length >= 2) return corners;
  // 极端兜底
  return [{ x: x0, y: y0 }, { x: x1, y: y1 }];
}
