# TRIX 3D Companion - Clawbot 集成文档索引

> **最后更新**: 2026-02-11

---

## 📚 文档导航

### 快速开始

| 文档 | 描述 | 适用人群 |
|------|------|----------|
| [CLAWBOT_QUICK_START.md](./CLAWBOT_QUICK_START.md) | 5分钟快速上手指南 | 所有用户 |

### 实现方案

| 文档 | 描述 | 代码量 | 适用场景 |
|------|------|--------|----------|
| [CLAWBOT_SIMPLE_IMPLEMENTATION.md](./CLAWBOT_SIMPLE_IMPLEMENTATION.md) | 简化版实现方案 | ~150行 | 开发测试 |
| [CLAWBOT_INTEGRATION_GUIDE.md](./CLAWBOT_INTEGRATION_GUIDE.md) | 完整版实现方案 | ~500行 | 生产环境 |

### 协议规范

| 文档 | 描述 | 内容 |
|------|------|------|
| [CLAWBOT_GATEWAY_INTEGRATION.md](./CLAWBOT_GATEWAY_INTEGRATION.md) | WebSocket 协议规范 | 握手、消息格式、故障排查 |

---

## 🚀 推荐阅读路径

### 路径 1: 快速验证（15分钟）

适合：想要快速验证功能的开发者

1. **[快速开始指南](./CLAWBOT_QUICK_START.md)** - 了解基本概念
2. **[简化版实现](./CLAWBOT_SIMPLE_IMPLEMENTATION.md)** - 复制代码测试

### 路径 2: 完整集成（2小时）

适合：准备在生产环境使用的开发者

1. **[快速开始指南](./CLAWBOT_QUICK_START.md)** - 了解核心流程
2. **[协议规范](./CLAWBOT_GATEWAY_INTEGRATION.md)** - 理解通信协议
3. **[完整实现方案](./CLAWBOT_INTEGRATION_GUIDE.md)** - 实现所有功能

### 路径 3: 深度定制（1天+）

适合：需要深度定制的开发者

1. 阅读所有文档
2. 根据需求选择功能模块
3. 参考协议规范进行定制

---

## 📋 核心概念

### 扫码配对流程

> **重要**: 正确的配对流程是 **电脑端 Gateway 生成二维码 → 手机 App 扫描配对**

```
┌─────────────┐         生成二维码         ┌─────────────┐
│  电脑端     │ ──────────────────────────>│  手机 App   │
│  Clawbot    │     显示供手机扫描          │  扫码连接    │
│  Gateway    │<───────────────────────────│             │
└─────────────┘     配对成功确认           └─────────────┘
```

### 安全隔离方案

| 层级 | 方案 | 描述 |
|------|------|------|
| 1. 设备隔离 | 独立 Token | 每个设备使用独立的认证 Token |
| 2. 权限管理 | 角色控制 | basic / full / admin 三级权限 |
| 3. 网络隔离 | 防火墙 | 限制局域网访问 |
| 4. 会话隔离 | 消息队列 | 每个设备独立会话 |
| 5. 审计日志 | 操作记录 | 完整的操作日志跟踪 |

---

## 🔧 技术栈

```
Frontend:  React 19.2.4 + TypeScript 5.8.2
Build:     Vite 6.2.0
Database:  Supabase (PostgreSQL)
Realtime:  Supabase Realtime + WebSocket
Gateway:   Clawbot Gateway (OpenClaw)
```

---

## 📖 文档详情

### 1. CLAWBOT_QUICK_START.md

**内容**:
- 核心流程图
- 二维码内容格式
- 配对消息协议
- 安全隔离方案
- 简化版 vs 完整版对比

**适合**: 所有用户首次阅读

### 2. CLAWBOT_SIMPLE_IMPLEMENTATION.md

**内容**:
- 最小化配置步骤
- ~150 行核心代码
- Token 认证
- 设备隔离
- 测试验证清单

**适合**:
- 快速原型验证
- 开发测试环境
- 学习集成流程

### 3. CLAWBOT_INTEGRATION_GUIDE.md

**内容**:
- 完整的扫码配对流程
- 增强型 WebSocket 连接
- 心跳机制 & 自动重连
- 消息队列管理
- 多媒体消息支持
- 数据库设计

**适合**:
- 生产环境部署
- 长期使用
- 需要完整功能

### 4. CLAWBOT_GATEWAY_INTEGRATION.md

**内容**:
- WebSocket 协议规范
- 连接握手流程
- 消息格式定义
- API 参考
- 故障排查指南

**适合**:
- 理解底层协议
- 定制化开发
- 问题诊断

---

## ❓ 常见问题

### Q: 我应该选择简化版还是完整版？

**A**: 根据使用场景选择：

| 需求 | 推荐方案 |
|------|----------|
| 快速验证功能 | 简化版 |
| 开发测试 | 简化版 |
| 学习集成流程 | 简化版 |
| 生产环境使用 | 完整版 |
| 长期稳定运行 | 完整版 |
| 需要多媒体功能 | 完整版 |
| 需要自动重连 | 完整版 |

### Q: 简化版可以升级到完整版吗？

**A**: 可以。简化版和完整版使用相同的协议，可以无缝升级。

### Q: 如何保证安全？

**A**: 建议实施以下安全措施：

1. ✅ 使用强随机 Token（至少 32 字符）
2. ✅ 启用设备隔离（每个设备独立 Token）
3. ✅ 限制网络访问（仅局域网）
4. ✅ 启用审计日志（记录所有操作）
5. ✅ 定期轮换 Token（建议每月）

### Q: 连接失败怎么办？

**A**: 按以下步骤排查：

1. 检查 Gateway 是否运行：`curl http://127.0.0.1:18789/health`
2. 检查网络连通性：`ping 192.168.1.100`
3. 检查防火墙设置
4. 验证 Token 配置
5. 查看 Gateway 日志

详见：[故障排查](./CLAWBOT_GATEWAY_INTEGRATION.md#故障排查)

---

## 📞 获取帮助

- **GitHub Issues**: [项目 Issues 页面]
- **文档**: [在线文档]
- **示例代码**: [examples/](../examples/)

---

**文档维护**: TRIX 3D Companion 开发团队
**最后更新**: 2026-02-11
