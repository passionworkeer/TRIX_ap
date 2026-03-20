# 交付文档：稳定原生 `trix-native` 登录、图片、斜杠命令

**日期**: 2026-03-20
**变更范围**: Web Auth Session 稳定性 + 图片入站语义 + 斜杠命令路由 + 结构化日志

---

## 一、变更文件清单

### 1. `src/contexts/AuthContext.tsx` (112 行修改)

**问题**: `getSession()` 和 `onAuthStateChange('INITIAL_SESSION')` 同时触发 `upsertSession()`，导致 `profiles.active_session_id` 在被 `checkSessionValidity()` 检查时还未更新完，误判 mismatch → forceLogout。

**修改**:

| 位置 | 修改内容 |
|------|---------|
| `forceLogout()` 新签名 | 加 `localSessionId: string \| null` 参数，结构化日志 |
| `hasBootstrappedSessionRef` (ref) | 新增，防止 `getSession` + `INITIAL_SESSION` 双重调用 |
| `heartbeatIntervalRef` (ref) | 新增，替代闭包变量，确保 `onAuthStateChange` 回调可访问 |
| `startHeartbeat()` | 新抽取函数，幂等：调用前先清旧 interval |
| `getSession()` 分支 | 加 `!hasBootstrappedSessionRef.current` 守卫，只在这里调用一次 `upsertSession()` |
| `onAuthStateChange` 分流 | `INITIAL_SESSION`：仅恢复 profile + 启动心跳，不调 upsertSession<br>`SIGNED_IN`：调用 `upsertSession(userId, undefined, true)` 创建新会话<br>`TOKEN_REFRESHED`：仅 `updateLastActive()`，不重启心跳，不调 upsertSession |
| 清理函数 | 通过 `heartbeatIntervalRef` 停止心跳 |

**关键修复**: `hasBootstrappedSessionRef.current = true` 是**同步**操作，在 `upsertSession()` async 调用之前就置位，确保 `onAuthStateChange('INITIAL_SESSION')` 回调进来时看到 ref 已为 true，不会重复调用。

---

### 2. `src/services/sessionService.ts` (27 行修改)

**问题**: 日志不够结构化，无法从日志区分根因。

**修改**:

| 位置 | 修改内容 |
|------|---------|
| `upsertSession()` 新参数 | `forceCreateNew: boolean = false`，允许强制创建新会话（用于 `SIGNED_IN` 全新登录） |
| `upsertSession()` 结构化日志 | `[session] upsert start` → `[session] marked old sessions inactive` → `[session] upsert complete` |
| `checkSessionValidity()` mismatch 日志 | 改为 `logger.auth.warn('[session] mismatch detected', { localId, profileActiveId })` |

---

### 3. `packages/trix-openclaw-native/src/monitor.ts` (89 行修改)

**问题 1**: 图片入站优先拿公网签名 URL，`fetchRemoteMedia` 失败只能走文本摘要。

**问题 2**: 斜杠命令 `RawBody/CommandBody/BodyForAgent` 三者等价，没有命令语义。

**修改**:

| 位置 | 修改内容 |
|------|---------|
| 入站消息结构化日志 | `[trix-native] inbound message { hasAttachments, isSlashCommand }` |
| 斜杠命令检测 | `const isSlashCommand = rawText.startsWith('/')`，在正文+附件处理之前判定 |
| 斜杠命令路由 | `RawBody / CommandBody / BodyForCommands = RawText`，不加附件摘要污染；`CommandSource: 'text'` 传给 Gateway |
| 普通消息附件处理 | 优先用 `servicePath` + `Authorization: Bearer <serviceToken>` 直接下载；失败走摘要文本 fallback |
| 附件下载日志 | `[trix-native] inbound attachment fetch ok { mediaPath, usedServicePath }`<br>`[trix-native] inbound attachment fetch failed, using summary fallback { error }` |
| 回复成功日志 | `[trix-native] reply dispatch ok { conversationId }` |

---

### 4. `packages/trix-openclaw-native/src/normalize.ts` (1 行修改)

**修改**: `TrixInboundAttachment` 类型加 `servicePath?: string` 字段，接收服务端下发的服务面专用路径。

---

### 5. `packages/trix-openclaw-native/src/server/TrixNativeServer.ts` (82 行修改)

**问题**: 服务端缺乏结构化日志，无法观测登录踢人、图片失败、命令分发等事件。

**修改 — 新增日志点**:

