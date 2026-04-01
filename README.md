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
                    │
                    ▼
            Supabase（Auth · Database · Storage · Realtime）

  关键端口：Web Dev 5173 / Gateway 18789 / TRIX Native 8788
```

### 配对协议（唯一真相来源）
```
QR 格式：http://host/pair?code=XXX&secret=YYY&accountId=ZZZ
有效期 1 小时，轮询间隔 7 秒，三端通用
```

---

## Web 端 — `src/`

### 技术栈
React 19.2.4 + Vite 6.2 + Tailwind CSS 4.2 + TypeScript 5.8.2 · Supabase（Auth + Realtime + Storage）· React Router 7（HashRouter）· Framer Motion 12 · i18next · electron-store + electron-log

### 页面路由（19 个）

| 路由 | 页面 | 功能说明 |
|------|------|---------|
| `#/login` | 登录 | Supabase Auth 认证 |
| `#/register` | 注册 | Supabase Auth 注册 |
| `#/` | 首页 | Dashboard + AI 气泡 |
| `#/chat` | 好友列表 | 聊天入口 |
| `#/chat/:friendId` | 聊天详情 | 消息历史 + 多模态输入 |
| `#/study` | 自习室 | 计时器 + 学习记录 + 成就 |
| `#/study/timer` | 学习计时 | 专注计时模式 |
| `#/snapshot` `#/snapshot/result` | 拍照快照 | AI 相册 + 截图 |
| `#/profile` | 个人主页 | 头像 + 成就面板 + 统计 |
| `#/profile/:userId` | 用户主页 | 查看他人主页 |
| `#/pairing` | 设备配对 | 配对引导 |
| `#/qr-pairing` | 二维码配对 | 扫码配对 |
| `#/map` `#/snapmap` | 社交地图 | Leaflet 好友打卡地图（`/snapmap` → `/map` 重定向）|
| `#/diagnostic` | 诊断工具 | 服务状态调试 |
| `#/diagnostic-advanced` | 高级诊断 | 深度调试 |
| `#/points-mall` | 积分商城 | 虚拟货币商店 |
| `#/wardrobe` | 虚拟衣橱 | Avatar 装扮 |

### 设计系统 — 双主题

**Lumina（亮色）** — 温暖精准，适合社交聊天、自习、拍照等日常场景
- 背景 `#f7f9fb` · 卡片 `#ffffff` · 主色 `#630ed4` · 强调 `#6366f1`

**Monolith Noir（暗色）** — 数字建筑美学，适合仪表盘、渠道管理、系统设置
- 背景 `#131313` · 深度分层 `#0e0e0e`–`#353534` · 主色 `#ffffff`

### 特色功能
- **Float 浮窗**：桌面置顶迷你伴侣窗口，支持通知预览 + 快捷回复
- **AI 分布地图**：MapPage 可视化 AI Agent 地理分布
- **表情选择器**：最近使用 + 分类搜索导航
- **百度地图**：位置服务集成
- **阿里云 OSS**：文件上传 + CDN 分发
- **双主题切换**：Lumina ↔ Monolith Noir 随时切换

---

## iOS 端 — `ios/TRIX3DCompanion/`

### 技术栈
Swift 5.9 + SwiftUI + MVVM（Combine）· Alamofire（REST）+ Starscream（WebSocket）· SQLite.swift + Keychain · MapKit · AVFoundation · StoreKit 2 · APNs

### 核心页面
- **Home**：首页 Dashboard
- **Chat / Study / Profile**：与 Web 功能对齐
- **QRScannerView**：原生 QR 码扫描（支持 URL 格式）
- **ClawbotChannelService**：配对服务，MVVM 架构

### 特色功能
- **StoreKit 2**：应用内购集成
- **APNs 推送**：苹果系统级通知
- **SSL Pinning**：网络请求安全加固
- **请求去重**：自动重试 + 网络抖动处理
- **原生 MapKit**：iOS 系统地图，无缝系统集成

---

## Desktop 端 — `desktop/`

