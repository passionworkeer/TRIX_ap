# 配对指南

> **最后更新**: 2026-03-29

## 现在只保留的正式方式

1. 本机运行 OpenClaw Gateway，并启用 `trix-native` channel。
2. 执行：

```bash
openclaw channels login --channel trix-native --account default --verbose
```

3. CLI 会输出配对二维码和链接。
4. Web 或 iOS 扫码，或直接打开 `https://trix.love/pair?...`。
5. Trix Service 完成 claim，返回：
   - `conversationId`
   - `clientToken`
   - `peerId`
   - `wsUrl`
   - `uploadUrl`
   - `messagesUrl`

## 支持的二维码内容

- `https://trix.love/pair?code=ABC123&secret=...`
- `{"claimUrl":"https://trix.love/pair?...","serverUrl":"https://trix.love"}`
- `ABC123:secret`
- 纯配对码 `ABC123`

不再支持旧 token-only、旧私有二维码格式、旧 relay/gateway 私有格式。

## Web / iOS 之后怎么连接

- Web / iOS 只连 `https://trix.love`
- 用户消息：
  - `POST /api/messages`
  - `POST /api/uploads`
  - `GET /ws?role=user&conversationId=...&clientId=...&clientToken=...`
- OpenClaw 插件只走服务面：
  - `GET /api/service/ws`
  - `POST /api/service/messages`
  - `GET /api/service/probe`

## 解绑

- Web: 调用 `TrixNativeChannelClient.unpair()`
- iOS: 调用 `ClawbotChannelViewModel.unpair()`

服务端会删除当前设备配对，用户面连接随之失效。

---

**最后更新**: 2026-03-29
