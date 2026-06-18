// LLM.js — 统一的大模型调用入口（带缓存 + 兜底 + 腾讯混元接入位）
//
// 设计目标：
//   1. 业务层只调 callLLM({ scenario, context })，不关心底层模型；
//   2. 任何失败（无网络 / 无密钥 / 模型超时 / 超额）都自动 fallback 到本地兜底文案，
//      保证游戏在无 LLM 的情况下也能完整体验；
//   3. 同一 (scenario + cacheKey) 永久缓存结果，写入 localStorage，避免反复烧 token；
//   4. 队友只需把 _hunyuanFetch 实现完整，并把 LLM_CONFIG.enabled 打开即可启用真实模型。
//
// 用法示例：
//   import LLM from '../systems/LLM.js';
//   const text = await LLM.call({
//     scenario: 'relic_codex',
//     cacheKey: 'twelve_zodiac_rabbit',
//     context: { relic: {...}, section: 'archive' },
//     fallback: '...保底文案...'
//   });

import SaveSlots from './SaveSlots.js';

const BASE_CACHE_KEY = 'nightkeeper:llm-cache:v1';
function cacheStorageKey() { return SaveSlots.slotKey(BASE_CACHE_KEY); }

// ——————————————————————————————————————————————
// 配置：队友接入腾讯混元时只需改这里
// ——————————————————————————————————————————————
const LLM_CONFIG = {
  enabled: true,                     // Hunyuan API enabled
  provider: 'hunyuan',               // 'hunyuan' | 'mock'
  endpoint: 'https://tokenhub.tencentmaas.com/v1',  // Hunyuan tokenhub endpoint
  apiKey: import.meta.env.VITE_HUNYUAN_KEY || '',  // Auto-read from .env or runtime inject
  model: 'hy3-preview',               // hy3 preview model
  timeoutMs: 15000,
  maxTokens: 600
};

// ——————————————————————————————————————————————
// 持久化缓存（localStorage）
// ——————————————————————————————————————————————
function loadCache() {
  if (typeof localStorage === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(cacheStorageKey()) || '{}') || {}; }
  catch { return {}; }
}
function saveCache(cache) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(cacheStorageKey(), JSON.stringify(cache)); } catch { /* ignore */ }
}
function cacheGet(scenario, key) {
  const c = loadCache();
  return (c[scenario] && c[scenario][key]) || null;
}
function cacheSet(scenario, key, value) {
  const c = loadCache();
  c[scenario] = c[scenario] || {};
  c[scenario][key] = value;
  saveCache(c);
}

