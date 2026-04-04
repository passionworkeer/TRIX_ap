# TRIX3D 后端 API 文档

> 版本: 1.4.0
> **最后更新**: 2026-04-04（内容已审阅；精简 TRIX Native Server API，完整文档见 `../TRIX_NATIVE_CHANNEL.md`）

---

## 目录

1. [概述](#概述)
2. [基础配置](#基础配置)
3. [认证](#认证)
4. [API 端点列表](#api-端点列表)
5. [TRIX Native Server API](#trix-native-server-api)
6. [响应格式](#响应格式)
7. [错误码](#错误码)
8. [数据库表结构](#数据库表结构)

---

## 概述

本 API 为 TRIX3D 应用提供后端服务，支持用户管理、社交、学习、商城等功能。

### 服务端口

| 环境 | 服务 | URL |
|------|------|-----|
| ~~开发环境~~ | ~~Clawbot Channel~~ | ~~已废弃~~ |
| ~~生产环境~~ | ~~Clawbot Channel~~ | ~~已废弃~~ |
| 开发环境 | TRIX Native | `http://TRIX_SERVER_HOST:8788/api` |
| 生产环境 | TRIX Native | `https://trix-native.trix3d.com/api` |

### 请求头

```http
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

---

## 认证

### 认证方式

所有需要认证的 API 端点都必须在请求头中携带 JWT Token：

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Token 通过 Supabase Auth 获取。

### 可选认证

部分端点支持可选认证（带 Token 返回用户专属数据，不带返回公开数据）：

- `GET /mall/items`
- `GET /places/nearby`
- `GET /places/search`

---

## API 端点列表

> ⚠️ **以下第 1-21 节描述的是 Supabase 直连客户端 API（已实现），不是 HTTP REST 端点。三端（Web/iOS/Desktop）均通过 `@supabase/supabase-js` 直连 PostgreSQL。TRIX Native Server（端口 8788）的真实 HTTP 端点见上方「二、TRIX Native Server API」节。**

---

## 三、API 架构概述

本应用存在**三层 API**，各有不同的访问方式：

| 层次 | 访问方式 | 说明 |
|------|---------|------|
| Supabase 服务层 | `@supabase/supabase-js` 直连 | Web/iOS/Desktop 三端共用，查询 PostgreSQL |
| TRIX Native Server | HTTP REST / WebSocket | 配对、消息、Study Room、TTS（端口 8788）|
| Desktop Electron IPC | `window.electronAPI.*()` | 仅桌面端，调用主进程功能 |

---

## 四、Supabase 服务层（已实现）

> 三端均通过 `@supabase/supabase-js` 直连 PostgreSQL，无需经过 HTTP REST 层。详见 `src/services/*.ts`。

### 环境配置

| 环境 | 服务 | URL |
|------|------|-----|
| 开发环境 | TRIX Native | `http://TRIX_SERVER_HOST:8788/api` |
| 生产环境 | TRIX Native | `https://trix-native.trix3d.com/api` |

### 客户端初始化

```typescript
// src/config/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
```

### 服务模块总览

| 模块 | 文件 | 主要操作 |
|------|------|---------|
| 好友 | `friendService.ts` | getFriends, addFriend, acceptFriendRequest, rejectFriendRequest |
| 聊天 | `chatService.ts` | getChatHistory, sendMessage, sendMessageWithMedia, markMessagesAsRead |
| 通知 | `notificationService.ts` | getNotifications, markNotificationAsRead, subscribeToNotifications |
| 学习会话 | `studySessionService.ts` | getStudySessions, createStudySession, getTodayStudyTime |
| 学习历史 | `studyHistoryService.ts` | getStudyHistory, getStudyStats, exportStudyData |
| 成就 | `achievementService.ts` | checkAndUnlockAchievements, getUserAchievements |
| 积分 | `pointsService.ts` | getUserPointsStats, addUserPoints, getPointsHistory, rewardStudyCompletion |
| 用户统计 | `userStatsService.ts` | getUserStats, updateUserStats |
| 商城 | `mallService.ts` | getMallItems, purchaseItem, getPurchaseHistory |
| 日程 | `scheduleService.ts` | getSchedules, createSchedule, updateSchedule, deleteSchedule |
| 待办 | `todoService.ts` | getTodos, createTodo, updateTodo, toggleTodoComplete |
| 衣橱 | `wardrobeService.ts` | getUserOutfits, equipOutfit, unequipOutfit |
| TRIX Native 客户端 | `TrixNativeChannelClient.ts` | connect, disconnect, sendMessage, subscribeToMessages, uploadAttachment |
| WebSocket 连接管理 | `ConnectionManager.ts` | connect, disconnect, send, subscribe, getStatus |
| TTS 语音合成 | `ttsService.ts` | synthesize, cancel, getVoices |
| 语音播放 | `voicePlaybackService.ts` | play, pause, stop, setVolume, onAudioUnlocked |
| 本地存储 | `storageService.ts` | get, set, remove, clear, has |
| 地点服务 | `placeService.ts` | getNearbyPlaces, searchPlaces, getPlaceDetails |
| 位置服务 | `locationService.ts` | getFriendsLocations, updateLocation, getLocationHistory |
| 百度地图 | `baiduMapService.ts` | getLocation, geocode, searchNearby |
| 文件上传 | `uploadService.ts` | upload, uploadWithProgress, cancel |
| OSS 上传 | `serverOssUploadService.ts` | uploadToOss, getSignedUrl |
| 数据库服务 | `databaseService.ts` | query, insert, update, delete, transaction |
| 会话服务 | `sessionService.ts` | createSession, getSession, updateSession |
| 项目服务 | `projectService.ts` | getProjects, createProject, updateProject |
| 爪牙历史 | `clawbotHistoryService.ts` | getHistory, saveHistory, exportHistory |

> 注：认证（登录/注册/登出）直接使用 Supabase Auth API (`supabase.auth.*`)，无需独立 service 文件。

### 辅助函数

```typescript
// src/config/supabase.ts
getCurrentUserId(): Promise<string>       // 获取当前登录用户 ID
updateLastActive(): Promise<boolean>      // 更新用户最后活跃时间
getUsersLastActive(userIds): Promise<Record<string, string | null>>  // 批量获取用户最后活跃时间
calculateOnlineStatus(lastActiveAt): UserOnlineStatus  // 计算在线状态
getOnlineStatusText(lastActiveAt): string  // 获取在线状态显示文本
```

---

## 五、TRIX Native Server API（已实现）

> 权威文档：`../TRIX_NATIVE_CHANNEL.md`
> 基础 URL：`http://TRIX_SERVER_HOST:8788/api`（开发）/ `https://trix-native.trix3d.com/api`（生产）

### 认证方式

```http
Authorization: Bearer <jwt_token>
x-trix-client-token: <client_token>  (部分端点)
```

### 端点列表

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/client/pair/code` | 通过配对码配对 |
| POST | `/api/client/pair/qr` | 通过 QR payload 配对 |
| POST | `/api/client/session/restore` | 恢复配对会话 |
| POST | `/api/client/session/bind` | 绑定到认证用户 |
| GET | `/api/client/status` | 检查配对状态 |
| DELETE | `/api/client/unpair` | 解除配对 |
| GET | `/api/conversations` | 获取会话列表 |
| GET | `/api/conversations/:id/messages` | 获取历史消息 |
| POST | `/api/messages` | 发送消息 |
| POST | `/api/uploads` | 上传附件/媒体 |
| POST | `/api/attachments` | 上传附件（含 kind 参数）|
| POST | `/api/study-room/create` | 创建学习房间 |
| POST | `/api/study-room/join` | 加入学习房间 |
| POST | `/api/study-room/leave` | 离开学习房间 |
| POST | `/api/study-room/host-action` | 主持人操作（开始/暂停/结束）|
| GET | `/api/study-room/state` | 获取房间状态 |
| POST | `/api/study-room/lookup-by-users` | 批量查询用户所在房间 |

### 响应格式

```json
{
  "success": true,
  "data": { ... }
}
```

### 错误代码

| 代码 | 说明 |
|------|------|
| 400 | 参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

---

## 六、Canvas Service API

> 独立 AI 画布服务，位于 `packages/trix-canvas-service/`。端口 8791，通过本地 relay (8788) 连接 MiniMax/apivyi 等生成服务。

### 服务地址

| 环境 | 地址 |
|------|------|
| 开发环境 | `http://localhost:8791` |
| Canvas UI | `http://localhost:8791/canvas?projectId=...` |

### 认证

默认只允许本机访问（回环地址）。如需外部访问，需设置 `CANVAS_REQUIRE_AUTH=true` 并配置 `CANVAS_ACCESS_TOKEN`。

### 端点列表

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/session` | 创建会话 / 提交 AI 生成任务 |
| GET | `/api/session/:id` | 查询会话状态和结果 |
| POST | `/api/session/change-project` | 创建或切换项目 |
| POST | `/api/file/upload` | 上传 base64 或 OSS 文件 |
| POST | `/api/projects` | 创建项目（供 Canvas Skill 调用）|
| GET | `/api/projects` | 获取项目列表 |
| GET | `/api/projects/:projectId` | 获取项目详情（含 nodes/edges/files/sessions）|
| GET | `/api/projects/:projectId/export/subtitle` | 导出 SRT + 脚本 |
| GET | `/api/projects/:projectId/export/video` | 拼接视频（需 FFmpeg）|
| GET | `/media/files/:filename` | 下载存储的图片/视频 |
| GET | `/health` | 健康检查 |

### 响应格式

```json
// GET /api/session/:id
{
  "data": {
    "sessionId": "uuid",
    "projectId": "uuid",
    "status": "completed" | "generating" | "error" | "pending",
    "taskId": "ai-task-id",
    "messages": [{ "role": "user"|"assistant", "content": "...", "timestamp": "..." }],
    "resultUrls": ["https://..."]
  }
}

// POST /api/session
{
  "data": {
    "projectUuid": "uuid",
    "sessionId": "uuid",
    "taskId": "ai-task-id",
    "projectUrl": "http://localhost:8791/canvas?projectId=..."
  }
}
```

---

## 七、Desktop Electron IPC API

> 适用于桌面端，通过 `window.electronAPI.*()` 调用主进程。详见 `desktop/src/types/electron.d.ts`。

### Supabase 认证

| 方法 | 描述 |
|------|------|
| `authGetSession()` | 获取当前会话 |
| `authSignIn(email, password)` | 登录 |
| `authSignUp(email, password, username?)` | 注册 |
| `authSignOut()` | 登出 |
| `authRefreshSession()` | 刷新会话 |
| `authSetSession(sessionData)` | 设置会话 |
| `profileUpdate(updates)` | 更新个人资料 |

### 学习数据

| 方法 | 描述 |
|------|------|
| `listTodos()` | 获取待办列表 |
| `createTodo(title, priority)` | 创建待办 |
| `toggleTodo(id, completed)` | 切换完成状态 |
| `deleteTodo(id)` | 删除待办 |
| `getAchievements()` | 获取成就列表 |
| `getProfileStats()` | 获取用户统计 |
| `createStudySession(subject?)` | 创建学习会话 |
| `updateStudySession(sessionId, duration)` | 更新学习会话 |
| `getStudyStats()` | 获取学习统计 |

### TRIX Native 消息

| 方法 | 描述 |
|------|------|
| `listConversations()` | 获取会话列表 |
| `fetchMessages(conversationId)` | 获取消息历史 |
| `sendMessage(conversationId, content)` | 发送文本消息 |
| `sendImageMessage(conversationId, payload)` | 发送图片消息 |
| `sendAttachmentMessage(conversationId, payload)` | 发送附件消息 |
| `sendReaction(messageId, emoji)` | 发送反应 |

### 学习房间

| 方法 | 描述 |
|------|------|
| `createStudyRoom(params)` | 创建房间 |
| `joinStudyRoom(roomCode, params)` | 加入房间 |
| `leaveStudyRoom(roomCode, userId)` | 离开房间 |
| `studyRoomHostAction(roomCode, params)` | 主持人操作 |
| `getStudyRoom(roomCode)` | 获取房间状态 |
| `lookupStudyRoomsByUsers(userIds)` | 批量查询用户房间 |

### Gateway

| 方法 | 描述 |
|------|------|
| `getGatewayStatus()` | 获取 Gateway 状态 |
| `gatewayStart()` | 启动 Gateway |
| `gatewayStop()` | 停止 Gateway |
| `gatewayHealth()` | Gateway 健康检查 |
| `gatewayDiagnose()` | Gateway 诊断 |
| `gatewayConnect()` | 连接 Gateway WebSocket |
| `gatewayAgents()` | 获取 AI Agent 列表 |
| `gatewaySessions()` | 获取会话列表 |
| `gatewayHealthRpc()` | 通过 RPC 获取完整健康数据 |
| `onGatewayEvent(callback)` | 订阅 Gateway 事件 |

### 第三方渠道

| 方法 | 描述 |
|------|------|
| `channelsConfigure(channel, config)` | 配置渠道 |
| `channelsList()` | 列出已配置渠道 |
| `channelsDelete(channel)` | 删除渠道 |
| `channelsTest(channel, config)` | 测试渠道配置 |
| `channelsStartListening(channel)` | 开始监听消息 |
| `channelsStopListening(channel)` | 停止监听 |
| `channelsGetMessages(channel, opts?)` | 获取历史消息 |
| `channelsSendMessage(channel, text, opts?)` | 发送消息 |

### 系统信息

| 方法 | 描述 |
|------|------|
| `getSystemInfo()` | 获取 CPU/内存/OS 信息 |
| `getDiskInfo()` | 获取磁盘信息 |
| `checkPackages()` | 检查第三方包状态 |

### OpenClaw

| 方法 | 描述 |
|------|------|
| `checkOpenClaw()` | 检查 OpenClaw 是否安装 |
| `installOpenClaw()` | 安装 OpenClaw |
| `runOpenClawDoctor()` | 运行诊断 |
| `runOpenClawCommand(cmd)` | 执行命令 |
| `listAgents()` | 列出 Agent |
| `listSkills()` | 列出已安装 Skill |
| `installSkill(name)` | 安装 Skill |
| `uninstallSkill(name)` | 卸载 Skill |
| `skillsListFull()` | 完整 Skill 列表（含来源）|
| `skillsSearch(query)` | 搜索 ClawHub |
| `skillsExplore()` | 浏览 ClawHub |

### 配对

| 方法 | 描述 |
|------|------|
| `createQrCode(label?)` | 创建配对二维码 |
| `createPairingQr(label?)` | 同上（别名）|
| `pollPairingStatus(code)` | 轮询配对状态 |
| `pairingGenerate()` | 生成配对码 |
| `pairingList()` | 列出配对码 |
| `pairingRevoke(code)` | 撤销配对码 |

### 窗口管理

| 方法 | 描述 |
|------|------|
| `showMainWindow()` | 显示主窗口 |
| `hideMainWindow()` | 隐藏主窗口 |
| `minimizeToTray()` | 最小化到托盘 |
| `windowMinimize()` | 最小化窗口 |
| `windowMaximize()` | 最大化窗口 |
| `windowIsMaximized()` | 查询最大化状态 |
| `windowResize({ width?, height? })` | 调整窗口大小 |
| `windowMove(x, y)` | 移动窗口 |
| `windowSetBounds(bounds)` | 设置窗口边界 |
| `windowGetBounds()` | 获取窗口边界 |
| `floatMove(x, y)` | 移动悬浮窗 |
| `floatGetPosition()` | 获取悬浮窗位置 |

### 偏好设置 / 通知 / 好友

| 方法 | 描述 |
|------|------|
| `preferencesGet()` | 获取偏好设置 |
| `preferencesSet(prefs)` | 保存偏好设置 |
| `friendsList()` | 获取好友列表 |
| `friendsAdd(friendUserId)` | 添加好友 |
| `friendsAccept(friendId)` | 接受好友请求 |
| `friendsRemove(friendId)` | 删除好友 |
| `notificationsList()` | 获取通知列表 |
| `notificationsMarkRead(id)` | 标记已读 |
| `notificationsMarkAllRead()` | 全部标记已读 |

---

## 更新日志

### 2026-03-29

- 更新版本号至 1.4.0
- 重写 API 端点列表，准确描述三层 API 架构
- 补充 Desktop Electron IPC API 完整端点列表
- 说明 Supabase 直连客户端 API 的实现方式
- 标记第 1-21 节为 Supabase 服务层描述（非 HTTP REST）
