# Agent 集群并行执行 - 技术方案对比

> 📅 **生成时间**: 2026-02-25
> 🎯 **目标**: 真正的 Agent 并行执行，而非串行

---

## 📋 核心结论

### VSCode 插件环境

**❌ 无法实现真正的后台并行 Agent 集群**

**原因**:
- Claude Code 是**被动触发**的
- 只有在用户发送消息或工具返回结果时才被唤醒
- 无法在后台自主运行
- 无法主动"回调"主 Agent

### CLI 环境

**✅ 可以实现真正的并行执行**

**原因**:
- 可以启动多个独立的 Claude Code 进程
- 操作系统级别的进程管理
- 可以通过文件/管道/网络通信

---

## 🔍 技术限制详解

### VSCode 插件的被动触发机制

```
用户发送消息
    ↓
Claude Code 被唤醒
    ↓
执行任务、调用工具
    ↓
返回响应
    ↓
休眠 (等待下次用户输入)

❌ 无法做到:
- 在后台自主运行
- 子 Agent 完成后主动通知
- 持续监控进度
- 主动唤醒自己
```

### 核心矛盾

**需求**: Agent 在后台自主运行，完成后主动通知主 Agent

**现实**: Agent 只能在用户交互时被唤醒，无法主动执行

---

## 📊 5 种可行方案对比

### 方案 A: 伪并行 (当前实现)

**原理**: 在单个会话中使用 `Promise.all()` 模拟并行

**代码**:
```typescript
async executeBatch(tasks: Task[]): Promise<void> {
  const promises = tasks.map(task => this.launchExpertAgent(task));
  await Promise.all(promises);
}
```

**优点**:
- ✅ 简单实现
- ✅ 无需额外基础设施
- ✅ 适合快速任务（几秒内）

**缺点**:
- ❌ 不是真正的后台执行
- ❌ 阻塞主会话
- ❌ 无法处理长时间任务

**适用场景**: 快速任务、轻量级操作

---

### 方案 B: 文件系统通信

**原理**: 启动真正的后台进程，通过文件系统传递状态

**架构**:
```
主会话 1: 用户 → "实现登录功能"
主 Agent → 启动后台进程 → 返回 "任务已启动, ID=TASK-001"

(主会话结束, Claude Code 休眠)

后台进程 1: 前端专家 → 执行 → 更新 .claude/tasks/TASK-001/T001.json
后台进程 2: 后端专家 → 执行 → 更新 .claude/tasks/TASK-001/T002.json

主会话 2: 用户 → "任务进度?"
主 Agent → 读取文件 → 返回 "前端完成 80%, 后端完成 60%"
```

**代码示例**:
```typescript
// 启动任务
async launchLongTask(task: Task) {
  // 写入初始状态
  await Deno.writeTextFile(
    `.claude/tasks/${task.id}.json`,
    JSON.stringify({ status: 'pending', startTime: new Date() })
  );

  // 启动后台进程
  Deno.run({
    cmd: ['deno', 'run', '-A', 'agent-worker.ts', task.id],
    stdout: 'null',
    stderr: 'null'
  });

  return `任务已启动, 稍后查询: .claude/tasks/${task.id}.json`;
}

// 查询进度
async checkProgress(taskId: string) {
  const status = await Deno.readTextFile(`.claude/tasks/${taskId}.json`);
  return JSON.parse(status);
}
```

**优点**:
- ✅ 真正的后台执行
- ✅ 可以处理长时间任务
- ✅ 状态持久化
- ✅ 可以跨会话查询

**缺点**:
- ⚠️ 需要用户主动查询进度
- ⚠️ 无法实时通知

**适用场景**: 中长时间任务（几分钟到几十分钟）

---

### 方案 C: 外部进程管理器 + Webhook

**原理**: 使用独立进程管理器运行 Agent，通过 webhook 通知

**架构**:
```
┌─────────────────────────────────────┐
│  外部进程管理器 (PM2/systemd)       │
│  ├─ 管理 Agent 进程池               │
│  ├─ 监控进程状态                     │
│  └─ Webhook 通知                    │
└─────────────────────────────────────┘
              ↓ 完成通知
┌─────────────────────────────────────┐
│  Webhook 服务器                      │
│  └─ 接收 Agent 完成事件              │
└─────────────────────────────────────┘
              ↓ 写入状态
┌─────────────────────────────────────┐
│  文件系统 / 数据库                   │
└─────────────────────────────────────┘
```

**代码示例**:
```typescript
// webhook-server.ts
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

serve(async (req) => {
  if (req.method === "POST" && req.url === "/agent/complete") {
    const { taskId, expertId, result } = await req.json();

    // 更新状态文件
    await updateTaskStatus(taskId, expertId, 'completed', result);

    // 发送桌面通知
    await sendDesktopNotification(`任务 ${taskId} 已完成`);

    return new Response("OK");
  }
});

// agent-worker.ts
async function runAgent(taskId: string, expertType: string) {
  // 执行任务...

  // 完成后触发 webhook
  await fetch("http://localhost:8080/agent/complete", {
    method: "POST",
    body: JSON.stringify({ taskId, expertId, result })
  });
}
```

**优点**:
- ✅ 真正的后台并行执行
- ✅ 进程生命周期管理
- ✅ 可扩展性强
- ✅ 可以处理大量任务

**缺点**:
- ❌ 架构复杂
- ❌ 需要额外的进程管理器
- ❌ 仍无法主动通知 VSCode 插件（需要用户查询）

**适用场景**: 企业级、大规模任务处理

---

### 方案 D: CLI 版本 + 进程管理

**原理**: 使用 Claude Code CLI，而不是 VSCode 插件

