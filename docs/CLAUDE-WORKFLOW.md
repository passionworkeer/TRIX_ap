# Claude 工作流程速查表

本文档提供 Claude 开发 TRIX 项目时的快速参考。

## 🚀 快速开始

### 简单任务（< 1 个文件）
1. 编写测试
2. 实现功能
3. 运行验证
4. 提交代码

### 复杂任务（> 3 个文件）
1. 使用 `brainstorming` skill
2. 使用 `end-to-end-delivery` skill（自动创建 STATE.md）
3. 系统自动执行
4. 验证交付

---

## 📋 必用 Skills

### 开发前
- **brainstorming** - 探索需求和设计
- **trix-workflow** - 查找项目模式和最佳实践

### 开发中
- **test-driven-development** - 遵循 TDD 流程
- **systematic-debugging** - 系统化调试问题
- **trix-workflow** - 查阅模式和参考代码

### 交付前
- **verification-before-completion** - 完整检查清单
- **requesting-code-review** - 代码审查

---

## ✅ 交付检查清单

### 代码质量
- [ ] `npm test` - 所有测试通过
- [ ] `npm run type-check` - 类型检查通过
- [ ] `npm run lint` - Lint 检查通过
- [ ] `npm run build` - 构建成功

### 功能验证
- [ ] 功能符合需求
- [ ] 边界情况处理
- [ ] 错误处理完善
- [ ] 用户友好提示

### 测试覆盖
- [ ] 单元测试（关键函数）
- [ ] 集成测试（如需要）
- [ ] 回归测试（修复 Bug 时）

### CI/CD 验证
- [ ] 本地检查通过
- [ ] Git commit 成功
- [ ] Push 到远程
- [ ] CI 流水线通过

---

## 🎯 常见模式

### 配对状态一致性
参考：`.claude/patterns/pairing-state-consistency.md`
- 先检查 Bot 在线
- 验证 Token
- 执行原子绑定

### 消息确认链路
参考：`.claude/patterns/message-ack-chain.md`
- 返回 `Promise<void>`
- 正确的错误处理
- 状态管理

### 路由配置
参考：`.claude/patterns/routing-conflicts.md`
- 使用字面路径
- 避免枚举冲突
- 组件内路由处理

---

## 🔧 常用命令

### 开发
```bash
npm run dev              # 启动开发服务器
npm run build            # 构建生产版本
npm run preview          # 预览构建
```

### 测试
```bash
npm test                 # 监听模式
npm run test:run         # 运行一次
npm run test:ui          # 可视化界面
npm run test:coverage    # 覆盖率报告
```

### 质量
```bash
npm run lint             # ESLint 检查
npm run type-check       # TypeScript 检查
```

### 诊断
```bash
./scripts/doctor.sh      # 快速诊断
```

---

## 📚 重要文档

### 项目文档
- `README.md` - 项目总览
- `GITHUB_ACTIONS_GUIDE.md` - CI/CD 指南
- `DEPLOY_GUIDE.md` - 部署指南

### 开发文档
- `docs/TDD-EXAMPLES.md` - TDD 示例
- `docs/STATE-TEMPLATE.md` - STATE.md 模板

### 模式库
- `.claude/patterns/` - 问题-解决方案模式
- `.claude/skills/trix-workflow/SKILL.md` - 项目工作流

---

## 🔄 完整工作流

```
1. 接收任务
   ↓
2. brainstorming（探索需求）
   ↓
3. 查阅 trix-workflow（查找模式）
   ↓
4. 编写测试（TDD）
   ↓
5. 实现功能
   ↓
6. 运行测试验证
   ↓
7. 遇到问题？→ systematic-debugging
   ↓
8. verification-before-completion（检查）
   ↓
9. requesting-code-review（审查）
   ↓
10. 提交代码
    ↓
11. CI 自动运行
```

---

## 💡 最佳实践

### 1. 总是先写测试
```typescript
// ❌ 错误
function add(a, b) { return a + b }
test('add works', () => {
  expect(add(1, 2)).toBe(3)
})

// ✅ 正确
test('add works', () => {
  expect(add(1, 2)).toBe(3)
})
function add(a, b) { return a + b }
```

### 2. 使用类型保护
```typescript
const isPairingStatus = (value: unknown): value is PairingStatus => {
  return typeof value === 'string' &&
    ['pending', 'paired', 'failed'].includes(value)
}
```

### 3. 集中化错误处理
```typescript
try {
  await operation()
} catch (error) {
  errorHandler.handleError(error)
}
```

### 4. 明确的 Commit 消息
```
feat(pairing): add QR code pairing

Problem: Users need easier way to pair with bots
Solution: Implement QR code scanning

Fixes: #123
```

---

## 🆘 遇到问题

### 测试失败
1. 使用 `systematic-debugging` skill
2. 检查测试隔离
3. 验证 mocks 配置

### 类型错误
1. 运行 `npm run type-check`
2. 检查类型定义
3. 添加类型保护

### 构建失败
1. 运行 `./scripts/doctor.sh`
2. 检查依赖版本
3. 清理缓存重新安装

---

## 🎓 学习资源

### 内部
- `.claude/skills/test-driven-development/SKILL.md`
- `.claude/skills/systematic-debugging/SKILL.md`
- `.claude/skills/end-to-end-delivery/SKILL.md`

### 外部
- [Vitest 文档](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [React 文档](https://react.dev/)
