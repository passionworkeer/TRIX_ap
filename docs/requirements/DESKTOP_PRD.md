# TRIX 3D Companion - 产品需求文档 (PRD)

> **文档版本**: 1.2
> **最后更新**: 2026-03-29
> **产品**: TRIX Companion Desktop
> **平台**: Windows (Electron 33.4.0)
> **类型**: 桌面客户端

---

## 1. 产品概述

### 1.1 产品定位

**TRIX Companion Desktop** 是 TRIX 3D Companion 的 Windows 桌面客户端，基于 Electron 构建，定位为 **AI 陪伴助手 + OpenClaw Gateway 控制台**。

核心使命：
- 为 Windows 用户提供与 Web/iOS 一致的学习陪伴体验
- 作为 OpenClaw Gateway 的本地管理工具（安装、启动、监控）
- 提供 TRIX Native Channel 配对二维码生成和管理界面
- 通过 Float 悬浮窗口实现静默配对，不干扰主工作流

### 1.2 核心价值

| 价值点 | 描述 |
|--------|------|
| **Gateway 本地控制** | 无需命令行，一键启动/重启 OpenClaw Gateway，查看运行状态 |
| **跨端配对管理** | 生成配对 QR 码，通过 Float 窗口静默配对 iOS/Web 设备 |
| **AI 陪伴可视化** | Float 窗口实时展示机器人状态（IDLE/THINKING/SPEAKING）动画 |
| **系统托盘集成** | 最小化到托盘，后台运行，快速访问核心功能 |
| **三端一致体验** | 与 Web/iOS 共用同一套设计语言和交互逻辑 |

### 1.3 与 Web/iOS 的关系

```
┌──────────────────────────────────────────────────────────┐
│                   TRIX 3D Companion                        │
├─────────────────┬──────────────────┬──────────────────────┤
│      iOS         │       Web         │     Desktop          │
│   (SwiftUI)      │   (React 19.2)    │   (Electron 33.4)    │
│                  │                   │                      │
│ · 移动端随身使用  │ · 浏览器随时访问  │ · Windows 主力工具   │
│ · 相机/位置服务   │ · 完整功能体验    │ · Gateway 控制台     │
│ · 推送通知       │ · 响应式布局      │ · Float 悬浮配对     │
└─────────────────┴──────────────────┴──────────────────────┘
                         │
                         ▼
           ┌─────────────────────────────┐
           │   OpenClaw Gateway :18789   │
           │   TRIX Native Server :8788   │
           │   Supabase (PostgreSQL)     │
           └─────────────────────────────┘
```

---

## 2. 目标用户

| 用户群体 | 场景 | 核心需求 |
|---------|------|---------|
| **Windows 开发者** | 使用 OpenClaw Gateway 开发/调试 AI Agent | Gateway 启动/监控，无需 CLI |
| **Windows 学习用户** | 桌面环境长时间学习 | 专注计时、AI 陪伴、好友同步 |
| **跨端用户** | 同时使用 iOS/Web/Desktop | 一键配对，数据同步 |
| **AI 爱好者** | 部署和管理 AI Agent | 插件安装、技能管理、备份恢复 |

---

## 3. 功能矩阵

### 3.1 功能总览

