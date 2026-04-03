# Desktop 桌面端架构文档

> **版本**: 2.1
> **最后更新**: 2026-04-03（源码扫描确认 IPC 99 handlers，preload 79 unique methods）
> **平台**: Windows (Electron 33.4.0)

---

## 1. 架构概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Desktop Architecture (Electron)                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        Main Process                               │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │   │
│  │  │  Window Mgr  │  │    Tray      │  │  Gateway Subprocess  │ │   │
│  │  │  (BrowserWin) │  │  (Programmatic) │ │  (openclaw gateway)   │ │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘ │   │
│  │                                                                  │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │                    IPC Handlers (99 handlers)              │  │   │
│  │  │  pairing · gateway · openclaw · auth · study · system*         │  │   │
│  │  └──────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│                          contextBridge / preload                         │
│                                    │                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Renderer Process                              │   │
│  │  ┌────────────────────┐      ┌────────────────────────────────┐ │   │
│  │  │     Main Window     │      │        Float Window             │ │   │
│  │  │  (React 19.2.4 + Vite 6.2) │      │    (右下角 QR 配对面板)          │ │   │
│  │  │  desktop/src/main.tsx │  │    desktop/src/float.tsx        │ │   │
│  │  └────────────────────┘      └────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 进程模型

### 2.1 主进程（Main Process）

Electron 应用的主入口，运行在 Node.js 环境中。

**职责**：
- 管理所有 BrowserWindow 实例
- 管理系统托盘（Tray）
- 启动和管理 OpenClaw Gateway 子进程
- 注册和分发 IPC Handler
- 应用生命周期管理

**入口**: `desktop/src/main/index.ts`

### 2.2 预加载脚本（Preload）

通过 `contextBridge` 安全地将主进程 API 暴露给渲染进程。

