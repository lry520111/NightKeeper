
# 🎨 NightKeeper 任务房间贴图生成 Prompt 清单

> 本文档收录所有需要 AI 生成的「单房间俯视贴图」的提示词。  
> 所有 prompt 共享同一套**全局风格约束**与**几何约束**，只在「房间内容描述」处不同，确保拼接出的关卡风格统一。  
>
> **导出规格**：建议 `1024×1024`（正方形）或 `1024×768`（横向）/ `768×1024`（纵向）。导入引擎后会等比缩放到 `320×320` / `320×288` / `288×320` 像素。
>
> **命名约定**：导出后请按下表命名并放入 `public/assets/rooms/` 目录。

---

## 📋 房间清单总览

| # | 文件名 | 房间类型 | 尺寸方向 | 门洞配置 | 优先级 |
|---|---|---|---|---|---|
| 1 | `room_gallery_a.png` | 中央展柜厅 | 正方形 | N+S+E+W（4门） | ✅ 已完成 |
| 2 | `room_gallery_b.png` | 长廊壁画厅 | 横向 | E+W（2门） | 🔥 P0 |
| 3 | `room_gallery_c.png` | 圆形大厅 | 正方形 | N+S+E+W（4门） | 🔥 P0 |
| 4 | `room_corridor_h.png` | 横向走廊 | 横向 | E+W（2门） | 🔥 P0 |
| 5 | `room_corridor_v.png` | 竖向走廊 | 纵向 | N+S（2门） | 🔥 P0 |
| 6 | `room_storage.png` | 储藏间 | 正方形 | N+E（2门 L 形） | 🟡 P1 |
| 7 | `room_office.png` | 馆长办公室 | 正方形 | N+S+W（3门 T 形） | 🟡 P1 |
| 8 | `room_entrance.png` | 入口玄关 | 横向 | N+E（玩家出生点） | 🟢 P2 |

---

## 🌐 全局风格约束（每张图都必须包含）

> 把下方 `[GLOBAL STYLE BLOCK]` 整段贴到每个 prompt 的开头部分。

```
[GLOBAL STYLE BLOCK]
top-down strict orthographic view, 90-degree bird's-eye angle, NO perspective distortion, NO isometric tilt,
pixel art style, 16-bit retro game aesthetic, crisp pixel edges, limited color palette,
dark moody lighting, deep navy and indigo shadows, warm amber lantern glow as accent light,
Chinese imperial museum at night theme, traditional oriental decor, ancient artifacts on display,
subtle red carpet patterns with golden trim, dark mahogany wooden floor with faint gloss,
authentic stone or marble wall texture in deep slate gray with carved relief patterns,
volumetric dust particles drifting in lantern beams, very slight cinematic vignette at corners,
consistent with previous reference image (room_gallery_a.png) - SAME wall material, SAME floor tone,
SAME lantern color temperature, SAME carpet style, SAME palette, seamless tile-able edges
```

---

## 📐 全局几何约束（每张图都必须包含）

> 把下方 `[GLOBAL GEOMETRY BLOCK]` 整段贴到 prompt 的几何描述部分，根据房间方向修改 `[ROOM SHAPE]` 和 `[DOOR LIST]`。

```
[GLOBAL GEOMETRY BLOCK]
PERFECTLY [ROOM SHAPE] room outline, four straight walls forming sharp 90-degree corners,
NO octagonal cut corners, NO curved walls, NO chamfered edges, NO rounded corners,
walls are uniformly thick (about 1/12 of the room's shorter side), solid stone construction,
the room interior is a clean rectangle floor with all furniture placed strictly inside,
camera centered exactly on room midpoint, the entire room fills 95% of the canvas,
small uniform black/empty margin (less than 2% of canvas) outside the walls so the image is tile-able,
[DOOR LIST]
each doorway is exactly 2 tiles wide (about 1/8 of the wall length), centered precisely on its wall,
doorways are simple dark rectangular openings with NO doors drawn, NO arches, NO frames protruding,
the floor texture continues smoothly through each doorway opening,
walls on either side of each doorway are perfectly symmetrical
```

**`[ROOM SHAPE]` 取值**：
- 正方形房间 → `SQUARE`
- 横向矩形（宽>高）→ `RECTANGULAR (wider than tall, aspect ratio 10:9)`
- 纵向矩形（高>宽）→ `RECTANGULAR (taller than wide, aspect ratio 9:10)`