| 功能模块 | 功能点 | 状态 |
|---------|-------|------|
| **窗口管理** | 主窗口（1200×800，自定义无边框标题栏） | ✅ 已实现 |
| | Float 悬浮窗口（220×320，始终置顶，透明背景） | ✅ 已实现 |
| | 最小化到系统托盘 | ✅ 已实现 |
| | 托盘右键菜单 | ✅ 已实现 |
| | 主窗口关闭隐藏到托盘（不退出） | ✅ 已实现 |
| **导航与布局** | 可折叠侧边栏（56px 收起 / 200px 展开） | ✅ 已实现 |
| | 主导航：Home, Chat, Study, Snapshot, Map, Profile | ✅ 已实现 |
| | 设置导航：Dashboard, Agents, Channels, Skills, Backups, Settings | ✅ 已实现 |
| | 活动状态指示器（左边框高亮） | ✅ 已实现 |
| **OpenClaw 控制台** | OpenClaw 安装检测 | ✅ 已实现 |
| | 自动安装 OpenClaw（pnpm 优先，npm 回退） | ✅ 已实现 |
| | Gateway 启动/停止/重启 | ✅ 已实现 |
| | Gateway 健康状态检测（HTTP /health） | ✅ 已实现 |
| | Gateway 版本显示 | ✅ 已实现 |
| | Gateway URL 显示和复制 | ✅ 已实现 |
| | 命令输出日志面板 | ✅ 已实现 |
| | 系统信息卡片（Node.js / Electron 版本） | ✅ 已实现 |
| | **OpenClaw status 命令** | ✅ 已实现（新增） |
| | **安装进度事件（install-progress）** | ✅ 已实现（新增） |
| **Agent 管理** | Agent 列表（头像图标） | ✅ 已实现 |
| | Agent 详情面板 | ✅ 已实现 |
| | Agent Info / Capabilities / Skills / Automations Tab | ✅ 已实现 |
| **Channel 配置** | Channel 列表 | ✅ 已实现 |
| | 凭证配置表单 + 状态徽章 | ✅ 已实现 |
| **Skills 管理** | Skills 列表展示 | ✅ 已实现 |
| | Skill 安装/卸载（CLI 命令说明） | ✅ 已实现 |
| **Backups 管理** | 备份列表展示 | ✅ 已实现 |
| | 备份恢复（CLI 命令说明） | ✅ 已实现 |
| **TRIX Native 配对** | QR 码生成 | ✅ 已实现 |
| | 配对状态轮询（每 2 秒） | ✅ 已实现 |
| | 配对码显示（8 位大写字母） | ✅ 已实现 |
| | 配对成功后自动关闭 Float | ✅ 已实现 |
| **Bot 状态可视化** | **四种状态：IDLE / THINKING / SPEAKING / BORING** | ✅ 已实现（新增 BORING） |
| | 状态视频动画背景 | ✅ 已实现 |
| | 主窗口到 Float 的状态 IPC 推送 | ✅ 已实现 |
| | 视频路径 `videos/role1/{state}.mp4` | ✅ 已实现（修正路径） |
| **设置页面** | Overview / Agents / Skills / Backups / Pairing / Gateway Tab | ✅ 已实现（**真实 IPC**，732 行）|

### 3.2 核心功能详述

#### 3.2.1 系统托盘 (System Tray)

**功能描述**：
应用关闭主窗口后不退出进程，最小化到系统托盘常驻后台运行。

**关键特性**：
- 托盘图标：程序生成的 16×16 紫色圆形像素缓冲区（`Buffer.alloc`），**非** `build/tray.png` 文件
- 右键菜单项：
  - 显示/隐藏主窗口
  - Gateway 状态指示
  - 重启 Gateway
  - 生成配对码
  - OpenClaw 状态
  - 退出
- 左键单击：切换主窗口显示/隐藏

---

#### 3.2.2 Float 悬浮窗口 (Float Window)

**功能描述**：
220×320 的小型透明窗口，始终置顶于屏幕右下角，用于静默展示配对 QR 码。

**UI 布局**：
```
┌──────────────────────────────┐
│  [×]  TRIX Companion          │  ← 标题栏（可拖拽，按钮不可拖拽）
├──────────────────────────────┤
│  ┌────────────────────────┐  │
│  │                        │  │
│  │      [QR Code]        │  │  ← base64 PNG 格式
│  │                        │  │
│  └────────────────────────┘  │
│                                │
│     配对码: JJ3JSW7Z           │  ← 8 位大写字母
│     ○ pending...              │  ← 状态轮询指示器
│                                │
│  ┌────────────────────────┐  │
│  │  [AI 状态动画背景]      │  │  ← IDLE/THINKING/SPEAKING/BORING 视频
│  └────────────────────────┘  │
└──────────────────────────────┘
```

**关键特性**：
- 无边框（`frame: false`）
- 固定尺寸（220×320，`resizable: false`）
- 始终置顶（`alwaysOnTop: true`）
- 透明背景
- 跳过任务栏（`skipTaskbar: true`）
- 标题栏区域通过 CSS `-webkit-app-region: drag` 实现拖拽
- 关闭按钮设置 `-webkit-app-region: no-drag` 确保可点击
- 窗口定位：使用 Electron 默认居中定位（**非手动 x/y**）

