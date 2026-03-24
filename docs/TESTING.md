# TRIX 3D Companion - Testing Guide

## Overview

TRIX 采用三端（Web / Desktop / iOS）统一测试策略，覆盖单元测试、组件测试、集成测试、E2E测试、冒烟测试、可视化回归测试和可访问性测试。

---

## 快速命令

```bash
# Web 端
npm run test:unit          # 单元测试（Vitest）
npm run test:smoke         # 冒烟测试（Node Test Runner）
npm run test:e2e           # E2E 测试（Playwright，3浏览器）
npm run test:all           # 全部测试

# Desktop 端
cd desktop && npx vitest run        # Desktop 单元测试
cd desktop && npx vitest --watch    # Desktop 测试（监听模式）

# iOS 端（需 macOS + Xcode）
cd ios && ./generate_coverage_report.sh  # 运行测试 + 覆盖率报告
```

---

## 一、Web 端测试

### 1.1 单元测试（Vitest）

| 配置 | 值 |
|------|-----|
| 框架 | Vitest + happy-dom |
| 配置 | `vitest.config.ts` |
| 覆盖率 | v8 provider, 80% 目标 |
| 路径 | `src/**/*.test.{ts,tsx}` |

**测试分布：**
- Services: 25+ 个测试文件（chatService, databaseService, pointsService 等）
- Components: 20+ 个测试文件（Modal, Card, Avatar, GlassPanel 等）
- Screens: 10+ 个测试文件（Auth, Chat, Home, Study, Wardrobe 等）
- Hooks: 10+ 个测试文件（useCamera, useNotification, useSpeechToText 等）
- Contexts: AuthContext, ClawbotChannelContext
- Utils: validation, dateFormat, env, errorHandler

### 1.2 集成测试

路径: `tests/integration/`

| 测试 | 覆盖内容 |
|------|---------|
| `auth-channel-integration.test.tsx` | 认证与通道联动 |
| `chat-tts-playback-integration.test.tsx` | 聊天 + TTS + 播放 |
| `database-service-integration.test.ts` | 数据库服务集成 |
| `route-guard-integration.test.tsx` | 路由守卫逻辑 |
| `theme-context-integration.test.tsx` | 主题上下文 |
| `cross-platform-channel-integration.test.tsx` | 跨端通道协议（配对、自习室、重连） |

### 1.3 E2E 测试（Playwright）

| 配置 | 值 |
|------|-----|
| 框架 | Playwright |
| 配置 | `playwright.config.ts` |
| 浏览器 | Chromium, Firefox, WebKit |
| 基础URL | `http://localhost:5173` |
| 超时 | 60s / 操作 30s |

**测试文件：** `src/e2e/`

| 测试 | 覆盖页面 |
|------|---------|
| `auth.spec.ts` | 登录/注册流程 |
| `chat.spec.ts` | 聊天功能 |
| `home.spec.ts` | 首页 |
| `map.spec.ts` | 地图页 |
| `pairing.spec.ts` | 配对流程 |
| `profile.spec.ts` | 个人页 |
| `study-room.spec.ts` | 自习室 |
| `wardrobe.spec.ts` | 衣橱 |
| `qr-pairing.spec.ts` | QR配对 |
| `social.spec.ts` | 社交功能 |
| `snapshot.spec.ts` | 快照功能 |
| `points-mall.spec.ts` | 积分商城 |
| `diagnostic.spec.ts` | 诊断页 |
| `a11y.spec.ts` | 可访问性 |
| `visual-regression.spec.ts` | 可视化回归 |

### 1.4 冒烟测试

路径: `tests/smoke/`

| 测试 | 覆盖内容 |
|------|---------|
| `mvp-smoke.test.mjs` | 路由、部署、配对、地图、快照、输入框、meta标签、环境变量、TRIX Native、主题、聊天AI、语音 |
| `desktop-smoke.test.mjs` | Desktop 主进程入口、IPC、Gateway、Float窗口、Tray、Window-state |
| `desktop-integration-smoke.test.mjs` | Desktop IPC、Gateway生命周期、renderer主题、配置 |

### 1.5 可视化回归测试

路径: `src/e2e/visual-regression.spec.ts`

使用 Playwright 的 `toHaveScreenshot()` API 对比基线截图。覆盖：
- Login, Home, Chat, Study, Map, Profile, Pairing 页面
- 三种视口: Mobile (375x812), Tablet (768x1024), Desktop (1440x900)
- 自动禁用动画、等待网络空闲

```bash
# 首次运行生成基线
npx playwright test src/e2e/visual-regression.spec.ts --update-snapshots

# 后续运行对比
npx playwright test src/e2e/visual-regression.spec.ts
```

---

## 二、Desktop 端测试

### 2.1 配置

| 配置 | 值 |
|------|-----|
| 框架 | Vitest |
| 配置 | `desktop/vitest.config.ts` |
| Main 进程 | Node 环境 |
| Renderer | happy-dom 环境 |

