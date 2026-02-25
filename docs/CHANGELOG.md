# TRIX 3D Companion 开发迭代日志

> 记录项目演进历程，帮助理解架构决策和技术选型

---

## 📅 2026-02-25 - TypeScript 类型安全重构

### 背景
代码审查发现 47 处 `any` 类型使用，存在类型安全隐患。同时 Logger 工具存在大量重复代码。

### 目标
消除所有 `any` 类型，提升类型安全性，重构重复代码，并确保所有功能不受影响。

### 完成内容

#### 1. Logger 重构 (批次 1)
- 使用工厂函数 `createModuleLogger` 消除 80+ 行重复代码
- 将 `any[]` 改为 `unknown[]` 提升类型安全
- 保持向后兼容性，所有模块日志正常输出

#### 2. 错误类型改进 (批次 2)
- 添加 `hasErrorMessage()` 和 `getErrorMessage()` 类型守卫函数
- 将 11 个组件中的 `catch (error: any)` 改为 `catch (error: unknown)`
- 确保错误信息安全访问

#### 3. Socket 事件类型定义 (批次 3)
- 定义 `SocketEvents` 接口规范事件格式
- 定义 `ErrorPayload` 接口规范错误格式
- 定义 `EventCallback<T>` 泛型支持多种事件
- 消除 ClawbotChannelBridge 中的 7 处 `any` 类型

#### 4. databaseService 类型改进 (批次 4)
- `normalizeClawbotHistoryMessage(raw: any)` 改为 `raw: unknown`
- 添加内联 `FriendStudyUpdateData` 类型
- 修复 3 处 `any` 类型

#### 5. ConnectionManager 类型改进 (批次 5)
- 回调函数参数从 `any` 改为 `unknown`
- 监听器 Map 类型改进
- 修复 7 处 `any` 类型

#### 6. ClawbotChannelContext 类型改进 (批次 6)
- 导入并使用 SocketEvents 和 ErrorPayload 类型
- 添加内联 `MissedMessageResponse` 类型
- 修复 6 处 `any` 类型

#### 7. 剩余类型修复 (批次 7)
- StorageService: `value: any` → `value: unknown`
- pointsService: `metadata: any` → `metadata: Record<string, unknown>`
- ChatDetail: `metadata?: any` → `metadata?: Record<string, unknown>`
- supabase: `avatar_config?: any` → `avatar_config?: Record<string, unknown>`
- Study: `let interval: any` → `let interval: ReturnType<typeof setInterval> | null`

#### 8. E2E 测试类型改进
- 将 `browser: any` 改为 `Browser` 类型
- 将 `page: any` 改为 `Page` 类型
- 从 `@playwright/test` 导入类型

### 测试覆盖
- ✅ 115 个单元测试全部通过
- ✅ 11 个 E2E 测试全部通过
- ✅ 类型检查无错误
- ✅ 0 个 `any` 类型残留

### Git 提交记录
- edc2252: refactor: 重构 Logger 工具消除重复代码
- b56f7cc: refactor: React 错误类型 any 改为 unknown
- befab11: refactor: 定义 Socket 事件类型消除 any
- 7d165dc: refactor: databaseService 类型改进消除 any
- 239fd9d: refactor: ConnectionManager 类型改进消除 any
- 0432d17: refactor: ClawbotChannelContext 类型改进消除 any
- b577390: refactor: 修复剩余 5 处 any 类型
- 734d202: test: 添加 Playwright E2E 测试
- 8efb883: test: 添加完整的 E2E 测试套件
- 7151e15: test: E2E测试类型改进 - 移除any类型

### 质量提升
- 类型安全性显著提升
- 代码重复率降低
- 测试覆盖率提升
- 为后续大文件拆分奠定基础

---

## 📅 2026-02-11 - Clawbot 集成优化

### 背景
原集成方式需要手动配置 WebSocket URL 和 Token，用户体验不佳。

### 目标
实现扫码配对功能（电脑生成二维码，手机扫描），简化连接流程。

### 决策

#### 1. 配对流程选择
**方案对比**：

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| 手机生成二维码 | 实现简单 | 电脑需要扫码，不便 | ❌ |
| **电脑生成二维码** | 体验好，类似微信/Telegram | 需要电脑端显示功能 | ✅ |

**最终选择**：电脑端 Gateway 生成二维码 → 手机扫描配对

#### 2. 实现方案分级
为满足不同场景需求，提供两个版本：

| 特性 | 简化版 | 完整版 |
|------|--------|--------|
| 代码量 | ~150行 | ~500行 |
| 自动重连 | ❌ | ✅ |
| 心跳机制 | ❌ | ✅ |
| 消息队列 | ❌ | ✅ |
| 适用场景 | 开发测试 | 生产环境 |

#### 3. 安全隔离方案

**层级设计**：

```
Level 1: 设备隔离 - 每个设备独立 Token
Level 2: 权限管理 - basic/full/admin 三级权限
Level 3: 网络隔离 - 限制局域网访问
Level 4: 会话隔离 - 独立消息队列
Level 5: 审计日志 - 完整操作记录
```

### 文档产出

1. **[CLAWBOT_QUICK_START.md](./CLAWBOT_QUICK_START.md)** - 快速开始指南
2. **[CLAWBOT_SIMPLE_IMPLEMENTATION.md](./CLAWBOT_SIMPLE_IMPLEMENTATION.md)** - 简化版实现
3. **[CLAWBOT_INTEGRATION_GUIDE.md](./CLAWBOT_INTEGRATION_GUIDE.md)** - 完整版实现
4. **[CLAWBOT_GATEWAY_INTEGRATION.md](./CLAWBOT_GATEWAY_INTEGRATION.md)** - 协议规范
5. **[CLAWBOT_README.md](./CLAWBOT_README.md)** - 文档索引