### 技术栈
Electron 33.4 + React 19（渲染进程）+ Node.js（主进程）+ electron-builder（NSIS）

### 多窗口架构
- **主窗口**：完整应用界面，LuminaLayout 路由系统
- **Float 浮窗**（220×320）：置顶迷你伴侣，通知预览，快捷回复Reaction
- **诊断窗口**（可选）：Gateway 日志实时查看

### IPC 系统 — 62 个处理器

| 分类 | 指令 |
|------|------|
| **Gateway** | `start` / `stop` / `status` / `getLog` — 启停 + 状态 + 日志 |
| **Auth** | `signIn` / `signUp` / `signOut` / `getSession` — Supabase IPC 直调 |
| **Channels** | `list` / `start` / `stop` / `send` — 渠道生命周期 |
| **System** | `info`（CPU/内存/OS）/ `disk`（磁盘）/ `checkPackages`（检测已装应用）|
| **State** | `read` / `write` — electron-store JSON 持久化 |

### 特色功能
- **系统托盘**：最小化到托盘 + 右键菜单 + 通知预览 + 快捷回复
- **Gateway 生命周期 UI**：Settings 页面直接启停 Gateway，实时日志
- **进程管理**：CPU、内存、磁盘、运行中进程列表
- **程序化图标生成**：无外部图标文件依赖
- **NSIS 安装包**：Windows 一键安装 + 便携 exe 双输出

---

## 自习室 — 核心场景

自习室是 TRIX Companion 的**核心学习场景**，三端均有完整实现。

### 功能矩阵

| 功能 | Web | iOS | Desktop |
|------|-----|-----|--------|
| 番茄钟计时 | ✅ | ✅ | ✅ |
| 自由计时 | ✅ | ✅ | ✅ |
| 学习记录（入库）| ✅ | ✅ | ✅ |
| 今日/本周/总计统计 | ✅ | ✅ | ✅ |
| 排行榜 | ✅ | ✅ | — |
| AI 陪伴边学边聊 | ✅ | ✅ | ✅ |
| 成就关联解锁 | ✅ | ✅ | ✅ |

### 学习数据流

```
用户开始学习
     │
     ▼
studySessionService.startSession()
     │
     ├── Supabase: INSERT study_sessions（开始时间 + 目标时长）
     ├── TRIX Native: 通知配对设备「用户正在学习」
     └── 启动计时器
          │
          ├── 每分钟 UPDATE 学习时长
          ├── TRIX Native: 同步学习状态到 AI 伴侣
          └── 计时结束 → INSERT 完整记录 → achievementService 检查成就
```

### 成就系统

17+ 成就，支持稀有度分级（普通 / 稀有 / 史诗 / 传说），动画进度条实时展示解锁进度。

---

## 功能详情

### 通用功能（三端均有）

| 功能 | 说明 |
|------|------|
| **AI 聊天** | 多模态实时对话，AI 伴侣人格，流式回复 |
| **自习室** | 番茄钟计时、学习记录统计、成就关联 |
| **拍照快照** | 拍照 + 相册管理，AI 图片理解 |
| **成就系统** | 17+ 成就，稀有度分级，动画进度条 |
| **社交地图** | 好友打卡位置，Leaflet（Web）/ MapKit（iOS）|
| **设备配对** | QR 码 + URL 链接，Web/iOS/Desktop 三端互配 |
| **积分商城** | 虚拟货币系统，积分获取与消费 |
| **虚拟衣橱** | Avatar 个性化装扮 |
| **通知推送** | 实时消息推送（三端均支持）|
| **好友系统** | 好友申请、列表、管理 |
| **日程管理** | 日程安排与提醒 |
| **待办清单** | Todo 管理 |

### Web 专属功能
- Float 浮窗（桌面置顶伴侣）、AI 分布地图、双主题切换、表情选择器、百度地图集成、阿里云 OSS、诊断工具页

### iOS 专属功能
- StoreKit 2 应用内购、APNs 系统推送、SSL Pinning、请求去重重试

