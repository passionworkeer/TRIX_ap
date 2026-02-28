# Agent Team Orchestration System - Design

> **项目目标**: 构建一个 AI 驱动的软件工程团队系统，主代理自动规划、分发、验收任务

---

## 1. 核心概念

### 1.1 系统架构

```
用户 (大目标)
    ↓
┌─────────────────────────────────────────────────────────────┐
│                    🎯 Master Agent                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Task Planner │  │ Task Router │  │ Verification Engine │ │
│  │  (Plan &    │→ │ (Dispatch)   │→ │ (Review & Commit)   │ │
│  │   Split)    │  │              │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│              📋 PROJECT_TASKS.md (任务看板)                 │
└─────────────────────────────────────────────────────────────┘
    ↑↓
┌─────────────────────────────────────────────────────────────┐
│                    10 Sub-Agents                            │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │
│  │Senior  │ │Backend │ │Frontend│ │Security│ │Testing │  │
│  │  Dev   │ │  Dev   │ │  Dev   │ │        │ │        │  │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘  │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │
│  │DevOps  │ │AI Eng  │ │Data    │ │  PM    │ │Explore │  │
│  │        │ │        │ │Engineer│ │        │ │        │  │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 任务流转

```
待处理 (Backlog) → 执行中 (In Progress) → 待验收 (Pending) → 已完成 (Done)
                          ↓                      ↓                  ↓
                    分配给代理              验收结果           打勾+Commit
```

---

## 2. 任务文件格式

### 2.1 PROJECT_TASKS.md 结构

```markdown
# PROJECT_TASKS.md - 项目任务看板

> 项目目标: [用户描述的大目标]
> 创建时间: 2026-03-01
> 状态: 执行中 / 已完成

---

## 📋 任务列表

### 待处理 (Backlog)
- [ ] TASK-001: 任务描述 | type: senior | priority: P0 | estimate: 2h

### 执行中 (In Progress)
- [ ] TASK-002: 任务描述 | type: backend | assignee: Agent-2 | estimate: 4h

### 待验收 (Pending Review)
- [x] TASK-003: 任务描述 | type: frontend | assignee: Agent-3 | result: ✓

### 已完成 (Done)
- [x] TASK-004: 任务描述 | type: testing | assignee: Agent-5 | commit: abc1234
```

### 2.2 任务字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `type` | ✅ | senior/backend/frontend/security/testing/devops/ai/data/pm/explore |
| `priority` | ✅ | P0 (必须) / P1 (重要) / P2 (可选) |
| `estimate` | 可选 | 预估时间，如 2h, 4h, 1d |
| `assignee` | 执行中 | 分配的代理 ID |
| `result` | 待验收 | ✓ (通过) / ✗ (需重做) |
| `commit` | 已完成 | git commit hash |

---

## 3. 子代理职责表

| ID | Agent | subagent_type | 处理的任务类型 |
|----|-------|---------------|---------------|
| 1 | **Senior Dev** | senior-dev | senior, architecture, review |
| 2 | **Backend Dev** | backend-dev | backend, api, db |
| 3 | **Frontend Dev** | frontend-dev | frontend, ui, component |
| 4 | **Security** | senior-dev | security, auth, audit |
| 5 | **Testing** | junior-dev | testing, test, e2e |
| 6 | **DevOps** | devops | devops, deploy, infra |
| 7 | **AI Engineer** | ai-engineer | ai, prompt, rag |
| 8 | **Data Engineer** | data-engineer | data, etl, analytics |
| 9 | **Product Manager** | product-manager | pm, docs, planning |
| 10 | **Explore** | Explore | research, explore |

---

## 4. 主代理工作流程

### 4.1 启动阶段

```
1. 用户给出大项目目标
2. Master 调用 Plan agent 生成详细计划
3. 将计划转换为 PROJECT_TASKS.md 格式
4. 开始执行循环
```

### 4.2 执行循环 (Loop)

```
LOOP until 所有任务完成:

  1. 从"待处理"取优先级最高的任务
  2. 根据 type 分发给对应子代理
  3. 子代理执行任务
  4. 收集结果，判断状态:
     ├── ✓ 验收通过:
     │    ├── 更新 PROJECT_TASKS.md 打勾 [x]
     │    ├── 生成 commit message
     │    ├── git add + git commit
     │    └── 移到"已完成"
     │
     └── ✗ 验收失败:
          ├── 记录失败原因
          ├── 打回"待处理"重试 (最多3次)
          └── 继续下一个任务

  5. 拿下一个任务 → 回到步骤1
END LOOP

6. 向用户汇报总结
```

### 4.3 验收标准

| 阶段 | 验收内容 |
|------|---------|
| 代码完成 | 功能代码已写完 |
| 测试通过 | 相关测试用例通过 |
| 安全检查 | 无安全问题 |
| 代码质量 | 符合项目规范 |

---

## 5. 交互方式

### 5.1 触发命令

用户可通过自然语言触发:
- "开始执行任务"
- "继续任务"
- "查看任务进度"
- "添加新任务 xxx"

### 5.2 状态汇报

每个任务完成时汇报:
```
✅ TASK-003 已完成 (Frontend Dev)
   提交: abc1234
   变更: 3 files
```

---

## 6. 实现计划

### Phase 1: 核心系统
- [ ] 1. 创建 PROJECT_TASKS.md 模板
- [ ] 2. 实现任务解析和更新逻辑
- [ ] 3. 实现子代理分发函数
- [ ] 4. 实现 git commit 逻辑

### Phase 2: 工作流
- [ ] 5. 实现任务循环引擎
- [ ] 6. 实现验收逻辑
- [ ] 7. 实现状态汇报

### Phase 3: 增强
- [ ] 8. 添加优先级排序
- [ ] 9. 添加重试机制
- [ ] 10. 添加进度统计

---

## 7. 风险与限制

1. **上下文限制**: 单个任务不能太大，否则超出上下文
2. **Git冲突**: 多分支同时开发可能有冲突风险
3. **验收主观性**: 部分验收需要人工确认

---

**设计版本**: 1.0
**创建日期**: 2026-03-01