| 事件 | 日志格式 |
|------|---------|
| HTTP 请求完成 | `[trix-native-server] request { method, path, status, durationMs, ip }` |
| Rate limit 触发 | `[trix-native-server] rate limit exceeded { scope, ip, subject }` |
| Pairing claim | `[trix-native-server] pairing claimed { code, clientId, deviceName, accountId, conversationId }` |
| 附件上传 | `[trix-native-server] attachment uploaded { attachmentId, kind, mimeType, sizeBytes, conversationId }` |
| 附件读取 | `[trix-native-server] attachment served { attachmentId, audience, fromPath }` |
| 用户消息创建 | `[trix-native-server] user message created { conversationId, senderId, hasAttachments, textLength, messageId }` |
| 服务消息创建 | `[trix-native-server] service message created { conversationId, accountId, hasAttachments, textLength, messageId }` |
| 客户端取消配对 | `[trix-native-server] client unpaired { clientId, conversationId }` |
| Socket 连接 | `[trix-native-server] socket connected { role, accountId, conversationId, clientId, ip }` |
| 服务 socket 连接 | `[trix-native-server] service socket connected { accountId, agentOnline }` |
| Socket 关闭 | `[trix-native-server] socket closed { role, accountId, code, reason }` |
| 广播 | `[trix-native-server] broadcast { envelopeType, targetRole, targetAccountId, sentCount, totalSockets }` |

**修改 — `serializeAttachmentForService()`**: 新增 `servicePath` 字段，指向 `/api/service/attachments/:id`，配合 Bearer token 无需签名。

### 6. `packages/trix-openclaw-native/test/monitor.test.ts` (新增)

**新增测试**:

| 场景 | 断言 |
|------|------|
| slash command 入站 | `RawBody / CommandBody / BodyForCommands / BodyForAgent` 保持 `/help` 原文 |
| servicePath 附件下载 | 插件通过 `Authorization: Bearer <serviceToken>` 拉取 `/api/service/attachments/:id`，且不再走 `fetchRemoteMedia(url)` 的公网签名 URL 路径 |

---

## 二、测试结果

### 原生插件包测试
命令:
```bash
npm --workspace packages/trix-openclaw-native test
```

结果:
```text
Test Files  5 passed (5)
Tests       22 passed (22)
```

### 原生插件包构建
命令:
```bash
npm --workspace packages/trix-openclaw-native run build
```

结果: 通过

### Web 认证 / 会话定向测试
命令:
```bash
npx vitest run src/services/sessionService.test.ts src/contexts/AuthContext.test.tsx
```

结果:
```
Test Files  2 passed (2)
Tests       38 passed | 4 skipped (42)
```

说明:
- `AuthContext` 测试在当前 mock 结构下会打印几条被捕获的 `upsertSession` 日志噪声，但测试本身是通过的，不是新的运行时失败。

---

## 三、未覆盖 / 待验证场景

以下为本次修改**仍未做真实端到端复放**的内容，需要在 `trix.love + 本机 OpenClaw Gateway` 环境下人工确认：

| 场景 | 状态 | 说明 |
|------|------|------|
| Web 登录后停留 > 3 分钟，`checkSessionValidity()` 不误踢 | **未验证** | 需要 Supabase 环境和真实会话数据 |
| Native channel 发图片后插件收到真实 `MediaPath` 并被 Gateway 使用 | **未验证** | 单测已覆盖 servicePath + Bearer 下载，尚未重放真实线上附件 |
| `/help` / `/status` 斜杠命令在 Trix 聊天里返回结果 | **未验证** | 单测已覆盖命令正文路由，尚未重放真实 Gateway 命令返回 |
| Pairing claim → 服务端日志正确输出 | **未验证** | 需要启动 `TrixNativeServer` 本地服务 |
| WS 断开重连后 session 不重新创建 | **未验证** | 依赖 AuthContext 修复逻辑，需集成测试 |

---

## 四、提交信息

```
fix: stabilize native trix channel — auth session, image inbound, slash commands
```

**推送**: 当前分支对应远端分支（用户确认后执行）

---

## 五、变更影响范围

| 模块 | 影响 |
|------|------|
| Web Auth | 修复了登录被误踢的根因 |
| TRIX Native Plugin | 图片入站改用 servicePath；斜杠命令有独立路由 |
| TRIX Native Server | 大量结构化日志；attachment 响应含 servicePath |
| 兼容性 | 向后兼容：旧客户端不发送 servicePath 时回退到现有逻辑 |
