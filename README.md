# TRIX 3D Companion

> 三端一体的 AI 伴侣 — 基于 OpenClaw 原生插件架构，支持多模态（文字/语音/图片）实时收发，专注自习室学习陪伴

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19.2.4-61DAFB?logo=react)](https://react.dev)
[![Electron](https://img.shields.io/badge/Electron-33.4-47848F?logo=electron)](https://electronjs.org)
[![Swift](https://img.shields.io/badge/Swift-5.9-FA7343?logo=swift)](https://swift.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Native-7C3AED?logo=lightning)](https://github.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4.2-06B6D4?logo=tailwindcss)](https://tailwindcss.com)

---

## Table of Contents

- [核心亮点](#核心亮点)
- [三端概览](#三端概览)
- [技术架构](#技术架构)
- [TRIX Native Channel（OpenClaw 原生插件）](#trix-native-channelopenclaw-原生插件)
- [多模态消息](#多模态消息)
- [自习室](#自习室)
- [功能详情](#功能详情)
- [开发指南](#开发指南)
- [测试](#测试)
- [部署](#部署)
- [文档](#文档)
- [贡献指南](#贡献指南)

---

## 核心亮点

### OpenClaw 原生架构 — 不是集成，是内置

TRIX Companion 不是"接入" OpenClaw，而是**将自身实现为 OpenClaw Gateway 的原生 Channel 插件**（`trix-openclaw-native`）。

```
OpenClaw Gateway (port 18789)
└── trix-native plugin  ← TRIX 的 Agent、消息、状态直接运行在 Gateway 内部
       ├── startAccount()     ← 永远不返回，阻塞运行
       ├── buildAccountSnapshot()
       └── 51 个 IPC 指令（Desktop）
```

这意味着：AI Agent 与 Gateway 共用同一进程，无 HTTP 中继延迟，原生支持 Gateway 的账户管理、生命周期控制和命令白名单机制。

### 多模态实时收发

三端统一通过 TRIX Native Channel 收发以下内容：

| 模态 | 发送 | 接收 |
|------|------|------|
| **文字** | 实时输入 + 快捷回复 | AI 流式回复 |
| **图片** | 拍照 / 相册上传 | AI 图片理解回复 |
| **语音** | 麦克风录制 | Edge TTS 语音合成 |
| **表情** | Emoji 贴纸 | Reaction 反应 |
| **文件** | Aliyun OSS 上传 | 文件消息展示 |

### 三端完全对齐

| | Web | iOS | Desktop |
|-|------|-----|---------|
| 技术栈 | React 19 + Tailwind CSS 4 | SwiftUI + MVVM | Electron 33 + React 19 |
| 路由/页面数 | 19 路由 | 全页面覆盖 | LuminaLayout 路由 |
| 设计系统 | Lumina + Monolith Noir | Lumina | Lumina + Monolith Noir |
| 配对方式 | 扫码 + 链接 | 扫码 (`QRScannerView`) | IPC + Float 窗口 |
| 特殊能力 | 浮窗 | APNs 推送 | 系统托盘 + 进程管理 |

---

## 三端概览

### Web — `src/`

浏览器端主客户端，19 个路由覆盖全部功能场景。

```
核心技术栈：React 19.2.4 + Vite 6.2 + Tailwind CSS 4.2 + TypeScript 5.8.2
状态管理：    React Context + Hooks
后端：        Supabase（Auth + Realtime + Storage）
路由：        React Router 7（HashRouter，兼容 Electron file:// 协议）
动画：        Framer Motion 12
地图：        Leaflet + React-Leaflet
国际化：      i18next + react-i18next
多主题：      Lumina（亮色）+ Monolith Noir（暗色）双主题
```

### iOS — `ios/TRIX3DCompanion/`

原生 SwiftUI 应用，iOS 16+ 支持，MVVM 架构。

```
核心技术栈：Swift 5.9 + SwiftUI + Combine
网络层：    Alamofire（REST）+ Starscream（WebSocket）
本地存储：  GRDB（SQLite）+ Keychain
地图：      MapKit
相机：      AVFoundation
推送：      APNs
支付：      StoreKit 2
配对：      ClawbotChannelService + QRScannerView
安全：      SSL Pinning + 请求去重重试
```

### Desktop — `desktop/`

Windows 桌面客户端，Electron 33.4，支持多窗口 + 系统托盘。

```
核心技术栈：Electron 33.4 + React 19（Renderer）+ Node.js（Main Process）
多窗口：    主窗口 + Float 窗口（置顶 220×320）+ 可选诊断窗口
IPC：       51 个 main-process 处理器，全部通过 contextBridge 暴露
状态持久：  electron-store（JSON）
日志：      electron-log
构建：      electron-builder（NSIS 安装包 + 便携 exe）
托盘：      程序化图标生成 + 右键菜单 + 快捷回复
Auth：      Supabase 登录/注册/登出（直接 IPC 调用主进程）
系统信息：  CPU、内存、磁盘、进程列表（全部 IPC 获取）
```

---

## 技术架构

```
┌──────────────────────────────────────────────────────────────┐
│                        三端客户端                             │
│  ┌──────────┐      ┌──────────┐      ┌──────────────────┐  │
│  │   Web    │      │   iOS    │      │     Desktop      │  │
│  │ React 19 │      │  SwiftUI │      │   Electron 33    │  │
│  └────┬─────┘      └────┬─────┘      └────────┬─────────┘  │
└───────┼──────────────────┼──────────────────────┼────────────┘
        │                  │                      │
        ▼                  ▼                      ▼
┌──────────────────────────────────────────────────────────────┐
│                    TRIX Native Channel                        │
│         WebSocket (wss) + REST API + QR Pair对等协议          │
│  Base URL: https://trix.love  ·  Local: trix-native:8788    │
└───────────────────────────────┬──────────────────────────────┘
                                │
         ┌──────────────────────┴──────────────────────┐
         │          OpenClaw Gateway (port 18789)        │
         │                                               │
         │   ┌─────────────────────────────────────┐   │
         │   │   trix-openclaw-native Plugin        │   │
         │   │   (Native Channel — 进程内运行)        │   │
         │   │   startAccount() ← 永远不返回          │   │
         │   │   buildAccountSnapshot()              │   │
         │   │   处理: 文字/图片/语音/文件/TTS         │   │
         │   └─────────────────────────────────────┘   │
         └──────────────────────┬───────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────┐
│                   Supabase 后端                                │
│         Auth · Database · Storage · Realtime                 │
└──────────────────────────────────────────────────────────────┘
```

### 关键端口

| 服务 | 端口 | 说明 |
|------|------|------|
| Web Dev Server | 5173 | Vite 开发服务器 |
| OpenClaw Gateway | 18789 | WebSocket 网关，trix-native 插件运行于此 |
| TRIX Native Server | 8788 | 本地 TRIX WebSocket + REST API |
| 正式环境 TRIX | 443 | `https://trix.love` |

---

## TRIX Native Channel（OpenClaw 原生插件）

### 核心设计原则

```
1. 插件是 Gateway 的一等公民
   — Agent 运行在 Gateway 进程内部，不是远程调用
   — startAccount() 必须永远不返回（返回 = 通道停止 = 自动重启循环）

2. 跨平台配对协议（单一真相来源）
   QR 码格式: http://host/pair?code=XXX&secret=YYY&accountId=ZZZ
   有效期: 1 小时 · 轮询间隔: 7 秒

3. 配置键名使用方括号语法
   cfg.channels?.['trix-native']  ← 连字符必须用方括号

4. Desktop IPC 通过 contextBridge 安全暴露
   51 个指令：Gateway 生命周期 / Auth / 渠道消息 / 系统信息
```

### 插件文件结构

```
packages/trix-openclaw-native/
├── openclaw.plugin.json      # 插件声明，包含 channels 数组
├── src/
│   ├── server.ts             # WebSocket 服务器（port 8788）
│   ├── plugin/               # OpenClaw 原生 Channel 实现
│   │   ├── index.ts          # 入口，导出 Plugin 对象
│   │   ├── account.ts        # startAccount() + buildAccountSnapshot()
│   │   ├── messages.ts       # 多模态消息处理
│   │   └── pairing.ts        # QR 配对流程
│   └── ops/                  # Nginx / systemd / 备份 / Token 轮换
```

### Desktop IPC API（51 个处理器）

```typescript
// Gateway 生命周期
window.electronAPI.gateway.start()           // 启动 Gateway 子进程
window.electronAPI.gateway.stop()            // 停止 Gateway
window.electronAPI.gateway.status()          // → { running: boolean }
window.electronAPI.gateway.getLog()          // → string

// Supabase Auth（IPC 直连主进程）
window.electronAPI.auth.signIn(email, password)
window.electronAPI.auth.signUp(email, password)
window.electronAPI.auth.signOut()
window.electronAPI.auth.getSession()         // → Session | null

// 渠道消息（通过 trix-native 插件）
window.electronAPI.channels.list()            // → ChannelInfo[]
window.electronAPI.channels.start(id)
window.electronAPI.channels.stop(id)
window.electronAPI.channels.send(id, payload)

// 系统信息
window.electronAPI.system.info()             // CPU / 内存 / OS
window.electronAPI.system.disk()             // 磁盘使用率
window.electronAPI.system.checkPackages(pkgs) // 检测已安装应用
```

---

## 多模态消息

### 完整消息类型矩阵

| 模态 | Web | iOS | Desktop | 实现方式 |
|------|-----|-----|--------|---------|
| 文字聊天 | ✅ | ✅ | ✅ | TrixNativeChannelClient WebSocket |
| AI 流式回复 | ✅ | ✅ | ✅ | Server-Sent / WebSocket 分片 |
| 图片消息 | ✅ | ✅ | ✅ | AI 拍照 (`html5-qrcode`) + OSS 上传 |
| 语音录制 | ✅ | ✅ | ✅ | 麦克风 MediaRecorder API |
| TTS 语音播报 | ✅ | ✅ | ✅ | Edge TTS (`node-edge-tts`) |
| Emoji 贴纸 | ✅ | ✅ | ✅ | 表情选择器 + Reaction |
| 文件附件 | ✅ | ✅ | ✅ | Aliyun OSS 直传 |
| 位置共享 | ✅ | ✅ | ✅ | Leaflet (Web) / MapKit (iOS) |

### 消息发送流程（Web 为例）

```
用户输入文字/语音/图片
       │
       ▼
TrixNativeChannelClient.ts
  ├── validateMessage()       ← 输入校验
  ├── encodePayload()         ← 序列化
  └── sendWebSocket(payload)  ← WebSocket 发送到 trix.love
              │
              ▼
Trix Service (trix.love)
  ├── 路由到本机 Gateway
  └── trix-native Plugin 处理
              │
              ▼
OpenClaw Gateway (port 18789)
  └── 插件原生处理：AI 推理 → 多模态响应组装
              │
              ▼
WebSocket 推送回所有已配对设备
```

---

## 自习室

自习室（Study Room）是 TRIX Companion 的**核心学习场景**，三端均有完整实现。

### 功能矩阵

| 功能 | Web | iOS | Desktop | 说明 |
|------|-----|-----|--------|------|
| 计时器模式 | ✅ | ✅ | ✅ | 番茄钟 / 自由计时 |
| 专注时长统计 | ✅ | ✅ | ✅ | 今日/本周/本月累计 |
| 学习记录 | ✅ | ✅ | ✅ | 每次学习会话入库 |
| 排行榜 | ✅ | ✅ | — | 好友学习时长排行 |
| AI 陪伴 | ✅ | ✅ | ✅ | 边学习边与 AI 伴侣聊天 |
| 成就关联 | ✅ | ✅ | ✅ | 学习时长解锁成就 |

### 学习数据流

```
用户开始学习
     │
     ▼
studySessionService.startSession()
     │
     ├── Supabase: INSERT study_sessions（开始时间、目标时长）
     ├── TRIX Native: 通知配对设备「用户正在学习」
     └── 启动计时器（倒计时/正计时）
          │
          ├── 每分钟 UPDATE 会话时长
          ├── TRIX Native: 同步学习状态到 AI 伴侣
          └── 计时结束: INSERT 完整记录 + 刷新统计
                     │
                     └── Supabase: 触发成就检查
                           └── achievementService.checkStudyAchievements()
```

### StudyPage 界面（Web）

```
┌─────────────────────────────────────────────────────────────┐
│  学习时长         今日: 2h 34m    本周: 8h 12m    总计: 156h  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              ┌──────────────────────────┐                  │
│              │       🍅  25 : 00        │  ← 番茄钟倒计时    │
│              │    [开始] [暂停] [重置]    │                  │
│              └──────────────────────────┘                  │
│                                                             │
│  学习记录                                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  2026-03-23  25 分钟  🌟 番茄达人初阶                 │  │
│  │  2026-03-23  52 分钟  🌟 专注先锋                      │  │
│  │  2026-03-22  1h 20m  🌟 夜猫学者                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  成就进度                                                    │
│  [🍅 25分钟 x10]  [📚 100小时]  [🌙 深夜学习]              │
└─────────────────────────────────────────────────────────────┘
```

---

## 功能详情

### 核心功能（全部三端）

| 功能 | 说明 |
|------|------|
| **自习室** | 番茄钟计时、学习记录统计、成就关联 |
| **AI 聊天** | 多模态实时对话，AI 伴侣人格 |
| **拍照快照** | AI 相册，支持截图与图库管理 |
| **成就系统** | 17+ 成就，稀有度分级（普通/稀有/史诗/传说），动画进度条 |
| **社交地图** | 好友打卡位置（Web: Leaflet / iOS: MapKit）|
| **设备配对** | QR 码 + URL 链接，支持 Web/iOS/Desktop 三端互配 |
| **积分商城** | 虚拟货币与虚拟形象装扮商店 |
| **衣橱** | 虚拟衣橱，Avatar 个性化 |
| **通知推送** | 实时消息推送（三端均支持）|

### Web 专属

| 功能 | 说明 |
|------|------|
| **Float 浮窗** | 置顶迷你窗口，桌面伴侣，通知预览，快捷回复 |
| **AI 分布地图** | MapPage 可视化 AI Agent 地理分布 |
| **双主题切换** | Lumina（温暖专业亮色）/ Monolith Noir（精准深邃暗色）|
| **表情选择器** | 最近使用 + 搜索 + 分类导航 |
| **百度地图** | 位置服务集成 |
| **阿里云 OSS** | 文件上传与 CDN 分发 |
| **诊断工具** | Diagnostic 页面供开发者调试 |

### Desktop 专属

| 功能 | 说明 |
|------|------|
| **系统托盘** | 最小化到托盘，右键菜单，通知预览，置顶浮窗开关 |
| **Gateway 生命周期** | Settings 页面直接启停 Gateway，实时日志查看 |
| **进程管理** | 查看运行中进程、CPU、内存、磁盘 |
| **包管理器** | 检测本地已安装软件 |
| **NSIS 安装包** | Windows 一键安装 + 便携 exe |

### iOS 专属

| 功能 | 说明 |
|------|------|
| **StoreKit 2** | 应用内购集成 |
| **APNs 推送** | 苹果系统级推送通知 |
| **SSL Pinning** | 网络请求安全加固 |
| **请求去重** | 自动重试 + 去重机制 |

---

## 开发指南

### 环境要求

| 工具 | 版本要求 |
|------|---------|
| Node.js | ≥ 18.x |
| npm | ≥ 9.x |
| Python | ≥ 3.9（trix-openclaw-native）|
| Xcode | ≥ 15（iOS 开发）|
| Windows | 10/11（Desktop）|

### 快速开始

```bash
# 1. 克隆
git clone https://github.com/passionworkeer/TRIX_ap.git
cd TRIX_ap

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env.local
# 填写 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY

# 4. 启动 Web
npm run dev                    # http://localhost:5173

# 5. 启动 Desktop
npm run dev:desktop

# 6. iOS（Xcode 打开）
open ios/TRIX3DCompanion/TRIX3DCompanion.xcworkspace
```

### 项目结构

```
trix-3d-companion/
├── src/                        # Web 端（React 19）
│   ├── components/              # 可复用组件
│   ├── pages/                  # 路由页面（19 个）
│   ├── services/               # 业务服务层
│   ├── hooks/                  # 自定义 Hooks
│   ├── i18n/                   # 国际化
│   ├── types/                  # TypeScript 类型
│   └── styles/                 # Tailwind CSS
│
├── desktop/                    # Electron 桌面端
│   ├── src/
│   │   ├── main/               # 主进程（Node.js）
│   │   │   ├── index.ts        # 入口点
│   │   │   ├── ipc.ts          # 51 个 IPC 处理器
│   │   │   ├── preload.ts      # contextBridge API
│   │   │   ├── tray.ts         # 系统托盘
│   │   │   └── float.tsx       # 浮窗
│   │   └── renderer/           # React 渲染进程
│   └── dist/                   # 构建输出
│
├── ios/TRIX3DCompanion/        # iOS 端（SwiftUI）
│   ├── Sources/                # Swift 源码（MVVM）
│   ├── Resources/              # 资源 + Info.plist
│   └── project.yml             # XcodeGen 配置
│
├── packages/
│   └── trix-openclaw-native/   # ⭐ OpenClaw 原生插件
│       ├── openclaw.plugin.json
│       ├── src/server.ts       # WebSocket 服务器
│       └── src/plugin/         # 插件核心实现
│
├── database/                   # Supabase Schema
├── tests/
│   ├── smoke/                 # 冒烟测试
│   └── e2e/                   # Playwright E2E（Web + Desktop）
└── docs/                       # 50+ 架构文档
```

### 关键开发规则

| 规则 | 原因 |
|------|------|
| 用 `loadFile()` 不 `loadURL()` | asar 打包兼容性 |
| 用 `app.getPath('userData')` 不 `process.cwd()` | 打包后路径正确性 |
| 拖拽区域内按钮加 `-webkit-app-region: no-drag` | 防止按钮随窗口拖动 |
| `startAccount()` 永远不返回 | 返回 = 通道停止 = 自动重启循环 |
| 通道 ID 用方括号：`cfg.channels?.['trix-native']` | 连字符键名语法 |
| Desktop 用 `TrixNativeChannelClient.ts` | 统一客户端实现 |

---

## 测试

```bash
# 单元测试（Vitest）
npm run test:unit
npm run test:unit:watch    # 监听模式
npm run test:unit:coverage # 覆盖率报告

# 冒烟测试（Node.js）
npm run test:smoke

# 服务器测试
npm run test:server

# E2E 测试（Playwright — Chromium / Firefox / WebKit）
npm run test:e2e
npm run test:e2e:ui        # 交互模式
npm run test:e2e:debug     # 调试模式

# 全部测试
npm run test:all
```

**Desktop E2E 双模式策略：**
1. `electron.launch()` 优先 — 直接运行 exe
2. 备用（启动超时）— 进程列表验证 + 日志文件验证 + Gateway 端口健康检查

**覆盖率目标：** 核心服务单元测试覆盖率 ≥ 80%

---

## 部署

### Web

```bash
npm run build   # 输出 dist/，可部署至 Vercel / Netlify / Cloudflare Pages
```

### Desktop

```bash
npm run build:desktop       # NSIS 安装包（.exe）
npm run build:desktop:dir   # 目录输出（便携版）
# 输出：desktop/dist/  和  desktop/dist-desktop/
```

### iOS

```bash
cd ios
xcbuild -project TRIX3DCompanion.xcodeproj \
        -scheme TRIX3DCompanion \
        -configuration Release \
        -derivedDataPath build
```

### 生产环境

| 服务 | 地址 |
|------|------|
| Web 前端 | http://TRIX_SERVER_HOST |
| TRIX Native | http://TRIX_SERVER_HOST:8788 |
| Gateway | ws://TRIX_SERVER_HOST:18789 |

---

## 文档

50+ 文档位于 `docs/`，分类索引：

| 类别 | 核心文档 |
|------|---------|
| **协议** | `TRIX_NATIVE_CHANNEL.md` — ⭐ 配对协议唯一真相来源 |
| **架构** | `WEB_ARCHITECTURE.md` · `DESKTOP_ARCHITECTURE.md` · `IOS_ARCHITECTURE.md` |
| **设计** | `LUMINA_DESIGN.md` · `DESIGN.md`（Monolith Noir）· `DESKTOP_STITCH.md` |
| **数据库** | `DATABASE_SCHEMA.md` · Supabase Schema |
| **指南** | `PAIRING.md` · `DEPLOYMENT.md` · `ENVIRONMENT.md` |
| **索引** | `docs/INDEX.md` — 完整文档导航 |

---

## 贡献指南

### 分支命名

```
feat/<功能名>         # 新功能
fix/<问题描述>        # Bug 修复
refactor/<范围>       # 重构
docs/<范围>           # 文档
test/<范围>           # 测试
chore/<范围>          # 工具/依赖
```

### Commit 格式

```
<type>: <描述>

# 类型：feat / fix / refactor / docs / test / chore / perf / ci
```

### 代码审查清单

- [ ] 无硬编码凭证（API Key、密码、Token）
- [ ] 无 SQL 注入、XSS 漏洞
- [ ] 用户输入在系统边界全部校验
- [ ] 所有异步操作有错误处理
- [ ] TypeScript 无 `any` 类型
- [ ] Desktop 使用 `app.getPath('userData')` 而非 `process.cwd()`
- [ ] 配对使用 URL 格式 `http://host/pair?code=XXX&secret=YYY`

---

## License

MIT License — 参见 [LICENSE](LICENSE)

---

## 技术致谢

- [OpenClaw](https://github.com) — Gateway 插件框架，让 TRIX 成为原生 Channel
- [Supabase](https://supabase.com) — Auth、Database、Storage、Realtime
- [Tailwind CSS](https://tailwindcss.com) — 工具类样式系统
- [Framer Motion](https://www.framer.com/motion/) — 交互动画
- [Leaflet](https://leafletjs.com) — Web 端地图（Web）
- [MapKit](https://developer.apple.com/documentation/mapkit) — iOS 原生地图
- [Electron](https://electronjs.org) — 跨平台桌面
- [Edge TTS](https://github.com/rany2/node-edge-tts) — 神经网络语音合成