### Desktop 专属功能
- 系统托盘（最小化/右键菜单）、Gateway 生命周期管理（启停日志）、进程管理（CPU/内存/磁盘）、包管理器、NSIS 安装包

---

## 服务层 — `src/services/`

| 服务 | 职责 |
|------|------|
| `TrixNativeChannelClient.ts` | 核心：WebSocket + REST API 客户端 |
| `chatService.ts` | 聊天消息与对话 |
| `friendService.ts` | 好友管理与申请 |
| `achievementService.ts` | 成就解锁与进度查询 |
| `pointsService.ts` | 积分货币操作 |
| `studySessionService.ts` | 学习会话记录与统计 |
| `locationService.ts` | 好友位置追踪 |
| `baiduMapService.ts` | 百度地图集成 |
| `uploadService.ts` | 文件上传处理 |
| `OSSService.ts` | 阿里云 OSS CDN |
| `ttsService.ts` | Edge TTS 语音合成 |
| `notificationService.ts` | 推送通知管理 |
| `scheduleService.ts` | 日程管理 |
| `todoService.ts` | 待办清单 |
| `sessionService.ts` | Auth 会话管理 |
| `StorageService.ts` | 本地存储抽象 |

---

## 快速开始

```bash
git clone https://github.com/passionworkeer/TRIX_ap.git
cd TRIX_ap
npm install
cp .env.example .env.local   # 填写 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY

npm run dev                  # Web → http://localhost:5173
npm run dev:desktop          # Desktop 开发模式
# iOS: open ios/TRIX3DCompanion/TRIX3DCompanion.xcworkspace
```

### 项目结构

```
src/                    # Web（React 19，19 个路由页面）
desktop/src/main/       # Electron 主进程（IPC 62 处理器 + tray + float）
desktop/src/renderer/   # Electron 渲染进程（Desktop 专属页面）
ios/TRIX3DCompanion/    # iOS（SwiftUI + MVVM + SQLite.swift）
packages/
├── trix-openclaw-native/   # ⭐ OpenClaw 原生 Channel 插件
└── trix-canvas-service/    # TRIX Canvas AI 生成服务
skills/trix-gen-skill/      # AI Gen Skill（Claude Code Skill）
database/               # Supabase Schema
tests/smoke/            # Node.js 冒烟测试
tests/e2e/              # Playwright E2E（Web + Desktop 双模式）
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
npm run test:unit        # 单元测试（Vitest，覆盖率报告）
npm run test:smoke       # 冒烟测试（Node.js）
npm run test:e2e         # E2E（Playwright，Chromium/Firefox/WebKit）
npm run test:all         # 全部测试

npm run build            # Web → dist/（可部署至 Vercel / Netlify / CF Pages）
npm run build:desktop    # Desktop → NSIS 安装包 + 便携 exe
```

### 生产环境

| 服务 | 地址 |
|------|------|
| Web 前端 | http://TRIX_SERVER_HOST |
| TRIX Native | http://TRIX_SERVER_HOST:8788 |
| Gateway | ws://TRIX_SERVER_HOST:18789 |

---

## 文档

| 文档 | 说明 |
|------|------|
| `docs/TRIX_NATIVE_CHANNEL.md` | ⭐ 配对协议唯一真相来源 |
| `docs/architecture/WEB_ARCHITECTURE.md` | Web 架构 + 服务层 |
| `docs/architecture/DESKTOP_ARCHITECTURE.md` | Electron 架构 + IPC 完整 API |
| `docs/architecture/IOS_ARCHITECTURE.md` | iOS MVVM 架构 |
| `docs/ui/LUMINA_DESIGN.md` | Lumina 亮色主题 |
| `docs/ui/DESIGN.md` | Monolith Noir 暗色主题 |
| `docs/guides/PAIRING.md` | 三端配对指南 |
| `docs/guides/DEPLOYMENT.md` | 部署指南 |
| `docs/INDEX.md` | 完整文档索引 |

---

## License

MIT — 参见 [LICENSE](LICENSE)
