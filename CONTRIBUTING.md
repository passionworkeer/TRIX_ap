# CONTRIBUTING.md - 贡献指南

> 感谢你对 TRIX 3D Companion 的兴趣！本文档将帮助你了解如何参与项目贡献。

---

## 🤝 协作模式

### 核心原则

| 原则 | 描述 |
|------|------|
| **用户负责** | 用最简单的话语描述需求 + 验收成果 |
| **Claude 负责** | 技术实现、测试、审查、文档、总结工作 |
| **双人舞** | 人类与 AI 协作，优势互补 |

### 工作流程

```
需求 → 理解 → 计划 → 实现 → 审核 → 测试 → 交付 → 总结
```

---

## 📋 贡献类型

### 🐛 Bug 报告

请在 GitHub Issues 中提交，包含以下信息：

```markdown
## Bug 描述
[清晰描述问题]

## 复现步骤
1. 打开...
2. 点击...
3. 出现...

## 预期行为
[你期望发生什么]

## 实际行为
[实际发生了什么]

## 环境
- OS: Windows 11
- 浏览器: Chrome 120+
- 版本: latest
```

### 💡 功能建议

```markdown
## 功能描述
[你想要的功能]

## 使用场景
[什么场景下会用到]

## 解决方案建议
[如果有的话]
```

### 🔧 代码贡献

#### 1. 任务分工

本项目使用 **AI Agent 协作模式**：

| 任务类型 | 负责 Agent | 说明 |
|---------|-----------|------|
| 前端 UI | frontend-dev | React + TypeScript |
| 后端逻辑 | backend-dev | Node.js + Express |
| iOS 开发 | frontend-dev | SwiftUI + Swift |
| 安全审核 | senior-dev | **必须** |
| 测试验证 | junior-dev | **必须** |

> ⚠️ **重要**: 所有代码修改必须经过安全审核和测试验证

#### 2. 提交规范

```bash
# 提交信息格式
<type>: <description>

# Type 类型
feat:     新功能
fix:      Bug 修复
refactor: 代码重构
docs:     文档更新
test:     测试相关
chore:    构建/工具
perf:     性能优化
ci:       CI/CD 相关

# 示例
feat: 添加学习统计周报功能
fix: 修复聊天消息发送失败问题
docs: 更新 API 文档
```

#### 3. 分支策略

```
main          # 生产分支
├── develop   # 开发分支
├── feature/* # 功能分支
├── fix/*     # 修复分支
└── docs/*    # 文档分支
```

---

## 🛠️ 开发环境

### 前置要求

| 工具 | 版本要求 | 说明 |
|------|---------|------|
| Node.js | >= 18 | 前端开发 |
| npm | >= 9 | 包管理 |
| Git | >= 2.30 | 版本控制 |

### 本地开发

```bash
# 1. 克隆项目
git clone https://github.com/your-repo/trix-3d-companion.git
cd trix-3d-companion

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填入真实配置

# 4. 启动开发服务器
npm run dev
```

详细配置见 [SETUP.md](./SETUP.md)

---

## 📝 代码规范

### TypeScript

- 使用 **TypeScript 严格模式**
- 所有函数必须有类型注解
- 公共 API 必须有 JSDoc 注释
- **禁止** 使用 `any` 类型（除非必要并有注释）
- **禁止** 使用 `console.log`（使用日志系统）

### React

- 使用函数式组件 + Hooks
- 组件文件使用 PascalCase
- 自定义 Hook 以 `use` 开头
- 优先使用组合而非继承

### 项目结构

```
src/
├── screens/         # 页面组件 (18个)
├── components/     # React 组件 (48个)
├── contexts/       # React Context (6个)
├── features/       # 按功能模块组织 (5个)
├── services/       # 业务服务 (26个)
├── hooks/         # 自定义 Hooks (12个)
├── types/         # TypeScript 类型
└── utils/         # 工具函数
```

### Swift (iOS)

- 遵循 SwiftLint 规则
- **禁止** Force unwrap (`!`)
- 使用 `@available` 标记版本特性
- 参考 Web 端保持字段名一致

### Git Commit

- 每功能一提交
- 提交信息清晰描述变更
- 包含 Co-Authored-By 归因

---

## 🧪 测试要求

### 测试覆盖率目标

| 类型 | 目标 | 工具 |
|------|------|------|
| 单元测试 | 80%+ | Vitest |
| 集成测试 | 关键路径 | Vitest + Supertest |
| E2E 测试 | 关键流程 | Playwright |

### 运行测试

```bash
# 运行所有测试 (单元 + 冒烟 + 服务端)
npm run test

# 单元测试
npm run test:unit

# 单元测试 (监听模式)
npm run test:unit:watch

# 测试覆盖率
npm run test:unit:coverage

# E2E 测试
npm run test:e2e
```

---

## 🔒 安全要求

### 必须检查

- [ ] 无硬编码 secrets（API keys, passwords）
- [ ] 所有用户输入已验证
- [ ] 无 SQL 注入风险（使用参数化查询）
- [ ] 无 XSS 风险（正确转义 HTML）
- [ ] 权限验证正确

### 敏感信息

- **禁止** 将 secrets 提交到仓库
- 使用 `.env` 文件存储本地配置
- `.env.example` 包含所有需要的环境变量名（不含真实值）

---

## 📖 文档更新

### 文档位置

| 文档 | 位置 |
|------|------|
| API 文档 | `API.md` / `docs/API_DOCUMENTATION.md` |
| 架构文档 | `ARCHITECTURE.md` / `docs/development/ARCHITECTURE.md` |
| 用户指南 | `docs/guides/` |
| 数据库 Schema | `docs/DATABASE_SCHEMA.md` |

### 更新要求

- API 变更必须同步更新文档
- 新功能需要更新 FEATURES.md
- 重大变更需要更新 CHANGELOG.md

---

## ❓ 获取帮助

| 渠道 | 说明 |
|------|------|
| GitHub Issues | Bug 报告和功能建议 |
| 项目文档 | `docs/INDEX.md` 完整索引 |

---

## 📜 许可证

本项目基于 MIT 许可证开源。

---

**最后更新**: 2026-04-03
