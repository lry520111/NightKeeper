# 夜行者：归藏 NightKeeper

> 中国风像素潜行追缉游戏 · 腾讯云 CodeBuddy 黑客松参赛作品

🎮 **在线试玩**：https://lry520111.github.io/NightKeeper/ *（推送后约 1-2 分钟生效）*

---

## 一、立意

某博物馆遭窃，国宝流散海外。玩家扮演 **"守夜人"** —— 文物追缉干员，潜入古墓、黑市、走私船，在巡逻守卫的眼皮底下，把本属于这片土地的器物一件件请回家。

每一件成功带回的文物，都会进入"归藏阁"，并在文物百科中解锁它的真实历史。通过 AI 馆长对话，玩家还可以深入了解每件文物背后的故事。

---

## 二、核心循环

```
片头动画 (IntroScene)  ──▶  封面 (TitleScene)
                                 │
                                 ▼
                    主城博物馆 (HubScene)
                                 │
   ┌─────────────────────────────┼─────────────────────────────┐
   │                             │                             │
馆长对话                    委托公告板                     装备配载
(AI 驱动 / 教学)          (4 卡随机 · 可花 ¥50 刷新)        (背包格搭配)
   │                             │                             │
文物鉴赏                    训练场                        存档管理
(RelicChat · LLM)         (TrainingScene)               (多存档位)
                                 │
                                 ▼
                       潜入关卡 (MuseumScene)
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
   博物馆 museum            地下黑市 blackmarket        走私船 ship
   青灰守卫 + 灯笼          黑夹克打手 + 紫霓虹         水手帽船员 + 冷光
   白灰雾气                  淡紫薄雾                    白色海雾
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 │
                    静步 / 攻击 / 防御 / 技能
                    视野 & 警觉条 · 巡逻 AI
                    监控摄像头 · 地刺陷阱
                    远程武器（短弓）
                                 │
                                 ▼
                  撤离点 ──▶ 结算 (ResultScene)
                                 │
                ┌────────────────┴────────────────┐
                ▼                                 ▼
         入库 (VaultScene)                文物百科 (CodexScene)
         ──── 收藏归档 ────                ──── 解锁条目 ────
                                 │
                                 ▼
                       回到主城，进入下一委托
```

- **失败惩罚**：被发现 = 本局已拾取文物归零（已入库的安全）
- **背包取舍**：格子有限，逼玩家在"价值 / 重量 / 工具"之间权衡
- **撤离倒计时**：博物馆开馆前必须撤离
- **biome 多样性**：不同委托对应不同地图风格 + 守卫贴图 + 雾气氛围
- **AI 文物鉴赏**：通过腾讯混元 LLM，与馆长对话了解文物历史

---

## 三、操作

| 按键 | 动作 |
|------|------|
| `W A S D` / 方向键 | 移动 |
| `Shift`（按住） | 静步（降低噪音/视野半径） |
| `J` / 鼠标左键 | 攻击（近战） |
| `K` / 鼠标右键 | 防御 |
| `U` | 释放技能（斩击位移） |
| `E` | 拾取 / 互动 / 触发对话 |
| `Tab` | 打开背包 |
| `1` `2` `3` | 使用快捷栏道具（医疗包 / 远程武器等） |
| `Esc` | 暂停 / 返回 |

---

## 四、技术栈

- **引擎**：Phaser 3.80 + Vite 5（原生 JS）
- **部署**：纯前端，浏览器即开即玩（赛题硬性要求）
- **AI 接入**：腾讯混元 LLM（已集成）
  - 文物百科卡动态生成
  - 馆长 NPC 对话（文物鉴赏 / 历史问答）
  - AI 伙伴系统
- **Serverless**：Vercel 代理转发 API（密钥安全存储）

---

## 五、本地运行

```bash
npm install
npm run dev
```

打开 http://localhost:5174 即可。

构建产物：

```bash
npm run build      # 输出到 dist/
npm run preview    # 本地预览构建产物
```

---

## 六、目录结构

