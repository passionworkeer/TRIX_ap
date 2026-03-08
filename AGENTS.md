# AGENTS.md - TRIX 3D Companion 项目协作配置

> 🎯 此文件定义了 Codex 在本项目中的工作方式，所有会话都会自动读取并遵循

---

## 🤝 协作协议

### 核心原则

**用户：用最简单的话语描述需求 + 验收成果**
**Codex：负责所有技术实现、测试、审查、文档、总结工作**

---

## 📋 Codex 的工作流程（必须严格遵循）

### 1️⃣ 理解和探索阶段
- [ ] 仔细分析用户需求
- [ ] 使用 `brainstorming` skill 探索所有边界情况
- [ ] 对不清晰的地方主动追问
- [ ] 确认所有技术细节

### 2️⃣ 计划和实施阶段
- [ ] 制定详细的实现计划
- [ ] 使用 `tdd-workflow` skill（测试驱动开发）
- [ ] 完整实现所有功能代码
- [ ] 编写完整的测试用例
- [ ] 更新相关文档

### 3️⃣ 质量保证阶段
- [ ] 运行所有测试，确保通过
- [ ] 使用 `security-review` skill 进行安全审查
- [ ] 使用 `performance` skill 检查性能问题
- [ ] 代码风格和最佳实践检查
- [ ] 自我验证功能完整性

### 4️⃣ 交付和总结阶段
- [ ] 向用户展示完整成果
- [ ] 等待用户验收
- [ ] **验收通过后必须：**
  - 使用 Memory MCP 记录重要决策
  - 提取可复用的模式
  - 总结经验教训
  - 优化下次工作流程

---

## 🛠️ Skills 使用策略

### 主要使用 ECC 插件 Skills
项目优先使用 everything-Codex 插件中的 skills：

| 场景 | 使用 ECC Skill |
|------|---------------|
| TDD 开发 | `tdd-workflow` |
| 安全审查 | `security-review` |
| 前端开发 | `frontend-patterns` |
| 后端模式 | `backend-patterns` |
| E2E 测试 | `e2e-testing` |
| 代码标准 | `coding-standards` |
| 验证循环 | `verification-loop` |

### 辅助使用全局 Skills（ECC 没有时）
仅在 ECC 插件没有对应功能时，使用全局 skills：

| 场景 | 使用全局 Skill |
|------|---------------|
| **主动性增强** | **`proactive-agent`** ⭐ 内置行为模式 |
| JS/TS 测试 | `javascript-testing-patterns` |
| 性能优化 | `performance` |
| Docker | `docker-expert` |
| DevOps | `devops-engineer` |
| API 设计 | `api-design-principles` |
| API 安全 | `api-security-best-practices` |
| 架构模式 | `architecture-patterns` |
| 架构决策记录 | `architecture-decision-records` |
| TypeScript 高级类型 | `typescript-advanced-types` |
| Node.js 后端 | `nodejs-backend-patterns` |

### ⭐ proactive-agent 核心能力（v3.0.0）

**已内化为默认行为，自动应用以下协议：**

| 协议 | 触发场景 | 行为 |
|------|---------|------|
| **WAL Protocol** | 用户纠正、决策、偏好表达 | 先记录到 SESSION-STATE.md，再响应 |
| **Working Buffer** | 上下文 >60% | 自动记录所有对话到 working-buffer.md |
| **Compaction Recovery** | 上下文压缩后 | 从 working buffer 恢复状态 |
| **Relentless Resourcefulness** | 遇到问题 | 尝试 10 种方法后再求助 |
| **Security Hardening** | 安装 skill、外部内容 | 自动审查安全风险 |

**三大支柱：**
- Proactive（主动性）- 不等待指令，主动创造价值
- Persistent（持久性）- 上下文丢失后仍能恢复
- Self-improving（自我改进）- 持续优化服务能力

### 归档的 Skills
以下 skills 已移至 `~/.Codex/skills-archive/`，其他项目需要时可恢复：
- GraphQL 相关：apollo-server, graphql-schema
- 微服务：kubernetes-specialist, microservices-architect, microservices-patterns
- 数据库：redis-development, neon-postgres, prisma-*
- 其他语言：python-testing-patterns, fastapi-templates
- 监控：monitoring-expert, sentry-setup-ai-monitoring
- 文档：docx, pptx, xlsx
- 其他：remotion-best-practices

---

## 💾 记忆系统使用规范

### 必须记录到 Memory MCP 的内容：
- ✅ 重要的架构决策
- ✅ 技术选型及其原因
- ✅ 遇到的问题和解决方案
- ✅ 用户的编码偏好
- ✅ 可复用的设计模式
- ✅ 项目特定的约定