**实现**:
```bash
#!/bin/bash

TASK_ID="TASK-$(date +%Y%m%d)-$RANDOM"

# 启动后台 Agent
for expert in frontend backend database security; do
  claude-code \
    --file ".claude/agents/experts/${expert}-expert.md" \
    --task "TASK_ID=${TASK_ID}" \
    --output ".claude/tasks/${TASK_ID}/results/${expert}.json" \
    &
  echo "启动 ${expert} Agent (PID: $!)"
done

# 等待所有 Agent 完成
wait

echo "所有 Agent 完成,汇总结果..."
```

**优点**:
- ✅ 真正的并行执行
- ✅ 操作系统级别的进程管理
- ✅ 简单直接

**缺点**:
- ❌ 需要离开 VSCode 插件
- ❌ 用户体验不如 VSCode 集成

**适用场景**: 命令行工作流、自动化脚本

---

### 方案 E: Hybrid 混合方案 (推荐)

**原理**: VSCode 插件 + 本地任务服务器

**架构**:
```
┌─────────────────────────────────────┐
│  VSCode 插件 (Claude Code)          │
│  ├─ 用户交互                         │
│  ├─ 任务规划                         │
│  └─ 结果展示                         │
└─────────────────────────────────────┘
              ↓ 提交任务
┌─────────────────────────────────────┐
│  本地任务服务器 (Deno/Node.js)      │
│  ├─ 接收任务                         │
│  ├─ 启动 Agent 进程池               │
│  ├─ 管理任务队列                     │
│  └─ 提供 API 查询进度               │
└─────────────────────────────────────┘
              ↓ 并行执行
┌─────────────────────────────────────┐
│  Agent 进程池                        │
│  ├─ Agent 1: 前端专家               │
│  ├─ Agent 2: 后端专家               │
│  └─ Agent N: ...                    │
└─────────────────────────────────────┘
```

**代码示例**:
```typescript
// server.ts - 本地任务服务器
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const taskQueue = new Map<string, TaskStatus>();

serve(async (req) => {
  const url = new URL(req.url);

  if (url.pathname === "/task/submit" && req.method === "POST") {
    const task = await req.json();

    // 启动后台 Agent
    Deno.run({
      cmd: ["deno", "run", "-A", "agent-worker.ts", JSON.stringify(task)],
      stdout: "null",
      stderr: "null"
    });

    taskQueue.set(task.id, { status: "started", startTime: new Date() });

    return new Response(JSON.stringify({ taskId: task.id, status: "started" }));
  }

  if (url.pathname === "/task/status") {
    const taskId = url.searchParams.get("id");
    const status = taskQueue.get(taskId!);
    return new Response(JSON.stringify(status));
  }
});

// VSCode 插件中调用
async launchCluster(tasks: Task[]) {
  // 提交任务到本地服务器
  for (const task of tasks) {
    await fetch("http://localhost:8080/task/submit", {
      method: "POST",
      body: JSON.stringify(task)
    });
  }

  return "任务已提交，请使用 '查询进度 [任务ID]' 查看进度";
}

async checkProgress(taskId: string) {
  const response = await fetch(`http://localhost:8080/task/status?id=${taskId}`);
  return await response.json();
}
```

**优点**:
- ✅ VSCode 插件中友好的用户体验
- ✅ 真正的后台并行执行
- ✅ 可以处理长时间任务

**缺点**:
- ⚠️ 需要额外的本地服务器
- ⚠️ 架构较复杂

**适用场景**: 需要后台执行 + VSCode 集成的场景

---

## 🎯 方案选择指南

### 场景对比表

| 场景 | 推荐方案 | 理由 |
|------|---------|------|
| 快速任务（几秒） | 方案 A - 伪并行 | 简单直接，无需额外基础设施 |
| 中长时间任务（几分钟） | 方案 B - 文件系统 | 真正后台，状态持久化 |
| 企业级大规模 | 方案 C - 进程管理器 | 完整生命周期管理 |
| 命令行自动化 | 方案 D - CLI | 操作系统级别进程管理 |
| VSCode 集成 + 后台 | **方案 E - Hybrid** ⭐ | 最佳平衡 |

---

## 🚀 推荐实施路径

### 短期（当前）

继续使用 **方案 A - 伪并行**，适合大多数日常开发场景。

**已经实现**: `ExpertAgentScheduler.ts` 使用 `Promise.all()`

### 中期（本月）

实现 **方案 B - 文件系统通信**，支持长时间任务。

**需要实现**:
1. 后台 Agent worker 脚本
2. 文件系统状态读写
3. 进度查询命令

### 长期（未来）

如果需要企业级能力，实现 **方案 E - Hybrid 混合方案**。

**需要实现**:
1. 本地任务服务器
2. API 接口设计
3. 进程池管理

---

## 📝 总结

### 核心要点

1. **VSCode 插件无法实现真正的后台并行** - 由于被动触发机制
2. **CLI 可以实现真正的并行** - 使用操作系统进程管理
3. **当前实现是伪并行** - 使用 `Promise.all()` 在单会话中并行
4. **有 5 种可行方案** - 从简单到复杂，覆盖不同场景

### 行动建议

**对于你的项目**:

1. **当前**: 继续使用方案 A（伪并行），适合 90% 的场景
2. **需要长时间任务时**: 实现方案 B（文件系统）
3. **需要企业级能力时**: 考虑方案 E（Hybrid）

### 关键文件

- 专家调度器: `.claude/lib/ExpertAgentScheduler.ts`
- 主 Agent: `.claude/agents/main-agent.ts`
- 本文档: `docs/project-reports/AGENT_PARALLEL_EXECUTION_COMPARISON.md`

---

**生成时间**: 2026-02-25
**调研方法**: 技术分析 + 架构设计
**下一步**: 根据需求选择合适的方案实现