```
NightKeeper/
├── index.html
├── package.json
├── vite.config.js
├── public/
│   └── assets/                # 美术资源（characters / tiles / intro）
└── src/
    ├── main.js                # 入口：注册场景
    ├── scenes/
    │   ├── BootScene.js       # 资源加载 + 初始化
    │   ├── IntroScene.js      # 片头动画（带字幕解说）
    │   ├── TitleScene.js      # 封面
    │   ├── HubScene.js        # 主城枢纽（委托/配装/仓库/出击/馆长）
    │   ├── ContractScene.js   # 委托公告板（支持刷新）
    │   ├── LoadoutScene.js    # 装备配载 + 商店
    │   ├── MuseumScene.js     # 潜入关卡（核心玩法 · 多 biome · 雾气系统）
    │   ├── TrainingScene.js   # 训练场（练习战斗/技能）
    │   ├── DialogScene.js     # 馆长对话叠加层
    │   ├── CuratorMenuScene.js # 馆长菜单
    │   ├── RelicChatScene.js  # 文物鉴赏对话（LLM 驱动）
    │   ├── ResultScene.js     # 局后结算
    │   ├── VaultScene.js      # 归藏阁（仓库）
    │   ├── CodexScene.js      # 文物百科
    │   ├── SaveSlotsScene.js  # 存档位选择
    │   ├── EndingScene.js     # 结局动画
    │   └── EndingPreviewScene.js # 结局预览（开发用）
    ├── data/
    │   ├── biomes.js          # 地图 biome 定义（museum / blackmarket / ship）
    │   ├── blackmarketLayout.js # 黑市地图布局数据
    │   ├── hubLayout.js       # 主城布局数据
    │   ├── roomTemplates.js   # 房间模板
    │   ├── contracts.js       # 委托配置（按 biome 分组）
    │   ├── tools.js           # 装备工具 & 武器
    │   ├── relics.js          # 文物配置（含面具/铜铃/青花瓷等）
    │   └── curatorLines.js    # 馆长台词与人设
    └── systems/
        ├── Guard.js           # 守卫 AI（按 biome 切贴图 · 巡逻/追击）
        ├── LevelGenerator.js  # 关卡生成器
        ├── composeMuseumMap.js      # 博物馆地图合成
        ├── composeMuseumFullMap.js  # 博物馆完整地图（含碰撞/文物精灵）
        ├── composeBlackmarketMap.js # 黑市地图合成
        ├── composeShipMap.js        # 走私船地图合成
        ├── SecurityCamera.js  # 监控摄像头系统
        ├── SpikeTrap.js       # 地刺陷阱系统
        ├── AICompanion.js     # AI 伙伴系统
        ├── LLM.js             # 腾讯混元 LLM 接口
        ├── Codex.js           # 文物百科数据管理
        ├── Endings.js         # 结局系统
        ├── Inventory.js       # 背包系统
        ├── AudioFx.js         # 音效管理
        ├── SaveData.js        # 本地存档
        └── SaveSlots.js       # 多存档位管理
```

---

## 七、特色系统

### 🌫️ 雾气氛围系统
每张地图拥有独立的雾气配置（颜色、浓度、飘动速度），营造阴郁沉浸的潜行氛围：
- 博物馆：白灰色薄雾，缓慢飘动
- 地下黑市：淡紫色雾气，霓虹映衬
- 走私船：白色海雾，随海风飘荡

### ⚔️ 战斗系统
- 近战攻击（J 键）+ 防御（K 键）
- 技能释放（U 键）：斩击附带位移，碰撞墙体自动停止
- 远程武器：短弓射击，消耗弹药

### 🤖 AI 系统
- 腾讯混元 LLM 集成，支持文物鉴赏对话
- 馆长 NPC 智能问答
- AI 伙伴辅助

### 🏛️ 文物收藏
- 20+ 件中国历史文物（青铜器、瓷器、玉器、书画等）
- 每件文物附带真实历史背景
- 归藏阁收藏展示 + 百科图鉴

---

## 八、开发进度

- [x] Day 1：脚手架 + 决策文档
- [x] Day 2-7：玩家移动 / 视野系统 / 守卫 AI / 拾取撤离闭环
- [x] Day 8：攻击 / 防御 / 静步 / 技能等高级动作
- [x] Day 9：美术 & 音效初版
- [x] Day 10：主城枢纽 + 委托 + 配装 + 仓库 + 结算 + 存档
- [x] Day 11：片头动画 + 馆长对话 + 商店与快捷栏道具 + 委托刷新
- [x] Day 12：多 biome 地图系统（博物馆 / 地下黑市 / 走私船「沉鲸号」）
- [x] Day 13：监控摄像头 + 地刺陷阱 + 地图优化
- [x] Day 14：接入腾讯混元 LLM + 文物鉴赏对话 + AI 伙伴
- [x] Day 15：雾气氛围系统 + 战斗技能优化 + 远程武器修复
- [x] Day 16：多存档系统 + 训练场 + 结局系统
- [ ] Day 17：美术终稿 / 平衡性调优 / 测试 / 提交

---

## 九、部署

`main` 分支推送后，GitHub Actions 会自动构建并发布到 GitHub Pages。
首次使用需在仓库 **Settings → Pages → Source** 选择 `GitHub Actions`。

---

## License

MIT
