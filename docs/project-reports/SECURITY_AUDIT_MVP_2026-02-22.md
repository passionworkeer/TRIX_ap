# TRIX 3D Companion - MVP 安全审计报告

> **审计日期**: 2026-02-22
> **审计范围**: 前端 (src/) + 后端 (server/clawbot-channel/)
> **审计版本**: feature/nanobot-integration
> **整体评分**: 60/100 (中等风险)

---

## 执行摘要

本次安全审计对 TRIX 3D Companion 项目进行了全面的安全评估，发现 **3 个严重漏洞**、**3 个高危漏洞** 和 **5 个中危漏洞**。

### 风险等级分布

| 级别 | 数量 | 描述 |
|------|------|------|
| 🔴 **Critical (P0)** | 3 | 必须立即修复 |
| 🟠 **High (P1)** | 3 | 1 周内修复 |
| 🟡 **Medium (P2)** | 5 | 2 周内修复 |
| 🟢 **Low (P3)** | 4 | 计划修复 |

---

## 1. Secrets Management (密钥管理)

### 🔴 Critical: 暴露的 TTS Token

**文件**: `docs/tts.md`
**严重程度**: Critical

**问题描述**:
文档中硬编码了真实的 TTS API Token。

```markdown
Authorization: Token REDACTED_DOUBAO_TTS_TOKEN
```

**风险**: 攻击者可使用此 Token 调用 TTS 服务，产生费用或滥用服务。

**修复建议**:
1. 立即轮换此 Token
2. 将 Token 移至环境变量 `VITE_TTS_API_TOKEN`
3. 使用占位符替换文档中的真实值

---

### 🔴 Critical: 归档文件中的硬编码 Auth Token

**文件**: `archive/nanobot/src/services/openclaw-bridge.js`
**严重程度**: Critical

**问题描述**:
归档的代码中包含硬编码的认证 Token。

```javascript
const AUTH_TOKEN = '__GATEWAY_AUTH_TOKEN_REDACTED__';
```

**风险**: 如果此 Token 仍在使用，可能导致未授权访问。

**修复建议**:
1. 确认此 Token 是否仍在使用
2. 如在使用，立即轮换
3. 从 git 历史中移除敏感文件

---

### 🟠 High: OSS 凭证暴露在前端

**文件**: `src/services/OSSService.ts`
**严重程度**: High

**问题描述**:
阿里云 OSS AccessKey 和 SecretKey 直接暴露在前端代码中。

```typescript
const client = new OSS({
  region: ossRegion,
  accessKeyId: ossAccessKeyId,     // 前端可见
  accessKeySecret: ossAccessKeySecret, // 前端可见
  bucket: ossBucket,
});
```

**风险**:
- 用户可通过浏览器开发者工具获取凭证
- 攻击者可上传恶意文件或删除存储桶内容
- 可能产生巨额费用

**修复建议**:
1. **立即**: 创建专用的 STS 临时凭证服务
2. **短期**: 使用 OSS 签名 URL（服务端签名）
3. **长期**: 所有文件操作通过后端代理

---

### ✅ 已修复: 硬编码的 Ngrok Token

**文件**: `src/services/clawbotPairingService.ts`
**状态**: ✅ 已在本次审计前修复

原问题已移除，现在从环境变量读取。

---

## 2. Input Validation (输入验证)

### ✅ 良好实践: 文件上传验证

**文件**: `server/clawbot-channel/routes/upload.js`

项目已实现文件上传白名单验证：

```javascript
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/wav', 'audio/ogg'
];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
```

### ✅ 良好实践: TTS 文本清理

**文件**: `server/clawbot-channel/services/ttsTextSanitizer.js`

TTS 文本经过严格清理，防止注入：

```javascript
function sanitizeTtsText(rawText, maxLength = 500) {
  // 移除代码块、URL、Markdown 格式等
}
```

---

## 3. SQL Injection (SQL 注入)

### ✅ 安全: 使用参数化查询

**文件**: `src/services/databaseService.ts`

项目使用 Supabase 客户端，自动使用参数化查询：

```typescript
const { data } = await supabase
  .from('chat_messages')
  .select('*')
  .eq('conversation_id', conversationId);  // 安全
```

**结论**: SQL 注入风险低。

---

## 4. Authentication & Authorization (认证授权)

