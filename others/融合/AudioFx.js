// AudioFx - 程序化音效系统（Web Audio API，无外部素材）
// 设计理念：用最小代码合成"够用"的氛围+反馈音效，避免引入资源文件
// 提供的 SFX：
//   footstep(stealth)  脚步（潜行/常走/疾跑）
//   pickup(rarity)     拾取（按品级音色不同）
//   slash              玩家挥刀
//   bow                弓箭射击（弦响 + 破空）
//   block              格挡叮响
//   hurt               玩家受伤
//   guardWindup        守卫蓄力警报
//   alert              警觉拉满（追击触发）
//   heartbeat()        心跳（追击中循环）
//   exit               撤离成功
//   fail               失败低音
//   ambience           背景持续低频氛围
//
// 调用方式：
//   import Audio from '@/systems/AudioFx';
//   Audio.init();        // 在用户首次交互后调用一次（解锁 AudioContext）
//   Audio.sfx.pickup('legendary');
//   Audio.startAmbience();
//   Audio.heartbeat.start() / .stop()

let ctx = null;
let masterGain = null;
let ambienceNode = null;
let heartbeatTimer = null;

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.55;
  masterGain.connect(ctx.destination);
  return ctx;
}

/** 通用：包络（attack-decay-release） */
function envGain(g, t0, peak, attack, hold, release) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + attack);
  g.gain.setValueAtTime(Math.max(0.0001, peak), t0 + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
}

/** 振荡器音 + 包络（基础工具） */
function tone({ freq, type = 'sine', dur = 0.15, peak = 0.4, attack = 0.005, release = 0.08, detune = 0, freqEnd = null, filter = null }) {
  if (!ensureCtx()) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
  }
  if (detune) osc.detune.setValueAtTime(detune, t0);
  let last = osc;
  if (filter) {
    const flt = ctx.createBiquadFilter();
    flt.type = filter.type || 'lowpass';
    flt.frequency.value = filter.freq || 1200;
    flt.Q.value = filter.q || 0.7;
    last.connect(flt);
    last = flt;
  }
  envGain(g, t0, peak, attack, Math.max(0.001, dur - attack - release), release);
  last.connect(g);
  g.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** 噪声 + 滤波（用于脚步、爆裂感） */
