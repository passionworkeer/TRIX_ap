# TRIX 3D Companion - Claude Code 工作流程指南

## 📋 当前已安装的能力

### 核心插件
- **全局 Claude skills/agents**: 以 `C:\Users\wang\.claude\skills` 和 `C:\Users\wang\.claude\agents` 中的实际内容为准
- **32个独立skills**: API设计、测试、Docker、K8s、监控等

### 规则
- TypeScript 最佳实践
- 通用编码标准

---

## 🎯 推荐的简化工作流程

### 1️⃣ **开始新功能** (最重要！)

```
我想实现 [功能描述]
```

**我会自动：**
- 使用 `brainstorming` skill 探索需求
- 使用内置 `Plan` agent 或 `project-manager` 做计划
- 使用 `tdd-guide` skill 指导 TDD 开发

---

### 2️⃣ **TDD 开发流程**

如果本地没有 `/tdd` slash command，直接说：
```
用 TDD 实现 [功能描述]
```

**或者直接说：**
```
用 TDD 方式实现 [功能]
```

**我会：**
1. 先写测试
2. 实现代码
3. 运行测试验证
4. 重构优化

---

### 3️⃣ **代码审查**

```
请审查这段代码的安全性
```

**或者：**
```
请用 senior-dev 审查这段代码
```

**我会使用：**
- `api-security-best-practices` skill
- `api-security-best-practices` skill

---

### 4️⃣ **修复 Bug**

```
/systematic-debugging
```

**或者：**
```
帮我系统性地调试这个问题
```

---

### 5️⃣ **部署和 DevOps**

```
帮我配置 Docker 部署
```

**我会使用：**
- `docker` skill
- `devops-engineer` skill
- `devops-engineer` skill

---

## 💾 记忆和优化

### 记忆系统（已安装）

我会自动：
- ✅ 使用 Memory MCP 保存重要决策和模式
- ✅ 跨会话记住项目上下文
- ✅ 持续学习你的编码风格

### 查看记忆
```
你记住了什么关于这个项目的信息？
```

### 清理记忆
```
清除关于 [特定主题] 的记忆
```

---

## 🎓 高级用法（可选）

### 端到端测试
如果本地没有 `/e2e` slash command，直接说：
```
做一次端到端测试
```

### 性能优化
```
优化这个页面的性能
```

### API 设计
```
设计一个 RESTful API 用于 [功能]
```

---

## ✅ 最佳实践

### DO ✅
1. **简单直接地描述需求** - 不需要指定使用哪个 skill
2. **信任自动触发** - 我会根据上下文自动选择合适的 skill
3. **使用自然语言** - 就像和同事对话一样

### DON'T ❌
1. ❌ 不要试图记住所有命令
2. ❌ 不要手动指定 skill（除非特殊情况）
3. ❌ 不要担心"是否用对了工具" - 我会处理

---

## 🚀 快速参考

| 你想说 | 直接说 | 我会用什么 |
|--------|--------|-----------|
| "我想加个功能" | "我想实现用户登录" | brainstorming → tdd-guide |
| "帮我写测试" | "为这个函数写测试" | tdd-guide, javascript-testing-patterns |
| "检查代码安全" | "审查这段代码" | api-security-best-practices |
| "优化性能" | "这个页面加载太慢" | performance skill |
| "部署到服务器" | "帮我部署到生产环境" | docker, devops-engineer |

---

## 📌 记住

**最重要的是：用自然语言描述你想做什么，剩下的交给我！**

我会自动：
- 选择合适的 skills
- 调用正确的 agents
- 应用相关规则
- 记住重要决策
- 优化工作流程

---

## 🔄 持续改进

每次会话后，你可以问：
```
这次工作中有什么可以改进的地方？
```

我会：
- 反思工作流程
- 提出优化建议
- 更新记忆系统
- 进化编码模式