**技术实现**：
- 配对码轮询：`setInterval` 每 2 秒调用 `pairing:pollStatus`
- 配对成功：显示成功状态，3 秒后自动隐藏
- 视频资源：开发模式（`localhost:5174/videos/role1/`），打包模式（`{resourcesPath}/videos/role1/`）

---

#### 3.2.3 OpenClaw Gateway 控制

**功能描述**：
通过图形界面管理 OpenClaw Gateway 的安装、启动、监控。

**Gateway 管理**：
| 操作 | 实现方式 |
|------|---------|
| 安装检测 | 执行 `openclaw --version`，检测退出码 |
| 自动安装 | `pnpm add -g openclaw` 或 `npm install -g openclaw`（本地优先） |
| 启动 | 子进程 `openclaw gateway --port 18789` |
| 健康检测 | HTTP GET `http://127.0.0.1:18789/health` |
| 重启 | 杀死现有进程（Windows: netstat+taskkill），重新 spawn |
| 停止 | 杀死子进程 |

**安全设计 — 命令白名单**：
```typescript
const ALLOWED_COMMANDS = [
  { cmd: 'status', description: 'OpenClaw status' },
  { cmd: 'doctor', description: 'Health check' },
  { cmd: 'agents', args: ['list'], description: 'List agents' },
  { cmd: 'skills', args: ['list'], description: 'List skills' },
  { cmd: 'pairing', args: ['create'], description: 'Create pairing code' },
  { cmd: 'backup', args: ['list'], description: 'List backups' },
  // ⚠️ backup restore 未在代码中实现，不包含在内
];
```

**命令行超时**：10 秒，防止命令挂起。

---

#### 3.2.4 TRIX Native 配对流程

**功能描述**：
通过 Float 窗口生成配对 QR 码，用户使用 iOS/Web 设备扫描完成配对。

**流程**：
```
Desktop 端:                              iOS/Web 端:
    │                                        │
    ▼                                        ▼
生成配对码（HTTP POST /api/pairings）    打开配对页面
    │                                        │
    │  (显示 QR + 配对码)                   │
    │───────────────▶  扫描 QR 码           │
    │         或                             │
    │         输入配对码 ◀───────────────────┤
    │                                        │
    │         轮询状态（每 2s）              │
    │◀─────────────────────────────────────│
    │                                        │
    ▼                                        ▼
配对成功 ←─────────────────────────→ 配对成功
    │                                        │
    ▼                                        ▼
WebSocket 长连接建立，数据同步开始
```

---

#### 3.2.5 Bot 状态动画

**功能描述**：
Float 窗口背景播放 AI 机器人状态动画，让用户直观感知 AI 当前状态。

**四种状态**：
| 状态 | 含义 | 视频动画 |
|------|------|---------|
| IDLE | 空闲，等待输入 | idle.mp4 |
| THINKING | AI 正在思考/生成回复 | thinking.mp4 |
| SPEAKING | AI 正在说话/输出 | speaking.mp4 |
| BORING | 空闲 + 低电量 | boring.mp4 ← 新增 |

**状态传播**：
```
主窗口 (renderer/main.tsx)
    │
    │  IPC: bot-state:push
    ▼
主进程 (main/index.ts)
    │
    │  IPC: bot-state:changed
    ▼
Float 窗口 (renderer/float.tsx)
```

**视频资源管理**：
- 开发模式：`http://localhost:5174/videos/role1/{state}.mp4`
- 打包模式：`{resourcesPath}/videos/role1/{state}.mp4`
- ExtraResources 配置：`public/videos` → `resources/videos/role1/`

---

## 4. UI/UX 设计

### 4.1 主窗口布局

```
┌──────────────────────────────────────────────────────────────────┐
│ [─][□][×]   TRIX Companion                            （标题栏） │
├──────────┬───────────────────────────────────────────────────────┤
│          │                                                        │
│  Home    │                                                        │
│          │                    [主内容区域]                         │
│  Chat    │                                                        │
│          │  · Home / Chat / Study / Snapshot / Map / Profile    │
│  Study   │  · Dashboard / Agents / Channels / Skills / Backups   │
│          │  · Settings                                          │
│ Snapshot │                                                        │
│          │                                                        │
│  Map     │                                                        │
│          │                                                        │
│ Profile  │                                                        │
│          │                                                        │
├──────────┤                                                        │
│ Settings │                                                        │
│          │                                                        │
│ Dashboard│                                                        │
│ Agents   │                                                        │
│ Channels │                                                        │
│ Skills   │                                                        │
│ Backups  │                                                        │
└──────────┴───────────────────────────────────────────────────────┘
 ← 56px 收起 / 200px 展开 →                                        ↑
                                                            侧边栏导航
```

