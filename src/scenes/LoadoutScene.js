// LoadoutScene - 配装台
// 左侧 4 个槽位（冠/履/器/囊中），点击槽位弹出可装备列表
// 右侧 商店：未拥有的工具（按价格排序），可购买
// 底部：已拥有的工具列表（含已装备状态）

import Phaser from 'phaser';
import SaveData from '../systems/SaveData.js';
import Audio from '../systems/AudioFx.js';
import {
  TOOLS,
  SLOT_NAME,
  getToolById,
  toolsBySlot,
  CONSUMABLES,
  WEAPONS,
  getWeaponById,
  getStarterWeaponId
} from '../data/tools.js';

const W = 1280;
const H = 720;

const SLOT_ORDER = ['weapon', 'head', 'feet', 'tool', 'sub'];

export default class LoadoutScene extends Phaser.Scene {
  constructor() { super('LoadoutScene'); }

  create() {
    Audio.init();
    this.add.rectangle(0, 0, W, H, 0x0a0a0a).setOrigin(0, 0);

    this.add
      .text(W / 2, 36, '配　装　台', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '24px',
        color: '#d4af37',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    this.add.rectangle(W / 2, 56, 200, 1, 0xd4af37);

    this.statText = this.add.text(20, 90, '', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '13px',
      color: '#e8d27a'
    });

    // 左侧：4 槽位
    this.slotGroup = this.add.container(0, 0);

    // —— 右侧商店：用一个可滚动的视口（geometry mask）——
    // 视口区域：1280×720 画布下右半区 x=620..1200, y=100..620（避开顶部标题/底部安全箱）
    this.shopViewport = { x: 620, y: 100, w: 580, h: 520 };
    this.shopGroup = this.add.container(0, 0);
    this.shopScrollY = 0;
    this.shopScrollMax = 0;

    // 视口背景（轻微衬底，便于看出可滚区域）
    this.shopViewportBg = this.add
      .rectangle(this.shopViewport.x, this.shopViewport.y, this.shopViewport.w, this.shopViewport.h, 0x000000, 0)
      .setOrigin(0, 0);

    // 几何遮罩：用一个矩形 graphics 作为遮罩源
    const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(this.shopViewport.x, this.shopViewport.y, this.shopViewport.w, this.shopViewport.h);
    const mask = maskShape.createGeometryMask();
    this.shopGroup.setMask(mask);
    this._shopMaskShape = maskShape;

    // 滚动条轨道与滑块（在遮罩外，独立绘制）
    this.scrollTrack = this.add
      .rectangle(this.shopViewport.x + this.shopViewport.w - 6, this.shopViewport.y, 4, this.shopViewport.h, 0x1a1208)
      .setOrigin(0, 0);
    this.scrollThumb = this.add
      .rectangle(this.shopViewport.x + this.shopViewport.w - 6, this.shopViewport.y, 4, 40, 0x6b5824)
      .setOrigin(0, 0);

    // 鼠标滚轮：仅当指针位于视口内时滚动
    this.input.on('wheel', (ptr, _go, _dx, dy) => {
      if (this._isPointerInShop(ptr)) {
        this._scrollShopBy(dy * 0.6);
      }
    });

    // 弹出选择层
    this.popupGroup = this.add.container(0, 0).setDepth(500);
    this.popupBg = null;

    this.refresh();

    this.add
      .text(W / 2, H - 20, 'Esc / Q  返回前室   ·   每槽位仅一件   ·   已装备亮金边   ·   安全箱：失败保底', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: '#6b5824'
      })
      .setOrigin(0.5);

