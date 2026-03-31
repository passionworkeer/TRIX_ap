# 文档规范指南

> 📚 本指南定义了项目文档的组织方式、编写规范和维护策略

---

## 🎯 文档分层策略

### 第一层：项目根目录核心文档（必须）

```
/
├── CLAUDE.md              # Claude 协作协议（已有）
├── docs/architecture/WEB_ARCHITECTURE.md   # 核心架构文档（已创建）
├── README.md              # 项目介绍（已有）
├── CONTRIBUTING.md        # 贡献指南（已有）
└── CHANGELOG.md           # 变更日志（待创建）
```

**适用场景**：
- 新人快速了解项目
- Claude 新会话时自动加载
- 重要决策的永久记录

### 第二层：docs 目录专题文档（按需）

```
docs/
├── api/                   # API 文档
│   ├── rest-api.md
│   └── websocket-events.md
├── guides/                # 使用指南
│   ├── deployment.md
│   └── troubleshooting.md
├── decisions/             # 架构决策记录（ADRs）
│   ├── 001-use-supabase.md
│   └── 002-hash-router.md
└── project-reports/       # 项目报告
    ├── PROJECT.md         # 项目概览（已有）
    └── progress-*.md      # 进度报告
```

**适用场景**：
- 详细的技术指南
- 特定主题的深入说明
- 需要频繁更新的文档

### 第三层：模块级 README（仅复杂模块需要）

```
src/features/chat/
├── README.md              # 聊天模块说明
├── components/
├── hooks/
└── services/

packages/trix-openclaw-native/
├── README.md              # 包说明
├── src/
│   ├── plugin/            # OpenClaw 插件
│   └── cli.ts             # CLI 入口
└── package.json
```

**适用场景**（仅当满足以下条件时创建）：
- ✅ 模块独立性强，可单独部署
- ✅ 模块复杂度高（>10 个文件）
- ✅ 有独立的配置和 API
- ❌ 简单的工具函数目录不需要
- ❌ <10 个文件的模块不需要

### ❌ 不需要 README 的情况

```
src/utils/                 # ❌ 简单工具函数，不需要
├── format.ts
└── validate.ts

src/hooks/                 # ❌ 自定义 Hooks，代码即文档
├── useAuth.ts
└── useSocket.ts

src/components/            # ❌ UI 组件，Props 类型即文档
├── Button.tsx
└── Modal.tsx
```

---

## 📝 何时创建文档

### 必须创建文档的场景

| 场景 | 文档类型 | 位置 |
|------|----------|------|
| 重大架构变更 | ADR | `docs/decisions/` |
| 新增独立服务 | README | 服务根目录 |
| API 变更 | API 文档 | `docs/api/` |
| 部署流程变更 | 部署指南 | `docs/guides/` |
| 技术选型决策 | 架构文档 | `docs/architecture/WEB_ARCHITECTURE.md` |
| 用户偏好变化 | Memory MCP | 实体记录 |

### 不需要创建文档的场景

| 场景 | 原因 |
|------|------|
| 新增简单组件 | 代码 + TypeScript 类型即文档 |
| 修复 Bug | Git commit message 足够 |
| 重构代码结构 | 如果架构未变，无需文档 |
| 临时实验功能 | 等稳定后再记录 |

---

## 🎨 文档编写规范

### 1. docs/architecture/WEB_ARCHITECTURE.md 更新规范

**何时更新**：
- 技术栈变更（添加/移除依赖）
- 架构模式调整（如引入新的设计模式）
- 重大架构决策（新增 ADR 章节）
- 性能优化策略变更
- 安全措施调整

**更新示例**：
```markdown
## 技术栈选型

| 技术 | 选型 | 理由 | 更新日期 |
|------|------|------|----------|
| React | 19 | 最新特性 | 2026-02-20 |
| 新增 | Zustand | 状态管理复杂度增加 | 2026-02-21 |
```

### 2. ADR (架构决策记录) 编写规范

**模板**：
```markdown
# ADR-XXX: 决策标题

**状态**：提议中 / 已采纳 / 已废弃

**上下文**：
- 问题描述
- 影响范围
- 相关技术

**决策**：
- ✅ 优点 1
- ✅ 优点 2
- ❌ 缺点 1
- ❌ 缺点 2

**后果**：
- 需要做什么
- 影响哪些模块
- 未来可能的调整

**相关链接**：
- [讨论 Issue]()
- [相关代码]()
```

### 3. 模块 README 编写规范

**模板**：
```markdown
# 模块名称

> 一句话描述模块功能

## 职责

- 负责 XXX
- 不负责 YYY

## 核心文件

| 文件 | 用途 |
|------|------|
| `index.ts` | 入口文件 |
| `service.ts` | 业务逻辑 |

## 使用示例

\`\`\`typescript
import { something } from './module';

something();
\`\`\`

## 配置

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| API_URL | API 地址 | - |

## 相关文档

- [API 文档](../../docs/api/xxx.md)
- [架构说明](../../docs/architecture/WEB_ARCHITECTURE.md#xxx)
```

