# OpenClaw 完整控制功能实现计划

## 需求概述

在手机上远程控制 OpenClaw，包括：
1. 配置文件回滚（到上一次）
2. 查询模型、已有 Skill
3. 查看 OpenClaw 状态
4. 运行 Doctor 自修复
5. 查看日志
6. 定时任务管理

## 技术架构

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   手机 App   │────►│ clawbot-channel  │────►│ channel-bridge  │
│             │     │    服务器        │     │   (用户电脑)    │
│  控制面板    │◄────│   (转发)         │◄────│  执行 CLI 命令  │
└─────────────┘     └──────────────────┘     └─────────────────┘
```

## 控制命令协议

### 请求 (手机 → 服务器 → channel-bridge)

```typescript
type ControlCommand =
  | { action: 'models_status' }
  | { action: 'skills_list' }
  | { action: 'skills_check' }
  | { action: 'cron_list' }
  | { action: 'cron_add'; name: string; schedule: string; type: 'message' | 'system-event'; content: string; channel?: string; to?: string }
  | { action: 'cron_enable'; jobId: string }
  | { action: 'cron_disable'; jobId: string }
  | { action: 'cron_remove'; jobId: string }
  | { action: 'status' }
  | { action: 'health' }
  | { action: 'doctor' }
  | { action: 'doctor_repair' }
  | { action: 'logs'; limit?: number }
  | { action: 'config_backup' }
  | { action: 'config_rollback' };
```

### 响应 (channel-bridge → 服务器 → 手机)

```typescript
type ControlResponse = {
  success: boolean;
  data?: any;
  error?: string;
};
```

## 实现步骤

### Phase 1: channel-bridge 增加控制命令处理

**文件**: `openclaw-skills/channel-bridge/src/index.js`

新增功能：
1. 增加 `handleControlCommand` 函数执行 CLI 命令
2. 增加配置文件备份/恢复逻辑
3. Socket 事件处理

```javascript
// 新增 Socket 事件
socket.on('control_command', async (data, callback) => {
  const result = await handleControlCommand(data);
  callback(result);
});
```

### Phase 2: clawbot-channel 服务器转发

**文件**: `server/clawbot-channel/server.js`

新增功能：
1. 转发控制命令到 Bot 端
2. Bot 端响应后转发回手机

### Phase 3: 手机端控制面板

**文件**: `src/` (React) 和 `ios/` (iOS)

新增功能：
1. 设置页面增加「OpenClaw 控制面板」入口
2. 控制面板包含各功能卡片
3. 二次确认弹窗

## UI 设计

```
┌─────────────────────────────────────┐
│         OpenClaw 控制面板           │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────┐ ┌─────────┐ ┌───────┐│
│  │ 模型状态 │ │ 技能列表 │ │定时任务││
│  │   🤖    │ │   🛠️    │ │  ⏰   ││
│  └─────────┘ └─────────┘ └───────┘│
│                                     │
│  ┌─────────┐ ┌─────────┐ ┌───────┐│
│  │  运行状态│ │ Doctor  │ │  日志 ││
│  │   📊    │ │   🔧    │ │  📝   ││
│  └─────────┘ └─────────┘ └───────┘│
│                                     │
│  ┌───────────────────────────────┐ │
│  │        配置回滚                │ │
│  │           🔄                  │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

## 文件修改清单

### 1. openclaw-skills/channel-bridge/src/index.js
- 新增 `handleControlCommand()` 函数
- 新增配置文件备份/恢复逻辑
- 新增 Socket 事件处理

### 2. server/clawbot-channel/server.js
- 新增控制命令转发逻辑

### 3. src/services/ClawbotChannelBridge.ts
- 新增 `sendControlCommand()` 方法
- 新增类型定义

### 4. src/screens/Settings.tsx (或新建)
- 新增 OpenClaw 控制面板页面
- 二次确认弹窗组件

### 5. iOS 端
- 新增 OpenClawControlView
- ClawbotChannelService 增加对应方法

## 安全考虑

1. **二次确认**: 所有操作都需要用户确认
2. **路径限制**: 只能操作 ~/.openclaw/ 目录
3. **权限控制**: 只有配对后的设备才能发送控制命令

## 待定功能

- 安装 Skill（预留，暂不实现）