    this.input.keyboard.on('keydown-ESC', () => this.back());
    this.input.keyboard.on('keydown-Q', () => this.back());

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  refresh() {
    this.slotGroup.removeAll(true);
    this.shopGroup.removeAll(true);
    if (this.safeBoxGroup) this.safeBoxGroup.removeAll(true);
    else this.safeBoxGroup = this.add.container(0, 0);

    const gold = SaveData.getGold();
    const owned = SaveData.getOwnedTools();
    const ownedWeapons = SaveData.getOwnedWeapons();
    const loadout = SaveData.getLoadout();
    this.statText.setText(
      `金 ¥${gold}    已拥有 ${owned.length}/${TOOLS.length} 件器物  ·  ${ownedWeapons.length}/${WEAPONS.length} 柄兵刃`
    );

    // —— 左侧：5 槽（兵刃 + 冠/履/器/囊中） ——
    this.slotGroup.add(this.add.text(60, 110, '装备槽', {
      fontFamily: '"PingFang SC", serif', fontSize: '16px', color: '#d4af37'
    }));
    SLOT_ORDER.forEach((slot, i) => {
      const x = 60;
      const y = 134 + i * 64;   // 压缩行高，容纳 5 槽
      let cur = null;
      if (slot === 'weapon') {
        cur = getWeaponById(loadout.weapon || getStarterWeaponId());
      } else {
        cur = loadout[slot] ? getToolById(loadout[slot]) : null;
      }
      this.slotGroup.add(this.makeSlotCard(slot, cur, x, y));
    });

    // —— 右侧：商店（内部以 viewport 顶端 y=100 为锚） ——
    this.shopGroup.add(this.add.text(640, 110, '兵刃坊（购买）', {
      fontFamily: '"PingFang SC", serif', fontSize: '15px', color: '#ff8c42'
    }));
    let yCursor = 134;
    // 记录起始 y
    const shopTopY = 110;
    const weaponShop = WEAPONS.filter((w) => !ownedWeapons.includes(w.id) && (w.price || 0) > 0)
      .sort((a, b) => a.price - b.price);
    if (!weaponShop.length) {
      this.shopGroup.add(this.add.text(640, yCursor, '所有兵刃均已购齐。', {
        fontFamily: '"PingFang SC", serif', fontSize: '12px', color: '#6b5824'
      }));
      yCursor += 22;
    } else {
      weaponShop.forEach((w) => {
        this.shopGroup.add(this.makeWeaponShopCard(w, 640, yCursor, gold));
        yCursor += 60;
      });
    }

    yCursor += 4;
    this.shopGroup.add(this.add.text(640, yCursor, '器物坊（购买）', {
      fontFamily: '"PingFang SC", serif', fontSize: '15px', color: '#d4af37'
    }));
    yCursor += 22;
    const sellable = TOOLS.filter((t) => !owned.includes(t.id))
      .sort((a, b) => a.price - b.price);
    if (!sellable.length) {
      this.shopGroup.add(this.add.text(640, yCursor, '所有器物均已购齐。', {
        fontFamily: '"PingFang SC", serif', fontSize: '12px', color: '#6b5824'
      }));
      yCursor += 22;
    } else {
      sellable.forEach((t) => {
        this.shopGroup.add(this.makeShopCard(t, 640, yCursor, gold));
        yCursor += 50;
      });
    }

    // —— 消耗品柜台：不占槽位，可重复购买，入库存 ——
    yCursor += 4;
    this.shopGroup.add(this.add.text(640, yCursor, '药囊柜台（消耗品）', {
      fontFamily: '"PingFang SC", serif', fontSize: '15px', color: '#7ae8e8'
    }));
    yCursor += 22;
    const consumables = SaveData.getConsumables();
    CONSUMABLES.forEach((c) => {
      this.shopGroup.add(this.makeConsumableCard(c, 640, yCursor, gold, consumables[c.id] || 0));
      yCursor += 44;
    });

    // 计算可滚动距离：内容总高 = (yCursor - shopTopY) + 余白
    const contentH = (yCursor - shopTopY) + 12;
    const visibleH = this.shopViewport.h;
    this.shopScrollMax = Math.max(0, contentH - visibleH);
    // 重置滚动位置（避免 refresh 后 y 残留导致空白或越界）
    this.shopScrollY = Phaser.Math.Clamp(this.shopScrollY, 0, this.shopScrollMax);
    this.shopGroup.y = -this.shopScrollY;
    this._updateScrollThumb();

    // —— 底部：安全箱（失败保底一件仓库文物）——
    this.drawSafeBox();
  }

  /** 判定指针是否落在商店视口矩形内 */
  _isPointerInShop(ptr) {
    const v = this.shopViewport;
    return ptr.x >= v.x && ptr.x <= v.x + v.w && ptr.y >= v.y && ptr.y <= v.y + v.h;
  }

  /** 相对滚动 dy（>0 向下） */
  _scrollShopBy(dy) {
    if (this.shopScrollMax <= 0) return;
    this.shopScrollY = Phaser.Math.Clamp(this.shopScrollY + dy, 0, this.shopScrollMax);
    this.shopGroup.y = -this.shopScrollY;
    this._updateScrollThumb();
  }

