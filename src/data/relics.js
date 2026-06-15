// 文物数据 - Day1 先放种子数据，后续接 AI 生成百科
// 每件文物 = 真实历史国宝
export const RELICS = [
  {
    id: 'twelve_zodiac_rabbit',
    name: '圆明园十二兽首·兔首',
    dynasty: '清·乾隆',
    rarity: 'legendary',
    value: 100,
    desc: '圆明园海晏堂前十二生肖喷泉之一。1860年英法联军劫掠后流散海外。',
    icon: 'tex_relic'
  },
  {
    id: 'da_ke_ding',
    name: '大克鼎',
    dynasty: '西周·孝王',
    rarity: 'legendary',
    value: 100,
    desc: '清光绪年间陕西扶风出土。腹内壁铸铭文290字，记膳夫克受周王册命之事。',
    icon: 'tex_relic'
  },
  {
    id: 'dunhuang_sutra',
    name: '敦煌写经·金刚经',
    dynasty: '唐',
    rarity: 'epic',
    value: 60,
    desc: '敦煌藏经洞流出。1907年斯坦因以四锭马蹄银换走二十四箱写本。',
    icon: 'tex_relic'
  },
  {
    id: 'ru_kiln_bowl',
    name: '汝窑天青釉碗',
    dynasty: '北宋',
    rarity: 'epic',
    value: 60,
    desc: '雨过天青云破处，者般颜色做将来。汝窑传世不足百件。',
    icon: 'tex_relic'
  },
  {
    id: 'jade_cong',
    name: '良渚玉琮',
    dynasty: '新石器·良渚文化',
    rarity: 'rare',
    value: 30,
    desc: '内圆外方，通天彻地。良渚先民礼器之冠。',
    icon: 'tex_relic'
  },
  {
    id: 'tang_san_cai',
    name: '唐三彩骆驼载乐俑',
    dynasty: '唐',
    rarity: 'rare',
    value: 30,
    desc: '黄绿白三色釉，丝路驼铃声。盛唐气象的立体注脚。',
    icon: 'tex_relic'
  },
  {
    id: 'qing_ming_scroll',
    name: '清明上河图（残卷）',
    dynasty: '北宋·张择端',
    rarity: 'legendary',
    value: 100,
    desc: '汴京繁华入画来。八百载流传，几度劫火。',
    icon: 'tex_relic'
  },
  {
    id: 'silver_seal',
    name: '汉代银印',
    dynasty: '汉',
    rarity: 'rare',
    value: 30,
    desc: '方寸之间，王侯气象。',
    icon: 'tex_relic'
  }
];

export const RARITY_COLOR = {
  legendary: '#ff8c42',
  epic: '#c084fc',
  rare: '#60a5fa',
  common: '#9ca3af'
};

export function getRelicById(id) {
  return RELICS.find((r) => r.id === id);
}
