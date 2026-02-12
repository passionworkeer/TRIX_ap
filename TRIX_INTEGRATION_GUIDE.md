# Clawdbot Gateway 集成指南

> **版本**: 1.0.0  
> **最后更新**: 2026年2月11日  
> **适用对象**: MiniMax / Clawdbot 开发者

---

## 📋 目录

1. [快速开始（5分钟上手）](#快速开始5分钟上手)
2. [详细配置步骤](#详细配置步骤)
3. [扫码配对流程说明](#扫码配对流程说明)
4. [故障排查指南](#故障排查指南)
5. [环境变量配置模板](#环境变量配置模板)

---

## 快速开始（5分钟上手）

### 前提条件

- Node.js >= 18.0.0
- Python >= 3.9
- 已安装 `openclaw-cn` CLI 工具

### 1分钟：安装 Gateway

```bash
# 检查 CLI 工具
openclaw-cn gateway status

# 启动 Gateway 服务
openclaw-cn gateway start

# 验证启动状态
openclaw-cn gateway status
```

### 2分钟：生成配对二维码

```bash
# 启动配对模式，生成二维码
node test-suite/test-pairing.js --generate-qr

# 或在代码中调用
const { generatePairingQR } = require('./test-suite/test-pairing.js');
generatePairingQR().then(code => {
  console.log('配对码:', code);
});
```

### 3分钟：完成配对

1. 打开手机 App（Clawdbot Mobile）
2. 点击「添加设备」→「扫码配对」
3. 扫描终端显示的二维码
4. 确认配对请求
5. 配对成功！🎉

### 4分钟：测试 WebSocket 连接

```bash
# 运行 WebSocket 连接测试
node test-suite/test-websocket.js
```

预期输出：
```
✅ WebSocket 服务器已启动 (ws://localhost:8080)
✅ 客户端已连接
✅ 心跳包发送正常
✅ 消息收发测试通过
✅ 所有测试通过！
```

### 5分钟：发送第一条消息

```bash
# 运行消息收发测试
node test-suite/test-message.js
```

---

## 详细配置步骤

### 步骤1：环境准备

#### 1.1 检查系统依赖

```bash
# 检查 Node.js
node --version  # >= v18.0.0

# 检查 Python
python3 --version  # >= 3.9

# 检查 openclaw-cn
openclaw-cn --version
```

#### 1.2 安装依赖

```bash
# 安装 Node.js 依赖
npm install ws qrcode axios

# 或使用 yarn
yarn add ws qrcode axios
```

### 步骤2：配置文件设置

#### 2.1 环境变量配置

复制模板文件并编辑：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# Gateway 配置
GATEWAY_PORT=8080
GATEWAY_HOST=0.0.0.0
GATEWAY_SECRET=your_secret_key_here

# WebSocket 配置
WS_HEARTBEAT_INTERVAL=30000
WS_RECONNECT_ATTEMPTS=5
WS_RECONNECT_DELAY=3000

# 配对配置
PAIRING_CODE_LENGTH=6
PAIRING_CODE_TTL=300000  # 5分钟
PAIRING_QR_SIZE=10

# 节点配置
NODE_MAX_CONNECTIONS=10
NODE_TIMEOUT=60000
NODE_PING_INTERVAL=10000

# 日志配置
LOG_LEVEL=info
LOG_FILE=./logs/gateway.log
```

#### 2.2 Gateway 配置文件

复制并编辑配置文件：

```bash
cp gateway-config.example.json gateway-config.json
```

关键配置项说明：

```json
{
  "gateway": {
    "port": 8080,
    "host": "0.0.0.0",
    "ssl": {
      "enabled": false,
      "cert": "./ssl/cert.pem",
      "key": "./ssl/key.pem"
    }
  },
  "websocket": {
    "path": "/ws",
    "heartbeat": {
      "enabled": true,
      "interval": 30000,
      "timeout": 10000
    },
    "reconnect": {
      "maxAttempts": 5,
      "delay": 3000,
      "exponentialBackoff": true
    }
  },
  "pairing": {
    "codeLength": 6,
    "codeTTL": 300000,
    "qrCodeSize": 10,
    "maxPending": 100
  },
  "nodes": {
    "maxConnections": 10,
    "timeout": 60000,
    "pingInterval": 10000,
    "authRequired": true
  }
}
```

### 步骤3：启动 Gateway

#### 3.1 使用 CLI 启动

```bash
# 开发模式
openclaw-cn gateway start --dev

# 生产模式
openclaw-cn gateway start --prod

# 指定配置文件
openclaw-cn gateway start --config ./gateway-config.json
```

#### 3.2 使用 Node.js 启动

```bash
# 直接启动
node gateway.js

# 使用 PM2 启动
pm2 start gateway.js --name clawdbot-gateway
```

### 步骤4：验证启动

```bash
# 检查 Gateway 状态
openclaw-cn gateway status

# 预期输出：
# Gateway Status: running
# PID: 12345
# Port: 8080
# WebSocket: active
# Paired Nodes: 0
# Uptime: 0d 0h 5m
```

---

## 扫码配对流程说明

### 配对流程图

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   设备端     │     │   Gateway   │     │   手机端     │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                    │                    │
       │  1. 生成配对码      │                    │
       │────────────────────>│                    │
       │                    │                    │
       │  2. 显示二维码      │                    │
       │<────────────────────│                    │
       │                    │                    │
       │         ┌──────────┴──────────┐        │
       │         │   用户扫描二维码     │        │
       │         └──────────┬──────────┘        │
       │                    │                    │
       │                    │  3. 发送配对请求    │
       │                    │<───────────────────│
       │                    │                    │
       │  4. 显示配对确认    │                    │
       │<────────────────────│                    │
       │                    │                    │
       │         ┌──────────┴──────────┐        │
       │         │   用户确认配对       │        │
       │         └──────────┬──────────┘        │
       │                    │                    │
       │  5. 确认配对        │                    │
       │────────────────────>│                    │
       │                    │                    │
       │                    │  6. 配对成功通知    │
       │                    │───────────────────>│
       │                    │                    │
       │  7. 建立 WebSocket  │                    │
       │<───────────────────>│                    │
       │                    │                    │
```

### 详细流程说明

#### 阶段1：生成配对码

**设备端操作：**

```javascript
const { generatePairingCode } = require('./test-suite/test-pairing.js');

// 生成配对码
const pairingCode = await generatePairingCode({
  length: 6,
  ttl: 300000,  // 5分钟有效期
  metadata: {
    deviceName: 'MacBook-Pro',
    deviceType: 'laptop'
  }
});

// 生成二维码
const qrCode = await generateQRCode(pairingCode);
console.log('请扫描二维码:', qrCode);
```

**生成的数据结构：**

```json
{
  "code": "A3B9K2",
  "expiresAt": "2026-02-11T12:05:00Z",
  "status": "pending",
  "metadata": {
    "deviceName": "MacBook-Pro",
    "deviceType": "laptop"
  }
}
```

#### 阶段2：扫描二维码

手机端扫描二维码后，获取配对码并发送到 Gateway。

**手机端请求：**

```http
POST /api/pairing/request
Content-Type: application/json

{
  "code": "A3B9K2",
  "deviceId": "mobile-12345",
  "deviceName": "iPhone 15",
  "publicKey": "-----BEGIN PUBLIC KEY-----\n..."
}
```

#### 阶段3：设备确认

Gateway 将配对请求转发到设备端，等待用户确认。

**设备端接收确认请求：**

```javascript
// 监听配对请求
pairingManager.on('pairingRequest', (request) => {
  console.log('收到配对请求:');
  console.log('  设备:', request.deviceName);
  console.log('  ID:', request.deviceId);
  
  // 显示确认对话框（CLI/GUI）
  showConfirmDialog(request);
});
```

#### 阶段4：用户确认

用户在设备端确认配对请求。

**确认方式：**
- CLI: 输入 `yes` 或 `no`
- GUI: 点击「确认」或「拒绝」按钮
- API: 调用确认接口

```javascript
// 确认配对
await pairingManager.confirmPairing(code, {
  confirmed: true,
  permissions: ['read', 'write', 'execute']
});
```

#### 阶段5：配对成功

配对成功后，双方建立 WebSocket 连接。

**成功响应：**

```json
{
  "status": "success",
  "nodeId": "node-abc123",
  "token": "jwt-token-here",
  "wsUrl": "ws://localhost:8080/ws?token=...",
  "expiresAt": "2026-02-11T12:00:00Z"
}
```

### 配对码有效期

| 阶段 | 超时时间 | 说明 |
|------|----------|------|
| 生成配对码 | 5分钟 | 二维码有效期 |
| 等待扫描 | 5分钟 | 从生成开始计算 |
| 等待确认 | 2分钟 | 从扫描后开始计算 |
| 配对后连接 | 24小时 | Token 有效期 |

### 安全机制

1. **一次性配对码**：每个配对码只能使用一次
2. **限时有效**：配对码5分钟后自动过期
3. **双向确认**：需要设备端和用户端双重确认
4. **公钥交换**：配对时交换公钥用于后续加密通信
5. **Token 机制**：配对成功后使用 JWT Token 进行身份验证

---

## 故障排查指南

### 常见问题速查表

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| Gateway 启动失败 | 端口被占用 | 更换端口或关闭占用进程 |
| 二维码无法扫描 | 终端颜色/尺寸问题 | 调整二维码大小或使用图形界面 |
| 配对超时 | 网络问题或配对码过期 | 重新生成配对码 |
| WebSocket 连接失败 | 防火墙或代理问题 | 检查网络设置 |
| 消息发送失败 | 未配对或 Token 过期 | 重新配对或刷新 Token |

### 问题1：Gateway 无法启动

**症状：**
```
Error: EADDRINUSE: address already in use :::8080
```

**排查步骤：**

1. 检查端口占用
```bash
# macOS/Linux
lsof -i :8080

# Windows
netstat -ano | findstr :8080
```

2. 更换端口
```bash
# 在 .env 中修改
GATEWAY_PORT=8081

# 或使用 CLI
openclaw-cn gateway start --port 8081
```

3. 关闭占用进程
```bash
# macOS/Linux
kill -9 <PID>

# Windows
taskkill /PID <PID> /F
```

### 问题2：二维码显示异常

**症状：**
- 二维码无法扫描
- 显示为乱码

**解决方案：**

1. 终端二维码调整
```javascript
// 增大二维码尺寸
const qrCode = await generateQRCode(pairingCode, {
  size: 10,  // 增大尺寸
  margin: 2
});
```

2. 使用图形界面显示
```javascript
// 保存为图片
const qrCode = await generateQRCode(pairingCode, {
  type: 'png',
  file: './qr-code.png'
});

// 打开图片
open('./qr-code.png');
```

3. 检查终端颜色支持
```bash
# 测试终端颜色
echo -e "\033[32m绿色测试\033[0m"
```

### 问题3：配对超时

**症状：**
```
Pairing timeout: Code expired
```

**可能原因：**
1. 配对码已过期（超过5分钟）
2. 网络延迟导致请求超时
3. 设备端未及时处理

**解决方案：**

1. 重新生成配对码
```javascript
// 自动刷新配对码
setInterval(async () => {
  const newCode = await generatePairingCode();
  updateQRCode(newCode);
}, 240000);  // 4分钟刷新一次
```

2. 延长配对码有效期
```javascript
const pairingCode = await generatePairingCode({
  ttl: 600000  // 延长到10分钟
});
```

3. 检查网络连接
```bash
# 测试网络连通性
ping gateway.example.com

# 测试端口连通性
telnet gateway.example.com 8080
```

### 问题4：WebSocket 连接失败

**症状：**
```
WebSocket connection failed: Error: connect ECONNREFUSED
```

**排查步骤：**

1. 检查 Gateway 状态
```bash
openclaw-cn gateway status
```

2. 检查防火墙设置
```bash
# 检查端口是否开放
sudo ufw status
sudo iptables -L | grep 8080
```

3. 测试 WebSocket 连接
```bash
# 使用 wscat 测试
npm install -g wscat
wscat -c ws://localhost:8080/ws
```

4. 检查代理设置
```bash
# 临时禁用代理测试
unset HTTP_PROXY
unset HTTPS_PROXY
```

### 问题5：消息收发失败

**症状：**
- 消息发送成功但对方收不到
- 收到消息但内容为空

**排查步骤：**

1. 检查配对状态
```javascript
const status = await checkPairingStatus(nodeId);
console.log(status);
// 应为: { paired: true, connected: true }
```

2. 检查消息格式
```javascript
// 确保消息格式正确
const message = {
  type: 'text',
  content: 'Hello',
  timestamp: Date.now()
};
```

3. 启用调试日志
```bash
# 在 .env 中设置
LOG_LEVEL=debug

# 重新启动 Gateway
openclaw-cn gateway restart
```

### 调试技巧

#### 启用详细日志

```bash
# 设置环境变量
export DEBUG=clawdbot:gateway:*

# 启动 Gateway
openclaw-cn gateway start
```

#### 使用测试脚本诊断

```bash
# 运行完整诊断
node test-suite/test-e2e.js --verbose

# 输出将显示每个步骤的详细信息
```

#### 检查系统资源

```bash
# 检查内存使用
free -h

# 检查 CPU 使用
top

# 检查磁盘空间
df -h
```

### 联系支持

如果问题无法解决：

1. 收集日志文件：`./logs/gateway.log`
2. 运行诊断脚本：`node test-suite/test-e2e.js --verbose`
3. 提交问题报告到 GitHub Issues

---

## 环境变量配置模板

### 完整 `.env` 模板

```env
# ============================================
# Clawdbot Gateway 环境变量配置
# ============================================
# 复制此文件为 .env 并根据需要修改
# ============================================

# --------------------------------------------
# 基础配置 (必填)
# --------------------------------------------

# Gateway 监听端口
GATEWAY_PORT=8080

# Gateway 监听地址 (0.0.0.0 表示所有接口)
GATEWAY_HOST=0.0.0.0

# Gateway 安全密钥 (生产环境必须修改！)
GATEWAY_SECRET=change_me_in_production_please

# 运行环境: development | production
NODE_ENV=development

# --------------------------------------------
# WebSocket 配置
# --------------------------------------------

# WebSocket 路径
WS_PATH=/ws

# 心跳包间隔 (毫秒)
WS_HEARTBEAT_INTERVAL=30000

# 心跳包超时 (毫秒)
WS_HEARTBEAT_TIMEOUT=10000

# 最大重连次数
WS_RECONNECT_ATTEMPTS=5

# 重连延迟 (毫秒)
WS_RECONNECT_DELAY=3000

# 启用指数退避
WS_EXPONENTIAL_BACKOFF=true

# --------------------------------------------
# 配对配置
# --------------------------------------------

# 配对码长度
PAIRING_CODE_LENGTH=6

# 配对码有效期 (毫秒)
PAIRING_CODE_TTL=300000

# 二维码大小 (1-10)
PAIRING_QR_SIZE=10

# 最大待处理配对数
PAIRING_MAX_PENDING=100

# 等待确认超时 (毫秒)
PAIRING_CONFIRM_TIMEOUT=120000

# --------------------------------------------
# 节点配置
# --------------------------------------------

# 每个节点最大连接数
NODE_MAX_CONNECTIONS=10

# 节点超时时间 (毫秒)
NODE_TIMEOUT=60000

# Ping 间隔 (毫秒)
NODE_PING_INTERVAL=10000

# 节点空闲超时 (毫秒)
NODE_IDLE_TIMEOUT=300000

# 需要认证
NODE_AUTH_REQUIRED=true

# --------------------------------------------
# SSL/TLS 配置 (生产环境)
# --------------------------------------------

# 启用 SSL
SSL_ENABLED=false

# SSL 证书路径
SSL_CERT_PATH=./ssl/cert.pem

# SSL 私钥路径
SSL_KEY_PATH=./ssl/key.pem

# SSL CA 证书路径 (可选)
SSL_CA_PATH=./ssl/ca.pem

# --------------------------------------------
# 日志配置
# --------------------------------------------

# 日志级别: error | warn | info | debug | trace
LOG_LEVEL=info

# 日志文件路径
LOG_FILE=./logs/gateway.log

# 日志文件最大大小 (MB)
LOG_MAX_SIZE=100

# 保留日志文件数
LOG_MAX_FILES=10

# 是否输出到控制台
LOG_CONSOLE=true

# --------------------------------------------
# 性能配置
# --------------------------------------------

# 最大并发连接数
MAX_CONNECTIONS=1000

# 消息队列大小
MESSAGE_QUEUE_SIZE=10000

# 启用压缩
ENABLE_COMPRESSION=true

# 压缩阈值 (字节)
COMPRESSION_THRESHOLD=1024

# --------------------------------------------
# 安全配置
# --------------------------------------------

# 启用速率限制
RATE_LIMIT_ENABLED=true

# 速率限制 (请求/分钟)
RATE_LIMIT_MAX=100

# 启用 IP 白名单
IP_WHITELIST_ENABLED=false

# IP 白名单 (逗号分隔)
IP_WHITELIST=127.0.0.1,::1

# Token 有效期 (小时)
TOKEN_EXPIRY=24

# --------------------------------------------
# 监控配置
# --------------------------------------------

# 启用指标收集
METRICS_ENABLED=true

# 指标端口
METRICS_PORT=9090

# 健康检查路径
HEALTH_CHECK_PATH=/health

# --------------------------------------------
# 外部服务配置 (可选)
# --------------------------------------------

# 上游 Gateway 地址 (用于级联)
UPSTREAM_GATEWAY=

# 上游 Gateway 密钥
UPSTREAM_SECRET=

# 启用服务发现
SERVICE_DISCOVERY_ENABLED=false

# 服务发现地址
SERVICE_DISCOVERY_URL=
```

### 不同环境的配置示例

#### 开发环境 (.env.development)

```env
NODE_ENV=development
GATEWAY_PORT=8080
LOG_LEVEL=debug
SSL_ENABLED=false
RATE_LIMIT_ENABLED=false
LOG_CONSOLE=true
```

#### 测试环境 (.env.test)

```env
NODE_ENV=test
GATEWAY_PORT=8081
LOG_LEVEL=info
SSL_ENABLED=false
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=1000
```

#### 生产环境 (.env.production)

```env
NODE_ENV=production
GATEWAY_PORT=443
LOG_LEVEL=warn
SSL_ENABLED=true
SSL_CERT_PATH=/etc/ssl/certs/clawdbot.crt
SSL_KEY_PATH=/etc/ssl/private/clawdbot.key
GATEWAY_SECRET=your_strong_secret_here
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=60
IP_WHITELIST_ENABLED=true
IP_WHITELIST=10.0.0.0/8,172.16.0.0/12
```

### 配置文件验证

```bash
# 验证环境变量
node -e "
const dotenv = require('dotenv');
const result = dotenv.config();
if (result.error) {
  console.error('配置错误:', result.error);
  process.exit(1);
}
console.log('✅ 配置验证通过');
console.log('端口:', process.env.GATEWAY_PORT);
console.log('环境:', process.env.NODE_ENV);
"
```

---

## 附录

### A. API 参考

#### REST API

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/pairing/generate` | POST | 生成配对码 |
| `/api/pairing/confirm` | POST | 确认配对 |
| `/api/pairing/status` | GET | 查询配对状态 |
| `/api/nodes` | GET | 列出已配对节点 |
| `/api/nodes/:id` | DELETE | 断开节点连接 |
| `/health` | GET | 健康检查 |
| `/metrics` | GET | 监控指标 |

#### WebSocket 消息类型

| 类型 | 方向 | 描述 |
|------|------|------|
| `ping` | 双向 | 心跳请求 |
| `pong` | 双向 | 心跳响应 |
| `pairing.request` | 设备→Gateway | 配对请求 |
| `pairing.confirm` | 设备→Gateway | 配对确认 |
| `pairing.success` | Gateway→设备 | 配对成功 |
| `message` | 双向 | 普通消息 |
| `command` | 双向 | 命令消息 |
| `error` | Gateway→设备 | 错误通知 |

### B. 相关文档

- [API 文档](./API_REFERENCE.md)
- [架构说明](./ARCHITECTURE.md)
- [使用指南](./USER_GUIDE.md)

### C. 更新日志

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2026-02-11 | 初始版本 |

---

**文档维护**: MiniMax Agent  
**最后更新**: 2026年2月11日