// ——————————————————————————————————————————————
// Prompt 模板（按 scenario 区分）
// ——————————————————————————————————————————————
function buildPrompt(scenario, context) {
  switch (scenario) {
    case 'relic_codex_archive': {
      // 历史档案：考古口吻
      const r = context.relic || {};
      return `你是一位资深的中国文物研究员。请用考古学权威的语气，为下面这件中国文物撰写一段「历史档案」。
要求：
- 200 字以内，单一段落，不要分点。
- 包含年代、出土/发现经历、形制工艺、文化意义。
- 不要使用"我认为""大家好"等口语，保持博物馆解说风格。

文物信息：
- 名称：${r.name || ''}
- 朝代：${r.dynasty || ''}
- 年代：${r.era || ''}
- 出土/发现地：${r.origin || ''}
- 材质：${r.material || ''}
- 纹饰：${r.motif || ''}
- 简介：${r.desc || ''}

请直接输出档案正文，不要任何前缀。`;
    }
    case 'relic_codex_journey': {
      // 流散经历：游戏世界观
      const r = context.relic || {};
      return `你正在为一款名为《夜行者：归藏》的国宝追回主题游戏撰写文物百科。
请为下面这件文物撰写一段「流散经历」，描述它在近代如何离开本土、辗转何方、最终被夜行司追回。

要求：
- 150 字以内，单一段落。
- 风格沉郁、克制，不要煽情；可以提及具体年代、人物、地点（虚构亦可，但需符合史实大背景）。
- 结尾暗示它已经回到博物馆。

文物信息：
- 名称：${r.name || ''}
- 朝代：${r.dynasty || ''}
- 流散去向：${r.lostTo || '海外私人藏家或拍卖行'}
- 真实历史背景：${r.desc || ''}

请直接输出正文，不要任何前缀。`;
    }
    case 'relic_codex_welcome': {
      // 馆长林默的归来感言
      const r = context.relic || {};
      return `你扮演《夜行者：归藏》中的博物馆馆长林默——一位沉静、敬重器物的中年女性。
请为下面这件刚刚归藏的文物，写一段不超过 80 字的「归来感言」。

要求：
- 第一人称，馆长视角；
- 语气温和、含蓄、有诗意；
- 不出现"我"以外的人物名字，不喊口号；
- 单段，不要分行。

文物：${r.name || ''}（${r.dynasty || ''}）

请直接输出感言。`;
    }
    case 'relic_chat': {
      // Multi-turn relic chat: system prompt only (messages handled separately)
      const r = context.relic || {};
      return `你是博物馆馆长林默，一位沉静、博学、敬重器物的中年女性学者。你正在与一位年轻的夜行司守夜人（玩家）交流关于文物的知识。

当前讨论的文物：
- 名称：${r.name || ''}
- 朝代：${r.dynasty || ''}
- 年代：${r.era || ''}
- 出土/发现地：${r.origin || ''}
- 材质：${r.material || ''}
- 纹饰/形制：${r.motif || ''}
- 简介：${r.desc || ''}
- 流散经历：${r.lostTo || ''}

要求：
- 以馆长林默的身份回答，语气沉静、温和、有学者气质；
- 回答要有历史深度，可以延伸到相关的历史背景、文化意义、工艺特点；
- 如果玩家问到超出文物本身的问题，可以适当关联其他历史知识；
- 每次回答控制在 150 字以内，简洁有力；
- 不要使用表情符号，不要分点列举，保持自然对话风格；
- 可以偶尔引用古诗文或典故来增添文化氛围。`;
    }
    case 'curator_review': {
      // 单局复盘
      const s = context.stats || {};
      return `你是博物馆馆长林默。玩家刚刚完成一次夜行任务，请基于下面的统计数据，对玩家说一段不超过 100 字的复盘点评。
- 风格沉静克制，不夸张；
- 可以肯定，也可以委婉批评；
- 不要分行，不要使用表情。

数据：
- 是否撤离成功：${s.success ? '是' : '否'}
- 带回文物数：${s.items || 0}
- 击杀守卫数：${s.kills || 0}
- 被发现次数：${s.alerts || 0}

请直接输出点评。`;
    }
    case 'ending_monologue': {
      // 结局独白
      const e = context.ending || {};
      const s = context.stats || {};
      return `你正在为像素游戏《夜行者：归藏》撰写结局独白，结局编号为「${e.id}」（${e.title}）。
游戏背景：玩家扮演夜行司守夜人，从黑市、私人藏家、走私船等地追回流散海外的中国国宝。

请基于该结局基调与玩家本周目数据，写一段 200~250 字的独白：

结局基调：${e.tone || ''}
玩家数据：
- 已归藏文物：${s.relicsCollected}
- 累计击杀守卫：${s.totalKills}
- 累计无伤通关：${s.totalGhostRuns}
- 累计消费金额：${s.totalSpent}

要求：
- 第一人称（馆长林默 或 守夜人 自述，按结局基调挑选）；
- 单段，无分行；
- 不夸张，不口号化，可以含一句留白。

请直接输出独白。`;
    }
    default:
      return JSON.stringify(context || {});
  }
}

// ——————————————————————————————————————————————
// 真实接入位：腾讯混元（OpenAI 兼容协议）
// ——————————————————————————————————————————————
async function _hunyuanFetch(prompt, opts = {}) {
  const messages = opts.messages || [{ role: 'user', content: prompt }];
  const resp = await fetch(`${LLM_CONFIG.endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_CONFIG.apiKey}`
    },
    body: JSON.stringify({
      model: opts.model || LLM_CONFIG.model,
      messages,
      max_tokens: opts.maxTokens || LLM_CONFIG.maxTokens,
      temperature: opts.temperature || 0.8,
      stream: false
    })
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Hunyuan API ${resp.status}: ${errText}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('LLM timeout')), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

