# CLAUDE.md - TRIX 3D Companion 项目协作配置

> 🎯 此文件定义了 Claude Code 在本项目中的工作方式，所有会话都会自动读取并遵循

---

## 🤝 协作协议

### 核心原则

**用户：用最简单的话语描述需求 + 验收成果**
**Claude：负责所有技术实现、测试、审查、文档、总结工作**

---

## 📋 Claude 的工作流程（必须严格遵循）

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
项目优先使用 everything-claude-code 插件中的 skills：

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
以下 skills 已移至 `~/.claude/skills-archive/`，其他项目需要时可恢复：
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

## 🤖 longcode 自动建议规则

当遇到**大型开发任务**时，应该建议用户使用 `longcode` skill。

### 触发条件

**满足以下任一条件时，建议使用 longcode：**

1. **时间估算** - 预计开发时间超过 5 小时
2. **任务数量** - 需要 10+ 个独立任务完成
3. **涉及模块** - 需要同时开发 3+ 个不同模块/子系统
4. **技术复杂度** - 需要前后端、数据库、测试、部署等多方面工作
5. **用户明确要求** - 用户说"做一个完整的xxx"、"实现整个系统"等

### 判断方法

我需要根据以下因素**自主判断**是否触发建议：

| 因素 | 判断依据 |
|------|---------|
| 任务描述 | 是否涉及"完整"、"系统"、"多个模块"等 |
| 涉及范围 | 是否需要前端+后端+测试+部署 |
| 预期产出 | 是否有多个独立功能点 |
| 用户意图 | 是否是全新功能而非简单修改 |

### 建议话术

```
检测到这是一个大型开发任务，涉及：
- 预计开发时间：X 小时
- 涉及模块：前端、后端、数据库等
- 任务数量：X 个

建议使用 `longcode` skill 来完成：
- 交互式收集完整需求
- 自动拆解为小任务
- 自主执行，过程中无需你参与
- 自动测试、审查、提交代码

是否使用 longcode 来完成这个任务？ (y/n)
```

### 执行方式

用户确认后，使用以下方式启动：

```
# 方式 1：使用 slash command
/longcode

# 方式 2：直接描述需求
用户: "用 longcode 创建一个xxx功能"
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

每次开始工作时，Claude 应该：
- [ ] 读取此 CLAUDE.md 文件
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

**最后更新：2026-02-22**
**版本：2.1 - 集成 proactive-agent skill 和权限优化**
**维护者：Claude + 用户协作制定**