**暴露 API**（`desktop/src/preload/index.js`，共 **79 个**属性/方法，含 Gateway WS RPC，不含重复项）:
```typescript
window.electronAPI = {
  // === Platform ===
  platform: string,              // process.platform
  isDesktop: true,

  // === Window Management ===
  showMainWindow: () => Promise<void>,
  hideMainWindow: () => Promise<void>,
  minimizeToTray: () => Promise<void>,

  // === Window Management ===
  windowResize: (opts: { width?: number; height?: number }) => Promise<boolean>,
  windowMove: (x: number, y: number) => Promise<boolean>,
  windowSetBounds: (bounds: { x?: number; y?: number; width?: number; height?: number }) => Promise<boolean>,
  windowGetBounds: () => Promise<{ x: number; y: number; width: number; height: number }>,
  windowMinimize: () => Promise<boolean>,
  windowMaximize: () => Promise<boolean>,
  windowIsMaximized: () => Promise<boolean>,

  // === Float Window Drag ===
  floatMove: (x: number, y: number) => Promise<boolean>,
  floatGetPosition: () => Promise<[number, number]>,

  // === Bot State ===
  pushBotState: (state: BotState) => Promise<boolean>,

  // === OpenClaw ===
  checkOpenClaw: () => Promise<OpenClawStatus>,
  installOpenClaw: () => Promise<void>,
  runOpenClawDoctor: () => Promise<string>,
  runOpenClawCommand: (cmd: string) => Promise<string>,
  listAgents: () => Promise<Agent[]>,
  listSkills: () => Promise<Skill[]>,
  installSkill: (name: string) => Promise<void>,
  uninstallSkill: (name: string) => Promise<void>,
  // Skill Marketplace (ClawHub) — 新增
  skillsListFull: () => Promise<Skill[]>,
  skillsSearch: (query: string) => Promise<Skill[]>,
  skillsExplore: () => Promise<Skill[]>,
  skillsClawhubInstall: (slug: string) => Promise<void>,
  listBackups: () => Promise<Backup[]>,
  restoreBackup: (id: string) => Promise<void>,
  createPairingCode: () => Promise<{ code: string }>,

  // === Native Channel Pairing ===
  createQrCode: (label?: string) => Promise<PairingQrData>,
  createPairingQr: (label?: string) => Promise<PairingQrData>,  // 兼容别名
  pollPairingStatus: (code: string) => Promise<PairingStatus>,
  pairingGenerate: () => Promise<PairingResult>,
  pairingList: () => Promise<PairingRecord[]>,
  pairingRevoke: (id: string) => Promise<void>,

  // === Gateway ===
  getGatewayStatus: () => Promise<GatewayStatus>,
  gatewayStart: () => Promise<void>,        // 启动 Gateway（非 restart）
  restartGateway: () => Promise<void>,
  stopGateway: () => Promise<void>,
  gatewayLogs: (opts?: { lines?: number }) => Promise<string[]>,

  // === Gateway WebSocket RPC (v2.1 新增) ===
  gatewayConnect: () => Promise<{ success: boolean; error?: string }>,
  gatewayAgents: () => Promise<{ success: boolean; data?: GatewayAgent[]; error?: string }>,
  gatewaySessions: () => Promise<{ success: boolean; data?: GatewaySession[]; error?: string }>,
  gatewayChatHistory: (sessionKey: string, limit?: number) => Promise<{ success: boolean; data?: ChatMessage[]; error?: string }>,
  gatewayLogsWs: (tail?: number) => Promise<{ success: boolean; data?: string[]; error?: string }>,
  gatewayRpc: (method: string, params?: Record<string, unknown>) => Promise<{ success: boolean; data?: unknown; error?: string }>,
  gatewayHealthRpc: () => Promise<{ success: boolean; data?: GatewayHealthData; error?: string }>,
  onGatewayEvent: (callback: (event: Record<string, unknown>) => void) => () => void,

  // === Supabase Auth ===
  authGetSession: () => Promise<AuthSession>,
  authSignIn: (email: string, password: string) => Promise<AuthUser>,
  authSignUp: (email: string, password: string) => Promise<AuthUser>,
  authSignOut: () => Promise<void>,
  authRefreshSession: () => Promise<AuthSession>,       // v2.1 新增
  authSetSession: (sessionData: unknown) => Promise<void>, // v2.1 新增
  profileUpdate: (updates: Record<string, unknown>) => Promise<unknown>, // v2.1 新增

  // === Study Data ===
  listTodos: () => Promise<Todo[]>,
  createTodo: (title: string, priority?: string) => Promise<Todo>,
  toggleTodo: (id: string, completed: boolean) => Promise<void>,
  deleteTodo: (id: string) => Promise<void>,
  getAchievements: () => Promise<Achievement[]>,
  getProfileStats: () => Promise<ProfileStats>,

  // === Study Session（3）— 补全
  createStudySession: (sessionId: string, duration?: number) => Promise<StudySession>,
  updateStudySession: (sessionId: string, updates: Partial<StudySession>) => Promise<void>,
  getStudyStats: () => Promise<StudyStats>,

  // === Study Room（6）— 补全
  createStudyRoom: (name?: string) => Promise<StudyRoom>,
  joinStudyRoom: (roomCode: string) => Promise<void>,
  leaveStudyRoom: () => Promise<void>,
  studyRoomHostAction: (action: string) => Promise<void>,
  getStudyRoom: (roomCode: string) => Promise<StudyRoom>,
  lookupStudyRoomsByUsers: (userIds: string[]) => Promise<StudyRoom[]>,

  // === TRIX Native ===
  listConversations: () => Promise<Conversation[]>,
  fetchMessages: (conversationId: string) => Promise<Message[]>,
  sendMessage: (conversationId: string, content: string) => Promise<Message>,
  sendImageMessage: (conversationId: string, payload: ImagePayload) => Promise<Message>,   // v2.1 新增
  sendAttachmentMessage: (conversationId: string, payload: AttachmentPayload) => Promise<Message>, // v2.1 新增
  sendReaction: (messageId: string, emoji: string) => Promise<void>,

  // === Channels (Telegram / Feishu / Discord / Slack / WhatsApp / WeCom) ===
  channelsConfigure: (channelId: string, config: ChannelConfig) => Promise<void>,
  channelsList: () => Promise<ChannelInfo[]>,
  channelsDelete: (channelId: string) => Promise<void>,
  channelsTest: (channelId: string, config: ChannelConfig) => Promise<TestResult>,
  channelsStartListening: (channelId: string) => Promise<void>,
  channelsStopListening: (channelId: string) => Promise<void>,
  channelsGetMessages: (channelId: string, opts?: { limit?: number }) => Promise<Message[]>,
  channelsSendMessage: (channelId: string, text: string, opts?: Record<string, string>) => Promise<void>,

  // === Config (openclaw.json) ===
  configRead: () => Promise<object>,
  configWrite: (data: object) => Promise<void>,
  configReadSection: (section: string) => Promise<object>,
  configWriteSection: (section: string, data: object) => Promise<void>,

  // === Cron Jobs ===
  cronList: () => Promise<CronJob[]>,
  cronCreate: (job: CronJobInput) => Promise<CronJob>,
  cronUpdate: (id: string, job: CronJobInput) => Promise<CronJob>,
  cronDelete: (id: string) => Promise<void>,
  cronToggle: (id: string, enabled: boolean) => Promise<void>,

  // === System Info ===
  getSystemInfo: () => Promise<SystemInfo>,
  getDiskInfo: () => Promise<DiskInfo[]>,
  checkPackages: () => Promise<PackageInfo[]>,
  getAutostart: () => Promise<boolean>,
  setAutostart: (enabled: boolean) => Promise<void>,

  // === App Info ===
  getAppInfo: () => Promise<AppInfo>,

  // === Video Resources ===
  getVideoBaseUrl: () => string,
  getVideoUrl: (filename: string) => string,

  // === Event Listeners（返回取消函数）===
  onBotStateChange: (callback: (state: string) => void) => () => void,
  onTrixMessage: (callback: (msg: Message) => void) => () => void,
  onChannelMessage: (callback: (msg: Message) => void) => () => void,
  onChannelStatusUpdate: (callback: (status: ChannelStatus) => void) => () => void,
  onInstallProgress: (callback: (msg: string) => void) => () => void,
  onGatewayLog: (callback: (line: string) => void) => () => void,
}
```

