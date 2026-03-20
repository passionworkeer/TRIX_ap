# Web 架构

## 正式链路

```text
React App
  │
  ├─ pairing / uploads / messages
  └─ user websocket
        │
        ▼
    TrixNativeChannelClient
        │
        ▼
    https://trix.love
```

Web 不再：

- 直连 OpenClaw Gateway
- 使用旧桥接客户端
- 使用旧 RPC 包装层
- 使用旧 relay 中继包

## 主要模块

- `src/services/TrixNativeChannelClient.ts`
- `src/contexts/ClawbotChannelContext.tsx`
- `src/hooks/useClawbotMessages.ts`
- `src/components/StudyRoom.tsx`

## 环境变量

- `VITE_TRIX_NATIVE_SERVER_URL`
- `VITE_TRIX_NATIVE_PUBLIC_URL`

旧的 Gateway / relay 前端环境变量已删除。

---

**最后更新**: 2026-03-20
