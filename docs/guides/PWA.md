# PWA 安装指南

> 支持 Android / iOS / macOS / Windows 全平台本地安装
> **最后更新**: 2026-04-07

---

## 1. 功能概述

TRIX Web 端已封装为 Progressive Web App（PWA），提供：

| 特性 | 说明 |
|------|------|
| **离线缓存** | Service Worker 缓存 App Shell + 运行时资源 |
| **安装提示** | 自动检测平台，弹出安装引导（Android 直接安装，iOS 引导至主屏幕） |
| **快捷方式** | manifest 中预定义"专注"/"聊天"两个快捷入口 |
| **更新机制** | SW updatefound → skipWaiting → 刷新激活 |

---

## 2. 实现文件

```
src/
├── utils/
│   ├── pwa.ts                  # 平台检测、standalone 模式判断
│   ├── pwaRegistration.ts      # SW 注册 + 自动更新逻辑
│   └── pwa.test.ts             # 单元测试（Vitest）
├── components/
│   └── PwaInstallPrompt.tsx   # 安装提示组件（iOS/Android 通用）
public/
├── sw.js                       # Service Worker（含缓存策略）
└── manifest.json               # Web App Manifest
```

### 2.1 Service Worker 缓存策略

| 资源类型 | 策略 |
|---------|------|
| App Shell（`/`、`/index.html` 等） | 预缓存（install 时） |
| 导航请求（navigate） | 网络优先，失败回退缓存 |
| 静态资源（JS/CSS/图片/字体/manifest） | 缓存优先，网络兜底 |
| 跨域请求 | 不处理（直接放行） |

### 2.2 平台检测逻辑（`pwa.ts`）

```
isStandaloneMode    → navigator.standalone || matchMedia('display-mode: standalone')
isIosDevice         → iPhone/iPad/iPod 或 MacIntel + maxTouchPoints > 1
isSafariBrowser     → Safari UA，排除 CriOS/FxiOS/EdgiOS 等套壳浏览器
shouldShowIosHint   → isIosDevice && isSafariBrowser && !isStandaloneMode
canPromptInstall    → deferredPrompt 存在 && !isStandaloneMode
```

**iOS 安装限制**: Safari 不触发 `beforeinstallprompt` 事件，需手动引导用户"分享 → 添加到主屏幕"。

---

## 3. 安装方式

### 3.1 Android / Chrome（自动）

首次访问时，浏览器地址栏会自动出现安装图标。也可以点击页面底部弹出的"安装 TRIX 应用"提示。

### 3.2 iOS / iPhone / iPad（手动）

1. 使用 **Safari** 打开 `https://trix.love`
2. 点击底部**分享按钮**（方框向上箭头）
3. 选择**"添加到主屏幕"**
4. 确认添加

> 注意：Chrome for iOS、微信内置浏览器等不支持 PWA 安装引导，需使用 Safari。

### 3.3 macOS / Windows

使用 Chrome、Edge 或 Arc 访问，方法同 Android：地址栏安装图标或底部提示。

---

## 4. 已安装检测

已在 `src/components/PwaInstallPrompt.tsx` 中实现：

- 监听 `appinstalled` 事件，安装完成后自动隐藏提示
- 监听 `focus` / `pageshow` 事件，跨 Tab 同步显示状态
- `localStorage` 持久化用户 dismissal 记录

---

## 5. manifest.json 关键字段

| 字段 | 值 | 说明 |
|------|-----|------|
| `display` | `standalone` | 全屏独立窗口 |
| `scope` | `/` | 作用域 |
| `start_url` | `/#/` | HashRouter 启动路径 |
| `shortcuts` | 专注、聊天 | 主屏幕快捷入口 |
| `icons` | 192px + 512px + 180px（apple-touch-icon） | 多分辨率图标 |

---

## 6. 开发注意事项

### 开发环境（`npm run dev`）

Service Worker **不注册**（`import.meta.env.DEV` 跳过），避免开发时缓存干扰。

### 离线测试

```bash
# 启动开发服务器
npm run dev

# 在 Chrome DevTools → Application → Service Workers
# 勾选 "Offline"，刷新页面验证离线 fallback
```

### 图标要求

| 文件名 | 尺寸 | 用途 |
|--------|------|------|
| `icon-192.png` | 192×192 | 小屏设备 |
| `icon-512.png` | 512×512 | 大屏设备 + 安装时预览 |
| `apple-touch-icon.png` | 180×180 | iOS 主屏幕图标 |

---

## 7. 相关文档

- [WEB_ARCHITECTURE.md](../architecture/WEB_ARCHITECTURE.md) — Web 整体架构
- [guides/DEPLOYMENT.md](./DEPLOYMENT.md) — 生产部署（含 nginx 配置）

---

**最后更新**: 2026-04-07
