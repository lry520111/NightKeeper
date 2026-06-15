# 夜行者：归藏 NightKeeper

> 中国风像素潜行追缉游戏 · 腾讯云 CodeBuddy 黑客松参赛作品

🎮 **在线试玩**：https://lry520111.github.io/NightKeeper/ *（首次推送 + 开启 Pages 后生效，约 1-2 分钟）*

---

## 一、立意

某博物馆遭窃，国宝流散海外。玩家扮演 **"守夜人"** —— 文物追缉干员，潜入古墓、黑市、走私船，在巡逻守卫的眼皮底下，把本属于这片土地的器物一件件请回家。

每一件成功带回的文物，都会进入"归藏阁"，并在文物百科中解锁它的真实历史。

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
(剧情 / 教学)            (4 卡随机 · 可花 ¥50 刷新)        (背包格搭配)
                                 │
                                 ▼
                       潜入关卡 (MuseumScene)
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
   博物馆 museum            地下黑市 blackmarket        走私船 ship
   青灰守卫 + 灯笼          黑夹克打手 + 紫霓虹         水手帽船员 + 冷光
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 │
                          静步 / 攻击 / 防御
                          视野 & 警觉条 · 巡逻 AI
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
- **biome 多样性**：不同委托对应不同地图风格 + 守卫贴图，长草期内即时换皮

---

## 三、操作

| 按键 | 动作 |
|------|------|
| `W A S D` / 方向键 | 移动 |
| `Shift`（按住） | 静步（降低噪音/视野半径） |
| `J` / 鼠标左键 | 攻击 |
| `K` / 鼠标右键 | 防御 |
| `E` | 拾取 / 互动 / 触发对话 |
| `Tab` | 打开背包 |
| `1` `2` `3` | 使用快捷栏道具（医疗包等） |
| `Esc` | 暂停 / 返回 |

---

## 四、技术栈

- **引擎**：Phaser 3.80 + Vite 5（原生 JS）
- **部署**：纯前端，浏览器即开即玩（赛题硬性要求）
- **AI 接入**（规划中）：腾讯混元 / TokenHub
  - 文物百科卡动态生成
  - 局外"鉴定官"NPC 对话
  - 关卡叙事文案

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
    │   ├── IntroScene.js      # 片头动画（带字幕解说）
    │   ├── TitleScene.js      # 封面
    │   ├── HubScene.js        # 主城枢纽（委托/配装/仓库/出击/馆长）
    │   ├── ContractScene.js   # 委托公告板（支持刷新）
    │   ├── LoadoutScene.js    # 装备配载 + 商店
    │   ├── MuseumScene.js     # 潜入关卡（核心玩法 · 多 biome）
    │   ├── DialogScene.js     # 馆长对话叠加层
    │   ├── ResultScene.js     # 局后结算
    │   ├── VaultScene.js      # 归藏阁（仓库）
    │   └── CodexScene.js      # 文物百科
    ├── data/
    │   ├── biomes.js          # 地图 biome 定义（museum / blackmarket / ship）
    │   ├── contracts.js       # 委托配置（按 biome 分组）
    │   ├── tools.js           # 装备工具
    │   ├── relics.js          # 文物配置
    │   └── curator.js         # 馆长台词与人设
    └── systems/
        ├── Guard.js           # 守卫 AI（按 biome 切贴图）
        └── SaveData.js        # 本地存档
```

---

## 七、开发进度

- [x] Day 1：脚手架 + 决策文档
- [x] Day 2-7：玩家移动 / 视野系统 / 守卫 AI / 拾取撤离闭环
- [x] Day 8：攻击 / 防御 / 静步等高级动作
- [x] Day 9：美术 & 音效初版
- [x] Day 10：主城枢纽 + 委托 + 配装 + 仓库 + 结算 + 存档
- [x] Day 11：片头动画 + 馆长对话 + 商店与快捷栏道具 + 委托刷新
- [x] Day 12：多 biome 地图系统（博物馆 / 地下黑市 / 走私船「沉鲸号」）
- [ ] Day 13：第三/四张地图（古墓 / 拍卖行）+ 密码锁解谜
- [ ] Day 14：接入腾讯混元，动态生成百科与 NPC 对话
- [ ] Day 15：美术终稿 / 测试 / 提交

---

## 八、部署

`main` 分支推送后，GitHub Actions 会自动构建并发布到 GitHub Pages。
首次使用需在仓库 **Settings → Pages → Source** 选择 `GitHub Actions`。

---

## License

MIT
