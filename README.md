# TRIX 3D Companion

> 三端一体的 AI 伴侣 — OpenClaw 原生插件 + 多模态实时收发 + 自习室学习陪伴

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## 核心亮点

### OpenClaw 原生插件 — 不是集成，是内置

`trix-openclaw-native` 是 OpenClaw Gateway 的**进程内 Channel 插件**，AI Agent 与 Gateway 共用同一进程，无 HTTP 中继延迟。

```
OpenClaw Gateway (port 18789)
└── trix-native plugin（进程内运行）
       ├── startAccount() ← 永远不返回（返回 = 通道停止 = 重启循环）
       └── 处理：文字 / 图片 / 语音 / TTS / 文件
```

### 多模态实时收发

| 模态 | 支持 |
|------|------|
| 文字聊天 + AI 流式回复 | ✅ |
| 图片（拍照 / 相册 / AI 图片理解）| ✅ |
| 语音录制 + Edge TTS 合成 | ✅ |
| Emoji 贴纸 + Reaction | ✅ |
| 文件附件（Aliyun OSS）| ✅ |
| 位置共享（Leaflet / MapKit）| ✅ |

### 三端完全对齐

| | Web | iOS | Desktop |
|-|------|-----|---------|
| 路由/页面 | 19 路由 | 全页面覆盖 | LuminaLayout |
| 配对 | 扫码 + 链接 | 扫码 | IPC + Float 窗口 |
| 特色 | 双主题 + 浮窗 | APNs + StoreKit 2 | 系统托盘 + 进程管理 |

---

## 三端概览

### Web — `src/`
React 19 + Vite + Tailwind CSS 4 · Supabase（Auth + Realtime + Storage）· Leaflet 地图 · Framer Motion 动画 · i18next 国际化 · Lumina（亮色）/ Monolith Noir（暗色）双主题

### iOS — `ios/TRIX3DCompanion/`
Swift 5.9 + SwiftUI + MVVM（Combine）· Alamofire + Starscream · GRDB + Keychain · MapKit · AVFoundation · StoreKit 2 · SSL Pinning

### Desktop — `desktop/`
Electron 33 + React 19 · 51 个 IPC 处理器（contextBridge）· 主窗口 + Float 浮窗（置顶 220×320）· 系统托盘 · Supabase Auth IPC 直调 · CPU/内存/磁盘系统信息

---

## 自习室 — 核心场景

番茄钟计时 + 学习记录统计 + AI 陪伴聊天 + 成就关联解锁

```
┌─────────────────────────────────────┐
│  今日 2h34m  │  本周 8h12m  │  总计 156h  │
├─────────────────────────────────────┤
│         🍅  25 : 00                 │
│    [开始]  [暂停]  [重置]            │
├─────────────────────────────────────┤
│  学习记录                            │
│  🍅 25分钟 番茄达人初阶              │
│  📚 52分钟 专注先锋                  │
└─────────────────────────────────────┘
```

---

## 技术架构

```
Web / iOS / Desktop
        │
        ▼  WebSocket + REST + QR 配对
  https://trix.love
        │
        ▼
  OpenClaw Gateway (18789)
        │
        └── trix-openclaw-native Plugin（进程内）

  关键端口：Web Dev 5173 / Gateway 18789 / TRIX Native 8788
```

### 配对协议（唯一真相来源）
```
QR 格式：http://host/pair?code=XXX&secret=YYY&accountId=ZZZ
有效期 1 小时，轮询间隔 7 秒，三端通用
```

---

## 快速开始

```bash
git clone https://github.com/passionworkeer/TRIX_ap.git
cd TRIX_ap
npm install
cp .env.example .env.local   # 填写 Supabase 凭证

npm run dev                  # Web (http://localhost:5173)
npm run dev:desktop          # Desktop
# iOS: open ios/TRIX3DCompanion/TRIX3DCompanion.xcworkspace
```

### 项目结构

```
src/                    # Web（React 19，19 个路由）
desktop/src/main/       # Electron 主进程（IPC 51 处理器）
desktop/src/renderer/   # Electron 渲染进程
ios/TRIX3DCompanion/    # iOS（SwiftUI + MVVM）
packages/trix-openclaw-native/   # ⭐ OpenClaw 原生插件
docs/                   # 50+ 架构文档
```

---

## 核心规则

| 规则 | 原因 |
|------|------|
| Desktop 用 `loadFile()` 不 `loadURL()` | asar 打包兼容性 |
| Desktop 用 `app.getPath('userData')` 不 `process.cwd()` | 打包后路径正确 |
| `startAccount()` 永远不返回 | 返回 = 通道停止 = 重启循环 |
| 通道 ID 用方括号 `['trix-native']` | 连字符键名语法 |

---

## 测试与部署

```bash
npm run test:unit        # 单元测试（Vitest）
npm run test:smoke       # 冒烟测试
npm run test:e2e         # E2E（Playwright）
npm run test:all         # 全部测试

npm run build            # Web → dist/
npm run build:desktop    # Desktop → NSIS 安装包 + 便携 exe
```

**生产环境：** Web http://TRIX_SERVER_HOST · Gateway ws://TRIX_SERVER_HOST:18789 · TRIX http://TRIX_SERVER_HOST:8788

---

## 文档

| 文档 | 说明 |
|------|------|
| `docs/TRIX_NATIVE_CHANNEL.md` | ⭐ 配对协议唯一真相来源 |
| `docs/architecture/WEB_ARCHITECTURE.md` | Web 架构 |
| `docs/architecture/DESKTOP_ARCHITECTURE.md` | Electron 架构 + IPC |
| `docs/guides/PAIRING.md` | 配对指南 |
| `docs/INDEX.md` | 完整文档索引 |

---

## License

MIT — 参见 [LICENSE](LICENSE)
