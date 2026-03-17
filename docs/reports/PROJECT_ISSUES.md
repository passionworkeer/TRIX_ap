# 项目问题总览

> 最后更新: 2026-03-18
> 状态: 活跃开发中

本文档汇总 TRIX 3D Companion 项目各端（Web、iOS）的所有已知问题。

---

## 📊 问题统计总表

| 端 | P0 致命 | P1 高 | P2 中 | P3 低 | 总计 |
|----|---------|-------|-------|-------|------|
| **Web** | 1 | 1 | 1 | 1 | **4** |
| **iOS** | 1 | 2 | 1 | 0 | **4** |
| **总计** | 2 | 3 | 2 | 1 | **8** |

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

### 🟠 P1 - 高优先级 (1项)

| # | 问题 | 文件 | 状态 |
|---|------|------|------|
| W2 | localStorage 存储非敏感配置 | clawbotPairingService.ts | ⚠️ 已改进 |

**当前状态**: device_token 已移除，改用内存存储。仍存储:
- `clawbot_node_id` (节点ID)
- `clawbot_gateway_url` (网关配置)
- `clawbot_pairing_token` (配对令牌)

这些是配置数据，安全性已改进。

---

### 🟡 P2 - 中优先级 (1项)

| # | 问题 | 状态 |
|---|------|------|
| W3 | 测试 mock 不完整 | ⚠️ 678 passed, 511 skipped |

---

### 🟢 P3 - 低优先级 (1项)

| # | 问题 | 状态 |
|---|------|------|
| W4 | 学习房间邀请功能未实现 | ❌ 未修复 |

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

### 🔴 P0 - 致命问题 (1项)

| # | 问题 | 文件 | 状态 |
|---|------|------|------|
| I1 | 聊天界面点击无反应 | ChatListView.swift | ❌ 未修复 |

---

### 🟠 P1 - 高优先级 (2项)

| # | 问题 | 状态 |
|---|------|------|
| I2 | 主题切换功能未实现 | ❌ 未修复 |
| I3 | 三语言国际化未完成 | ❌ 未修复 |

---

### 🟡 P2 - 中优先级 (1项)

| # | 问题 | 状态 |
|---|------|------|
| I4 | UI 组件美化 | ❌ 未修复 |

---

### ✅ iOS 端已修复

| # | 问题 | 状态 |
|---|------|------|
| - | Socket.IO 支持 | ✅ 已实现 (ClawbotChannelService.swift) |
| - | 后端 API 接入 | ✅ User/Friend/Chat 等 20+ 模块 |
| - | 配对功能 | ⚠️ 基础实现完成 |

---

## 🎯 修复优先级

### 第一阶段：P0 致命问题

1. **Web**: 实现 GatewayContext 配对功能 (W1)
2. **iOS**: 修复点击无反应问题 (I1) - 需要真机测试

### 第二阶段：P1 高优先级

3. **iOS**: 实现主题切换 (I2)
4. **iOS**: 完成国际化 (I3)

### 第三阶段：P2 中优先级 / P3

5. **Web**: 学习房间邀请功能 (W4)
6. **iOS**: UI 美化 (I4)

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
