// SaveSlots - 多存档槽位管理
// 职责：
//   · 维护一组存档槽（默认 3 个槽位），每个槽位都有独立的 SaveData / Codex / LLM 缓存 / 片头标记
//   · 通过统一命名规则 `${baseKey}:slot${slotId}` 隔离不同槽位的 localStorage
//   · 记录"当前激活的槽位 ID"，业务代码无需感知槽位概念
//   · 自动迁移老存档（旧版直接写在 'nightkeeper:save' 等 key）到 slot1
//
// 存储结构：
//   nightkeeper:slots:index  ->  { slots: [{id, name, createdAt, lastPlayedAt}], activeId }
//   nightkeeper:save:slot1   ->  老存档的实际数据（迁移自 nightkeeper:save）
//   nightkeeper:codex:slot1
//   nightkeeper:llm_cache:slot1
//   nightkeeper:seenIntro:slot1

const INDEX_KEY = 'nightkeeper:slots:index';

// 受槽位影响的旧 key 列表（按槽位拆分）
// 注意：这些 base key 必须与各个 system 文件里实际使用的 base key 完全一致
const SLOTTED_BASE_KEYS = [
  'nightkeeper:save',
  'nightkeeper:codex',
  'nightkeeper:llm-cache:v1',
  'nightkeeper:seenIntro'
];

const MAX_SLOTS = 3;

function readIndex() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !Array.isArray(obj.slots)) return null;
    return obj;
  } catch {
    return null;
  }
}

function writeIndex(idx) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(idx));
  } catch {
    /* ignore */
  }
}

function defaultIndex() {
  // 默认创建 1 个槽位（"默认存档"）
  const now = Date.now();
  return {
    slots: [{ id: 1, name: '默认存档', createdAt: now, lastPlayedAt: now }],
    activeId: 1
  };
}

// —— 自动迁移：检测到老 key 但还没建索引，把老数据搬到 slot1 ——
function migrateLegacyIfNeeded() {
  if (typeof localStorage === 'undefined') return;
  if (readIndex()) return; // 已经有索引，无需迁移

  // 是否存在老存档
  let hasLegacy = false;
  for (const base of SLOTTED_BASE_KEYS) {
    if (localStorage.getItem(base) !== null) {
      hasLegacy = true;
      break;
    }
  }

  if (hasLegacy) {
    // 把老 key 的内容复制到 slot1，再删除老 key
    for (const base of SLOTTED_BASE_KEYS) {
      try {
        const raw = localStorage.getItem(base);
        if (raw !== null) {
          localStorage.setItem(`${base}:slot1`, raw);
          localStorage.removeItem(base);
        }
      } catch { /* ignore */ }
    }
  }

  writeIndex(defaultIndex());
}

// 模块加载时立即尝试迁移
migrateLegacyIfNeeded();

function ensureIndex() {
  let idx = readIndex();
  if (!idx) {
    idx = defaultIndex();
    writeIndex(idx);
  }
  return idx;
}

function nextSlotId(idx) {
  let id = 1;
  const used = new Set(idx.slots.map((s) => s.id));
  while (used.has(id)) id += 1;
  return id;
}

export const SaveSlots = {
  /** 获取当前激活槽位 ID（默认 1） */
  getActiveId() {
    return ensureIndex().activeId || 1;
  },

  /** 切换激活槽位（不存在则忽略） */
  setActiveId(slotId) {
    const idx = ensureIndex();
    if (!idx.slots.some((s) => s.id === slotId)) return false;
    idx.activeId = slotId;
    // 同步刷新 lastPlayedAt
    const slot = idx.slots.find((s) => s.id === slotId);
    if (slot) slot.lastPlayedAt = Date.now();
    writeIndex(idx);
    return true;
  },

  /** 列出全部槽位（已按 id 升序） */
  listSlots() {
    const idx = ensureIndex();
    return idx.slots.slice().sort((a, b) => a.id - b.id);
  },

  /** 当前槽位元数据 */
  getActiveSlot() {
    const idx = ensureIndex();
    return idx.slots.find((s) => s.id === idx.activeId) || null;
  },

  /** 上限（用于 UI 禁用"新建"按钮） */
  maxSlots() { return MAX_SLOTS; },

  /** 是否还能新建 */
  canCreate() { return ensureIndex().slots.length < MAX_SLOTS; },

  /** 新建槽位。返回新槽 id；超上限返回 null */
  createSlot(name) {
    const idx = ensureIndex();
    if (idx.slots.length >= MAX_SLOTS) return null;
    const id = nextSlotId(idx);
    const now = Date.now();
    const slot = {
      id,
      name: (name || `存档 ${id}`).slice(0, 12),
      createdAt: now,
      lastPlayedAt: now
    };
    idx.slots.push(slot);
    idx.activeId = id;
    writeIndex(idx);
    return id;
  },

  /** 改名（最多 12 字符） */
  renameSlot(slotId, name) {
    const idx = ensureIndex();
    const slot = idx.slots.find((s) => s.id === slotId);
    if (!slot) return false;
    slot.name = String(name || '').slice(0, 12) || `存档 ${slotId}`;
    writeIndex(idx);
    return true;
  },

  /** 删除槽位（连同它的所有存档数据） */
  deleteSlot(slotId) {
    const idx = ensureIndex();
    const i = idx.slots.findIndex((s) => s.id === slotId);
    if (i < 0) return false;
    // 至少保留 1 个槽
    if (idx.slots.length <= 1) return false;

    // 清掉该槽位的所有 localStorage 数据
    if (typeof localStorage !== 'undefined') {
      for (const base of SLOTTED_BASE_KEYS) {
        try { localStorage.removeItem(`${base}:slot${slotId}`); } catch { /* ignore */ }
      }
    }

    idx.slots.splice(i, 1);
    // 如果删除的是当前激活槽，切到剩余的第一个
    if (idx.activeId === slotId) {
      idx.activeId = idx.slots[0].id;
    }
    writeIndex(idx);
    return true;
  },

  /** 把当前激活槽的"最近游玩时间"刷新为现在 */
  touchActive() {
    const idx = ensureIndex();
    const s = idx.slots.find((x) => x.id === idx.activeId);
    if (s) {
      s.lastPlayedAt = Date.now();
      writeIndex(idx);
    }
  },

  /** 计算"按当前激活槽位"的实际 localStorage key */
  slotKey(baseKey, slotId = null) {
    const id = slotId == null ? this.getActiveId() : slotId;
    return `${baseKey}:slot${id}`;
  }
};

export default SaveSlots;
