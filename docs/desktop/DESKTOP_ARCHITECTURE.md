# Desktop 桌面端架构文档

> **版本**: 1.0
> **最后更新**: 2026-03-19
> **平台**: Windows (Electron 38)

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
│  │  │  (BrowserWin) │  │  (TrayIcon)  │  │  (openclaw gateway)   │ │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘ │   │
│  │                                                                  │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │                    IPC Handlers                            │  │   │
│  │  │  pairing:createQr  ·  pairing:pollStatus  ·  gateway:health │  │   │
│  │  └──────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│                          contextBridge / preload                         │
│                                    │                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Renderer Process                              │   │
│  │  ┌────────────────────┐      ┌────────────────────────────────┐ │   │
│  │  │     Main Window     │      │        Float Window             │ │   │
│  │  │  (透明 WebView)      │      │    (右下角 QR 配对面板)          │ │   │
│  │  │  src/renderer/main.html │  │    src/renderer/float.html       │ │   │
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

**入口**: `src/main/index.ts`

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
  // Utilities
  openExternal: (url: string) => void,
  // Paths
  getResourcesPath: () => string,
}
```

**文件**: `src/preload/index.ts`

### 2.3 渲染进程（Renderer Process）

两个独立的 Web 页面：

| 窗口 | 文件 | 用途 |
|------|------|------|
| 主窗口 | `renderer/main.html` | 加载 Web 应用 URL（WebView） |
| Float 窗口 | `renderer/float.html` + `float.tsx` | 右下角 QR 配对面板 |

---

## 3. 核心模块

### 3.1 窗口管理 (`window-state.ts` + `index.ts`)

```typescript
// 窗口状态持久化
interface WindowState {
  x?: number; y?: number;
  width: number; height: number;
  isMaximized: boolean;
}

// 主窗口配置
const mainWindow = new BrowserWindow({
  width: 420, height: 760,
  frame: true,
  transparent: false,
  webPreferences: { preload: '...' },
});

// Float 窗口配置
const floatWindow = new BrowserWindow({
  width: 300, height: 380,
  frame: false,
  resizable: false,
  alwaysOnTop: true,
  x: screen.getPrimaryDisplay().workAreaSize.width - 320,
  y: screen.getPrimaryDisplay().workAreaSize.height - 400,
  webPreferences: { preload: '...' },
});
```

**关键设计**：
- Float 窗口 `frame: false` → 无标题栏，依赖 CSS `drag` 区域
- 按钮必须设置 `-webkit-app-region: no-drag` 才能点击
- 主窗口关闭时隐藏到托盘，不退出应用

### 3.2 系统托盘 (`tray.ts`)

```typescript
const tray = Tray.createFromPath(iconPath);

// 托盘右键菜单
const contextMenu = Menu.buildFromTemplate([
  { label: '显示主窗口', click: () => mainWindow.show() },
  { label: '显示配对 QR', click: () => floatWindow.show() },
  { type: 'separator' },
  { label: '退出', click: () => { app.exit(0); } },
]);

tray.setContextMenu(contextMenu);
tray.on('click', () => mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show());
```

### 3.3 Gateway 子进程 (`gateway.ts`)

```typescript
// 启动 Gateway
const GATEWAY_PORT = 18789;
const userDataDir = app.getPath('userData');

const gatewayProcess = spawn('openclaw', ['gateway', 'start'], {
  env: {
    ...process.env,
    TRIX_GATEWAY_PORT: String(GATEWAY_PORT),
    TRIX_NATIVE_STORAGE_DIR: userDataDir,  // 统一存储路径
  },
});

