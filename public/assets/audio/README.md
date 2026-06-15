# audio/

存放背景音乐（BGM）与音效（SFX）。

## 推荐格式

- **BGM**：MP3（兼容性最好）/ OGG，码率 128~192kbps
- **SFX**：WAV（短促）/ OGG，单个文件 < 200KB

## 计划文件

### BGM

| 文件名 | 说明 | 状态 |
|--------|------|------|
| `bgm_title.mp3` | 封面 | ⬜ 待放置 |
| `bgm_hub.mp3` | 主城枢纽 | ⬜ 待放置 |
| `bgm_stealth.mp3` | 潜入关卡（平稳） | ⬜ 待放置 |
| `bgm_alert.mp3` | 被发现（紧张） | ⬜ 待放置 |

### SFX

| 文件名 | 说明 | 状态 |
|--------|------|------|
| `sfx_step.wav` | 脚步声 | ⬜ 待放置 |
| `sfx_pickup.wav` | 拾取文物 | ⬜ 待放置 |
| `sfx_attack.wav` | 攻击挥击 | ⬜ 待放置 |
| `sfx_block.wav` | 防御格挡 | ⬜ 待放置 |
| `sfx_alert.wav` | 守卫警觉 | ⬜ 待放置 |
| `sfx_extract.wav` | 撤离成功 | ⬜ 待放置 |

> 当前游戏内的程序化合成音效仍可保留作 fallback，真实素材到位后会优先使用真实素材。

## 使用方式（代码侧）

```js
this.load.audio('bgm_stealth', 'assets/audio/bgm_stealth.mp3');
this.load.audio('sfx_pickup', 'assets/audio/sfx_pickup.wav');
```