**`[DOOR LIST]` 模板**（按需要的门洞组合）：
- 4 门：`exactly 4 doorways, one centered on EACH wall (top, bottom, left, right)`
- 左右 2 门：`ONLY 2 doorways, located ONLY on the LEFT and RIGHT walls, the TOP and BOTTOM walls must be SOLID with NO openings, completely closed`
- 上下 2 门：`ONLY 2 doorways, located ONLY on the TOP and BOTTOM walls, the LEFT and RIGHT walls must be SOLID with NO openings, completely closed`
- L 形 2 门（北+东）：`ONLY 2 doorways: one centered on the TOP wall, one centered on the RIGHT wall, the LEFT and BOTTOM walls must be SOLID with NO openings`
- T 形 3 门（北+南+西）：`ONLY 3 doorways: one centered on the TOP wall, one on the BOTTOM wall, one on the LEFT wall, the RIGHT wall must be SOLID with NO opening`

---

## 1️⃣ `room_gallery_a.png` — 中央展柜厅 ✅ 已完成

> 作为风格基准，其他图都要参照这张。已生成成功，无需重画。

---

## 2️⃣ `room_gallery_b.png` — 长廊壁画厅 🔥

**画布尺寸**：`1024×768`（横向）  
**门洞**：左右各一个（用于水平拼接长走廊段落）

```
[GLOBAL STYLE BLOCK above]

[GLOBAL GEOMETRY BLOCK with]
ROOM SHAPE: RECTANGULAR (wider than tall, aspect ratio 10:9)
DOOR LIST: ONLY 2 doorways, located ONLY on the LEFT and RIGHT walls,
the TOP and BOTTOM walls must be SOLID with NO openings, completely closed

ROOM CONTENT:
a long Chinese imperial mural gallery, viewed from directly above,
two long parallel walls (top and bottom) covered with FOUR large framed silk paintings,
two paintings on the top wall, two on the bottom wall, evenly spaced,
each painting depicts misty mountain landscapes or ancient court scenes in faded ink colors,
golden ornate frames with dragon motifs, paintings sit flush against the wall (no 3D protrusion),
along the floor center runs a long red carpet with golden border, stretching from left door to right door,
on the carpet at 1/4 and 3/4 positions stand two square wooden display pedestals,
each pedestal holds a small artifact under a glass dome (a jade seal, a ceramic vase),
two pairs of bronze incense burners stand symmetrically near the side walls,
two hanging silk lanterns glow warm amber from the top wall, their light pools on the floor,
the room reads as a quiet long hallway perfect for stealth movement
```

---

## 3️⃣ `room_gallery_c.png` — 圆形大厅 🔥

**画布尺寸**：`1024×1024`（正方形）  
**门洞**：四方四门（核心战场）

```
[GLOBAL STYLE BLOCK above]

[GLOBAL GEOMETRY BLOCK with]
ROOM SHAPE: SQUARE
DOOR LIST: exactly 4 doorways, one centered on EACH wall (top, bottom, left, right)

ROOM CONTENT:
a grand circular rotunda hall inside a square room (the OUTER walls are square, but the INTERIOR design suggests a circular floor pattern),
in the dead center of the room, a large circular medallion is inlaid into the floor:
a golden compass-rose pattern surrounded by twelve zodiac animal symbols in bronze relief,
around this central medallion, FOUR tall ornamental columns rise (one in each diagonal corner area),
each column is dark red lacquered wood with golden cloud-pattern carvings, square base, capped with a stone plate,
between adjacent columns, large ceramic floor vases (about half-column height) stand as decoration,
two small benches (low wooden) sit against the LEFT and RIGHT walls (NOT blocking doors),
ceiling lanterns are implied by FOUR pools of warm amber light spilling onto the floor near each column,
the four red carpets run from each doorway toward the center medallion, forming a plus/cross shape,
no central display case (the floor medallion IS the centerpiece), keeping the middle walkable for combat,
overall feels like a sacred imperial chamber, dramatic and open
```

---

## 4️⃣ `room_corridor_h.png` — 横向走廊 🔥

**画布尺寸**：`1024×768`（横向）  
**门洞**：左右