**文件**: `desktop/src/preload/index.js`

> **注意**: `preferencesGet`/`preferencesSet`、`friendsList`/`friendsAdd`/`friendsAccept`/`friendsRemove`、`notificationsList`/`notificationsMarkRead`/`notificationsMarkAllRead` 在 preload 中已声明但主进程 IPC handler **尚未实现**，调用将返回 unhandled promise rejection。

### 2.3 渲染进程（Renderer Process）

两个独立的 React 应用：

| 窗口 | 入口 | 用途 |
|------|------|------|
| 主窗口 | `renderer/main.tsx` + `main.html` | stitch 设计系统（`LuminaLayout`）|
| Float 窗口 | `renderer/float.tsx` + `float.html` | 右下角 QR 配对面板 |

> **注意**：主窗口使用 `loadFile()` 而非 `loadURL()`，解决 asar 打包兼容问题。

**LuminaLayout 路由系统**（内存状态，非 URL 路由）：

| 路由 ID | 页面 | 主题 | 说明 |
|---------|------|------|------|
| `chat` | ChatPage | Lumina 浅色 | 默认首页 |
| `study` | StudyPage | Lumina 浅色 | 学习页 |
| `snapshot` | SnapshotPage | Lumina 浅色 | 快照页 |
| `profile` | ProfilePage | Lumina 浅色 | 个人资料 |
| `map` | MapPage | Lumina 浅色 | 地图页 |
| `dashboard` | DashboardPage | Noir 深色 | OpenClaw 控制台 |
| `agents` | AgentsPage | Noir 深色 | Agent 管理 |
| `channels` | ChannelsPage | Noir 深色 | 渠道配置 |
| `backups` | BackupsPage | Noir 深色 | 数据备份 |
| `settings` | SettingsContainer | Noir 深色 | 系统设置（含 14 个子面板） |
| `skills` | SkillsPlaceholder | Noir 深色 | 引导至 Settings |

**Settings 子面板**（14 个）：SettingsAccount、SettingsAgents、SettingsBackups、SettingsBrowser、SettingsChannels、SettingsCron、SettingsGateway、SettingsModels、SettingsOverview、SettingsPairing、SettingsPlugins、SettingsSkills、SettingsSystem

**路由分发逻辑**：`LuminaLayout` 使用 React `useState` 管理 `activeRoute`，`LuminaSidebar` 点击触发 `onNavigate`，页面通过 `React.lazy` + `Suspense` 懒加载。

---

## 3. 核心模块

### 3.1 窗口管理 (`window-state.ts` + `index.ts`)

```typescript
// 主窗口配置
const mainWindow = new BrowserWindow({
  width: 1200, height: 800,
  minWidth: 800, minHeight: 600,
  frame: false,
  titleBarStyle: 'hidden',
  webPreferences: { preload: '...' },
});

// Float 窗口配置
const floatWindow = new BrowserWindow({
  width: 220, height: 320,
  frame: false,
  resizable: false,
  alwaysOnTop: true,
  // 使用 Electron 默认居中定位（不再手动指定 x/y）
  webPreferences: { preload: '...' },
});
```

**关键设计**：
- Float 窗口 `frame: false` → 无标题栏，依赖 CSS `drag` 区域
- 按钮必须设置 `-webkit-app-region: no-drag` 才能点击
- 主窗口关闭时隐藏到托盘，不退出应用

### 3.2 系统托盘 (`tray.ts`)

**注意**：托盘图标为程序生成的 16×16 紫色圆形像素缓冲区（`Buffer.alloc(16 * 16 * 4)`），**非**从 `build/tray.png` 文件加载。

```typescript
// 托盘右键菜单
const contextMenu = Menu.buildFromTemplate([
  { label: '显示主窗口', click: () => mainWindow.show() },
  { label: '隐藏主窗口', click: () => mainWindow.hide() },
  { type: 'separator' },
  { label: 'Gateway: 运行中 (端口 18789)', enabled: false },
  { label: '重启 Gateway', click: () => restartGateway() },
  { type: 'separator' },
  { label: '生成配对码', click: () => showFloatWindow() },
  { label: 'OpenClaw 状态', click: () => checkOpenclaw() },
  { type: 'separator' },
  { label: '退出', click: () => { app.exit(0); } },
]);

tray.on('click', () => mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show());
```

