
# 素材资源目录

> 本目录下的所有文件都会被 Vite 原样拷贝到 `dist/`，可以通过相对路径直接引用，例如 `assets/characters/player.png`。

## 子目录约定

| 目录 | 用途 | 推荐来源 |
|------|------|----------|
| `characters/` | 玩家、守卫、NPC 的精灵图（spritesheet） | LimeZu Modern Interiors 角色 PNG |
| `tiles/` | 地板、墙壁、家具的 Tileset 拼图 | LimeZu Modern Interiors 室内 Tileset |
| `props/` | 文物、展柜、机关等单体道具 | itch.io 中国风 / Kenney 道具 |
| `icons/` | 装备、工具、按钮等 UI 图标（一般 16/32px） | Kenney UI / Tiny Dungeon |
| `audio/` | 背景音乐与音效 | Pixabay / Kenney UI Audio |
| `fonts/` | 自定义像素字体（可选） | Google Fonts / itch.io |

## 命名建议（便于代码统一加载）

- 玩家：`characters/player.png`（4 行 × N 帧，分别对应 下/左/右/上）
- 守卫：`characters/guard.png`
- 室内 Tileset：`tiles/museum_indoor.png`
- BGM：`audio/bgm_hub.mp3`、`audio/bgm_stealth.mp3`
- SFX：`audio/sfx_step.wav`、`audio/sfx_pickup.wav` 等

## 版权 & License

下载素材时请保留原作者 license 文件，并把简短署名加到根目录的 `CREDITS.md`（可后续补）。
本项目遵循的素材 License 优先级：CC0 > CC-BY > 免费商用许可。
