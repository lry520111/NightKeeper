// LevelGenerator - 追回任务关卡程序化生成
// 输入：种子 + 地图尺寸；输出：墙体瓦片表、文物点、容器点、守卫巡逻路径、撤离点
// 设计目标：每局布局不同，但保证从左上出生点到右下撤离点必然连通
//
// 返回结构：
// {
//   walls:        Set<string>     键 "x,y"
//   relicSpawns:  Array<{x,y,relicIdx, containerKind?}>  裸露或装在某个容器里
//   containers:   Array<{x,y,kind, relicIdx?, lootKind?, code?}>
//                 kind ∈ 'plain' | 'safe' | 'puzzle' | 'trap'
//                 装了文物的容器由 relicIdx 存在；装补给品的则是 lootKind
//                 puzzle 容器附带 4 位随机密码字符串
//   exit:         {x,y}
//   spawn:        {x,y}
//   guardPaths:   Array<Array<{x,y}>>
//   rooms:        Array<{x,y,w,h}>
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

  // 竖向隔墙数量（2~3 道）—— 用于把上下两层各自切成多个房间
  // 注：内部墙在 MuseumScene.spawnWall 中以缩小碰撞盒方式呈现，不会影响玩家走位
  const INTERIOR_WALLS = true;
  const vCount = 2 + (rng() < 0.5 ? 0 : 1);
  const vCols = pickDistinctCols(rng, vCount, innerLeft + 4, innerRight - 4, 5);
  const vColsBottom = pickDistinctCols(rng, vCount, innerLeft + 4, innerRight - 4, 5);

  if (INTERIOR_WALLS) {
    // 上层水平段：在 (innerTop+1, midRow-1) 之间画竖墙
    for (const col of vCols) {
      for (let y = innerTop; y < midRow; y++) walls.add(k(col, y));
    }
    // 下层水平段（用不同的列分割，使布局不对称）
    for (const col of vColsBottom) {
      for (let y = midRow + 1; y <= innerBottom; y++) walls.add(k(col, y));
    }
  }

  // 中间那行水平隔墙（"大走廊"的墙，保留以保留地图层次感）
  for (let x = innerLeft; x <= innerRight; x++) walls.add(k(x, midRow));

  // —— 额外结构：在大走廊上下各加一段"短伸墙 / 门框柱"，丰富空间层次 ——
  // 上层：在每个上层房间里随机加一段从顶墙下垂的短墙（长度 2~3，距顶 1 格留呼吸）
  if (INTERIOR_WALLS) {
    addStubWalls(walls, rng, innerLeft, innerTop, innerRight, midRow - 1, vCols, 'top');
    addStubWalls(walls, rng, innerLeft, midRow + 1, innerRight, innerBottom, vColsBottom, 'bottom');
  }

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
  const containers = [];
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
      // 70% 装在容器里；30% 裸露
      const inContainer = rng() < 0.7;
      if (inContainer) {
        // 装有文物的容器：按品级权重决定类型
        // 高价值文物更可能在保险柜/密码锁里
        const kind = pickRelicContainerKind(rng);
        const c = makeContainer(cell.x, cell.y, kind, rng);
        c.relicIdx = idx;
        containers.push(c);
      } else {
        relicSpawns.push({ x: cell.x, y: cell.y, relicIdx: idx });
      }
      blocked.add(k(cell.x, cell.y));
      relicNeed--;
    }
  }

  // 若房间不够，回退到全图随机裸放
  while (relicNeed > 0) {
    const x = 2 + Math.floor(rng() * (W - 4));
    const y = 2 + Math.floor(rng() * (H - 4));
    if (blocked.has(k(x, y))) continue;
    const idx = Math.floor(rng() * relicPoolSize);
    relicSpawns.push({ x, y, relicIdx: idx });
    blocked.add(k(x, y));
    relicNeed--;
  }

  // 7b. 额外生成一批"补给箱 / 陷阱箱"（不装文物，只为丰富搜索体验）
  // 数量 ≈ 地图房间数的 60%，随机挥在房间内
  const extraCount = Math.max(2, Math.floor(rooms.length * 0.6));
  let extraNeed = extraCount;
  let safety = 0;
  while (extraNeed > 0 && safety < 80) {
    safety++;
    const room = candidateRooms[safety % candidateRooms.length];
    if (!room) break;
    const cell = pickRoomCell(room, blocked, rng, [...relicSpawns, ...containers]);
    if (!cell) continue;
    const kind = pickLootContainerKind(rng);
    const c = makeContainer(cell.x, cell.y, kind, rng);
    c.lootKind = pickLootKind(rng);
    containers.push(c);
    blocked.add(k(cell.x, cell.y));
    extraNeed--;
  }

  // 8. 守卫巡逻路径：从房间集合里挑几个，用矩形周长四角作为巡逻点
  const guardRooms = pickGuardRooms(rooms, guardCount, rng, spawn);
  const guardPaths = guardRooms.map((room) => buildPatrolPath(room, walls, W, H));

  return {
    walls,
    relicSpawns,
    containers,
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

/**
 * 在房间内部撒一些"短伸墙 / 门框柱"，丰富空间层次但保证不阻断主通道。
 * 形式：从房间外边缘（顶/底）向内延伸长度 2~3 的短墙，居中位置避开竖隔墙列。
 * @param {Set<string>} walls 当前墙体集合（会被修改）
 * @param {() => number} rng
 * @param {number} left 房间区段左边界
 * @param {number} top  房间区段上边界
 * @param {number} right 房间区段右边界
 * @param {number} bottom 房间区段下边界
 * @param {number[]} divCols 该层的竖隔墙列（避开）
 * @param {'top'|'bottom'} side 决定从哪一侧伸出
 */
function addStubWalls(walls, rng, left, top, right, bottom, divCols, side) {
  if (top > bottom || left >= right) return;
  const blockedCols = new Set(divCols);
  // 把每段连续可用列拆成"段"，每段挑 0~1 个位置加短墙
  let runStart = -1;
  const segments = [];
  for (let x = left + 2; x <= right - 1; x++) {
    if (blockedCols.has(x)) {
      if (runStart >= 0) segments.push([runStart, x - 1]);
      runStart = -1;
    } else {
      if (runStart < 0) runStart = x;
    }
  }
  if (runStart >= 0) segments.push([runStart, right - 1]);

  for (const [s, e] of segments) {
    const segLen = e - s + 1;
    if (segLen < 4) continue; // 段太短就不放
    // 该段最多 1 个短墙位
    if (rng() > 0.7) continue; // 30% 概率放
    // 选一个居中偏随机的列
    const col = s + 2 + Math.floor(rng() * Math.max(1, segLen - 4));
    // 长度 2~3，避免到正中（中间是大走廊通道）
    const len = 2 + (rng() < 0.5 ? 0 : 1);
    if (side === 'top') {
      // 从 top 行向下伸 len 格（top 行本身已是外墙的下沿位置，这里跳过外墙再向下）
      for (let i = 0; i < len; i++) {
        const yy = top + i;
        // 距离中央走廊（bottom 行 = midRow-1）至少留 2 格通道
        if (yy >= bottom - 1) break;
        walls.add(k(col, yy));
      }
    } else {
      // 从 bottom 行向上伸 len 格
      for (let i = 0; i < len; i++) {
        const yy = bottom - i;
        if (yy <= top + 1) break;
        walls.add(k(col, yy));
      }
    }
  }
}

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
  // —— 计算每个房间中心到出生点的曼哈顿距离 ——
  const dist = (R) => Math.abs(R.x + R.w / 2 - spawn.x) + Math.abs(R.y + R.h / 2 - spawn.y);

  // —— 安全距离：房间中心至少离出生点 8 格，避免守卫贴脸刷新 ——
  const SAFE_DIST = 8;
  // 同时排除出生点所在的房间（spawn 落在矩形内）
  const inRoom = (R, p) =>
    p.x >= R.x && p.x < R.x + R.w && p.y >= R.y && p.y < R.y + R.h;
  // 同时排除房间太小的（否则巡逻只能原地兜圈）
  const roomArea = (R) => R.w * R.h;

  const safeRooms = rooms.filter(
    (R) => !inRoom(R, spawn) && dist(R) >= SAFE_DIST && roomArea(R) >= 6
  );
  // 若过滤太严没剩多少房间，回退到只排除 spawn 所在房间
  let candidates = safeRooms;
  if (candidates.length < count) {
    candidates = rooms.filter((R) => !inRoom(R, spawn));
  }
  // 仍不够则全量
  if (candidates.length < count) candidates = rooms.slice();

  // 按距离从远到近排序，再在前 N+2 内洗牌挑 N 个，保持随机但远离入口
  const sorted = [...candidates].sort((A, B) => dist(B) - dist(A));
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

  // 距离阈值：相邻两巡逻点至少跨 MIN_LEG 格，否则视为兜圈
  const MIN_LEG = 3;

  // —— 房间太小：尽量在可用范围内拉一条最长的可走对角线 ——
  if (x1 <= x0 || y1 <= y0) {
    // 在房间内枚举所有非墙格，找两点距离最远的组合
    const cells = [];
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
        if (!walls.has(k(x, y))) cells.push({ x, y });
      }
    }
    if (cells.length >= 2) {
      let bestA = cells[0];
      let bestB = cells[1];
      let bestD = -1;
      for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          const d =
            Math.abs(cells[i].x - cells[j].x) +
            Math.abs(cells[i].y - cells[j].y);
          if (d > bestD) {
            bestD = d;
            bestA = cells[i];
            bestB = cells[j];
          }
        }
      }
      return [bestA, bestB];
    }
    // 万不得已：返回中心 + 偏移 1 格
    const cx = Math.floor(room.x + room.w / 2);
    const cy = Math.floor(room.y + room.h / 2);
    return [{ x: cx, y: cy }, { x: Math.min(cx + 1, W - 2), y: cy }];
  }

  // —— 正常房间：四角作为巡逻点 ——
  const corners = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 }
  ].filter((p) => !walls.has(k(p.x, p.y)));

  // 如果四角中至少两点之间能拉开 MIN_LEG，使用四角巡逻
  if (corners.length >= 2) {
    const span =
      Math.abs(corners[0].x - corners[corners.length - 1].x) +
      Math.abs(corners[0].y - corners[corners.length - 1].y);
    if (span >= MIN_LEG) return corners;
  }

  // 退化兜底：在房间内取对角两点
  return [{ x: x0, y: y0 }, { x: x1, y: y1 }];
}

