# Web 端待处理问题清单

> 生成日期：2026-03-17
> 最后更新：2026-03-18

---

## ✅ 已修复问题

| # | 问题 | 修复提交 | 状态 |
|---|------|----------|------|
| 1 | AuthContext 静默错误处理 (4处) | 289d2d2 | ✅ |
| 2 | App.tsx 未使用导入 | 289d2d2 | ✅ |
| 3 | 路由重复 (/chat/detail vs /chat/:friendId) | 289d2d2 | ✅ |
| 4 | CHAT_DETAIL 常量未使用 | 289d2d2 | ✅ |
| 5 | console.log 残留 (~14处) | 289d2d2 | ✅ |
| 6 | 测试兼容性问题 | 8a07822 | ✅ |
| 7 | ChatDetail.tsx 大文件 | - | ✅ (1439→905行) |
| 8 | TypeScript any 类型 | - | ✅ (生产代码无 any) |

---

## 🔴 P0 - 致命问题

### 1. GatewayContext 配对功能空实现

**文件**: `src/contexts/GatewayContext.tsx:123-132`

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

**影响**: 配对功能完全不可用，安全性为零

**修复**: 必须实现真实的配对码验证逻辑

---

## 🟠 P1 - 高优先级

### 2. localStorage 存储配置

**文件**: 多处

**当前状态**: device_token 已移除，改用内存存储

仍存储（配置类，非敏感）:
- `clawbot_node_id`
- `clawbot_gateway_url`
- `clawbot_pairing_token`

**状态**: ⚠️ 已改进（敏感信息已移除）

---

## 🟡 P2 - 中优先级

### 3. 测试问题

**当前状态**:
- ✅ 基础测试通过: 678 passed
- ⚠️ 复杂测试跳过: 511 skipped

---

## 🟢 P3 - 低优先级

### 4. 学习房间邀请功能

**文件**: `src/components/StudyRoom.tsx`

**状态**: 邀请功能未实现

---

## 📊 问题统计

| 类别 | 数量 | 严重程度 | 状态 |
|------|------|---------|------|
| 配对功能空实现 | 1 处 | P0 | ❌ |
| localStorage 配置 | - | P1 | ⚠️ |
| 测试跳过 | 511 个 | P2 | ⚠️ |
| 邀请功能未实现 | 1 处 | P3 | ❌ |

---

*文档更新时间：2026-03-18*
