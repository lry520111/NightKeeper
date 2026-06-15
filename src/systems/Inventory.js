// 背包系统 - 鸭科夫式格子网格
// 4 行 × 6 列 = 24 格，每件文物按 size 占据矩形区域
// 拾取时自动寻找第一个能放下的位置；放不下则拒绝拾取

export const INV_COLS = 6;
export const INV_ROWS = 4;

export default class Inventory {
  constructor(cols = INV_COLS, rows = INV_ROWS) {
    this.cols = cols;
    this.rows = rows;
    // grid[r][c] = null 或 占位的 itemId（同一物品在多个格子里共用同一 id）
    this.grid = Array.from({ length: rows }, () => Array(cols).fill(null));
    // items: [{ id, relic, x, y, w, h }]  其中 x/y 是左上角格子坐标
    this.items = [];
    this._idSeed = 1;
  }

  /** 检查 (x,y) 起点放置 w×h 物品是否合法 */
  canPlace(x, y, w, h) {
    if (x < 0 || y < 0 || x + w > this.cols || y + h > this.rows) return false;
    for (let r = y; r < y + h; r++) {
      for (let c = x; c < x + w; c++) {
        if (this.grid[r][c] !== null) return false;
      }
    }
    return true;
  }

  /** 寻找第一个能放下 w×h 的位置；返回 {x,y} 或 null */
  findSlot(w, h) {
    for (let y = 0; y <= this.rows - h; y++) {
      for (let x = 0; x <= this.cols - w; x++) {
        if (this.canPlace(x, y, w, h)) return { x, y };
      }
    }
    return null;
  }

  /** 尝试加入文物，成功返回 item 对象，失败返回 null */
  tryAdd(relic) {
    const w = relic.size?.w ?? 1;
    const h = relic.size?.h ?? 1;
    const slot = this.findSlot(w, h);
    if (!slot) return null;
    const id = this._idSeed++;
    const item = { id, relic, x: slot.x, y: slot.y, w, h };
    this.items.push(item);
    for (let r = slot.y; r < slot.y + h; r++) {
      for (let c = slot.x; c < slot.x + w; c++) this.grid[r][c] = id;
    }
    return item;
  }

  /** 总价值 */
  totalValue() {
    return this.items.reduce((s, it) => s + (it.relic.value || 0), 0);
  }

  /** 已占用格数 */
  usedCells() {
    return this.items.reduce((s, it) => s + it.w * it.h, 0);
  }

  totalCells() {
    return this.cols * this.rows;
  }

  /** 取出所有文物（按拾取顺序） */
  list() {
    return this.items.map((it) => it.relic);
  }

  clear() {
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
    this.items = [];
    this._idSeed = 1;
  }
}
