# NightKeeper 场景图片 Prompt 清单

> 本文档列出游戏中所有需要的场景房间贴图的 AI 绘图 Prompt。
> 图片规格：俯视角（Top-down view），像素风格或手绘风格，无透视，适合 2D 游戏贴图使用。
> 输出尺寸建议：2048×2048px 或按比例缩放（宽高比见各房间标注）。

---

## 一、博物馆 (Museum) — 已有贴图 ✅

> 以下 8 张贴图已存在于 `public/assets/rooms/01~08.png`，仅供参考风格一致性。

### 01.png — 中央展柜 (20×20 tiles, 正方形)
```
Top-down view of a Chinese museum central exhibition hall, square room, ornate octagonal jade display case in the center, four smaller glass display cases in corners, red carpet forming a cross-shaped walkway, dark polished wooden floor, warm ambient lighting, traditional Chinese architectural details, gold trim on walls, no perspective, 2D game asset, high detail
```

### 02.png — 长廊展厅 (25×18 tiles, 横向矩形)
```
Top-down view of a long Chinese museum gallery corridor, rectangular horizontal room, glass display cases along both walls, polished dark wood floor with red carpet runner down the center, traditional Chinese wall paintings, warm golden lighting from ceiling lanterns, doorways on left and right sides, no perspective, 2D game asset
```

### 03.png — 罗盘大厅 (20×20 tiles, 正方形)
```
Top-down view of a Chinese museum compass hall, square room, large circular zodiac compass mosaic on the floor center, four stone pillars near corners, dark marble floor with gold inlay patterns, traditional Chinese ceiling beams visible as shadows, four doorways (N/S/E/W), warm dim lighting, no perspective, 2D game asset
```

### 04.png — 茶室接待厅 (25×18 tiles, 横向矩形)
```
Top-down view of a traditional Chinese tea room in a museum, rectangular horizontal room, large tea ceremony table at bottom center, bonsai plants on sides, bamboo mat flooring, calligraphy scrolls on walls, soft warm lighting, elegant and serene atmosphere, doorway on right side, no perspective, 2D game asset
```

### 05.png — 垂直走廊 (18×24 tiles, 纵向矩形)
```
Top-down view of a vertical museum corridor, tall narrow rectangular room, dark wood floor with red carpet runner, small display cases along right wall, traditional Chinese wall sconces providing warm light, doorways at top and bottom, ornate ceiling molding visible as border, no perspective, 2D game asset
```

### 06.png — 储藏间 (20×20 tiles, 正方形)
```
Top-down view of a museum storage room / restoration workshop, square room, wooden crates stacked in L-shape on left side, central restoration workbench with tools, scroll storage shelves on right, dusty concrete floor, single overhead light, cluttered but organized, doorway at top, no perspective, 2D game asset
```

### 07.png — 馆长书房 (20×20 tiles, 正方形)
```
Top-down view of a museum director's private study, square room, large bookshelf along top-left wall, ornate wooden desk on right side, tea table with two stools in center, safe/vault in bottom-left corner, rich dark wood floor, traditional Chinese scholar's room aesthetic, warm desk lamp lighting, doorway on right side, no perspective, 2D game asset
```

### 08.png — 礼器陈列室 (25×18 tiles, 横向矩形)
```
Top-down view of a Chinese ritual artifact exhibition room, rectangular horizontal room, phoenix relief wall carving on left, ceremonial robe display stand at bottom, bronze ritual vessels in glass cases, dark polished floor, dramatic spotlighting on artifacts, doorways at top and left, no perspective, 2D game asset
```

---

## 二、地下黑市 (Black Market) — 需要新贴图 🆕

> 风格：阴暗地下空间，霓虹灯光，水泥/砖墙质感，赛博朋克+中式地下市场混搭。
> 存放路径建议：`public/assets/rooms/bm_01~bm_06.png`

### bm_01 — 暗仓 stash_nw (15×12 tiles, 横向矩形)
```
Top-down view of an underground black market stash room, small rectangular room, stacks of wooden crates and metal containers along walls, concrete floor with cracks and stains, single bare lightbulb hanging from ceiling casting harsh shadows, graffiti on brick walls, dusty and cramped atmosphere, purple neon light leaking from doorway, no perspective, 2D game asset, dark cyberpunk aesthetic
```

