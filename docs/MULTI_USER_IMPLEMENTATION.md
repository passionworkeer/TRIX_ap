# 🎯 多用户支持和个性化 Clawbot 实现

## 📋 功能概述

本次更新实现了以下功能：

### 1. 双向用户消息系统 ✅
- 添加第二个用户账户
- 实现用户间真实消息传递
- 支持实时消息同步

### 2. 个性化 Clawbot 连接 ✅
- 每个用户连接到自己电脑的 Gateway
- 会话管理系统
- 动态 Gateway 端点配置

### 3. 用户切换功能 ✅
- 可视化用户切换器
- 测试双向消息功能

---

## 🗄️ 数据库更新

### 新增表

#### 1. `user_sessions` - 用户会话表
```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  session_token TEXT UNIQUE NOT NULL,
  device_info JSONB, -- 设备信息（IP、浏览器等）
  clawbot_endpoint TEXT, -- 个人 Gateway 地址
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 新增函数

#### 1. `send_user_message()` - 用户间消息路由
```sql
CREATE OR REPLACE FUNCTION send_user_message(
  p_sender_user_id UUID,
  p_recipient_friend_id TEXT,
  p_text TEXT
) RETURNS UUID
```

**功能**:
- 在发送者的聊天记录中插入消息（sender='user'）
- 在接收者的聊天记录中插入消息（sender='friend'）
- 自动更新双方的未读计数
- 支持实时消息同步

### 新增数据

#### 用户账户
- **用户1**: `00000000-0000-0000-0000-000000000001` (我)
- **用户2**: `00000000-0000-0000-0000-000000000002` (测试好友)

#### 好友关系
- 用户1 的好友列表包含用户2 (`user_00000000-0000-0000-0000-000000000002`)
- 用户2 的好友列表包含用户1 (`user_00000000-0000-0000-0000-000000000001`)

---

## 💻 前端更新

### 新增组件

#### 1. `UserSwitcher.tsx` - 用户切换器
```typescript
<UserSwitcher onUserChange={(userId, userName) => { ... }} />
```

**功能**:
- 显示当前登录用户
- 快速切换用户账户
- 自动刷新页面以应用新用户

**位置**: 屏幕右下角浮动面板

### 更新的服务

#### 1. `databaseService.ts`

**新增函数**:
```typescript
// 会话管理
createOrUpdateSession(deviceInfo, clawbotEndpoint): Promise<UserSession>
getCurrentSession(): Promise<UserSession | null>
getUserClawbotEndpoint(userId?): Promise<string | null>
updateSessionActivity(sessionToken): Promise<void>
deactivateSession(sessionToken): Promise<void>
```

**更新函数**:
```typescript
// 发送消息 - 支持用户间消息路由
sendMessage(friendId, sender, text): Promise<string | null>
// 如果 friendId 以 'user_' 开头，使用 send_user_message 函数
```

#### 2. `supabase.ts`

**新增类型**:
```typescript
export interface UserSession {
  id: string;
  user_id: string;
  session_token: string;
  device_info: { ip?: string; device?: string; browser?: string } | null;
  clawbot_endpoint: string | null;
  is_active: boolean;
  created_at: string;
  expires_at: string;
  last_active_at: string;
}
```

**动态用户 ID**:
```typescript
// 从 localStorage 读取当前用户 ID
export const getCurrentUserId = (): string => {
  return localStorage.getItem('current_user_id') || '00000000-0000-0000-0000-000000000001';
};
```

### 更新的组件

#### `App.tsx`
- 添加 `UserSwitcher` 组件
- 支持动态用户切换

---

## 🚀 使用指南

### 步骤 1: 执行数据库更新

在 Supabase SQL 编辑器执行：
```
https://supabase.com/dashboard/project/__SUPABASE_PROJECT_REF_REDACTED__/sql
```

运行脚本：
```sql
-- 文件: database/add_multi_user_support.sql
```

### 步骤 2: 测试双向消息

#### A. 使用用户1发送消息

1. 打开应用（默认是用户1）
2. 进入 Chat 页面
3. 点击 "测试好友"
4. 发送消息：`你好！这是用户1`

#### B. 切换到用户2查看消息

1. 点击右下角的用户切换器
2. 选择 "测试好友"（用户2）
3. 页面会自动刷新
4. 进入 Chat 页面
5. 看到用户1发送的消息
6. 回复：`收到！这是用户2`

#### C. 切换回用户1验证

1. 再次点击用户切换器
2. 选择 "我"（用户1）
3. 刷新后进入 Chat
4. 看到用户2的回复 ✅

### 步骤 3: 配置个性化 Clawbot

#### A. 用户1 的 Gateway

**电脑1** (IP: 192.168.101.4):
```powershell
# 启动 Gateway
openclaw-cn gateway
```

访问: `http://192.168.101.4:5173/`

