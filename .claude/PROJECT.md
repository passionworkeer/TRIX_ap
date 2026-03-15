# PROJECT.md - Claude Code 项目上下文

> 本文件是 Claude Code 专用上下文，每次会话会自动加载。
>
> ⚠️ **注意**: 本文件是主要配置文件。根目录的 CLAUDE.md 是旧版本，已弃用。

---

## 📱 项目概述

**TRIX 3D Companion** - 面向移动端的 AI 伴侣应用，采用 Zero UI 设计理念。

| 属性 | 值 |
|------|-----|
| 类型 | 双端应用 (Web + iOS) |
| Web 技术栈 | React 19 + TypeScript + Vite |
| iOS 技术栈 | SwiftUI + Combine + AVFoundation |
| 状态管理 | React Context (Web) / @Published (iOS) |
| 数据库 | Supabase (PostgreSQL) |
| 实时通信 | WebSocket + Socket.io |

---

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    Web 前端 (React)                     │
│  src/screens/  src/components/  src/services/  src/    │
└──────────────────────┬──────────────────────────────────┘
                      │ WebSocket + REST
                      ▼
┌─────────────────────────────────────────────────────────┐
│              后端服务 (Node.js + Express)               │
│         server/clawbot-channel/ (端口 8765)            │
└──────────────────────┬──────────────────────────────────┘
                      │ REST
                      ▼
┌─────────────────────────────────────────────────────────┐
│                  Supabase (PostgreSQL)                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    iOS 应用 (SwiftUI)                   │
│                 ios/TRIX3DCompanion/                    │
└─────────────────────────────────────────────────────────┘
```

---

## 📂 关键路径

| 模块 | 路径 | 说明 |
|------|------|------|
| Web 前端 | `src/` | React 组件和服务 |
| iOS | `ios/TRIX3DCompanion/` | SwiftUI 代码 |
| 后端 | `server/clawbot-channel/` | Express API |
| 数据库 | `database/init/` | SQL 初始化脚本 |
| 文档 | `docs/` | 完整项目文档 |
| 配置 | `.claude/` | Claude Code 配置 |

---

## 🎯 核心功能

| 功能 | 描述 | 关键文件 |
|------|------|---------|
| Zero UI 首页 | 全屏 3D 角色，点击显示面板 | `src/screens/Home.tsx` |
| AI 对话 | WebSocket 流式响应 | `src/contexts/ClawbotChannelContext.tsx` |
| 好友聊天 | 实时消息 + 未读计数 | `src/screens/Chat.tsx` |
| 学习计时 | 番茄钟 + 虚拟自习室 | `src/screens/Study.tsx` |
| 位置共享 | Leaflet 地图 | `src/screens/SnapMapScreen.tsx` |
| 扫码配对 | 设备配对 | `src/screens/QRCodePairing.tsx` |
| 积分商城 | 虚拟物品购买 | `src/screens/PointsMall.tsx` |
| 虚拟衣柜 | 角色装扮 | `src/screens/Wardrobe.tsx` |
| 日程管理 | 日程 CRUD | `src/features/schedule/` |
| 待办事项 | 待办 CRUD | `src/features/todo/` |

---

## 📊 项目统计

| 分类 | 数量 |
|------|------|
| Screens 页面 | 18 |
| Components 组件 | 48 |
| Contexts 上下文 | 6 |
| Features 功能模块 | 5 |
| Services 服务 | 26 |
| Hooks | 12 |
| API 端点 | 80+ |
| 数据库表 | 34 |

## 🍎 iOS 开发

### 技术栈

| 技术 | 用途 |
|------|------|
| SwiftUI | UI 框架 |
| Combine | 响应式编程 |
| AVFoundation | 音视频处理 |
| XcodeGen | 项目生成 |
| SwiftLint | 代码规范 |

### 项目结构

```
ios/TRIX3DCompanion/
├── App/                    # 应用主程序入口
├── AppStore/               # App Store 相关配置
├── Core/                   # 核心功能
│   ├── Network/           # 网络层 (APIClient, WebSocket)
│   ├── Services/          # 核心服务
│   ├── Storage/           # 本地存储
│   └── ...
├── Features/               # 功能模块
│   ├── Auth/             # 认证
│   ├── Chat/             # 聊天
│   ├── Study/            # 学习
│   ├── Profile/          # 用户资料
│   └── ...
├── Shared/                # 共享代码
│   ├── Components/       # 共享组件
│   ├── Models/           # 数据模型
│   └── Utilities/        # 工具函数
├── Resources/             # 资源文件
└── Security/              # 安全相关
```

### 编译注意事项

- **必须使用 macOS**: Xcode 只能在 macOS 上运行
- **SwiftLint**: 代码必须通过 SwiftLint 检查
- **@available**: 使用 `@available(iOS 15.0, *)` 标记版本特性
- **字段一致性**: iOS 字段名必须与 Web 端保持一致

### XcodeGen 配置

项目使用 `project.yml` 生成 Xcode 项目：

```bash
cd ios
xcodegen generate
```

生成后打开 `TRIX3DCompanion.xcworkspace`

---

## 🗄️ 数据库表

### 核心表

| 表名 | 描述 |
|------|------|
| profiles | 用户配置 (Supabase Auth) |
| friends | 好友关系 (双向) |
| chat_messages | 聊天消息 |
| chat_rooms | 聊天房间 |
| unread_counts | 未读计数 |

### 学习相关

| 表名 | 描述 |
|------|------|
| study_sessions | 学习记录 |
| study_rooms | 虚拟自习室 |
| study_goals | 学习目标 |
| achievements | 成就 |
| user_achievements | 用户成就 |

### 积分与商城

| 表名 | 描述 |
|------|------|
| user_points | 用户积分 |
| points_transactions | 积分交易 |
| mall_items | 商城商品 |
| outfits | 装扮 |
| user_outfits | 用户装扮 |

### 其他

| 表名 | 描述 |
|------|------|
| schedules | 日程 |
| todos | 待办 |
| places / place_favorites | 地点 |
| pairing_requests / paired_devices | 配对 |
| notifications | 通知 |
| clawbot_conversations | AI 对话 |

详见: `docs/DATABASE_SCHEMA.md`

基础 URL: `http://TRIX_SERVER_HOST:8765` (开发) / `https://api.trix3d.com/api` (生产)

