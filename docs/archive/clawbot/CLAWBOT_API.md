# Clawbot Channel 配对 API 文档

## 🔧 最新更新

**更新时间**：2026-02-15 12:00

**修复内容**：

- ✅ 修复了 `user_paired` 事件无法发送的问题
- ✅ 添加了 socket 存储逻辑，确保 Clawbot 能收到事件
- ✅ 添加了详细的调试日志

**重要提示**：Clawbot 在调用 `bot_request_pairing` 后**必须保持连接**，不能立即断开！

---

## 📋 问题修复说明

**问题**：之前 Clawbot 发起配对时报错 `NOT NULL constraint failed: pairings.user_id`

**原因**：数据库表结构要求 `user_id` 字段非空，但 Clawbot 发起配对时还没有用户信息

**解决方案**：已修改数据库表结构，`user_id` 字段现在允许 `NULL`，直到 App 用户扫码/输入配对码后才绑定

---

## 🔌 连接信息

```yaml
协议: Socket.io (WebSocket)
服务器地址: ws://TRIX_SERVER_HOST:8765
传输方式: ['websocket', 'polling']
CORS: 允许所有来源
认证: 无需额外认证（Socket.io 连接本身）
```

---

## 📡 API 事件列表

### 事件 1️⃣：请求配对（生成配对码和二维码）

**事件名称**：`bot_request_pairing`

**发送数据**：
```json
{
  "deviceId": "clawbot-001"  // 设备唯一标识符（字符串，必填）
}
```

**回调响应**：
```json
{
  "success": true  // 或 false（失败时）
}
```

**服务器响应事件**：`pairing_info`

**返回数据**：
```json
{
  "pairingId": "550e8400-e29b-41d4-a716-4466554400000",  // 配对会话ID（UUID）
  "pairingCode": "A3B9K7",                               // 6位配对码（大写字母+数字）
  "qrImage": "data:image/png;base64,iVBORw0KGgo...",    // Base64 二维码图片（Data URL）
  "expiresIn": 600                                        // 过期时间（秒），默认10分钟
}
```

**字段说明**：
- `pairingId`：配对会话的唯一标识符，后续确认配对时需要使用
- `pairingCode`：6位配对码，用户可以在 App 端手动输入
- `qrImage`：二维码图片，Base64 编码的 Data URL，可以直接在界面显示
- `expiresIn`：配对码和二维码的有效期（秒），超时后需重新请求

**使用示例（JavaScript）**：
```javascript
const socket = io('ws://TRIX_SERVER_HOST:8765');

// 请求配对
socket.emit('bot_request_pairing', {
  deviceId: 'clawbot-001'
}, (response) => {
  if (response.success) {
    console.log('配对请求已发送，等待服务器返回配对信息...');
  } else {
    console.error('配对请求失败');
  }
});

// 监听配对信息
socket.on('pairing_info', (data) => {
  console.log('配对码:', data.pairingCode);
  console.log('配对ID:', data.pairingId);
  console.log('过期时间:', data.expiresIn, '秒');

  // 显示二维码
  // data.qrImage 是 "data:image/png;base64,..." 格式
  // 可以直接设置 <img src={data.qrImage} />
});
```

---

### 事件 2️⃣：监听用户扫码/输入配对码

**事件名称**：`user_paired`

**接收数据**：
```json
{
  "pairingId": "550e8400-e29b-41d4-a716-4466554400000",
  "userId": "bd49b054-7e8d-45e0-863e-0a7d89d51bf3"
}
```

**说明**：
- 当 App 用户扫描二维码或手动输入配对码后，服务器会触发此事件通知 Clawbot
- `pairingId`：与步骤1中返回的 `pairingId` 相同
- `userId`：App 用户的唯一标识符（UUID）

**使用示例（JavaScript）**：
```javascript
socket.on('user_paired', (data) => {
  console.log('用户已配对:', data.userId);
  console.log('配对ID:', data.pairingId);

  // 显示确认对话框
  // 用户点击"确认"后，调用 bot_confirm_pairing
  confirmPairing(data.pairingId);
});
```