function noise({ dur = 0.1, peak = 0.25, attack = 0.005, release = 0.06, filter = { type: 'bandpass', freq: 700, q: 1 } }) {
  if (!ensureCtx()) return;
  const t0 = ctx.currentTime;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const flt = ctx.createBiquadFilter();
  flt.type = filter.type;
  flt.frequency.value = filter.freq;
  flt.Q.value = filter.q;
  const g = ctx.createGain();
  envGain(g, t0, peak, attack, Math.max(0.001, dur - attack - release), release);
  src.connect(flt);
  flt.connect(g);
  g.connect(masterGain);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

const sfx = {
  /** 脚步：mode = stealth | walk | sprint */
  footstep(mode = 'walk') {
    if (mode === 'stealth') {
      noise({ dur: 0.06, peak: 0.06, filter: { type: 'lowpass', freq: 380, q: 0.4 } });
    } else if (mode === 'sprint') {
      noise({ dur: 0.09, peak: 0.18, filter: { type: 'bandpass', freq: 600, q: 1.2 } });
    } else {
      noise({ dur: 0.08, peak: 0.12, filter: { type: 'bandpass', freq: 480, q: 0.9 } });
    }
  },

  /** 拾取：按品级音色 */
  pickup(rarity = 'rare') {
    const t0 = ensureCtx() ? ctx.currentTime : 0;
    if (!ctx) return;
    const tones = {
      legendary: [880, 1320, 1760],
      epic: [660, 990, 1320],
      rare: [523, 784],
      common: [440, 660]
    };
    const arr = tones[rarity] || tones.rare;
    arr.forEach((f, i) => {
      setTimeout(() => tone({ freq: f, type: 'triangle', dur: 0.22, peak: 0.32, release: 0.18 }), i * 70);
    });
  },

  /** 玩家挥刀：破空 + 闷击 + 金属高频，形成更有"打击感"的复合音
   *  ① 破空：下扫的窄带噪声（whoosh）
   *  ② 冲击：极短的低频 thud（让攻击有"打到东西"的实感）
   *  ③ 金属高泛音：很短的高频正弦尾，类似刀刃震颤 */
  slash() {
    // ① 破空 whoosh：宽频带通噪声，频率从 2200Hz 下扫到 700Hz
    if (ensureCtx()) {
      const t0 = ctx.currentTime;
      const dur = 0.13;
      const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const flt = ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.Q.value = 1.4;
      flt.frequency.setValueAtTime(2200, t0);
      flt.frequency.exponentialRampToValueAtTime(700, t0 + dur);
      const g = ctx.createGain();
      envGain(g, t0, 0.22, 0.004, dur - 0.05, 0.04);
      src.connect(flt); flt.connect(g); g.connect(masterGain);
      src.start(t0); src.stop(t0 + dur + 0.05);
    }
    // ② 闷击 thud：极短低频正弦下扫，模拟刀身切入空气/物体的实感
    tone({ freq: 180, freqEnd: 70, type: 'sine', dur: 0.07, peak: 0.30, attack: 0.002, release: 0.05, filter: { type: 'lowpass', freq: 280, q: 0.9 } });
    // ③ 金属高泛音：略延迟 25ms，呈现"刀刃震颤"
    setTimeout(() => tone({ freq: 2400, freqEnd: 1600, type: 'triangle', dur: 0.07, peak: 0.10, attack: 0.002, release: 0.05, filter: { type: 'highpass', freq: 1500, q: 0.6 } }), 25);
  },

  /** 弓射：双段"chua-chua" —— 弦响 + 箭羽破空（尖锐版）
   *  ① 弦响 chua：高 Q 带通短噪声 + 高频金属泛音，紧绷且明亮
   *  ② 箭羽破空 chua：略延迟，高频下扫的破空噪声 */
  bow() {
    if (!ensureCtx()) return;
    // ① 弦响 chua：弓弦释放的紧绷"嘣"——更高频、更窄带
    const t0 = ctx.currentTime;
    const dur1 = 0.085;
    const buf1 = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur1), ctx.sampleRate);
    const d1 = buf1.getChannelData(0);
    for (let i = 0; i < d1.length; i++) d1[i] = Math.random() * 2 - 1;
    const src1 = ctx.createBufferSource(); src1.buffer = buf1;
    const flt1 = ctx.createBiquadFilter();
    flt1.type = 'bandpass';
    flt1.frequency.setValueAtTime(2000, t0);
    flt1.frequency.exponentialRampToValueAtTime(1100, t0 + dur1);
    flt1.Q.value = 7.0; // 更高 Q，更尖锐紧绷
    const g1 = ctx.createGain();
    envGain(g1, t0, 0.32, 0.001, dur1 - 0.025, 0.022);
    src1.connect(flt1); flt1.connect(g1); g1.connect(masterGain);
    src1.start(t0); src1.stop(t0 + dur1 + 0.05);
    // 高频金属泛音：让 chua 有"亮闪"的金属感
    tone({ freq: 3200, freqEnd: 2400, type: 'triangle', dur: 0.06, peak: 0.14, attack: 0.001, release: 0.04, filter: { type: 'highpass', freq: 2000, q: 0.7 } });
    // 弦的低频残响（保留一点重量，但减小幅度避免压住高频）
    tone({ freq: 280, freqEnd: 160, type: 'triangle', dur: 0.08, peak: 0.10, attack: 0.002, release: 0.05, filter: { type: 'lowpass', freq: 700, q: 0.8 } });

    // ② 箭羽破空 chua：略延迟 55ms，高频下扫
    setTimeout(() => {
      if (!ensureCtx()) return;
      const t1 = ctx.currentTime;
      const dur2 = 0.15;
      const buf2 = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur2), ctx.sampleRate);
      const d2 = buf2.getChannelData(0);
      for (let i = 0; i < d2.length; i++) d2[i] = Math.random() * 2 - 1;
      const src2 = ctx.createBufferSource(); src2.buffer = buf2;
      const flt2 = ctx.createBiquadFilter();
      flt2.type = 'bandpass';
      flt2.frequency.setValueAtTime(2400, t1);
      flt2.frequency.exponentialRampToValueAtTime(900, t1 + dur2);
      flt2.Q.value = 2.4;
      const g2 = ctx.createGain();
      envGain(g2, t1, 0.20, 0.004, dur2 - 0.05, 0.045);
      src2.connect(flt2); flt2.connect(g2); g2.connect(masterGain);
      src2.start(t1); src2.stop(t1 + dur2 + 0.05);
    }, 55);
  },

  /** 格挡叮响：双音泛音 */
  block() {
    tone({ freq: 1320, type: 'sine', dur: 0.2, peak: 0.3, release: 0.18 });
    setTimeout(() => tone({ freq: 1980, type: 'sine', dur: 0.18, peak: 0.18, release: 0.14 }), 18);
  },

  /** 玩家受伤：低频闷响 */
  hurt() {
    tone({ freq: 220, freqEnd: 90, type: 'square', dur: 0.18, peak: 0.32, release: 0.14, filter: { type: 'lowpass', freq: 600, q: 1 } });
    noise({ dur: 0.18, peak: 0.18, filter: { type: 'lowpass', freq: 350, q: 0.8 } });
  },

  /** 守卫蓄力：上扬警报 */
  guardWindup() {
    tone({ freq: 320, freqEnd: 720, type: 'sawtooth', dur: 0.5, peak: 0.18, release: 0.18, filter: { type: 'bandpass', freq: 700, q: 2 } });
  },

  /** 警觉拉满：尖锐警铃（双音震荡） */
  alert() {
    tone({ freq: 880, type: 'square', dur: 0.16, peak: 0.22 });
    setTimeout(() => tone({ freq: 660, type: 'square', dur: 0.16, peak: 0.22 }), 160);
    setTimeout(() => tone({ freq: 880, type: 'square', dur: 0.16, peak: 0.22 }), 320);
  },

  /** 拾取失败 / 警告 */
  bad() {
    tone({ freq: 220, freqEnd: 110, type: 'square', dur: 0.22, peak: 0.18 });
  },

  /** 撤离成功：上行金色和弦 */
  exit() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => tone({ freq: f, type: 'triangle', dur: 0.32, peak: 0.28, release: 0.26 }), i * 90)
    );
  },

  /** 行动失败：下行低音 */
  fail() {
    [330, 247, 196, 147].forEach((f, i) =>
      setTimeout(() => tone({ freq: f, type: 'sawtooth', dur: 0.3, peak: 0.22, release: 0.2, filter: { type: 'lowpass', freq: 700, q: 0.8 } }), i * 110)
    );
  },

  /** 翻阅纸张（剧情碎片） */
  paper() {
    noise({ dur: 0.18, peak: 0.10, filter: { type: 'highpass', freq: 1500, q: 0.6 } });
  },

  /** UI 点击 */
  click() {
    tone({ freq: 1200, type: 'square', dur: 0.04, peak: 0.12 });
  }
};

