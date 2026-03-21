# TRIX 3D Companion 开发迭代日志

> 记录项目演进历程，帮助理解架构决策和技术选型

---

## 📅 2026-03-21 - 全面文档与代码对齐更新

### 背景

使用 5 个并行 Agent 全面调研源码（Desktop/Web/iOS/DB/API），发现并修正大量文档与实际代码的差异。

### 完成内容

1. **TRIX_NATIVE_CHANNEL.md（全面重写）**：
   - 新增 Study Room API + WebSocket 事件文档
   - 新增 TTS (Edge TTS) 端点文档
   - 新增 Session Management (bind/restore) 文档
   - 新增 Rate Limiting 文档（可配置限制）
   - 新增 WebSocket 三角色（user/service/agent）文档
   - 新增完整消息信封格式（用户端 + 服务端）
   - 修正配对码 TTL：文档 5-30 分钟 → 实际 **1 小时**
   - 修正 clientToken 传递：文档 header → 实际 **JSON body**
   - 更新架构图添加 Study Room + TTS 层
   - 添加完整 API 端点一览表

2. **desktop/DESKTOP_ARCHITECTURE.md**：
   - Electron 版本：38 → **33.4.0**
   - 目录结构：`packages/desktop/` → `desktop/`
   - Vite Dev Server 端口：5173 → **5174**
   - 新增 IPC 通道：`openclaw:status`、`openclaw:install-progress`
   - 修正 OpenClaw 命令白名单（移除代码中不存在的 `backup restore`）
   - 修正托盘图标：文件加载 → **程序生成**
   - 修正视频路径：`videos/{state}.mp4` → `videos/role1/{state}.mp4`
   - 新增 BORING 状态文档
   - 新增 electron-builder 中文 NSIS + MSI + 侧边栏特性
   - 新增 RenderErrorBoundary 错误边界文档
   - 修正 Gateway 自动重启：**未实现**

3. **requirements/DESKTOP_PRD.md**：
   - Electron 版本：38 → **33.4.0**
   - React 版本：19 → **19.2**
   - 新增 `openclaw:status`、`openclaw:install-progress` IPC 通道
   - Bot 状态：三种 → **四种**（新增 BORING）
   - 视频路径修正
   - Float 窗口定位：显式 x/y → **默认居中**
   - 白名单移除 `backup restore`
   - Vite Dev Port 5173 → **5174**

4. **architecture/WEB_ARCHITECTURE.md（全面重写）**：
   - 补充完整技术栈：React **19.2.4** + TypeScript **5.8.2** + Vite **6.2.0** + Tailwind CSS **4.2.0**
   - 全部 **19 条路由**（HashRouter）
   - 全部 **27 个服务文件**
   - 4 个 Context + Zustand（仅 three/）
   - 移除不存在的 `useClawbotMessages` hook
   - 新增 TrixNativeChannelClient 详细功能说明
   - 新增 Tailwind CSS 4 配置和自定义工具类
   - 新增环境变量完整列表

5. **ios/IOS_ARCHITECTURE.md**：
   - 新增完整项目结构（328 Swift 文件）
   - iOS 部署目标：18.0
   - Swift 5.9
   - 使用 **XcodeGen project.yml**（非命令行）
   - Podfile 为空，**仅使用 Swift Package Manager**
   - 14 个 SPM 依赖包完整列表
   - "ClawbotChannel" = iOS 命名别名（TRIX Native Channel）
   - 三语言支持：en, zh-Hans, zh-Hant
   - MVVM + Protocol + 单例架构

6. **database/DATABASE_SCHEMA.md**：
   - 添加未文档化视图：`user_points_overview`、`friend_latest_messages`
   - ⚠️ 表名修正：`point_transactions`（单数，非复数）
   - ⚠️ `mallService.ts` 使用 `points_transactions`（复数）为代码 Bug
   - ⚠️ `locationService.ts` 使用 `friendships` 为代码 Bug

7. **guides/SERVER_GUIDE.md**：
   - 修正 MySQL → **PostgreSQL (Supabase)**
   - 更新数据库操作方式（Supabase Dashboard 而非 SSH）
   - 更新故障排查（Supabase 状态检查）

