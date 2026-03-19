# TRIX 3D Companion - Windows 桌面端产品需求文档

> **文档版本**: 1.0
> **最后更新**: 2026-03-19
> **产品**: TRIX 3D Companion Desktop
> **平台**: Windows (Electron)

---

## 1. 产品概述

### 1.1 产品定位

桌面端是 TRIX 3D Companion 的 **Windows 原生客户端**，提供 Web 端无法实现的功能：
- **配对 QR 生成**：电脑端显示 QR，手机扫描配对（TRIX Native Channel）
- **系统托盘常驻**：后台运行，随时访问
- **Gateway 本地托管**：内置 OpenClaw Gateway，无需远程服务器

### 1.2 核心使用场景

| 场景 | 描述 |
|-----|------|
| 配对引导 | 首次使用在桌面端生成 QR，手机扫码配对 |
| 后台运行 | 关闭主窗口后托盘常驻，Gateway 继续运行 |
| 快捷操作 | 托盘菜单快速打开/隐藏主窗口、退出应用 |

### 1.3 技术基础

- **框架**: Electron 38 + Vite 6
- **打包**: electron-builder
- **通信**: IPC（主进程 ↔ 渲染进程）
- **子进程**: OpenClaw Gateway（端口 18789）

---

## 2. 功能清单

### 2.1 窗口管理

| 功能 | 描述 | 优先级 | 状态 |
|------|------|--------|------|
| 主窗口 | 透明背景 + Web 内容，固定大小 | P0 | ✅ |
| Float 悬浮窗 | 右下角固定，显示配对 QR | P0 | ✅ |
| 窗口状态持久化 | 记住主窗口位置和尺寸 | P1 | ✅ |
| 关闭行为 | 关闭主窗口 → 隐藏到托盘，不退出 | P0 | ✅ |

### 2.2 系统托盘

| 功能 | 描述 | 优先级 | 状态 |
|------|------|--------|------|
| 托盘图标 | 应用专属图标（tray.png） | P0 | ✅ |
| 托盘菜单 | 显示/隐藏主窗口、退出应用 | P0 | ✅ |
| 点击托盘图标 | 显示主窗口或 Float 悬浮窗 | P0 | ✅ |
| 托盘 Tooltip | 显示应用名称 | P1 | ✅ |

### 2.3 配对 QR

| 功能 | 描述 | 优先级 | 状态 |
|------|------|--------|------|
| 生成配对 QR | 点击按钮 → 调用 Gateway API → 显示 QR | P0 | ✅ |
| Float 面板 QR | 底部面板显示 base64 PNG QR 码 | P0 | ✅ |
| 配对码显示 | 显示 8 位大写字母数字配对码 | P0 | ✅ |
| 轮询配对状态 | 每 2 秒调用 `GET /api/pairings/:code` | P0 | ✅ |
| 自动关闭面板 | 配对成功 3 秒后自动关闭面板 | P1 | ✅ |
| Admin Token 读取 | 从 `state.json` 读取 admin token | P0 | ✅ |

### 2.4 Gateway 管理

| 功能 | 描述 | 优先级 | 状态 |
|------|------|--------|------|
| 自动启动 Gateway | 应用启动时自动启动 OpenClaw Gateway | P0 | ✅ |
| 健康检查 | 启动后等待 Gateway `/health` 返回 200 | P0 | ✅ |
| 崩溃重启 | Gateway 退出码非 0 → 自动重启 | P1 | ✅ |
| OpenClaw 自动安装 | 无 `openclaw` 命令时自动安装（pnpm → npm 回退） | P0 | ✅ |
| 状态存储路径 | 统一使用 `app.getPath('userData')` | P0 | ✅ |

### 2.5 打包发布

