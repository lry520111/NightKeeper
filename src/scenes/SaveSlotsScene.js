// SaveSlotsScene - 存档槽位选择/管理界面
// 展示 3 个存档槽（已使用 / 空），支持：
//   · 选中并继续 → 切换激活槽 → 跳片头或 Hub
//   · 新建        → 弹输入框输入名字，创建后自动进入
//   · 改名        → 弹输入框
//   · 删除        → 弹二次确认（至少保留 1 个）
//
// 入口：TitleScene 的"开始夜行"或"存档管理"按钮
// 出口：HubScene / IntroScene / 返回 TitleScene

import Phaser from 'phaser';
import SaveSlots from '../systems/SaveSlots.js';
import SaveData from '../systems/SaveData.js';
import Codex from '../systems/Codex.js';
import Audio from '../systems/AudioFx.js';

const COLOR_TEXT = '#e8d27a';
const COLOR_DIM = '#7a6228';
const COLOR_HOVER = '#fff3b8';
const COLOR_DANGER = '#c8513a';
const COLOR_GOLD = '#d4af37';

export default class SaveSlotsScene extends Phaser.Scene {
  constructor() {
    super('SaveSlotsScene');
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.fadeIn(300, 0, 0, 0);

    // 背景
    this.add.rectangle(0, 0, width, height, 0x0a0a0a).setOrigin(0, 0);

    // 顶部装饰线 + 标题
    this.add.rectangle(width / 2, 60, 360, 1, 0xd4af37);
    this.add
      .text(width / 2, 38, '— 存　档 —', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '26px',
        color: COLOR_GOLD
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 78, '选择一个存档继续，或新建一段全新的夜行', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: COLOR_DIM
      })
      .setOrigin(0.5);

    // 槽位卡片容器（每次刷新清空重画）
    this.cardsLayer = this.add.container(0, 0);

