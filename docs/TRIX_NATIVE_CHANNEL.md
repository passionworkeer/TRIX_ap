# TRIX Native Channel

> 当前唯一正式文档。旧 relay / 旧 Gateway 直连方案已废弃。

## 架构

```text
Web / iOS
   │ HTTPS + WSS
   ▼
Trix Service
   ├─ Pairing / Claim
   ├─ User WebSocket
   ├─ User Messages API
   ├─ Upload API
   ├─ Service WebSocket
   ├─ Service Messages API
   └─ Attachment / DB
   ▲
   │
OpenClaw Gateway (本机)
   └─ trix-native channel plugin
```

## 原生插件要求

- 必须有 `openclaw.plugin.json`
- `package.json` 必须声明 `openclaw.extensions`
- 推荐声明 `setupEntry`
- `channels.trix-native` 必须存在于 OpenClaw 配置
- 插件实现 `config.listAccountIds`、`config.resolveAccount`、`config.inspectAccount`
- 插件出站只走 `/api/service/messages`
- `startAccount()` 必须持有连接，不允许连上即返回

## 服务平面与用户平面

### 用户平面

- `POST /api/pairings/:code/claim`
- `GET /ws?role=user&conversationId=...&clientId=...&clientToken=...`
- `POST /api/messages`
- `POST /api/uploads`
- `GET /api/conversations/:id/messages`

### 服务平面

- `GET /api/service/ws`
- `GET /api/service/probe`
- `POST /api/service/messages`
- `GET /api/service/conversations/by-peer/:peerId`

## 身份模型

- `accountId`: OpenClaw channel account
- `peerId`: 真实用户身份
- `clientId`: 设备身份
- `conversationId`: 对话房间
- `messageId`: 服务端稳定消息 id

`peerId` 和 `clientId` 必须分离，不能再把设备身份当作用户身份。

## 部署

- 服务器只部署 Trix Service + Nginx + TLS
- OpenClaw 只安装在用户自己的电脑上
- 当前生产域名：`https://trix.love`