### 🟠 High: WebSocket 缺少 Origin 验证

**文件**: `server/clawbot-channel/index.js`
**严重程度**: High

**问题描述**:
Socket.IO 配置允许任意来源连接：

```javascript
const io = new Server(httpServer, {
  cors: {
    origin: '*',  // 危险！
    methods: ['GET', 'POST'],
  },
});
```

**风险**:
- 任意网站可建立 WebSocket 连接
- 可能导致 CSRF via WebSocket

**修复建议**:

```javascript
const ALLOWED_ORIGINS = [
  'https://your-domain.com',
  'http://localhost:5173' // 仅开发环境
];

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
  },
});
```

---

### 🟠 High: CORS 允许所有来源

**文件**: `server/clawbot-channel/index.js`
**严重程度**: High

**问题描述**:
Express CORS 中间件配置过于宽松：

```javascript
app.use(cors({ origin: '*' }));
```

**修复建议**:

```javascript
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://your-production-domain.com']
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
};
app.use(cors(corsOptions));
```

---

### 🔴 Critical: 缺少 CSRF 保护

**文件**: `server/clawbot-channel/index.js`
**严重程度**: Critical

**问题描述**:
所有状态变更端点（POST、PUT、DELETE）没有 CSRF 保护。

**风险**:
- 攻击者可诱导用户点击恶意链接
- 可执行未授权的操作（如发送消息、修改设置）

**修复建议**:

```javascript
import csrf from 'csurf';

const csrfProtection = csrf({ cookie: true });

// 应用于所有状态变更路由
app.post('/api/*', csrfProtection, (req, res) => {
  // 处理请求
});

// 前端需要包含 CSRF token
// <meta name="csrf-token" content="{{csrfToken}}">
```

---

### 🟡 Medium: localStorage 存储敏感数据

**文件**: `src/services/clawbotPairingService.ts`

**问题描述**:
Token 和设备 ID 存储在 localStorage：

```typescript
localStorage.setItem('clawbot_device_token', deviceToken);
localStorage.setItem('clawbot_device_id', deviceId);
```

**风险**: XSS 攻击可窃取这些数据。

**修复建议**:
- 对于敏感 Token，使用 httpOnly Cookie
- 对于设备 ID，可接受 localStorage（非敏感）

---

### 🟡 Medium: 消息同步端点缺少认证

**文件**: `server/clawbot-channel/services/messageService.js`

**问题描述**:
`fetchMissedMessages` 函数仅依赖 userId 参数，未验证请求者身份。

**修复建议**:
添加会话验证，确保请求者只能获取自己的消息。

---

## 5. XSS Prevention (跨站脚本防护)

### ✅ 良好: React 默认 XSS 防护

项目使用 React，默认转义 HTML 内容。

### ✅ 良好: 消息内容不直接渲染 HTML

聊天消息以文本形式显示，未使用 `dangerouslySetInnerHTML`。

### 🟡 建议: 添加 Content-Security-Policy

虽然 React 提供基础防护，但建议添加 CSP 头：

```javascript
// server/clawbot-channel/index.js
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' wss: https:;"
  );
  next();
});
```

---

## 6. Rate Limiting (限流)

### ✅ 良好: 已实现限流

**文件**: `server/clawbot-channel/index.js`

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
});

app.use(limiter);
```

### 🟡 建议: 敏感操作加强限流

对于配对、消息发送等敏感操作，建议更严格的限流：

```javascript
const pairingLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 分钟
  max: 5,               // 最多 5 次请求
  message: '配对请求过于频繁，请稍后再试',
});