---

### 事件 3️⃣：确认配对

**事件名称**：`bot_confirm_pairing`

**发送数据**：
```json
{
  "deviceId": "clawbot-001",
  "pairingId": "550e8400-e29b-41d4-a716-4466554400000"
}
```

**回调响应**：
```json
{
  "success": true  // 配对成功
}
```

或失败时：
```json
{
  "success": false,
  "error": "Pairing not found"  // 错误信息
}
```

**使用示例（JavaScript）**：
```javascript
function confirmPairing(pairingId) {
  socket.emit('bot_confirm_pairing', {
    deviceId: 'clawbot-001',
    pairingId: pairingId
  }, (response) => {
    if (response.success) {
      console.log('配对完成！');
      // 更新UI状态
    } else {
      console.error('配对失败:', response.error);
    }
  });
}
```

---

### 事件 4️⃣：配对成功通知

**服务器发送事件**：`pairing_success`

**接收数据**：
```json
{
  "deviceId": "clawbot-001",
  "deviceName": "Clawbot"
}
```

**说明**：
- 配对完成后，服务器会向 App 用户发送此事件
- Clawbot 本身也可以监听此事件作为最终确认

---

## 🔄 完整配对流程图

```
┌─────────────┐                          ┌─────────────┐                         ┌─────────────┐
│   Clawbot   │                          │   Server    │                         │     App     │
└──────┬──────┘                          └──────┬──────┘                         └──────┬──────┘
       │                                         │                                         │
       │  bot_request_pairing                     │                                         │
       │  {deviceId: "clawbot-001"}             │                                         │
       │─────────────────────────────────────────>  │                                         │
       │                                         │                                         │
       │                                         │  生成配对码 + 二维码                      │
       │                                         │  user_id = NULL                          │
       │                                         │                                         │
       │  pairing_info                           │                                         │
       │  {pairingCode, qrImage, pairingId}     │                                         │
       │<─────────────────────────────────────────  │                                         │
       │                                         │                                         │
       │  显示配对码和二维码                       │                                         │
       │                                         │                                         │
       │                                         │  pair_with_code 或 pair_with_token     │
       │                                         │<────────────────────────────────────────│
       │                                         │  绑定 userId 到配对记录                   │
       │                                         │                                         │
       │  user_paired                           │  pairing_success                         │
       │  {pairingId, userId}                   │─────────────────────────────────────────>│
       │<─────────────────────────────────────────  │                                         │
       │                                         │                                         │
       │  确认配对（自动或用户点击确认）             │                                         │
       │                                         │                                         │
       │  bot_confirm_pairing                    │                                         │
       │  {deviceId, pairingId}                  │─────────────────────────────────────────>│
       │                                         │  status = 'paired'                      │
       │  {success: true}                       │                                         │
       │<─────────────────────────────────────────  │                                         │
       │                                         │                                         │
       │  配对完成，开始通信！                     │                                         │
       │                                         │                                         │
```

---

## 🛠️ Python 客户端示例代码

