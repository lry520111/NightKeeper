// LoadoutScene - 配装台
// 左侧 4 个槽位（冠/履/器/囊中），点击槽位弹出可装备列表
// 右侧 商店：未拥有的工具（按价格排序），可购买
// 底部：已拥有的工具列表（含已装备状态）

import Phaser from 'phaser';
import SaveData from '../systems/SaveData.js';
import Audio from '../systems/AudioFx.js';
import { TOOLS, SLOT_NAME, getToolById, toolsBySlot, CONSUMABLES } from '../data/tools.js';

const W = 960;
const H = 540;

const SLOT_ORDER = ['head', 'feet', 'tool', 'sub'];

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
    // 右侧：商店
    this.shopGroup = this.add.container(0, 0);
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
    const loadout = SaveData.getLoadout();
    this.statText.setText(`金 ¥${gold}    已拥有 ${owned.length}/${TOOLS.length} 件器物`);

    // —— 左侧：4 槽 ——
    this.slotGroup.add(this.add.text(60, 130, '装备槽', {
      fontFamily: '"PingFang SC", serif', fontSize: '16px', color: '#d4af37'
    }));
    SLOT_ORDER.forEach((slot, i) => {
      const x = 60;
      const y = 160 + i * 80;
      const cur = loadout[slot] ? getToolById(loadout[slot]) : null;
      this.slotGroup.add(this.makeSlotCard(slot, cur, x, y));
    });

    // —— 右侧：商店 ——
    this.shopGroup.add(this.add.text(540, 130, '器物坊（购买）', {
      fontFamily: '"PingFang SC", serif', fontSize: '16px', color: '#d4af37'
    }));
    const sellable = TOOLS.filter((t) => !owned.includes(t.id))
      .sort((a, b) => a.price - b.price);
    let yCursor = 160;
    if (!sellable.length) {
      this.shopGroup.add(this.add.text(540, yCursor, '所有器物均已购齐。', {
        fontFamily: '"PingFang SC", serif', fontSize: '13px', color: '#6b5824'
      }));
      yCursor += 30;
    } else {
      sellable.forEach((t) => {
        this.shopGroup.add(this.makeShopCard(t, 540, yCursor, gold));
        yCursor += 65;
      });
    }

    // —— 消耗品柜台：不占槽位，可重复购买，入库存 ——
    yCursor += 8;
    this.shopGroup.add(this.add.text(540, yCursor, '药囊柜台（消耗品）', {
      fontFamily: '"PingFang SC", serif', fontSize: '14px', color: '#7ae8e8'
    }));
    yCursor += 26;
    const consumables = SaveData.getConsumables();
    CONSUMABLES.forEach((c) => {
      this.shopGroup.add(this.makeConsumableCard(c, 540, yCursor, gold, consumables[c.id] || 0));
      yCursor += 56;
    });

    // —— 底部：安全箱（失败保底一件仓库文物）——
    this.drawSafeBox();
  }

  drawSafeBox() {
    const vault = SaveData.getVault();
    const safeId = SaveData.getState().safeBox;
    const cur = safeId ? vault.find((v) => v.id === safeId) : null;

    const x = 60;
    const y = 480;
    const w = 880;
    const h = 46;

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
    const h = 70;
    const bg = this.add.rectangle(0, 0, w, h, 0x1a1208).setOrigin(0, 0);
    bg.setStrokeStyle(2, tool ? 0xd4af37 : 0x3a2814);
    bg.setInteractive({ useHandCursor: true });
    c.add(bg);

    c.add(this.add.text(14, 8, `【${SLOT_NAME[slot]}】`, {
      fontFamily: '"PingFang SC", serif', fontSize: '13px', color: '#a08434'
    }));

    if (tool) {
      c.add(this.add.text(14, 28, `${tool.icon}  ${tool.name}`, {
        fontFamily: '"PingFang SC", serif', fontSize: '15px', color: '#e8d27a', fontStyle: 'bold'
      }));
      c.add(this.add.text(14, 50, tool.desc, {
        fontFamily: '"PingFang SC", serif', fontSize: '11px', color: '#6b5824'
      }));
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
    } else {
      c.add(this.add.text(14, 36, '空槽 · 点击装备', {
        fontFamily: '"PingFang SC", serif', fontSize: '13px', color: '#6b5824'
      }));
    }

    bg.on('pointerover', () => bg.setStrokeStyle(2, 0xfff3b8));
    bg.on('pointerout', () => bg.setStrokeStyle(2, tool ? 0xd4af37 : 0x3a2814));
    bg.on('pointerdown', () => {
      Audio.sfx.click();
      this.openSlotPicker(slot);
    });
    return c;
  }

  makeShopCard(t, x, y, gold) {
    const c = this.add.container(x, y);
    const w = 380;
    const h = 56;
    const bg = this.add.rectangle(0, 0, w, h, 0x1a1208).setOrigin(0, 0);
    bg.setStrokeStyle(1, 0x6b5824);
    c.add(bg);

    c.add(this.add.text(14, 6, `${t.icon}  ${t.name}`, {
      fontFamily: '"PingFang SC", serif', fontSize: '14px', color: '#e8d27a', fontStyle: 'bold'
    }));
    c.add(this.add.text(14, 26, `【${SLOT_NAME[t.slot]}】 ${t.desc}`, {
      fontFamily: '"PingFang SC", serif', fontSize: '11px', color: '#a08434',
      wordWrap: { width: 260 }
    }));

    const canBuy = gold >= t.price;
    const btn = this.add.text(w - 14, h / 2, `¥${t.price}  购买`, {
      fontFamily: '"PingFang SC", serif', fontSize: '13px',
      color: canBuy ? '#fff3b8' : '#3a2814',
      backgroundColor: canBuy ? '#3a2814' : '#1a1208',
      padding: { x: 8, y: 4 }
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

  // 消耗品卡片：可重复购买，右侧显示当前库存
  makeConsumableCard(item, x, y, gold, stock) {
    const c = this.add.container(x, y);
    const w = 380;
    const h = 50;
    const bg = this.add.rectangle(0, 0, w, h, 0x0e1e1e).setOrigin(0, 0);
    bg.setStrokeStyle(1, 0x2c5a5a);
    c.add(bg);

    c.add(this.add.text(14, 6, `${item.icon}  ${item.name}　× ${stock}`, {
      fontFamily: '"PingFang SC", serif', fontSize: '14px', color: '#a8e8e8', fontStyle: 'bold'
    }));
    c.add(this.add.text(14, 26, `${item.desc}　热键：${item.hotkey}`, {
      fontFamily: '"PingFang SC", serif', fontSize: '11px', color: '#5fa8a8',
      wordWrap: { width: 260 }
    }));

    const canBuy = gold >= item.price;
    const btn = this.add.text(w - 14, h / 2, `¥${item.price}  +1`, {
      fontFamily: '"PingFang SC", serif', fontSize: '13px',
      color: canBuy ? '#fff3b8' : '#3a2814',
      backgroundColor: canBuy ? '#1c4040' : '#1a1208',
      padding: { x: 8, y: 4 }
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
