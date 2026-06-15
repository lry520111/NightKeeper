// AICompanion - LLM 接口层（当前为 Mock 实现，后续可替换为真实 LLM API）
//
// 设计目标：
//   1. 把所有"由 AI 生成的文本"（文物百科、夜枭批语、委托文案、守卫嘲讽等）
//      统一放在这一层产出，业务层只调用接口、不关心 mock 还是云端。
//   2. mock 阶段的产出尽量贴近"LLM 风格"：长度合适、语气统一、不重复。
//   3. 切换为真实 API 时，只需修改 _config.provider 与对应的 _callRemote 实现。
//
// 公开 API：
//   quipForPickup(relic)         拾取闪话（同步，主角内心独白，按品级）
//   getRelicLore(relic)          获取文物百科（异步，返回 { intro, quote }）
//   getCommissionBrief(...)      获取委托描述（异步，预留给 Hub 阶段使用）
//   getGuardTaunt(stateInfo)     守卫嘲讽（同步）
//   setProvider({...})           切换 provider（mock | openai | qwen | ollama）
//
// 真实 API 接入位点：本文件底部的 _callRemote()

import { RELICS } from '../data/relics.js';

const _config = {
  provider: 'mock',     // mock | openai | qwen | ollama
  endpoint: '',
  apiKey: '',
  model: ''
};

export function setProvider(cfg) {
  Object.assign(_config, cfg);
}

