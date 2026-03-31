# TRIX 3D Companion - 测试指南

> **最后更新**: 2026-03-31
> **测试框架**: Vitest + Node.js Test Runner + Playwright

---

## 测试结构

```
trix-3d-companion/
├── src/
│   ├── utils/                          # 工具函数测试
│   │   ├── dateFormat.test.ts
│   │   ├── env.test.ts
│   │   ├── logger.test.ts
│   │   ├── errorHandler.test.ts
│   │   ├── escapeHtml.test.ts
│   │   ├── pairingToast.test.ts
│   │   └── performance.test.ts
│   ├── services/                       # 服务层测试（24 测试文件）
│   │   ├── chatService.test.ts
│   │   ├── databaseService.test.ts
│   │   ├── StorageService.test.ts
│   │   ├── achievementService.test.ts
│   │   ├── ConnectionManager.test.ts
│   │   ├── friendService.test.ts
│   │   ├── clawbotHistoryService.test.ts
│   │   ├── locationService.test.ts
│   │   ├── mallService.test.ts
│   │   ├── notificationService.test.ts
│   │   ├── OSSService.test.ts
│   │   ├── placeService.test.ts
│   │   ├── pointsService.test.ts
│   │   ├── projectService.test.ts
│   │   ├── scheduleService.test.ts
│   │   ├── serverOssUploadService.test.ts
│   │   ├── sessionService.test.ts
│   │   ├── studyHistoryService.test.ts
│   │   ├── studySessionService.test.ts
│   │   ├── todoService.test.ts
│   │   ├── ttsService.test.ts
│   │   ├── uploadService.test.ts
│   │   ├── userStatsService.test.ts
│   │   ├── voicePlaybackService.test.ts
│   │   └── wardrobeService.test.ts
│   ├── components/                      # 组件测试
│   │   ├── AIActionModal.test.tsx
│   │   ├── AddFriendModal.test.tsx
│   │   ├── Avatar.test.tsx
│   │   ├── DynamicBackground.test.tsx
│   │   ├── FileAttachmentCard.test.tsx
│   │   ├── GlassDock.test.tsx
│   │   ├── GlassPanel.test.tsx
│   │   ├── HeroBackground.test.tsx
│   │   ├── HomeBotBubble.test.tsx
│   │   ├── LoadingSpinner.test.tsx
│   │   ├── MailPanel.test.tsx
│   │   ├── NotificationPanel.test.tsx
│   │   ├── OutfitCard.test.tsx
│   │   ├── OutfitPreview.test.tsx
│   │   ├── StudyRoom.test.tsx
│   │   └── UserSwitcher.test.tsx
│   ├── contexts/                        # Context 测试
│   │   ├── AuthContext.test.tsx
│   │   ├── AuthContext.session.test.tsx
│   │   └── ClawbotChannelContext.test.tsx
│   ├── hooks/                          # Hook 测试
│   │   ├── useAudioPlayer.test.ts
│   │   ├── useBotStateMachine.test.ts
│   │   ├── useCamera.test.ts
│   │   ├── useClawbotMessages.test.ts
│   │   ├── useImmersiveVoice.test.ts
│   │   ├── useNotification.test.ts
│   │   ├── useResourcePreloader.test.ts
│   │   ├── useSpeechToText.test.ts
│   │   ├── useTouchGestures.test.ts
│   │   └── ...
│   ├── lib/                            # 库测试
│   │   └── validation.test.ts
│   └── features/chat/hooks/
│       └── useChatMessages.test.ts
│
├── tests/
│   ├── smoke/
│   │   └── mvp-smoke.test.mjs         # MVP 冒烟测试
│   ├── integration/                   # ★ Vitest 集成测试（NODE 环境）
│   │   ├── auth-channel-integration.test.tsx
│   │   ├── chat-tts-playback-integration.test.tsx
│   │   ├── database-service-integration.test.ts
│   │   ├── route-guard-integration.test.tsx
│   │   └── theme-context-integration.test.tsx
│   └── e2e/                            # Playwright E2E 测试
│       ├── app.test.ts
│       └── all-changes.test.ts
│
└── packages/trix-openclaw-native/test/
    ├── pairing.test.ts                  # 配对服务测试
    ├── server.test.ts                   # 服务器测试
    ├── attachments.test.ts               # 附件测试
    ├── channel-plugin.test.ts            # Channel 插件测试
    └── monitor.test.ts                   # Monitor 测试

### 安装依赖

```bash
npm install
cd packages/trix-openclaw-native && npm install
```

### 运行所有测试

```bash
npm test
```

### 运行前端单元测试

```bash
# 运行一次
npm run test:unit

