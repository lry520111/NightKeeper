// RelicChatScene - 文物图鉴对话场景
// 入口：馆长交互菜单 → "文物图鉴"
// 功能：
//   · 左侧：已解锁文物列表（可滚动选择）
//   · 右侧：与馆长林默的对话窗口（LLM 多轮对话）
//   · 玩家可输入问题，馆长基于文物知识回答
//   · 美术风格：暗金中国风，与 CodexScene 一致

import Phaser from 'phaser';
import { RELICS, RARITY_COLOR } from '../data/relics.js';
import Codex from '../systems/Codex.js';
import Audio from '../systems/AudioFx.js';
import LLM from '../systems/LLM.js';

const RARITY_LABEL = {
  legendary: '传世',
  epic: '稀世',
  rare: '珍品',
  common: '常品'
};

// Layout constants
const SCREEN_W = 1280;
const SCREEN_H = 720;
const LIST_W = 320;
const CHAT_W = SCREEN_W - LIST_W - 60;
const LIST_X = 30;
const CHAT_X = LIST_W + 50;
const TOP_Y = 80;
const BOTTOM_Y = SCREEN_H - 60;

export default class RelicChatScene extends Phaser.Scene {
  constructor() {
    super('RelicChatScene');
  }

  init(data) {
    this._returnTo = (data && data.returnTo) || 'HubScene';
    this._preselect = data && data.relicId || null;
  }

  create() {
    Audio.init();
    const discovered = Codex.discoveredIds();
    this._discoveredRelics = RELICS.filter(r => discovered.includes(r.id));
    this._selectedRelic = null;
    this._chatHistory = [];       // [{ role: 'user'|'assistant', content }]
    this._isWaiting = false;
    this._inputText = '';
    this._chatMessages = [];      // display objects

    // —— Background ——
    this.add.rectangle(0, 0, SCREEN_W, SCREEN_H, 0x0a0a0a).setOrigin(0, 0);

    // —— Title ——
    this.add.text(SCREEN_W / 2, 28, '文物图鉴 · 与馆长对话', {
      fontFamily: '"PingFang SC", "Microsoft YaHei", serif',
      fontSize: '22px',
      color: '#d4af37',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(3);

    // —— Decorative lines ——
    this.add.rectangle(SCREEN_W / 2, 54, SCREEN_W - 80, 1, 0xd4af37, 0.6).setDepth(2);
    this.add.rectangle(SCREEN_W / 2, SCREEN_H - 44, SCREEN_W - 80, 1, 0xd4af37, 0.6).setDepth(2);

    // —— Left panel: Relic list ——
    this._buildRelicList();

    // —— Right panel: Chat area ——
    this._buildChatArea();

    // —— Back button ——
    const backBtn = this.add.text(60, SCREEN_H - 26, '［ 返回 ］', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '16px',
      color: '#e8d27a'
    }).setOrigin(0.5).setDepth(3).setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setColor('#fff3b8'));
    backBtn.on('pointerout', () => backBtn.setColor('#e8d27a'));
    backBtn.on('pointerdown', () => {
      Audio.sfx.click();
      this._destroyInput();
      this.scene.start(this._returnTo);
    });

    // ESC to go back
    this.input.keyboard.on('keydown-ESC', () => {
      this._destroyInput();
      this.scene.start(this._returnTo);
    });

    // Pre-select relic if specified
    if (this._preselect) {
      const idx = this._discoveredRelics.findIndex(r => r.id === this._preselect);
      if (idx >= 0) this._selectRelic(idx);
    } else if (this._discoveredRelics.length > 0) {
      this._selectRelic(0);
    }

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  // ============================================================
  //  Left Panel: Relic List
  // ============================================================
  _buildRelicList() {
    // Panel background
    this.add.rectangle(LIST_X, TOP_Y, LIST_W, BOTTOM_Y - TOP_Y, 0x14110a, 0.9)
      .setOrigin(0, 0).setStrokeStyle(1, 0xd4af37, 0.5).setDepth(1);

    // Header
    this.add.text(LIST_X + LIST_W / 2, TOP_Y + 16, `已解锁 ${this._discoveredRelics.length} / ${RELICS.length}`, {
      fontFamily: '"PingFang SC", serif',
      fontSize: '12px',
      color: '#a08434'
    }).setOrigin(0.5).setDepth(2);

    // Scrollable list container
    const listTop = TOP_Y + 38;
    const listH = BOTTOM_Y - TOP_Y - 50;
    this._listContainer = this.add.container(0, 0).setDepth(2);

    // Mask for scrolling
    const maskShape = this.make.graphics();
    maskShape.fillRect(LIST_X, listTop, LIST_W, listH);
    const mask = maskShape.createGeometryMask();
    this._listContainer.setMask(mask);

    this._listItems = [];
    const ITEM_H = 52;

    this._discoveredRelics.forEach((relic, idx) => {
      const y = listTop + idx * ITEM_H;
      const rarityHex = RARITY_COLOR[relic.rarity] || '#9ca3af';

      // Item background (interactive)
      const bg = this.add.rectangle(LIST_X + 8, y, LIST_W - 16, ITEM_H - 4, 0x1a1208, 0.8)
        .setOrigin(0, 0).setStrokeStyle(1, 0x3d3520, 0.6)
        .setInteractive({ useHandCursor: true });

      // Rarity stripe
      const stripe = this.add.rectangle(LIST_X + 8, y, 3, ITEM_H - 4,
        Phaser.Display.Color.HexStringToColor(rarityHex).color).setOrigin(0, 0);

      // Name
      const name = this.add.text(LIST_X + 20, y + 8, relic.name, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '14px',
        color: '#e8d27a',
        fontStyle: 'bold'
      });

      // Dynasty + rarity
      const sub = this.add.text(LIST_X + 20, y + 28, `${relic.dynasty} · ${RARITY_LABEL[relic.rarity] || ''}`, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '11px',
        color: rarityHex
      });

      bg.on('pointerover', () => bg.setStrokeStyle(1, 0xd4af37, 0.9));
      bg.on('pointerout', () => {
        if (this._selectedIdx !== idx) bg.setStrokeStyle(1, 0x3d3520, 0.6);
      });
      bg.on('pointerdown', () => {
        Audio.sfx.click && Audio.sfx.click();
        this._selectRelic(idx);
      });

      this._listContainer.add([bg, stripe, name, sub]);
      this._listItems.push({ bg, stripe, name, sub, y });
    });

