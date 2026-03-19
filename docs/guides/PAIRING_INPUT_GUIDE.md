# TRIX Native Channel 配对码输入指南

> **适用**: Web、iOS、Windows 桌面端
> **最后更新**: 2026-03-19
> **配对协议**: `trix-openclaw-native` v0.1.0

本文档说明如何在 TRIX Native Channel 中手动输入配对信息进行配对。

---

## 一、支持的输入格式

TRIX Native Channel 支持三种输入格式：

| 格式 | 示例 | 说明 |
|------|------|------|
| **URL 格式**（推荐） | `http://192.168.1.100/pair?code=ABCDEF12&secret=xyz` | 包含 serverUrl、code、secret |
| **纯配对码** | `ABCDEF12` | 仅配对码，需要本地 serverUrl |
| **复合格式** | `ABCDEF12:SECRET` | 配对码 + secret，冒号分隔 |

### 1. URL 格式（推荐）

由桌面端或服务器生成的 QR 码内容，三端均完整支持：

```
http://192.168.1.100:8788/pair?code=ABCDEF12&secret=random-token-here
```

解析逻辑（`ClawbotChannelService.parseQRData()`）：

1. 检测 `http://` 或 `https://` 前缀 → 解析 URL query 参数
2. 提取 `code` → 配对码（8位大写字母数字）
3. 提取 `secret` → 配对密钥（可选）
4. 提取 host/port → serverUrl

### 2. 纯配对码格式

仅输入配对码，客户端使用预设 serverUrl：

```
ABCDEF12
```

**限制**：需要客户端已配置正确的 serverUrl，不支持跨服务器配对。

### 3. 复合格式

```
ABCDEF12:SECRET
```

适用于 secret 不在 URL 中的场景（较少使用）。

---

## 二、QR 码格式规范

### 标准 QR 码内容

桌面端浮窗或 Web 页面生成的 QR 码，扫描后得到：

```
http://127.0.0.1:8788/pair?code=ABCDEF12&secret=R8s9Kx...
```

- `code`: 8 位大写字母数字配对码
- `secret`: 随机生成的密钥（18位）
- serverUrl: `http://127.0.0.1:8788`

### QR 码有效期

- 默认有效期：**1 小时**（可配置 `ttlMs`）
- 过期后需重新生成

---

## 三、三端输入方式

### Web 端

**文件**: `src/services/TrixNativeChannelClient.ts`

```typescript
// URL 格式扫码
await client.pairWithQR('http://192.168.1.100/pair?code=ABCDEF12&secret=xxx');

// 纯配对码（需已有 serverUrl）
await client.pairWithCode('ABCDEF12');
```

**支持格式**：
- URL 格式：`http://.../pair?code=XXX&secret=YYY` ✅
- JSON 格式：`{ "code": "XXX", "secret": "YYY", "serverUrl": "..." }` ✅
- 纯配对码：`ABCDEF12` ✅

### iOS 端

**文件**: `ios/TRIX3DCompanion/Core/Services/ClawbotChannelService.swift`

```swift
// QR 扫描（自动识别 URL 格式）
try await viewModel.pairWithQR(qrContent)

// 手动输入配对码
try await viewModel.pairWithCode("ABCDEF12")

// 手动输入 URL 格式
try await viewModel.pairWithQR("http://192.168.1.100/pair?code=ABCDEF12&secret=xxx")
```

**支持格式**（`parseQRData()`）：
1. URL 格式：`http://.../pair?code=XXX&secret=YYY` ✅（2026-03-19 修复）
2. JSON 格式：`{ "code": "XXX", "secret": "YYY" }` ✅
3. 复合格式：`CODE:SECRET` ✅
4. 纯配对码：`ABCDEF12` ✅

### Windows 桌面端

桌面端本身是**生成** QR 的一方，不做输入。手机端扫描桌面浮窗 QR 进行配对。

---

## 四、配对码有效期和状态

### 状态流转

```
pending → paired（配对成功）
       → expired（超时过期，默认1小时）
```

### 轮询机制

客户端配对后，每 2 秒轮询一次状态，直到：
- `paired` → 配对成功，保存 clientToken
- `expired` → 提示用户重新生成 QR

### 轮询 API

```
GET /api/pairings/:code
Header: x-trix-admin-token: <adminToken>
```

响应：
```json
{
  "status": "pending" | "paired" | "expired",
  "pairedClientId": "web_xxx",
  "pairedDeviceName": "iPhone 15"
}
```

---

## 五、故障排查

### "配对码格式错误"

**原因**：输入格式不符合上述三种格式之一

**解决**：
- 确认 QR 内容以 `http://` 开头（URL格式）
- 或确认输入为 8 位大写字母数字（纯配对码）
- 或确认 JSON 格式包含 `code` 字段

### "配对请求超时"

**原因**：配对码已过期

**解决**：在桌面端重新生成 QR 码

### "服务器连接失败"

**原因**：serverUrl 不可达

**解决**：
- 确认服务器运行在指定端口
- 检查防火墙设置
- 确认客户端和服务器在同一网络（或使用公网地址）

---

## 六、相关文档

- [TRIX_NATIVE_CHANNEL.md](../TRIX_NATIVE_CHANNEL.md) — Native Channel 完整协议文档
- [QR_PAIRING_USER_GUIDE.md](./QR_PAIRING_USER_GUIDE.md) — 扫码配对完整指南
- [UNPAIR_FEATURE_GUIDE.md](./UNPAIR_FEATURE_GUIDE.md) — 解绑功能指南

---

**最后更新**: 2026-03-19
