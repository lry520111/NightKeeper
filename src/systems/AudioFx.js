// AudioFx - 程序化音效系统（Web Audio API，无外部素材）
// 设计理念：用最小代码合成"够用"的氛围+反馈音效，避免引入资源文件
// 提供的 SFX：
//   footstep(stealth)  脚步（潜行/常走/疾跑）
//   pickup(rarity)     拾取（按品级音色不同）
//   slash              玩家挥刀
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

  /** 玩家挥刀：高频快速下扫 */
  slash() {
    tone({ freq: 1400, freqEnd: 320, type: 'sawtooth', dur: 0.12, peak: 0.18, release: 0.08, filter: { type: 'highpass', freq: 600, q: 0.9 } });
    noise({ dur: 0.09, peak: 0.18, filter: { type: 'bandpass', freq: 1800, q: 1.6 } });
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
  startAmbience,
  stopAmbience,
  isReady() { return !!ctx; }
};

export default Audio;
