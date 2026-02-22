# ARCHITECTURE.md - TRIX 3D Companion 架构文档

> 📐 本文档记录项目的核心架构设计、技术选型理由和关键决策

---

## 🎯 项目定位

**TRIX 3D Companion** 是一款面向移动端的 AI 伴侣应用，核心理念为 **"Zero UI" 沉浸式交互**。

### 核心特性
- 全屏 3D 角色展示，点击后显示导航和功能
- 通过 WebSocket 连接本地 PC 的 Clawbot Gateway
- AI 对话 + 桌面代理操控
- 学习计时、虚拟自习室、实时位置等社交功能

---

## 🏗️ 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         Mobile App (React)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Three.js  │  │   Supabase  │  │   Socket.io │              │
│  │   3D 角色   │  │   数据存储   │  │  实时通信   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                            │                    │
                            ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Cloud Backend Layer                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Supabase   │  │  Clawbot    │  │    Nginx    │              │
│  │  PostgreSQL │  │  Channel    │  │  反向代理   │              │
│  └─────────────┘  │   Server    │  └─────────────┘              │
│                   └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Local PC Gateway                             │
│  ┌─────────────┐  ┌─────────────┐                               │
│  │   Clawbot   │  │  OpenClaw   │                               │
│  │   Gateway   │  │   Monitor   │                               │
│  └─────────────┘  └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📱 前端架构 (React App)

### 技术栈选型

| 技术 | 选型 | 理由 |
|------|------|------|
| 框架 | React 19 | 最新特性，性能优化，并发渲染 |
| 构建 | Vite 6 | 快速 HMR，原生 ESM，优化生产构建 |
| 路由 | React Router v7 (HashRouter) | 移动端兼容，支持嵌套路由 |
| 状态 | React Context | 轻量级，避免过度工程化 |
| 数据库 | Supabase | 实时订阅，RLS 安全，内置认证 |
| 3D | Three.js | 成熟稳定，生态丰富 |
| 动画 | Framer Motion | 声明式 API，性能优秀 |
| 地图 | Leaflet | 轻量级，移动端友好 |
| 样式 | Tailwind CSS | CDN 模式，无构建依赖 |

### 目录结构设计原则

```
src/
├── screens/        # 页面组件（按路由组织）
├── components/     # 可复用 UI 组件
├── features/       # 功能模块（按业务领域组织）
│   ├── chat/      # 聊天功能
│   └── study/     # 学习功能
├── contexts/      # 全局状态管理
├── services/      # 业务逻辑层（API 封装）
├── hooks/         # 自定义 Hooks
├── config/        # 配置文件
└── types/         # TypeScript 类型定义
```

**设计原则**：
- **按功能组织**，而非按技术分层（features 目录）
- **页面与组件分离**（screens vs components）
- **业务逻辑抽离**（services 层）

### 三层布局架构

`App.tsx` 实现了独特的三层布局：

```tsx
// 背景层：固定全屏 3D 渲染
<HeroBackground />

// 内容层：可滚动页面
<Routes>
  <Route path="/" element={<Home />} />
  {/* ... */}
</Routes>

// 悬浮 UI 层：首页点击后显示
{!isHomePage && <GlassDock />}
```

**设计理由**：
- 沉浸式体验：首页无任何 UI 干扰
- 性能优化：背景层不参与滚动，避免重绘
- 统一管理：悬浮层状态集中控制

---

## 🔌 WebSocket 通信架构

### 连接架构

```
Mobile App ──Socket.io──> Clawbot Channel Server ──Webhook──> Local Clawbot Gateway
     │                         │                              │
     │         <──────────────────────────────────────────────┘
     │                    (HTTP POST)
     │
     └─> 本地开发时通过 Vite 代理访问 Gateway
```

### 握手协议 (Challenge-Response)

```typescript
// 1. 客户端连接
socket.emit('auth', { userId });

// 2. 服务端返回 challenge
socket.emit('challenge', { nonce: 'random123' });

// 3. 客户端响应
socket.emit('auth_response', {
  signature: hmac(nonce, SECRET_TOKEN)
});

// 4. 验证成功后建立连接
socket.emit('authenticated', { success: true });
```

**设计理由**：
- 防止未授权连接
- 避免明文传输密钥
- 支持重连时重新验证

### 消息流式处理

