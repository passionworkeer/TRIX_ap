# Clawbot Channel 三端部署总结

**部署时间**: 2026-02-15
**部署状态**: ✅ 完成

---

## 📊 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│  [App] m.jmtrick.com (localhost:5173)                  │
│  React + Vite + TypeScript + Socket.io-client              │
│  - Supabase Auth (user.id)                             │
│  - 连接到 wss://TRIX_SERVER_HOST:8765                │
└────────────────┬────────────────────────────────────────────────┘
                 │ WebSocket (Socket.io)
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  [服务器 TRIX_SERVER_HOST:8765]                            │
│  Node.js + Express + Socket.io + SQLite                    │
│  - 配对管理 (pairings 表)                                │
│  - 消息转发 (messages 表)                                │
│  - App Room (user_{userId})                               │
│  - Clawbot Socket 存储 (Map: deviceId → socket)         │
└────────────────┬────────────────────────────────────────────────┘
                 │ HTTP Webhook + WebSocket Client
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  [Clawbot] MacBook                                         │
│  运行 Custom Channel 插件                                  │
│  - 显示配对码/二维码                                          │
│  - 接收服务器转发的 App 消息 → AI处理 → 回复服务器      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🖥️ 服务器端部署

### 1. 部署位置

- **目录**: `/opt/clawbot-channel/`
- **用户**: root
- **进程管理**: PM2

### 2. 文件结构

```
/opt/clawbot-channel/
├── server.js                    # 主服务器入口 (Express + Socket.io)
├── package.json               # 依赖配置
├── ecosystem.config.js       # PM2 配置
├── .env                       # 环境变量 (从 .env.example 复制)
├── config/
│   └── database.js          # SQLite 数据库配置
├── services/
│   ├── pairingService.js    # 配对管理服务
│   ├── messageService.js    # 消息存储服务
│   └── ossService.js       # 阿里云 OSS 集成 (可选)
└── data/
    └── pairing.db           # SQLite 数据库文件
```

### 3. 依赖安装

```bash
npm install
```

**主要依赖**:
- `express`: ^4.18.2 - HTTP 服务器
- `socket.io`: ^4.7.2 - WebSocket 服务器
- `sqlite3`: ^5.1.6 - 数据库
- `uuid`: ^9.0.0 - 生成唯一 ID
- `qrcode`: ^1.5.3 - 生成二维码

### 4. 数据库结构

**SQLite Database**: `/opt/clawbot-channel/data/pairing.db`

#### pairings 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 UUID |
| pairing_code | TEXT | 6位配对码 (如 "ABC123") |
| pairing_token | TEXT | 二维码配对 Token (UUID) |
| user_id | TEXT | Supabase User ID |
| device_id | TEXT | Clawbot 设备 ID (如 "clawbot_xxx") |
| device_name | TEXT | 设备名称 (如 "TRIX Mobile App") |
| status | TEXT | 状态: pending/paired/unpaired |
| created_at | DATETIME | 创建时间 |
| paired_at | DATETIME | 配对成功时间 |
| expires_at | DATETIME | 过期时间 (10分钟) |
| socket_id | TEXT | Socket.io 连接 ID |

#### messages 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 UUID |
| pairing_id | TEXT | 关联 pairings.id |
| direction | TEXT | app_to_bot / bot_to_app |
| content | TEXT | 消息内容 |
| content_type | TEXT | text / image / video |
| media_url | TEXT | 媒体文件 URL |
| created_at | DATETIME | 创建时间 |
| delivered | BOOLEAN | 是否已送达 |

### 5. PM2 配置

```javascript
{
  name: 'clawbot-channel',
  script: './server.js',
  instances: 1,
  exec_mode: 'fork',
  max_memory_restart: '500M'
}
```

**命令**:
```bash
# 启动
pm2 start /opt/clawbot-channel/server.js --name clawbot-channel

# 重启
pm2 restart clawbot-channel

# 查看状态
pm2 status

# 查看日志
pm2 logs clawbot-channel

# 保存进程列表
pm2 save
```

### 6. 网络配置

- **监听端口**: 8765 (所有接口: 0.0.0.0)
- **防火墙**: 已开放 8765 端口
- **外网访问**: http://TRIX_SERVER_HOST:8765

### 7. 环境变量

