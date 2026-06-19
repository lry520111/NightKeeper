// 地图 biome 数据：每个 biome 决定贴图组、光照、场景名、敌人样式
// 后续可扩展：tomb（古墓）、ruin（废弃博物馆分馆）等
//
// 字段：
//   id              biome 唯一标识
//   name            UI 显示的中文场景名
//   subtitle        进入时的副标题（一行氛围描述）
//   floorKeys       地板贴图列表（按权重平铺，第一个最常见）
//   wallKey         墙体贴图（侧/底面）
//   wallTopKey      墙顶贴图
//   darkness        基础黑暗色（光照层填充色）
//   lampTint        装饰灯笼颜色（用于灯笼光晕）
//   guardCount      默认守卫数（可被 generateLevel 参数覆盖）
//   relicCount      默认文物数
//   guardStyle      敌人风格 id（决定 Guard 使用哪一组贴图：'museum' / 'thug' / 'sailor'）

export const BIOMES = {
  museum: {
    id: 'museum',
    name: '博物馆',
    subtitle: '夜雨敲檐  ·  灯笼半灭',
    floorKeys: ['tex_floor', 'tex_floor', 'tex_floor', 'tex_floor_a', 'tex_floor_b'],
    wallKey: 'tex_wall',
    wallTopKey: 'tex_wall_top',
    darkness: 0x1a2838,       // lighter blue-grey
    darknessAlpha: 0.55,      // much brighter scene
    ambientColor: 0x1a3050,   // lighter navy background
    lampTint: 0xffd27a,
    fogColor: 0xc8d8e8,       // white-grey fog
    fogAlpha: 0.50,           // thick white fog
    fogSpeed: 0.18,           // slow drift for atmosphere
    guardCount: 8,
    relicCount: 7,
    guardStyle: 'museum'      // 经典守卫：青灰长褂 + 红缨
  },
  blackmarket: {
    id: 'blackmarket',
    name: '地下黑市',
    subtitle: '霓虹冷光  ·  铁皮货架间贼影幢幢',
    floorKeys: ['tex_floor_bm', 'tex_floor_bm', 'tex_floor_bm_a', 'tex_floor_bm_b'],
    wallKey: 'tex_wall_bm',
    wallTopKey: 'tex_wall_bm_top',
    darkness: 0x140a28,       // lighter purple-black
    darknessAlpha: 0.58,
    ambientColor: 0x1a0c30,   // lighter purple background
    lampTint: 0xc070ff,       // 紫色霓虹
    fogColor: 0xd0c0e8,       // pale lavender fog
    fogAlpha: 0.45,           // thick pale fog
    fogSpeed: 0.2,
    guardCount: 6,            // 黑市治安"严"——多 1 个打手
    relicCount: 7,
    guardStyle: 'thug'        // 黑市打手：黑夹克 + 红头巾
  },
  ship: {
    id: 'ship',
    name: '走私船「沉鲸号」',
    subtitle: '咸雾扑面  ·  铁锚锈蚀  ·  脚下浪涛低吼',
    floorKeys: ['tex_floor_sp', 'tex_floor_sp', 'tex_floor_sp_a', 'tex_floor_sp_b'],
    wallKey: 'tex_wall_sp',
    wallTopKey: 'tex_wall_sp_top',
    darkness: 0x0c2030,       // lighter ocean blue
    darknessAlpha: 0.52,
    ambientColor: 0x102838,   // lighter sea background
    lampTint: 0x7ad8ff,       // 冷白海灯
    fogColor: 0xd0e4f0,       // white sea mist
    fogAlpha: 0.50,           // thick sea fog
    fogSpeed: 0.35,           // sea wind drift
    guardCount: 6,            // 船员多
    relicCount: 7,
    guardStyle: 'sailor'      // 船员：海军蓝 + 水手帽
  }
};

export function getBiome(id) {
  return BIOMES[id] || BIOMES.museum;
}

export default BIOMES;