**侧边栏**：
- 收起宽度：56px（只显示图标）
- 展开宽度：200px（图标 + 文字）
- 主导航与设置导航分离
- 活动项：左侧 3px 紫色边框高亮

---

## 5. 技术架构

### 5.1 系统架构图

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Desktop App (Electron 33.4)                       │
├────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                        Main Process (Node.js)                      │  │
│  │                                                                    │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐ │  │
│  │  │  Window Manager │  │  Tray Manager  │  │  Gateway Subprocess │ │  │
│  │  │  · main window  │  │  · programmatic │  │  · openclaw gateway│ │  │
│  │  │  · float window │  │  · 16×16 purple │  │  · port 18789     │ │  │
│  │  └───────┬────────┘  └───────┬────────┘  └─────────┬──────────┘ │  │
│  │          │                    │                     │            │  │
│  │          └────────────────────┼─────────────────────┘            │  │
│  │                               ▼                                  │  │
│  │              ┌────────────────────────────────────┐             │  │
│  │              │         IPC Handler (62 handlers)   │             │  │
│  │              │  · pairing:createQr  · gateway:*    │             │  │
│  │              │  · openclaw:*      · bot-state:*    │             │  │
│  │              └────────────────────────────────────┘             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                               │ contextBridge                          │
│                               ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      Renderer Process (React 19.2.4)                   │  │
│  │                                                                    │  │
│  │  ┌────────────────────────┐    ┌────────────────────────────┐   │  │
│  │  │     Main Window         │    │       Float Window           │   │  │
│  │  │  · LuminaLayout        │    │  · 配对 QR 码展示            │   │  │
│  │  │  · LuminaTitleBar      │    │  · 配对码状态轮询            │   │  │
│  │  │  · LuminaSidebar      │    │  · Bot 状态动画背景          │   │  │
│  │  │  · Page Components     │    │  · 220×320 透明置顶         │   │  │
│  │  └────────────────────────┘    └────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           外部依赖                                      │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────────┐ │
│  │  OpenClaw CLI   │  │  OpenClaw        │  │  TRIX Native Server    │ │
│  │  (npm/pnpm -g)  │  │  Gateway         │  │  (HTTP :18789 API)     │ │
│  │                 │  │  (port 18789)    │  │                        │ │
│  └─────────────────┘  └─────────────────┘  └────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Supabase (PostgreSQL + Realtime)     TRIX Native Server :8788     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.2 IPC 通信矩阵

共 **62 个** IPC handler，分为 13 大类别。

