# 架构文档索引

> TRIX 3D Companion 架构文档总览
> **最后更新**: 2026-03-30

---

## 架构文档列表

| 文档 | 说明 | 最后更新 |
|------|------|----------|
| [WEB_ARCHITECTURE.md](./WEB_ARCHITECTURE.md) | Web 端架构（19 路由 + 27 服务 + 38 组件 + 12 hooks + 10 utils） | 2026-03-29 |
| [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md) | 后端架构（Node.js HTTP/WebSocket + Supabase + TRIX Native Server） | 2026-03-24 |

---

## 三端架构关联

```
WEB_ARCHITECTURE.md     ← Supabase (PostgreSQL)
                        ← TRIX Native Server (port 8788)
                        ← OpenClaw Gateway (port 18789)

BACKEND_ARCHITECTURE.md ← Supabase
                        ← TRIX Native Server

iOS 架构: ios/IOS_ARCHITECTURE.md（988 Swift 文件 · 61 服务）
Desktop 架构: desktop/DESKTOP_ARCHITECTURE.md（90 IPC · 80 preload API）
```

---

## 核心架构约束

### OpenClaw Plugin 规则

- `startAccount` **必须永远不返回**（返回 = channel stopped = auto-restart 循环）
- `channel id` 含连字符时用方括号语法：`cfg.channels?.['trix-native']`
- 必须有 `openclaw.plugin.json` 且含 `channels` 数组

### TRIX Native Channel

- QR 码格式: `http://host/pair?code=XXX&secret=YYY`
- 三端（Web/iOS/Desktop）均支持此格式
- 唯一权威文档: `docs/TRIX_NATIVE_CHANNEL.md`

### Electron 特殊处理

| 问题 | 错误做法 | 正确做法 |
|------|---------|---------|
| 资源路径 TS 错误 | `process.resourcesPath!` | `app.getPath('resourcesPath')` |
| 状态文件路径 | `process.cwd()` | `app.getPath('userData')` |
| Float 窗口按钮 | 按钮在 drag 区域内 | 按钮加 `-webkit-app-region: no-drag` |
| 状态路径一致性 | Gateway 和 IPC 用不同路径 | 统一 `app.getPath('userData')` |

---

## 相关文档

- [TRIX_NATIVE_CHANNEL.md](../TRIX_NATIVE_CHANNEL.md) — Native Channel 唯一权威协议文档
- [ui/COMPONENTS.md](../ui/COMPONENTS.md) — Web 组件详细文档
- [ios/IOS_ARCHITECTURE.md](../ios/IOS_ARCHITECTURE.md) — iOS 架构
- [desktop/DESKTOP_ARCHITECTURE.md](../desktop/DESKTOP_ARCHITECTURE.md) — Desktop 架构

---

**最后更新**: 2026-03-30
