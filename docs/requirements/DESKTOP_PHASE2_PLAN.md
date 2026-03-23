# TRIX Companion Desktop · Phase 2 实施计划

> **文档版本**: v2.0.0
> **制定日期**: 2026-03-23
> **制定人**: P8 Architect
> **目标**: 激进路径 — SettingsPage 模块化重构 + 完整功能交付
> **预估工期**: 5 Sprint（约 6-8 周，每 Sprint 交付可测试增量）

---

## 目录

1. [现状分析](#1-现状分析)
2. [架构决策](#2-架构决策)
3. [Sprint 分层计划](#3-sprint-分层计划)
4. [技术方案详细设计](#4-技术方案详细设计)
5. [IPC 扩展清单](#5-ipc-扩展清单)
6. [文件变更清单](#6-文件变更清单)
7. [风险与依赖](#7-风险与依赖)
8. [验收标准](#8-验收标准)

---

## 1. 现状分析

### 1.1 已完成（Baseline）

| 模块 | 文件 | 行数 | 状态 |
|------|------|------|------|
| SettingsPage（ monolith） | `noir/pages/SettingsPage.tsx` | 1209 | ⚠️ 待拆分 |
| IPC Handler | `main/ipc.ts` | 1599 | ✅ 完整但缺写入 |
| LuminaLayout 路由 | `stitch/shared/LuminaLayout.tsx` | 329 | ✅ 支撑新 Tab |
| Noir Design System | `stitch/noir/tokens.ts` | — | ✅ 可直接复用 |
| Gateway Subprocess | `main/gateway.ts` | 183 | ✅ 可直接复用 |

### 1.2 SettingsPage 现有 Tab（拆解来源）

```
SettingsPage.tsx (1209行)
├── Tab: overview    → 概览（OpenClaw 状态 + App 信息）
├── Tab: agents     → Agents 列表（只读）
├── Tab: skills     → Skills 列表 + 安装/卸载（CLI 封装）
├── Tab: backups    → Backups 列表 + 恢复（CLI 封装）
├── Tab: pairing    → 配对码管理（已完整）
├── Tab: gateway    → Gateway 启停/日志（部分完整）
└── Tab: account   → 账户登录/登出
```

### 1.3 缺失功能清单

| 优先级 | 功能 | 说明 |
|--------|------|------|
| P0 | `.openclaw/openclaw.json` 读取/写入 | Gateway/Models/Channels/Plugins 配置 |
| P0 | `cron/jobs.json` CRUD | 定时任务完整管理 UI |
| P0 | NPN 检测弹窗 | npm/pnpm/OpenClaw 启动时检测 |
| P0 | Skills Marketplace | 卡片浏览 + 搜索 + 分类过滤 |
| P1 | Float 对话聊天 | Float 窗口内嵌 Chat UI |
| P1 | Plugins 管理 | 插件路径 + 启用/禁用开关 |
| P1 | Agents 配置编辑 | workspace/默认模型/压缩模式 |
| P2 | Browser 设置 | CDP URL/Edge 路径 |
| P2 | 自启动配置 | Windows 注册表集成 |
| P2 | 原生通知 | Electron Notification API |
| P3 | Auto-update | electron-updater 集成 |

---

## 2. 架构决策

### 2.1 目录结构（重构后）

```
desktop/src/
├── main/
│   ├── ipc.ts                      # 主 IPC 入口（保持单文件，职责不增）
│   ├── config/
│   │   ├── openclaw-config.ts      # openclaw.json 读写封装
│   │   └── cron-manager.ts          # jobs.json CRUD
│   └── startup/
│       ├── npn-detector.ts          # npm/pnpm 检测
│       └── startup-registry.ts      # Windows 自启动注册表
│
├── renderer/
│   ├── stitch/
│   │   ├── noir/
│   │   │   ├── pages/
│   │   │   │   ├── DashboardPage.tsx   (现有)
│   │   │   │   ├── AgentsPage.tsx     (现有)
│   │   │   │   ├── ChannelsPage.tsx    (现有)
│   │   │   │   ├── BackupsPage.tsx     (现有)
│   │   │   │   └── SettingsPage.tsx   (现有 → 重构)
│   │   │   │
│   │   │   └── settings/              ★ 新目录：Settings 子模块
│   │   │       ├── index.tsx           # SettingsPage 容器（路由）
│   │   │       ├── SettingsOverview.tsx # 概览 Tab
│   │   │       ├── SettingsGateway.tsx # Gateway Tab（扩展写功能）
│   │   │       ├── SettingsModels.tsx  # ★ Models 配置 Tab（新增）
│   │   │       ├── SettingsChannels.tsx # Channels Tab（扩展账号管理）
│   │   │       ├── SettingsAgents.tsx  # ★ Agents 配置 Tab（新增）
│   │   │       ├── SettingsPlugins.tsx # ★ Plugins Tab（新增）
│   │   │       ├── SettingsSkills.tsx  # Skills Tab（扩展 Marketplace）
│   │   │       ├── SettingsCron.tsx    # ★ 定时任务 Tab（新增）
│   │   │       ├── SettingsBrowser.tsx # ★ Browser 设置 Tab（新增）
│   │   │       ├── SettingsPairing.tsx # 配对码 Tab（保留）
│   │   │       ├── SettingsBackups.tsx # 备份 Tab（保留）
│   │   │       └── SettingsAccount.tsx # 账户 Tab（保留）
│   │   │
│   │   └── float/
│   │       ├── float.tsx              (现有 → 扩展聊天)
│   │       └── FloatChat.tsx           # ★ Float 对话组件（新增）
│   │
│   └── shared/
│       ├── LuminaLayout.tsx           (现有)
│       └── components/
│           ├── CronExpressionPicker.tsx # ★ Cron 辅助选择器
│           ├── JsonEditor.tsx          # ★ JSON 可视化编辑器（高级）
│           └── StartupCheckDialog.tsx   # ★ 启动检测弹窗
│
└── types/
    └── electron.d.ts                    (扩展新 IPC 类型)
```

### 2.2 IPC 层新增策略

**原则**: `ipc.ts` 主文件**不膨胀**，新功能拆到 `config/` 子模块，通过 `setupIpcHandlers()` 调用子模块注册函数。

```typescript
// main/index.ts
export function setupIpcHandlers(): void {
  setupWindowHandlers();          // 现有
  setupOpenClawHandlers();        // 现有
  setupAuthHandlers();             // 现有
  setupCronHandlers();             // ★ 新增
  setupConfigHandlers();           // ★ 新增
}
```

### 2.3 UI 状态管理策略

| Tab 类型 | 状态管理 | 说明 |
|---------|---------|------|
| 简单 Tab（Overview/Account） | `useState` 本地状态 | 足够 |
| 复杂 Tab（Models/Channels/Cron） | `useState` + `useCallback` | 避免过度工程化 |
| Float Chat | React Context (`FloatChatContext`) | 跨窗口状态 |
| 跨 Tab 共享（Gateway 状态） | `electron-store` + IPC 轮询 | 避免 Redux |

**不引入 Redux/Zustand 的原因**: 桌面端非大型 SPA，状态复杂度远低于 Web 应用，`useState` + IPC 轮询足够。

### 2.4 主题策略

继续复用现有 `stitch/noir/tokens.ts`，所有新增 Settings Tab 使用相同的 token 变量，零新增 token 定义。

---

## 3. Sprint 分层计划

### Sprint 0 · 脚手架 + 拆分基础（1 周）

> **目标**: 建立新目录结构，SettingsPage 拆分完成，基础 IPC 扩展完毕

#### 任务清单

```
[S0-1] 新建目录结构
  ✅ desktop/src/renderer/stitch/noir/settings/
  ✅ desktop/src/main/config/
  ✅ desktop/src/main/startup/
  ✅ desktop/src/renderer/shared/components/

[S0-2] 创建 SettingsContainer
  ✅ 新建 settings/index.tsx
  ✅ 从 SettingsPage.tsx 提取 Tab 定义（TAB_LABELS, Tab type）
  ✅ 实现 Tab 路由（switch Tab → 渲染对应子组件）
  ✅ LuminaLayout 路由无需变更（仍指向 SettingsPage alias）

[S0-3] 拆分现有 7 个 Tab → 独立文件
  ✅ settings/SettingsOverview.tsx     （从 SettingsPage 提取 overview 部分）
  ✅ settings/SettingsGateway.tsx       （从 SettingsPage 提取 gateway 部分，+写功能）
  ✅ settings/SettingsSkills.tsx        （从 SettingsPage 提取 skills 部分，+ Marketplace）
  ✅ settings/SettingsPairing.tsx       （从 SettingsPage 提取 pairing 部分）
  ✅ settings/SettingsBackups.tsx      （从 SettingsPage 提取 backups 部分）
  ✅ settings/SettingsAccount.tsx      （从 SettingsPage 提取 account 部分）
  ✅ settings/SettingsAgents.tsx        （扩展：+ 配置编辑功能）

[S0-4] 删除原 SettingsPage.tsx
  ✅ 确认 7 个新文件全部正常工作后删除

[S0-5] IPC 扩展：Config Read/Write
  ✅ main/config/openclaw-config.ts     → 读取 openclaw.json
  ✅ main/config/openclaw-config.ts     → 写入 openclaw.json（含备份 .bak）
  ✅ IPC: config:read-openclaw          → 返回完整配置对象
  ✅ IPC: config:write-openclaw         → 接收 partial config，写入文件
  ✅ IPC: config:get-section            → 按 section 读取（gateway/models/channels/plugins）

[S0-6] IPC 扩展：Cron CRUD
  ✅ main/config/cron-manager.ts        → 读取 jobs.json
  ✅ main/config/cron-manager.ts        → 创建/更新/删除 job（含 schema 验证）
  ✅ IPC: cron:list                     → 返回所有 jobs（含状态）
  ✅ IPC: cron:create                   → 创建新 job
  ✅ IPC: cron:update                   → 更新 job（id + partial）
  ✅ IPC: cron:delete                   → 删除 job（id）
  ✅ IPC: cron:toggle                   → 启用/停用 job

[S0-7] LuminaLayout 路由更新
  ✅ 确认新 settings/ 文件被 LuminaLayout lazy import 正确加载
```

**Sprint 0 验收**: `npm run dev:desktop` 能正常运行，所有 7 个 Tab 可切换，Config IPC 可 curl 测试。

---

### Sprint 1 · P0 核心功能：Models + Cron + NPN 检测（1.5 周）

> **目标**: 用户最常用的配置界面全部可用

#### 任务清单

```
[S1-1] SettingsModels Tab — 模型配置 UI
  ✅ 读取 openclaw.json models section
  ✅ Provider 列表（minimax-cn, souimagery...）
  ✅ Provider 添加/删除（表单：baseUrl + authHeader + api type）
  ✅ 模型列表（每个 Provider 下的模型）
  ✅ 模型参数编辑（input cost/output cost/context window/max tokens）
  ✅ 保存 → IPC: config:write-openclaw
  ✅ 表单验证（URL 格式、必填项）

[S1-2] SettingsCron Tab — 定时任务管理 UI
  ✅ 任务列表（名称/状态/下次执行时间/最近运行状态）
  ✅ Cron 表达式辅助选择器（CronExpressionPicker.tsx）
    - 预设快捷选项：每小时/每天 9 点/每周一/每月 1 号
    - 自定义输入 + 实时预览下次执行时间
  ✅ 任务创建表单
    - 名称 / Agent 选择 / Schedule 配置
    - Payload（message，textarea）
    - Delivery 配置（channel + to + mode）
  ✅ 任务编辑（已有任务修改）
  ✅ 任务删除（确认弹窗）
  ✅ 启用/停用切换（Toggle）
  ✅ 立即执行按钮（手动触发一次）
  ✅ 任务运行历史（最近 3 次，含 duration + status）

[S1-3] 启动检测弹窗（StartupCheckDialog.tsx）
  ✅ main/startup/npn-detector.ts
    - 检测 npm --version
    - 检测 pnpm --version
    - 检测 openclaw --version
  ✅ App 启动时自动检测（main/index.ts）
  ✅ 检测结果弹窗 UI
    - 全部通过 → 静默通过，不弹窗
    - 有缺失 → 显示缺失项 + 一键安装按钮
    - npm 缺失 → 引导安装 Node.js
    - pnpm 缺失 → 引导安装 pnpm（推荐）
    - openclaw 缺失 → 引导安装（npm i -g openclaw）
  ✅ 弹窗关闭后可重新检测
```

**Sprint 1 验收**:
- Models Tab：能读出 minimax-cn/souimagery Provider，能添加新 Provider
- Cron Tab：能列出 8 个现有 job，能创建/编辑/删除/启停
- NPN 检测：启动弹窗正确显示缺失项，安装后弹窗消失

---

### Sprint 2 · P0 功能：Gateway + Channels 写功能 + Skills Marketplace（1.5 周）

#### 任务清单

```
[S2-1] SettingsGateway Tab — 扩展写功能
  ✅ 读取 openclaw.json gateway section
  ✅ Gateway 端口编辑（input，验证 1-65535）
  ✅ Gateway 模式选择（local / remote）
  ✅ Gateway 绑定选择（loopback / all）
  ✅ allowedOrigins 编辑（多行 textarea 或 tag 输入）
  ✅ auth token 显示/隐藏（遮蔽显示，点击复制）
  ✅ auth token 重新生成按钮
  ✅ Tailscale 开关（mode: off / on）
  ✅ 保存 → 触发 Gateway 自动重启确认弹窗
  ✅ 变更前自动备份 openclaw.json → openclaw.json.bak

[S2-2] SettingsChannels Tab — 账号管理扩展
  ✅ 读取 openclaw.json channels section
  ✅ Feishu 账号列表（trix/worker/default）
  ✅ Feishu 账号添加（appId + appSecret 表单）
  ✅ Feishu 账号删除（确认弹窗，保护 default）
  ✅ Feishu groupPolicy 编辑（open / restricted）
  ✅ TRIX Native Server 配置编辑
    - serverUrl + adminToken + serviceToken
  ✅ 保存 → 触发 channel 重连确认

[S2-3] SettingsPlugins Tab — 插件管理（新增）
  ✅ 读取 openclaw.json plugins section
  ✅ 插件路径列表（paths[]）
  ✅ 路径添加（browse 或手动输入，绝对路径验证）
  ✅ 路径删除
  ✅ Plugin entries 列表（feishu / trix-native）
  ✅ 启用/禁用开关（plugins.entries[id].enabled）
  ✅ 保存 → 触发 Gateway 重启

[S2-4] Skills Marketplace Tab — 完整实现
  ✅ 扫描 .openclaw/skills/ 目录（fs.readdir）
  ✅ 读取每个 skill 的 manifest（如果有）
  ✅ 技能卡片 UI
    - 名称 / 描述 / 安装状态（installed / not-installed）
    - 图标（基于 skill 名称关键字生成色块）
  ✅ 分类过滤（AI / productivity / media / developer / 其他）
  ✅ 搜索（实时过滤，卡片数量统计）
  ✅ 一键安装（IPC: openclaw:skills-install）
  ✅ 一键卸载（IPC: openclaw:skills-uninstall）
  ✅ 安装进度状态（in-progress / success / error）
  ✅ 本地 skills 数量统计
```

**Sprint 2 验收**:
- Gateway Tab：能修改端口/token/allowedOrigins，保存后 Gateway 重启
- Channels Tab：能添加/删除 Feishu 账号
- Plugins Tab：能查看/增删路径/启停插件
- Skills Tab：能浏览/搜索/安装/卸载 skills

---

### Sprint 3 · P1 功能：Float Chat + Agents + Browser（1.5 周）

#### 任务清单

```
[S3-1] Float Chat — Float 窗口对话功能
  ✅ 新建 renderer/stitch/float/FloatChat.tsx
  ✅ 消息列表（历史，electron-store 持久化，最多 100 条）
  ✅ 输入框（Enter 发送，Shift+Enter 换行）
  ✅ 消息气泡（用户消息靠右 / AI 消息靠左）
  ✅ Bot 状态动画保持（FloatHeroBackground 继续工作）
  ✅ 未登录状态 → 显示"请先登录"引导按钮
  ✅ 登录状态 → 连接 Gateway WebSocket（ws://127.0.0.1:18789）
  ✅ WebSocket 消息收发（agent: main 的 conversation）
  ✅ 断线重连（自动重连，最大 3 次）

[S3-2] SettingsAgents Tab — Agent 配置（扩展）
  ✅ 读取 .openclaw/agents/{id}/ 目录
  ✅ Agent 列表（main / worker 等）
  ✅ Agent 配置编辑
    - name / groupChat mentionPatterns
    - 默认模型选择（从 Models Tab 的列表选择）
    - workspace 路径（文件夹选择或手动输入）
    - compaction mode（safeguard / aggressive / off）
  ✅ Agent 创建（agent id + name）
  ✅ Agent 删除（保护 main agent）
  ✅ 保存 → openclaw.json agents.list 更新

[S3-3] SettingsBrowser Tab — Browser 设置
  ✅ 读取 openclaw.json browser section
  ✅ CDP URL 编辑（input + 测试连接按钮）
  ✅ Edge 路径编辑（file browse 或手动输入）
  ✅ attachOnly 开关
  ✅ 保存 → 验证 Edge 路径存在（fs.existsSync）
```

**Sprint 3 验收**:
- Float Chat：能在 Float 窗口和 AI 对话，消息持久化
- Agents Tab：能编辑 main agent 的 workspace 和模型
- Browser Tab：能修改 CDP URL，测试连接

---

### Sprint 4 · P2 功能：自启动 + 通知 + 收尾（1 周）

#### 任务清单

```
[S4-1] 自启动配置
  ✅ main/startup/startup-registry.ts
    - Windows: reg query HKCU\Software\Microsoft\Windows\CurrentVersion\Run
    - 添加 TRIX Companion 快捷方式路径
    - 删除自启动项
  ✅ IPC: system:set-autostart(enabled: boolean)
  ✅ IPC: system:get-autostart() → boolean
  ✅ Settings 新增「系统」Tab（或合并到 Overview）
    - 自启动开关
    - 开机自启动说明（中文 Windows 需管理员权限提示）

[S4-2] 原生通知
  ✅ Electron Notification API 封装
  ✅ 通知触发场景：
    - Gateway 断开 → 通知"Gateway 已停止"
    - Gateway 恢复 → 通知"Gateway 已恢复"
    - Cron 任务失败 → 通知任务名称 + 错误摘要
    - Cron 任务成功（仅 announce 模式）→ 通知
  ✅ 通知权限申请（首次启动时）

[S4-3] PRD + 文档同步更新
  ✅ 更新 docs/requirements/DESKTOP_PRD.md
    - 新增 Tab 列表（Models/Cron/Plugins/Browser）
    - 更新 IPC 矩阵（新增 20+ handlers）
    - 更新功能检查清单
  ✅ 更新 CLAUDE.md（新增技术决策记录）

[S4-4] E2E 补充测试
  ✅ Sprint 0-4 每个功能补充 Playwright E2E
  ✅ 覆盖：Config 写入 → 读取验证闭环
  ✅ 覆盖：Cron 创建 → 列表验证 → 删除验证
```

---

## 4. 技术方案详细设计

### 4.1 Config 读写（openclaw-config.ts）

```typescript
// main/config/openclaw-config.ts

interface OpenClawConfig {
  meta?: { lastTouchedVersion?: string; lastTouchedAt?: string };
  wizard?: Record<string, unknown>;
  browser?: { cdpUrl?: string; executablePath?: string; attachOnly?: boolean };
  auth?: { profiles?: Record<string, unknown> };
  models?: { mode?: string; providers?: Record<string, unknown> };
  agents?: { defaults?: unknown; list?: unknown[] };
  tools?: { agentToAgent?: { enabled?: boolean; allow?: string[] } };
  commands?: Record<string, unknown>;
  channels?: Record<string, unknown>;
  gateway?: {
    port?: number;
    mode?: string;
    bind?: string;
    controlUi?: { allowedOrigins?: string[] };
    auth?: { mode?: string; token?: string };
    tailscale?: { mode?: string; resetOnExit?: boolean };
  };
  plugins?: {
    load?: { paths?: string[] };
    entries?: Record<string, { enabled?: boolean }>;
    installs?: Record<string, unknown>;
  };
}

class OpenClawConfigManager {
  private configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
  private backupDir = path.join(os.homedir(), '.openclaw');

  read(): OpenClawConfig { /* fs.readFileSync + JSON.parse */ }
  readSection<K extends keyof OpenClawConfig>(section: K): OpenClawConfig[K] | null {
    const cfg = this.read();
    return cfg[section] ?? null;
  }
  write(partial: Partial<OpenClawConfig>): void {
    // 1. 读当前配置
    // 2. 深合并 partial
    // 3. 写 .bak 备份（带时间戳）
    // 4. 写 openclaw.json
    // 5. 验证写入成功（重新读一次对比）
  }
  writeSection<K extends keyof OpenClawConfig>(
    section: K,
    value: OpenClawConfig[K]
  ): void {
    this.write({ [section]: value } as Partial<OpenClawConfig>);
  }
  backup(): string {
    // 复制到 openclaw.json.bak.{timestamp}
  }
}
```

**安全设计**:
- 写入前验证 JSON Schema（关键字段类型）
- `meta.lastTouchedAt` 自动更新
- 写入失败回滚到 `.bak`
- 禁止修改 `meta.lastTouchedVersion`（防止降级）

### 4.2 Cron Manager（cron-manager.ts）

```typescript
// main/config/cron-manager.ts

interface CronJob {
  id: string;
  agentId: string;
  name: string;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: {
    kind: 'cron' | 'every';
    expr?: string;       // cron: "0 * * * *"
    everyMs?: number;    // every: 3600000
    tz?: string;         // "Asia/Shanghai"
    staggerMs?: number;
    anchorMs?: number;
  };
  sessionTarget: 'isolated' | 'shared';
  wakeMode: 'now' | 'await';
  payload: {
    kind: 'agentTurn';
    message: string;
    timeoutSeconds?: number;
    model?: string;      // e.g. "minimax-cn/MiniMax-M2.5"
  };
  delivery: {
    mode: 'none' | 'announce' | 'direct';
    channel?: string;
    to?: string;
    accountId?: string;
  };
  state: {
    nextRunAtMs: number;
    lastRunAtMs?: number;
    lastRunStatus?: 'ok' | 'error' | 'timeout';
    lastStatus?: string;
    lastDurationMs?: number;
    lastDeliveryStatus?: string;
    consecutiveErrors: number;
    lastDelivered?: boolean;
    lastError?: string;
    runningAtMs?: number;
  };
  enabled: boolean;
}

class CronManager {
  private jobsPath = path.join(os.homedir(), '.openclaw', 'cron', 'jobs.json');

  list(): CronJob[] { /* 读 jobs.json.jobs */ }
  create(job: Omit<CronJob, 'id' | 'createdAtMs' | 'updatedAtMs' | 'state'>): CronJob {
    // 分配 uuid，设置 createdAtMs/updatedAtMs
    // 追加到 jobs，保存
  }
  update(id: string, patch: Partial<CronJob>): CronJob {
    // 查找 job，更新字段，设置 updatedAtMs
    // 保存
  }
  delete(id: string): void { /* 过滤掉该 job，保存 */ }
  toggle(id: string): CronJob {
    // 取反 enabled，保存
  }
  validatePayload(message: string): boolean {
    // 防注入：禁止在 message 中插入 shell 命令
    // 检查：不超过 5000 字符
  }
}
```

### 4.3 CronExpressionPicker 组件设计

```typescript
// renderer/shared/components/CronExpressionPicker.tsx

// 预设模板
const PRESETS = [
  { label: '每小时整点',       expr: '0 * * * *',    tz: 'Asia/Shanghai' },
  { label: '每 30 分钟',       expr: '*/30 * * * *', tz: 'Asia/Shanghai' },
  { label: '每天 9:00',        expr: '0 9 * * *',    tz: 'Asia/Shanghai' },
  { label: '每天 9:00 & 18:00', expr: '0 9,18 * * *', tz: 'Asia/Shanghai' },
  { label: '每周一 9:00',      expr: '0 9 * * 1',    tz: 'Asia/Shanghai' },
  { label: '每月 1 号 9:00',  expr: '0 9 1 * *',    tz: 'Asia/Shanghai' },
  { label: '每 45 分钟',       expr: '*/45 * * * *', tz: 'Asia/Shanghai' },
  { label: '自定义',           expr: '',             tz: 'Asia/Shanghai' },
];

// UI: 两列布局
// 左列：预设列表（RadioGroup）
// 右列：自定义 Cron 输入框 + "每 {n} 分钟/小时" 辅助选择
// 底部：预览下一次 3 个执行时间（使用 cron-parser 库解析）
```

### 4.4 Startup 检测弹窗设计

```
┌──────────────────────────────────────────────┐
│  🔍 环境检测                                 │
│ ──────────────────────────────────────────── │
│                                              │
│  ✅ Node.js     v22.14.0                    │
│  ✅ pnpm        v9.7.1                       │
│  ✅ npm         v10.9.0                     │
│  ❌ openclaw   未安装                        │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  openclaw 是 TRIX Companion 的核心依赖  │ │
│  │                                        │ │
│  │  [ 安装 openclaw（推荐 pnpm）]          │ │
│  │  [ 仅用 npm 安装 ]                      │ │
│  │  [ 跳过（功能受限）]                    │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  [ 重新检测 ]                               │
└──────────────────────────────────────────────┘
```

---

## 5. IPC 扩展清单

### 5.1 新增 IPC Handlers（主进程 → ipc.ts）

| IPC 通道 | 参数 | 返回 | 说明 |
|---------|------|------|------|
| `config:read` | — | `OpenClawConfig` | 读完整 openclaw.json |
| `config:read-section` | `section: string` | 对应 section | 按 section 读取 |
| `config:write` | `partial: Partial<OpenClawConfig>` | `{success: true}` | 写入（带备份） |
| `config:write-section` | `section, value` | `{success: true}` | 写单个 section |
| `config:backup` | — | `{path: string}` | 创建手动备份 |
| `cron:list` | — | `CronJob[]` | 列出所有定时任务 |
| `cron:create` | `CronJob` | `CronJob` | 创建任务 |
| `cron:update` | `id, Partial<CronJob>` | `CronJob` | 更新任务 |
| `cron:delete` | `id: string` | `{success: true}` | 删除任务 |
| `cron:toggle` | `id: string` | `CronJob` | 启停任务 |
| `system:set-autostart` | `enabled: boolean` | `{success: true}` | 设置自启动 |
| `system:get-autostart` | — | `{enabled: boolean}` | 获取自启动状态 |
| `system:check-packages` | — | `PackageInfo[]` | 检测全局包（已有） |
| `plugins:list` | — | `PluginInfo[]` | 列出所有插件 |
| `agents:list-configs` | — | `AgentConfig[]` | 列出 Agent 配置 |
| `agents:write-config` | `id, AgentConfig` | `{success: true}` | 写 Agent 配置 |

### 5.2 新增 IPC Events（主进程 → Renderer）

| Event 通道 | 负载 | 说明 |
|-----------|------|------|
| `config:changed` | `{section: string}` | 外部修改通知（需热重载支持） |
| `cron:job-run` | `{id, status, durationMs}` | 任务开始/结束通知 |
| `gateway:config-changed` | — | Gateway 配置变更，需重启 |

---

## 6. 文件变更清单

### 6.1 新建文件

```
desktop/src/
├── main/
│   ├── config/
│   │   ├── openclaw-config.ts      (~120 行)
│   │   └── cron-manager.ts         (~150 行)
│   └── startup/
│       ├── npn-detector.ts          (~60 行)
│       └── startup-registry.ts      (~80 行)
│
├── renderer/
│   ├── stitch/
│   │   ├── noir/
│   │   │   └── settings/
│   │   │       ├── index.tsx               (~50 行，容器)
│   │   │       ├── SettingsOverview.tsx     (~150 行)
│   │   │       ├── SettingsGateway.tsx      (~200 行)
│   │   │       ├── SettingsModels.tsx       (~250 行)
│   │   │       ├── SettingsChannels.tsx     (~200 行)
│   │   │       ├── SettingsPlugins.tsx      (~150 行)
│   │   │       ├── SettingsSkills.tsx      (~300 行，Marketplace）
│   │   │       ├── SettingsCron.tsx         (~350 行，最复杂）
│   │   │       ├── SettingsBrowser.tsx      (~100 行）
│   │   │       ├── SettingsAgents.tsx       (~200 行）
│   │   │       ├── SettingsPairing.tsx      (~200 行，保留）
│   │   │       ├── SettingsBackups.tsx     (~150 行，保留）
│   │   │       └── SettingsAccount.tsx      (~120 行，保留）
│   │   │
│   │   └── float/
│   │       └── FloatChat.tsx                (~200 行）
│   │
│   └── shared/
│       └── components/
│           ├── CronExpressionPicker.tsx     (~180 行）
│           ├── StartupCheckDialog.tsx       (~120 行）
│           └── JsonEditor.tsx               (~150 行，可选，高级）
│
└── types/
    └── electron.d.ts                        (扩展类型)
```

**新建文件总计**: ~19 个新文件，约 2900 行代码

### 6.2 修改文件

```
desktop/src/main/ipc.ts          (+50 行，新增 handlers 调用子模块)
desktop/src/main/index.ts        (+10 行，启动时调用 npn 检测)
desktop/src/preload/index.js     (+20 行，新增 contextBridge 暴露)
desktop/src/renderer/stitch/noir/pages/SettingsPage.tsx  (删除，拆分为 13 个子文件)
```

### 6.3 删除文件

```
desktop/src/renderer/stitch/noir/pages/SettingsPage.tsx  (拆解后删除)
```

---

## 7. 风险与依赖

### 7.1 风险矩阵

| 风险 | 概率 | 影响 | 缓解策略 |
|------|------|------|---------|
| 写 openclaw.json 导致 Gateway 崩溃 | 中 | 高 | 写前自动备份，变更后 Gateway graceful restart |
| Cron 表达式格式错误导致任务调度失败 | 高 | 中 | cron-parser 验证，错误时阻止保存并提示 |
| 大量 IPC 调用导致 UI 卡顿 | 低 | 中 | 长时间操作用 loading 状态，结果缓存 30s |
| Electron-store 和 openclaw.json 状态不一致 | 中 | 低 | 统一以 openclaw.json 为事实来源 |
| Float Chat WebSocket 断线 | 中 | 低 | 自动重连 3 次 + 断线提示 UI |

### 7.2 外部依赖（需评估）

| 依赖 | 用途 | 风险 |
|------|------|------|
| `cron-parser` | Cron 表达式解析 + 预览下次执行时间 | npm 包，轻量，无风险 |
| `cronstrue` | Cron 表达式 → 中文描述 | npm 包，无风险 |
| `uuid` | Cron Job ID 生成 | 已有，无需新增 |
| `electron-store` | 配置持久化 | 已有，成熟稳定 |

---

## 8. 验收标准

### Sprint 0
- [ ] 7 个 Settings 子 Tab 全部可切换
- [ ] `config:read` IPC 返回完整 openclaw.json
- [ ] `config:write` IPC 写入后文件内容正确
- [ ] `cron:list` IPC 返回 8 个现有 job
- [ ] `npm run dev:desktop` 无报错

### Sprint 1
- [ ] Models Tab：能添加/删除 Provider，保存后重启 Gateway 生效
- [ ] Cron Tab：能创建含 cron 表达式的任务，预览正确
- [ ] NPN 检测弹窗：未安装时弹出，安装后消失

### Sprint 2
- [ ] Gateway Tab：修改端口后，Gateway 用新端口重启
- [ ] Channels Tab：添加 Feishu 账号后，Channel 页面显示新增账号
- [ ] Skills Tab：能浏览 37 个 skills，能搜索，能安装（模拟）

### Sprint 3
- [ ] Float Chat：发送消息后收到 AI 回复气泡
- [ ] Agents Tab：能修改 workspace 路径
- [ ] Browser Tab：能修改 CDP URL

### Sprint 4
- [ ] 自启动开关：开启后 `reg query` 能查到 Run 项
- [ ] 原生通知：Gateway 断开时 Windows 右下角通知弹出
- [ ] 文档：DESKTOP_PRD.md 更新，IPC 矩阵完整

---

*本计划为 Phase 2 实施指南，每次 Sprint 开始前细化任务分配。*
*P8 Architect · 2026-03-23*