8. **INDEX.md**：
   - 新增 `requirements/DESKTOP_PRD.md` 引用
   - 更新文档统计

9. **发现的代码 Bug**（已修复）：
   - `src/services/mallService.ts`：`points_transactions` → `point_transactions`（单数）
   - `src/services/locationService.ts`：`friendships` → `friends`（表名修正）+ 外键引用更新

10. **其余文档更新**：
    - `getting-started/SETUP.md`：全面重写（修正项目结构、技术栈版本、端口、iOS 路径）
    - `getting-started/QUICK_START_GUIDE.md`：移除过时 CLI 命令，改为文档参考
    - `api/API_DOCUMENTATION.md`：精简 TRIX Native Server API 章节，指向权威文档
    - `api/API_TYPES.md`：版本更新
    - `ui/COMPONENTS.md`：版本更新

---

## 📅 2026-03-20 - 文档与实际代码对齐修正

### 背景

根据实际代码全面核对 docs/ 目录文档，发现多处文档与最新代码存在不一致。

### 完成内容

1. **PROJECT.md**：
   - Contexts: 6个 → 4个（移除不存在的 `GatewayContext`、`QRCodePairingContext`）
   - Screens: 12个 → 17个（补全 `SnapMapScreen`、`Wardrobe`、`PointsMall`、`DiagnosticAdvanced` 等）
   - Features: 补全 `location/`、`schedule/`、`todo/` 三个目录
   - Services: 移除废弃的 `GatewayClient`、`GatewayRPC`、`RelayClient`、`ClawbotChannelBridge`；补全 `ConnectionManager`、`TrixNativeChannelClient`
   - Hooks: 更新为 11 个实际存在的 hooks（移除 `useSpeechRecognition`，补全 `useVoiceRecorder`、`useWebVitals`）
   - Packages: 移除不存在的 `trix-relay-client`
   - 修正文档路径引用（database/docs/SCHEMA.md → database/DATABASE_SCHEMA.md；api/new_clawbot_api.md → api/API_DOCUMENTATION.md）
   - 统计数字更新（TS 服务 40个，Hooks 11个，TSX 组件 60+，TSX 页面 17个）

2. **DATABASE_SCHEMA.md**：
   - 移除重复的 `point_transactions` 表（统一为 `points_transactions`）

3. **SERVER_GUIDE.md**：
   - Clawbot Channel 端口 8765 标记为已废弃（改用 TRIX Native Server :8788）

4. **TESTING.md**：
   - 移除不存在的 `useSpeechRecognition.test.ts`、`clawbotChannelBridge.test.ts`
   - 更新测试文件数量（服务 30+ → 24 个实际文件，Hooks 11 → 10）

5. **TDD-EXAMPLES.md**：
   - 更新示例代码为实际存在的 `chatService`（替代已删除的 `pairingService`）

6. **SETUP.md**：
   - 修正 Xcode 26+ → Xcode 16+
   - 补充 Web 端连接说明

7. **PRD.md**：
   - WebSocket socket.io-client → 原生 WebSocket（TrixNativeChannelClient）
   - iOS 网络栈 Alamofire + Starscream → URLSession + Supabase Swift
   - iOS 项目构建工具补充 XcodeGen (project.yml) + CocoaPods (Podfile)
   - iOS 文件数 80+ → 988 Swift 文件
   - Zustand 状态管理标注为仅 3D 场景使用

8. **IOS_TEST_DEPLOY_GUIDE.md**：
   - 移除不适用于本项目的 Ionic/Capacitor 构建流程

9. **API_DOCUMENTATION.md**：
   - 修正 `place_favorites` → `user_favorite_places`

---

## 📅 2026-03-19 - 三端配对系统对齐

### 背景

Web、iOS、Windows 桌面三端的配对实现原本使用不同协议，导致行为不一致。本次对齐以 `trix-openclaw-native` 为单一事实来源，统一使用 **QR URL 格式**配对。

### 完成内容

#### 1. Web 端：清理废弃代码