### bm_02 — 赝品巷 alley_n (20×12 tiles, 横向矩形)
```
Top-down view of an underground counterfeit goods alley, wide rectangular room, rows of narrow market stalls/tables displaying fake antiques and knockoff artifacts, hanging fabric canopies in red and purple, neon pink signs reading "赝品" (counterfeits), concrete floor with puddles, crowded bazaar atmosphere, flickering fluorescent lights mixed with neon glow, no perspective, 2D game asset, dark cyberpunk Chinese market aesthetic
```

### bm_03 — 赌坊 den_w (15×15 tiles, 正方形)
```
Top-down view of an underground gambling den, square room, round mahjong/poker table in center with green felt, bar counter along bottom wall with bottles, scattered chairs and ashtrays, smoke haze effect, green neon sign "赌坊" above entrance, dark wood and concrete interior, dim overhead lamp over table, seedy underground atmosphere, no perspective, 2D game asset, noir Chinese gambling house aesthetic
```

### bm_04 — 黑市中心 hub_center (20×20 tiles, 正方形)
```
Top-down view of an underground black market central plaza, large square room, ornate dark fountain or statue in center (meeting point landmark), four vendor stalls in corners with colorful goods, purple and blue neon lights on walls, cracked concrete floor with drainage grates, multiple doorways leading to alleys, bustling underground bazaar hub atmosphere, hanging lanterns and neon signs in Chinese characters, no perspective, 2D game asset, cyberpunk meets traditional Chinese underground market
```

### bm_05 — 仓库 storage_e (12×15 tiles, 纵向矩形)
```
Top-down view of an underground storage warehouse, tall narrow rectangular room, industrial metal shelving units in two rows, cardboard boxes and wrapped packages on shelves, concrete floor with yellow safety lines, single fluorescent tube lighting, orange neon "仓库" sign, industrial and utilitarian atmosphere, forklift tracks on floor, no perspective, 2D game asset, dark industrial aesthetic
```

### bm_06 — 金库 vault_s (20×15 tiles, 横向矩形)
```
Top-down view of an underground vault room, rectangular room, massive steel safe/vault door in center-top (the heist target), reinforced concrete walls with metal plating, security deposit boxes along walls, heavy crates with padlocks, polished dark floor with laser grid pattern (decorative), red emergency lighting, high-security atmosphere, thick vault door with combination lock visible, no perspective, 2D game asset, heist movie vault aesthetic
```

---

## 三、走私船「沉鲸号」(Smuggler Ship) — 需要新贴图 🆕

> 风格：老旧货船内部，锈迹斑斑的金属墙壁，木质甲板，昏暗船舱灯光，海洋氛围。
> 存放路径建议：`public/assets/rooms/ship_01~ship_08.png`

### ship_01 — 船首货舱 bow_hold (18×12 tiles, 横向矩形)
```
Top-down view of a smuggler ship bow cargo hold, rectangular room, large shipping containers and wooden crates stacked in groups, rusty metal floor with rivets and drainage channels, dim yellow industrial lights, thick hull walls with portholes showing dark ocean outside, anchor chain coiled in corner, maritime cargo atmosphere, water stains on floor, no perspective, 2D game asset, old cargo ship interior aesthetic
```

### ship_02 — 左舷船员舱 crew_l (10×10 tiles, 正方形)
```
Top-down view of a ship crew quarters (port side), small square room, three bunk beds stacked along left wall, personal lockers, small desk with navigation charts, worn wooden floor with metal trim, single porthole on wall showing ocean, cramped and lived-in atmosphere, warm yellow lamp light, sailor's personal items scattered about, no perspective, 2D game asset, old merchant ship cabin aesthetic
```

### ship_03 — 中层甲板 mid_deck (18×14 tiles, 横向矩形)
```
Top-down view of a smuggler ship mid-deck operations room, rectangular room, large navigation table in center with maps and compass, four structural support pillars, worn wooden plank floor, multiple doorways (N/S/E/W), ship's wheel mounted on wall, hanging oil lanterns, brass instruments and rope coils, maritime command center atmosphere, no perspective, 2D game asset, old sailing vessel deck aesthetic
```

### ship_04 — 右舷储物间 crew_r (10×10 tiles, 正方形)
```
Top-down view of a ship storage/supply room (starboard side), small square room, tall metal lockers along right wall containing supplies, coiled ropes and life preservers, first aid kit on wall, worn wooden floor, single porthole, organized but cramped nautical storage, dim overhead light, no perspective, 2D game asset, cargo ship utility room aesthetic
```