const heartbeat = {
  _running: false,
  _bpm: 110,
  start(bpm = 110) {
    if (!ensureCtx()) return;
    this._bpm = bpm;
    if (this._running) return;
    this._running = true;
    const tick = () => {
      if (!this._running) return;
      // 双击：咚-咚
      tone({ freq: 65, freqEnd: 45, type: 'sine', dur: 0.10, peak: 0.30, release: 0.08, filter: { type: 'lowpass', freq: 200, q: 1 } });
      setTimeout(() => {
        if (!this._running) return;
        tone({ freq: 55, freqEnd: 38, type: 'sine', dur: 0.10, peak: 0.22, release: 0.08, filter: { type: 'lowpass', freq: 180, q: 1 } });
      }, 110);
      const interval = 60000 / Math.max(50, this._bpm);
      heartbeatTimer = setTimeout(tick, interval);
    };
    tick();
  },
  setBpm(bpm) { this._bpm = bpm; },
  stop() {
    this._running = false;
    if (heartbeatTimer) { clearTimeout(heartbeatTimer); heartbeatTimer = null; }
  }
};

/** 背景氛围：低频持续嗡鸣 + 偶尔风声 */
function startAmbience() {
  if (!ensureCtx() || ambienceNode) return;
  const t0 = ctx.currentTime;
  // 低频嗡鸣
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 55;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.13;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 6;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);

  const flt = ctx.createBiquadFilter();
  flt.type = 'lowpass';
  flt.frequency.value = 220;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.10, t0 + 1.6);

  osc.connect(flt);
  flt.connect(g);
  g.connect(masterGain);
  osc.start(t0);
  lfo.start(t0);

  ambienceNode = { osc, lfo, g };
}

