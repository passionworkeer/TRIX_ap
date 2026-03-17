# Web 端待处理问题清单

> 生成日期：2026-03-17
> 范围：src/ 目录下所有代码
> 总问题数：120+

---

## 🔴 P0 - 致命问题（必须立即修复）

### 1. 静默错误处理 - AuthContext

**文件**: `src/contexts/AuthContext.tsx`

| 行号 | 代码 | 问题 |
|------|------|------|
| 84 | `updateLastActive().catch(() => {});` | 静默吞掉错误，用户不知道失败 |
| 86 | `updateLastActive().catch(() => {});` | 同上 |
| 103 | `updateLastActive().catch(() => {});` | 同上 |
| 105 | `updateLastActive().catch(() => {});` | 同上 |

**影响**: 心跳更新失败时用户无感知

**修复方案**:
```typescript
// 改为
updateLastActive()
  .catch(err => console.error('心跳更新失败:', err));
```

---

### 2. GatewayContext 配对功能空实现

**文件**: `src/contexts/GatewayContext.tsx:127`

```typescript
const pairWithCode = useCallback(async (_code: string) => {
  // TODO: Implement pairing via server
  try {
    // TODO: Implement pairing via server
    return { success: true };  // 无论输入什么，都返回成功
  } catch (error) {
    return { success: false, error: String(error) };
  }
}, []);
```

**影响**: 配对功能完全不可用，安全性为零

**修复**: 必须实现真实的配对码验证逻辑

---

### 3. localStorage 存储敏感数据

**文件**: 多处

| 文件 | 行号 | 代码 | 敏感信息 |
|------|------|------|---------|
| `src/services/clawbotPairingService.ts` | 132 | `localStorage.setItem('clawbot_device_token', ...)` | ✅ 设备令牌 |
| `src/services/clawbotPairingService.ts` | 282 | `localStorage.setItem('clawbot_device_token', ...)` | ✅ 设备令牌 |
| `src/services/clawbotPairingService.ts` | 576 | `localStorage.setItem('clawbot_device_token', ...)` | ✅ 设备令牌 |
| `src/contexts/QRCodePairingContext.tsx` | 67 | `localStorage.setItem('clawbot_device_token', ...)` | ✅ 设备令牌 |
| `src/contexts/QRCodePairingContext.tsx` | 95 | `localStorage.setItem('clawbot_device_token', ...)` | ✅ 设备令牌 |

**影响**: XSS攻击可窃取所有令牌

**修复**: 改用内存存储或 HttpOnly Cookie

---

### 4. 测试失败 - AuthContext mock 不完整

**文件**: `src/contexts/AuthContext.test.tsx`

```
Error: "updateLastActive" export is defined on the "../config/supabase" mock
```

**原因**: mock 定义不完整，`updateLastActive` 函数未导出

**修复**: 在 mock 中添加 `updateLastActive` 导出

---

## 🟠 P1 - 高优先级

### 5. 大型文件需要拆分

| 文件 | 行数 | 建议 |
|------|------|------|
| `src/screens/ChatDetail.tsx` | **1439** | 拆分为 5+ 个子组件 |
| `src/services/ClawbotChannelBridge.ts` | **1098** | 拆分为连接管理、消息处理、状态管理 |
| `src/services/clawbotPairingService.ts` | **882** | 拆分为配对服务、存储服务 |
| `src/contexts/ClawbotChannelContext.tsx` | **598** | 拆分为更小的 Context |

**拆分建议 - ChatDetail.tsx**:
```
components/
  ├── ChatHeader.tsx        # 头部：好友信息、设置按钮
  ├── MessageList.tsx       # 消息列表、虚拟滚动
  ├── MessageInput.tsx      # 输入框、发送按钮
  ├── VoiceRecorder.tsx     # 语音录制
  └──typingIndicator.tsx    # 正在输入...
screens/
  └── ChatDetail.tsx       # 主组件，只做组合
```

---

### 6. 路由重复/未使用

**文件**: `src/App.tsx`

| 行号 | 问题 |
|------|------|
| 208 | `path={AppRoutes.CHAT_DETAIL}` → `/chat/detail` |
| 209 | `path="/chat/:friendId"` → 动态路由 |

**两者都指向 ChatDetail 组件**，造成冗余

**文件**: `src/types.ts`

| 行号 | 问题 |
|------|------|
| 13 | `CHAT_WITH_FRIEND = '/chat/:friendId'` 定义但**从未使用** |

**修复**: 删除未使用的常量，统一使用动态路由

---

### 7. console.log 残留（83处）

**需要删除的文件**:

| 文件 | 数量 | 处理方式 |
|------|------|---------|
| `src/hooks/useWebVitals.ts` | 3 | 删除或用日志服务 |
| `src/e2e/test-config.ts` | 7 | E2E测试可保留 |
| `src/lib/validation.test.ts` | 3 | 测试文件可保留 |
| `src/hooks/useVoiceRecorder.ts` | 2 | 删除 |
| `src/hooks/useCamera.ts` | 1 | 删除 |
| `src/hooks/useResourcePreloader.ts` | 1 | 删除 |
| `src/features/schedule/components/ScheduleList.tsx` | 1 | 删除 |
| `src/screens/DiagnosticAdvanced.tsx` | 1 | 删除 |
| `src/components/StudyBuddiesList.tsx` | 1 | 删除 |
| `src/screens/Diagnostic.tsx` | 1 | 删除 |
| `src/components/QRScanner.tsx` | 1 | 删除 |