// ——————————————————————————————————————————————
// 对外 API
// ——————————————————————————————————————————————
const LLM = {
  /**
   * 主入口：调用大模型。失败永远返回 fallback，绝不抛错。
   * @param {Object}   opts
   * @param {string}   opts.scenario  场景标签：relic_codex_archive / relic_codex_journey / relic_codex_welcome / curator_review / ending_monologue
   * @param {string}   opts.cacheKey  缓存 key（同一 key 永久缓存，留空则不缓存）
   * @param {Object}   opts.context   prompt 渲染上下文
   * @param {string}   opts.fallback  兜底文案（必填，强烈建议）
   * @param {boolean}  opts.forceRefresh 是否强制刷新缓存
   * @returns {Promise<{ text: string, source: 'cache'|'llm'|'fallback' }>}
   */
  async call({ scenario, cacheKey = '', context = {}, fallback = '', forceRefresh = false } = {}) {
    // 1) 缓存命中直接返回
    if (cacheKey && !forceRefresh) {
      const cached = cacheGet(scenario, cacheKey);
      if (cached && typeof cached === 'string' && cached.length > 0) {
        return { text: cached, source: 'cache' };
      }
    }

    // 2) 未启用 → 直接 fallback
    if (!LLM_CONFIG.enabled) {
      return { text: fallback, source: 'fallback' };
    }

    // 3) 真实调用
    try {
      const prompt = buildPrompt(scenario, context);
      const text = await withTimeout(
        _hunyuanFetch(prompt, { maxTokens: LLM_CONFIG.maxTokens }),
        LLM_CONFIG.timeoutMs
      );
      const cleaned = (text || '').toString().trim();
      if (!cleaned) return { text: fallback, source: 'fallback' };
      if (cacheKey) cacheSet(scenario, cacheKey, cleaned);
      return { text: cleaned, source: 'llm' };
    } catch (err) {
      // 失败完全静默，业务层无感知
      // eslint-disable-next-line no-console
      console.warn('[LLM] call failed, using fallback:', err && err.message);
      return { text: fallback, source: 'fallback' };
    }
  },

  /** 清空指定场景或全部缓存（调试用） */
  clearCache(scenario = null) {
    if (typeof localStorage === 'undefined') return;
    if (!scenario) {
      try { localStorage.removeItem(cacheStorageKey()); } catch { /* ignore */ }
      return;
    }
    const c = loadCache();
    delete c[scenario];
    saveCache(c);
  },

  /** 是否启用了真实 LLM（UI 上可据此显示 "AI 生成中..." 提示） */
  isEnabled() { return !!LLM_CONFIG.enabled; },

  /** 提供给队友：运行时切换配置（例如登录后注入 apiKey） */
  configure(patch = {}) {
    Object.assign(LLM_CONFIG, patch);
  },

  /**
   * Multi-turn chat API for relic encyclopedia conversations.
   * @param {Object}   opts
   * @param {Object}   opts.relic       The relic data object
   * @param {Array}    opts.history     Chat history: [{ role: 'user'|'assistant', content }]
   * @param {string}   opts.userMessage The latest user message
   * @param {string}   opts.fallback    Fallback text if LLM fails
   * @returns {Promise<{ text: string, source: 'llm'|'fallback' }>}
   */
  async chat({ relic, history = [], userMessage, fallback = '' } = {}) {
    if (!LLM_CONFIG.enabled || !LLM_CONFIG.apiKey) {
      return { text: fallback || '（大模型未启用，请先配置 API Key）', source: 'fallback' };
    }

    try {
      const systemPrompt = buildPrompt('relic_chat', { relic });
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userMessage }
      ];

      const text = await withTimeout(
        _hunyuanFetch('', { messages, maxTokens: LLM_CONFIG.maxTokens, temperature: 0.85 }),
        LLM_CONFIG.timeoutMs
      );
      const cleaned = (text || '').toString().trim();
      if (!cleaned) return { text: fallback || '……我一时语塞。', source: 'fallback' };
      return { text: cleaned, source: 'llm' };
    } catch (err) {
      console.warn('[LLM] chat failed:', err && err.message);
      return { text: fallback || '……通讯似乎出了些问题，稍后再试。', source: 'fallback' };
    }
  }
};

export default LLM;
export { LLM_CONFIG };