// ============ 拾取闪话（同步，主角独白） ============
export function quipForPickup(relic) {
  const r = (relic && relic.rarity) || 'rare';
  const pool = {
    legendary: [
      '神器在手……不能落他人之手。',
      '此物当还于天地。',
      '终于找到你了。',
      '一寸光阴一寸金，今夜归你于我。'
    ],
    epic: [
      '真品，份量十足。',
      '收好，别让它再流落。',
      '这一件，足够了。',
      '稳一些，再稳一些。'
    ],
    rare: [
      '小心翼翼……',
      '可惜，差一口气。',
      '暂且收好。',
      '聊胜于无。'
    ]
  };
  const arr = pool[r] || pool.rare;
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============ 守卫嘲讽 ============
export function getGuardTaunt({ state, prevState }) {
  if (prevState === 'patrol' && state === 'suspicious') {
    return _pick(['嗯？是谁？', '什么动静……', '有人吗？', '谁在那里？']);
  }
  if (state === 'chase') {
    return _pick(['有贼！', '站住！', '抓贼！', '果然有人！']);
  }
  if ((prevState === 'chase' || prevState === 'suspicious') && state === 'patrol') {
    return _pick(['……是错觉吗？', '老眼昏花。', '什么都没有。', '风声而已。']);
  }
  return null;
}

// ============ 文物百科（异步，模拟 LLM 调用） ============
/**
 * 获取文物的"AI 生成"百科（intro + quote）
 * @param {object} relic
 * @returns {Promise<{intro:string, quote:string}>}
 */
export async function getRelicLore(relic) {
  if (!relic || !relic.id) return { intro: '', quote: '' };

  // mock 阶段：直接命中预生成 map，模拟 60~180ms 的 LLM 响应
  if (_config.provider === 'mock') {
    await _delay(60 + Math.random() * 120);
    const local = LORE[relic.id];
    if (local) return local;
    // 没命中预设：合成一段
    return _composeFallback(relic);
  }

  // 真实 API：留作下一步替换
  try {
    const text = await _callRemote(_buildLorePrompt(relic));
    return _parseLoreResponse(text, relic);
  } catch (e) {
    console.warn('[AICompanion] remote error, fallback to mock:', e);
    return LORE[relic.id] || _composeFallback(relic);
  }
}

// ============ 委托文案（预留给 HubScene） ============
export async function getCommissionBrief({ relicId, clientType = 'collector' }) {
  if (_config.provider === 'mock') {
    await _delay(80 + Math.random() * 120);
    const r = RELICS.find((x) => x.id === relicId);
    if (!r) return { title: '匿名委托', body: '夜，去博物馆，把它带回来。' };
    return _mockCommission(r, clientType);
  }
  try {
    const text = await _callRemote(_buildCommissionPrompt(relicId, clientType));
    return _parseCommissionResponse(text);
  } catch (e) {
    return { title: '匿名委托', body: '夜，去博物馆，把它带回来。' };
  }
}

// ============ 内部工具 ============
function _pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function _delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function _composeFallback(relic) {
  return {
    intro: `${relic.name}，${relic.dynasty}时所造。${relic.desc || ''}`,
    quote: '——夜枭未至，旧物先言。'
  };
}

// 预生成的"LLM 输出"（写死的种子文案），与 RELICS 的 id 一一对应
const LORE = {
  twelve_zodiac_rabbit: {
    intro:
      '圆明园海晏堂前的十二生肖喷泉，每个时辰由一兽口吐水柱。1860 年英法联军劫掠后，兔首流落海外百余年。它以红铜浇铸，眉眼仍是郎世宁笔下的灵秀，是中西匠作合璧的孤证。',
    quote: '——铜身犹温，未及一声告别。'
  },
  da_ke_ding: {
    intro:
      '清光绪十六年陕西扶风出土，腹内壁铸铭文 290 字，记膳夫克受周王册命之事。其形雄浑，纹饰为夔龙变形纹，是西周晚期青铜礼器的代表，与大盂鼎并称"海内三宝"之一。',
    quote: '——三千年前的火，仍灼着今夜的手。'
  },
  dunhuang_sutra: {
    intro:
      '敦煌藏经洞封藏千年，1900 年由王道士偶然开启。1907 年斯坦因仅以四锭马蹄银，便换走二十四箱写本。唐代金刚经写本，墨色至今未褪，字迹工整若刊。',
    quote: '——经卷无言，沙却记得。'
  },
  ru_kiln_bowl: {
    intro:
      '北宋汝官窑，烧造仅二十年，传世不足百件。釉色如雨过天青云破处，开片纹细密如蟹爪。"汝窑为魁"，赵佶亲拟其色，今人难再复其方。',
    quote: '——此色非匠所制，乃天与人偶遇。'
  },
  jade_cong: {
    intro:
      '良渚文化玉琮，距今约 5000 年。内圆外方，象征"天圆地方"，琮身刻神人兽面纹，线如发丝。它是中华礼器之祖，也是"中华文明五千年"最坚硬的注脚。',
    quote: '——五千年的目光，自方寸之中望出。'
  },
  tang_san_cai: {
    intro:
      '唐三彩骆驼载乐俑，黄、绿、白三彩流淌如熔金。骆驼背负胡乐数人，正是丝绸之路最盛时的剪影。多出自洛阳、西安墓葬，俑身的釉色仍保持着出窑那一刻的明亮。',
    quote: '——驼铃远了，却仍在彩里走。'
  },
  qing_ming_scroll: {
    intro:
      '北宋张择端绘汴京清明节景象，绢本水墨设色。原作 528 厘米长，记千余人形态，舟楫、市肆、桥拱、酒旗一一可辨。元、明、清屡经劫火，残卷仍是汉地风俗画的极顶。',
    quote: '——画里人未醒，画外人已老。'
  },
  silver_seal: {
    intro:
      '汉代王侯印信，方寸之间见王权。多以白银铸造，钮制龟、蛇、骆驼者各有等级。其纽印之间的纹饰，是汉代官制秩序的微缩石碑。',
    quote: '——印身虽小，压住的是一整个朝代的呼吸。'
  }
};

function _mockCommission(relic, clientType) {
  const presets = {
    collector: {
      title: `私人委托·${relic.name}`,
      body:
        `先生（女士）：\n` +
        `贵处寻人多日，闻您身手稳妥。\n` +
        `${relic.dynasty}之物 ${relic.name}，现在 X 博物馆夜间陈列。\n` +
        `望今夜亥时之后，将其完整带出，酬金面议。\n` +
        `——切记不可惊动馆内值守。`
    },
    scholar: {
      title: `学人之托·${relic.name}`,
      body:
        `我是研究 ${relic.dynasty} 史的某教授。\n` +
        `${relic.name} 的真伪，于学界争论已久。\n` +
        `若能借您之手将其取出三日，做一次科学测年——\n` +
        `它将不再被困于玻璃柜后。`
    },
    grave: {
      title: `——同行问候——`,
      body:
        `不必多言，您我都是夜里的人。\n` +
        `${relic.name} 该回它该去的地方。\n` +
        `今夜动手，事成各分。`
    }
  };
  return presets[clientType] || presets.collector;
}

// ============ 真实 API 接入预留位（下一步实现） ============
async function _callRemote(prompt) {
  // 占位：真实切换时在此 fetch _config.endpoint
  throw new Error('remote provider not implemented yet');
}

function _buildLorePrompt(relic) {
  return `请用 100~180 字介绍中国文物"${relic.name}"（${relic.dynasty}），并附一句不超过 18 字的诗意感叹。`;
}

function _parseLoreResponse(text, relic) {
  // 简单解析：取最后一行作为 quote
  const lines = (text || '').split('\n').map((s) => s.trim()).filter(Boolean);
  if (lines.length >= 2) {
    return { intro: lines.slice(0, -1).join(' '), quote: lines[lines.length - 1] };
  }
  return _composeFallback(relic);
}

function _buildCommissionPrompt(relicId, clientType) {
  const r = RELICS.find((x) => x.id === relicId);
  return `以"${clientType}"的身份，写一段不超过 80 字的委托信，目标文物是"${r ? r.name : relicId}"。`;
}

function _parseCommissionResponse(text) {
  return { title: '委托', body: text };
}

export default {
  quipForPickup,
  getGuardTaunt,
  getRelicLore,
  getCommissionBrief,
  setProvider
};
