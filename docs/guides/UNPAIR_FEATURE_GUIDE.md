# TRIX Native Channel 解绑功能指南

> **适用**: Web、iOS、Windows 桌面端
> **最后更新**: 2026-03-19
> **配对协议**: `trix-openclaw-native` v0.1.0

本文档说明如何在各端取消 TRIX Native Channel 配对并重新配对。

---

## 一、Web 端

### 解绑操作

**文件**: `src/screens/ChatDetail.tsx`

```typescript
const { unpair } = useClawbotChannel();

// 在设置菜单中点击"取消配对"
const handleUnpair = () => {
  const confirmed = window.confirm('确定要取消与 Clawbot 的配对吗？\n\n取消后需要重新配对才能继续使用。');
  if (confirmed) {
    unpair();  // 调用 context 的 unpair 方法
    navigate('/chat');  // 返回聊天列表
  }
};
```

**unpair 实现**（`src/contexts/ClawbotChannelContext.tsx`）：

```typescript
const unpair = useCallback(() => {
  trixNativeChannelClient.unpair();
  // 清除 WebSocket 连接
  // 清除 localStorage 中的 session
}, []);
```

**清除的 localStorage 数据**：
- `trix_native_channel_session` — 配对会话
- `trix_native_channel_client_id` — 客户端 ID

### 重新配对

1. 进入 Clawbot 聊天
2. 点击扫码配对
3. 扫描桌面端 QR 码
4. 等待配对完成

---

## 二、iOS 端

### 解绑操作

**文件**: `ios/TRIX3DCompanion/App/ClawbotChannelViewModel.swift`

```swift
// 完全解除配对
viewModel.unpair()

// 断开 Relay 连接（如果使用 Relay 模式）
viewModel.disconnectRelay()
```

**unpair 实现**（`ClawbotChannelViewModel.swift`）：

```swift
/// Unpair from current device
func unpair() {
    service.unpair()   // 调用 ClawbotChannelService.unpair()
    isPaired = false
    messages.removeAll()
}
```

**service.unpair()** (`ClawbotChannelService.swift`)：

```swift
func unpair() {
    // 清除配对状态
    pairedClientId = nil
    clientToken = nil
    conversationId = nil

    // 断开 WebSocket
    socket?.disconnect()
    socket = nil

    // 清除 UserDefaults 中的配对数据
    UserDefaults.standard.removeObject(forKey: "paired")
    UserDefaults.standard.removeObject(forKey: "device_id")
    UserDefaults.standard.removeObject(forKey: "pairing_code")
    UserDefaults.standard.removeObject(forKey: "client_token")
}
```

### 重新配对

1. 打开 TRIX App
2. 进入 Clawbot 聊天
3. 点击扫码图标
4. 扫描桌面端 QR 码

---

## 三、Windows 桌面端

桌面端是 QR 生成方，不需要解绑操作。

如需更换配对设备：
1. 手机端取消当前配对
2. 在桌面端重新点击"显示配对 QR"
3. 手机重新扫码

---

## 四、解绑的完整影响

### 解绑前

```
手机端 ←→ WebSocket ←→ Gateway ←→ Agent
          ↑
    clientToken (有效)
```

### 解绑后

```
手机端    WebSocket (已断开)    Gateway
  │                                │
  │    localStorage 已清除        │
  │                                │
  ✗ 无法发送消息                   旧 clientToken 已失效
```

### 重新配对后

```
手机端 ←→ WebSocket ←→ Gateway ←→ Agent
          ↑
    新的 clientToken
```

---

## 五、相关文档

- [QR_PAIRING_USER_GUIDE.md](./QR_PAIRING_USER_GUIDE.md) — 扫码配对完整指南
- [TRIX_NATIVE_CHANNEL.md](../TRIX_NATIVE_CHANNEL.md) — Native Channel 完整协议

---

**最后更新**: 2026-03-19