| 功能 | 描述 | 优先级 | 状态 |
|------|------|--------|------|
| Windows x64 打包 | electron-builder 生成 `.exe` | P0 | ✅ |
| NSIS 安装程序 | Windows Installer 安装体验 | P0 | ✅ |
| 应用图标 | 打包包含应用图标 | P1 | ✅ |
| 预加载脚本 | contextBridge 安全隔离 | P0 | ✅ |
| 资源路径处理 | 修复 `process.resourcesPath` TS 类型 | P0 | ✅ |

---

## 3. 核心流程

### 3.1 应用启动流程

```
应用启动
  │
  ├─► [1] 初始化 BrowserWindow（透明背景 WebView）
  │         └─► 加载主窗口 URL
  │
  ├─► [2] 启动 Tray（托盘图标 + 右键菜单）
  │
  ├─► [3] 启动 Gateway 子进程
  │         ├─► 检查 openclaw 是否安装
  │         ├─► 无 → 自动安装（pnpm/npm）
  │         └─► 启动 openclaw gateway start
  │               ├─► 等待 /health 返回 200
  │               └─► 标记 ready
  │
  └─► [4] 注册 IPC Handlers
            ├─► pairing:createQr
            ├─► pairing:pollStatus
            └─► gateway:health
```

### 3.2 配对 QR 流程

```
用户点击「显示配对 QR」
  │
  ├─► IPC: pairing:createQr
  │         ├─► 读取 state.json（adminToken）
  │         └─► POST /api/pairings（返回 { code, secret, qrDataUrl }）
  │
  ├─► Float 面板打开
  │         └─► 显示 base64 PNG QR 码 + 配对码
  │
  ├─► 每 2 秒轮询
  │         └─► IPC: pairing:pollStatus(code)
  │               └─► GET /api/pairings/:code
  │
  └─► status === 'paired'
            ├─► 显示「配对成功」
            └─► 3 秒后关闭面板
```

---

## 4. 技术约束

### 4.1 Electron 特殊处理

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| `process.resourcesPath` TS 错误 | Electron 全局未在标准 TS 中声明 | 使用 `app.getPath('resourcesPath')` |
| `process.cwd()` 不稳定 | macOS GUI 应用 cwd 为 `/` | 使用 `app.getPath('userData')` |
| 按钮无法点击 | `-webkit-app-region: drag` 覆盖按钮区域 | 按钮添加 `-webkit-app-region: no-drag` |
| state.json 路径不一致 | Gateway 和 IPC 用不同路径 | 统一使用 `app.getPath('userData')` + `TRIX_NATIVE_STORAGE_DIR` env |

### 4.2 IPC 通道

| 通道 | 方向 | 用途 |
|------|------|------|
| `pairing:createQr` | renderer → main → HTTP → gateway | 创建配对码，返回 QR |
| `pairing:pollStatus` | renderer → main → HTTP → gateway | 轮询配对状态 |
| `gateway:health` | renderer → main → HTTP → gateway | 检查 Gateway 健康状态 |
| `gateway:openExternal` | renderer → main | 打开外部链接 |

---

## 5. 文件结构

```
desktop/
├── electron-builder.yml       # 打包配置（Windows x64 + NSIS）
├── package.json
├── vite.config.desktop.ts
├── tsconfig.desktop.json
├── src/
│   ├── main/
│   │   ├── index.ts          # 主进程入口（窗口 + Tray + Gateway + IPC）
│   │   ├── window-state.ts   # 窗口状态持久化
│   │   ├── tray.ts           # 系统托盘
│   │   ├── gateway.ts        # OpenClaw Gateway 子进程管理
│   │   ├── openclaw.ts       # openclaw CLI 安装和管理
│   │   └── ipc.ts            # IPC Handler 注册
│   ├── preload/
│   │   └── index.ts          # contextBridge 暴露 API
│   ├── renderer/
│   │   ├── main.html          # 主窗口 HTML
│   │   ├── float.html        # Float 悬浮窗 HTML
│   │   └── float.tsx         # Float UI（QR 配对面板）
│   └── types/
│       └── electron.d.ts     # 共享类型定义
```

---

**最后更新**: 2026-03-19
