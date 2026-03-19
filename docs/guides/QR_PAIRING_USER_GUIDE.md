# TRIX Native Channel 扫码配对完整指南

> **适用**: Web、iOS、Windows 桌面端
> **最后更新**: 2026-03-19
> **配对协议**: `trix-openclaw-native` v0.1.0

本文档说明如何使用 QR 码在三个平台上完成 TRIX Native Channel 配对。

---

## 一、概述

TRIX Native Channel 配对采用统一的 **QR URL 格式**，由桌面端生成 QR，移动端扫码完成配对。

### 配对 QR 格式

```
http://127.0.0.1:8788/pair?code=ABCDEF12&secret=random-token
```

- `code`: 8 位大写字母数字配对码
- `secret`: 随机密钥（18位）
- 默认有效期：**1 小时**

### 三端角色

| 端 | 角色 | 说明 |
|----|------|------|
| Windows 桌面 | QR 生成方 | 生成并显示配对 QR |
| iOS | 扫码方 | 扫描 QR，完成配对 |
| Web | 扫码方 | 扫描 QR，完成配对 |

---

## 二、Windows 桌面端生成 QR

### 方式 1：Float 悬浮窗（推荐）

**文件**: `desktop/src/renderer/float.tsx`

Float 悬浮窗是桌面端的小型始终置顶窗口，显示机器人状态。

1. 启动桌面应用（`npm run dev:desktop`）
2. Float 窗口右下角显示 `🤖 待机`
3. 点击 **📱 显示配对 QR** 按钮
4. 底部面板弹出 QR 码
5. 手机扫描 QR 码完成配对
6. 配对成功后，QR 面板 3 秒后自动关闭

**UI 布局**：

```
┌─────────────────────┐
│                     │
│    [机器人动画]     │  ← FloatHeroBackground
│                     │
│   ┌─────────────┐   │
│   │ 🤖 待机    │   │  ← 状态指示器
│   │ 📱 显示配对 QR │ ← 按钮
│   └─────────────┘   │
└─────────────────────┘
         ↓ 点击后
┌─────────────────────┐
│                     │
│    [机器人动画]     │
│                     │
│   ┌─────────────┐   │
│   │ 🤖 待机    │   │
│   │ 关闭按钮 ✕   │   │
│   │ 用手机扫码配对 │   │
│   │ ┌─────────┐ │   │
│   │ │ [QR码]  │ │   │  ← base64 PNG
│   │ └─────────┘ │   │
│   │  ABCDEF12    │   │  ← 配对码
│   │ ⏳ 等待配对   │   │  ← 轮询状态
│   └─────────────┘   │
└─────────────────────┘
```

### 方式 2：Gateway CLI

```bash
# 在运行 Gateway 的机器上执行
openclaw trix setup
```

### 方式 3：HTTP API

```bash
curl -X POST http://127.0.0.1:18789/api/pairings \
  -H "Content-Type: application/json" \
  -H "x-trix-admin-token: <adminToken>" \
  -d '{"label": "Desktop Float Window"}'
```

### 技术实现

**文件**: `desktop/src/main/ipc.ts`

```
float.tsx                    ipc.ts                    Gateway
   │                           │                         │
   │ createPairingQr()         │                         │
   │ ─────────────────────────►│                         │
   │                           │ GET adminToken           │
   │                           │ from state.json          │
   │                           │ POST /api/pairings       │
   │                           │ ───────────────────────►│
   │                           │  { qrDataUrl, code }    │
   │                           │ ◄───────────────────────│
   │  { qrDataUrl, code }      │                         │
   │ ◄─────────────────────────│                         │
   │                           │                         │
   │ pollPairingStatus(code)   │                         │
   │ ─────────────────────────►│ GET /api/pairings/:code│
   │                           │ ───────────────────────►│
   │  { status: "pending" }     │                         │
   │ ◄─────────────────────────│                         │
   │    (每 2 秒重复一次)       │                         │
```

**状态存储路径**（统一）：
```
{userData}/state.json
```
Gateway 和 IPC handler 使用同一目录，确保 adminToken 可访问。

---

## 三、iOS 端扫码配对

### 操作步骤

1. 打开 TRIX iOS App
2. 进入 **Clawbot** 聊天
3. 点击右上角扫码图标
4. 对准桌面端 QR 码
5. 扫描成功 → 自动配对
6. 配对成功后显示确认

### 支持的 QR 格式

| 格式 | 示例 | 支持 |
|------|------|------|
| URL 格式 | `http://host/pair?code=XXX&secret=YYY` | ✅ |
| JSON 格式 | `{"code":"XXX","secret":"YYY"}` | ✅ |
| 纯配对码 | `ABCDEF12` | ✅ |
| 复合码 | `ABCDEF12:SECRET` | ✅ |

### 核心文件

**QR 扫描**: `ios/TRIX3DCompanion/Features/Pairing/Views/QRScannerView.swift`

**配对 ViewModel**: `ios/TRIX3DCompanion/App/ClawbotChannelViewModel.swift`

