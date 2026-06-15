// 文物数据 - 国宝种子 + AI 生成式百科文案（mock 阶段写死）
// 每件文物 = 真实历史国宝
// intro / quote 字段为"模拟 LLM 输出"，后续可由 AICompanion 异步刷新覆盖
export const RELICS = [
  {
    id: 'twelve_zodiac_rabbit',
    name: '圆明园十二兽首·兔首',
    dynasty: '清·乾隆',
    rarity: 'legendary',
    value: 100,
    size: { w: 2, h: 2 },
    desc: '圆明园海晏堂前十二生肖喷泉之一。1860年英法联军劫掠后流散海外。',
    intro:
      '圆明园海晏堂前的十二生肖喷泉，每一个时辰由一兽口吐水柱。1860 年英法联军劫掠后，兔首流落海外百余年。它以红铜浇铸，眉眼仍是郎世宁笔下的灵秀，是中西匠作合璧的孤证。',
    quote: '——铜身犹温，未及一声告别。',
    icon: 'tex_relic_head'  },
  {
    id: 'da_ke_ding',
    name: '大克鼎',
    dynasty: '西周·孝王',
    rarity: 'legendary',
    value: 100,
    size: { w: 3, h: 3 },
    desc: '清光绪年间陕西扶风出土。腹内壁铸铭文290字，记膳夫克受周王册命之事。',
    intro:
      '清光绪十六年陕西扶风出土，腹内壁铸铭文 290 字，记膳夫克受周王册命之事。其形雄浑，纹饰为夔龙变形纹，是西周晚期青铜礼器的代表，与大盂鼎并称"海内三宝"之一。',
    quote: '——三千年前的火，仍灼着今夜的手。',
    icon: 'tex_relic_ding'  },
  {
    id: 'dunhuang_sutra',
    name: '敦煌写经·金刚经',
    dynasty: '唐',
    rarity: 'epic',
    value: 60,
    size: { w: 3, h: 2 },
    desc: '敦煌藏经洞流出。1907年斯坦因以四锭马蹄银换走二十四箱写本。',
    intro:
      '敦煌藏经洞封藏千年，1900 年由王道士偶然开启。1907 年斯坦因仅以四锭马蹄银，便换走二十四箱写本。唐代金刚经写本，墨色至今未褪，字迹工整若刊。',
    quote: '——经卷无言，沙却记得。',
    icon: 'tex_relic_scroll'  },
  {
    id: 'ru_kiln_bowl',
    name: '汝窑天青釉碗',
    dynasty: '北宋',
    rarity: 'epic',
    value: 60,
    size: { w: 2, h: 2 },
    desc: '雨过天青云破处，者般颜色做将来。汝窑传世不足百件。',
    intro:
      '北宋汝官窑，烧造仅二十年，传世不足百件。釉色如雨过天青云破处，开片纹细密如蟹爪。"汝窑为魁"，赵佶亲拟其色，今人难再复其方。',
    quote: '——此色非匠所制，乃天与人偶遇。',
    icon: 'tex_relic_vase'  },
  {
    id: 'jade_cong',
    name: '良渚玉琮',
    dynasty: '新石器·良渚文化',
    rarity: 'rare',
    value: 30,
    size: { w: 2, h: 2 },
    desc: '内圆外方，通天彻地。良渚先民礼器之冠。',
    intro:
      '良渚文化玉琮，距今约 5000 年。内圆外方，象征"天圆地方"，琮身刻神人兽面纹，线如发丝。它是中华礼器之祖，也是"中华文明五千年"最坚硬的注脚。',
    quote: '——五千年的目光，自方寸之中望出。',
    icon: 'tex_relic_jade'  },
  {
    id: 'tang_san_cai',
    name: '唐三彩骆驼载乐俑',
    dynasty: '唐',
    rarity: 'rare',
    value: 30,
    size: { w: 2, h: 3 },
    desc: '黄绿白三色釉，丝路驼铃声。盛唐气象的立体注脚。',
    intro:
      '唐三彩骆驼载乐俑，黄、绿、白三彩流淌如熔金。骆驼背负胡乐数人，正是丝绸之路最盛时的剪影。多出自洛阳、西安墓葬，俑身的釉色仍保持着出窑那一刻的明亮。',
    quote: '——驼铃远了，却仍在彩里走。',
    icon: 'tex_relic_vase'  },
  {
    id: 'qing_ming_scroll',
    name: '清明上河图（残卷）',
    dynasty: '北宋·张择端',
    rarity: 'legendary',
    value: 100,
    size: { w: 3, h: 1 },
    desc: '汴京繁华入画来。八百载流传，几度劫火。',
    intro:
      '北宋张择端绘汴京清明节景象，绢本水墨设色。原作 528 厘米长，记千余人形态，舟楫、市肆、桥拱、酒旗一一可辨。元、明、清屡经劫火，残卷仍是汉地风俗画的极顶。',
    quote: '——画里人未醒，画外人已老。',
    icon: 'tex_relic_scroll'  },
  {
    id: 'silver_seal',
    name: '汉代银印',
    dynasty: '汉',
    rarity: 'rare',
    value: 30,
    size: { w: 1, h: 1 },
    desc: '方寸之间，王侯气象。',
    intro:
      '汉代王侯印信，方寸之间见王权。多以白银铸造，钮制龟、蛇、骆驼者各有等级。其纽印之间的纹饰，是汉代官制秩序的微缩石碑。',
    quote: '——印身虽小，压住的是一整个朝代的呼吸。',
    icon: 'tex_relic_seal'  }
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