### 2.2 测试分布

**Main 进程测试（4 + 2 新增 = 6 个）：**

| 测试 | 文件 |
|------|------|
| Gateway 生命周期 | `gateway.test.ts` |
| IPC 输入验证 | `ipc.test.ts` |
| OpenClaw 命令 | `openclaw.test.ts` |
| Window-state 管理 | `window-state.test.ts` |
| Float 窗口创建 | `float-window.test.ts` (新) |
| 系统托盘 | `tray.test.ts` (新) |

**Renderer 组件测试（6 个）：**

| 测试 | 主题 |
|------|------|
| `buttons.test.tsx` | Lumina |
| `cards.test.tsx` | Lumina |
| `Sidebar.test.tsx` | Lumina |
| `DarkButton.test.tsx` | Noir |
| `DarkCard.test.tsx` | Noir |
| `cn.test.ts` | 共享工具 |

---

## 三、iOS 端测试

### 3.1 配置

| 配置 | 值 |
|------|-----|
| 框架 | XCTest + XCUITest |
| 覆盖率脚本 | `ios/generate_coverage_report.sh` |
| 目标覆盖率 | 80% |

### 3.2 测试分布

**单元测试（`TRIX3DCompanionTests/`）：**

| 类别 | 文件数 | 示例 |
|------|--------|------|
| Services | 19 | APIClient, Auth, Chat, Database, Keychain, Location, Payment, Points, SpeechRecognition, StoreKit, Study |
| ViewModels | 15 | Payment, Profile, Store, StudyList, Settings, Product, TTS, Voice |
| Smoke | 6 | AuthenticatedBackend, AuthFormPalette, AuthLiveLogin, InputValidator |
| Mock 服务 | 8 | MockCamera, MockPayment, MockLocation, MockStoreKit, MockWebSocket 等 |
| 性能 | 4 | Battery, Launch, Memory, Network |

**E2E 测试（`TRIX3DCompanionE2ETests/`）：**

| 测试 | 覆盖流程 |
|------|---------|
| `UserRegistrationFlowTests` | 用户注册 |
| `PhotoCaptureFlowTests` | 拍照上传 |
| `PurchasePointsFlowTests` | 积分购买 |
| `StudyRoomIntegrationTests` (新) | 自习室创建/加入 |
| `PairingFlowE2ETests` (新) | 配对流程 |
| `ChatFlowIntegrationTests` (新) | 聊天消息 |

**UI 测试（`TRIX3DUITests/`）：**

| 测试 | 覆盖流程 |
|------|---------|
| `AuthenticationFlowTests` | 认证流程 |
| `MainAppFlowTests` | 主应用流程 |
| `ProfileSettingsFlowTests` | 个人设置 |
| `TrixBotNativeFlowTests` | TRIX Bot |
| `VisualPolishFlowTests` | UI 细节 |

### 3.3 覆盖率报告

```bash
cd ios
./generate_coverage_report.sh
```

脚本会：
1. 运行 `xcodebuild test` 启用代码覆盖
2. 生成 HTML 和 JSON 格式报告
3. 显示每个文件的覆盖率
4. 列出低于 80% 目标的文件
5. 自动打开 HTML 报告

---

## 四、测试最佳实践

### 4.1 命名规范

```
# Web/TS
{module}.test.ts           # 单元测试
{module}.spec.ts           # E2E 测试
{feature}-integration.test.tsx  # 集成测试

# iOS/Swift
{Service}Tests.swift       # 单元测试
{Feature}FlowTests.swift   # E2E 测试
Mock{Service}.swift        # Mock 服务
```

### 4.2 Mock 规范

- Web: 使用 `vi.hoisted()` + `vi.mock()` 避免 hoisting 问题
- iOS: 遵循 `{Service}Protocol` + `Mock{Service}` 模式
- Desktop: Electron 使用 mock，不依赖真实 Electron API

### 4.3 覆盖率目标

| 平台 | 目标 |
|------|------|
| Web Services | 80%+ |
| Web Components | 70%+ |
| Desktop Main | 70%+ |
| iOS Services | 80%+ |

### 4.4 CI/CD 集成

```yaml
# 示例 GitHub Actions
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npm ci
    - run: npm run test:all
    - run: npm run test:smoke
```

---

## 五、常见问题

**Q: Study.test.tsx 报 canvas 错误？**
A: `src/test/setup.ts` 已配置 `getContext('2d')` 和 `requestAnimationFrame` mock。

**Q: Desktop 测试报 vi.mock hoisting 错误？**
A: 使用 `vi.hoisted()` 定义 mock 函数，再在 `vi.mock()` 中引用。

**Q: Playwright 找不到浏览器？**
A: 运行 `npx playwright install`。

**Q: iOS 测试覆盖率脚本报错？**
A: 确保在 macOS 上运行，且已安装 Xcode Command Line Tools。