```typescript
// 增量消息处理
socket.on('message_delta', (delta) => {
  currentMessage += delta.content;
  updateUI(currentMessage); // 实时更新 UI
});
```

**优势**：
- 降低首字延迟 (TTFT)
- 提升用户体验
- 支持超长消息流式传输

---

## 🗄️ 数据库架构 (Supabase)

### 表结构设计

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `users` | 用户信息 | id, email, avatar_url |
| `friends` | 好友关系 | user_id, friend_id, status |
| `chat_messages` | 聊天记录 | id, sender_id, content, created_at |
| `unread_counts` | 未读计数 | user_id, friend_id, count |
| `notifications` | 系统通知 | id, user_id, content, read |
| `mails` | 邮件消息 | id, user_id, subject, body |
| `study_sessions` | 学习记录 | id, user_id, duration, started_at |
| `study_rooms` | 虚拟自习室 | id, name, max_members |
| `study_room_members` | 自习室成员 | room_id, user_id, joined_at |

### RLS (Row Level Security) 策略

**开发模式**（当前）：
```sql
-- 全开放，仅用于开发
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Development mode" ON users
  FOR ALL USING (true);
```

**生产模式**（待实施）：
```sql
-- 用户只能访问自己的数据
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

-- 好友关系必须双向确认
CREATE POLICY "Friends must be mutual" ON friends
  FOR ALL USING (
    user_id = auth.uid() OR
    friend_id = auth.uid()
  );
```

### 实时订阅架构

```typescript
// 订阅新消息
const channel = supabase
  .channel('chat_changes')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'chat_messages',
      filter: `receiver_id=eq.${userId}`
    },
    (payload) => handleNewMessage(payload.new)
  )
  .subscribe();
```

**设计理由**：
- WebSocket 长连接，低延迟
- 服务端推送，无需轮询
- 自动断线重连

---

## 🚀 后端架构 (Clawbot Channel Server)

### 技术栈

| 技术 | 用途 | 理由 |
|------|------|------|
| Node.js + Express | HTTP 服务 | 轻量级，生态丰富 |
| Socket.io | WebSocket 服务 | 自动降级，跨浏览器 |
| SQLite | 数据存储 | 零配置，单文件部署 |
| PM2 | 进程管理 | 自动重启，日志管理 |

### 服务端事件流

```
App 连接              配对流程                消息转发
    │                    │                       │
    ├─ app_register ──>  │                       │
    │                    │                       │
    ├─ request_pairing ─>│──> 生成配对码/Token   │
    │<─ pairing_success ─┤                       │
    │                    │                       │
Clawbot 连接             │                       │
    │                    │                       │
    ├─ bot_connect ────> │──> 验证配对关系       │
    │                    │                       │
    │                    ◄──── 消息转发 ─────────┤
    │                    │                       │
```

### 配对机制

**方式一：配对码**
```
1. App 请求配对 → 生成 6 位随机码
2. Clawbot 扫码/输入配对码
3. 验证成功 → 建立持久关系
```

**方式二：Token**
```
1. App 请求配对 → 生成 UUID Token
2. 生成二维码
3. Clawbot 扫码 → 自动配对
```

---

## 🔐 安全架构

### 认证流程

```
┌─────────────┐     Supabase Auth      ┌─────────────┐
│   Mobile    │ ──────────────────────> │  Supabase   │
│     App     │ <────────────────────── │   Cloud     │
└─────────────┘    Session Token       └─────────────┘
       │                                       │
       │    JWT Token                          │
       ├──────────────────────────────────────>│
       │                                       │
       ▼                                       ▼
┌─────────────────────────────────────────────────────┐
│              WebSocket Authentication                │
│  ┌───────────────────────────────────────────────┐  │
│  │  Challenge-Response Handshake (HMAC-SHA256)  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 安全措施

| 威胁 | 防护措施 |
|------|----------|
| 未授权访问 | JWT 认证 + HMAC 握手 |
| 中间人攻击 | HTTPS + WSS (生产环境) |
| SQL 注入 | Supabase 参数化查询 |
| XSS 攻击 | React 自动转义 + CSP 头 |
| CSRF 攻击 | SameSite Cookie + Token 验证 |

---

## 📊 性能优化策略

### 前端优化

1. **代码分割**：
   ```typescript
   const Home = lazy(() => import('./screens/Home'));
   const Chat = lazy(() => import('./screens/Chat'));
   ```

2. **虚拟列表**：长列表使用 react-window

3. **图片优化**：
   - WebP 格式
   - 懒加载
   - 响应式尺寸

4. **缓存策略**：
   - Service Worker (待实施)
   - LocalStorage 静态数据
   - IndexDB 离线存储

### 后端优化

1. **连接池**：SQLite + better-sqlite3

2. **消息队列**：内存队列 + 批量写入

3. **心跳优化**：动态间隔（根据网络状况调整）

---

## 🔄 部署架构

### 生产环境拓扑

```
                    ┌─────────────────┐
                    │   Cloudflare    │
                    │    (CDN/DNS)    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │     Nginx       │
                    │  (反向代理/SSL)  │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌────────▼─────────┐  ┌──────▼───────┐
