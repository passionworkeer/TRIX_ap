# 项目启动说明

## 依赖

- Node.js 22+
- npm 10+
- Xcode 26+（iOS）
- 本机已安装 OpenClaw

## 安装

```bash
npm install
```

## Web

```bash
npm run dev
npm run build
```

Web 只连接 `Trix Service`，不再直连 Gateway。

## iOS

```bash
open ios/TRIX3DCompanion/TRIX3DCompanion.xcworkspace
```

iOS 只连接 `https://trix.love`，配对后通过用户面 `/ws` 收消息。

## OpenClaw Gateway

本机 Gateway 通过原生 `trix-native` channel 插件接入。

```bash
openclaw plugins doctor
openclaw channels status --probe
openclaw channels login --channel trix-native --account default --verbose
```

## 当前目录结构

```text
packages/
└── trix-openclaw-native/
    ├── src/                 # plugin + service source
    ├── test/                # plugin/service tests
    └── ops/                 # nginx/systemd/backup scripts
```