**总计**: 约 65 处需删除（排除测试文件）

---

### 8. 未使用的导入

**文件**: `src/App.tsx`

| 行号 | 导入 | 状态 |
|------|------|------|
| 111 | `showWarning` | 重命名为 `_showWarning` 但未使用 |
| 113-114 | `isConnected`, `isPaired` | 重命名但未使用 |

**修复**: 删除未使用的导入

---

## 🟡 P2 - 中优先级

### 9. TypeScript any 类型（16+ 处）

**生产代码中的 any**（必须修复）:

| 文件 | 行号 | 代码 |
|------|------|------|
| `src/services/locationService.ts` | 39 | `(f: any) => f.friend_id` |
| `src/services/locationService.ts` | 56 | `(f: any) => f.friend_id` |
| `src/services/mallService.ts` | 341 | `(record: any)` |
| `src/services/wardrobeService.ts` | 56 | `(outfit: any)` |
| `src/services/wardrobeService.ts` | 143 | `(outfit: any)` |
| `src/screens/SnapMapScreen.tsx` | 220 | `friend: any` |

**测试代码中的 any**（可接受，但建议改进）:
- `src/hooks/useSpeechRecognition.test.ts`: 4处
- `src/hooks/useSpeechToText.test.ts`: 8处
- `src/e2e/map.spec.ts`: 3处

**修复**: 定义具体类型
```typescript
// 错误
const friendIds = friendships.map((f: any) => f.friend_id);

// 正确
interface Friendship {
  friend_id: string;
  // ...
}
const friendIds = friendships.map((f: Friendship) => f.friend_id);
```

---

### 10. 错误处理不完善

**文件**: `src/features/location/components/LocationPicker.tsx:242`

```typescript
console.error('Error fetching friends:', error);
showWarning('无法获取好友位置');  // 用户看到警告，但错误未记录到日志服务
```

**文件**: `src/features/chat/components/MessageInput.tsx:49`

```typescript
console.error('Failed to send message:', error);  // 只有 console，无用户提示
```

**修复**: 添加统一的错误日志记录

---

### 11. 路由常量错误

**文件**: `src/types.ts:13`

```typescript
CHAT_WITH_FRIEND = '/chat/:friendId',  // 注释说是动态路由
```

但实际上这个常量从未被使用，App.tsx 直接写了字符串 `/chat/:friendId`

**修复**: 删除未使用的常量，或统一使用

---

## 🟢 P3 - 低优先级/建议

### 12. API 功能断点

| 功能 | 文件 | 问题 |
|------|------|------|
| 消息历史分页 | `src/services/chatService.ts` | 未实现分页参数 |
| 学习房间邀请 | `src/components/StudyRoom.tsx` | 邀请功能未实现 |

---

### 13. 组件 Prop Types 不清晰

**文件**: `src/screens/Study.test.tsx`

测试中组件 props 类型不清晰

---

### 14. 未完成的国际化

**文件**: `src/i18n/locales/`

部分 UI 文字尚未国际化

---

## 📊 问题统计

| 类别 | 数量 | 严重程度 |
|------|------|---------|
| 静默 catch | 4 处 (AuthContext) | P0 |
| localStorage 敏感数据 | 5 处 | P0 |
| 空实现功能 | 1 处 | P0 |
| 测试失败 | 136 个 | P0 |
| 大型文件 (>800行) | 4 个 | P1 |
| 路由问题 | 2 处 | P1 |
| console.log | ~65 处 | P1 |
| 未使用导入 | 3 处 | P1 |
| any 类型 | 6 处 (生产) | P2 |
| 错误处理 | 2 处 | P2 |

---

## ✅ 修复顺序建议

### 第一阶段：立即修复（P0）

1. **修复 AuthContext 静默错误** (4处)
2. **实现 GatewayContext 配对功能**
3. **修复测试 mock 问题**

### 第二阶段：高优先级（P1）

4. **拆分大型文件** (ChatDetail.tsx)
5. **删除路由冗余**
6. **清理 console.log**
7. **删除未使用导入**

### 第三阶段：中优先级（P2）

8. **替换 any 类型**
9. **完善错误处理**

### 第四阶段：低优先级（P3）

10. 功能完善
11. 国际化

---

## 🔧 快速修复脚本

```bash
# 1. 查找所有静默 catch
grep -rn ".catch(() => {})" src/contexts/AuthContext.tsx

# 2. 查找所有 console.log (排除测试)
grep -rn "console.log" src/ --include="*.ts" --include="*.tsx" | grep -v ".test."

# 3. 查找大型文件
wc -l src/screens/*.tsx src/contexts/*.tsx src/services/*.ts | sort -rn | head -10

# 4. 查找未使用的导入
# 使用 IDE (VSCode) 的 unused import 检测
```

---

*文档生成时间：2026-03-17*
