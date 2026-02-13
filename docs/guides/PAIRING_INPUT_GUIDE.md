# Clawbot 配对输入指南

当你从 Clawbot 获得配对信息后，可以在 TRIX App 中手动输入或使用 JSON 格式粘贴。

---

## 方式一：JSON 格式（推荐）

直接复制 Clawbot 提供的完整 JSON，支持两种格式：

### 格式 A: camelCase (推荐)
```json
{
  "gatewayUrl": "wss://your-gateway-url/ws",
  "pairingToken": "tok_xxxxxxxx",
  "deviceId": "dev_xxxxxxxx",
  "expiresAt": "2026-02-13T17:00:00Z"
}
```

### 格式 B: snake_case (兼容)
```json
{
  "gateway_url": "wss://your-gateway-url/ws",
  "pairing_token": "tok_xxxxxxxx",
  "device_id": "dev_xxxxxxxx",
  "expires_at": "2026-02-13T17:00:00Z"
}
```

---

## 方式二：单独字段填写

如果你不想用 JSON，未来版本将支持单独填写每个字段：

| 字段 | 示例值 | 说明 |
|------|--------|------|
| Gateway URL | `wss://empty-seals-buy.loca.lt/ws` | WebSocket 连接地址 |
| Pairing Token | `tok_5f2e1b4d6a0c4754a5d9ceae107530bf` | 配对认证令牌 |
| Device ID | `dev_a84fd879bde440beb90138381c5315ce` | 设备唯一标识 |

---

## 必需字段

**必须提供**（二选一）：
1. `gatewayUrl` 或 `gateway_url` - Gateway 的 WebSocket 地址
2. `pairingToken` 或 `pairing_token` - 用于认证的令牌

**可选字段**：
- `deviceId` / `device_id` - 设备标识（用于配对追踪）
- `expiresAt` / `expires_at` - 过期时间（默认 5 分钟）
- `version` - 协议版本

---

## 你的 Clawbot 数据示例

根据你提供的 Clawbot 信息，可以使用以下 JSON：

```json
{
  "gateway_url": "wss://empty-seals-buy.loca.lt/ws",
  "pairing_token": "tok_5f2e1b4d6a0c4754a5d9ceae107530bf",
  "device_id": "dev_a84fd879bde440beb90138381c5315ce",
  "expires_at": "2026-02-13T17:00:00Z",
  "version": "1.0"
}
```

或者转换为 camelCase：

```json
{
  "gatewayUrl": "wss://empty-seals-buy.loca.lt/ws",
  "pairingToken": "tok_5f2e1b4d6a0c4754a5d9ceae107530bf",
  "deviceId": "dev_a84fd879bde440beb90138381c5315ce",
  "expiresAt": "2026-02-13T17:00:00Z",
  "version": "1.0"
}
```

---

## 故障排查

### "配对码格式错误，缺少必要字段"
- 检查是否包含 `gatewayUrl` 或 `gateway_url`
- 检查是否包含 `pairingToken` 或 `pairing_token`

### "JSON 格式错误"
- 确保是有效的 JSON 格式
- 检查引号是否成对
- 检查逗号位置

### "二维码已过期"
- 检查 `expiresAt` 或 `expires_at` 时间是否已过期
- 重新生成新的配对码

---

## 简化输入

如果你经常需要输入，可以只保留必要字段：

```json
{"gateway_url":"wss://empty-seals-buy.loca.lt/ws","pairing_token":"tok_5f2e1b4d6a0c4754a5d9ceae107530bf","device_id":"dev_a84fd879bde440beb90138381c5315ce"}
```

或者更简洁（使用 camelCase）：

```json
{"gatewayUrl":"wss://empty-seals-buy.loca.lt/ws","pairingToken":"tok_5f2e1b4d6a0c4754a5d9ceae107530bf","deviceId":"dev_a84fd879bde440beb90138381c5315ce"}
```