```swift
// 扫码后配对
try await viewModel.pairWithQR(qrContent)

// 或手动输入配对码
try await viewModel.pairWithCode("ABCDEF12")
```

### 解析逻辑（`parseQRData()`）

```swift
// 1. URL 格式 (http://host/pair?code=XXX&secret=YYY)
if normalized.hasPrefix("http://") || normalized.hasPrefix("https://") {
    let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
    let code = components.queryItems?.first(where: { $0.name == "code" })?.value
    let secret = components.queryItems?.first(where: { $0.name == "secret" })?.value
    let serverUrl = "\(url.scheme ?? "http")://\(url.host ?? "")"
}

// 2. JSON 格式
if let data = raw.data(using: .utf8),
   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
    // { "code": "...", "secret": "...", "serverUrl": "..." }
}

// 3. 纯配对码
if code.count == 8, code.allSatisfy({ $0.isLetter || $0.isNumber }) {
    // 纯配对码
}
```

---

## 四、Web 端扫码配对

### 操作步骤

1. 打开 TRIX Web 应用
2. 进入配对页面（`/pairing`）
3. 点击扫码按钮
4. 对准桌面端 QR 码
5. 扫描成功 → 自动完成配对

### 核心文件

**客户端**: `src/services/TrixNativeChannelClient.ts`

```typescript
// 扫码后配对
await client.pairWithQR('http://host/pair?code=XXX&secret=YYY');

// 手动输入配对码
await client.pairWithCode('ABCDEF12');
```

---

## 五、配对流程时序图

```
桌面端                      手机端                      Gateway
  │                           │                           │
  │  1. 点击"显示配对 QR"     │                           │
  │  generatePairingCode()    │                           │
  │──────────────────────────►│                           │
  │                           │  POST /api/pairings        │
  │                           │──────────────────────────►│
  │                           │  { code, qrDataUrl }       │
  │                           │◄──────────────────────────│
  │  2. 显示 QR 码            │                           │
  │  ◄─────────────────────────│                           │
  │                           │                           │
  │  3. 扫描 QR 码            │                           │
  │───────────────────────────►│                           │
  │                           │  POST /api/pairings/:code/claim
  │                           │──────────────────────────►│
  │                           │  { clientToken, conversationId }
  │                           │◄──────────────────────────│
  │                           │  4. 保存 session          │
  │                           │───────────────────────────│
  │                           │  WebSocket.connect()       │
  │                           │──────────────────────────►│
  │                           │                           │
  │  5. 轮询状态 (每2s)        │                           │
  │──────────────────────────►│                           │
  │  GET /api/pairings/:code  │                           │
  │──────────────────────────►│──────────────────────────►│
  │  { status: "pending" }    │                           │
  │◄──────────────────────────│◄──────────────────────────│
  │     (重复直到 paired)      │                           │
  │                           │                           │
  │  6. status = "paired"     │                           │
  │  7. 配对成功，关闭面板     │                           │
```

---

## 六、解绑（取消配对）

### iOS 端

```swift
// 断开连接
viewModel.disconnectRelay()

// 完全解除配对
viewModel.unpair()
```

### Web 端

```typescript
// 断开 WebSocket
client.disconnect()

// 清除本地存储
localStorage.removeItem('trix_native_channel_session')
```

详细说明见 [UNPAIR_FEATURE_GUIDE.md](./UNPAIR_FEATURE_GUIDE.md)。

---

## 七、常见问题

### 1. QR 码无法扫描

**原因**：
- 屏幕亮度不够
- 距离太远或太近
- QR 码部分被遮挡

**解决**：
- 提高屏幕亮度
- 保持 15-30cm 距离
- 尝试手动输入配对码

### 2. 配对超时

**原因**：配对码过期（默认 1 小时）

**解决**：在桌面端重新生成 QR

### 3. 配对后无法发消息

**原因**：
- WebSocket 未连接
- clientToken 失效

**解决**：
- 重启 App/Web
- 确认 Gateway 正在运行
- 取消配对后重新扫码

### 4. Float 窗口按钮无法点击

**原因**：CSS `-webkit-app-region: drag` 阻止了按钮点击

**解决**（已修复）：
- 按钮已添加 `-webkit-app-region: no-drag` CSS
- 如遇此问题，请确认使用最新版本

### 5. 桌面端无法生成 QR

**原因**：
- Gateway 未运行
- adminToken 不可读

**解决**：
- 检查 `curl http://127.0.0.1:18789/health`
- 重启桌面应用

---

## 八、相关文档

- [TRIX_NATIVE_CHANNEL.md](../TRIX_NATIVE_CHANNEL.md) — Native Channel 完整协议
- [openclaw_reference.md](../openclaw_reference.md) — OpenClaw 插件规范
- [UNPAIR_FEATURE_GUIDE.md](./UNPAIR_FEATURE_GUIDE.md) — 解绑功能
- [PAIRING_INPUT_GUIDE.md](./PAIRING_INPUT_GUIDE.md) — 配对码输入

---

**最后更新**: 2026-03-19