// 健康检查：等待 Gateway 就绪
async function waitForGatewayReady(): Promise<void> {
  for (let i = 0; i < 30; i++) {
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
- 退出码非 0 → 自动重启（最多 3 次）
- `TRIX_NATIVE_STORAGE_DIR` 确保 Gateway 和 IPC 读写同一 state.json
- 存储路径：`{userData}/state.json`

### 3.4 OpenClaw 安装 (`openclaw.ts`)

```typescript
// 自动安装 openclaw（pnpm 优先，npm 回退）
async function ensureOpenclawInstalled(): Promise<void> {
  let packageManager = 'pnpm';
  try {
    await execAsync('pnpm --version', { timeout: 5000 });
  } catch {
    try {
      await execAsync('npm --version', { timeout: 5000 });
      packageManager = 'npm';
    } catch {
      throw new Error('未找到 pnpm 或 npm');
    }
  }
  const installCmd = packageManager === 'pnpm'
    ? ['add', '-g', 'openclaw']
    : ['install', '-g', 'openclaw'];
  await execAsync(`${packageManager} ${installCmd.join(' ')}`);
}
```

### 3.5 IPC Handler (`ipc.ts`)

```typescript
// 配对 QR 生成
ipcMain.handle('pairing:createQr', async () => {
  const state = await getNativeChannelState();  // 读取 adminToken
  const res = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/api/pairings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-trix-admin-token': state.adminToken,
    },
    body: JSON.stringify({ label: 'Desktop Float Window' }),
  });
  return res.json();
});

// 配对状态轮询
ipcMain.handle('pairing:pollStatus', async (_, code: string) => {
  const state = await getNativeChannelState();
  const res = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/api/pairings/${code}`, {
    headers: { 'x-trix-admin-token': state.adminToken },
  });
  return res.json();
});
```

### 3.6 Float UI (`float.tsx`)

```
┌────────────────────────────┐
│  ╳  配对 QR              │  ← 标题栏（可拖拽）
├────────────────────────────┤
│                            │
│     ┌──────────────┐       │
│     │              │       │
│     │   [QR Code]  │       │  ← base64 PNG
│     │              │       │
│     └──────────────┘       │
│                            │
│     配对码: JJ3JSW7Z        │  ← 8位大写字母
│                            │
│     ○ pending...           │  ← 轮询状态指示
│                            │
└────────────────────────────┘
```

**状态轮询**：
- `setInterval` 每 2 秒调用 `pollPairingStatus(code)`
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
      arch:
        - x64
  icon: build/icon.ico
  artifactName: ${productName}-${version}-win-${arch}.${ext}

nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
```

---

## 5. 目录结构

```
desktop/
├── electron-builder.yml       # 打包配置
├── package.json              # 依赖 + electron + vite-plugin-electron
├── vite.config.desktop.ts    # Vite 配置（主窗口 + Float 窗口）
├── tsconfig.desktop.json     # TS 配置
│
├── build/                     # 打包资源
│   ├── icon.ico              # Windows 应用图标
│   └── tray.png              # 托盘图标
│
└── src/
    ├── main/
    │   ├── index.ts          # 主进程入口
    │   ├── window-state.ts   # 窗口状态持久化
    │   ├── tray.ts           # 系统托盘
    │   ├── gateway.ts        # Gateway 子进程
    │   ├── openclaw.ts       # openclaw 安装
    │   └── ipc.ts            # IPC Handler
    │
    ├── preload/
    │   └── index.ts          # contextBridge API
    │
    ├── renderer/
    │   ├── main.html         # 主窗口
    │   ├── float.html        # Float 悬浮窗 HTML
    │   └── float.tsx         # Float UI（QR 配对面板 + 轮询）
    │
    └── types/
        └── electron.d.ts     # 共享类型
```

---

## 6. 关键技术决策

### 6.1 为什么用透明窗口做主窗口？

Web 应用内容通过 Vite 开发服务器或静态文件加载，主窗口的透明背景 + WebView 实现与 Web 端完全一致的 UI。避免维护两套代码。

### 6.2 Float 窗口为什么无边框？

Float 窗口是悬浮在右下角的配对工具，需要：
- 固定尺寸（300×380）
- 始终在最顶层（`alwaysOnTop: true`）
- 无需调整大小

无边框窗口的标题栏区域通过 CSS `-webkit-app-region: drag` 实现可拖拽。

### 6.3 为什么用子进程而非直接调用？

Gateway 需要长期运行，且支持插件热加载。子进程模型让 Gateway 独立管理其生命周期，主进程只负责监督和通信。

### 6.4 state.json 路径管理

| 组件 | 路径 | 说明 |
|------|------|------|
| Gateway | `TRIX_NATIVE_STORAGE_DIR/state.json` | 通过 env 传入 |
| IPC Handler | `app.getPath('userData')/state.json` | 直接读取 |

两者指向同一目录，避免路径不一致导致配对失败。

---

## 7. 调试

### 7.1 主进程调试

```bash
# 开发模式
cd desktop && pnpm dev

# 查看主进程日志
# 应用内部 console.log 输出到 electron.log
```

### 7.2 渲染进程调试

```bash
# Float 窗口 DevTools
# 应用内按 Ctrl+Shift+I 打开 DevTools
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

---

**最后更新**: 2026-03-19