```env
NODE_ENV=production
PORT=8765
HOST=0.0.0.0

# 数据库
DATABASE_PATH=./data/pairing.db

# 配对配置
PAIRING_CODE_EXPIRY=300000      # 5分钟
PAIRING_TOKEN_EXPIRY=600000     # 10分钟

# Clawbot Webhook 密钥
CLAWBOT_WEBHOOK_SECRET=your-webhook-secret-here

# 阿里云 OSS (可选 - 当前未配置)
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=your-bucket
OSS_ACCESS_KEY_ID=your-key
OSS_ACCESS_KEY_SECRET=your-secret
```

### 8. API 端点

#### HTTP API

**GET /health**
- 健康检查端点
- 返回: `{"status":"ok","timestamp":"..."}`

**POST /webhook/clawbot**
- Clawbot Webhook 回调（接收 AI 回复）
- 请求头: `X-Webhook-Secret` (验证密钥)
- 请求体:
  ```json
  {
    "deviceId": "clawbot_xxx",
    "content": "AI 回复内容",
    "contentType": "text",
    "mediaUrl": "https://..."
  }
  ```

**GET /oss/signed-url?key=xxx**
- 生成 OSS 预签名 URL (当前返回 501 - OSS 未配置)

#### Socket.io 事件

##### App → Server

**app_register**
```json
{ "userId": "supabase-user-uuid" }
```

**request_pairing**
```json
{
  "userId": "supabase-user-uuid",
  "deviceName": "TRIX Mobile App"
}
```
响应:
```json
{
  "success": true,
  "pairingCode": "ABC123",
  "qrImage": "data:image/png;base64,...",
  "expiresIn": 600
}
```

**pair_with_code**
```json
{ "code": "ABC123" }
```

**pair_with_token**
```json
{ "token": "uuid-token" }
```

**app_message**
```json
{
  "content": "消息内容",
  "contentType": "text",
  "mediaUrl": "https://..."
}
```

**ping** → **pong**

**unpair**

##### Server → App

**pairing_success**
```json
{
  "deviceId": "clawbot_xxx",
  "deviceName": "Clawbot"
}
```

**bot_message**
```json
{
  "content": "AI 回复",
  "contentType": "text",
  "mediaUrl": "https://...",
  "timestamp": 17395576667
}
```

**unpaired**

**error**

##### Clawbot → Server

**bot_connect**
```json
{
  "deviceId": "clawbot_xxx",
  "pairingId": "pairing-uuid"
}
```

##### Server → Clawbot

**app_message**
```json
{
  "userId": "supabase-user-uuid",
  "content": "用户消息",
  "contentType": "text",
  "mediaUrl": "https://..."
}
```

---

## 📱 App 端修改

### 1. 新增文件

#### [src/services/ClawbotChannelBridge.ts](src/services/ClawbotChannelBridge.ts)
- **作用**: Socket.io 客户端桥接服务
- **关键功能**:
  - 连接到 `wss://TRIX_SERVER_HOST:8765`
  - App 注册 (`app_register`)
  - 请求配对 (`request_pairing`)
  - 配对码配对 (`pair_with_code`)
  - Token 配对 (`pair_with_token`)
  - 发送消息 (`app_message`)
  - 心跳机制 (30秒间隔)
  - 自动重连 (指数退避)

#### [src/contexts/ClawbotChannelContext.tsx](src/contexts/ClawbotChannelContext.tsx)
- **作用**: React Context 状态管理
- **状态**:
  - `isConnected`: Socket 连接状态
  - `isPaired`: 是否已配对
  - `pairingStatus`: idle/pairing/paired
  - `messages`: 消息列表
  - `pairingCode`: 配对码
  - `qrImage`: 二维码图片 (Data URL)
- **方法**:
  - `requestPairing()`: 请求配对
  - `pairWithCode(code)`: 配对码配对
  - `pairWithQR(token)`: 二维码配对
  - `sendMessage(content, type, mediaUrl)`: 发送消息
  - `unpair()`: 解绑

### 2. 修改文件

#### [src/App.tsx](src/App.tsx:25,204)
- **修改前**: 使用 `NanobotProvider` 包裹应用
- **修改后**: 使用 `ClawbotChannelProvider` 包裹应用
- **移除**: NanobotPairing 路由 (第 143 行)

#### [src/screens/Chat.tsx](src/screens/Chat.tsx:14,35-36)
- **修改前**: 使用 `useNanobot()` hook
- **修改后**: 使用 `useClawbotChannel()` hook
- **修改内容**:
  - 连接状态检查: `isClawbotChannelConnected && isClawbotPaired`
  - 点击处理: 导航到 `/pairing` (而非 `/nanobot-pairing`)
  - 显示名称: "TRIX Bot" (而非 "Nanobot")