### ship_05 — 机舱 engine (10×12 tiles, 纵向矩形)
```
Top-down view of a ship engine room, tall narrow rectangular room, large diesel engine machinery in center-top (dark metal with pipes), exposed pipes and valves along walls, metal grating floor with water puddles below, steam vents, oil stains, red emergency lighting mixed with yellow work lights, loud and industrial atmosphere, bilge water visible through grating, no perspective, 2D game asset, old cargo ship engine room aesthetic
```

### ship_06 — 下层货舱 cargo_hold (18×16 tiles, 接近正方形)
```
Top-down view of a smuggler ship lower cargo hold, large nearly-square room, stacked wooden crates and barrels in four corner groups, center aisle with large mysterious covered cargo, rusty metal floor with bolt patterns, dim swinging overhead lights, bilge water pooling at bottom, rope nets and cargo hooks hanging, smuggled goods partially visible (jade, scrolls, bronze), dark and secretive atmosphere, no perspective, 2D game asset, smuggler ship cargo aesthetic
```

### ship_07 — 武器库 armory (10×12 tiles, 纵向矩形)
```
Top-down view of a ship armory/weapons storage, tall narrow rectangular room, horizontal weapon racks on walls (swords, rifles, harpoons), ammunition boxes stacked neatly, metal mesh floor, locked cage-style walls, single bright overhead light, military-organized but pirate-themed weapons, danger signs in Chinese, no perspective, 2D game asset, pirate ship armory aesthetic
```

### ship_08 — 船尾甲板 stern_deck (18×10 tiles, 横向矩形)
```
Top-down view of a ship stern deck (entry point), wide rectangular room, wooden railing along top edge, large anchor winch mechanism in center, coiled mooring ropes, wooden plank floor weathered by salt water, night sky/ocean visible beyond railing, gangway/boarding plank at bottom, lanterns on posts, open-air deck atmosphere with sea spray, no perspective, 2D game asset, old cargo ship stern deck at night
```

---

## 四、通用纹理贴图 — 可选补充 🔧

> 以下为 32×32px 的 tileable 纹理，用于程序化渲染走廊和填充区域。

### tex_floor_bm — 黑市地板纹理 (32×32px, tileable)
```
Seamless tileable texture, cracked concrete floor with dark stains, subtle purple tint, underground bunker floor, 32x32 pixels, pixel art style, top-down view, no perspective
```

### tex_wall_bm — 黑市墙壁纹理 (32×32px, tileable)
```
Seamless tileable texture, dark brick wall with graffiti scratches, exposed pipes, purple-tinted mortar, underground tunnel wall, 32x32 pixels, pixel art style, top-down view
```

### tex_floor_ship — 船舱地板纹理 (32×32px, tileable)
```
Seamless tileable texture, worn wooden ship deck planks with metal bolt strips, salt-stained and weathered, warm brown tones, 32x32 pixels, pixel art style, top-down view
```

### tex_wall_ship — 船舱墙壁纹理 (32×32px, tileable)
```
Seamless tileable texture, rusty metal ship hull wall with rivets in grid pattern, dark iron with orange rust patches, industrial maritime wall, 32x32 pixels, pixel art style, top-down view
```

---

## 使用说明

1. **生成工具推荐**：Midjourney / DALL-E 3 / Stable Diffusion (建议使用 `--style raw` 或类似设置减少艺术化)
2. **后处理**：生成后需要在 Photoshop/GIMP 中：
   - 裁剪为精确比例（参考各房间的 tiles 宽高比）
   - 确保四边墙壁区域颜色较深（方便碰撞区域视觉对齐）
   - 门洞位置留出明显的通道空间
3. **命名规范**：
   - 博物馆：`01.png` ~ `08.png`（已有）
   - 黑市：`bm_01.png` ~ `bm_06.png`
   - 走私船：`ship_01.png` ~ `ship_08.png`
   - 纹理：`tex_floor_bm.png`, `tex_wall_bm.png`, `tex_floor_ship.png`, `tex_wall_ship.png`
4. **集成方式**：生成贴图后，在 `BootScene.js` 中添加加载代码，并将 `composeBlackmarketMap.js` / `composeShipMap.js` 中的 `procedural: true` 改为对应贴图 id 即可切换为贴图模式。
