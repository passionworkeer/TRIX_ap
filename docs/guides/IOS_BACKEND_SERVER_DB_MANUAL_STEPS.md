# iOS + TRIX Native Server 手动联调清单

> ⚠️ **本文档已过时**: 旧版 `server/clawbot-channel` 已废弃，功能已迁移到 `packages/trix-openclaw-native`。

## 新版 TRIX Native Server

### 启动 TRIX Native Server

```bash
cd packages/trix-openclaw-native
npm run cli -- server start --port 8788
```

### 环境变量

在 `.env` 中配置：

```bash
# TRIX Native Server
VITE_TRIX_NATIVE_SERVER_URL=http://localhost:8788
TRIX_NATIVE_ADMIN_TOKEN=your-admin-token
TRIX_NATIVE_PUBLIC_BASE_URL=http://localhost:8788
```

### 关键 API 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/pairings | 创建配对码 |
| POST | /api/pairings/:code/claim | 认领配对 |
| GET | /api/messages/:conversationId | 获取消息历史 |
| POST | /api/messages | 发送消息 |
| GET | /health | 健康检查 |

### WebSocket 连接

```
ws://localhost:8788/ws?role=user&conversationId=xxx&clientToken=xxx
ws://localhost:8788/ws?role=agent&adminToken=xxx&accountId=xxx
```

---

## 相关文档

- [docs/requirements/TRIX_NATIVE_PAIRING_ARCHITECTURE.md](../requirements/TRIX_NATIVE_PAIRING_ARCHITECTURE.md)
- [docs/getting-started/SETUP.md](../getting-started/SETUP.md)