### 3.3 Gateway 子进程 (`gateway.ts`)

```typescript
// 启动 Gateway
const GATEWAY_PORT = 18789;
const userDataDir = app.getPath('userData');

const gatewayProcess = spawn('openclaw', ['gateway', '--port', String(GATEWAY_PORT)], {
  env: {
    ...process.env,
    TRIX_GATEWAY_PORT: String(GATEWAY_PORT),
    TRIX_NATIVE_STORAGE_DIR: userDataDir,  // 统一存储路径
  },
});

// 健康检查：等待 Gateway 就绪（最多 15 秒）
async function waitForGatewayReady(): Promise<void> {
  for (let i = 0; i < 15; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/health`);
      if (res.ok) return;
    } catch { /* retry */ }
    await sleep(1000);
  }
  throw new Error('Gateway 启动超时');
}
```

**Gateway 进程管理**：
- 退出码非 0 仅记录错误（**不自动重启**）
- `TRIX_NATIVE_STORAGE_DIR` 确保 Gateway 和 IPC 读写同一 `state.json`
- Windows 特殊处理：使用 `netstat` + `taskkill` 杀死进程

**v2.1 新增功能**：
- **Triple-layer Health Check**（port + HTTP + CLI，15s TTL 缓存）
- **Diagnostic Engine**（自动分析日志 + 根因诊断 + 置信度）
- **Knowledge Base**（electron-store 持久化已知问题与解决方案）
- **WebSocket RPC Client**（连接 Gateway WS，JSON-RPC 请求，connect.challenge 握手）

### 3.4 OpenClaw 安装 (`openclaw.ts`)

```typescript
// 自动安装 openclaw（pnpm 优先，npm 回退）
// 安装路径：app.getPath('userData')/openclaw/openclaw.cmd（Windows）
// 本地优先查找，找不到再从 PATH 调用
async function ensureOpenclawInstalled(): Promise<void> {
  // 1. 检查本地 userData/openclaw
  // 2. 检查 PATH (where openclaw / which openclaw)
  // 3. 执行 pnpm add -g openclaw 或 npm install -g openclaw
}
```

### 3.5 IPC Handler (`ipc.ts`)

**概况**：共 **99 个** `ipcMain.handle` 注册，无 `ipcMain.on` 事件。分为 15 个大类别：

**bot-state 事件**通过 `webContents.send`（位于 `window-state.ts`）主动推送，**不是** IPC handler：
- `bot-state:push` → 渲染进程 → 主进程（handler）
- `bot-state:changed` → 主进程 → Float 窗口（webContents.send，非 ipcMain.on）

**openclaw:install-progress** 同理，由主进程通过 `event.sender.send` 主动推送。

```typescript
// 全部 99 个 ipcMain.handle（15 个大类别；v2.1 含 Gateway WS RPC / Triple-layer Health / Diagnostic Engine / KB）

// Window Management（11）
'window:show-main'         → 显示主窗口
'window:hide-main'        → 隐藏主窗口
'window:minimize-to-tray' → 最小化到托盘
'window:resize'            → 调整主窗口大小
'window:move'              → 移动主窗口
'window:set-bounds'        → 设置主窗口边界
'window:get-bounds'        → 获取主窗口边界
'window:minimize'          → 最小化主窗口
'window:maximize'          → 最大化/还原主窗口
'window:is-maximized'      → 查询最大化状态
'float:move'               → 移动 Float 窗口位置
'float:get-position'       → 获取 Float 窗口位置

// Bot State（1）
'bot-state:push'           → 推送 Bot 状态（Renderer → Main）

// OpenClaw（16）— 含 4 个 ClawHub marketplace
'openclaw:check'           → 检查安装状态
'openclaw:install'         → 安装 OpenClaw
'openclaw:status'          → 运行 openclaw status 命令
'openclaw:doctor'          → 健康检查
'openclaw:run-command'     → 执行白名单命令
'openclaw:agents-list'     → 列出 Agents
'openclaw:skills-list'     → 列出 Skills
'openclaw:skills-install'  → 安装 Skill
'openclaw:skills-uninstall' → 卸载 Skill
'openclaw:skills-list-full' → ClawHub 完整列表
'openclaw:skills-search'   → ClawHub 搜索
'openclaw:skills-explore'  → ClawHub 发现
'openclaw:skills-clawhub-install' → ClawHub 安装
'openclaw:backup-list'     → 列出 Backups
'openclaw:backup-restore'  → 恢复 Backup
'openclaw:pairing-create'  → 创建配对码