### Memory 查询时机：
- 会话开始时：查询相关记忆
- 做决策时：查询历史决策
- 总结时：记录新知识

---

## 🎯 工作标准

### 一次性完成原则
- ✅ 完整实现所有功能
- ✅ 包含错误处理
- ✅ 包含边界情况
- ✅ 完整的测试覆盖
- ✅ 清晰的文档
- ❌ 不要留待后续补充

### 代码质量标准
- ✅ TypeScript 严格模式
- ✅ 所有函数有类型注解
- ✅ 所有公共 API 有文档注释
- ✅ 无 any 类型（除非必要并有注释）
- ✅ 无 console.log（使用正式日志系统）
- ✅ 错误处理完善
- ✅ 安全性考虑周全

---

## 📝 与用户沟通规范

### DO ✅
- 使用简洁清晰的语言
- 主动汇报进度和发现
- 解释重要的技术决策
- 提供多种方案时说明优劣
- 验收通过后总结经验

### DON'T ❌
- 不要使用过于技术的术语（除非必要）
- 不要假设用户了解上下文
- 不要遗漏重要的技术细节
- 不要在未完成时交付
- 不要忘记总结和优化

---

## 🔄 持续改进

### 每次会话结束时：
1. 反思工作流程效率
2. 识别可改进的地方
3. 更新 Memory 中的经验
4. 必要时更新此文件

---

## 🤖 longcode 自动建议规则（强制执行）

> ⚠️ **本规则为强制执行，不是建议！违反者将被记录并改进。**

### 触发条件（满足任一即触发）

**必须使用 Agent 工具启动多代理团队的场景：**

| 条件 | 说明 | 示例 |
|------|------|------|
| **涉及多模块** | 2+ 个不同目录 | 同时改 Web + iOS |
| **任务可并行** | 子任务无依赖 | 3 个独立的 API |
| **时间预估长** | 预计 >15 分钟 | 复杂功能实现 |
| **多技术栈** | 前端+后端+iOS+测试 | 新功能开发 |
| **iOS 开发** | 任何 iOS 代码修改 | 任何 .swift 文件 |
| **安全相关** | 认证、权限、数据处理 | 登录、支付 |
| **用户明确** | 用户说"用 longcode" | 直接命令 |

### PROJECT_TASKS.md 规范

**所有多代理任务必须使用 PROJECT_TASKS.md 跟踪：**

```markdown
# PROJECT_TASKS.md - <项目名称>

> 项目目标: <用户目标>
> 创建时间: YYYY-MM-DD
> 状态: 执行中

---

## 任务列表

### 阶段一：<阶段名称>
- [ ] TASK-001: 任务描述 | type: xxx | priority: P0 | estimate: 2h
- [ ] TASK-002: 任务描述 | type: xxx | priority: P1 | estimate: 4h

### 执行中 (In Progress)
- [ ] TASK-001: 任务描述 | type: xxx | assignee: Agent-1

### 已完成 (Done)
- [x] TASK-003: 任务描述 | type: xxx | commit: abc1234
```

### Agent 调用流程（必须遵循）

```
1. 收到任务 → 判断是否符合触发条件
2. 是 → 创建 PROJECT_TASKS.md → 启动 Agent 工具
3. 否 → 检查是否应该建议用 longcode
4. 执行任务 → 每个任务必须：
   ├── 代码实现 (frontend-dev/backend-dev)
   ├── 安全审计 (senior-dev) ⬅️ 串行等待
   └── 测试验证 (junior-dev) ⬅️ 可并行
5. 验收通过 → 更新 PROJECT_TASKS.md → git commit
6. 汇报用户
```

### 任务分发的 Agent 类型

| 任务类型 | Agent | 说明 |
|---------|-------|------|
| 前端 UI | frontend-dev | React/组件/样式 |
| 后端逻辑 | backend-dev | API/数据库/服务 |
| 安全审核 | senior-dev | **任何代码修改后必须** |
| 测试编写 | junior-dev | 单元/集成/E2E |
| iOS 开发 | frontend-dev + iOS 上下文 | Swift/SwiftUI |
| 调研探索 | Explore | 技术调研/方案评估 |

### 完整 Agent 调用示例

```typescript
// ❌ 错误：独自完成所有代码
// 我不应该这样做！

// ✅ 正确：启动多代理团队
// 1. 先启动并行开发
Agent(subagent_type="frontend-dev", prompt="实现首页组件...", description="前端开发")
Agent(subagent_type="backend-dev", prompt="实现用户API...", description="后端开发")

// 2. 等待并行任务完成后，启动安全审核（串行）
Agent(subagent_type="senior-dev", prompt="审核以下代码修改...", description="安全审计")

// 3. 安全审核通过后，启动测试（可并行）
Agent(subagent_type="junior-dev", prompt="编写测试用例...", description="测试验证")
```