| IPC 通道 | 方向 | 类型 | 描述 |
|---------|------|------|------|
| `window:show-main` | Renderer → Main | invoke | 显示主窗口 |
| `window:hide-main` | Renderer → Main | invoke | 隐藏主窗口 |
| `window:minimize-to-tray` | Renderer → Main | invoke | 最小化到托盘 |
| `bot-state:push` | Renderer → Main | send | 推送 Bot 状态 |
| `bot-state:changed` | Main → Renderer | send | Bot 状态变更通知 |
| **OpenClaw（14 个）** | | | |
| `openclaw:check` | Renderer → Main | invoke | 检查 OpenClaw 安装状态 |
| `openclaw:install` | Renderer → Main | invoke | 安装 OpenClaw |
| `openclaw:install-progress` | Main → Renderer | send | 安装进度事件 |
| `openclaw:status` | Renderer → Main | invoke | 运行 openclaw status |
| `openclaw:doctor` | Renderer → Main | invoke | 健康检查 |
| `openclaw:run-command` | Renderer → Main | invoke | 执行白名单命令 |
| `openclaw:agents-list` | Renderer → Main | invoke | 列出 Agents |
| `openclaw:skills-list` | Renderer → Main | invoke | 列出 Skills |
| `openclaw:skills-install` | Renderer → Main | invoke | 安装 Skill |
| `openclaw:skills-uninstall` | Renderer → Main | invoke | 卸载 Skill |
| `openclaw:backup-list` | Renderer → Main | invoke | 列出 Backups |
| `openclaw:backup-restore` | Renderer → Main | invoke | 恢复 Backup |
| `openclaw:pairing-create` | Renderer → Main | invoke | 创建配对码 |
| **Supabase Auth（4 个）** | | | |
| `auth:get-session` | Renderer → Main | invoke | 获取当前会话 |
| `auth:sign-in` | Renderer → Main | invoke | 邮箱密码登录 |
| `auth:sign-up` | Renderer → Main | invoke | 邮箱注册 |
| `auth:sign-out` | Renderer → Main | invoke | 登出 |
| **Study Data（6 个）** | | | |
| `study:list-todos` | Renderer → Main | invoke | 列出学习待办 |
| `study:create-todo` | Renderer → Main | invoke | 创建待办 |
| `study:toggle-todo` | Renderer → Main | invoke | 切换完成状态 |
| `study:delete-todo` | Renderer → Main | invoke | 删除待办 |
| `study:get-achievements` | Renderer → Main | invoke | 获取成就列表 |
| `profile:get-stats` | Renderer → Main | invoke | 获取用户统计 |
| **TRIX Native（4 个）** | | | |
| `trixnative:conversations` | Renderer → Main | invoke | 获取会话列表 |
| `trixnative:messages` | Renderer → Main | invoke | 获取消息历史 |
| `trixnative:send-message` | Renderer → Main | invoke | 发送消息 |
| `trixnative:send-reaction` | Renderer → Main | invoke | 发送表情反应 |
| **Channel Pairing（4 个）** | | | |
| `pairing:createQr` | Renderer → Main | invoke | 生成配对 QR 码 |
| `pairing:pollStatus` | Renderer → Main | invoke | 轮询配对状态 |
| `pairing:generate` | Renderer → Main | invoke | 生成配对码 |
| `pairing:list` | Renderer → Main | invoke | 列出已有配对 |
| `pairing:revoke` | Renderer → Main | invoke | 撤销配对码 |
| **Gateway（5 个）** | | | |
| `gateway:status` | Renderer → Main | invoke | 获取 Gateway 运行状态 |
| `gateway:start` | Renderer → Main | invoke | 启动 Gateway |
| `gateway:stop` | Renderer → Main | invoke | 停止 Gateway |
| `gateway:restart` | Renderer → Main | invoke | 重启 Gateway |
| `gateway:logs` | Renderer → Main | invoke | 获取 Gateway 日志 |
| **System Info（5 个）** | | | |
| `system:info` | Renderer → Main | invoke | 获取系统信息（CPU/内存/OS）|
| `system:disk` | Renderer → Main | invoke | 获取磁盘列表 |
| `system:check-packages` | Renderer → Main | invoke | 检查全局 npm 包 |
| `system:autostart-get` | Renderer → Main | invoke | 获取开机自启状态 |
| `system:autostart-set` | Renderer → Main | invoke | 设置开机自启 |
| **Third-party Channels（8 个）** | | | |
| `channels:configure` | Renderer → Main | invoke | 配置 Channel 凭证 |
| `channels:list` | Renderer → Main | invoke | 列出所有 Channel |
| `channels:delete` | Renderer → Main | invoke | 删除 Channel |
| `channels:test` | Renderer → Main | invoke | 测试 Channel 连接 |
| `channels:start-listening` | Renderer → Main | invoke | 开始监听 Channel |
| `channels:stop-listening` | Renderer → Main | invoke | 停止监听 Channel |
| `channels:get-messages` | Renderer → Main | invoke | 获取 Channel 消息 |
| `channels:send-message` | Renderer → Main | invoke | 通过 Channel 发送消息 |
| **Config（4 个）** | | | |
| `config:read` | Renderer → Main | invoke | 读取 openclaw.json |
| `config:write` | Renderer → Main | invoke | 写入 openclaw.json |
| `config:read-section` | Renderer → Main | invoke | 读取指定 section |
| `config:write-section` | Renderer → Main | invoke | 写入指定 section（深度合并）|
| **Cron（5 个）** | | | |
| `cron:list` | Renderer → Main | invoke | 列出所有 Cron 任务 |
| `cron:create` | Renderer → Main | invoke | 创建 Cron 任务 |
| `cron:update` | Renderer → Main | invoke | 更新指定 ID 的 Cron 任务 |
| `cron:delete` | Renderer → Main | invoke | 删除指定 ID 的 Cron 任务 |
| `cron:toggle` | Renderer → Main | invoke | 启用/禁用 Cron 任务 |