    // 底部
    this.add.rectangle(width / 2, height - 60, 360, 1, 0xd4af37);
    const backBtn = this.add
      .text(width / 2, height - 38, '［ 返回 ］', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '14px',
        color: COLOR_DIM
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setColor(COLOR_HOVER));
    backBtn.on('pointerout', () => backBtn.setColor(COLOR_DIM));
    backBtn.on('pointerdown', () => {
      Audio.sfx.click();
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('TitleScene'));
    });

    this.refreshCards();
  }

  // ——————————————————— 渲染 ———————————————————
  refreshCards() {
    const { width } = this.scale;
    this.cardsLayer.removeAll(true);

    const slots = SaveSlots.listSlots();
    const activeId = SaveSlots.getActiveId();
    const max = SaveSlots.maxSlots();

    // 卡片高度 80，间距 14，顶部从 y=110 起
    const cardW = 560;
    const cardH = 78;
    const gap = 12;
    const startY = 110;

    for (let i = 0; i < max; i += 1) {
      const slot = slots[i] || null;
      const cy = startY + i * (cardH + gap) + cardH / 2;
      this.drawSlotCard(width / 2, cy, cardW, cardH, slot, slot && slot.id === activeId);
    }
  }

  drawSlotCard(cx, cy, w, h, slot, isActive) {
    const x0 = cx - w / 2;
    const y0 = cy - h / 2;

    const isEmpty = !slot;

    // 背景
    const bg = this.add.rectangle(cx, cy, w, h, 0x141414).setStrokeStyle(1, isActive ? 0xd4af37 : 0x2a2418);
    this.cardsLayer.add(bg);

    if (isEmpty) {
      // 空槽：单按钮"＋ 新建存档"
      const plus = this.add
        .text(cx, cy, '＋  新建存档', {
          fontFamily: '"PingFang SC", serif',
          fontSize: '20px',
          color: COLOR_DIM
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      plus.on('pointerover', () => { plus.setColor(COLOR_HOVER); bg.setStrokeStyle(1, 0xd4af37); });
      plus.on('pointerout', () => { plus.setColor(COLOR_DIM); bg.setStrokeStyle(1, 0x2a2418); });
      plus.on('pointerdown', () => this.handleCreateSlot());
      this.cardsLayer.add(plus);
      return;
    }

    // 已有存档：显示摘要
    // 临时切换激活槽以便读到该槽的数据，读完再切回
    const prevActive = SaveSlots.getActiveId();
    SaveSlots.setActiveId(slot.id);
    let summary = null;
    try {
      const s = SaveData.getState();
      const codex = Codex.getState();
      summary = {
        gold: s.gold,
        vault: s.vault.length,
        runs: s.runs.total,
        success: s.runs.success,
        gameDay: s.gameDay,
        discovered: Object.keys(codex.relics).length
      };
    } catch {
      summary = { gold: 0, vault: 0, runs: 0, success: 0, gameDay: 1, discovered: 0 };
    }
    // 切回原激活槽（若不同）
    if (prevActive !== slot.id) SaveSlots.setActiveId(prevActive);

    // 左侧：槽位编号 + 名字
    const nameTxt = this.add
      .text(x0 + 16, y0 + 12, `#${slot.id}  ${slot.name}`, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '18px',
        color: isActive ? COLOR_GOLD : COLOR_TEXT,
        fontStyle: isActive ? 'bold' : 'normal'
      })
      .setOrigin(0, 0);
    this.cardsLayer.add(nameTxt);

    if (isActive) {
      const tag = this.add
        .text(x0 + 16 + nameTxt.width + 10, y0 + 16, '当前', {
          fontFamily: '"PingFang SC", serif',
          fontSize: '11px',
          color: '#0a0a0a',
          backgroundColor: '#d4af37',
          padding: { left: 6, right: 6, top: 2, bottom: 2 }
        })
        .setOrigin(0, 0);
      this.cardsLayer.add(tag);
    }

    // 中间：摘要信息
    const summaryTxt = `第 ${summary.gameDay} 日  ·  ¥${summary.gold}  ·  仓库 ${summary.vault}  ·  出击 ${summary.runs} 次（成功 ${summary.success}）  ·  图鉴 ${summary.discovered}`;
    const sumLine = this.add
      .text(x0 + 16, y0 + 38, summaryTxt, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: COLOR_DIM
      })
      .setOrigin(0, 0);
    this.cardsLayer.add(sumLine);

    // 时间
    const timeTxt = this.add
      .text(x0 + 16, y0 + 58, `最近游玩：${formatTime(slot.lastPlayedAt)}`, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '11px',
        color: '#5a4720'
      })
      .setOrigin(0, 0);
    this.cardsLayer.add(timeTxt);

    // 右侧操作按钮：［ 进入 ］［ 改名 ］［ 删除 ］
    const btnY = y0 + h / 2;
    const btnLoad = makeBtn(this, x0 + w - 60, btnY, '进入', COLOR_TEXT, () => this.handleLoadSlot(slot.id));
    const btnRename = makeBtn(this, x0 + w - 130, btnY, '改名', COLOR_DIM, () => this.handleRenameSlot(slot));
    const btnDel = makeBtn(this, x0 + w - 190, btnY, '删除', COLOR_DANGER, () => this.handleDeleteSlot(slot));
    this.cardsLayer.add([btnLoad, btnRename, btnDel]);

    // 整张卡可点 = 进入
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setStrokeStyle(1, 0xd4af37));
    bg.on('pointerout', () => bg.setStrokeStyle(1, isActive ? 0xd4af37 : 0x2a2418));
    bg.on('pointerdown', (pointer, lx, ly, ev) => {
      // 避免与按钮冲突（按钮自身在上层已经吃掉事件）
      this.handleLoadSlot(slot.id);
    });
  }

  // ——————————————————— 交互处理 ———————————————————
  handleLoadSlot(slotId) {
    Audio.sfx.click();
    SaveSlots.setActiveId(slotId);

    // 切槽后：是否看过本槽的片头？没看过 → IntroScene；看过 → HubScene
    const seenKey = SaveSlots.slotKey('nightkeeper:seenIntro');
    let seen = false;
    try { seen = localStorage.getItem(seenKey) === '1'; } catch { /* ignore */ }

    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(seen ? 'HubScene' : 'IntroScene');
    });
  }

  handleCreateSlot() {
    Audio.sfx.click();
    if (!SaveSlots.canCreate()) {
      this.toast('已达槽位上限');
      return;
    }
    const name = window.prompt('为新存档起个名字（最多 12 字）：', `存档 ${SaveSlots.listSlots().length + 1}`);
    if (name === null) return; // 取消
    const trimmed = String(name).trim();
    const id = SaveSlots.createSlot(trimmed || undefined);
    if (id == null) {
      this.toast('新建失败');
      return;
    }
    // 新建成功后立刻刷新视图（此时新槽已成激活）
    this.refreshCards();
  }

  handleRenameSlot(slot) {
    Audio.sfx.click();
    const name = window.prompt('修改存档名（最多 12 字）：', slot.name);
    if (name === null) return;
    const trimmed = String(name).trim();
    if (!trimmed) return;
    SaveSlots.renameSlot(slot.id, trimmed);
    this.refreshCards();
  }

  handleDeleteSlot(slot) {
    Audio.sfx.click();
    if (SaveSlots.listSlots().length <= 1) {
      this.toast('至少需要保留 1 个存档');
      return;
    }
    const ok = window.confirm(`确定要删除「${slot.name}」吗？\n该槽位的所有进度（金币 / 仓库 / 图鉴）都会被永久抹去，不可恢复。`);
    if (!ok) return;
    SaveSlots.deleteSlot(slot.id);
    this.refreshCards();
  }

  toast(msg) {
    const { width, height } = this.scale;
    const t = this.add
      .text(width / 2, height - 90, msg, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '13px',
        color: '#fff3b8',
        backgroundColor: '#2a2418',
        padding: { left: 12, right: 12, top: 6, bottom: 6 }
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 1200,
      duration: 400,
      onComplete: () => t.destroy()
    });
  }
}

// ——————————————————— 工具函数 ———————————————————
function makeBtn(scene, x, y, label, color, onClick) {
  const t = scene.add
    .text(x, y, `［ ${label} ］`, {
      fontFamily: '"PingFang SC", serif',
      fontSize: '12px',
      color
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  t.on('pointerover', () => t.setColor(COLOR_HOVER));
  t.on('pointerout', () => t.setColor(color));
  t.on('pointerdown', (pointer, lx, ly, ev) => {
    // 阻止事件冒泡到下层卡片背景
    if (ev && ev.stopPropagation) ev.stopPropagation();
    onClick();
  });
  return t;
}

function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