// Supabase Auth（7）— v2.1 新增 refresh / setSession / profileUpdate
'auth:get-session'         → 获取当前会话
'auth:sign-in'             → 邮箱密码登录
'auth:sign-up'             → 邮箱注册
'auth:sign-out'            → 登出
'auth:refresh-session'     → 刷新 Session（v2.1 新增）
'auth:set-session'         → 手动设置 Session（v2.1 新增）
'profile:update'           → 更新用户资料（v2.1 新增）

// Study Data（5）
'study:list-todos'          → 列出学习待办
'study:create-todo'         → 创建待办
'study:toggle-todo'        → 切换完成状态
'study:delete-todo'        → 删除待办
'study:get-achievements'   → 获取成就列表

// Study Session（3）— 补全
'study:create-session'      → 创建学习会话
'study:update-session'      → 更新学习会话
'study:get-stats'           → 获取学习统计

// Study Room（6）— 补全
'study-room:create'          → 创建自习室
'study-room:join'            → 加入自习室
'study-room:leave'          → 离开自习室
'study-room:host-action'    → 主持人操作（start_focus/pause/end）
'study-room:get'            → 获取自习室详情
'study-room:lookup-by-users' → 按用户查找自习室

// Profile（1）
'profile:get-stats'        → 获取用户统计

// TRIX Native（7）— v2.1 新增 sendImageMessage / sendAttachmentMessage
'trixnative:conversations'  → 获取会话列表
'trixnative:messages'       → 获取消息历史
'trixnative:send-message'   → 发送文本消息
'trixnative:send-image-message'   → 发送图片消息（v2.1 新增）
'trixnative:send-attachment-message' → 发送附件消息（v2.1 新增）
'trixnative:send-reaction'  → 发送表情反应

// Native Channel Pairing（5）
'pairing:createQr'          → 生成配对 QR 码
'pairing:pollStatus'        → 轮询配对状态
'pairing:generate'          → 生成配对码
'pairing:list'              → 列出已有配对
'pairing:revoke'            → 撤销配对码

// Gateway（13）— 含 Triple-layer Health / Diagnostic Engine / KB / WS RPC
'gateway:status'            → 获取 Gateway 运行状态
'gateway:start'              → 启动 Gateway
'gateway:stop'               → 停止 Gateway
'gateway:restart'            → 重启 Gateway
'gateway:logs'               → 获取 Gateway 日志（内存缓冲区）
'gateway:health'             → Triple-layer 健康检查（port + HTTP + CLI，15s TTL 缓存）
'gateway:diagnose'           → 运行诊断引擎（health + log 分析）
'gateway:logs:analyze'        → 分析 Gateway 日志错误模式
'gateway:kb:stats'           → 知识库统计
'gateway:kb:record'          → 记录修复尝试（学习）
'gateway:connect'            → 连接 Gateway WebSocket 通道（v2.1 新增）
'gateway:agents'             → 通过 WS RPC 获取 Agent 列表（v2.1 新增）
'gateway:sessions'            → 通过 WS RPC 获取 Session 列表（v2.1 新增）
'gateway:chat-history'        → 通过 WS RPC 获取聊天历史（v2.1 新增）
'gateway:logs:ws'            → 通过 WS RPC 获取日志（v2.1 新增）
'gateway:rpc'                 → 通用 WS RPC 调用（v2.1 新增）
'gateway:health-rpc'         → 通过 WS RPC 获取完整健康数据（v2.1 新增）

// System Info（6）
'system:info'               → 获取系统信息（CPU/内存/OS）
'system:disk'               → 获取磁盘列表
'system:check-packages'     → 检查全局 npm 包
'system:autostart-get'     → 获取开机自启状态
'system:autostart-set'     → 设置开机自启

// Third-party Channels（8）— 配置/测试/CRUD
'channels:configure'        → 配置 Channel 凭证
'channels:list'             → 列出所有 Channel
'channels:delete'           → 删除 Channel
'channels:test'             → 测试 Channel 连接（Telegram / Feishu / Discord / Slack / WhatsApp / WeCom）
'channels:start-listening'  → 开始监听 Channel（长轮询/WebSocket）
'channels:stop-listening'   → 停止监听 Channel
'channels:get-messages'    → 获取 Channel 消息（内存缓冲区）
'channels:send-message'     → 通过 Channel 发送消息（支持 opts 参数，v2.1 更新）

// Config（4）
'config:read'              → 读取 openclaw.json 完整内容
'config:write'             → 写入 openclaw.json 完整内容
'config:read-section'      → 读取 openclaw.json 指定 section
'config:write-section'     → 写入 openclaw.json 指定 section（深度合并）