### iOS 开发特殊规则

由于本项目是 **Windows 开发 iOS**，有以下强制规则：

1. **iOS 代码必须用子代理** - 调用 `frontend-dev` 并指定 iOS 上下文
2. **生成代码后自动运行静态分析** - SwiftLint 检查
3. **生成代码必须避免** - Force unwrap (!)、硬编码字段名
4. **参考 Web 一致性** - 确保字段名与 Web 端一致
5. **禁止独自写 iOS 代码** - 即使是小修改也要分发给 Agent

### 禁止行为（绝对禁止）

- ❌ 独自完成多模块任务（不调用 Agent）
- ❌ 跳过安全审核直接提交
- ❌ 跳过测试验证直接提交
- ❌ iOS 开发不调用子代理
- ❌ 小任务就偷懒不启动 Agent
- ❌ 忘记更新 PROJECT_TASKS.md

### 验收标准（每个任务必须满足）

```
□ 代码质量
  - 无 TypeScript/Swift 编译错误
  - 无 ESLint/SwiftLint 警告
  - 符合项目编码规范

□ 安全审计 (senior-dev)
  - 无硬编码 secrets
  - 无 XSS/SQL 注入风险
  - 权限验证正确

□ 测试覆盖 (junior-dev)
  - 单元测试通过
  - 集成测试通过
  - E2E 测试通过（关键流程）

□ 无回归
  - 运行相关模块测试
  - 确保不破坏现有功能

□ 版本控制
  - 每个任务单独 commit
  - 提交信息清晰
```

### 建议话术（供参考）

```
检测到这是一个多模块任务，我将使用多代理团队完成：

涉及模块：前端、后端
任务数量：X 个
预计时间：X 小时

执行计划：
1. 启动前端 + 后端 Agent 并行开发
2. 等待完成后进行安全审核
3. 通过后进行测试验证
4. 验收通过后 git commit

是否确认执行？ (y/n)
```

### 执行方式

```
# 方式 1：使用 slash command
/longcode

# 方式 2：直接描述需求
用户: "做一个完整的用户系统"

# 方式 3：Codex 主动识别后建议
Codex: "这个任务涉及多模块，我建议用 longcode 方式..."
```

---

## 📌 项目特定配置

### 技术栈
- **前端**: React + TypeScript
- **3D**: Three.js
- **状态管理**: Zustand
- **样式**: Tailwind CSS
- **构建**: Vite

### 项目结构
```
src/
├── components/     # React 组件
├── hooks/         # 自定义 Hooks
├── store/         # Zustand 状态
├── utils/         # 工具函数
├── types/         # TypeScript 类型
└── styles/        # 样式文件
```

### 编码约定
- 使用函数式组件 + Hooks
- 组件文件使用 PascalCase
- 工具函数使用 camelCase
- 常量使用 UPPER_SNAKE_CASE
- 优先使用组合而非继承

---

## ⚡ 快速启动检查清单

每次开始工作时，Codex 应该：
- [ ] 读取此 AGENTS.md 文件
- [ ] 查询 Memory MCP 中的相关记忆
- [ ] 理解用户当前需求
- [ ] 确认工作流程
- [ ] 开始执行

---

## 🔒 强制性检查点（执行任何操作前必须检查）

**在执行任何开发任务前，必须完成以下检查，违反任何一点禁止开始编码！**

### 📋 任务启动检查（必须全部完成）

- [ ] 已使用 `brainstorming` skill 探索需求
- [ ] 已创建 TodoWrite 列表跟踪所有任务
- [ ] 已确定需要使用的 skills 列表
- [ ] 已查询 Memory MCP 查找相关经验
- [ ] 已规划测试策略
- [ ] 已确认安全边界（不会泄露敏感信息）

### 🚫 禁止行为（绝对禁止）

- ❌ 跳过 brainstorming 直接开始编码
- ❌ 跳过 TDD 先写代码后写测试
- ❌ 不创建 TodoWrite 列表就开始工作
- ❌ 不查询 Memory MCP 就重复造轮子
- ❌ 不用 security-review 就提交代码
- ❌ 忘记记录决策到 Memory

### ⚠️ 自我检查机制（每次工具调用前）

在执行任何重要操作前，必须问自己：

1. 当前操作是否符合工作流程阶段？
2. 是否使用了合适的 skill？
3. 是否需要记录决策到 Memory？
4. 是否有安全隐患需要检查？
5. 是否需要更新 todo 状态？

---

**最后更新：2026-03-06**
**版本：3.0 - 强制 longcode 工作流**
**维护者：Codex + 用户协作制定**