```python
import socketio
import time

# 创建 Socket.io 客户端
sio = socketio.Client()

# 配对信息存储
pairing_data = {}

@sio.event
def connect():
    print('✅ 已连接到服务器')
    # 连接成功后立即请求配对
    request_pairing()

@sio.event
def disconnect():
    print('❌ 已断开连接')

@sio.on('pairing_info')
def on_pairing_info(data):
    """收到配对信息"""
    print('📋 配对码:', data['pairingCode'])
    print('🆔 配对ID:', data['pairingId'])
    print('⏰ 过期时间:', data['expiresIn'], '秒')

    # 保存配对数据
    pairing_data['pairingId'] = data['pairingId']
    pairing_data['pairingCode'] = data['pairingCode']

    # 显示二维码
    qr_image = data['qrImage']  # data:image/png;base64,...
    # TODO: 在界面上显示二维码
    # qr_image 可以直接用在 HTML 中: <img src="data['qrImage']" />

@sio.on('user_paired')
def on_user_paired(data):
    """用户已扫码/输入配对码"""
    print('👤 用户已配对:', data['userId'])
    print('🆔 配对ID:', data['pairingId'])

    # 自动确认配对
    sio.emit('bot_confirm_pairing', {
        'deviceId': 'clawbot-001',
        'pairingId': data['pairingId']
    }, callback=on_pairing_confirmed)

def on_pairing_confirmed(response):
    """配对确认回调"""
    if response.get('success'):
        print('✅ 配对完成！')
        # TODO: 更新UI状态
        # TODO: 开始与用户通信
    else:
        print('❌ 配对失败:', response.get('error'))

@sio.on('pairing_success')
def on_pairing_success(data):
    """配对成功通知（服务器广播）"""
    print('🎉 配对成功！')
    print('设备:', data['deviceName'])

def request_pairing():
    """请求配对"""
    sio.emit('bot_request_pairing', {
        'deviceId': 'clawbot-001'
    }, callback=lambda response: print('配对请求已发送' if response.get('success') else '配对请求失败'))

# 连接到服务器
try:
    sio.connect('ws://TRIX_SERVER_HOST:8765')
    sio.wait()  # 保持连接
except Exception as e:
    print('❌ 连接失败:', e)
```

---

## 📝 配对码规则

- **长度**：6 位
- **字符集**：大写字母（A-Z，排除易混淆字符 I、O）+ 数字（2-9，排除 0、1）
- **示例**：`A3B9K7`、`H7N4Q2`
- **有效期**：默认 600 秒（10 分钟）

---

## ⚠️ 注意事项

1. **deviceId 唯一性**：
   - 每个 Clawbot 设备必须有唯一的 `deviceId`
   - 建议使用设备序列号、MAC 地址或 UUID
   - 相同的 `deviceId` 会导致配对混乱

2. **配对码一次性使用**：
   - 配对成功后，`pairingToken` 会失效
   - 如需重新配对，Clawbot 需要重新调用 `bot_request_pairing`

3. **过期处理**：
   - 配对码过期后，需要重新请求新的配对码
   - 服务器会定期清理过期的配对记录（每 5 分钟）

4. **并发限制**：
   - 同一个 `deviceId` 同一时间只能有一个有效的配对请求
   - 如果 App 用户长时间未扫码，建议重新生成配对码

5. **错误处理**：
   - 所有带 `callback` 的事件都会返回 `{success: true/false, error?: string}`
   - 建议在 UI 上显示错误信息

6. **消息通信**（配对完成后）：

   **Clawbot 发送消息给 App**：
   - 服务器通过 HTTP Webhook 或 Socket.io 转发
   - Clawbot 可以调用服务器的 `/webhook/clawbot` 接口

   **App 发送消息给 Clawbot**：
   - App 通过 Socket.io 发送 `app_message` 事件
   - 服务器会转发到对应的 Clawbot Socket

---

## 🔧 调试建议

### 1. 查看服务器日志

```bash
ssh root@TRIX_SERVER_HOST "pm2 logs clawbot-channel --lines 50"
```

### 2. 检查服务状态

```bash
ssh root@TRIX_SERVER_HOST "pm2 status"
```

### 3. 测试服务器健康

```bash
curl http://TRIX_SERVER_HOST:8765/health
# 预期返回: {"status":"ok","timestamp":"..."}
```

### 4. 查看数据库记录

```bash
ssh root@TRIX_SERVER_HOST "sqlite3 /opt/clawbot-channel/data/pairing.db 'SELECT * FROM pairings ORDER BY created_at DESC LIMIT 5'"
```

---

## 📞 技术支持

如有问题，请联系：
- 服务器管理员：通过 SSH 查看日志
- API 文档更新时间：2026-02-15
- 服务器版本：Clawbot Channel v1.0.0