- 删除 `src/services/clawbotPairingService.ts`（旧 Supabase 轮询协议）
- 删除 `src/services/clawbotPairingService.test.ts`
- 将 `src/contexts/QRCodePairingContext.tsx` 替换为空壳（避免破坏已有 import）
- 从 `src/clawbot/index.ts` 移除废弃导出
- 从 `src/App.tsx` 移除 `QRCodePairingProvider` 包装

#### 2. iOS 端：配对流程修复

- 修复 `QRScannerView.handleScanResult()`：原只接受 JSON 格式 QR，增加对 URL 格式的支持（`http://host/pair?code=XXX&secret=YYY`）
- 修复 `ClawbotChannelViewModel.pairWithToken()`：调用的 `service.pairWithToken()` 方法不存在，改为调用正确的 `service.pairWithQR()`（该方法已能正确解析 URL 格式）
- 确认 `ClawbotChannelService.parseQRData()` 已支持 URL 格式解析（case 1）

#### 3. Windows 桌面端：Float 窗口 QR 配对

- 添加 `pairing:createQr` IPC handler（读取 admin token → 调用 `POST /api/pairings`）
- 添加 `pairing:pollStatus` IPC handler（读取 admin token → 调用 `GET /api/pairings/:code`）
- 重写 `src/renderer/float.tsx`：完整 QR 配对 UI（底部面板、轮询状态、自动关闭）
- 创建 `src/types/electron.d.ts`：共享 TypeScript 类型定义

#### 4. Desktop 打包问题修复

- **P0**: `process.resourcesPath!` → `app.getPath('resourcesPath')`（修复 TS 类型错误）
- **P0**: IPC pairing 读取 state.json 从 `process.cwd()` 改为 `app.getPath('userData')`（Gateway 也使用相同目录）
- **P0**: OpenClaw 安装增加 pnpm 检查，不存在则回退 npm
- **P1**: Float 窗口 `-webkit-app-region: drag` 覆盖按钮，改为 CSS 覆盖 `no-drag`
- **P1**: 移除 `tray.ts` 中的死代码 `getTrayIconPath()`

### 配对 QR 格式（统一）

```
http://host/pair?code=ABCDEF12&secret=random-secret-token
```

三端均支持此格式：Web (TrixNativeChannelClient)、iOS (ClawbotChannelService)、Desktop (float.tsx IPC)

### Git 提交记录

- `web: delete clawbotPairingService, stub QRCodePairingContext`
- `ios: fix QRScanner URL-format QR support + pairWithToken method`
- `desktop: add pairing IPC handlers + rewrite float.tsx`
- `desktop: fix resourcesPath TS types + IPC state.json path + pnpm check + drag region`

---

## 📅 2026-03-19 (下午) - 文档精简

### 背景

docs/ 目录有 55 个文档，大量重复内容。进行精简合并。

### 完成内容

1. **配对文档**：4 份 → 1 份
   - 删除 `TRIX_NATIVE_PAIRING_ARCHITECTURE.md`
   - 删除 `OPENCLAW_PAIRING_IMPLEMENTATION.md`
   - 删除 `openclaw_reference.md`
   - 重写 `TRIX_NATIVE_CHANNEL.md` 为唯一权威文档

2. **用户指南**：3 份 → 1 份
   - 删除 `QR_PAIRING_USER_GUIDE.md`
   - 删除 `PAIRING_INPUT_GUIDE.md`
   - 删除 `UNPAIR_FEATURE_GUIDE.md`
   - 新建 `guides/PAIRING.md`

3. **归档历史文档**：7 份 → 移入 `docs/.archive/`
   - AUDIT-REPORT.md、CODE_REVIEW_REPORT.md、FIXES_20260313.md、PROJECT_ANALYSIS.md、PROJECT_DOCUMENTATION.md、PROJECT_ISSUES.md、DATABASE_MIGRATION_GUIDE.md
   - 其中 7 个已删除，仅保留 `DATABASE_MIGRATION_GUIDE.md`（SQL 迁移参考）

4. **删除过期规划**：plans/ 整个目录删除