```
[GLOBAL STYLE BLOCK above]

[GLOBAL GEOMETRY BLOCK with]
ROOM SHAPE: RECTANGULAR (wider than tall, aspect ratio 10:9)
DOOR LIST: ONLY 2 doorways, located ONLY on the LEFT and RIGHT walls,
the TOP and BOTTOM walls must be SOLID with NO openings, completely closed

ROOM CONTENT:
a narrow connecting museum corridor, viewed strictly top-down,
plain dark slate stone walls along top and bottom, no large decorations on walls,
along the top wall: three wall-mounted bronze sconces with small flame glow, evenly spaced,
along the bottom wall: a long low wooden bench against the wall, single piece, no breaks,
on the bench, two folded brocade cushions and a teacup tray sit as small details,
the floor is plain dark mahogany planks running horizontally, NO carpet (this is a service hallway),
two small potted bonsai trees stand at the 1/3 and 2/3 length marks against the bottom wall edge,
mid-corridor a single thin floor crack runs across (texture variation only, NOT a hole),
overall vibe: dim, narrow, stealth-friendly, intentionally less decorated than gallery rooms,
this room must look like a "transit space" not a destination
```

---

## 5️⃣ `room_corridor_v.png` — 竖向走廊 🔥

**画布尺寸**：`768×1024`（纵向）  
**门洞**：上下

```
[GLOBAL STYLE BLOCK above]

[GLOBAL GEOMETRY BLOCK with]
ROOM SHAPE: RECTANGULAR (taller than wide, aspect ratio 9:10)
DOOR LIST: ONLY 2 doorways, located ONLY on the TOP and BOTTOM walls,
the LEFT and RIGHT walls must be SOLID with NO openings, completely closed

ROOM CONTENT:
a narrow vertical museum corridor, viewed strictly top-down,
plain dark slate stone walls along left and right, sparse decoration,
along the left wall: three wall-mounted bronze sconces with small flame glow, evenly spaced from top to bottom,
along the right wall: a tall narrow display cabinet at upper third (containing a single porcelain bowl),
and a small wooden side table at lower third (with an open scroll and brush set),
the floor is dark mahogany planks running vertically (oriented along the long axis),
NO main carpet, but two small square rugs (about 1.5 tiles) at the door entrances,
a single hanging silk lantern at mid-height on the left wall casts amber pool of light,
overall vibe: tight, slightly claustrophobic, perfect for one-on-one stealth encounters,
clearly a "transit corridor" not a feature room
```

---

## 6️⃣ `room_storage.png` — 储藏间 🟡

**画布尺寸**：`1024×1024`（正方形）  
**门洞**：北 + 东（L 形过渡房间）

```
[GLOBAL STYLE BLOCK above]

[GLOBAL GEOMETRY BLOCK with]
ROOM SHAPE: SQUARE
DOOR LIST: ONLY 2 doorways: one centered on the TOP wall, one centered on the RIGHT wall,
the LEFT and BOTTOM walls must be SOLID with NO openings

ROOM CONTENT:
a back-of-house museum storage room, viewed strictly top-down,
unfinished concrete or plain stone walls (slightly rougher than gallery rooms but SAME palette and SAME thickness),
NO red carpet, just bare gray-brown stone floor,
in the LEFT half of the room: stacks of wooden crates of various sizes, some with stenciled Chinese characters,
crates form a loose L-shape pile leaving a walkable path,
two crates near the bottom-left corner are slightly broken with straw spilling out (lootable feel),
in the BOTTOM-RIGHT area: a tall metal shelving unit against the bottom wall,
filled with rolled scrolls, ceramic shards in trays, a few cataloged jars,
in the CENTER: a single wooden workbench with a half-restored vase on it, brushes and tools scattered,
ONE bare hanging bulb at center casts cold pale-yellow light (slightly different from gallery lanterns to read as "utility area"),
NO ornate decorations, NO paintings, the room must clearly read as "behind the scenes",
overall vibe: dusty, cluttered but navigable, lots of low cover for stealth
```

---

## 7️⃣ `room_office.png` — 馆长办公室 🟡

**画布尺寸**：`1024×1024`（正方形）  
**门洞**：北 + 南 + 西（T 形）

```
[GLOBAL STYLE BLOCK above]

[GLOBAL GEOMETRY BLOCK with]
ROOM SHAPE: SQUARE
DOOR LIST: ONLY 3 doorways: one centered on the TOP wall, one on the BOTTOM wall,
one on the LEFT wall, the RIGHT wall must be SOLID with NO opening

ROOM CONTENT:
the curator's private study, viewed strictly top-down,
walls covered in DARK WOODEN PANELING (not stone) in deep mahogany, distinctly warmer/richer than gallery rooms,
floor is a thick deep-red oriental rug covering most of the room with intricate cloud-and-dragon pattern in gold,
the floor rug has a small bare wood border around it (about 1 tile from each wall),
against the RIGHT (solid) wall: a large carved wooden desk centered, dark mahogany,
on the desk: an open ledger book, a brass desk lamp casting warm focused light, a teacup, scattered scrolls,
behind the desk (between desk and right wall): a high-backed wooden chair,
against the TOP-LEFT corner area: a tall floor-to-ceiling bookshelf filled with bound books and rolled scrolls,
against the BOTTOM-LEFT corner area: a black iron safe (small, square, clearly a lootable feature) sitting on the floor,
in the CENTER of the room: a low square tea table with two cushioned stools,
on the tea table: a tea set with a small porcelain pot and two cups,
two hanging paintings on the right wall (above and beside the desk): one tiger ink painting, one calligraphy scroll,
overall vibe: scholarly, quiet, valuable - this room must FEEL like the highest-tier loot location
```

