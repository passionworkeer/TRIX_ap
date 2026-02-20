# 配对功能测试指南

## 问题描述

OpenClaw pairing skill 通过服务器生成配对码，但服务器返回的数据缺少 `pairingCode` 和 `pairingToken` 字段。

## 修复内容

### 1. 服务器端修复 ✅

**文件**: `server/clawbot-channel/server.js`

**修改**: 在 `bot_request_pairing` 事件的 callback 中返回完整的配对信息

```javascript
// 修复前（line 304）
callback({ success: true, restored: false });

// 修复后
callback({
  success: true,
  restored: false,
  pairingCode: pairing.pairingCode,
  pairingToken: pairing.pairingToken,
  pairingId: pairing.id,
  expiresAt: pairing.expiresAt
});
```

### 2. Skill 端修复 ✅

**文件**: `openclaw-skills/pairing/index.js`

- ✅ 添加 Socket.IO 客户端连接
- ✅ 通过 `bot_request_pairing` 事件获取配对码
- ✅ 安装依赖 `socket.io-client`

## 重启服务器

服务器代码已修改，需要在服务器上重启：

```bash
# SSH 到服务器
ssh user@139.196.36.209

# 重启 clawbot-channel 服务
cd /path/to/clawbot-channel
pm2 restart clawbot-channel
# 或
npm start
```

## 测试步骤

### 1. 测试服务器 API

```bash
# 使用 m.jmtrick.com 域名
node test-pairing.js

# 预期输出：
# ✅ Connected
# 📥 Response: {
#   "success": true,
#   "restored": false,
#   "pairingCode": "ABC123",
#   "pairingToken": "uuid-xxx",
#   "pairingId": "uuid-xxx",
#   "expiresAt": "2026-02-20T09:45:00.000Z"
# }
```

### 2. 完整配对流程测试

1. **在 OpenClaw 中生成配对码**：`"生成配对码"`
2. **在手机 App 中输入配对码**
3. **验证 App 显示"等待设备确认"**
4. **验证配对成功**

## 服务器地址配置

- **域名（推荐）**: `http://m.jmtrick.com:8765`
- **IP**: `http://139.196.36.209:8765` (目前不可达，需要检查防火墙)

## 依赖安装

```bash
cd openclaw-skills/pairing
npm install
```

## 测试脚本

创建 `test-pairing.js`:

```javascript
const { io } = require('socket.io-client');

const socket = io('http://m.jmtrick.com:8765', {
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('✅ Connected');
  const deviceId = 'clawbot_test_' + Date.now();
  socket.emit('bot_request_pairing', { deviceId }, (response) => {
    console.log('📥 Response:', JSON.stringify(response, null, 2));
    socket.disconnect();
    process.exit(0);
  });
});

socket.on('connect_error', (err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

setTimeout(() => process.exit(1), 5000);
```
