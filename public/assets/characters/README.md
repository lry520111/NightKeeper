# characters/

存放角色精灵图（spritesheet）。

## 推荐格式

- **格式**：PNG（透明背景）
- **单帧尺寸**：16×16 或 32×32
- **布局**：横向排列动画帧，纵向排列方向（建议顺序：下、左、右、上）

## 计划文件

| 文件名 | 说明 | 状态 |
|--------|------|------|
| `player.png` | 守夜人玩家角色 | ⬜ 待放置 |
| `guard.png` | 巡逻守卫 | ⬜ 待放置 |
| `npc_broker.png` | 主城 NPC：委托发布人 | ⬜ 待放置 |
| `npc_smith.png` | 主城 NPC：装备配载师 | ⬜ 待放置 |

## 使用方式（代码侧）

```js
this.load.spritesheet('player', 'assets/characters/player.png', {
  frameWidth: 16, frameHeight: 16
});
```