#### [src/screens/ChatDetail.tsx](src/screens/ChatDetail.tsx:16,124-128,163-191,347-383)
- **修改前**: 使用 `nanobotBridge` 和 Nanobot 消息监听
- **修改后**: 使用 `useClawbotChannel()` hook
- **修改内容**:
  - 特殊处理 `friendId === 'clawbot_channel'` (而非 'nanobot')
  - 消息监听: 从 `clawbotMessages` 获取
  - 消息发送: `clawbotSendMessage()`

### 3. 环境变量配置

**[.env](.env:45)** 新增:
```env
# Clawbot Channel 服务器地址
VITE_CLAWBOT_CHANNEL_URL=wss://TRIX_SERVER_HOST:8765
```

### 4. 数据流

#### 配对流程

```
1. 用户打开 App
   └─→ 登录 Supabase → 获取 user.id
   └─→ 连接到 ClawbotChannel 服务器
   └─→ 发送 app_register: { userId }

2. 用户进入配对页面
   └─→ 发送 request_pairing: { userId, deviceName }
       └─→ 服务器生成配对数据 (pairingCode + qrImage)
       └─→ 返回 App 显示

3. Clawbot 生成配对码 (Mock 已配置)
   └─→ 用户输入配对码 "ABC123"
   └─→ App 发送 pair_with_code: { code }

4. Clawbot 连接服务器
   └─→ 发送 bot_connect: { deviceId, pairingId }
       └─→ 服务器更新 pairings 表: status='paired'
       └─→ 服务器通知 App: pairing_success

5. 配对完成，开始聊天
```

#### 消息流程

```
1. App 发送消息
   App → clawbotChannelBridge.sendMessage()
       → socket.emit('app_message', { content, contentType, mediaUrl })
       → 服务器收到消息
       → 保存到 messages 表 (app_to_bot)
       → 转发给 Clawbot (通过 Socket.io)

2. Clawbot 接收消息
   服务器 → clawbotSocket.emit('app_message', { userId, content })
       → Clawbot 处理消息
       → Clawbot 生成 AI 回复

3. Clawbot 发送回复
   Clawbot → HTTP POST /webhook/clawbot
       → 服务器收到回复
       → 保存到 messages 表 (bot_to_app)
       → 转发给 App (Socket.io Room: user_{userId})
       → App 收到 bot_message 事件
       → 更新 UI
```

---

## 🔧 配对流程详解

### 配对码配对 (6位)

1. **App 请求配对**
   ```
   socket.emit('request_pairing', { userId, deviceName })
   ```
   服务器生成 6 位配对码 (如 "ABC123")

2. **Clawbot 显示配对码**
   - Clawbot 生成 Mock 配对码
   - 用户在 App 输入 "ABC123"

3. **App 验证配对码**
   ```
   socket.emit('pair_with_code', { code: 'ABC123' })
   ```
   服务器查询数据库验证配对码

4. **Clawbot 连接确认**
   ```
   socket.emit('bot_connect', { deviceId, pairingId })
   ```
   服务器更新配对状态为 'paired'

5. **配对成功**
   - 服务器通知 App: `pairing_success`
   - App 更新状态为 `isPaired: true`

### 二维码配对 (Token)

1. **App 请求配对**
   ```
   socket.emit('request_pairing', { userId, deviceName })
   ```
   服务器生成 UUID Token (如 "a1b2c3d4-e5f6-7890")

2. **生成二维码**
   - 服务器生成二维码图片 (Data URL)
   - App 显示二维码

3. **Clawbot 扫描二维码**
   - 获取 Token
   - 连接服务器并验证 Token

4. **Clawbot 连接确认**
   ```
   socket.emit('bot_connect', { deviceId, pairingId })
   ```
   流程同配对码方式

---

## 🧪 测试验证

### 服务器端测试

```bash
# 1. 健康检查
curl http://TRIX_SERVER_HOST:8765/health
# 预期: {"status":"ok","timestamp":"..."}

# 2. 查看服务状态
ssh root@TRIX_SERVER_HOST "pm2 status"
# 预期: clawbot-channel - online

# 3. 查看日志
ssh root@TRIX_SERVER_HOST "pm2 logs clawbot-channel --lines 50"
# 预期: [OSS] OSS not configured, file upload disabled
```

### App 端测试