// Cron（5）
'cron:list'               → 列出所有 Cron 任务
'cron:create'             → 创建新 Cron 任务
'cron:update'             → 更新指定 ID 的 Cron 任务
'cron:delete'             → 删除指定 ID 的 Cron 任务
'cron:toggle'             → 启用/禁用指定 ID 的 Cron 任务
```

**OpenClaw 命令白名单**（`ipc.ts`）：
```typescript
const ALLOWED_COMMANDS = [
  { cmd: 'status', description: 'OpenClaw status' },
  { cmd: 'doctor', description: 'Health check' },
  { cmd: 'agents', args: ['list'], description: 'List agents' },
  { cmd: 'skills', args: ['list'], description: 'List skills' },
  { cmd: 'pairing', args: ['create'], description: 'Create pairing code' },
  { cmd: 'backup', args: ['list'], description: 'List backups' },
  { cmd: 'backup', args: ['create'], description: 'Create a new backup' },
];
```

### 3.6 Float Window (`float.tsx`)

**功能描述**：
260×280 的小型透明窗口，始终置顶于屏幕右下角，支持配对 + 实时 Bot 状态可视化。

```
┌────────────────────────────┐
│  [×]  TRIX Companion       │  ← 标题栏（可拖拽）
├────────────────────────────┤
│  ┌──────────────────────┐ │
│  │                      │ │
│  │      [QR Code]      │ │  ← base64 PNG 配对码
│  │                      │ │
│  └──────────────────────┘ │
│  配对码: JJ3JSW7Z         │  ← 8位大写字母
│  ○ pending...              │  ← 轮询状态指示
│                            │
│  ┌──────────────────────┐ │
│  │  [Bot 状态动画]      │ │  ← IDLE/THINKING/SPEAKING/BORING
│  └──────────────────────┘ │
│                            │
│  💬 快捷回复  🔔 通知预览 │  ← 新增（v1.3）
└────────────────────────────┘
```

**v1.3 新增功能**（`b1e3032`）：
- **快捷回复**：预设快速回复按钮，点击直接发送
- **表情反应**：消息气泡支持发送 emoji 反应
- **通知预览**：实时推送通知内容预览

**Bot 状态动画**（`FloatHeroBackground.tsx`）：
- 四种状态：`IDLE` | `THINKING` | `SPEAKING` | `BORING`（低电量时）
- 视频路径：`videos/role1/{state}.mp4`（注意 `role1/` 子目录）
- 开发模式：`http://localhost:5174/videos/role1/{state}.mp4`
- 打包模式：`{resourcesPath}/videos/role1/{state}.mp4`

**状态轮询**：
- `setInterval` 每 2 秒调用 `pairing:pollStatus(code)`
- `status === 'paired'` → 显示成功，3 秒后 `floatWindow.hide()`
- 面板关闭不清除配对码，下次打开继续有效

---

## 4. 打包配置 (`electron-builder.yml`)

```yaml
appId: com.trixapp.companion
productName: TRIX Companion
copyright: Copyright © 2026 TRIX Team
directories:
  output: C:/Users/wang/Desktop/TRIX Companion 3   # ← 打包输出目录
  buildResources: build
asar: true
compression: maximum                          # ← 最大压缩（v1.3 新增）

files:                                        # ← v1.3 新增文件过滤
  - dist-desktop/main/**/*
  - dist-desktop/preload/**/*
  - dist-desktop/renderer/assets/**/*
  - dist-desktop/renderer/*.html
  - '!**/3d/**'                             # 排除 Three.js 源码
  - '!**/companion-check.html'
  - '!**/env-check.html'
  - '!**/pairing.html'
  - '!**/manifest.json'
  - '!**/sw.js'
  - '!**/videos/**'
  - '!**/dist/**'
  - '!**/node_modules/**'

extraResources:                                # ← v1.3 新增
  - from: ../public/videos
    to: videos
    filter: ['**/*']

win:
  target:
    - target: nsis
      arch: [x64]
    - target: msi
      arch: [x64]
  icon: build/icon.ico
  artifactName: ${productName}-Setup-${version}.${ext}

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: TRIX Companion              # ← v1.3 新增
  include: build/installer.nsh
  language: 2052
  installerSidebar: build/sidebar.bmp        # ← sidebar.bmp（修正）
  uninstallerSidebar: build/sidebar.bmp
  installerHeaderIcon: build/icon.ico
  license: build/eula.txt                   # ← eula.txt（修正）
  uninstallerIcon: build/icon.ico
  runAfterFinish: true                      # ← v1.3 新增

msi:
  oneClick: false

electronDist: ../node_modules/electron/dist  # ← v1.3 新增
electronVersion: 33.4.0
electronDownload:
  mirror: https://npmmirror.com/mirrors/electron/
publish: null
```

**v1.3 构建优化**（`55c8605`）：
- `compression: maximum` — 最大压缩率，减少安装包体积
- 显式 `files` 过滤 — 排除 `3d/`（Three.js 源码 32MB）、`videos/`（由 extraResources 单独打包）
- `shortcutName` 精确指定 — 避免快捷方式名称不一致

---

## 5. 目录结构

