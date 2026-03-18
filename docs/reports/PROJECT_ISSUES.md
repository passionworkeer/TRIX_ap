# 项目问题总览

> 最后更新: 2026-03-18
> 状态: 活跃开发中

本文档汇总 TRIX 3D Companion 项目各端（Web、iOS）的所有已知问题。

---

## 📊 问题统计总表

| 端 | P0 致命 | P1 高 | P2 中 | P3 低 | 总计 |
|----|---------|-------|-------|-------|------|
| **Web** | 1 | 0 | 0 | 0 | **1** |
| **iOS** | 0 | 0 | 0 | 0 | **0** |
| **总计** | 1 | 0 | 0 | 0 | **1** |

---

## 🌐 Web 端问题

### 🔴 P0 - 致命问题 (1项)

| # | 问题 | 文件 | 状态 |
|---|------|------|------|
| W1 | GatewayContext 配对功能空实现 | `GatewayContext.tsx:123-132` | ❌ 未修复 |

**代码确认**:
```typescript
const pairWithCode = useCallback(async (_code: string) => {
  // TODO: Implement pairing via server
  try {
    return { success: true };  // 无论输入什么，都返回成功
  } catch (error) {
    return { success: false, error: String(error) };
  }
}, []);
```

---

### 🟠 P1 - 高优先级 (已解决)

| # | 问题 | 文件 | 状态 |
|---|------|------|------|
| W2 | localStorage 存储非敏感配置 | clawbotPairingService.ts | ✅ 已改进 |

**改进说明**: device_token 已移除，改用内存存储。仅存储配置数据:
- `clawbot_node_id` (节点ID)
- `clawbot_gateway_url` (网关配置)
- `clawbot_pairing_token` (配对令牌)

---

### 🟡 P2 - 中优先级 (已解决)

| # | 问题 | 状态 |
|---|------|------|
| W3 | 测试 mock 不完整 | ✅ 已修复 (0 failed, 679 passed) |

---

### 🟢 P3 - 低优先级 (已解决)

| # | 问题 | 状态 |
|---|------|------|
| W4 | 学习房间邀请功能 | ✅ 已确认满足需求 |

---

### ✅ Web 端已修复 (2026-03-17)

| # | 问题 | 提交 | 状态 |
|---|------|------|------|
| - | AuthContext 静默错误处理 | 289d2d2 | ✅ |
| - | App.tsx 未使用导入 | 289d2d2 | ✅ |
| - | 路由重复问题 | 289d2d2 | ✅ |
| - | console.log 残留 (~14处) | 289d2d2 | ✅ |
| - | 测试兼容性修复 | 8a07822 | ✅ |
| - | ChatDetail 大文件拆分 | - | ✅ (1439→905行) |
| - | TypeScript any 类型 | - | ✅ (生产代码无 any) |

---

## 🍎 iOS 端问题

### ✅ 所有问题已修复 (2026-03-18)

| # | 问题 | 修复日期 | 状态 |
|---|------|----------|------|
| I1 | 聊天界面点击无反应 | 2026-03-18 | ✅ 已修复 |
| I2 | 主题切换功能 | 2026-03-18 | ✅ 已实现 |
| I3 | 三语言国际化 | 2026-03-18 | ✅ 已修复 |
| I4 | UI 组件美化 | 2026-03-18 | ✅ 已修复 (21个文件主题色统一) |

---

### ✅ iOS 端已修复

| # | 问题 | 状态 |
|---|------|------|
| - | Socket.IO 支持 | ✅ 已实现 (ClawbotChannelService.swift) |
| - | 后端 API 接入 | ✅ User/Friend/Chat 等 20+ 模块 |
| - | 配对功能 | ⚠️ 基础实现完成 |

---

## 🎯 修复优先级

### 唯一剩余问题

1. **Web**: 实现 GatewayContext 配对功能 (W1) - 🔴 P0 致命

---

*所有其他问题已修复 ✅*

---

## 📁 相关文档

- Web 端详细问题: [`WEB_TODO.md`](../../WEB_TODO.md)
- iOS 端详细问题: [`docs/ios/IOS_ISSUES.md`](./IOS_ISSUES.md)
- 修复记录: [`docs/reports/FIXES_20260313.md`](./reports/FIXES_20260313.md)

---

## 🔧 开发环境

| 服务 | 端口 | 地址 |
|------|------|------|
| Vite Dev Server | 5173 | http://localhost:5173 |
| Clawbot Channel | 8765 | ws://localhost:8765 |
| Gateway | 18789 | ws://localhost:18789 |
| TRIX Native | 8788 | http://localhost:8788 |

---

*更新时间: 2026-03-18*