5. **清理 requirements/**：删除 `TRIX_NATIVE_IMPLEMENTATION_PLAN.md`（已完成）

6. **更新索引**：更新 `INDEX.md` 反映最新结构

### 结果

从 55 个文档 → 33 个活跃文档（减少 40%）


## 📅 2026-03-19 (晚间) - 文档全面核对修复

### 背景

根据实际代码核对所有文档，发现多个文档与代码不同步。

### 完成内容

1. **WEB_ARCHITECTURE.md**：补全 8 个未列出的服务文件（GatewayClient、RelayClient、GatewayRPC、sessionService、studyHistoryService、serverOssUploadService、projectService、clawbotHistoryService），添加 GatewayContext，更新外部服务架构图（Clawbot Channel → Gateway），更新最后日期

2. **BACKEND_ARCHITECTURE.md**：修正目录结构（删除不存在的 server/routes/、server/websocket/，添加 utils/、probe.ts 等），修正 WebSocket 端点格式，更新 API 端点表格（标注 Supabase vs 独立服务器），修正 .js → .ts 扩展名，更新最后日期

3. **TESTING.md**：重写测试结构树（实际有 ~50+ 测试文件，远超文档列出的 5 个），补全所有服务/组件/hooks/lib 测试文件，添加 Playwright E2E 测试，更新测试覆盖范围表格，更新最后日期

4. **IOS_ARCHITECTURE.md**：重写 Services 层（实际 ~60+ 服务，文档列出不足 30），补全 Network 层缺失文件（JSONDateDecoding、NetworkLogger、NetworkRequestCache、GatewayProtocol、SecurityHeadersValidator），修正 Storage 层，移除不存在的 AnalyticsService，补全 Protocol 模式说明，更新最后日期

5. **PRD-WEB.md / PRD-IOS.md**：更新最后日期至 2026-03-19

6. **INDEX.md**：添加 PRD-DESKTOP.md 和 DESKTOP_ARCHITECTURE.md，总计 35 个活跃文档

---

## 📅 2026-03-19 (深夜) - 新增 CLAUDE.md / 重写 README.md / 修复 PROJECT.md

### 背景

项目文档自查，发现根目录缺少 Claude Code 项目指令文件，README.md 存在大量废弃链接和过时内容，PROJECT.md 结构与实际代码严重不同步。

### 完成内容

1. **新增 `CLAUDE.md`**（根目录）：Claude Code 项目级指令文件，包含提交规范、代码审查要求（CRITICAL/HIGH/MEDIUM/LOW）、架构约束（Electron 路径处理、OpenClaw Plugin 规则、TRIX Native Channel 规范）、测试命令与覆盖率目标、文档维护规范、Git 工作流。

2. **重写 `README.md`**（根目录）：移除所有已删除文档的链接，更新项目结构为实际目录，更新技术栈为最新版本（React 19.2.4、TypeScript 5.8.2、Vite 6.2.0），更新三端架构图，更新测试命令，补全核心功能列表。

3. **修复 `PROJECT.md`**（docs/project-reports/）：补全 6 个过时章节（Contexts、Services 12→30+、Hooks 6→11+、Packages、Database、Tests 添加 e2e/、Docs 添加 .archive/）。

4. **删除 `docs/development/ARCHITECTURE.md`**：该文件与 `architecture/WEB_ARCHITECTURE.md` 内容重复，且包含过时信息（旧 Clawbot Channel Server 8765、旧配对协议、Tailwind CDN 模式等，最后更新 2026-02-21）。同步更新 INDEX.md 和 CHANGELOG。

---

## 📅 2026-03-18 - TRIX Native Channel `running` 状态修复

### 背景
通道显示 `enabled, configured` 但不显示 `running`，而 Feishu 通道则正常显示 `running`。

### 根本原因
OpenClaw Gateway 通过 `channels.status` 命令展示通道状态时：
1. 调用 `buildAccountSnapshot({ account, runtime, probe })` 获取账户快照
2. 如果插件没有 `buildAccountSnapshot`，则回退到只读取 `account.configured`
3. `runtime.running` 来自 Gateway 的 `setRuntime` 调用
4. **没有 `buildAccountSnapshot`，Gateway 永远看不到 `runtime.running`**

### 修复内容

#### 1. 添加 `buildAccountSnapshot`（`plugin/plugin.ts`）

返回包含 `runtime.running` 的完整账户快照：

```typescript
status: {
  buildAccountSnapshot: ({ account, runtime, probe }) => ({
    accountId: account.accountId,
    enabled: account.enabled !== false,
    configured: Boolean(account.serverUrl),
    running: runtime?.running ?? false,
    probeResult: probe ?? undefined,
  }),
  probeAccount: async ({ account }) => {
    // HTTP 健康检查：GET /api/pairings
    // 使 channels status 能看到 probe 结果
  },
},
```

#### 2. 修复 `startAccount` 简化模式

移除手动状态管理，返回 monitor promise 而非手动管理状态。

### Git 提交记录
- `9590d5c`: fix: TRIX Native plugin — add buildAccountSnapshot + probeAccount for running status

### 验证结果
```
- TRIX Native default (TRIX Native): enabled, configured, running, disconnected
```
（`disconnected` 是因为本机无法访问远程 TRIX 服务器的 probe 结果，不是代码问题）

---

## 📅 2026-03-17 - 数据库架构整理

### 背景
项目数据库文档与实际 Supabase 生产状态不一致，需要整理和同步。

### 完成内容
1. **数据库表状态核实**
   - 确认 Supabase 生产数据库实际有 21 个表
   - 核实 4 个可选位置服务表（places, user_favorite_places, user_locations, user_location_settings）

2. **文档整理**
   - 更新 `database/schema-complete.sql` - 21 表版本
   - 更新 `database/README.md` - 正确的表状态说明
   - 删除过时的 SQL 迁移文件

### 文档产出
- `database/schema-complete.sql` - 完整 21 表初始化脚本
- `database/README.md` - 简化的数据库文档

---

## 📅 2026-03-16 - TRIX Native Channel 修复

### 背景
TRIX Native Channel 配置后通道显示 "not configured, disabled"。

### 完成内容

#### 1. 配置 key 修复
- 修改 `packages/trix-openclaw-native/src/plugin/accounts.ts`
- 将 `channels?.trixNative` 改为 `channels?.['trix-native']`
- 支持两种配置传递方式

#### 2. 配对码有效期修复
- 增加配对码有效期从 5 分钟到 30 分钟
- 修复 claim API 返回 400 错误

#### 3. 数据库修复
- 删除损坏的 SQLite 数据库
- 修复消息字段映射 (direction/from)

### Git 提交记录
- 54601b9: fix: TRIX Native channel config reading - use hyphenated key
- 28c360b: chore: cleanup build artifacts and refine inbound reconnect
- 8386989: test: update smoke tests for TRIX Native Channel

### 验证结果
```
- TRIX Native default (TRIX Native): configured, enabled
```

---

## 📅 2026-03-14 - TRIX Native Channel 实现（OpenClaw 集成）

### 背景
需要在 iOS 应用中实现与 Web 前端的双向通信，支持消息同步、文件传输等功能。通过 OpenClaw 平台实现 Native Channel。

### 完成内容

#### 1. TRIX Native Server 开发
- 创建 `trix-native-server` 服务（端口 8788）
- 实现配对码生成和管理（6 位字母数字）
- 支持消息接收和转发
- SQLite 本地持久化

#### 2. OpenClaw 插件开发
- 创建 `trix-native-plugin` 包
- 实现结构化配置（对象格式优于云端字符串）
- 支持 inbound 消息接收和 outbound 消息发送
- 推送到 GitHub 远程仓库

#### 3. iOS 端集成
- 实现 `TrixNativeChannelClient`
- 配对码配对流程
- 消息发送/接收处理
- 中文编码修复（ISO 字符串时间戳转换）

#### 4. 前端集成
- 创建 `TrixNativeChannelService`
- 配对码显示（QRCode）
- 消息同步处理

### Git 提交记录
- 5f80f1b: feat: auto-configure serverUrl in setup.ts with hardcoded default
- 361ca29: refactor: update plugin to match official OpenClaw channel API
- 4167a36: feat: implement SQLite persistence and outbound sendText/sendMedia
- 38ad72e: refactor: update TRIX Native plugin to match OpenClaw channel API
- 54ad7c8: fix: convert ISO string timestamp to number for correct message sorting

### 服务器配置
- TRIX Native Server: http://TRIX_SERVER_HOST:8788
- 配对码示例: JJ3JSW7Z, MABSWTZG

---

## 📅 2026-03-13 - 前端部署与中文编码修复

### 完成内容
1. 修复前端中文编码问题（TrixNativeChannelClient.ts 第 446 行）
2. 重新构建并部署前端到 Nginx
3. 确认 TRIX Native Server 运行状态

### 服务器配置
- SSH: root@TRIX_SERVER_HOST:22222
- Nginx 根目录: /var/www/html
- 前端地址: http://TRIX_SERVER_HOST

---

## 📅 2026-02-25 - TypeScript 类型安全重构

### 背景
代码审查发现 47 处 `any` 类型使用，存在类型安全隐患。同时 Logger 工具存在大量重复代码。

### 目标
消除所有 `any` 类型，提升类型安全性，重构重复代码，并确保所有功能不受影响。

### 完成内容

#### 1. Logger 重构 (批次 1)
- 使用工厂函数 `createModuleLogger` 消除 80+ 行重复代码
- 将 `any[]` 改为 `unknown[]` 提升类型安全
- 保持向后兼容性，所有模块日志正常输出

#### 2. 错误类型改进 (批次 2)
- 添加 `hasErrorMessage()` 和 `getErrorMessage()` 类型守卫函数
- 将 11 个组件中的 `catch (error: any)` 改为 `catch (error: unknown)`
- 确保错误信息安全访问

#### 3. Socket 事件类型定义 (批次 3)
- 定义 `SocketEvents` 接口规范事件格式
- 定义 `ErrorPayload` 接口规范错误格式
- 定义 `EventCallback<T>` 泛型支持多种事件
- 消除 ClawbotChannelBridge 中的 7 处 `any` 类型

#### 4. databaseService 类型改进 (批次 4)
- `normalizeClawbotHistoryMessage(raw: any)` 改为 `raw: unknown`
- 添加内联 `FriendStudyUpdateData` 类型
- 修复 3 处 `any` 类型

#### 5. ConnectionManager 类型改进 (批次 5)
- 回调函数参数从 `any` 改为 `unknown`
- 监听器 Map 类型改进
- 修复 7 处 `any` 类型

#### 6. ClawbotChannelContext 类型改进 (批次 6)
- 导入并使用 SocketEvents 和 ErrorPayload 类型
- 添加内联 `MissedMessageResponse` 类型
- 修复 6 处 `any` 类型

#### 7. 剩余类型修复 (批次 7)
- StorageService: `value: any` → `value: unknown`
- pointsService: `metadata: any` → `metadata: Record<string, unknown>`
- ChatDetail: `metadata?: any` → `metadata?: Record<string, unknown>`
- supabase: `avatar_config?: any` → `avatar_config?: Record<string, unknown>`
- Study: `let interval: any` → `let interval: ReturnType<typeof setInterval> | null`

#### 8. E2E 测试类型改进
- 将 `browser: any` 改为 `Browser` 类型
- 将 `page: any` 改为 `Page` 类型
- 从 `@playwright/test` 导入类型

### 测试覆盖
- ✅ 115 个单元测试全部通过
- ✅ 11 个 E2E 测试全部通过
- ✅ 类型检查无错误
- ✅ 0 个 `any` 类型残留

### Git 提交记录
- edc2252: refactor: 重构 Logger 工具消除重复代码
- b56f7cc: refactor: React 错误类型 any 改为 unknown
- befab11: refactor: 定义 Socket 事件类型消除 any
- 7d165dc: refactor: databaseService 类型改进消除 any
- 239fd9d: refactor: ConnectionManager 类型改进消除 any
- 0432d17: refactor: ClawbotChannelContext 类型改进消除 any
- b577390: refactor: 修复剩余 5 处 any 类型
- 734d202: test: 添加 Playwright E2E 测试
- 8efb883: test: 添加完整的 E2E 测试套件
- 7151e15: test: E2E测试类型改进 - 移除any类型

### 质量提升
- 类型安全性显著提升
- 代码重复率降低
- 测试覆盖率提升
- 为后续大文件拆分奠定基础

---

## 📅 2026-02-11 - Clawbot 集成优化

### 背景
原集成方式需要手动配置 WebSocket URL 和 Token，用户体验不佳。

### 目标
实现扫码配对功能（电脑生成二维码，手机扫描），简化连接流程。

### 决策

#### 1. 配对流程选择
**方案对比**：

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| 手机生成二维码 | 实现简单 | 电脑需要扫码，不便 | ❌ |
| **电脑生成二维码** | 体验好，类似微信/Telegram | 需要电脑端显示功能 | ✅ |

**最终选择**：电脑端 Gateway 生成二维码 → 手机扫描配对

#### 2. 实现方案分级
为满足不同场景需求，提供两个版本：

| 特性 | 简化版 | 完整版 |
|------|--------|--------|
| 代码量 | ~150行 | ~500行 |
| 自动重连 | ❌ | ✅ |
| 心跳机制 | ❌ | ✅ |
| 消息队列 | ❌ | ✅ |
| 适用场景 | 开发测试 | 生产环境 |

#### 3. 安全隔离方案

**层级设计**：

```
Level 1: 设备隔离 - 每个设备独立 Token
Level 2: 权限管理 - basic/full/admin 三级权限
Level 3: 网络隔离 - 限制局域网访问
Level 4: 会话隔离 - 独立消息队列
Level 5: 审计日志 - 完整操作记录
```

### 文档产出

1. **[CLAWBOT_QUICK_START.md](./CLAWBOT_QUICK_START.md)** - 快速开始指南
2. **[CLAWBOT_SIMPLE_IMPLEMENTATION.md](./CLAWBOT_SIMPLE_IMPLEMENTATION.md)** - 简化版实现
3. **[CLAWBOT_INTEGRATION_GUIDE.md](./CLAWBOT_INTEGRATION_GUIDE.md)** - 完整版实现
4. **[CLAWBOT_GATEWAY_INTEGRATION.md](./CLAWBOT_GATEWAY_INTEGRATION.md)** - 协议规范
5. **[CLAWBOT_README.md](./CLAWBOT_README.md)** - 文档索引

---

## 📅 2026-02-10 - 数据库架构优化

### 背景
原数据库查询散落在代码各处，缺乏统一管理，难以维护。

### 决策

#### 1. 集中化数据访问
创建 `databaseService.ts` 统一管理所有数据库操作：

```typescript
// 之前：散落在各组件
const { data } = await supabase.from('friends').select('*');

// 之后：统一服务层
const friends = await databaseService.getFriends(userId);
```

#### 2. 视图优化
创建 `friend_latest_messages` 视图，简化好友列表查询：

**之前**：多次 JOIN 查询
**之后**：单次视图查询

```sql
CREATE VIEW friend_latest_messages AS
SELECT
  f.user_id,
  f.friend_id,
  p.username as name,
  p.avatar_url,
  f.status,
  COALESCE(uc.unread_count, 0) as unread_count,
  uc.last_message,
  uc.last_message_time
FROM friends f
LEFT JOIN profiles p ON f.friend_id = p.id
LEFT JOIN unread_counts uc ON f.user_id = uc.user_id AND f.friend_id = uc.friend_id;
```

### 文档产出
**[DATABASE-REQUIREMENTS.md](./DATABASE-REQUIREMENTS.md)** - 完整数据访问清单

---

## 📅 2026-02-09 - 三层布局架构

### 背景
需要实现"Zero UI"理念，首页仅展示 3D 角色，点击后显示导航。

### 决策

#### 布局方案

**采用三层架构**：

```tsx
<App>
  <HeroBackground />     {/* 背景层：3D 角色 */}
  <Routes />              {/* 内容层：页面内容 */}
  <GlassDock />           {/* 悬浮层：导航栏 */}