    // Scroll support
    this._listScrollY = 0;
    const contentH = this._discoveredRelics.length * ITEM_H;
    this._listScrollMin = Math.min(0, listH - contentH);
    this._listScrollMax = 0;

    this.input.on('wheel', (_p, _o, _dx, dy) => {
      // Only scroll if pointer is over the list area
      const px = this.input.activePointer.x;
      if (px < LIST_X || px > LIST_X + LIST_W) return;
      this._listScrollY = Phaser.Math.Clamp(this._listScrollY - dy * 0.5, this._listScrollMin, this._listScrollMax);
      this._listContainer.y = this._listScrollY;
    });

    // Empty state
    if (this._discoveredRelics.length === 0) {
      this.add.text(LIST_X + LIST_W / 2, TOP_Y + 100, '尚无已解锁的文物\n\n完成任务带回文物后\n即可在此查阅', {
        fontFamily: '"PingFang SC", serif',
        fontSize: '13px',
        color: '#6b5824',
        align: 'center'
      }).setOrigin(0.5).setDepth(2);
    }
  }

  // ============================================================
  //  Right Panel: Chat Area
  // ============================================================
  _buildChatArea() {
    const chatTop = TOP_Y;
    const chatH = BOTTOM_Y - TOP_Y;

    // Panel background
    this.add.rectangle(CHAT_X, chatTop, CHAT_W, chatH, 0x14110a, 0.9)
      .setOrigin(0, 0).setStrokeStyle(1, 0xd4af37, 0.5).setDepth(1);

    // Relic info header (updated on selection)
    this._relicHeader = this.add.text(CHAT_X + 16, chatTop + 12, '请从左侧选择一件文物', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '15px',
      color: '#fff3b8',
      fontStyle: 'bold'
    }).setDepth(2);

    this._relicSub = this.add.text(CHAT_X + 16, chatTop + 34, '', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '11px',
      color: '#a08434'
    }).setDepth(2);

    // Separator
    this.add.rectangle(CHAT_X + 16, chatTop + 54, CHAT_W - 32, 1, 0xd4af37, 0.4).setOrigin(0, 0).setDepth(2);

    // Chat messages area
    const msgTop = chatTop + 62;
    const msgH = chatH - 120; // leave space for input
    this._msgContainer = this.add.container(0, 0).setDepth(2);

    // Mask for chat messages
    const msgMask = this.make.graphics();
    msgMask.fillRect(CHAT_X, msgTop, CHAT_W, msgH);
    this._msgContainer.setMask(msgMask.createGeometryMask());

    this._msgTop = msgTop;
    this._msgH = msgH;
    this._msgScrollY = 0;
    this._nextMsgY = msgTop + 8;

    // Input area
    const inputY = BOTTOM_Y - 50;
    this.add.rectangle(CHAT_X + 12, inputY, CHAT_W - 24, 38, 0x1a1208, 0.95)
      .setOrigin(0, 0).setStrokeStyle(1, 0x6b5824, 0.7).setDepth(2);

    this._inputDisplay = this.add.text(CHAT_X + 20, inputY + 10, '点击此处输入问题...', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '13px',
      color: '#6b5824',
      wordWrap: { width: CHAT_W - 100 }
    }).setDepth(3);

    // Send button
    this._sendBtn = this.add.text(CHAT_X + CHAT_W - 28, inputY + 10, '发送', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '14px',
      color: '#d4af37',
      fontStyle: 'bold'
    }).setOrigin(1, 0).setDepth(3).setInteractive({ useHandCursor: true });
    this._sendBtn.on('pointerover', () => this._sendBtn.setColor('#fff3b8'));
    this._sendBtn.on('pointerout', () => this._sendBtn.setColor('#d4af37'));
    this._sendBtn.on('pointerdown', () => this._sendMessage());

    // Status indicator
    this._statusText = this.add.text(CHAT_X + CHAT_W - 16, chatTop + 14, '', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '10px',
      color: '#6b5824'
    }).setOrigin(1, 0).setDepth(3);

    // Create HTML input element for text entry
    this._createInputElement();

    // Suggested questions (shown when selecting a relic)
    this._suggestContainer = this.add.container(0, 0).setDepth(2);
  }

  _createInputElement() {
    // Use a DOM input element for proper text entry
    const canvas = this.game.canvas;
    const canvasRect = canvas.getBoundingClientRect();

    this._domInput = document.createElement('input');
    this._domInput.type = 'text';
    this._domInput.placeholder = '输入你想了解的问题...';
    this._domInput.maxLength = 200;
    this._domInput.style.cssText = `
      position: fixed;
      left: ${canvasRect.left + (CHAT_X + 20) * (canvasRect.width / SCREEN_W)}px;
      top: ${canvasRect.top + (BOTTOM_Y - 50 + 4) * (canvasRect.height / SCREEN_H)}px;
      width: ${(CHAT_W - 90) * (canvasRect.width / SCREEN_W)}px;
      height: ${30 * (canvasRect.height / SCREEN_H)}px;
      background: transparent;
      border: none;
      outline: none;
      color: #f4e6c1;
      font-family: "PingFang SC", "Microsoft YaHei", serif;
      font-size: ${13 * (canvasRect.height / SCREEN_H)}px;
      z-index: 1000;
      padding: 4px 8px;
    `;

    this._domInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._sendMessage();
      }
      // Prevent game from capturing these keys
      e.stopPropagation();
    });

    document.body.appendChild(this._domInput);

    // Update position on resize
    this._resizeHandler = () => this._updateInputPosition();
    window.addEventListener('resize', this._resizeHandler);

    // Hide the placeholder text since we have DOM input
    this._inputDisplay.setVisible(false);
  }

  _updateInputPosition() {
    if (!this._domInput) return;
    const canvas = this.game.canvas;
    const canvasRect = canvas.getBoundingClientRect();
    this._domInput.style.left = `${canvasRect.left + (CHAT_X + 20) * (canvasRect.width / SCREEN_W)}px`;
    this._domInput.style.top = `${canvasRect.top + (BOTTOM_Y - 50 + 4) * (canvasRect.height / SCREEN_H)}px`;
    this._domInput.style.width = `${(CHAT_W - 90) * (canvasRect.width / SCREEN_W)}px`;
    this._domInput.style.height = `${30 * (canvasRect.height / SCREEN_H)}px`;
    this._domInput.style.fontSize = `${13 * (canvasRect.height / SCREEN_H)}px`;
  }

  _destroyInput() {
    if (this._domInput) {
      this._domInput.remove();
      this._domInput = null;
    }
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
  }

  // ============================================================
  //  Relic Selection
  // ============================================================
  _selectRelic(idx) {
    if (idx < 0 || idx >= this._discoveredRelics.length) return;

    // Update highlight
    if (this._selectedIdx !== undefined && this._listItems[this._selectedIdx]) {
      this._listItems[this._selectedIdx].bg.setStrokeStyle(1, 0x3d3520, 0.6);
    }
    this._selectedIdx = idx;
    this._listItems[idx].bg.setStrokeStyle(2, 0xd4af37, 1);

    const relic = this._discoveredRelics[idx];
    this._selectedRelic = relic;

    // Update header
    const rarityHex = RARITY_COLOR[relic.rarity] || '#9ca3af';
    this._relicHeader.setText(relic.name);
    this._relicSub.setText(`${relic.dynasty} · ${RARITY_LABEL[relic.rarity] || ''} · ${relic.material || ''}`);
    this._relicSub.setColor(rarityHex);

    // Clear chat
    this._chatHistory = [];
    this._clearMessages();

    // Add welcome message from curator
    const welcomeMsg = `这是${relic.name}。${relic.intro || relic.desc || ''}你想了解它的什么？`;
    this._addMessage('assistant', welcomeMsg);

    // Show suggested questions
    this._showSuggestions(relic);
  }

  _showSuggestions(relic) {
    this._suggestContainer.removeAll(true);

    const suggestions = [
      `${relic.name}的历史背景是什么？`,
      `它是怎么流失海外的？`,
      `这件文物的工艺有什么特别之处？`,
    ];

    const baseY = this._nextMsgY + 8;
    suggestions.forEach((text, i) => {
      const btn = this.add.text(CHAT_X + 24, baseY + i * 28, `💬 ${text}`, {
        fontFamily: '"PingFang SC", serif',
        fontSize: '12px',
        color: '#8c6b1f',
        backgroundColor: '#1a1208',
        padding: { x: 8, y: 4 }
      }).setInteractive({ useHandCursor: true });

      btn.on('pointerover', () => btn.setColor('#d4af37'));
      btn.on('pointerout', () => btn.setColor('#8c6b1f'));
      btn.on('pointerdown', () => {
        this._suggestContainer.removeAll(true);
        if (this._domInput) this._domInput.value = '';
        this._doSend(text);
      });

      this._suggestContainer.add(btn);
    });
  }

  // ============================================================
  //  Chat Messages
  // ============================================================
  _clearMessages() {
    this._msgContainer.removeAll(true);
    this._chatMessages = [];
    this._nextMsgY = this._msgTop + 8;
    this._msgScrollY = 0;
    this._msgContainer.y = 0;
    this._suggestContainer.removeAll(true);
  }

  _addMessage(role, content) {
    const isUser = role === 'user';
    const maxW = CHAT_W - 80;
    const x = isUser ? CHAT_X + CHAT_W - 24 : CHAT_X + 24;

    // Speaker label
    const labelText = isUser ? '你' : '林默 · 馆长';
    const label = this.add.text(x, this._nextMsgY, labelText, {
      fontFamily: '"PingFang SC", serif',
      fontSize: '11px',
      color: isUser ? '#7ae8e8' : '#d4af37',
      fontStyle: 'bold'
    }).setOrigin(isUser ? 1 : 0, 0);
    this._msgContainer.add(label);
    this._nextMsgY += 18;

    // Message bubble
    const msg = this.add.text(x, this._nextMsgY, content, {
      fontFamily: '"PingFang SC", serif',
      fontSize: '13px',
      color: isUser ? '#c8e8f0' : '#f4e6c1',
      wordWrap: { width: maxW, useAdvancedWrap: true },
      lineSpacing: 5
    }).setOrigin(isUser ? 1 : 0, 0);
    this._msgContainer.add(msg);

    const msgHeight = msg.height + 16;
    this._nextMsgY += msgHeight;

    this._chatMessages.push({ label, msg });

    // Auto-scroll to bottom
    this._scrollToBottom();
  }

  _scrollToBottom() {
    const contentH = this._nextMsgY - this._msgTop;
    if (contentH > this._msgH) {
      this._msgScrollY = this._msgH - contentH - 8;
      this._msgContainer.y = this._msgScrollY;
    }
  }

  // ============================================================
  //  Send Message
  // ============================================================
  _sendMessage() {
    if (!this._domInput) return;
    const text = this._domInput.value.trim();
    if (!text) return;
    this._domInput.value = '';
    this._doSend(text);
  }

  async _doSend(text) {
    if (this._isWaiting) return;
    if (!this._selectedRelic) {
      this._addMessage('assistant', '请先从左侧选择一件文物。');
      return;
    }

    // Remove suggestions
    this._suggestContainer.removeAll(true);

    // Add user message
    this._addMessage('user', text);
    this._chatHistory.push({ role: 'user', content: text });

    // Show typing indicator
    this._isWaiting = true;
    this._statusText.setText('馆长正在思考...');
    const typingMsg = this._addTypingIndicator();

    try {
      const result = await LLM.chat({
        relic: this._selectedRelic,
        history: this._chatHistory.slice(-10), // Keep last 10 messages for context
        userMessage: text,
        fallback: this._generateFallback(text)
      });

      // Remove typing indicator
      this._removeTypingIndicator(typingMsg);

      // Add assistant response
      this._addMessage('assistant', result.text);
      this._chatHistory.push({ role: 'assistant', content: result.text });

      // Update status
      this._statusText.setText(
        result.source === 'llm' ? '· 由腾讯混元生成 ·' :
        result.source === 'cache' ? '· 来自缓存 ·' : '· 本地回复 ·'
      );
    } catch (err) {
      this._removeTypingIndicator(typingMsg);
      this._addMessage('assistant', '……通讯似乎出了些问题，稍后再试。');
    }

    this._isWaiting = false;
  }

  _addTypingIndicator() {
    const dots = this.add.text(CHAT_X + 24, this._nextMsgY, '······', {
      fontFamily: '"PingFang SC", serif',
      fontSize: '14px',
      color: '#6b5824'
    });
    this._msgContainer.add(dots);
    this._nextMsgY += 24;
    this._scrollToBottom();

    // Animate dots
    this.tweens.add({
      targets: dots,
      alpha: { from: 0.3, to: 1 },
      duration: 500,
      yoyo: true,
      repeat: -1
    });

    return dots;
  }

  _removeTypingIndicator(dots) {
    if (dots && dots.active) {
      this._nextMsgY -= 24;
      this._msgContainer.remove(dots);
      dots.destroy();
    }
  }

  _generateFallback(question) {
    // Generate a reasonable offline fallback based on the relic data
    const r = this._selectedRelic;
    if (!r) return '请先选择一件文物。';

    if (question.includes('历史') || question.includes('背景')) {
      return r.fallback?.archive || r.intro || r.desc || '这件文物有着悠久的历史。';
    }
    if (question.includes('流') || question.includes('海外') || question.includes('失')) {
      return r.fallback?.journey || `${r.name}曾流散海外，${r.lostTo || '经历坎坷'}。`;
    }
    if (question.includes('工艺') || question.includes('材质') || question.includes('特点')) {
      return `${r.name}以${r.material || '精湛工艺'}制成，${r.motif ? '其' + r.motif + '极具特色' : '工艺精湛'}。`;
    }
    return r.fallback?.welcome || r.intro || `${r.name}，${r.dynasty}，${r.desc || ''}`;
  }

  // ============================================================
  //  Cleanup
  // ============================================================
  shutdown() {
    this._destroyInput();
  }

  destroy() {
    this._destroyInput();
  }
}