---

## 8️⃣ `room_entrance.png` — 入口玄关 🟢

**画布尺寸**：`1024×768`（横向）  
**门洞**：北 + 东（玩家从图外进入，向房间内推进）

```
[GLOBAL STYLE BLOCK above]

[GLOBAL GEOMETRY BLOCK with]
ROOM SHAPE: RECTANGULAR (wider than tall, aspect ratio 10:9)
DOOR LIST: ONLY 2 doorways: one centered on the TOP wall, one centered on the RIGHT wall,
the LEFT and BOTTOM walls must be SOLID with NO openings

ROOM CONTENT:
a museum side-entrance foyer, viewed strictly top-down,
SAME stone walls and SAME palette as gallery rooms,
the LEFT wall (solid) has the most decoration: a large carved stone screen wall with a relief of a phoenix,
two tall potted bamboo plants flanking the phoenix screen,
the floor: a small red carpet runs from the TOP doorway down toward the center, then turns RIGHT toward the right doorway,
forming an L-shaped red carpet path (this visually guides the player's first move),
in the BOTTOM-LEFT corner area: a small wooden reception desk with a guestbook, a brass bell, and a single oil lamp,
behind the desk (against bottom wall): a small bulletin board with three pinned papers (museum notices),
against the BOTTOM wall to the right of the desk: a wooden coat rack with two hanging guard uniforms,
two hanging silk lanterns at the top corners cast warm amber pools,
NO display cases, NO valuable artifacts (this is the safe starting room),
overall vibe: welcoming but still imperial, clearly the "start here" room
```

---

## ✨ 使用建议与排查清单

生成每张图后，请按以下清单逐项检查，**任何一项不符合就重抽**，以保证拼接效果一致：

| 检查项 | 不通过怎么办 |
|---|---|
| 房间是否为**纯矩形**（无八角斜切、无圆角）| 在 prompt 中加重 `STRICTLY rectangular`、`NO chamfer` |
| 门洞数量与位置**完全正确** | 把 `[DOOR LIST]` 整段挪到 prompt 最前面 |
| 门洞**严格居中**且**约 2 格宽** | 加 `doorway is centered with mathematical precision` |
| 视角是否**严格正俯视**（无任何透视）| 加 `STRICT 90-degree top-down, NOT isometric, NOT 3/4 view` |
| 边缘是否**整齐可拼接**（无大黑边、无渐变模糊）| 加 `clean hard edge at canvas border, tile-able` |
| 风格是否**与 gallery_a 一致**（颜色、地板、墙体）| 加 `match the reference image style exactly` |
| 是否有**多余文字、图章、签名** | 加 `NO text, NO watermark, NO signature, NO logos` |

### 通用负面提示（Negative Prompt，建议每张图都加）

```
isometric view, 3/4 perspective, tilted camera, fish-eye lens, depth of field blur,
octagonal room, rounded corners, curved walls, chamfered corners, irregular shape,
extra doors, doors with frames, doors with hinges, closed doors, arched doorways,
people, characters, NPCs, players, guards, animals, hands, faces,
text, watermark, signature, logo, UI elements, HUD, frames, borders,
modern furniture, plastic, neon, sci-fi elements, electronics, computers,
blurry, low resolution, jpeg artifacts, color banding, oversaturated, washed out,
black margins larger than 5%, gradient fading at edges, vignette too strong
```

---

## 🚀 推荐生成顺序

1. **先做 corridor_h 和 corridor_v**（走廊最容易出错，先确认门洞规则）
2. **再做 gallery_b 和 gallery_c**（核心战场房）
3. **最后做 storage / office / entrance**（特色房，可以多抽几次挑最佳）

每张图生成成功后，请按表格中文件名命名，**统一放进** `public/assets/rooms/` 目录。我会同步把房间数据写进 `src/data/roomTemplates.js`，图片到位后立即可用。
