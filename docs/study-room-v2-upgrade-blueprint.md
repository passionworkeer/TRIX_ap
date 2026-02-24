# 自习室 V2 升级蓝图

> **版本**: 1.0
> **日期**: 2026-02-24
> **作者**: Claude Code
> **状态**: 计划阶段

---

## 📊 现状诊断

### ✅ 当前功能盘点

| 模块 | 功能 | 实现状态 | 技术方案 |
|------|------|----------|----------|
| **单人自习** | 计时器核心循环 | ✅ 完整 | React `setInterval` ([Study.tsx:336-358](../src/screens/Study.tsx#L336-L358)) |
| | 时长选择（25/45/60分钟） | ✅ 完整 | `DurationSelector` 组件 |
| | 专注时长计算 | ✅ 完整 | `focusStartTime` 追踪 |
| | 积分奖励（每分钟2分） | ✅ 完整 | `rewardStudyCompletion()` |
| | 累计时长统计 | ✅ 完整 | `profiles.total_study_time` |
| | 结算弹窗 | ✅ 完整 | `SummaryModal` 组件 |
| | 浏览器关闭清理 | ✅ 完整 | `beforeunload` 事件 |
| **好友自习** | 好友列表查询 | ✅ 完整 | Supabase `friends` + `profiles` |
| | 实时状态更新 | ✅ 完整 | Supabase Realtime 订阅 |
| | 专注状态显示 | ✅ 完整 | 绿色脉冲指示器 |
| **多人房间** | 房间码生成 | ✅ 完整 | 后端 4-8 位随机码 |
| | 创建/加入房间 | ✅ 完整 | `ClawbotChannelBridge` |
| | 成员列表显示 | ✅ 完整 | 网格布局（最多 5 人） |
| | 房主标识 | ✅ 完整 | Crown 图标 |
| | 状态实时同步 | ✅ 完整 | Socket.IO `study_room_state` |
| | 房主控制台 | ✅ 完整 | 开始/暂停/结束按钮 |
| | 离开房间 | ✅ 完整 | `leaveStudyRoom()` |

### 🔄 需要迁移的逻辑

| 当前实现 | 迁移方案 | 优先级 |
|---------|---------|--------|
| `companion_id` 双向关联（Supabase） | WebSocket 房间成员列表 | 🔴 高 |
| `fetchCompanionInfo()` 轮询 | WebSocket 状态推送 | 🔴 高 |
| Supabase Realtime 订阅 | Socket.IO 事件监听 | 🔴 高 |
| `is_studying` 状态写入 | 房间状态同步 | 🟡 中 |
| StudyBuddiesList 查询 | 房间成员 + 好友混合查询 | 🟡 中 |

### 🛡️ 必须保留的核心逻辑

| 逻辑 | 代码位置 | 原因 |
|------|---------|------|
| **本地计时器循环** | [Study.tsx:336-358](../src/screens/Study.tsx#L336-L358) | 与房间状态解耦，用户本地 UI 驱动 |
| **时长计算逻辑** | [Study.tsx:439-457](../src/screens/Study.tsx#L439-L457) | 用于积分奖励，与房间无关 |
| **积分奖励系统** | [Study.tsx:462-470](../src/screens/Study.tsx#L462-L470) | 用户级数据，不依赖房间 |
| **累计时长统计** | [Study.tsx:491-512](../src/screens/Study.tsx#L491-L512) | 持久化到 `profiles` 表 |
| **防重复触发机制** | [Study.tsx:419-427](../src/screens/Study.tsx#L419-L427) | 关键状态管理，避免多次结算 |
| **浏览器关闭清理** | [Study.tsx:104-139](../src/screens/Study.tsx#L104-L139) | 数据一致性保障 |

### ❌ 当前缺失的功能

| 功能 | 优先级 | 复杂度 |
|------|--------|--------|
| 房间成员邀请功能 | 🔴 高 | 🟡 中 |
| 好友列表与房间集成 | 🔴 高 | 🟡 中 |
| 房间状态与本地计时器联动 | 🔴 高 | 🟢 低 |
| 房间内聊天功能 | 🟡 中 | 🔴 高 |
| 房间码二维码分享 | 🟡 中 | 🟢 低 |
| 踢出成员功能 | 🟢 低 | 🟢 低 |
| 转移房主功能 | 🟢 低 | 🟡 中 |

---

## 🎨 UI 升级切面

### 设计原则

1. **无损集成**：不破坏现有界面，采用渐进式增强
2. **状态一致性**：单人自习和多人房间共用计时逻辑
3. **平滑过渡**：用户可以随时在单人/多人模式间切换

### 界面改造方案

#### 1️⃣ Study.tsx 主界面改造

**现有布局（保持不变）**：
```
┌─────────────────────────────────────┐
│  StudyHeader                        │
│  [积分] [房间] [好友列表]           │
├─────────────────────────────────────┤
│  DurationSelector                   │
│  [25分] [45分] [60分] [开始专注]    │
├─────────────────────────────────────┤
│  StudyStats                         │
│  今日专注: XXX 分钟                  │
└─────────────────────────────────────┘
```

**新增状态指示器**：
```typescript
// 在 StudyHeader 右侧添加
<div className="flex items-center gap-2">
  {currentRoom && (
    <Badge variant="room">
      <Users className="w-4 h-4" />
      {currentRoom.members.length}人房间
      <span className={`w-2 h-2 rounded-full ${
        currentRoom.sessionState === 'focusing' ? 'bg-green-500 animate-pulse' :
        currentRoom.sessionState === 'resting' ? 'bg-yellow-500' :
        'bg-gray-400'
      }`} />
    </Badge>
  )}
</div>
```

#### 2️⃣ StudyRoom.tsx 功能增强

**当前缺失功能补充**：

| 缺失功能 | UI 设计 | 交互逻辑 |
|---------|---------|---------|
| **邀请好友** | 在成员列表上方添加"邀请"按钮 | 点击打开好友选择弹窗，发送房间码通知 |
| **房间码复制** | 房间码右侧添加复制图标 | 点击复制到剪贴板 + Toast 提示 |
| **状态一致性提示** | 房主控制状态时显示全屏提示 | "房主 XXX 开始了专注，请同步开始计时" |
| **空房间提示** | 成员列表为空时显示占位符 | "等待成员加入..." |

**UI 布局调整**：
```
┌─────────────────────────────────────────────┐
│  多人自习室                        [X]     │
├─────────────────────────────────────────────┤
│  房间码: ABC123              [复制] [邀请]  │
│  状态: 专注中        [开始] [暂停] [结束]   │  ← 仅房主可见
├─────────────────────────────────────────────┤
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │
│  │ 👑 You │ │ Alice │ │ Bob  │ │ Carol│ │ Dave │ │
│  │ 🟢  │ │ 🟢  │ │ 🟡  │ │ ⚪  │ │ ⚪  │  │
│  │ 专注中│ │ 专注中│ │ 休息 │ │在线 │ │在线 │ │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘  │
├─────────────────────────────────────────────┤
│  [离开房间]                                │
└─────────────────────────────────────────────┘
```

#### 3️⃣ StudyBuddiesList.tsx 集成改造

**新增房间快速加入**：
```typescript
// 在好友卡片上添加操作按钮
{buddy.is_studying && (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => handleQuickJoin(buddy.current_room_code)}
  >
    加入房间
  </Button>
)}
```

**数据源切换**：
- 当前：直接查询 `profiles.is_studying = true`
- 升级后：
  1. 查询 `profiles.is_studying = true` 的好友
  2. 如果好友在房间中，显示其 `current_room_code`
  3. 提供"一键加入"功能

### 组件通信架构

```
┌─────────────────────────────────────────────────────────────┐
│                         Study.tsx                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          StudyRoomContext (新增)                    │   │
│  │  - currentRoom: StudyRoomState | null              │   │
│  │  - isRoomHost: boolean                              │   │
│  │  - joinRoom() / leaveRoom() / hostAction()          │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│        ┌───────────────────┼───────────────────┐           │
│        ▼                   ▼                   ▼           │
│  ┌──────────┐      ┌─────────────┐     ┌──────────────┐  │
│  │TimerView │      │ StudyRoom   │     │StudyBuddies  │  │
│  │          │      │  Modal      │     │    List      │  │
│  └──────────┘      └─────────────┘     └──────────────┘  │
│       │                    │                     │        │
│       ▼                    ▼                     ▼        │
│  本地计时器          ClawbotChannelBridge    Supabase    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 数据流接管方案

### 核心原则

1. **双模式并存**：单人自习和多人房间可独立运行
2. **状态同步**：房间状态变更时同步更新本地计时器
3. **降级策略**：WebSocket 断开时自动降级到单人模式

### 数据流架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户操作层                            │
│  [点击开始专注] → [点击加入房间] → [房主控制状态]            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    StudyRoomContext (状态中心)              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  状态: currentRoom (来自 WebSocket)                  │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │ roomCode, sessionState, members[], version    │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  │                                                     │   │
│  │  方法: joinRoom(), leaveRoom(), hostAction()        │   │
│  │  → 调用 ClawbotChannelBridge                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌───────────┐  ┌──────────────┐  ┌──────────┐
    │本地计时器 │  │   WebSocket  │  │ Supabase │
    │   UI     │  │   推送事件    │  │  持久化  │
    └───────────┘  └──────────────┘  └──────────┘
```

### 关键数据流

#### 1️⃣ 加入房间流程

```typescript
// 用户点击"加入房间"
const handleJoinRoom = async (roomCode: string) => {
  try {
    // 1. 调用 WebSocket 服务
    const roomState = await clawbotChannelBridge.joinStudyRoom(
      roomCode,
      user.username,
      user.avatar_url
    );

    // 2. 更新 Context 状态
    setCurrentRoom(roomState);

    // 3. 如果房间在专注中，自动启动本地计时器
    if (roomState.sessionState === 'focusing') {
      syncTimerWithRoom(roomState);
    }

    // 4. 路由跳转到计时器页面
    navigate('/study/timer');

  } catch (error) {
    showToast('加入房间失败', 'error');
  }
};
```

#### 2️⃣ 房间状态同步流程

```typescript
// 监听 WebSocket 推送
clawbotChannelBridge.on('study_room_state', (event: StudyRoomStateEvent) => {
  const { room, reason } = event;

  // 1. 更新房间状态
  setCurrentRoom(room);

  // 2. 根据事件原因处理
  switch (reason) {
    case 'host_action':
      // 房主控制了房间状态，同步本地计时器
      if (room.sessionState === 'focusing') {
        startLocalTimer();  // 启动本地计时
      } else if (room.sessionState === 'resting') {
        pauseLocalTimer();  // 暂停本地计时
      } else if (room.sessionState === 'idle') {
        stopLocalTimer();   // 停止本地计时
      }
      break;

    case 'join':
      // 新成员加入
      showToast(`${room.members[room.members.length - 1].displayName} 加入了房间`, 'info');
      break;

    case 'leave':
      // 成员离开
      showToast('有成员离开了房间', 'info');
      break;
  }
});
```

#### 3️⃣ 本地计时器与房间状态联动

```typescript
// 本地计时器启动时检查房间状态
const handleLocalStartFocus = async () => {
  // 如果在房间中且不是房主，禁用本地控制
  if (currentRoom && !isRoomHost) {
    showToast('请等待房主开始专注', 'warning');
    return;
  }

  // 如果是房主，同时控制房间状态
  if (currentRoom && isRoomHost) {
    await clawbotChannelBridge.hostActionStudyRoom(
      currentRoom.roomCode,
      'start_focus'
    );
  }

  // 启动本地计时器（原有逻辑保持不变）
  setIsActive(true);
  setFocusStartTime(Date.now());

  // ... 其他原有逻辑
};
```

### Supabase 数据同步策略

| 数据类型 | 同步时机 | 同步方式 |
|---------|---------|---------|
| `is_studying` | 加入/离开房间 | WebSocket 事件 → Supabase 更新 |
| `current_room_code` | 房间状态变更 | WebSocket 事件 → profiles 表 |
| `total_study_time` | 计时结束 | 本地计算 → Supabase 累加 |
| `积分奖励` | 计时结束 | 本地计算 → user_points 表 |

**降级策略**：
```typescript
// WebSocket 断开时的处理
clawbotChannelBridge.on('disconnect', () => {
  if (currentRoom) {
    // 1. 标记为离线状态（不清除房间数据）
    setCurrentRoom(prev => prev ? { ...prev, offline: true } : null);

    // 2. 提示用户
    showToast('网络断开，正在尝试重连...', 'warning');

    // 3. 本地计时器继续运行（不中断用户专注）
    // 4. 重连成功后自动同步状态
  }
});
```

---

## 📋 分步实施步骤

### Phase 1: 状态管理层搭建（1-2天）

**目标**：建立 StudyRoomContext，集成 WebSocket 服务

**任务清单**：
- [ ] 创建 `src/contexts/StudyRoomContext.tsx`
- [ ] 实现状态管理逻辑（currentRoom, isRoomHost）
- [ ] 封装房间操作方法（joinRoom, leaveRoom, hostAction）
- [ ] 在 `App.tsx` 或 `Study.tsx` 中提供 Context
- [ ] 添加 WebSocket 事件监听和错误处理

**验证标准**：
- ✅ Context 正常提供状态和方法
- ✅ WebSocket 连接建立成功
- ✅ 事件监听器正常工作

**代码位置**：
- 新建：`src/contexts/StudyRoomContext.tsx`
- 修改：`src/App.tsx` 或 `src/screens/Study.tsx`

---

### Phase 2: UI 组件集成（2-3天）

**目标**：将 Context 集成到现有 UI 组件

**任务清单**：
- [ ] `Study.tsx` 添加房间状态指示器
- [ ] `StudyRoom.tsx` 添加邀请功能按钮
- [ ] `StudyRoom.tsx` 添加房间码复制功能
- [ ] `StudyBuddiesList.tsx` 添加"一键加入"按钮
- [ ] `TimerView.tsx` 添加房间状态同步逻辑

**验证标准**：
- ✅ 房间状态实时显示在主界面
- ✅ 可以从好友列表快速加入房间
- ✅ 房主控制状态时所有成员同步

**代码位置**：
- 修改：`src/screens/Study.tsx`
- 修改：`src/components/StudyRoom.tsx`
- 修改：`src/components/StudyBuddiesList.tsx`
- 修改：`src/features/study/components/TimerView.tsx`

---

### Phase 3: 本地计时器联动（1-2天）

**目标**：让本地计时器与房间状态保持同步

**任务清单**：
- [ ] 修改 `handleStartFocus` 检查房间权限
- [ ] 修改 `handleStopFocus` 同步房间状态
- [ ] 添加 WebSocket 事件驱动的计时器控制
- [ ] 实现断线降级策略
- [ ] 添加 Supabase 数据同步逻辑

**验证标准**：
- ✅ 房主开始专注时，所有成员计时器同步启动
- ✅ 非房主无法独立控制计时器
- ✅ 网络断开时本地计时器继续运行
- ✅ 重连后状态自动同步

**代码位置**：
- 修改：`src/screens/Study.tsx:378-534` (handleStartFocus/handleStopFocus)
- 修改：`src/features/study/components/TimerView.tsx`

---

### Phase 4: 数据持久化与清理（1天）

**目标**：确保数据一致性，处理边界情况

**任务清单**：
- [ ] 添加 `current_room_code` 字段到 profiles 表
- [ ] 实现加入/离开房间时更新 Supabase
- [ ] 处理用户直接关闭浏览器的情况
- [ ] 添加房间状态恢复逻辑（刷新页面）
- [ ] 编写单元测试

**验证标准**：
- ✅ 刷新页面后房间状态恢复
- ✅ 关闭浏览器后自动清理房间状态
- ✅ Supabase 数据与 WebSocket 状态一致
- ✅ 单元测试覆盖率 > 80%

**代码位置**：
- 修改：`server/init.sql` (添加 current_room_code 字段)
- 修改：`src/screens/Study.tsx:104-139` (beforeunload 处理)
- 新建：`src/tests/studyRoom.test.tsx`

---

### Phase 5: 功能增强（2-3天，可选）

**目标**：实现高级社交功能

**任务清单**：
- [ ] 房间邀请功能（选择好友 → 发送通知）
- [ ] 房间码二维码生成
- [ ] 房内聊天功能
- [ ] 踢出成员功能
- [ ] 房间设置面板（最大人数、自定义名称）

**验证标准**：
- ✅ 可以邀请好友加入房间
- ✅ 可以分享房间码二维码
- ✅ 房内实时聊天功能正常
- ✅ 房主可以踢出成员

**代码位置**：
- 新建：`src/components/RoomInviteModal.tsx`
- 新建：`src/components/RoomChat.tsx`
- 修改：`src/components/StudyRoom.tsx`

---

## 🔧 关键代码参考

### StudyRoomContext 核心实现

```typescript
// src/contexts/StudyRoomContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { clawbotChannelBridge } from '../services/ClawbotChannelBridge';
import { StudyRoomState, StudyRoomStateEvent } from '../types/studyRoom';
import { useAuth } from '../contexts/AuthContext';

interface StudyRoomContextValue {
  currentRoom: StudyRoomState | null;
  isRoomHost: boolean;
  joinRoom: (roomCode: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  hostAction: (action: 'start_focus' | 'pause' | 'end') => Promise<void>;
}

const StudyRoomContext = createContext<StudyRoomContextValue | undefined>(undefined);

export const StudyRoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentRoom, setCurrentRoom] = useState<StudyRoomState | null>(null);
  const [offline, setOffline] = useState(false);

  const isRoomHost = currentRoom ? currentRoom.hostUserId === user?.id : false;

  // 监听 WebSocket 事件
  useEffect(() => {
    const handleStateUpdate = (event: StudyRoomStateEvent) => {
      if (currentRoom && event.roomCode === currentRoom.roomCode) {
        setCurrentRoom(event.room);
      }
    };

    clawbotChannelBridge.on('study_room_state', handleStateUpdate);

    return () => {
      clawbotChannelBridge.off('study_room_state', handleStateUpdate);
    };
  }, [currentRoom]);

  // 加入房间
  const joinRoom = useCallback(async (roomCode: string) => {
    if (!user) throw new Error('User not authenticated');

    const roomState = await clawbotChannelBridge.joinStudyRoom(
      roomCode,
      user.username,
      user.avatar_url
    );

    setCurrentRoom(roomState);

    // 更新 Supabase
    await supabase
      .from('profiles')
      .update({ current_room_code: roomCode })
      .eq('id', user.id);
  }, [user]);

  // 离开房间
  const leaveRoom = useCallback(async () => {
    if (!currentRoom || !user) return;

    await clawbotChannelBridge.leaveStudyRoom(currentRoom.roomCode);
    setCurrentRoom(null);

    // 清除 Supabase 状态
    await supabase
      .from('profiles')
      .update({ current_room_code: null })
      .eq('id', user.id);
  }, [currentRoom, user]);

  // 房主操作
  const hostAction = useCallback(async (action: 'start_focus' | 'pause' | 'end') => {
    if (!currentRoom || !isRoomHost) {
      throw new Error('Only host can control room');
    }

    const roomState = await clawbotChannelBridge.hostActionStudyRoom(
      currentRoom.roomCode,
      action
    );

    setCurrentRoom(roomState);
  }, [currentRoom, isRoomHost]);

  return (
    <StudyRoomContext.Provider value={{
      currentRoom,
      isRoomHost,
      joinRoom,
      leaveRoom,
      hostAction,
    }}>
      {children}
    </StudyRoomContext.Provider>
  );
};

export const useStudyRoom = () => {
  const context = useContext(StudyRoomContext);
  if (!context) {
    throw new Error('useStudyRoom must be used within StudyRoomProvider');
  }
  return context;
};
```

### 本地计时器联动示例

```typescript
// src/screens/Study.tsx (修改部分)
import { useStudyRoom } from '../contexts/StudyRoomContext';

const Study = () => {
  const { currentRoom, isRoomHost } = useStudyRoom();
  // ... 其他状态

  const handleStartFocus = async () => {
    // 如果在房间中但不是房主，禁用本地控制
    if (currentRoom && !isRoomHost) {
      showToast('请等待房主开始专注', 'warning');
      return;
    }

    // 如果是房主，同时控制房间状态
    if (currentRoom && isRoomHost) {
      try {
        await hostAction('start_focus');
      } catch (error) {
        showToast('无法控制房间状态', 'error');
        return;
      }
    }

    // 启动本地计时器（原有逻辑保持不变）
    setIsActive(true);
    setFocusStartTime(Date.now());

    if (user?.id) {
      await supabase
        .from('profiles')
        .update({ is_studying: true })
        .eq('id', user.id);
    }

    navigate('/study/timer', {
      state: { duration: selectedDuration, companion }
    });
  };

  // 监听房间状态变化，同步本地计时器
  useEffect(() => {
    if (!currentRoom) return;

    if (currentRoom.sessionState === 'focusing' && !isActive) {
      // 房间开始专注，本地计时器未启动 → 自动启动
      setIsActive(true);
      showToast('房主开始了专注', 'info');
    } else if (currentRoom.sessionState === 'resting' && isActive) {
      // 房间进入休息，本地计时器运行中 → 自动暂停
      setIsActive(false);
      showToast('进入休息时间', 'info');
    } else if (currentRoom.sessionState === 'idle' && isActive) {
      // 房间结束，本地计时器运行中 → 自动停止
      handleStopFocus();
    }
  }, [currentRoom?.sessionState, currentRoom?.version]);
};
```

---

## 📊 风险评估与应对

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|---------|
| WebSocket 连接不稳定 | 高 | 中 | 实现降级策略，本地计时器独立运行 |
| 房间状态冲突 | 中 | 低 | 使用 version 字段进行冲突检测 |
| 用户直接关闭浏览器 | 中 | 高 | beforeunload 事件 + 服务端超时清理 |
| Supabase 与 WebSocket 状态不一致 | 高 | 中 | 以 WebSocket 为准，Supabase 作为备份 |
| 性能问题（频繁状态更新） | 低 | 低 | 使用防抖和版本控制减少更新 |

---

## ✅ 验收标准

### 功能验收

- [ ] 用户可以创建房间并邀请好友
- [ ] 用户可以通过房间码或好友列表加入房间
- [ ] 房主控制状态时，所有成员计时器同步
- [ ] 非房主无法独立控制计时器
- [ ] 网络断开时本地计时器继续运行
- [ ] 重连后状态自动同步
- [ ] 刷新页面后房间状态恢复
- [ ] 关闭浏览器后自动清理房间状态

### 性能验收

- [ ] WebSocket 消息延迟 < 500ms
- [ ] 房间状态更新到 UI 延迟 < 100ms
- [ ] 本地计时器精度误差 < 1s/分钟
- [ ] 内存占用无明显增长

### 代码质量验收

- [ ] TypeScript 严格模式无错误
- [ ] 单元测试覆盖率 > 80%
- [ ] ESLint 无警告
- [ ] 所有公共 API 有文档注释

---

## 📚 相关文件清单

### 需要新建的文件

| 文件路径 | 用途 |
|---------|------|
| `src/contexts/StudyRoomContext.tsx` | 房间状态管理 Context |
| `src/components/RoomInviteModal.tsx` | 邀请好友弹窗 |
| `src/components/RoomChat.tsx` | 房间聊天功能 |
| `src/tests/studyRoom.test.tsx` | 单元测试 |

### 需要修改的文件

| 文件路径 | 修改内容 |
|---------|---------|
| `src/screens/Study.tsx` | 集成 Context，添加计时器联动 |
| `src/components/StudyRoom.tsx` | 添加邀请、复制、状态提示 |
| `src/components/StudyBuddiesList.tsx` | 添加快速加入功能 |
| `src/features/study/components/TimerView.tsx` | 添加房间状态同步 |
| `server/init.sql` | 添加 current_room_code 字段 |

### 核心依赖文件（无需修改）

| 文件路径 | 说明 |
|---------|------|
| [src/services/ClawbotChannelBridge.ts](../src/services/ClawbotChannelBridge.ts) | WebSocket 客户端封装 |
| [src/types/studyRoom.ts](../src/types/studyRoom.ts) | TypeScript 类型定义 |
| [server/clawbot-channel/services/studyRoomService.js](../server/clawbot-channel/services/studyRoomService.js) | 后端房间服务 |

---

## 🎯 总结

本蓝图提供了一个**无损、渐进式**的升级方案，确保：

1. **现有功能不受影响**：单人自习逻辑完全保留
2. **平滑过渡**：每个 Phase 都是独立可运行的
3. **可回滚**：每个阶段都可以单独回滚
4. **可测试**：每个阶段都有明确的验收标准

**预计总工时**：5-10 个工作日（不包括可选的 Phase 5）

**建议实施顺序**：Phase 1 → Phase 2 → Phase 3 → Phase 4 → (Phase 5)

**关键成功因素**：
- 严格按照分步实施，每步验证后再进行下一步
- 优先实现核心功能，高级功能可以后续迭代
- 充分测试 WebSocket 断线重连和状态同步逻辑
- 保持与后端的密切沟通，确保协议一致

---

## 📝 变更历史

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|---------|------|
| 2026-02-24 | 1.0 | 初始版本，基于代码分析输出完整蓝图 | Claude Code |