// ——————————————————————————————————————
//  容器辅助
// ——————————————————————————————————————

/** 装文物的容器：保险柜概率高些，让高价值物品更"有戏"
 *  注：已取消密码锁（puzzle）概率，原概率合并到 plain / safe。 */
function pickRelicContainerKind(rng) {
  const r = rng();
  if (r < 0.55) return 'plain';   // 55% 普通箱
  if (r < 0.95) return 'safe';    // 40% 保险柜（需擬锁器）
  return 'trap';                  // 5%  陷阱箱
}
/** 不装文物的"补给箱/陷阱箱"分布：更随意 */
function pickLootContainerKind(rng) {
  const r = rng();
  if (r < 0.65) return 'plain';
  if (r < 0.92) return 'safe';
  return 'trap';
}

/** 不装文物时随机生成的战利品类型（用于 MuseumScene 决定到底吐什么） */
function pickLootKind(rng) {
  const r = rng();
  if (r < 0.45) return 'gold';      // 一笔金币
  if (r < 0.75) return 'shard';     // 文物碎片
  if (r < 0.92) return 'medkit';    // 急救包
  return 'rep';                     // 声望小幅提升
}

function makeContainer(x, y, kind, rng) {
  const c = { x, y, kind };
  if (kind === 'puzzle') {
    // 4 位密码：每位 0~9
    let code = '';
    for (let i = 0; i < 4; i++) code += String(Math.floor(rng() * 10));
    c.code = code;
  }
  return c;
}

