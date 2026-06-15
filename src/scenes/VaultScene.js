// VaultScene - 保险柜（仓库）
// 展示玩家累计带回的文物。可以"上交（卖出）"换金币（按 70% 价值），或留作图鉴展示。
// 注：图鉴解锁是 Codex 系统记的，卖出不影响图鉴；这里只是经济转化。

import Phaser from 'phaser';
import SaveData from '../systems/SaveData.js';
import Audio from '../systems/AudioFx.js';
import { RARITY_COLOR } from '../data/relics.js';

const W = 960;
const H = 540;
const PAGE_SIZE = 8;

export default class VaultScene extends Phaser.Scene {
  constructor() { super('VaultScene'); }

  create() {
    Audio.init();
    this.add.rectangle(0, 0, W, H, 0x0a0a0a).setOrigin(0, 0);

    this.add
      .text(W / 2, 36, '保　险　柜', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '24px',
        color: '#d4af37',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    this.add.rectangle(W / 2, 56, 200, 1, 0xd4af37);

    this.page = 0;
    this.listGroup = this.add.container(0, 0);

    // 资源条
    this.statText = this.add
      .text(20, 90, '', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '13px',
        color: '#e8d27a'
      });

    // 翻页 / 一键变现按钮
    this.prevBtn = this.makeBtn(W / 2 - 120, H - 60, '［ 上一页 ］', () => {
      if (this.page > 0) { this.page -= 1; this.refresh(); }
    });
    this.nextBtn = this.makeBtn(W / 2, H - 60, '［ 下一页 ］', () => {
      const list = SaveData.getVault();
      if ((this.page + 1) * PAGE_SIZE < list.length) { this.page += 1; this.refresh(); }
    });
    this.sellAllBtn = this.makeBtn(W / 2 + 200, H - 60, '［ 全部上交 ］', () => {
      const list = SaveData.getVault();
      if (!list.length) return;
      let total = 0;
      // 从后往前删，索引才稳
      for (let i = list.length - 1; i >= 0; i--) {
        total += SaveData.sellVaultItem(i);
      }
      this.toast(`全部上交，得 ¥${total}`);
      this.page = 0;
      this.refresh();
    }, 0xff8c42);

    this.add
      .text(W / 2, H - 24, 'Esc / Q  返回前室   ·   上交 = 卖出（70% 价值入账）', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: '#6b5824'
      })
      .setOrigin(0.5);

    this.input.keyboard.on('keydown-ESC', () => this.back());
    this.input.keyboard.on('keydown-Q', () => this.back());

    this.refresh();
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  makeBtn(x, y, label, cb, color = 0xd4af37) {
    const t = this.add
      .text(x, y, label, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '14px',
        color: '#e8d27a',
        backgroundColor: '#1a1208',
        padding: { x: 10, y: 5 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    t.on('pointerover', () => t.setColor('#fff3b8'));
    t.on('pointerout', () => t.setColor('#e8d27a'));
    t.on('pointerdown', () => { Audio.sfx.click(); cb(); });
    return t;
  }

  refresh() {
    this.listGroup.removeAll(true);
    const vault = SaveData.getVault();
    const gold = SaveData.getGold();
    this.statText.setText(`金 ¥${gold}    仓库 ${vault.length} 件`);

    if (!vault.length) {
      this.listGroup.add(
        this.add
          .text(W / 2, H / 2, '柜中尚空。\n带回文物后会陈列于此。', {
            fontFamily: '"PingFang SC", serif',
            fontSize: '16px',
            color: '#6b5824',
            align: 'center'
          })
          .setOrigin(0.5)
      );
      return;
    }

    const start = this.page * PAGE_SIZE;
    const items = vault.slice(start, start + PAGE_SIZE);
    items.forEach((it, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 60 + col * 440;
      const y = 130 + row * 90;
      const realIndex = start + i;
      this.listGroup.add(this.makeItemCard(it, x, y, realIndex));
    });

    // 页码
    const totalPages = Math.ceil(vault.length / PAGE_SIZE);
    this.listGroup.add(
      this.add
        .text(W / 2, H - 90, `第 ${this.page + 1} / ${totalPages} 页`, {
          fontFamily: 'Georgia, serif',
          fontSize: '12px',
          color: '#6b5824'
        })
        .setOrigin(0.5)
    );
  }

  makeItemCard(it, x, y, realIndex) {
    const c = this.add.container(x, y);
    const w = 420;
    const h = 80;
    const bg = this.add.rectangle(0, 0, w, h, 0x1a1208).setOrigin(0, 0);
    bg.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(RARITY_COLOR[it.rarity] || '#6b5824').color);
    c.add(bg);

    const name = this.add.text(14, 12, it.name, {
      fontFamily: '"PingFang SC", serif',
      fontSize: '15px',
      color: '#e8d27a',
      fontStyle: 'bold'
    });
    c.add(name);

    const dyn = this.add.text(14, 34, `${it.dynasty}  ·  ${rarityName(it.rarity)}`, {
      fontFamily: '"PingFang SC", serif',
      fontSize: '12px',
      color: RARITY_COLOR[it.rarity] || '#a08434'
    });
    c.add(dyn);

    const val = this.add.text(14, 54, `估价：¥${it.value}    上交可得：¥${Math.floor(it.value * 0.7)}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '12px',
      color: '#a08434'
    });
    c.add(val);

    const btn = this.add
      .text(w - 14, h / 2, '［ 上交 ］', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '13px',
        color: '#fff3b8',
        backgroundColor: '#3a2814',
        padding: { x: 8, y: 4 }
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setBackgroundColor('#5a3e1c'));
    btn.on('pointerout', () => btn.setBackgroundColor('#3a2814'));
    btn.on('pointerdown', () => {
      Audio.sfx.click();
      const got = SaveData.sellVaultItem(realIndex);
      this.toast(`${it.name} 上交，得 ¥${got}`);
      // 翻页修正
      const remain = SaveData.getVault().length;
      if (this.page > 0 && this.page * PAGE_SIZE >= remain) this.page -= 1;
      this.refresh();
    });
    c.add(btn);

    return c;
  }

  toast(msg) {
    if (this._toast) this._toast.destroy();
    this._toast = this.add
      .text(W / 2, H - 110, msg, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '13px',
        color: '#fff3b8',
        backgroundColor: '#1a1208cc',
        padding: { x: 10, y: 5 }
      })
      .setOrigin(0.5)
      .setDepth(200);
    this.tweens.add({
      targets: this._toast,
      alpha: 0,
      duration: 1400,
      delay: 900,
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

function rarityName(r) {
  return { legendary: '传说', epic: '史诗', rare: '稀有', common: '寻常' }[r] || '—';
}
