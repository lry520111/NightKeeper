# tiles/

存放地图 Tileset（瓦片集）。

## 推荐格式

- **格式**：PNG（透明背景）
- **瓦片尺寸**：16×16（与角色一致）
- **整张图尺寸**：建议为 16 的整数倍

## 计划文件

| 文件名 | 说明 | 状态 |
|--------|------|------|
| `museum_indoor.png` | 博物馆室内（地板/墙/展柜底座） | ⬜ 待放置 |
| `tomb_indoor.png` | 古墓地图（第二章预留） | ⬜ 待放置 |
| `hub_indoor.png` | 主城枢纽场景 | ⬜ 待放置 |

## 使用方式（代码侧）

```js
this.load.image('tiles_museum', 'assets/tiles/museum_indoor.png');
```