function stopAmbience() {
  if (!ambienceNode || !ctx) return;
  const t = ctx.currentTime;
  try {
    ambienceNode.g.gain.cancelScheduledValues(t);
    ambienceNode.g.gain.setValueAtTime(ambienceNode.g.gain.value, t);
    ambienceNode.g.gain.linearRampToValueAtTime(0, t + 0.6);
    ambienceNode.osc.stop(t + 0.7);
    ambienceNode.lfo.stop(t + 0.7);
  } catch (e) { /* ignore */ }
  ambienceNode = null;
}

// ============================================================
//  BGM 管理模块（基于 HTML5 Audio，支持淡入淡出 + 场景切换）
// ============================================================
let bgmAudio = null;       // current HTMLAudioElement
let bgmKey = null;         // current playing key (e.g. 'bgm_hub')
let bgmFadeTimer = null;   // fade interval handle
let bgmVolume = 0.45;      // target volume for BGM

const bgm = {
  /**
   * Play a BGM track. If the same track is already playing, do nothing.
   * @param {string} key - asset key registered via Phaser loader (e.g. 'bgm_hub')
   * @param {object} opts - { loop: true, fade: 800, volume: 0.45 }
   */
  play(key, opts = {}) {
    if (!key) return;
    const loop = opts.loop !== undefined ? opts.loop : true;
    const fade = opts.fade !== undefined ? opts.fade : 800;
    const vol = opts.volume !== undefined ? opts.volume : bgmVolume;

    // Same track already playing → skip
    if (bgmKey === key && bgmAudio && !bgmAudio.paused) return;

    // Stop previous track with crossfade
    if (bgmAudio && !bgmAudio.paused) {
      this._fadeOut(bgmAudio, Math.min(fade, 600), () => {});
    }

    // Create new audio element
    const audio = new window.Audio(`assets/audio/${key}.mp3`);
    audio.loop = loop;
    audio.volume = 0;
    audio.play().catch(() => {});

    bgmAudio = audio;
    bgmKey = key;

    // Fade in
    this._fadeIn(audio, fade, vol);
  },

  /** Stop current BGM with fade out */
  stop(fade = 600) {
    if (!bgmAudio) return;
    const ref = bgmAudio;
    bgmKey = null;
    bgmAudio = null;
    this._fadeOut(ref, fade, () => {
      ref.pause();
      ref.src = '';
    });
  },

  /** Switch to a different BGM (convenience wrapper) */
  switchTo(key, opts = {}) {
    if (bgmKey === key && bgmAudio && !bgmAudio.paused) return;
    this.play(key, opts);
  },

  /** Set BGM volume (0~1) */
  setVolume(v) {
    bgmVolume = Math.max(0, Math.min(1, v));
    if (bgmAudio && !bgmAudio.paused) {
      bgmAudio.volume = bgmVolume;
    }
  },

  /** Get current playing key */
  currentKey() { return bgmKey; },

  /** Internal: fade in */
  _fadeIn(audio, duration, targetVol) {
    const steps = 20;
    const interval = duration / steps;
    const increment = targetVol / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= targetVol) {
        audio.volume = targetVol;
        clearInterval(timer);
      } else {
        audio.volume = current;
      }
    }, interval);
  },

  /** Internal: fade out */
  _fadeOut(audio, duration, onComplete) {
    const steps = 20;
    const interval = duration / steps;
    const startVol = audio.volume;
    const decrement = startVol / steps;
    let current = startVol;
    const timer = setInterval(() => {
      current -= decrement;
      if (current <= 0) {
        audio.volume = 0;
        clearInterval(timer);
        if (onComplete) onComplete();
      } else {
        audio.volume = current;
      }
    }, interval);
  }
};

const Audio = {
  /** 在用户首次交互时调用，激活 AudioContext */
  init() {
    ensureCtx();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  },
  /** 设置主音量 0~1 */
  setVolume(v) {
    if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, v));
  },
  sfx,
  heartbeat,
  bgm,
  startAmbience,
  stopAmbience,
  isReady() { return !!ctx; }
};

export default Audio;