app.post('/request_pairing', pairingLimiter, handlePairing);
```

---

## 7. WebSocket Security (WebSocket 安全)

### 🟡 Medium: WebSocket 认证较弱

**文件**: `src/services/ClawbotChannelBridge.ts`

**问题描述**:
WebSocket 连接后，`app_register` 事件仅传递 userId，无签名验证。

```typescript
socket.emit('app_register', {
  userId,
  deviceId,
});
```

**风险**: 攻击者可伪造 userId 冒充其他用户。

**修复建议**:
1. 连接时传递 JWT Token
2. 服务端验证 Token 有效性
3. 绑定 Socket ID 与用户身份

```javascript
// 服务端
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const payload = verifyJwtToken(token);
    socket.userId = payload.userId;
    next();
  } catch (err) {
    next(new Error('Authentication failed'));
  }
});
```

---

## 8. Sensitive Data Exposure (敏感数据泄露)

### 🟡 Medium: 日志中包含用户 ID

**文件**: 多个服务文件

**问题描述**:
部分日志输出包含用户 ID：

```javascript
console.log('[Service] 用户操作:', { userId, action });
```

**建议**: 确保生产环境日志不包含 PII（个人身份信息）。

---

### 🟡 Medium: URL 参数中的用户 ID

**问题描述**:
部分 API 使用 URL 查询参数传递 userId：

```typescript
const response = await fetch(`/api/messages?userId=${userId}`);
```

**风险**: 用户 ID 会出现在服务器日志和浏览器历史中。

**修复建议**: 从认证会话中获取 userId，而非 URL 参数。

---

## 9. Dependency Security (依赖安全)

### 运行 npm audit

```bash
cd trix-3d-companion && npm audit
cd server/clawbot-channel && npm audit
```

**当前状态**: 存在 9 个已知漏洞（4 moderate, 4 high, 1 critical）

**修复建议**:
```bash
npm audit fix
npm audit fix --force  # 谨慎使用，可能导致破坏性变更
```

---

## 10. Database Security (数据库安全)

### ✅ 良好: Supabase RLS 已启用

项目在 Supabase 中启用了 Row Level Security。

### 🟡 建议: 验证 RLS 策略完整性

确保所有表都有适当的 RLS 策略：

```sql
-- 验证 RLS 策略
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public';
```

---

## 安全评分明细

| 检查项 | 权重 | 得分 | 加权得分 |
|--------|------|------|----------|
| 密钥管理 | 20% | 40 | 8 |
| 输入验证 | 15% | 85 | 12.75 |
| SQL 注入防护 | 15% | 95 | 14.25 |
| 认证授权 | 20% | 50 | 10 |
| XSS 防护 | 10% | 80 | 8 |
| CSRF 防护 | 10% | 0 | 0 |
| 限流 | 5% | 80 | 4 |
| 依赖安全 | 5% | 60 | 3 |
| **总分** | **100%** | - | **60** |

---

## 修复优先级

### 🔴 P0 - 立即修复（24小时内）

1. **轮换暴露的 TTS Token**
2. **移除/轮换归档文件中的 Auth Token**
3. **添加 CSRF 保护**

### 🟠 P1 - 1周内修复

4. **限制 CORS 来源**
5. **添加 WebSocket Origin 验证**
6. **将 OSS 凭证移至后端**

### 🟡 P2 - 2周内修复

7. 敏感 Token 改用 httpOnly Cookie
8. 加强 WebSocket 认证
9. 消息同步端点添加认证
10. 避免在 URL 参数中传递用户 ID

---

## 良好实践总结

项目已实现的安全措施：

- ✅ 参数化 SQL 查询（防止注入）
- ✅ 文件上传类型白名单
- ✅ 文件大小限制
- ✅ TTS 文本清理
- ✅ 安全的配对码生成（crypto.randomBytes）
- ✅ 基础限流
- ✅ React 默认 XSS 防护
- ✅ Supabase RLS 启用
- ✅ 环境变量管理敏感配置

---

## 附录：快速修复脚本

### 1. 添加 CSRF 保护

```javascript
// server/clawbot-channel/index.js
import csrf from 'csurf';
import cookieParser from 'cookie-parser';

app.use(cookieParser());
const csrfProtection = csrf({ cookie: { httpOnly: true, secure: true } });

// CSRF token 端点
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// 保护所有 POST/PUT/DELETE
app.use('/api/*', csrfProtection);
```

### 2. 限制 CORS

```javascript
// server/clawbot-channel/index.js
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ['https://your-domain.com']
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
}));
```

### 3. WebSocket 认证

```javascript
// server/clawbot-channel/index.js
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.headers.authorization;

  if (!token) {
    return next(new Error('Authentication required'));
  }

  // 验证 token（使用你的验证逻辑）
  try {
    const payload = verifyToken(token);
    socket.userId = payload.userId;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});
```

---

**审计人员**: Claude Code Security Audit
**审计完成时间**: 2026-02-22
**下次审计建议**: 3 个月后或重大功能更新时
