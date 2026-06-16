### 角色精灵表生成 Prompt（直接可用版）

> **目的**：生成与《NightKeeper》（午夜博物馆潜入题材）画风一致、可在游戏中切换 4 方向朝向的角色贴图，**输出文件可直接覆盖** `public/assets/characters/Characters_free/` 下的对应文件，无需改代码。

---

## 一、技术规格（**必须严格遵守**，否则游戏无法读图）

| 项目 | 数值 |
|---|---|
| 单帧尺寸 | **16 × 32 像素**（宽 16，高 32） |
| 横向帧数 | 6 帧/行 |
| 纵向行数 | 4 行 |
| 整张图尺寸 | **96 × 128 像素** |
| 行顺序（从上到下） | **第1行=面向右、第2行=面向上、第3行=面向左、第4行=面向下** |
| 背景 | **完全透明**（PNG with alpha） |
| 像素风格 | **Pixel Art（NEAREST 缩放）**，无抗锯齿、无渐变、无半透明像素 |
| 调色板上限 | ≤ 24 色，纯色块为主 |
| 角色锚点 | **脚底中心** 落在每帧底部正中（x=8, y=31 附近），便于碰撞箱对齐 |
| 角色高度 | 头顶到脚底约 **28~30 像素**（顶部留 1~2px 空白） |

> ⚠️ **重要**：所有 6 帧的脚底必须落在同一水平线上（y ≈ 31），头部高度也尽量一致；否则跑动时会出现"上下抖动"。

---

## 二、视觉风格（与游戏画风对齐）

### 总基调
- 题材：**民国/中式午夜潜入**（参考《刺客信条》水墨风 + 像素风重制）
- 美术参考：**LimeZu Modern Interiors v2.2** 的笔触和体型比例（已有 Adam/Amelia/Alex/Bob 同套）
- 色调：暗色为主（**深靛蓝 / 暗红 / 暗金 / 灰黑**），高光仅在面部、武器边缘点一笔
- 描边：**深色 1px 描边**（不是黑色，而是比主色暗 60%）
- 视角：**轻微 3/4 俯视**（看得到肩、看不到脚踝），与现有 LimeZu 角色一致

### 动画语义
- **第1~4 帧**：行走循环（左脚出 → 双腿合 → 右脚出 → 双腿合）
- **第5~6 帧**：可重复前两帧或做轻微呼吸/披风飘动
- **手臂自然摆动**，幅度不要太大，避免帧间跳变

---

## 三、四个角色的具体 Prompt

> 以下 prompt 为**英文 + 中文双语**，建议送给 Stable Diffusion / Midjourney / 通义万相 / 即梦 时使用英文版获得更稳定的像素风结果。每个角色生成 **idle（站立微动）** 和 **run（行走/疾跑）** 两张精灵表。

---

### 1. 主角（Player）— 黑衣夜行盗

**文件名**：
- `Adam_idle_anim_16x16.png` （站立微动 / 偷窥呼吸）
- `Adam_run_16x16.png` （疾步潜行 / 奔跑）

**英文 Prompt（推荐）**：
```
pixel art character sprite sheet, 16x32 pixels per frame, 6 frames wide and 4 rows tall, total canvas 96x128 pixels, transparent background, NEAREST-neighbor pixel art (no anti-aliasing).

Row 1 (top): facing RIGHT, 6 frames of walk cycle
Row 2: facing UP (back view), 6 frames of walk cycle
Row 3: facing LEFT, 6 frames of walk cycle
Row 4 (bottom): facing DOWN (front view), 6 frames of walk cycle

Character: a slender male thief in 1920s Republic-of-China dark navy nightwear, black cloth mask covering the lower face, short black hair, dark grey scarf, fingerless gloves, a small pouch at the belt, soft cloth boots. Body proportions are LimeZu Modern Interiors style: 2-head-tall chibi adult, slightly 3/4 top-down view.

Color palette: deep midnight blue (#1c2030), charcoal grey (#2a2a32), dim gold trim (#8a6a2e), warm skin tone (#e2b393). 1-pixel dark outline (not pure black, use #0e1018).

All 6 frames must keep the feet aligned to the bottom row (y≈31) so the walk cycle does not bob vertically. Head height is consistent across frames.

Lighting: low-key, ambient museum-night lighting, faint cool rim light from upper-left.
```

**中文 Prompt（备选）**：
```
像素艺术角色精灵表，每帧 16×32 像素，6 帧×4 行，总尺寸 96×128，透明背景，NEAREST 缩放、无抗锯齿。
四行依次为：面向右、面向上（背面）、面向左、面向下（正面），每行 6 帧行走循环。
角色：一名身形精瘦的民国年代夜行盗，深靛蓝劲装、黑布蒙面（仅露眼）、短黑发、暗灰围巾、无指手套、腰间小袋、布靴。比例参考 LimeZu Modern Interiors（成人 Q 版，约 2 头身），轻微 3/4 俯视。
配色：午夜深蓝(#1c2030)、炭灰(#2a2a32)、暗金描线(#8a6a2e)、暖肤色(#e2b393)。1px 深色描边（用 #0e1018，不要纯黑）。
所有 6 帧脚底必须对齐底边（y≈31），避免行走时上下跳动；头部高度也一致。
氛围：博物馆夜间低照度，左上角微冷蓝补光。
```

