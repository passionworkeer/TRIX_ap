# TRIX 3D Companion

> Web / iOS 客户端统一接入 `Trix Service`，OpenClaw 仅通过本机 Gateway 内的 `trix-native` 原生 Channel 插件接入。

## 当前正式架构

```text
Web / iOS
   │  HTTPS + WSS
   ▼
https://trix.love
   │
   ▼
Trix Service
   ├─ /api/pairings/:code/claim
   ├─ /ws?role=user...
   ├─ /api/messages
   ├─ /api/uploads
   └─ /api/service/*
        ▲
        │ Authorization: Bearer <serviceToken>
        ▼
本机 OpenClaw Gateway
   └─ trix-native plugin
```

旧的 Web 直连 Gateway、Relay 中继客户端、独立 agent 客户端已经移除，不再是正式链路。

## 仓库结构

```text
trix-3d-companion/
├── src/                        # Web 前端
├── ios/TRIX3DCompanion/        # iOS App
├── packages/trix-openclaw-native/
│   ├── src/server/             # Trix Service
│   ├── src/                    # OpenClaw 原生插件
│   └── ops/                    # Nginx / systemd / backup / rotate token
├── tests/                      # 冒烟 / 手工验证脚本
└── docs/                       # 当前架构与部署文档
```

## 本地开发

```bash
npm install
npm run dev
npm run build
npm run test:unit
```

## OpenClaw 使用

默认 profile 已迁到正式 `channels.trix-native` 配置。

```bash
openclaw plugins doctor
openclaw channels status --probe
openclaw channels login --channel trix-native --account default --verbose
```

扫码或打开配对链接后，Web / iOS 只连 `https://trix.love`，消息由 Trix Service 转发给本机 Gateway 内的 `trix-native`。

## 关键文档

- [docs/TRIX_NATIVE_CHANNEL.md](docs/TRIX_NATIVE_CHANNEL.md)
- [docs/guides/PAIRING.md](docs/guides/PAIRING.md)
- [docs/guides/DEPLOYMENT.md](docs/guides/DEPLOYMENT.md)
- [docs/architecture/WEB_ARCHITECTURE.md](docs/architecture/WEB_ARCHITECTURE.md)
- [docs/ios/IOS_ARCHITECTURE.md](docs/ios/IOS_ARCHITECTURE.md)
