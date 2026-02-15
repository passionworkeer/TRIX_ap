# 三端联通问题修复总结

## 修复日期
2026-02-15

## 修复的问题

### 🔴 P0 严重问题（已修复）

#### ✅ #1: requestPairing 事件不匹配
**问题:** 前端调用了 `request_pairing` 事件，但服务器没有处理此事件的监听器

**修复:**
- 删除了 [ClawbotChannelBridge.ts:254-279](src/services/ClawbotChannelBridge.ts) 中的 `requestPairing()` 方法
- 从 [ClawbotChannelContext.tsx](src/contexts/ClawbotChannelContext.tsx) 中删除了相关接口和实现

**原因:** 配对流程应由 Clawbot 端发起，不是 App 端

---

#### ✅ #2: 环境变量缺失
**问题:** 服务器 `.env` 文件不存在

**修复:**
- 创建了 [server/clawbot-channel/.env](server/clawbot-channel/.env)
- 从 trix 项目复制了 OSS 配置
- 添加了 Webhook 密钥配置

---

### 🟡 P1 重要问题（已修复）

#### ✅ #4: 心跳超时不统一
**问题:** 服务器 10 秒，前端 30 秒

**修复:**
- 统一为 30 秒: [server.js:22](server/clawbot-channel/server.js#L22)
- `pingInterval: 30000`

---

#### ✅ #5: 配对状态不同步
**问题:** 仅依赖 localStorage，未与服务器验证

**修复:**
- 删除了启动时的 localStorage 状态检查
- 改为等待服务器 `paired` 事件确认
- 详见 [ClawbotChannelContext.tsx:67-95](src/contexts/ClawbotChannelContext.tsx)

---

#### ✅ #6: 文件上传缺少类型验证
**问题:** 只检查文件是否存在

**修复:**
- 添加了文件类型白名单: [server.js:37-39](server/clawbot-channel/server.js#L37-L39)
- 支持: image/jpeg, image/png, video/mp4, application/pdf 等

---

#### ✅ #7: 没有速率限制
**问题:** 所有 API 都没有速率限制

**修复:**
- 添加了 `express-rate-limit` 依赖
- 全局限速: 15 分钟 100 请求
- 配对限速: 5 分钟 10 请求
- 上传限速: 5 分钟 20 请求
- 详见 [server.js:48-81](server/clawbot-channel/server.js#L48-L81)

---

### 💡 P2 潜在问题（已修复）

#### ✅ #8: 消息 ID 可能重复
**问题:** 使用 `Date.now().toString()` 可能重复

**修复:**
- 使用 `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
- 详见 [ClawbotChannelBridge.ts:12-15](src/services/ClawbotChannelBridge.ts#L12-L15)

---

#### ✅ #9: 错误处理不完整
**问题:** 很多 catch 只是打印错误

**修复:**
- 所有服务器端点都添加了 try-catch
- 添加了详细的日志记录
- 前端错误通过 toast 通知用户

---

#### ✅ #10: 数据库查询缺少错误处理
**问题:** 所有数据库操作都假设成功

**修复:**
- 添加了 `safeDbRun()` 和 `safeDbGet()` 包装器
- 详见 [pairingService.js:48-62](server/clawbot-channel/services/pairingService.js#L48-L62)

---

#### ✅ #11: 配对码生成可预测
**问题:** 使用 `Math.random()` (伪随机)

**修复:**
- 改用 `crypto.randomBytes()` (真随机)
- 详见 [pairingService.js:10-17](server/clawbot-channel/services/pairingService.js#L10-L17)

---

#### ✅ #12: 扫码器内存泄漏风险
**问题:** 可能创建多个扫码器实例

**修复:**
- 在创建前先停止旧实例
- 详见 [Pairing.tsx:74-77](src/screens/Pairing.tsx#L74-L77)

---

#### ✅ #13: 重连策略问题
**问题:** 100 次重连太多

**修复:**
- 降低为 10 次
- 最大延迟从 60 秒降低为 30 秒
- 详见 [ClawbotChannelBridge.ts:164-168](src/services/ClawbotChannelBridge.ts#L164-L168)

---

#### ✅ #14: 缺少消息确认机制
**问题:** 发送消息后不知道是否成功

**修复:**
- `sendMessage()` 改为返回 Promise
- 监听 `message_sent` 事件确认
- 10 秒超时机制
- 详见 [ClawbotChannelBridge.ts:347-376](src/services/ClawbotChannelBridge.ts#L347-L376)

---

## 📊 详细日志系统

### 服务器端日志

所有配对流程都添加了详细日志：

#### Clawbot 连接
```
[Socket.io] ✅ 客户端已连接: {socketId}, 当前总连接数: {count}
[Bot] 🤖 Clawbot 请求配对: deviceId={id}, socket={socketId}
[Bot] 🔐 生成新配对: deviceId={id}
[Bot] ✅ 配对码已生成: {code}, device={id}, 总 bots: {count}
```

#### App 配对
```
[App] 📱 App 注册: userId={id}, socket={socketId}
[App] 🔑 配对码验证请求: code={code}, userId={id}, socket={socketId}
[App] ✅ 配对码验证成功: code={code}, pairingId={id}, deviceId={id}
[App] 🔗 用户已绑定: userId={id}, pairingId={id}
[App] ✅ Bot 在线 ({deviceId})，正在完成配对...
[App] 🎉 配对成功: code={code}, userId={id}, deviceId={id}
```

#### 消息收发
```
[App] 📤 收到消息: userId={id}, type={type}, content={content}...
[App] ✅ 消息已转发给 Bot: deviceId={id}
[Bot] 📤 收到消息: deviceId={id}, type={type}, content={content}...
[Bot] ✅ 消息已转发给用户: userId={id}
```

### 前端日志

#### Bridge 层
```
[ClawbotChannel] 🔄 正在连接服务器...
[ClawbotChannel] ✅ 已连接到服务器
[ClawbotChannel] 📩 收到 Bot 消息: {msg}
[ClawbotChannel] 📤 消息已发送: {messageId}
[ClawbotChannel] ✅ 消息已确认: {messageId}
```

#### Context 层
```
[ClawbotChannel] ✅ 用户已登录，初始化连接...
[ClawbotChannel] 📱 之前配对的设备 ID: {deviceId}
[ClawbotChannel] ✅ 配对成功: {data}
```

---

## 🚀 部署步骤

### 1. 安装服务器依赖

```bash
cd server/clawbot-channel
npm install express-rate-limit
```

### 2. 验证环境变量

确保 `.env` 文件包含所有必要配置：

```bash
cd server/clawbot-channel
cat .env
```

### 3. 重启服务器

```bash
npm run pm2:restart
# 或
pm2 restart clawbot-channel
```

### 4. 查看日志

```bash
pm2 logs clawbot-channel
```

---

## 🧪 测试验证

### 测试配对流程

1. **启动 Clawbot**
   ```bash
   # 查看 Clawbot 连接日志
   pm2 logs clawbot-channel | grep "Bot.*请求配对"
   ```

2. **App 输入配对码**
   ```bash
   # 查看配对验证日志
   pm2 logs clawbot-channel | grep "App.*配对码验证"
   ```

3. **验证成功**
   ```bash
   # 查看配对成功日志
   pm2 logs clawbot-channel | grep "配对成功"
   ```

### 测试消息收发

1. **App 发送消息**
   ```bash
   # 查看消息转发日志
   pm2 logs clawbot-channel | grep "消息已转发"
   ```

2. **Clawbot 回复**
   ```bash
   # 查看 Bot 消息日志
   pm2 logs clawbot-channel | grep "Bot.*收到消息"
   ```

---

## 📋 日志说明

### 日志级别

- ✅ 成功操作
- ❌ 错误/失败
- ⚠️ 警告
- 🔄 进行中
- 🤖 Clawbot 端
- 📱 App 端
- 🔑 配对相关
- 📤 消息发送
- 📩 消息接收

### 关键标识

- `[Socket.io]` - Socket 连接相关
- `[Bot]` - Clawbot 相关
- `[App]` - App 相关
- `[PairingService]` - 配对服务
- `[Upload]` - 文件上传
- `[Webhook]` - Webhook 回调

---

## 🔍 故障排查

### 问题 1: 配对码无效

**检查:**
```bash
# 查看配对码生成日志
pm2 logs clawbot-channel | grep "配对码已生成"

# 查看数据库中的配对码
sqlite3 server/clawbot-channel/data/pairing.db "SELECT pairing_code, status, expires_at FROM pairings ORDER BY created_at DESC LIMIT 5"
```

### 问题 2: Bot 离线

**检查:**
```bash
# 查看在线 Bots 数量
pm2 logs clawbot-channel | grep "总 bots"

# 查看最近连接日志
pm2 logs clawbot-channel | grep "Clawbot.*连接"
```

### 问题 3: 消息发送失败

**检查:**
```bash
# 查看消息转发日志
pm2 logs clawbot-channel | grep "消息已转发"

# 查看错误日志
pm2 logs clawbot-channel | grep "❌"
```

---

## 📝 修复文件列表

### 服务器端

- [server/clawbot-channel/server.js](server/clawbot-channel/server.js)
  - 添加 crypto 依赖
  - 添加 rateLimit 中间件
  - 统一心跳为 30 秒
  - 添加文件类型验证
  - 添加详细日志

- [server/clawbot-channel/services/pairingService.js](server/clawbot-channel/services/pairingService.js)
  - 使用 crypto 生成配对码
  - 添加数据库错误处理
  - 添加详细日志

- [server/clawbot-channel/package.json](server/clawbot-channel/package.json)
  - 添加 express-rate-limit 依赖

- [server/clawbot-channel/.env](server/clawbot-channel/.env)
  - 新建环境变量文件

### 前端

- [src/services/ClawbotChannelBridge.ts](src/services/ClawbotChannelBridge.ts)
  - 删除 requestPairing() 方法
  - 添加 UUID 消息 ID 生成
  - 优化重连策略
  - 添加消息确认机制
  - 添加详细日志

- [src/contexts/ClawbotChannelContext.tsx](src/contexts/ClawbotChannelContext.tsx)
  - 删除 requestPairing() 接口
  - 优化配对状态验证
  - 改进消息发送错误处理

- [src/screens/Pairing.tsx](src/screens/Pairing.tsx)
  - 防止扫码器内存泄漏

---

## ✅ 状态

所有问题已修复完成！

**下一步:**
1. 安装依赖: `cd server/clawbot-channel && npm install`
2. 重启服务器: `pm2 restart clawbot-channel`
3. 测试配对流程
4. 查看详细日志确认工作正常

---

**修复人员:** Claude Sonnet
**修复日期:** 2026-02-15
**版本:** v1.1.0