# 监听模式
npm run test:unit:watch

# 带覆盖率报告
npm run test:unit:coverage
```

### 运行 TRIX Native Server 测试

```bash
cd packages/trix-openclaw-native
npm test
```

### 运行 E2E 测试

```bash
# 运行 E2E 测试
npm run test:e2e

# UI 模式
npm run test:e2e:ui
```

---

## 测试覆盖范围

### 前端单元测试（Vitest）

| 模块 | 文件数 | 覆盖内容 |
|------|--------|---------|
| **工具函数** `src/utils/` | ~7 | dateFormat, env, logger, errorHandler, escapeHtml, pairingToast, performance |
| **服务层** `src/services/` | 31 | chatService, databaseService, StorageService, achievementService, ConnectionManager, friendService, clawbotHistoryService, locationService, mallService, notificationService, OSSService, placeService, pointsService, projectService, scheduleService, serverOssUploadService, sessionService, studyHistoryService, studySessionService, todoService, ttsService, uploadService, userStatsService, voicePlaybackService, wardrobeService, TrixNativeChannelClient (含 session-switch), baiduMapService 等 |
| **组件** `src/components/` | ~37 | AIActionModal, AddFriendModal, Avatar, AchievementsPanel, ConfirmDialog, DynamicBackground, ErrorBoundary, FileAttachmentCard, FilePicker, GlassDock, GlassPanel, HeroBackground, HomeBotBubble, LazyImage, LoadingSpinner, MailPanel, MediaMessage, NotificationPanel, OpenClawControlPanel, OutfitCard, OutfitPreview, PerformanceDashboard, PointsHistory, PrivacySettings, QRScanner, SnapshotModal, StatsDetailDialog, StudyBuddiesList, StudyRoom, UserSwitcher, VirtualizedList, VoiceMessage, VoiceRecorder, WorkbenchCard, WorkbenchModal 等 + chat/, map/, ui/ 子目录 |
| **Contexts** `src/contexts/` | ~3 | AuthContext, AuthContext.session, ClawbotChannelContext |
| **Hooks** `src/hooks/` | 11 (+1 组件) | useAudioPlayer, useBotStateMachine, useCamera, useClawbotMessages, useConfirmModal (组件), useImmersiveVoice, useNotification, useResourcePreloader, useSpeechToText, useTouchGestures, useVoiceRecorder, useWebVitals (11 有测试文件) |
| **Features** `src/features/` | ~1 | chat/useChatMessages |
| **Library** `src/lib/` | ~1 | validation |

### Desktop 单元测试（Vitest）

| 模块 | 文件 | 覆盖内容 |
|------|------|---------|
| **IPC Handlers** | `desktop/src/main/*.test.ts` | ipc.test.ts, gateway.test.ts, openclaw.test.ts, window-state.test.ts |
| **Desktop UI** | `desktop/src/renderer/stitch/**/*.test.tsx` | LuminaLayout, DarkCard, DarkButton 等 |
| **Build Scripts** | `desktop/scripts/clean-stale.cjs` | 打包前清理 stale artifacts（v1.3 新增） |

### TRIX Native Server 测试

| 模块 | 文件 | 覆盖内容 |
|------|------|---------|
| **配对服务** | `pairing.test.ts` | 配对码生成、认领、状态管理 |
| **服务器** | `server.test.ts` | API 端点、健康检查 |
| **附件** | `attachments.test.ts` | 附件存储和检索 |
| **Channel 插件** | `channel-plugin.test.ts` | Channel 插件接口 |
| **Monitor** | `monitor.test.ts` | Monitor 抽象 |

### E2E 测试（Playwright）

| 文件 | 覆盖内容 |
|------|---------|
| `tests/e2e/app.test.ts` | 应用核心流程 |
| `tests/e2e/all-changes.test.ts` | 完整变更测试 |
| `tests/e2e/canvas.spec.ts` | Canvas E2E |
| `tests/smoke/mvp-smoke.test.mjs` | MVP 冒烟测试 |
| `desktop-e2e.cjs` | Desktop E2E（双模式：electron.launch 优先 + 进程+日志+网络 fallback） |

**Playwright 视口**: Desktop Chrome/Firefox/Safari + Mobile Chrome (Pixel 5) + Mobile Safari (iPhone 12)

### 集成测试（Vitest — NODE 环境）

| 文件 | 覆盖内容 |
|------|---------|
| `tests/integration/auth-channel-integration.test.tsx` | AuthContext + ClawbotChannelContext 跨上下文集成 |
| `tests/integration/chat-tts-playback-integration.test.tsx` | Chat → TTS → VoicePlayback 完整管道 |
| `tests/integration/database-service-integration.test.ts` | 数据库 + service 层集成（Supabase 表名/参数验证） |
| `tests/integration/route-guard-integration.test.tsx` | ProtectedRoute + AuthContext 路由守卫集成 |
| `tests/integration/theme-context-integration.test.tsx` | ThemeContext + 组件 CSS 类渲染（Light/Dark/System） |

---

## 测试命令

| 命令 | 描述 |
|------|------|
| `npm test` | 运行单元 + 冒烟 + 服务器测试 |
| `npm run test:unit` | 前端单元测试（含 integration/） |
| `npm run test:unit -- <file>` | 运行单个测试文件 |
| `npm run test:run` | vitest run（全局） |
| `npm run test:unit:watch` | 前端单元测试（监听模式） |
| `npm run test:unit:coverage` | 前端单元测试 + 覆盖率 |
| `npm run test:smoke` | 冒烟测试 |
| `npm run test:server` | TRIX Native Server 测试 |
| `npm run test:e2e` | E2E 测试（Desktop + Mobile 视口） |
| `npm run test:e2e:ui` | E2E 测试（UI 模式） |
| `npm run test:e2e:debug` | E2E 调试模式 |
| `npm run test:e2e -- desktop-e2e.cjs` | Desktop E2E 测试 |
| `npm run test:all` | 运行全部测试 |
| `npm run dev:desktop` | Desktop 开发模式（端口 5174） |
| `npm run build:desktop` | Desktop 生产构建 |
| `npm run build:desktop:pkg` | Desktop 打包（electron-builder） |
| `npm run format` | Prettier 格式化所有文件 |
| `npm run format:check` | 检查文件是否符合 Prettier 格式 |
| `npm run lint` | ESLint 检查 src 目录 |
| `npm run lint:fix` | ESLint 自动修复 |

---

## E2E 测试平台覆盖

Playwright E2E 测试运行在以下浏览器和视口：

| 平台 | 设备/浏览器 | 视口 |
|------|------------|------|
| Desktop | Desktop Chrome | 1280x720 |
| Desktop | Desktop Firefox | 1280-720 |
| Desktop | Desktop Safari | 1280-720 |
| Mobile | Pixel 5 (Android Chrome) | 412x915 |
| Mobile | iPhone 12 (Safari) | 390x844 |

---

## CI/CD 集成

测试在 CI/CD 中自动运行：

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm test

- name: Run E2E
  run: npm run test:e2e
```

---

## 调试技巧

### 查看测试覆盖率

```bash
npm run test:unit:coverage
# 打开 coverage/icov-report/index.html 查看报告
```

### 运行单个测试文件

```bash
npm run test:unit -- src/utils/dateFormat.test.ts
```

### 调试模式

```bash
npm run test:e2e:debug
```