---

## 📅 2026-02-10 - 数据库架构优化

### 背景
原数据库查询散落在代码各处，缺乏统一管理，难以维护。

### 决策

#### 1. 集中化数据访问
创建 `databaseService.ts` 统一管理所有数据库操作：

```typescript
// 之前：散落在各组件
const { data } = await supabase.from('friends').select('*');

// 之后：统一服务层
const friends = await databaseService.getFriends(userId);
```

#### 2. 视图优化
创建 `friend_latest_messages` 视图，简化好友列表查询：

**之前**：多次 JOIN 查询
**之后**：单次视图查询

```sql
CREATE VIEW friend_latest_messages AS
SELECT
  f.user_id,
  f.friend_id,
  p.username as name,
  p.avatar_url,
  f.status,
  COALESCE(uc.unread_count, 0) as unread_count,
  uc.last_message,
  uc.last_message_time
FROM friends f
LEFT JOIN profiles p ON f.friend_id = p.id
LEFT JOIN unread_counts uc ON f.user_id = uc.user_id AND f.friend_id = uc.friend_id;
```

### 文档产出
**[DATABASE-REQUIREMENTS.md](./DATABASE-REQUIREMENTS.md)** - 完整数据访问清单

---

## 📅 2026-02-09 - 三层布局架构

### 背景
需要实现"Zero UI"理念，首页仅展示 3D 角色，点击后显示导航。

### 决策

#### 布局方案

**采用三层架构**：

```tsx
<App>
  <HeroBackground />     {/* 背景层：3D 角色 */}
  <Routes />              {/* 内容层：页面内容 */}
  <GlassDock />           {/* 悬浮层：导航栏 */}
</App>
```

**关键实现**：
- `HeroBackground`: `position: fixed` 全屏固定
- `Routes`: 首页透明，其他页面正常
- `GlassDock`: 首页点击后显示，其他页面常驻

#### 视觉效果
- 毛玻璃效果 (`backdrop-filter: blur`)
- 渐变边框 (`border-image`)
- 平滑动画 (`framer-motion`)

---

## 📅 2026-02-08 - WebSocket 流式响应

### 背景
需要实现类似 ChatGPT 的流式 AI 响应效果。

### 决策

#### 流式处理

**协议设计**：

```json
// 增量响应
{"type": "res", "payload": {"stream": "assistant", "data": {"delta": "你"}}}
{"type": "res", "payload": {"stream": "assistant", "data": {"delta": "好"}}}
{"type": "res", "payload": {"stream": "assistant", "data": {"delta": "！"}}}

// 结束标记
{"type": "res", "payload": {"stream": "assistant", "data": {"delta": "", "finishReason": "stop"}}}
```

**实现代码**：

```typescript
const [fullResponse, setFullResponse] = useState('');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.payload?.stream === 'assistant') {
    const delta = message.payload.data?.delta || '';
    setFullResponse(prev => prev + delta);
  }
};
```

#### 握手认证

采用 challenge-response 模式：

1. 客户端连接
2. 服务端返回挑战 nonce
3. 客户端用 Token 签名响应
4. 服务端验证后建立连接

---

## 📅 2026-02-07 - Supabase Realtime 集成

### 背景
需要实现实时消息推送和未读计数更新。

### 决策

#### Realtime 订阅

**订阅三个表**：

```typescript
// 1. 聊天消息
supabase.channel('chat')
  .on('INSERT', { schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${convId}` }, payload => {
    // 新消息推送
  })
  .subscribe();

// 2. 未读计数
supabase.channel('unread')
  .on('*', { schema: 'public', table: 'unread_counts', filter: `user_id=eq.${userId}` }, payload => {
    // 未读数更新
  })
  .subscribe();

// 3. 通知
supabase.channel('notifications')
  .on('*', { schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, payload => {
    // 新通知推送
  })
  .subscribe();
```

---

## 📅 2026-02-06 - 技术栈选型

### 背景
项目启动，需要选择合适的技术栈。

### 决策

#### 核心技术

| 技术 | 版本 | 选择理由 |
|------|------|----------|
| React | 19.2.4 | 最新稳定版，支持 Concurrent Features |
| TypeScript | 5.8.2 | 类型安全，提升代码质量 |
| Vite | 6.2.0 | 极速开发体验，原生 ESM |
| Supabase | 最新 | 开源 Firebase 替代，PostgreSQL + Realtime |
| Tailwind CSS | CDN | 快速原型开发，无需构建 |
| Framer Motion | 12.33.0 | 声明式动画，性能优秀 |

#### 为什么不用 React Native？

| 对比项 | React Native | Web (PWA) |
|--------|--------------|------------|
| 开发效率 | 需要原生调试 | 浏览器直接调试 |
| 热更新 | 需要审核 | 即时更新 |
| 跨平台 | 需要适配 iOS/Android | 一次编写，多端运行 |
| 性能 | 接近原生 | 足够使用 |

**结论**：采用 Web 方案，通过 PWA 接近原生体验。

---

## 🎯 未来计划

### 短期（1-2周）
- [ ] 完成数据库迁移（NotificationPanel、StudyRoom）
- [ ] 实现扫码配对功能
- [ ] 优化 WebSocket 自动重连

### 中期（1-2月）
- [ ] 添加双向自习功能
- [ ] 实现语音输入（Web Speech API）
- [ ] 优化 3D 角色渲染性能

### 长期（3-6月）
- [ ] PWA 离线支持
- [ ] 推送通知
- [ ] 多人实时协作

---

**维护者**: TRIX 3D Companion 开发团队
**最后更新**: 2026-02-11
