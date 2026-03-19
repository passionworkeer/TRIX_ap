# TRIX Native Channel 配对指南

> **适用**: Web · iOS · Windows 桌面
> **最后更新**: 2026-03-19

本文档说明如何在三个平台上完成 TRIX Native Channel 配对、解绑和故障排查。

---

## 一、配对

### 1.1 QR 码格式

配对 QR 内容为 URL 格式：

```
http://TRIX_SERVER_HOST:8788/pair?code=ABCDEF12&secret=R8s9KxMnPqLvWzA2B4C6D8
```

- `code`: 6-8 位大写字母（排除 I/O/0/1）
- `secret`: base64url 编码的 18 字节随机数（约 24 字符）
- 默认有效期：**1 小时**

### 1.2 支持的输入格式

| 格式 | 示例 | 说明 |
|------|------|------|
| URL 格式（推荐） | `http://host/pair?code=XXX&secret=YYY` | 三端均支持 |
| JSON 格式 | `{"code":"XXX","secret":"YYY","serverUrl":"http://..."}` | 必须包含 serverUrl |
| 纯配对码 | `ABCDEF12` | 仅码，需预设 serverUrl（Web 仅支持 6-8 位） |

> ⚠️ 复合格式 `CODE:SECRET` 在 Web 端不支持（冒号会被去除导致解析失败）。

---

## 二、Windows 桌面端生成 QR

### 2.1 Float 悬浮窗（推荐）

1. 启动桌面应用
2. Float 窗口右下角点击 **📱 显示配对 QR**
3. 底部面板显示 QR 码和配对码
4. 手机扫描 → 自动配对
5. 配对成功后 3 秒自动关闭

```
桌面端                      手机端                      Gateway
  │                           │                           │
  │  pairing:createQr         │                           │
  │─────────────────────────►│                           │
  │                           │  POST /api/pairings        │
  │                           │──────────────────────────►│
  │  显示 QR 码               │                           │
  │◄──────────────────────────│                           │
  │                           │                           │
  │  扫描 QR                  │                           │
  │──────────────────────────►│                           │
  │                           │  POST /api/pairings/:code/claim
  │                           │──────────────────────────►│
  │                           │  { clientToken, conversationId }
  │                           │◄──────────────────────────│
  │                           │                           │
  │  pairing:pollStatus(code) │                           │
  │  每 2 秒轮询              │                           │
  │──────────────────────────►│──────────────────────────►│
  │  { status: "pending" }    │                           │
  │◄──────────────────────────│◄──────────────────────────│
  │     (直到 paired)          │                           │
  │  配对成功，关闭面板        │                           │
```

### 2.2 Gateway CLI

```bash
openclaw trix setup
```

### 2.3 HTTP API

```bash
curl -X POST http://127.0.0.1:18789/api/pairings \
  -H "Content-Type: application/json" \
  -H "x-trix-admin-token: <adminToken>" \
  -d '{"label": "Desktop Float Window"}'
```

---

## 三、iOS 端配对

1. 打开 TRIX App → 进入 **Clawbot** 聊天
2. 点击右上角扫码图标
3. 对准桌面端 QR 码
4. 扫描成功 → 自动配对

### 代码实现

**QR 扫描**: `ios/.../QRScannerView.swift` — 支持 URL 格式自动识别

**配对调用**:
```swift
// 扫码后配对
try await viewModel.pairWithQR(qrContent)

// 手动输入配对码
try await viewModel.pairWithCode("ABCDEF12")
```

### URL 格式解析（`parseQRData()`）

```swift
// 1. URL 格式: http://host/pair?code=XXX&secret=YYY
if normalized.hasPrefix("http://") || normalized.hasPrefix("https://") {
    let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
    let code = components.queryItems?.first(where: { $0.name == "code" })?.value
    let secret = components.queryItems?.first(where: { $0.name == "secret" })?.value
    let serverUrl = "\(url.scheme ?? "http")://\(url.host ?? "")"
    if !code.isEmpty { return (code, secret, serverUrl) }
}

// 2. JSON 格式
// 3. 复合格式: CODE:SECRET
// 4. 纯配对码
```

---

## 四、Web 端配对

1. 打开 TRIX Web 应用 → 进入配对页面
2. 点击扫码按钮
3. 对准桌面端 QR 码
4. 扫描成功 → 自动完成配对

### 代码实现

**客户端**: `src/services/TrixNativeChannelClient.ts`

```typescript
// 扫码后配对
await client.pairWithQR('http://host/pair?code=XXX&secret=YYY');

// 手动输入配对码
await client.pairWithCode('ABCDEF12');

// 事件监听
client.on('connected', (data) => { /* ... */ });
client.on('message', (msg) => { /* ... */ });
```

---

## 五、解绑（取消配对）

### Web 端

```typescript
const { unpair } = useClawbotChannel();

unpair();
// 清除 trix_native_channel_session
// 注意：client_id 不会清除，重启后会自动复用
```

**文件**: `src/contexts/ClawbotChannelContext.tsx`（实际实现在 `TrixNativeChannelClient.ts`）

### iOS 端

```swift
viewModel.unpair()
// 清除配对状态和 UserDefaults 数据
// 断开 WebSocket
```

**文件**: `ios/TRIX3DCompanion/Core/ViewModels/ClawbotChannelViewModel.swift`
（`unpair()` 实际调用 `ClawbotChannelService.unpair()`）

### 桌面端

桌面端是 QR 生成方，无需解绑。换设备时在手机端解绑后重新扫码即可。

---

## 六、常见问题

### QR 码无法扫描

- 屏幕亮度不够 → 提高亮度
- 距离太远/太近 → 保持 15-30cm
- 部分被遮挡 → 手动输入配对码

### 配对超时

配对码过期（默认 1 小时）→ 在桌面端重新生成 QR

### 配对后无法发消息

- 重启 App/Web
- 确认 Gateway 正在运行
- 取消配对后重新扫码

### Float 窗口按钮无法点击

按钮 CSS 已设置为 `-webkit-app-region: no-drag`，确保使用最新版本。

### 桌面端无法生成 QR

检查 Gateway 健康状态：

```bash
curl http://127.0.0.1:18789/health
```

---

## 七、相关文档

- [TRIX_NATIVE_CHANNEL.md](../TRIX_NATIVE_CHANNEL.md) — Native Channel 完整协议文档

---

**最后更新**: 2026-03-19
