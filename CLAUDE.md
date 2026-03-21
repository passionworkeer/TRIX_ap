# CLAUDE.md — TRIX 3D Companion 项目协作规范

> 本文件为 Claude Code 的项目级指令，所有会话自动加载。
> 基于 `~/.claude/rules/` 全局规则，补充项目特定约束。

---

## 1. 项目概述

- **项目**: TRIX 3D Companion — AI 伴侣应用（Web + iOS + Windows 桌面）
- **核心架构**: Supabase（后端）+ OpenClaw Gateway（实时通信）+ TRIX Native Channel（跨端同步）
- **三端**: Web (React 19.2.4 + TypeScript 5.8.2 + Vite 6.2 + Tailwind CSS 4.2), iOS (SwiftUI + MVVM), Desktop (Electron 33.4)
- **包管理**: npm workspaces（根目录 `packages/*`）
- **最后更新**: 2026-03-21

---

## 2. 提交规范

### 提交格式

```
<type>: <description>

<optional body>
```

### Type 类型

| Type | 适用场景 |
|------|---------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `refactor` | 重构（无行为变化） |
| `docs` | 文档更新 |
| `test` | 测试相关 |
| `chore` | 构建/工具/依赖变更 |
| `perf` | 性能优化 |
| `ci` | CI/CD 配置 |

### 示例

```bash
# Good
git commit -m "feat: add QR code generation to float window"
git commit -m "fix: correct IPC state.json path for packaged app"
git commit -m "docs: update WEB_ARCHITECTURE services listing"

# Bad
git commit -m "update"              # 模糊
git commit -m "fix bug"             # 缺 type
git commit -m "WIP"                  # 未完成
```

---

## 3. 代码审查

### 写代码后必须调用 code-reviewer agent

每次代码变更后，使用 **code-reviewer** agent 审查，优先处理：

1. **CRITICAL** — 安全漏洞、数据泄露、崩溃风险
2. **HIGH** — 逻辑错误、类型错误、缺失错误处理
3. **MEDIUM** — 代码重复、命名不规范
4. **LOW** — 代码风格

### 审查重点

- **安全**: 无 SQL 注入、XSS、硬编码凭证
- **类型**: 无 `any` 类型残留（已消除 47 处）
- **资源路径**: Electron 中使用 `app.getPath('userData')`，不用 `process.cwd()`
- **配对协议**: 三端统一使用 URL 格式 `http://host/pair?code=XXX&secret=YYY`

---

## 4. 架构约束

### 4.1 Electron 特殊处理（重要）

| 问题 | 错误做法 | 正确做法 |
|------|---------|---------|
| 资源路径 TS 错误 | `process.resourcesPath!` | `app.getPath('resourcesPath')` |
| 状态文件路径 | `process.cwd()` | `app.getPath('userData')` |
| Float 窗口按钮 | 按钮在 drag 区域内 | 按钮加 `-webkit-app-region: no-drag` |
| 状态路径一致性 | Gateway 和 IPC 用不同路径 | 统一 `app.getPath('userData')` |

### 4.2 OpenClaw Plugin 规则

- `startAccount` **必须永远不返回**（返回 = channel stopped = auto-restart 循环）
- `channel id` 含连字符时用方括号语法：`cfg.channels?.['trix-native']`
- 必须有 `openclaw.plugin.json` 且含 `channels` 数组

### 4.3 TRIX Native Channel

- QR 码格式: `http://host/pair?code=XXX&secret=YYY`
- 三端（Web/iOS/Desktop）均支持此格式
- 唯一权威文档: `docs/TRIX_NATIVE_CHANNEL.md`

---

## 5. 测试要求

### 命令

```bash
npm run test:unit      # 单元测试
npm run test:smoke     # 冒烟测试
npm run test:e2e       # Playwright E2E
npm run test:all       # 全部测试
```

### 覆盖率目标

- 单元测试: 核心服务 80%+
- 新功能必须附带测试
- 修复 Bug 时优先写回归测试

---

## 6. 文档维护

### 更新时机

| 变更类型 | 必须更新 |
|---------|---------|
| 新增服务/组件/页面 | 相应 Architecture + PRD |
| 新增 API 端点 | API_DOCUMENTATION |
| 数据库表变更 | DATABASE_SCHEMA |
| 新功能上线 | CHANGELOG |
| 文档结构变更 | INDEX |

### 文档路径

- 所有文档位于 `docs/` 目录
- 索引文件: `docs/INDEX.md`
- 三端文档需同步更新（Web / iOS / Desktop）

---

## 7. 环境配置

### 开发环境

```bash
# Web
cp .env.example .env.local  # 填写 Supabase 凭证

# Desktop
# 安装 openclaw: pnpm add -g openclaw 或 npm install -g openclaw
# 启动 Gateway: openclaw gateway start --port 18789

# iOS
# 使用 Xcode 打开 TRIX3DCompanion.xcworkspace
```

### 关键端口

| 服务 | 端口 |
|------|------|
| Web 开发服务器 | 5173 |
| Gateway | 18789 |
| TRIX Native Server | 8788 |
| 旧 Clawbot Channel | ~~8765~~ (已废弃) |

---

## 8. Git 工作流

1. 从 `main` 创建功能分支: `git checkout -b feat/xxx`
2. 开发 + 测试
3. 调用 `code-reviewer` agent 审查
4. 合并到 `main` 或对应开发分支
5. 不要强制推送 `main`

### 分支命名

```
feat/<功能名>          # 新功能
fix/<问题描述>         # Bug 修复
refactor/<范围>       # 重构
docs/<范围>           # 文档更新
```

---

## 9. 三端开发注意事项

### Web 端
- 使用 `src/services/TrixNativeChannelClient.ts`（不是 `ClawbotChannelBridge`）
- `clawbotPairingService.ts` 已废弃并删除
- 样式使用 Tailwind CSS 4

### iOS 端
- 配对使用 `ClawbotChannelService` + `ClawbotChannelViewModel`
- QR 扫描使用 `QRScannerView`（支持 URL 格式）
- 协议文件: `XxxServiceProtocol.swift` + `XxxService.swift`

### 桌面端
- 主进程: `desktop/src/main/index.ts`
- Float 窗口: `desktop/src/renderer/float.tsx`
- IPC 配对: `desktop/src/main/ipc.ts`

---

**最后更新**: 2026-03-19