│  React Build   │  │  Clawbot Channel │  │   Supabase   │
│  (静态文件)     │  │     Server       │  │   Cloud      │
└────────────────┘  └──────────────────┘  └──────────────┘
```

### CI/CD 流程

```yaml
# .github/workflows/deploy.yml
on: push to main
  ↓
1. 运行测试 (Vitest)
  ↓
2. 构建生产版本 (Vite Build)
  ↓
3. 部署到服务器 (rsync + pm2 reload)
  ↓
4. 健康检查 (curl /health)
```

---

## 🎨 UI/UX 架构

### 设计系统

```typescript
// 毛玻璃组件体系
<GlassPanel>  // 通用容器
<GlassDock>   // 底部导航
<GlassModal>  // 弹窗面板
```

### 动画系统

```typescript
// Framer Motion 配置
const variants = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },
  slideUp: {
    initial: { y: 100, opacity: 0 },
    animate: { y: 0, opacity: 1 }
  }
};
```

---

## 🧪 测试策略

### 测试金字塔

```
        ┌─────────┐
       /  E2E    \      Playwright - 关键用户流程
      /───────────\     (配对、聊天、学习计时)
     /    集成测试  \    Vitest + Supabase Mock
    /────────────────\   (API 层、WebSocket)
   /    单元测试      \  Vitest
  /─────────────────────\ (工具函数、Hooks)
```

### 覆盖率目标

- **单元测试**：80%+
- **集成测试**：60%+
- **E2E 测试**：关键流程 100%

---

## 📝 架构决策记录 (ADRs)

### ADR-001: 选择 Supabase 而非 Firebase

**状态**：已采纳

**上下文**：需要实时数据库、认证、存储

**决策**：
- ✅ PostgreSQL 比 NoSQL 更适合关系型数据
- ✅ RLS 提供细粒度权限控制
- ✅ SQL 查询能力更强
- ❌ 生态不如 Firebase 成熟

**后果**：
- 需要学习 Supabase 特定 API
- 迁移成本相对较高

### ADR-002: 使用 HashRouter 而非 BrowserRouter

**状态**：已采纳

**上下文**：移动端部署环境不可控

**决策**：
- ✅ 无需服务器配置
- ✅ 支持本地文件访问
- ✅ 更好的移动端兼容性
- ❌ URL 不够美观（包含 #）

### ADR-003: WebSocket 握手使用 Challenge-Response

**状态**：已采纳

**上下文**：防止未授权连接

**决策**：
- ✅ 避免密钥明文传输
- ✅ 防重放攻击
- ✅ 支持临时 Token
- ❌ 增加连接复杂度

---

## 🔮 未来规划

### 短期 (1-3 月)

- [ ] 实施生产环境 RLS 策略
- [ ] 添加 E2E 测试覆盖
- [ ] 优化首屏加载时间
- [ ] 支持离线模式

### 中期 (3-6 月)

- [ ] 多用户切换系统
- [ ] 语音识别集成
- [ ] 3D 角色动画优化
- [ ] 消息端到端加密

### 长期 (6-12 月)

- [ ] 原生 App (React Native)
- [ ] 国际化 (i18n)
- [ ] 插件系统
- [ ] 开放 API 平台

---

## 📚 参考资源

- [Supabase 文档](https://supabase.com/docs)
- [Socket.io 文档](https://socket.io/docs)
- [React Router v7](https://reactrouter.com)
- [Three.js 示例](https://threejs.org/examples)
- [Framer Motion API](https://www.framer.com/motion)

---

**最后更新**：2026-02-21
**维护者**：Claude + 用户协作
**版本**：1.0
