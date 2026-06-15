# 夜行者：归藏 NightKeeper

> 中国风像素潜行追缉游戏 · 腾讯云 CodeBuddy 黑客松参赛作品

🎮 **在线试玩**：https://lry520111.github.io/NightKeeper/ *（首次推送 + 开启 Pages 后生效，约 1-2 分钟）*

---

## 一、立意

某博物馆遭窃，国宝流散海外。玩家扮演 **"守夜人"** —— 文物追缉干员，潜入古墓、拍卖行、私人收藏，在巡逻守卫的眼皮底下，把本属于这片土地的器物一件件请回家。

每一件成功带回的文物，都会进入"归藏阁"，并在文物百科中解锁它的真实历史。

---

## 二、核心循环

```
主城枢纽 (HubScene)
   │
   ├─ 委托公告板 ──→ 选择本局目标文物
   ├─ 装备配载  ──→ 在格子有限的背包里搭配工具
   │
   ▼
潜入关卡 (MuseumScene)
   │  · 静步 / 攻击 / 防御
   │  · 视野 & 警觉条
   │  · 巡逻守卫 AI
   ▼
撤离点 ──→ 结算 (ResultScene)
   │
   ├─ 入库 (VaultScene)        —— 收藏归档
   └─ 文物百科 (CodexScene)    —— 解锁条目
   │
   ▼
回到主城，进入下一委托
```

- **失败惩罚**：被发现 = 本局已拾取文物归零（已入库的安全）
- **背包取舍**：格子有限，逼玩家在"价值 / 重量 / 工具"之间权衡
- **撤离倒计时**：博物馆开馆前必须撤离

---

## 三、操作

| 按键 | 动作 |
|------|------|
| `W A S D` / 方向键 | 移动 |
| `Shift`（按住） | 静步（降低噪音/视野半径） |
| `J` / 鼠标左键 | 攻击 |
| `K` / 鼠标右键 | 防御 |
| `E` | 拾取 / 互动 |
| `Tab` | 打开背包 |
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
├── public/                    # 静态资源
└── src/
    ├── main.js                # 入口：注册场景
    ├── scenes/
    │   ├── TitleScene.js      # 封面
    │   ├── HubScene.js        # 主城枢纽（委托/配装/仓库/出击）
    │   ├── ContractScene.js   # 委托公告板
    │   ├── LoadoutScene.js    # 装备配载
    │   ├── MuseumScene.js     # 潜入关卡（核心玩法）
    │   ├── ResultScene.js     # 局后结算
    │   ├── VaultScene.js      # 归藏阁（仓库）
    │   └── CodexScene.js      # 文物百科
    ├── data/
    │   ├── contracts.js       # 委托配置
    │   ├── tools.js           # 装备工具
    │   └── relics.js          # 文物配置
    └── systems/
        └── SaveData.js        # 本地存档
```

---

## 七、开发进度

- [x] Day 1：脚手架 + 决策文档
- [x] Day 2-7：玩家移动 / 视野系统 / 守卫 AI / 拾取撤离闭环
- [x] Day 8：攻击 / 防御 / 静步等高级动作
- [x] Day 9：美术 & 音效初版
- [x] Day 10：主城枢纽 + 委托 + 配装 + 仓库 + 结算 + 存档
- [ ] Day 11：第二章地图（古墓 / 拍卖行）
- [ ] Day 12：接入腾讯混元，动态生成百科与 NPC 对话
- [ ] Day 13-15：美术终稿 / 测试 / 提交

---

## 八、部署

`main` 分支推送后，GitHub Actions 会自动构建并发布到 GitHub Pages。
首次使用需在仓库 **Settings → Pages → Source** 选择 `GitHub Actions`。

---

## License

MIT