> **idle 与 run 的差异**：idle 帧步幅极小（呼吸/微晃），run 帧步幅大、披风/围巾向后飘。

---

### 2. 守卫（Guard - Museum）— 博物馆制服管理员

**文件名**：`Amelia_idle_anim_16x16.png`

**英文 Prompt**：
```
pixel art character sprite sheet, 16x32 per frame, 6 wide x 4 rows, 96x128 transparent PNG, NEAREST.

Row 1: facing RIGHT walk, Row 2: UP, Row 3: LEFT, Row 4: DOWN. 6 frames each row.

Character: a stern female museum night guard, 1920s Republic of China style. Dark green double-breasted uniform with brass buttons, peaked cap with a small red star, black trousers, short leather boots, a long flashlight in her right hand emitting a faint warm glow on the front-facing frames only. Black hair tied in a bun.

Palette: forest green (#2a4a36), olive highlight (#557057), brass (#b88a3d), red star (#a82a2a), warm skin (#dca58a). Outline #0e1410.

LimeZu proportions, 2-head-tall, slight 3/4 top-down. All frames foot-aligned at y≈31.
```

---

### 3. 黑市打手（Guard - Thug）

**文件名**：`Bob_idle_anim_16x16.png`

**英文 Prompt**：
```
pixel art sprite sheet 16x32 per frame, 6x4 = 96x128, transparent, NEAREST.

Rows = right/up/left/down walks, 6 frames each.

Character: a thuggish bouncer for an underground black market. Bald, scar across left cheek, broad shoulders, dark brown leather vest open over a dirty white undershirt, brown trousers, heavy boots, a wooden club hanging at the right hip. Slightly hunched aggressive walk.

Palette: dark brown leather (#3a2418), dirty cream shirt (#c8b48a), wood club (#6a4422), skin (#caa080). Outline #1a0e08.

LimeZu proportions; bigger torso silhouette than the slim hero (still 16-wide but visually heavier). Foot-aligned y≈31.
```

---

### 4. 走私船船员（Guard - Sailor）

**文件名**：`Alex_idle_anim_16x16.png`

**英文 Prompt**：
```
pixel art sprite sheet 16x32 per frame, 6x4 = 96x128, transparent, NEAREST.

Rows: right/up/left/down walks, 6 frames each.

Character: a tough sailor working for a smuggling junk. Striped dark blue and white sailor shirt, navy blue trousers, red bandana around the head, weathered tan skin, a coil of rope at the left hip, a curved short cutlass at the right hip. Slight rolling sailor walk.

Palette: navy stripe (#1d2d52), off-white (#d4d2c2), red bandana (#a83030), tan skin (#c89060), rope (#a07c4a). Outline #0a1428.

LimeZu proportions, 2-head-tall, 3/4 top-down. Foot-aligned y≈31.
```

---

## 四、生成后处理 Checklist

出图后请人工检查以下几点（**不通过则重生成**）：

1. ☐ 整张图尺寸**正好** 96×128（不能是 96×96 或 128×128）
2. ☐ 共 24 帧，可见到 4 行 × 6 列的等距网格
3. ☐ 背景**完全透明**（不是白底也不是黑底）
4. ☐ 第 1 行确实是**侧脸朝右**、第 4 行是**正脸朝镜头**
5. ☐ 所有帧脚底落在同一水平线（用切片预览拖一下，不上下跳）
6. ☐ 没有抗锯齿羽化边缘（边缘必须是硬像素）
7. ☐ 同方向 6 帧之间，头部 / 躯干位置基本不变，只有手脚摆动

---

## 五、放置路径与文件覆盖

生成完成后，**直接覆盖**以下文件即可，游戏代码无需任何修改：

```
public/assets/characters/Characters_free/
├── Adam_idle_anim_16x16.png   ← 主角站立
├── Adam_run_16x16.png         ← 主角奔跑
├── Amelia_idle_anim_16x16.png ← 博物馆守卫
├── Bob_idle_anim_16x16.png    ← 黑市打手
└── Alex_idle_anim_16x16.png   ← 走私船船员
```

> 提示：覆盖前**先备份原文件**（万一新图不满意可以回滚）。强制刷新浏览器（Ctrl+F5）即可看到新角色。

---

## 六、推荐的生成工具

| 工具 | 推荐度 | 备注 |
|---|---|---|
| **PixelLab.ai** | ⭐⭐⭐⭐⭐ | 专为像素精灵表设计，可直接指定 16×32 网格、4 方向 |
| **Aseprite + AI 插件** | ⭐⭐⭐⭐⭐ | 出图后能立即手动微调 |
| **Stable Diffusion + Pixel Art LoRA** | ⭐⭐⭐⭐ | 加 `--seed 固定 + ControlNet 网格` 可保持一致性 |
| **Midjourney v6** | ⭐⭐⭐ | 描述容易出，但精灵表网格对齐较难 |
| **通义万相 / 即梦** | ⭐⭐⭐ | 中文 prompt 友好，但分辨率精度需手动校正 |

---

## 七、生成顺序建议

1. 先出 **主角 idle**（4 个角色里最关键）
2. 验收画风后，按相同 seed/参数顺序出 **主角 run、Amelia、Bob、Alex**
3. **保持同一画师风格 / 同一 seed**，避免角色之间画风跳变
