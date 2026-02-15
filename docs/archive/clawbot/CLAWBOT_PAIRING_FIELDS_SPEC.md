# Clawbot 配对字段规范

> **文档版本**: v1.0
> **最后更新**: 2026-02-13
> **目标**: 明确 TRIX App 与 Clawbot Gateway 配对时所需的字段规范

---

## 概述

本文档定义了 Clawbot Gateway 生成二维码/配对码时所需的字段格式，以及 TRIX App 如何解析这些字段。

**支持两种命名风格**:
- `camelCase` (推荐): `gatewayUrl`, `pairingToken`
- `snake_case` (兼容): `gateway_url`, `pairing_token`

---

## 必需字段

### 1. Gateway URL

| 属性 | 说明 |
|------|------|
| **camelCase** | `gatewayUrl` |
| **snake_case** | `gateway_url` |
| **类型** | `string` |
| **格式** | `ws://host:port` 或 `wss://host:port` |
| **示例** | `wss://empty-seals-buy.loca.lt/ws` |
| **用途** | WebSocket 连接地址 |

**验证规则**:
- 必须以 `ws://` 或 `wss://` 开头
- 不能为空字符串

---

### 2. Pairing Token

| 属性 | 说明 |
|------|------|
| **camelCase** | `pairingToken` |
| **snake_case** | `pairing_token` |
| **类型** | `string` |
| **格式** | 任意字符串，建议 `tok_` 前缀 |
| **示例** | `tok_5f2e1b4d6a0c4754a5d9ceae107530bf` |
| **用途** | 配对认证凭证，用于后续 WebSocket 连接认证 |

**验证规则**:
- 不能为空字符串
- 长度建议 32-64 字符

---

### 3. Device ID

| 属性 | 说明 |
|------|------|
| **camelCase** | `deviceId` |
| **snake_case** | `device_id` |
| **类型** | `string` |
| **格式** | 唯一标识符，建议 `dev_` 前缀 |
| **示例** | `dev_a84fd879bde440beb90138381c5315ce` |
| **用途** | 设备唯一标识，用于配对请求追踪 |

**验证规则**:
- 不能为空字符串
- 需要在 TRIX App 端生成配对请求时使用

---

### 4. 过期时间 (可选但推荐)

| 属性 | 说明 |
|------|------|
| **camelCase** | `expiresAt` |
| **snake_case** | `expires_at` |
| **类型** | `string` (ISO 8601) |
| **格式** | `YYYY-MM-DDTHH:mm:ssZ` |
| **示例** | `2026-02-13T17:00:00Z` |
| **用途** | 配对码过期时间，过期后无法使用 |

**验证规则**:
- 必须符合 ISO 8601 格式
- 过期时间必须大于当前时间

---

## 可选字段

### 5. 版本号

| 属性 | 说明 |
|------|------|
| **camelCase** | `version` |
| **snake_case** | `version` |
| **类型** | `string` |
| **示例** | `"1.0"` |
| **用途** | 协议版本标识，用于未来兼容性处理 |

---

### 6. 二维码 URL

| 属性 | 说明 |
|------|------|
| **camelCase** | `qrCodeUrl` |
| **snake_case** | `qrcode_url` |
| **类型** | `string` |
| **示例** | `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=...` |
| **用途** | 二维码图片的 URL（如果 Gateway 提供） |

**注意**: TRIX App 当前不使用此字段，App 会直接解析 JSON 数据

---

## 完整示例

### 推荐格式 (camelCase)

```json
{
  "gatewayUrl": "wss://empty-seals-buy.loca.lt/ws",
  "pairingToken": "tok_5f2e1b4d6a0c4754a5d9ceae107530bf",
  "deviceId": "dev_a84fd879bde440beb90138381c5315ce",
  "expiresAt": "2026-02-13T17:00:00Z",
  "version": "1.0"
}
```

### 兼容格式 (snake_case)

```json
{
  "gateway_url": "wss://empty-seals-buy.loca.lt/ws",
  "pairing_token": "tok_5f2e1b4d6a0c4754a5d9ceae107530bf",
  "device_id": "dev_a84fd879bde440beb90138381c5315ce",
  "expires_at": "2026-02-13T17:00:00Z",
  "version": "1.0"
}
```