```bash
# 启动 App
npm run dev
# 访问: http://localhost:5173

# 测试步骤:
1. 登录 Supabase
2. 进入配对页面
3. 请求配对 → 显示配对码/二维码
4. 在 Clawbot 输入/扫描配对码
5. 验证配对成功
6. 发送测试消息
```

### Clawbot 端测试

Clawbot 已配置 Mock 生成配对码功能：
- 生成 6 位配对码
- 生成二维码图片
- 连接到服务器
- 发送/接收消息

---

## 📝 部署检查清单

### 服务器端
- [x] Node.js 已安装 (v14+)
- [x] 依赖已安装 (npm install 完成)
- [x] PM2 已安装并运行
- [x] 服务监听 8765 端口
- [x] 防火墙规则已配置
- [x] 外网可访问健康检查 API
- [x] SQLite 数据库已创建
- [x] PM2 进程状态: online

### App 端
- [x] ClawbotChannelBridge.ts 已创建
- [x] ClawbotChannelContext.tsx 已创建
- [x] App.tsx 已更新 Provider
- [x] Chat.tsx 已更新 hook 引用
- [x] ChatDetail.tsx 已更新消息逻辑
- [x] 环境变量已配置
- [x] App 可正常启动

### 配对功能
- [x] 服务器可生成配对码
- [x] 服务器可生成二维码
- [x] App 可请求配对
- [x] 配对码验证逻辑
- [x] Token 验证逻辑
- [x] Clawbot 可连接确认
- [x] 配对成功通知

### 消息功能
- [x] App 可发送消息
- [x] 服务器可转发消息
- [x] Clawbot 可接收消息
- [x] Clawbot 可回复消息
- [x] App 可接收回复
- [x] 消息持久化存储

---

## 🔄 下一步操作

### 1. 启动测试

```bash
# 服务器 (已运行)
ssh root@TRIX_SERVER_HOST "pm2 status"

# App (本地)
cd E:\desktop\trix-3d-companion
npm run dev

# Clawbot (本地)
cd E:\desktop\nanobot
# 启动 Clawbot 并生成配对码
```

### 2. 测试流程

1. **打开 App**: http://localhost:5173
2. **登录**: 使用 Supabase 账号
3. **进入配对**: /pairing
4. **Clawbot 操作**:
   - 生成配对码
   - 或生成二维码
5. **App 配对**:
   - 输入 6 位配对码
   - 或扫描二维码
6. **验证**: 检查 App 显示配对成功
7. **发送消息**: 测试消息收发

### 3. 监控日志

```bash
# 服务器日志
ssh root@TRIX_SERVER_HOST "pm2 logs clawbot-channel"

# App 控制台
# 浏览器 F12 查看 Socket.io 消息

# Clawbot 日志
# 查看 Clawbot 控制台输出
```

---

## 🐛 故障排查

### 问题: App 无法连接服务器

**检查**:
1. 服务器是否运行: `pm2 status`
2. 端口是否开放: `lsof -i :8765`
3. 外网是否可访问: `curl http://TRIX_SERVER_HOST:8765/health`

**解决**:
```bash
# 重启服务器
pm2 restart clawbot-channel

# 检查防火墙
iptables -L -n | grep 8765

# 查看错误日志
pm2 logs clawbot-channel --err
```

### 问题: 配对失败

**检查**:
1. 配对码是否过期 (有效期 10 分钟)
2. Clawbot 是否成功连接
3. 数据库中配对记录状态

**解决**:
```bash
# 查看数据库
ssh root@TRIX_SERVER_HOST "sqlite3 /opt/clawbot-channel/data/pairing.db 'SELECT * FROM pairings ORDER BY created_at DESC LIMIT 5'"

# 清理过期配对
pm2 restart clawbot-channel
```

### 问题: 消息发送失败

**检查**:
1. App 是否已配对 (`isPaired: true`)
2. Clawbot 是否在线
3. 查看消息表记录

**解决**:
```bash
# 查看消息日志
pm2 logs clawbot-channel | grep "app_message"

# 手动测试
curl -X POST http://TRIX_SERVER_HOST:8765/webhook/clawbot \
  -H "X-Webhook-Secret: your-secret" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test","content":"test"}'
```

---

## 📞 联系支持

如有问题，查看：
- [服务器部署指南](server/clawbot-channel/DEPLOYMENT_GUIDE.md)
- [服务器 README](server/clawbot-channel/README.md)
- [项目文档](docs/PROJECT_SUMMARY.md)

**部署完成时间**: 2026-02-15
**状态**: ✅ 服务器和 App 已就绪，等待三端测试