  /** 同步滑块位置与高度 */
  _updateScrollThumb() {
    if (!this.scrollThumb || !this.scrollTrack) return;
    const v = this.shopViewport;
    if (this.shopScrollMax <= 0) {
      // 内容不超长时隐藏滑块
      this.scrollThumb.setVisible(false);
      this.scrollTrack.setVisible(false);
      return;
    }
    this.scrollThumb.setVisible(true);
    this.scrollTrack.setVisible(true);
    const totalContent = v.h + this.shopScrollMax;
    const thumbH = Math.max(24, (v.h / totalContent) * v.h);
    const ratio = this.shopScrollY / this.shopScrollMax;
    this.scrollThumb.height = thumbH;
    this.scrollThumb.y = v.y + ratio * (v.h - thumbH);
  }

  drawSafeBox() {
    const vault = SaveData.getVault();
    const safeId = SaveData.getState().safeBox;
    const cur = safeId ? vault.find((v) => v.id === safeId) : null;

    const x = 60;
    const y = 640;
    const w = 1160;
    const h = 56;

    const bg = this.add.rectangle(x, y, w, h, 0x1a1208).setOrigin(0, 0);
    bg.setStrokeStyle(2, cur ? 0xc084fc : 0x3a2814);
    this.safeBoxGroup.add(bg);

    const title = this.add.text(x + 12, y + 6, '📦  安全箱预存', {
      fontFamily: '"PingFang SC", serif', fontSize: '13px', color: '#c084fc'
    });
    this.safeBoxGroup.add(title);

    const info = cur
      ? `已预存：${cur.name}（${cur.dynasty}）  ·  价值 ¥${cur.value}  ·  失败不丢`
      : '未预存·点击从仓库挑一件。出击失败时，该件仓库文物不受影响。';
    const infoTxt = this.add.text(x + 12, y + 26, info, {
      fontFamily: '"PingFang SC", serif', fontSize: '12px',
      color: cur ? '#e8d27a' : '#6b5824'
    });
    this.safeBoxGroup.add(infoTxt);

    // 从仓库挑一件
    const pickBtn = this.add.text(x + w - 90, y + h / 2, cur ? '更换' : '选择', {
      fontFamily: '"PingFang SC", serif', fontSize: '12px',
      color: '#fff3b8', backgroundColor: '#3a2814', padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    pickBtn.on('pointerover', () => pickBtn.setBackgroundColor('#5a3e1c'));
    pickBtn.on('pointerout', () => pickBtn.setBackgroundColor('#3a2814'));
    pickBtn.on('pointerdown', () => {
      Audio.sfx.click();
      this.openSafeBoxPicker();
    });
    this.safeBoxGroup.add(pickBtn);

    if (cur) {
      const clrBtn = this.add.text(x + w - 24, y + h / 2, '×', {
        fontFamily: 'Georgia, serif', fontSize: '16px',
        color: '#a08434', backgroundColor: '#1a1208', padding: { x: 6, y: 2 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      clrBtn.on('pointerdown', () => {
        Audio.sfx.click();
        SaveData.setSafeBox(null);
        this.refresh();
      });
      this.safeBoxGroup.add(clrBtn);
    }
  }

  openSafeBoxPicker() {
    this.popupGroup.removeAll(true);
    const vault = SaveData.getVault();

    const w = 460;
    const h = 380;
    const x = (W - w) / 2;
    const y = (H - h) / 2;

    const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.65).setOrigin(0, 0).setInteractive();
    overlay.on('pointerdown', () => this.closePopup());
    this.popupGroup.add(overlay);

    const bg = this.add.rectangle(x, y, w, h, 0x1a1208).setOrigin(0, 0);
    bg.setStrokeStyle(2, 0xc084fc);
    bg.setInteractive();
    this.popupGroup.add(bg);

    this.popupGroup.add(this.add.text(x + w / 2, y + 20, '选择一件存入安全箱', {
      fontFamily: '"PingFang SC", serif', fontSize: '16px', color: '#c084fc', fontStyle: 'bold'
    }).setOrigin(0.5));
    this.popupGroup.add(this.add.text(x + w / 2, y + 42, '仅作为失败保底标记，文物仍留在仓库。', {
      fontFamily: '"PingFang SC", serif', fontSize: '11px', color: '#7a6228'
    }).setOrigin(0.5));

    if (!vault.length) {
      this.popupGroup.add(this.add.text(x + w / 2, y + h / 2, '仓库仍空。先追回一件文物。', {
        fontFamily: '"PingFang SC", serif', fontSize: '13px', color: '#6b5824'
      }).setOrigin(0.5));
    } else {
      // 只列前 6 件（避免面板超高；后续可加滚动）
      const list = vault.slice(0, 6);
      list.forEach((it, i) => {
        const ty = y + 70 + i * 44;
        const row = this.add.rectangle(x + 20, ty, w - 40, 36, 0x140d05).setOrigin(0, 0);
        row.setStrokeStyle(1, 0x6b5824);
        row.setInteractive({ useHandCursor: true });
        row.on('pointerover', () => row.setStrokeStyle(1, 0xc084fc));
        row.on('pointerout', () => row.setStrokeStyle(1, 0x6b5824));
        row.on('pointerdown', () => {
          Audio.sfx.click();
          SaveData.setSafeBox(it.id);
          this.closePopup();
          this.refresh();
        });
        this.popupGroup.add(row);
        this.popupGroup.add(this.add.text(x + 32, ty + 6, `${it.name}（${it.dynasty}）`, {
          fontFamily: '"PingFang SC", serif', fontSize: '13px', color: '#e8d27a'
        }));
        this.popupGroup.add(this.add.text(x + w - 40, ty + 12, `¥${it.value}`, {
          fontFamily: 'Georgia, serif', fontSize: '12px', color: '#a08434'
        }).setOrigin(1, 0.5));
      });
      if (vault.length > 6) {
        this.popupGroup.add(this.add.text(x + w / 2, y + h - 36, `… 仓库共 ${vault.length} 件·仅显示前 6 件`, {
          fontFamily: '"PingFang SC", serif', fontSize: '11px', color: '#6b5824'
        }).setOrigin(0.5));
      }
    }

    const close = this.add.text(x + w - 20, y + 20, '✕', {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: '#a08434'
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.closePopup());
    this.popupGroup.add(close);
  }

  makeSlotCard(slot, tool, x, y) {
    const c = this.add.container(x, y);
    const w = 420;
    const h = 56;
    const isWeaponSlot = slot === 'weapon';
    const accent = isWeaponSlot ? 0xff8c42 : 0xd4af37;
    const bg = this.add.rectangle(0, 0, w, h, 0x1a1208).setOrigin(0, 0);
    bg.setStrokeStyle(2, tool ? accent : 0x3a2814);
    bg.setInteractive({ useHandCursor: true });
    c.add(bg);

    c.add(this.add.text(14, 6, `【${SLOT_NAME[slot]}】`, {
      fontFamily: '"PingFang SC", serif', fontSize: '12px',
      color: isWeaponSlot ? '#ff8c42' : '#a08434'
    }));

    if (tool) {
      c.add(this.add.text(14, 22, `${tool.icon}  ${tool.name}`, {
        fontFamily: '"PingFang SC", serif', fontSize: '14px', color: '#e8d27a', fontStyle: 'bold'
      }));
      const sub = isWeaponSlot ? this.formatWeaponSpec(tool) : tool.desc;
      c.add(this.add.text(14, 40, sub, {
        fontFamily: '"PingFang SC", serif', fontSize: '10px', color: '#6b5824',
        wordWrap: { width: w - 80 }
      }));
      // 武器槽不允许卸下（会回退到 starter）——隐藏 “卸下” 按钮
      if (!isWeaponSlot) {
        const unequip = this.add.text(w - 14, h / 2, '卸下', {
          fontFamily: '"PingFang SC", serif', fontSize: '12px', color: '#a08434',
          backgroundColor: '#1a1208', padding: { x: 6, y: 3 }
        }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
        unequip.on('pointerover', () => unequip.setColor('#fff3b8'));
        unequip.on('pointerout', () => unequip.setColor('#a08434'));
        unequip.on('pointerdown', (p, lx, ly, evt) => {
          evt.stopPropagation();
          Audio.sfx.click();
          SaveData.equip(slot, null);
          this.refresh();
        });
        c.add(unequip);
      }
    } else {
      c.add(this.add.text(14, 28, '空槽 · 点击装备', {
        fontFamily: '"PingFang SC", serif', fontSize: '12px', color: '#6b5824'
      }));
    }

    bg.on('pointerover', () => bg.setStrokeStyle(2, 0xfff3b8));
    bg.on('pointerout', () => bg.setStrokeStyle(2, tool ? accent : 0x3a2814));
    bg.on('pointerdown', () => {
      Audio.sfx.click();
      if (isWeaponSlot) this.openWeaponPicker();
      else this.openSlotPicker(slot);
    });
    return c;
  }

  /** 武器一行数值摘要 */
  formatWeaponSpec(w) {
    if (!w) return '';
    if (w.kind === 'melee') {
      return `【近战】伤 ${w.damage} · 范 ${w.range} · 冷却 ${(w.cooldownMs / 1000).toFixed(2)}s`;
    }
    return `【远程】伤 ${w.damage} · 射程 ${w.range} · 弹 ${w.ammoMax} · 冷却 ${(w.cooldownMs / 1000).toFixed(2)}s`;
  }

  makeShopCard(t, x, y, gold) {
    const c = this.add.container(x, y);
    const w = 380;
    const h = 44;
    const bg = this.add.rectangle(0, 0, w, h, 0x1a1208).setOrigin(0, 0);
    bg.setStrokeStyle(1, 0x6b5824);
    c.add(bg);

    c.add(this.add.text(14, 4, `${t.icon}  ${t.name}`, {
      fontFamily: '"PingFang SC", serif', fontSize: '13px', color: '#e8d27a', fontStyle: 'bold'
    }));
    c.add(this.add.text(14, 22, `【${SLOT_NAME[t.slot]}】 ${t.desc}`, {
      fontFamily: '"PingFang SC", serif', fontSize: '10px', color: '#a08434',
      wordWrap: { width: 260 }
    }));

    const canBuy = gold >= t.price;
    const btn = this.add.text(w - 14, h / 2, `¥${t.price}  购买`, {
      fontFamily: '"PingFang SC", serif', fontSize: '12px',
      color: canBuy ? '#fff3b8' : '#3a2814',
      backgroundColor: canBuy ? '#3a2814' : '#1a1208',
      padding: { x: 6, y: 3 }
    }).setOrigin(1, 0.5);
    if (canBuy) {
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setBackgroundColor('#5a3e1c'));
      btn.on('pointerout', () => btn.setBackgroundColor('#3a2814'));
      btn.on('pointerdown', () => {
        Audio.sfx.click();
        if (SaveData.buyTool(t.id)) {
          this.toast(`购得「${t.name}」`);
          this.refresh();
        }
      });
    }
    c.add(btn);
    return c;
  }

  /** 兵刃坊购买卡片 */
  makeWeaponShopCard(w, x, y, gold) {
    const c = this.add.container(x, y);
    const cw = 380;
    const ch = 54;
    const bg = this.add.rectangle(0, 0, cw, ch, 0x1f1208).setOrigin(0, 0);
    bg.setStrokeStyle(1, 0x6b3a1c);
    c.add(bg);

    c.add(this.add.text(14, 4, `${w.icon}  ${w.name}`, {
      fontFamily: '"PingFang SC", serif', fontSize: '13px', color: '#ffb88a', fontStyle: 'bold'
    }));
    c.add(this.add.text(14, 22, this.formatWeaponSpec(w), {
      fontFamily: '"PingFang SC", serif', fontSize: '10px', color: '#d4af37'
    }));
    c.add(this.add.text(14, 38, w.desc, {
      fontFamily: '"PingFang SC", serif', fontSize: '10px', color: '#7a6228',
      wordWrap: { width: 260 }
    }));

    const canBuy = gold >= (w.price || 0);
    const btn = this.add.text(cw - 14, ch / 2, `¥${w.price}  购买`, {
      fontFamily: '"PingFang SC", serif', fontSize: '12px',
      color: canBuy ? '#fff3b8' : '#3a2814',
      backgroundColor: canBuy ? '#5a2a14' : '#1a1208',
      padding: { x: 6, y: 3 }
    }).setOrigin(1, 0.5);
    if (canBuy) {
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setBackgroundColor('#7a3a1c'));
      btn.on('pointerout', () => btn.setBackgroundColor('#5a2a14'));
      btn.on('pointerdown', () => {
        Audio.sfx.click();
        if (SaveData.buyWeapon(w.id)) {
          this.toast(`购得兵刃「${w.name}」`);
          this.refresh();
        }
      });
    }
    c.add(btn);
    return c;
  }

  // 消耗品卡片：可重复购买，右侧显示当前库存
  makeConsumableCard(item, x, y, gold, stock) {
    const c = this.add.container(x, y);
    const w = 380;
    const h = 40;
    const bg = this.add.rectangle(0, 0, w, h, 0x0e1e1e).setOrigin(0, 0);
    bg.setStrokeStyle(1, 0x2c5a5a);
    c.add(bg);

    c.add(this.add.text(14, 4, `${item.icon}  ${item.name}　× ${stock}`, {
      fontFamily: '"PingFang SC", serif', fontSize: '13px', color: '#a8e8e8', fontStyle: 'bold'
    }));
    c.add(this.add.text(14, 22, `${item.desc}　热键：${item.hotkey}`, {
      fontFamily: '"PingFang SC", serif', fontSize: '10px', color: '#5fa8a8',
      wordWrap: { width: 260 }
    }));

    const canBuy = gold >= item.price;
    const btn = this.add.text(w - 14, h / 2, `¥${item.price}  +1`, {
      fontFamily: '"PingFang SC", serif', fontSize: '12px',
      color: canBuy ? '#fff3b8' : '#3a2814',
      backgroundColor: canBuy ? '#1c4040' : '#1a1208',
      padding: { x: 6, y: 3 }
    }).setOrigin(1, 0.5);
    if (canBuy) {
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setBackgroundColor('#286060'));
      btn.on('pointerout', () => btn.setBackgroundColor('#1c4040'));
      btn.on('pointerdown', () => {
        Audio.sfx.click();
        if (SaveData.buyConsumable(item.id)) {
          this.toast(`购入「${item.name}」 × 1`);
          this.refresh();
        }
      });
    }
    c.add(btn);
    return c;
  }

  openSlotPicker(slot) {
    this.popupGroup.removeAll(true);
    const owned = SaveData.getOwnedTools();
    const candidates = toolsBySlot(slot).filter((t) => owned.includes(t.id));

    const w = 360;
    const h = 280;
    const x = (W - w) / 2;
    const y = (H - h) / 2;

    const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.65).setOrigin(0, 0)
      .setInteractive();
    overlay.on('pointerdown', () => this.closePopup());
    this.popupGroup.add(overlay);

    const bg = this.add.rectangle(x, y, w, h, 0x1a1208).setOrigin(0, 0);
    bg.setStrokeStyle(2, 0xd4af37);
    bg.setInteractive(); // 阻挡点击穿透
    this.popupGroup.add(bg);

    this.popupGroup.add(this.add.text(x + w / 2, y + 20, `选择【${SLOT_NAME[slot]}】`, {
      fontFamily: '"PingFang SC", serif', fontSize: '16px', color: '#d4af37', fontStyle: 'bold'
    }).setOrigin(0.5));

    if (!candidates.length) {
      this.popupGroup.add(this.add.text(x + w / 2, y + h / 2, '尚未拥有此类器物。\n请先到右侧器物坊购买。', {
        fontFamily: '"PingFang SC", serif', fontSize: '13px', color: '#6b5824', align: 'center'
      }).setOrigin(0.5));
    } else {
      candidates.forEach((t, i) => {
        const ty = y + 60 + i * 50;
        const row = this.add.rectangle(x + 20, ty, w - 40, 40, 0x140d05).setOrigin(0, 0);
        row.setStrokeStyle(1, 0x6b5824);
        row.setInteractive({ useHandCursor: true });
        row.on('pointerover', () => row.setStrokeStyle(1, 0xfff3b8));
        row.on('pointerout', () => row.setStrokeStyle(1, 0x6b5824));
        row.on('pointerdown', () => {
          Audio.sfx.click();
          SaveData.equip(slot, t.id);
          this.closePopup();
          this.refresh();
        });
        this.popupGroup.add(row);
        this.popupGroup.add(this.add.text(x + 32, ty + 8, `${t.icon}  ${t.name}`, {
          fontFamily: '"PingFang SC", serif', fontSize: '14px', color: '#e8d27a'
        }));
        this.popupGroup.add(this.add.text(x + 32, ty + 24, t.desc, {
          fontFamily: '"PingFang SC", serif', fontSize: '10px', color: '#a08434'
        }));
      });
    }

    const close = this.add.text(x + w - 20, y + 20, '✕', {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: '#a08434'
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.closePopup());
    this.popupGroup.add(close);
  }

  closePopup() {
    this.popupGroup.removeAll(true);
  }

  /** 打开兵刃选择面板（不允许空手，存档会在 equipWeapon(null) 上回退到 starter） */
  openWeaponPicker() {
    this.popupGroup.removeAll(true);
    const ownedIds = SaveData.getOwnedWeapons();
    const candidates = WEAPONS.filter((w) => ownedIds.includes(w.id));
    const curId = SaveData.getEquippedWeaponId();

    const w = 420;
    const h = Math.min(380, 90 + candidates.length * 56);
    const x = (W - w) / 2;
    const y = (H - h) / 2;

    const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.65).setOrigin(0, 0).setInteractive();
    overlay.on('pointerdown', () => this.closePopup());
    this.popupGroup.add(overlay);

    const bg = this.add.rectangle(x, y, w, h, 0x1a1208).setOrigin(0, 0);
    bg.setStrokeStyle(2, 0xff8c42);
    bg.setInteractive();
    this.popupGroup.add(bg);

    this.popupGroup.add(this.add.text(x + w / 2, y + 20, '选择【兵刃】', {
      fontFamily: '"PingFang SC", serif', fontSize: '16px', color: '#ff8c42', fontStyle: 'bold'
    }).setOrigin(0.5));
    this.popupGroup.add(this.add.text(x + w / 2, y + 42, '兵刃不可为空。远程武器热键：右键 或 J', {
      fontFamily: '"PingFang SC", serif', fontSize: '11px', color: '#7a6228'
    }).setOrigin(0.5));

    if (!candidates.length) {
      this.popupGroup.add(this.add.text(x + w / 2, y + h / 2, '未拥有任何兵刃。', {
        fontFamily: '"PingFang SC", serif', fontSize: '13px', color: '#6b5824'
      }).setOrigin(0.5));
    } else {
      candidates.forEach((wp, i) => {
        const ty = y + 70 + i * 50;
        const isCur = wp.id === curId;
        const row = this.add.rectangle(x + 20, ty, w - 40, 44, 0x140d05).setOrigin(0, 0);
        row.setStrokeStyle(1, isCur ? 0xff8c42 : 0x6b5824);
        row.setInteractive({ useHandCursor: true });
        row.on('pointerover', () => row.setStrokeStyle(1, 0xfff3b8));
        row.on('pointerout', () => row.setStrokeStyle(1, isCur ? 0xff8c42 : 0x6b5824));
        row.on('pointerdown', () => {
          Audio.sfx.click();
          SaveData.equipWeapon(wp.id);
          this.closePopup();
          this.refresh();
        });
        this.popupGroup.add(row);
        this.popupGroup.add(this.add.text(x + 32, ty + 6, `${wp.icon}  ${wp.name}${isCur ? '  ·  已装备' : ''}`, {
          fontFamily: '"PingFang SC", serif', fontSize: '14px',
          color: isCur ? '#ffb88a' : '#e8d27a'
        }));
        this.popupGroup.add(this.add.text(x + 32, ty + 24, this.formatWeaponSpec(wp), {
          fontFamily: '"PingFang SC", serif', fontSize: '10px', color: '#a08434'
        }));
      });
    }

    const close = this.add.text(x + w - 20, y + 20, '✕', {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: '#a08434'
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.closePopup());
    this.popupGroup.add(close);
  }

  toast(msg) {
    if (this._toast) this._toast.destroy();
    this._toast = this.add
      .text(W / 2, H - 60, msg, {
        fontFamily: '"PingFang SC", serif', fontSize: '13px',
        color: '#fff3b8', backgroundColor: '#1a1208cc',
        padding: { x: 10, y: 5 }
      })
      .setOrigin(0.5)
      .setDepth(200);
    this.tweens.add({
      targets: this._toast, alpha: 0, duration: 1400, delay: 900,
      onComplete: () => this._toast && this._toast.destroy()
    });
  }

  back() {
    Audio.sfx.click();
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('HubScene');
    });
  }
}