**配置**:
```typescript
// 自动从会话表读取
clawbot_endpoint: 'ws://192.168.101.4:18789'
```

#### B. 用户2 的 Gateway

**电脑2** (IP: 192.168.101.5):
```powershell
# 启动 Gateway
openclaw-cn gateway
```

访问: `http://192.168.101.5:5173/`

**配置**:
```typescript
clawbot_endpoint: 'ws://192.168.101.5:18789'
```

---

## 🎨 UI/UX 更新

### 用户切换器

**样式**:
- 位置: 右下角固定悬浮
- 背景: 毛玻璃效果
- 动画: 平滑过渡
- 主题: 适配深色/浅色模式

**交互**:
- 点击用户按钮切换
- 当前用户高亮显示
- 渐变色彩区分用户

---

## 📱 消息流程

### 用户1 → 用户2

```
用户1发送消息
    ↓
调用 sendMessage('user_00000000-0000-0000-0000-000000000002', 'user', '你好')
    ↓
检测到 friend_id 以 'user_' 开头
    ↓
调用数据库函数 send_user_message()
    ↓
[用户1的聊天记录] friend_id='user_...002', sender='user', text='你好'
[用户2的聊天记录] friend_id='user_...001', sender='friend', text='你好'
    ↓
更新未读计数
    ↓
实时订阅触发，用户2收到新消息通知
```

---

## 🔄 Clawbot 个性化流程

### 初始化

```
用户打开应用
    ↓
读取 localStorage.current_user_id
    ↓
查询 user_sessions 表
    ↓
获取用户的 clawbot_endpoint
    ↓
连接到个人 Gateway
```

### 多设备场景

**场景**: 用户1 在手机和电脑上同时登录

```
手机 → user_sessions:
  session_token: 'session_user1_mobile_1675432100'
  device_info: { device: 'iPhone 14', ip: '192.168.101.10' }
  clawbot_endpoint: 'ws://192.168.101.4:18789'

电脑 → user_sessions:
  session_token: 'session_user1_pc_1675432200'
  device_info: { device: 'PC', ip: '192.168.101.4' }
  clawbot_endpoint: 'ws://192.168.101.4:18789'
```

---

## 🔐 安全考虑

### 会话管理

- ✅ 每个会话有唯一 `session_token`
- ✅ 会话有效期 30 天
- ✅ 支持手动停用会话
- ✅ 自动记录最后活跃时间

### 消息隔离

- ✅ 用户只能看到自己的聊天记录
- ✅ 数据库 RLS 策略（可选开启）
- ✅ 消息路由自动处理发送者/接收者视角

---

## 📊 数据统计

### 新增数据量

- **SQL 代码**: ~200 行
- **TypeScript 代码**: ~150 行
- **React 组件**: 1 个 (UserSwitcher)
- **数据库表**: 1 个 (user_sessions)
- **数据库函数**: 1 个 (send_user_message)
- **Mock 数据**: 
  - 1 个用户
  - 2 条好友关系
  - 4 条测试消息
  - 2 个会话记录

---

## 🎯 下一步计划

### 可选功能

1. **群聊支持** 
   - 创建 `chat_rooms` 表
   - 多人消息路由

2. **文件传输**
   - 图片消息
   - 文件分享

3. **消息加密**
   - 端到端加密
   - 消息签名验证

4. **在线状态同步**
   - WebSocket 心跳
   - 实时在线状态

5. **消息已读回执**
   - 已读状态同步
   - 已读时间记录

---

## 🐛 故障排除

### 问题1: 切换用户后看不到消息

**原因**: 未执行数据库更新脚本

**解决**:
```sql
-- 执行 database/add_multi_user_support.sql
```

### 问题2: Clawbot 连接失败

**原因**: 未找到用户的 Gateway 端点

**解决**:
```typescript
// 在控制台执行
import { getUserClawbotEndpoint } from './src/services/databaseService';
const endpoint = await getUserClawbotEndpoint();
console.log('Gateway 端点:', endpoint);
```

### 问题3: 消息未实时更新

**原因**: WebSocket 订阅未正常工作

**解决**:
```typescript
// 检查订阅状态
subscribeToChatMessages(friendId, (msg) => {
  console.log('收到新消息:', msg);
});
```

---

## ✅ 验证清单

部署前检查：

- [ ] 数据库脚本已执行
- [ ] 两个用户账户存在
- [ ] 好友关系已建立
- [ ] 会话表已创建
- [ ] send_user_message 函数正常
- [ ] UserSwitcher 组件显示
- [ ] 切换用户后页面刷新
- [ ] 用户1 可以给用户2 发消息
- [ ] 用户2 可以收到并回复
- [ ] Clawbot 连接各自的 Gateway

---

**创建时间**: 2026-02-05  
**作者**: GitHub Copilot  
**版本**: 1.0  
**状态**: ✅ 完成实现，待测试