| 模块 | 前缀 | 主要端点 |
|------|------|---------|
| 用户 | `/user` | profile, stats, settings, avatar |
| 好友 | `/friends` | list, request, accept, decline |
| 聊天 | `/chat` | rooms, messages, read |
| 学习 | `/study` | sessions, rooms, stats, goals, history |
| 日程 | `/schedules` | CRUD, range, upcoming |
| 待办 | `/todos` | CRUD, toggle |
| 成就 | `/achievements` | list, check, unlock |
| 商城 | `/mall` | items, purchase, history |
| 衣柜 | `/wardrobe` | outfits, equip, unequip |
| 积分 | `/points` | get, history, add, deduct |
| 配对 | `/pairing` | request, confirm, devices |
| 通知 | `/notifications` | list, read, settings |
| 地点 | `/places` | nearby, search, favorites |
| 位置 | `/locations` | share, list |
| 快照 | `/snapshots` | CRUD |
| AI 对话 | `/clawbot` | conversations, messages |
| 未读 | `/unread` | counts, read-all |

---

## 🛠️ 常用命令

```bash
# 前端开发
npm run dev              # 启动开发服务器
npm run build            # 构建生产版本
npm run test             # 运行所有测试
npm run test:unit        # 单元测试
npm run test:e2e         # E2E 测试
npm run lint             # 代码检查
npm run type-check       # 类型检查

# 后端开发
cd server/clawbot-channel
npm run dev              # 启动后端服务

# iOS (macOS only)
cd ios
xcodegen generate        # 生成 Xcode 项目
```

---

## ⚙️ 环境变量

### 前端 (.env)

```env
VITE_SUPABASE_URL=<supabase-url>
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
VITE_CLAWBOT_CHANNEL_URL=ws://localhost:8765
VITE_GATEWAY_WS_URL=ws://localhost:18789
VITE_GATEWAY_AUTH_TOKEN=<token>
VITE_TRIX_NATIVE_SERVER_URL=http://localhost:8788
```

> ⚠️ 生产环境必须使用真实域名，不能用 localhost

---

## 🔐 安全要求

- ✅ 无硬编码 secrets
- ✅ 用户输入验证
- ✅ 参数化查询防 SQL 注入
- ✅ HTML 转义防 XSS
- ✅ 权限验证

---

## 📚 文档导航

| 文档 | 位置 | 说明 |
|------|------|------|
| 完整索引 | `docs/INDEX.md` | 所有文档入口 |
| API 文档 | `API.md` | 完整 API |
| 架构文档 | `ARCHITECTURE.md` | 系统架构 |
| 环境配置 | `SETUP.md` | 开发环境 |
| 数据库 | `docs/DATABASE_SCHEMA.md` | 表结构 |
| 用户指南 | `docs/guides/` | 功能使用 |

---

## 🤖 Claude Code 工作流

### 必须遵循

1. **理解需求** → 使用 `brainstorming` skill
2. **制定计划** → 使用 TodoWrite 跟踪
3. **实现代码** → 使用 TDD (先写测试)
4. **安全审核** → senior-dev 审核
5. **测试验证** → junior-dev 测试
6. **提交代码** → 清晰 commit message

### Agent 使用规则

| 任务类型 | Agent |
|---------|-------|
| 前端 UI | frontend-dev |
| 后端逻辑 | backend-dev |
| iOS | frontend-dev (iOS 上下文) |
| 安全审核 | senior-dev |
| 测试验证 | junior-dev |
| 调研探索 | Explore |

详见 `CLAUDE.md`

---

**最后更新**: 2026-03-08