```
desktop/
├── electron-builder.yml        # 打包配置（NSIS + MSI，compression: maximum）
├── package.json               # 依赖 + electron ^33.4.0
├── scripts/                    # 打包工具（clean-stale.cjs 等）
├── vite.config.desktop.ts    # Vite 配置（主窗口 + Float 窗口，dev port: 5174）
├── tsconfig.desktop.json      # TS 配置
│
├── build/                     # 打包资源
│   ├── icon.ico              # 应用图标 (256×256)
│   └── sidebar.png            # NSIS 侧边栏（可选）
│
└── src/
    ├── main/
    │   ├── index.ts           # 主进程入口
    │   ├── window-state.ts    # 窗口状态管理 + bot-state:changed 推送
    │   ├── pet-state.ts       # PetStateManager 单例 — 管理 Bot 状态机（IDLE/THINKING/SPEAKING）
    │   ├── tray.ts            # 系统托盘
    │   ├── gateway.ts         # Gateway 子进程（含 Triple-layer Health、Diagnostic Engine、KB、WS RPC）
    │   ├── openclaw.ts        # OpenClaw CLI 封装（ClawHub marketplace、Skill registry）
    │   ├── ipc.ts             # IPC Handler（共 **99 个** ipcMain.handle）
    │   └── float-window.ts    # Float 窗口工厂
    │
    ├── preload/
    │   └── index.js           # contextBridge API（Vite 直接复制，输出到 dist-desktop/preload/index.cjs）
    │
    ├── renderer/
    │   ├── main.tsx           # 主窗口 React 入口
    │   ├── main.html          # 主窗口 HTML Shell
    │   ├── float.html         # Float 窗口 HTML Shell
    │   ├── float.tsx          # Float UI（QR 配对 + 轮询）
    │   ├── components/
    │   │   └── FloatHeroBackground.tsx   # Bot 状态视频（含 BORING 状态）
    │   │
    │   └── stitch/            # ★ stitch 设计系统（2026-03-22 重构）
    │       ├── shared/
    │       │   ├── LuminaLayout.tsx   # ★ 主布局（LuminaLayout）
    │       │   │                         # 路由：chat / study / snapshot / profile / map（浅色）
    │       │   │                         # 路由：dashboard / agents / channels / backups / settings / skills（深色）
    │       │   └── cn.ts                # classMerge 工具（clsx + twMerge）
    │       │
│       ├── lumina/        # Lumina 浅色主题（#f7f9fb 背景）
│       │   ├── tokens.ts    # 颜色 token（primary #630ed4 等）
│       │   ├── components/
│       │   │   ├── TitleBar.tsx      # 36px 标题栏
│       │   │   ├── Sidebar.tsx        # 可折叠 240px 侧边栏
│       │   │   ├── buttons.tsx        # LuminaButton（primary/secondary/ghost/outline）
│       │   │   ├── cards.tsx          # SurfaceCard（low/mid/high 三层级）
│       │   │   └── inputs.tsx        # LuminaInput（底部线条输入框）
│       │   └── pages/
│       │       ├── ChatPage.tsx       # 聊天页（双栏：对话列表 + 聊天窗口）
│       │       ├── StudyPage.tsx       # 学习页
│       │       ├── SnapshotPage.tsx   # 快照页
│       │       ├── ProfilePage.tsx    # 个人资料页
│       │       └── MapPage.tsx        # 地图页
│       │
│       └── noir/           # Monolith Noir 深色主题（#131313 背景）
│           ├── tokens.ts    # 深色 token
│           ├── components/
│           │   ├── DarkCard.tsx       # 玻璃态深色卡片
│           │   ├── DarkButton.tsx     # 深色按钮
│           │   └── DarkTerminal.tsx   # 深色终端面板
│           ├── pages/
│           │   ├── DashboardPage.tsx   # Dashboard（OpenClaw 控制台）
│           │   ├── AgentsPage.tsx     # Agent 管理
│           │   ├── ChannelsPage.tsx    # Channel 配置
│           │   └── BackupsPage.tsx     # 备份管理
│           └── settings/              # 14 个设置子面板
│               ├── SettingsContainer.tsx   # 设置容器 + Tab 导航
│               ├── SettingsOverview.tsx    # 概览
│               ├── SettingsAccount.tsx     # 账户
│               ├── SettingsAgents.tsx      # Agents
│               ├── SettingsBackups.tsx     # 备份
│               ├── SettingsBrowser.tsx     # 浏览器
│               ├── SettingsChannels.tsx    # 渠道
│               ├── SettingsCron.tsx        # 定时任务
│               ├── SettingsGateway.tsx     # Gateway
│               ├── SettingsModels.tsx      # 模型
│               ├── SettingsPairing.tsx     # 配对码
│               ├── SettingsPlugins.tsx     # 插件
│               ├── SettingsSkills.tsx      # Skills
│               └── SettingsSystem.tsx      # 系统
    │
    └── types/
        └── electron.d.ts      # electronAPI TypeScript 声明
```