### 带二维码 URL 的格式

```json
{
  "gateway_url": "wss://empty-seals-buy.loca.lt/ws",
  "pairing_token": "tok_5f2e1b4d6a0c4754a5d9ceae107530bf",
  "device_id": "dev_a84fd879bde440beb90138381c5315ce",
  "expires_at": "2026-02-13T17:00:00Z",
  "version": "1.0",
  "qrcode_url": "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=..."
}
```

---

## TRIX App 字段映射规则

TRIX App 会尝试按以下顺序读取字段：

| 目标字段 | 第1优先级 (camelCase) | 第2优先级 (snake_case) |
|---------|----------------------|------------------------|
| `gatewayUrl` | `gatewayUrl` | `gateway_url` |
| `pairingToken` | `pairingToken` | `pairing_token` |
| `deviceId` | `deviceId` | `device_id` |
| `expiresAt` | `expiresAt` | `expires_at` |
| `version` | `version` | `version` |

---

## 字段用途详解

### 配对流程中各字段的作用

```
┌─────────────────────────────────────────────────────────────────┐
│  步骤 1: 扫描二维码/输入配对码                                    │
│  - 解析 JSON 获取所有字段                                        │
│  - 验证必需字段: gatewayUrl, pairingToken                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  步骤 2: 保存连接信息                                             │
│  - gatewayUrl → localStorage['clawbot_gateway_url']             │
│  - pairingToken → localStorage['clawbot_pairing_token']         │
│  - deviceId → 用于生成配对请求                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  步骤 3: 生成配对请求                                             │
│  - 使用 deviceId 作为 requestId 或生成新的 requestId             │
│  - 发送配对请求到 Supabase                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  步骤 4: 建立 WebSocket 连接                                      │
│  - 使用 gatewayUrl 连接 WebSocket                                │
│  - 使用 pairingToken 进行认证                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Clawbot Gateway 修改建议

如果你正在修改 Clawbot Gateway 的代码，建议按照以下方式生成配对数据：

### Python 示例

```python
import json
import uuid
from datetime import datetime, timedelta

def generate_pairing_data(gateway_url: str, pairing_token: str):
    """生成配对数据"""

    device_id = f"dev_{uuid.uuid4().hex}"
    expires_at = (datetime.utcnow() + timedelta(hours=1)).isoformat() + "Z"

    # 使用 camelCase (推荐)
    pairing_data_camel = {
        "gatewayUrl": gateway_url,
        "pairingToken": pairing_token,
        "deviceId": device_id,
        "expiresAt": expires_at,
        "version": "1.0"
    }

    # 或使用 snake_case (兼容)
    pairing_data_snake = {
        "gateway_url": gateway_url,
        "pairing_token": pairing_token,
        "device_id": device_id,
        "expires_at": expires_at,
        "version": "1.0"
    }

    return json.dumps(pairing_data_camel)
```

### Node.js 示例

```javascript
const crypto = require('crypto');

function generatePairingData(gatewayUrl, pairingToken) {
    const deviceId = `dev_${crypto.randomUUID().replace(/-/g, '')}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // 推荐格式 (camelCase)
    return JSON.stringify({
        gatewayUrl,
        pairingToken,
        deviceId,
        expiresAt,
        version: "1.0"
    });
}
```

---

## 故障排查

### 字段缺失错误

**错误信息**: `"配对码格式错误，缺少必要字段"`

**原因**: 缺少 `gatewayUrl` 或 `pairingToken` (或 snake_case 版本)

**解决**:
1. 检查 JSON 是否包含这些字段
2. 确认字段名拼写正确
3. 确认字段值不为空

### 过期错误

**错误信息**: `"二维码已过期"`

**原因**: `expiresAt` 时间早于当前时间

**解决**: 重新生成配对码

### JSON 解析错误

**错误信息**: `"无效的二维码格式"` 或 `"JSON 格式错误"`

**原因**: JSON 格式不正确

**解决**: 使用 JSON 校验工具验证格式

---

## 更新日志

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-02-13 | 初始版本，支持 camelCase 和 snake_case |

---

**维护者**: TRIX 3D Companion 开发团队
