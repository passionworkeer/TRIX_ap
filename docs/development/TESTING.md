# TRIX 3D Companion - 测试指南

> **最后更新**: 2026-03-24
> **测试框架**: Vitest + Node.js Test Runner

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
│   └── e2e/                            # Playwright E2E 测试
│       ├── app.test.ts
│       └── all-changes.test.ts
│
└── desktop-e2e.cjs                     # ★ Desktop E2E Runner（v1.3 新增）
│
└── packages/trix-openclaw-native/test/
    ├── pairing.test.ts                  # 配对服务测试
    ├── server.test.ts                   # 服务器测试
    ├── attachments.test.ts               # 附件测试
    ├── channel-plugin.test.ts            # Channel 插件测试
    └── monitor.test.ts                   # Monitor 测试

desktop-e2e.cjs                           # ★ Desktop E2E Runner（v1.3 新增）

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
| **服务层** `src/services/` | ~24 | chatService, databaseService, StorageService, achievementService, ConnectionManager, friendService, clawbotHistoryService, locationService, mallService, notificationService, pointsService, scheduleService, studySessionService, studyHistoryService, ttsService, voicePlaybackService, uploadService, userStatsService, wardrobeService 等 |
| **组件** `src/components/` | ~18 | AIActionModal, AddFriendModal, Avatar, DynamicBackground, FileAttachmentCard, GlassDock, GlassPanel, HeroBackground, HomeBotBubble, LoadingSpinner, MailPanel, NotificationPanel, OutfitCard, OutfitPreview, StudyRoom, UserSwitcher 等 |
| **Contexts** `src/contexts/` | ~2 | AuthContext, ClawbotChannelContext |
| **Hooks** `src/hooks/` | ~10 | useAudioPlayer, useBotStateMachine, useCamera, useClawbotMessages, useImmersiveVoice, useNotification, useResourcePreloader, useSpeechToText, useTouchGestures 等 |
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
| `tests/smoke/mvp-smoke.test.mjs` | MVP 冒烟测试 |
| `desktop-e2e.cjs` | Desktop E2E（8 核心测试：Gateway/Supabase Auth/Float/Settings/Channels 等） |

---

## 测试命令

| 命令 | 描述 |
|------|------|
| `npm run test` | 运行单元 + 冒烟 + 服务器测试（unit / smoke / server） |
| `npm run test:unit` | 前端单元测试 |
| `npm run test:unit:watch` | 前端单元测试（监听模式） |
| `npm run test:unit:coverage` | 前端单元测试 + 覆盖率 |
| `npm run test:smoke` | 冒烟测试 |
| `npm run test:e2e` | E2E 测试 |
| `npm run test:e2e:ui` | E2E 测试（UI 模式） |
| `npm run test:e2e -- desktop-e2e.cjs` | Desktop E2E 测试 |
| `npm run test:all` | 运行全部测试 |

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