---

## 6. stitch 设计系统

Desktop 应用使用 **stitch** 双主题设计系统，通过 `LuminaLayout` 统一管理。所有页面路由分为两个主题域：

| 主题 | 背景色 | 页面路由 |
|------|--------|---------|
| **Lumina**（浅色） | `#f7f9fb` | chat / study / snapshot / profile / map |
| **Monolith Noir**（深色） | `#131313` | dashboard / agents / channels / backups / settings / skills |

### 6.1 Lumina 浅色主题

**Token**: `desktop/src/renderer/stitch/lumina/tokens.ts`

| Token | 值 | 用途 |
|-------|----|------|
| `primary` | `#630ed4` | 主色（紫色） |
| `primaryForeground` | `#ffffff` | 主色文字 |
| `background` | `#f7f9fb` | 页面背景 |
| `foreground` | `#1a1a2e` | 正文 |
| `muted` | `#e8eaf0` | 次级背景 |
| `border` | `#d4d7e0` | 边框 |

**组件**：`LuminaButton`（primary/secondary/ghost/outline 四变体）、`SurfaceCard`（low/mid/high 三层级）、`LuminaInput`（底部线条）、`TitleBar`、`Sidebar`（240px 可折叠）

### 6.2 Monolith Noir 深色主题

**Token**: `desktop/src/renderer/stitch/noir/tokens.ts`

| Token | 值 | 用途 |
|-------|----|------|
| `primary` | `#8b5cf6` | 主色（浅紫） |
| `background` | `#131313` | 页面背景 |
| `surface` | `#1e1e1e` | 卡片背景 |
| `border` | `#2d2d2d` | 边框 |

**组件**：`DarkCard`（玻璃态深色卡片）、`DarkButton`、`DarkTerminal`（终端面板，用于 Dashboard/Agents/Channels/Settings/Backups 页面）

### 6.3 共用工具

- `desktop/src/renderer/stitch/shared/cn.ts` — `classMerge()` 工具（整合 `clsx` + `twMerge`）

### 6.4 主题切换

`LuminaLayout` 通过 `useState` 管理 `activeRoute`，`LuminaSidebar` 点击触发 `onNavigate`，页面通过 `React.lazy` + `Suspense` 懒加载。无需 URL 路由，纯内存状态管理。

---

## 7. 关键技术决策

### 7.1 为什么用 `loadFile()` 而非 `loadURL()`？

打包后 `app.getAppPath()` 返回 `.asar` 路径（如 `app.asar/dist-desktop/...`）。Electron 的 `loadURL(file://asar内部路径)` 不支持 asar 内部路径。`loadFile()` 由 Electron 内部处理 asar 路径。

### 7.2 Float 窗口为什么无边框？

Float 窗口是悬浮在右下角的配对工具，需要：
- 固定尺寸（220×320）
- 始终在最顶层（`alwaysOnTop: true`）
- 无需调整大小

无边框窗口的标题栏区域通过 CSS `-webkit-app-region: drag` 实现可拖拽。

### 7.3 为什么用子进程而非直接调用？

Gateway 需要长期运行，且支持插件热加载。子进程模型让 Gateway 独立管理其生命周期，主进程只负责监督和通信。

### 7.4 托盘图标为什么程序生成而非文件加载？

避免打包时丢失资源文件，且无需维护额外的图标资源文件。

---

## 8. 调试

### 8.1 主进程调试

```bash
# 开发模式
cd desktop && pnpm dev

# 查看主进程日志
# 应用内部 console.log 输出到 electron.log
# 路径: C:/Users/<user>/AppData/Roaming/trix-companion-desktop/logs/main.log
```

### 8.2 渲染进程调试

```bash
# Float 窗口 DevTools
# 应用内按 Ctrl+Shift+I 打开 DevTools
# 打包模式加 --remote-debugging-port=9222 用 Playwright CDP 连接
```

### 8.3 Gateway 调试

```bash
# 手动启动 Gateway
openclaw gateway start --port 18789

# 查看 Gateway 日志
openclaw logs --follow
```

### 8.4 常见问题

| 问题 | 检查 |
|------|------|
| Float 窗口按钮无法点击 | 检查 CSS `-webkit-app-region: no-drag` 是否生效 |
| 配对 QR 生成失败 | 检查 Gateway 是否运行：`curl http://127.0.0.1:18789/health` |
| IPC pairing 失败 | 检查 `state.json` 路径是否与 Gateway 一致 |
| 打包后图标空白 | 检查 `build/icon.ico` 是否存在 |
| 打包后白屏 | 检查 `loadFile()` 是否正确（非 `loadURL(file://)`） |

---

**最后更新**: 2026-04-03（IPC 90→99；preload 79 methods）