### 5.3 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 运行时 | Electron | **33.4.0**（修正） |
| 主进程语言 | Node.js + TypeScript | 20+ |
| 渲染进程语言 | React + TypeScript | **19.2 / 5.8** |
| 构建工具 | Vite | **6.2** |
| Electron 集成 | vite-plugin-electron | 0.29 |
| 打包工具 | electron-builder | 25 |
| 样式 | Tailwind CSS | **4.2.0** |
| Vite Dev Server Port | — | **5174**（修正） |
| 图标 | lucide-react | 最新 |
| 日志 | electron-log | 5 |
| 安装程序 | NSIS（中文）+ MSI | — |

### 5.4 目录结构

```
desktop/
├── electron-builder.yml        # 打包配置（NSIS 中文 + MSI）
├── package.json               # 依赖，electron ^33.4.0
├── vite.config.desktop.ts     # Vite 配置（dev port 5174）
├── tsconfig.desktop.json      # TypeScript 配置
│
├── build/                     # 打包资源
│   ├── icon.ico              # 应用图标 (256×256)
│   └── sidebar.png           # NSIS 侧边栏
│
└── src/
    ├── main/
    │   ├── index.ts           # 主进程入口
    │   ├── window-state.ts    # 窗口状态管理
    │   ├── tray.ts            # 系统托盘（程序生成图标）
    │   ├── gateway.ts         # Gateway 子进程管理
    │   ├── openclaw.ts        # OpenClaw CLI 封装（本地优先）
    │   ├── ipc.ts             # IPC Handler（62 handlers + 2 events）
    │   └── float-window.ts    # Float 窗口工厂
    │
    ├── preload/
    │   └── index.js           # contextBridge API（CommonJS）
    │
    ├── renderer/
    │   ├── main.tsx           # 主窗口 React 入口
    │   ├── main.html          # 主窗口 HTML Shell
    │   ├── float.html          # Float 窗口 HTML Shell
    │   ├── float.tsx          # Float 窗口 React 应用
    │   │
    │   ├── components/
    │   │   └── FloatHeroBackground.tsx # Bot 状态视频（含 BORING 状态）
    │   │
    │   └── stitch/             # ★ stitch 设计系统（Lumina + Monolith Noir）
    │       ├── shared/
    │       │   ├── LuminaLayout.tsx   # 主布局（浅色/深色双主题路由）
    │       │   └── cn.ts            # classMerge 工具
    │       ├── lumina/
    │       │   ├── tokens.ts        # Lumina 浅色 token
    │       │   ├── components/
    │       │   │   ├── TitleBar.tsx   # 36px 标题栏
    │       │   │   ├── Sidebar.tsx     # 可折叠 240px 侧边栏
    │       │   │   ├── buttons.tsx    # LuminaButton
    │       │   │   ├── cards.tsx      # SurfaceCard
    │       │   │   └── inputs.tsx    # LuminaInput
    │       │   └── pages/
    │       │       ├── ChatPage.tsx
    │       │       ├── StudyPage.tsx
    │       │       ├── SnapshotPage.tsx
    │       │       └── ProfilePage.tsx
    │       └── noir/
    │           ├── tokens.ts        # Monolith Noir 深色 token
    │           ├── components/
    │           │   ├── DarkCard.tsx
    │           │   ├── DarkButton.tsx
    │           │   └── DarkTerminal.tsx
    │           └── pages/
    │               ├── DashboardPage.tsx
    │               ├── AgentsPage.tsx
    │               ├── ChannelsPage.tsx
    │               ├── SettingsPage.tsx
    │               └── BackupsPage.tsx
    │   │
    │   └── pages/             # 页面组件
    │
    └── types/
        └── electron.d.ts      # electronAPI TypeScript 声明
```

### 5.5 构建与打包

