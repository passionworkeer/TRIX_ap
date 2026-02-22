# 豆包语音合成调用指南

## 快速使用

### 配置信息

```
appid: 1682246520
token: REDACTED_DOUBAO_TTS_TOKEN
cluster: volcano_tts
```

### API 端点

```
POST https://openspeech.bytedance.com/api/v1/tts
```

---

## Node.js 调用

```javascript
import crypto from 'crypto';
import fs from 'fs';

const response = await fetch('https://openspeech.bytedance.com/api/v1/tts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer;REDACTED_DOUBAO_TTS_TOKEN',
  },
  body: JSON.stringify({
    app: {
      appid: '1682246520',
      token: 'REDACTED_DOUBAO_TTS_TOKEN',
      cluster: 'volcano_tts',
    },
    user: { uid: 'user_001' },
    audio: {
      voice_type: 'BV002_streaming',
      encoding: 'mp3',
      rate: 24000,
    },
    request: {
      reqid: crypto.randomUUID(),
      text: '你好，这是测试文本',
      text_type: 'plain',
      operation: 'query',
    },
  }),
});

const result = await response.json();

// 保存音频
if (result.code === 3000) {
  fs.writeFileSync('output.mp3', Buffer.from(result.data, 'base64'));
  console.log('成功！');
}
```

---

## Python 调用

```python
import requests
import uuid
import base64

response = requests.post(
    'https://openspeech.bytedance.com/api/v1/tts',
    headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer;REDACTED_DOUBAO_TTS_TOKEN',
    },
    json={
        'app': {
            'appid': '1682246520',
            'token': 'REDACTED_DOUBAO_TTS_TOKEN',
            'cluster': 'volcano_tts',
        },
        'user': {'uid': 'user_001'},
        'audio': {
            'voice_type': 'BV002_streaming',
            'encoding': 'mp3',
            'rate': 24000,
        },
        'request': {
            'reqid': str(uuid.uuid4()),
            'text': '你好，这是测试文本',
            'text_type': 'plain',
            'operation': 'query',
        },
    }
)

result = response.json()

if result['code'] == 3000:
    with open('output.mp3', 'wb') as f:
        f.write(base64.b64decode(result['data']))
    print('成功！')
```

---

## curl 调用

```bash
curl -X POST "https://openspeech.bytedance.com/api/v1/tts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer;REDACTED_DOUBAO_TTS_TOKEN" \
  -d '{
    "app": {
      "appid": "1682246520",
      "token": "REDACTED_DOUBAO_TTS_TOKEN",
      "cluster": "volcano_tts"
    },
    "user": {"uid": "user_001"},
    "audio": {
      "voice_type": "BV002_streaming",
      "encoding": "mp3",
      "rate": 24000
    },
    "request": {
      "reqid": "unique-id-123",
      "text": "你好，这是测试文本",
      "text_type": "plain",
      "operation": "query"
    }
  }'
```

---

## 常用参数

| 参数 | 值 | 说明 |
|------|---|------|
| `voice_type` | `BV002_streaming` | 青年男声 |
| `encoding` | `mp3` | 音频格式 (mp3/wav/pcm) |
| `rate` | `24000` | 采样率 |
| `speed_ratio` | `1.0` | 语速 (0.2-3.0) |
| `volume_ratio` | `1.0` | 音量 (0.1-3.0) |

---

## 其他男声音色

| 音色代码 | 特点 |
|---------|------|
| `BV002_streaming` | 青年男声（默认） |
| `zh_male_chunhou_zhiboshuangkuai` | 磁性男声 |
| `zh_male_narrator_general` | 男声旁白 |

---

## 返回结果

```json
{
  "code": 3000,
  "message": "Success",
  "data": "base64编码的音频数据",
  "addition": {
    "duration": "5105"
  }
}
```

- `code: 3000` 表示成功
- `data` 是 base64 编码的音频，解码后保存为 mp3 文件

---

## 测试脚本

运行已创建的测试脚本：

```bash
node test-doubao-final.mjs
```
