# Desktop 桌面端架构文档

> **版本**: 1.1
> **最后更新**: 2026-03-21
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
│  │  │                    IPC Handlers (22 handlers)            │  │   │
│  │  │  pairing:createQr · gateway:status · openclaw:*         │  │   │
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

**暴露 API**:
```typescript
window.electronAPI = {
  // Gateway
  checkGatewayHealth: () => Promise<boolean>,
  // Pairing
  createPairingQr: () => Promise<PairingQrData>,
  pollPairingStatus: (code: string) => Promise<PairingStatus>,
  // OpenClaw
  checkOpenclaw: () => Promise<OpenClawStatus>,
  installOpenclaw: () => Promise<void>,
  runCommand: (cmd: string, args?: string[]) => Promise<string>,
  // Video resources
  getVideoBaseUrl: () => string,
  getVideoUrl: (filename: string) => string,
  // Utilities
  openExternal: (url: string) => void,
  getResourcesPath: () => string,
}
```

**文件**: `desktop/src/preload/index.js`

### 2.3 渲染进程（Renderer Process）

两个独立的 React 应用：

| 窗口 | 入口 | 用途 |
|------|------|------|
| 主窗口 | `renderer/main.tsx` + `main.html` | 加载 Web 应用 URL（`loadFile()`） |
| Float 窗口 | `renderer/float.tsx` + `float.html` | 右下角 QR 配对面板 |

> **注意**：主窗口使用 `loadFile()` 而非 `loadURL()`，解决 asar 打包兼容问题。

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
- 退出码非 0 → 仅记录错误（**不自动重启**，最多 3 次自动重启**未实现**）
- `TRIX_NATIVE_STORAGE_DIR` 确保 Gateway 和 IPC 读写同一 `state.json`
- Windows 特殊处理：使用 `netstat` + `taskkill` 杀死进程

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

```typescript
// 全部 22 个 handler + 2 个事件

// Window Management
'window:show-main'       → 显示主窗口
'window:hide-main'      → 隐藏主窗口
'window:minimize-to-tray' → 最小化到托盘

// Bot State
'bot-state:push'         → 推送 Bot 状态（Renderer → Main）
'bot-state:changed'       → 状态变更通知（Main → Float window）

// OpenClaw
'openclaw:check'         → 检查安装状态
'openclaw:install'       → 安装 OpenClaw
'openclaw:install-progress' → 安装进度事件（Main → Renderer）
'openclaw:status'        → 运行 openclaw status 命令 ← 新增
'openclaw:doctor'        → 健康检查
'openclaw:run-command'   → 执行白名单命令
'openclaw:agents-list'  → 列出 Agents
'openclaw:skills-list'  → 列出 Skills
'openclaw:skills-install' → 安装 Skill
'openclaw:skills-uninstall' → 卸载 Skill
'openclaw:backup-list'  → 列出 Backups
'openclaw:backup-restore' → 恢复 Backup
'openclaw:pairing-create' → 创建配对码

// Native Channel Pairing
'pairing:createQr'       → 生成 QR 码
'pairing:pollStatus'     → 轮询配对状态

// Gateway
'gateway:status'         → 获取 Gateway 状态
'gateway:restart'        → 重启 Gateway

// App
'app:info'               → 获取 App 信息
```

**OpenClaw 命令白名单**（`ipc.ts`）：
```typescript
const ALLOWED_COMMANDS = [
  { cmd: 'status', args: undefined },
  { cmd: 'doctor', args: undefined },
  { cmd: 'agents', args: ['list'] },
  { cmd: 'skills', args: ['list'] },
  { cmd: 'pairing', args: ['create'] },
  { cmd: 'backup', args: ['list'] },
];
```
> ⚠️ `backup restore` **未在代码中实现**，不包含在白名单内。

### 3.6 Float UI (`float.tsx`)

```
┌────────────────────────────┐
│  [×]  配对 QR              │  ← 标题栏（可拖拽）
├────────────────────────────┤
│  ┌──────────────────────┐ │
│  │                      │ │
│  │      [QR Code]      │ │  ← base64 PNG
│  │                      │ │
│  └──────────────────────┘ │
│                            │
│  配对码: JJ3JSW7Z         │  ← 8位大写字母
│  ○ pending...              │  ← 轮询状态指示
└────────────────────────────┘
```

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
appId: com.trixapp.desktop
productName: TRIX Desktop
copyright: Copyright © 2026 TRIX Team

win:
  target:
    - target: nsis
      arch: [x64]
    - target: msi
      arch: [x64]
  icon: build/icon.ico
  artifactName: ${productName}-${version}-win-${arch}.${ext}

nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  language: 2052                    # 中文 NSIS ← 新增
  installerSidebar: build/sidebar.png  # 侧边栏 ← 新增
  uninstallerSidebar: build/sidebar.png
  installerHeaderBitmap: build/header.png
  include: build/installer.nsh
  license: build/EULA.txt           # EULA ← 新增
  installerIcon: build/icon.ico
  uninstallerIcon: build/icon.ico

# MSI 配置 ← 新增
msi:
  language: 2052

# Electron mirror
electronDownload:
  mirror: https://npmmirror.com/mirrors/electron/
```

---

## 5. 目录结构

```
desktop/
├── electron-builder.yml        # 打包配置（NSIS + MSI，中文）
├── package.json               # 依赖 + electron 33.4.0
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
    │   ├── window-state.ts    # 窗口状态管理
    │   ├── tray.ts            # 系统托盘
    │   ├── gateway.ts         # Gateway 子进程
    │   ├── openclaw.ts        # OpenClaw CLI 封装
    │   ├── ipc.ts             # IPC Handler（22 handlers + 2 events）
    │   └── float-window.ts    # Float 窗口工厂
    │
    ├── preload/
    │   └── index.js           # contextBridge API（编译后 JS）
    │
    ├── renderer/
    │   ├── main.tsx           # 主窗口 React 入口
    │   ├── main.html          # 主窗口 HTML Shell
    │   ├── float.html         # Float 窗口 HTML Shell
    │   ├── float.tsx          # Float UI（QR 配对 + 轮询）
    │   │
    │   ├── components/
    │   │   ├── DesktopLayout.tsx       # 主布局
    │   │   ├── DesktopTitleBar.tsx      # 自定义标题栏
    │   │   ├── DesktopSidebar.tsx       # 可折叠侧边栏
    │   │   ├── FloatHeroBackground.tsx   # Bot 状态视频（含 BORING 状态）
    │   │   ├── RenderErrorBoundary.tsx   # React 渲染错误边界 ← 新增
    │   │   │
    │   │   ├── OpenClawDashboard.tsx     # Gateway 控制台
    │   │   ├── OpenClawAgents.tsx        # Agent 管理
    │   │   ├── OpenClawChannels.tsx      # Channel 配置
    │   │   └── DesktopSettings.tsx        # 设置页面（6 Tabs）
    │   │
    │   └── pages/             # 页面组件（由 DesktopLayout 渲染）
    │
    └── types/
        └── electron.d.ts      # electronAPI TypeScript 声明
```

---

## 6. 关键技术决策

### 6.1 为什么用 `loadFile()` 而非 `loadURL()`？

打包后 `app.getAppPath()` 返回 `.asar` 路径（如 `app.asar/dist-desktop/...`）。Electron 的 `loadURL(file://asar内部路径)` 不支持 asar 内部路径。`loadFile()` 由 Electron 内部处理 asar 路径。

### 6.2 Float 窗口为什么无边框？

Float 窗口是悬浮在右下角的配对工具，需要：
- 固定尺寸（220×320）
- 始终在最顶层（`alwaysOnTop: true`）
- 无需调整大小

无边框窗口的标题栏区域通过 CSS `-webkit-app-region: drag` 实现可拖拽。

### 6.3 为什么用子进程而非直接调用？

Gateway 需要长期运行，且支持插件热加载。子进程模型让 Gateway 独立管理其生命周期，主进程只负责监督和通信。

### 6.4 托盘图标为什么程序生成而非文件加载？

避免打包时丢失资源文件，且无需维护额外的图标资源文件。

---

## 7. 调试

### 7.1 主进程调试

```bash
# 开发模式
cd desktop && pnpm dev

# 查看主进程日志
# 应用内部 console.log 输出到 electron.log
# 路径: C:/Users/<user>/AppData/Roaming/trix-companion-desktop/logs/main.log
```

### 7.2 渲染进程调试

```bash
# Float 窗口 DevTools
# 应用内按 Ctrl+Shift+I 打开 DevTools
# 打包模式加 --remote-debugging-port=9222 用 Playwright CDP 连接
```

### 7.3 Gateway 调试

```bash
# 手动启动 Gateway
openclaw gateway start --port 18789

# 查看 Gateway 日志
openclaw logs --follow
```

### 7.4 常见问题

| 问题 | 检查 |
|------|------|
| Float 窗口按钮无法点击 | 检查 CSS `-webkit-app-region: no-drag` 是否生效 |
| 配对 QR 生成失败 | 检查 Gateway 是否运行：`curl http://127.0.0.1:18789/health` |
| IPC pairing 失败 | 检查 `state.json` 路径是否与 Gateway 一致 |
| 打包后图标空白 | 检查 `build/icon.ico` 是否存在 |
| 打包后白屏 | 检查 `loadFile()` 是否正确（非 `loadURL(file://)`） |

---

**最后更新**: 2026-03-21