</App>
```

**关键实现**：
- `HeroBackground`: `position: fixed` 全屏固定
- `Routes`: 首页透明，其他页面正常
- `GlassDock`: 首页点击后显示，其他页面常驻

#### 视觉效果
- 毛玻璃效果 (`backdrop-filter: blur`)
- 渐变边框 (`border-image`)
- 平滑动画 (`framer-motion`)

---

## 📅 2026-02-08 - WebSocket 流式响应

### 背景
需要实现类似 ChatGPT 的流式 AI 响应效果。

### 决策

#### 流式处理

**协议设计**：

```json
// 增量响应
{"type": "res", "payload": {"stream": "assistant", "data": {"delta": "你"}}}
{"type": "res", "payload": {"stream": "assistant", "data": {"delta": "好"}}}
{"type": "res", "payload": {"stream": "assistant", "data": {"delta": "！"}}}

// 结束标记
{"type": "res", "payload": {"stream": "assistant", "data": {"delta": "", "finishReason": "stop"}}}
```

**实现代码**：

```typescript
const [fullResponse, setFullResponse] = useState('');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.payload?.stream === 'assistant') {
    const delta = message.payload.data?.delta || '';
    setFullResponse(prev => prev + delta);
  }
};
```

#### 握手认证

采用 challenge-response 模式：

1. 客户端连接
2. 服务端返回挑战 nonce
3. 客户端用 Token 签名响应
4. 服务端验证后建立连接

---

## 📅 2026-02-07 - Supabase Realtime 集成

### 背景
需要实现实时消息推送和未读计数更新。

### 决策

#### Realtime 订阅

**订阅三个表**：

```typescript
// 1. 聊天消息
supabase.channel('chat')
  .on('INSERT', { schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${convId}` }, payload => {
    // 新消息推送
  })
  .subscribe();

// 2. 未读计数
supabase.channel('unread')
  .on('*', { schema: 'public', table: 'unread_counts', filter: `user_id=eq.${userId}` }, payload => {
    // 未读数更新
  })
  .subscribe();

// 3. 通知
supabase.channel('notifications')
  .on('*', { schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, payload => {
    // 新通知推送
  })
  .subscribe();
```

---

## 📅 2026-02-06 - 技术栈选型

### 背景
项目启动，需要选择合适的技术栈。

### 决策

#### 核心技术

| 技术 | 版本 | 选择理由 |
|------|------|----------|
| React | 19.2.4 | 最新稳定版，支持 Concurrent Features |
| TypeScript | 5.8.2 | 类型安全，提升代码质量 |
| Vite | 6.2.0 | 极速开发体验，原生 ESM |
| Supabase | 最新 | 开源 Firebase 替代，PostgreSQL + Realtime |
| Tailwind CSS | CDN | 快速原型开发，无需构建 |
| Framer Motion | 12.33.0 | 声明式动画，性能优秀 |

#### 为什么不用 React Native？

| 对比项 | React Native | Web (PWA) |
|--------|--------------|------------|
| 开发效率 | 需要原生调试 | 浏览器直接调试 |
| 热更新 | 需要审核 | 即时更新 |
| 跨平台 | 需要适配 iOS/Android | 一次编写，多端运行 |
| 性能 | 接近原生 | 足够使用 |

**结论**：采用 Web 方案，通过 PWA 接近原生体验。

---

## 🎯 未来计划

### 短期（1-2周）
- [ ] 完成数据库迁移（NotificationPanel、StudyRoom）
- [ ] 实现扫码配对功能
- [ ] 优化 WebSocket 自动重连

### 中期（1-2月）
- [ ] 添加双向自习功能
- [ ] 实现语音输入（Web Speech API）
- [ ] 优化 3D 角色渲染性能

### 长期（3-6月）
- [ ] PWA 离线支持
- [ ] 推送通知
- [ ] 多人实时协作

---

**维护者**: TRIX 3D Companion 开发团队
**最后更新**: 2026-03-19
