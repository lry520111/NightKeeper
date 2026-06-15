# props/

存放单体道具贴图：文物本体、展柜、灯具、机关等。

## 推荐格式

- **格式**：PNG（透明背景）
- **尺寸**：16×16 或 32×32 单图
- **命名**：尽量与 `src/data/relics.js` 中的 `id` 一致

## 计划文件（按已有文物 id）

| 文件名 | 说明 | 状态 |
|--------|------|------|
| `relic_jade_seal.png` | 玉玺 | ⬜ 待放置 |
| `relic_bronze_mirror.png` | 青铜镜 | ⬜ 待放置 |
| `relic_silk_scroll.png` | 丝绢卷轴 | ⬜ 待放置 |
| `display_case.png` | 展柜（被偷时空置） | ⬜ 待放置 |

## 使用方式（代码侧）

```js
this.load.image('relic_jade_seal', 'assets/props/relic_jade_seal.png');
```