---

## 🧠 Memory MCP 使用规范

### 必须记录的内容

| 类型 | 示例 | 更新时机 |
|------|------|----------|
| **技术选型** | 为什么用 Supabase | 做决策时 |
| **架构模式** | 三层布局设计 | 设计确定后 |
| **编码约定** | 目录组织原则 | 约定形成时 |
| **用户偏好** | 喜欢按功能组织 | 发现时立即记录 |
| **常见陷阱** | WebSocket 重连问题 | 解决问题后 |
| **可复用模式** | 毛玻璃组件体系 | 模式成熟后 |

### 不需要记录的内容

| 类型 | 原因 |
|------|------|
| 具体代码实现 | 代码即文档 |
| 临时调试信息 | 无长期价值 |
| 第三方库用法 | 有官方文档 |
| 明显的最佳实践 | 不需要特殊记忆 |

### 记录格式示例

```typescript
// ✅ 好的记录：架构决策 + 理由
{
  name: "选择 Supabase 而非 Firebase",
  entityType: "架构决策",
  observations: [
    "PostgreSQL 比 NoSQL 更适合关系型数据",
    "RLS 提供细粒度权限控制",
    "缺点：生态不如 Firebase 成熟"
  ]
}

// ❌ 不好的记录：过于具体，缺乏上下文
{
  name: "用户表结构",
  observations: [
    "有 id, email, name 字段",  // ❌ 代码里有，不需要记录
    "使用 UUID 作为主键"         // ❌ 过于具体
  ]
}
```

---

## 🔄 文档维护流程

### 开发新功能时

```
1. 开始前
   ├─ 查询 Memory MCP（相关决策）
   ├─ 读取 docs/architecture/WEB_ARCHITECTURE.md（整体架构）
   └─ 确认是否需要新建文档

2. 开发中
   ├─ 如果涉及架构变更 → 更新 docs/architecture/WEB_ARCHITECTURE.md
   ├─ 如果是重大决策 → 创建 ADR
   └─ 如果是新模块 → 决定是否需要 README

3. 完成后
   ├─ 记录新决策到 Memory MCP
   ├─ 更新相关文档
   └─ 删除过时文档
```

### 发现文档过时时

```
1. 评估影响
   ├─ 如果是错误信息 → 立即修正
   ├─ 如果是过时设计 → 标记为【已过时】
   └─ 如果是可选内容 → 删除或归档

2. 更新文档
   ├─ 修正错误信息
   ├─ 添加变更日期
   └─ 更新相关链接

3. 通知相关方
   └─ 在 commit message 中说明文档变更
```

---

## ✅ 文档质量检查清单

### 创建新文档前

- [ ] 是否真的需要文档？代码能否自解释？
- [ ] 文档位置是否正确（根目录 / docs / 模块）？
- [ ] 是否与现有文档重复？
- [ ] 能否用 Memory MCP 替代？

### 编写文档时

- [ ] 结构清晰，易于导航？
- [ ] 代码示例是否可运行？
- [ ] 链接是否有效？
- [ ] 是否包含"为什么"（不仅仅是"是什么"）？

### 完成文档后

- [ ] 是否同步到 Memory MCP（如果需要）？
- [ ] 是否更新了 docs/architecture/WEB_ARCHITECTURE.md（如果涉及架构）？
- [ ] 是否通知了相关开发者？

---

## 📊 文档 ROI 评估

### 高价值文档（优先维护）

| 类型 | ROI | 原因 |
|------|-----|------|
| docs/architecture/WEB_ARCHITECTURE.md | ⭐⭐⭐⭐⭐ | 每个新会话都会读取 |
| ADR | ⭐⭐⭐⭐⭐ | 避免重复讨论已决策事项 |
| Memory MCP | ⭐⭐⭐⭐⭐ | 跨会话永久记忆 |
| API 文档 | ⭐⭐⭐⭐ | 团队协作必需 |

### 低价值文档（谨慎创建）

| 类型 | ROI | 原因 |
|------|-----|------|
| 工具函数 README | ⭐ | 代码即文档 |
| 临时修复记录 | ⭐⭐ | Bug 修复后即过时 |
| 详细的内部实现 | ⭐⭐ | 变化频繁，难以维护 |

---

## 🎯 总结：文档创建决策树

```
需要文档吗？
├─ 是，项目级别 → 根目录 CLAUDE.md / docs/architecture/WEB_ARCHITECTURE.md
├─ 是，专题级别 → docs/ 目录
├─ 是，模块级别 → 模块是否独立且复杂？
│   ├─ 是 → 创建模块 README
│   └─ 否 → 代码注释 + TypeScript 类型
├─ 是，决策级别 → 记录到 Memory MCP
└─ 否 → 不创建文档
```

---

**最后更新**：2026-03-31
**维护者**：Claude + 用户协作
**版本**：1.0