**构建命令**：
```bash
npm run dev:desktop       # 开发模式（dev port 5174，热重载）
npm run build:desktop     # 生产构建 + NSIS 安装程序
npm run build:desktop:dir # 仅构建 unpacked 目录
```

**打包输出**：
```
C:/Users/wang/Desktop/TRIX Companion 3/
├── TRIX Companion-Setup-1.0.0.exe  # NSIS 安装程序（compression: maximum）
├── TRIX Companion-Setup-1.0.0.msi   # MSI 安装包
└── win-unpacked/                    # 便携版（无需安装）
    └── TRIX Companion.exe
```

**v1.3 构建优化**：
- `compression: maximum` — 最大压缩率
- 显式 `files` 过滤 — 排除 `3d/`（Three.js 32MB）和 `videos/`
- `shortcutName: TRIX Companion` — 快捷方式名称精确化

---

## 6. 安全设计

### 6.1 渲染进程隔离

| 配置项 | 值 | 说明 |
|--------|----|------|
| `contextIsolation` | `true` | 渲染进程无法访问 Node.js |
| `nodeIntegration` | `false` | 渲染进程无法访问主进程 |
| `sandbox` | `false` | preload 脚本需要 Node.js 访问 |
| `webSecurity` | `true` | 启用同源策略 |

### 6.2 命令执行安全

- **白名单机制**：只有 `ALLOWED_COMMANDS` 列表中的命令可执行
- **参数验证**：命令参数经过正则校验（仅允许字母/数字/短横线/下划线）
- **超时机制**：命令执行 10 秒超时，超时强制终止
- **输出截断**：命令输出最大 10KB，防止内存溢出

### 6.3 输入验证

| 输入 | 验证规则 |
|------|---------|
| Bot 状态 | 仅允许 `IDLE` / `THINKING` / `SPEAKING` / `BORING` |
| 配对码 | 6-8 位大写字母 |
| Skill 名称 | 仅允许 `a-zA-Z0-9_-` |
| 备份名称 | 仅允许 `a-zA-Z0-9_-` |

---

## 7. 已实现功能检查清单

### 7.1 核心功能
- [x] Electron 主进程 + 渲染进程分离架构
- [x] 自定义无边框窗口 + 标题栏（最小化/关闭）
- [x] Float 悬浮窗口（220×320，透明，置顶）
- [x] 系统托盘（程序生成图标、菜单、事件处理）
- [x] 主窗口关闭隐藏到托盘（不退出应用）
- [x] 可折叠侧边栏导航
- [x] contextBridge 安全 IPC 通信（62 handlers + 2 events）
- [x] 命令白名单安全机制
- [x] `loadFile()` 替代 `loadURL()` 解决 asar 兼容
- [x] React RenderErrorBoundary 错误边界

### 7.2 OpenClaw 集成
- [x] OpenClaw 安装检测（本地优先 + PATH 回退）
- [x] 自动安装（pnpm / npm）
- [x] Gateway 启动/停止/重启
- [x] Gateway 健康状态检测
- [x] `openclaw status` 命令
- [x] OpenClaw Doctor 健康检查
- [x] Agents / Skills / Backups 列表展示
- [x] 命令输出日志面板
- [x] `openclaw:install-progress` 安装进度事件

### 7.3 TRIX Native 配对
- [x] QR 码生成（HTTP API）
- [x] 配对码展示（8 位大写字母）
- [x] 配对状态轮询（每 2 秒）
- [x] 配对成功后自动关闭 Float

### 7.4 Bot 状态可视化
- [x] 四种状态（IDLE / THINKING / SPEAKING / BORING）
- [x] 状态视频动画背景（`videos/role1/{state}.mp4`）
- [x] 主窗口到 Float 的状态 IPC 推送
- [x] 开发/打包模式视频路径处理

### 7.5 构建与发布
- [x] Vite + Electron 开发环境（dev port 5174）
- [x] electron-builder NSIS 安装程序（中文）
- [x] electron-builder MSI 安装程序
- [x] ExtraResources 视频资源打包（含 role1/ 子目录）
- [x] 便携版（win-unpacked）输出到桌面
- [x] NSIS 侧边栏品牌、EULA/隐私政策

---

**文档维护**: TRIX 开发团队
**最后更新**: 2026-03-23
