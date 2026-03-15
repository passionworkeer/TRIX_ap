# SETUP.md - 本地开发环境配置

> 本指南帮助你快速搭建 TRIX 3D Companion 本地开发环境。

---

## 📋 环境要求

### 必需工具

| 工具 | 最低版本 | 说明 |
|------|---------|------|
| Node.js | >= 18 | 前端和后端开发 |
| npm | >= 9 | 包管理器 |
| Git | >= 2.30 | 版本控制 |

### 可选工具

| 工具 | 说明 |
|------|------|
| Xcode >= 15 | iOS 开发（仅 macOS） |
| SwiftLint | iOS 代码检查 |
| Docker | 服务端容器化部署 |
| VS Code | 推荐代码编辑器 |

---

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/your-repo/trix-3d-companion.git
cd trix-3d-companion
```

### 2. 安装依赖

```bash
# 前端依赖
npm install

# 后端依赖 (可选，如需本地运行服务端)
cd server/clawbot-channel
npm install
cd ../..
```

### 3. 配置环境变量

```bash
# 复制示例配置
cp .env.example .env
```

编辑 `.env` 文件：

```env
# ===================
# Supabase 配置 (必需)
# ===================
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# ===================
# 开发环境配置
# ===================
VITE_CLAWBOT_CHANNEL_URL=ws://localhost:8765
VITE_GATEWAY_WS_URL=ws://localhost:18789
VITE_GATEWAY_AUTH_TOKEN=your-dev-token

# ===================
# 生产环境配置 (可选)
# ===================
VITE_CLAWBOT_CHANNEL_URL=https://api.trix3d.com/api
VITE_GATEWAY_WS_URL=wss://gateway.trix3d.com
```

> ⚠️ **注意**: 生产环境的 `VITE_CLAWBOT_CHANNEL_URL`、`VITE_GATEWAY_WS_URL`、`VITE_GATEWAY_AUTH_TOKEN` 不能使用 `localhost` 或 `127.0.0.1`。

### 4. 启动开发服务器

```bash
# 前端开发服务器 (默认 http://localhost:5173)
npm run dev

# 后端开发服务器 (可选，如需本地运行 API)
cd server/clawbot-channel
npm run dev
```

---

## 🔧 项目结构

```
trix-3d-companion/
├── src/                    # React Web 前端
│   ├── screens/           # 页面组件 (18个)
│   ├── components/        # UI 组件 (48个)
│   ├── contexts/          # React Context (6个)
│   ├── features/          # 功能模块 (5个)
│   ├── services/          # 业务服务 (26个)
│   ├── hooks/             # 自定义 Hooks (12个)
│   ├── types/             # TypeScript 类型
│   ├── utils/             # 工具函数
│   └── lib/               # 库配置
│
├── ios/                   # SwiftUI iOS 应用
│   └── TRIX3DCompanion/
│       ├── App/           # 应用主程序
│       ├── Core/          # 核心功能
│       ├── Features/      # 功能模块
│       ├── Shared/        # 共享代码
│       └── ...
│
├── server/                # Node.js 后端
│   └── clawbot-channel/
│       ├── routes/        # API 路由
│       │   ├── mvp.js    # 核心 API
│       │   ├── extended.js # 扩展 API
│       │   └── supplement.js # 补充 API
│       ├── services/      # 业务逻辑
│       ├── middleware/    # 中间件
│       ├── server.js      # 入口文件
│       └── package.json
│
├── database/              # 数据库脚本
│   └── init/
│       └── complete-init.sql
│
└── docs/                 # 项目文档
```

---

## 🖥️ 前端开发

### 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.x | UI 框架 |
| TypeScript | 5.8 | 类型系统 |
| Vite | 6.x | 构建工具 |
| Tailwind CSS | 4.x | 样式框架 |
| React Context | - | 状态管理 |
| React Router | 7.x | 路由管理 |
| Supabase | 2.x | 数据库和实时 |
| Vitest | 1.x | 单元测试 |
| Playwright | 1.x | E2E 测试 |

### 常用命令

```bash
# 开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview

# 类型检查
npm run type-check

# Lint 检查
npm run lint

# ========== 测试命令 ==========

# 运行所有测试 (单元 + 冒烟 + 服务端)
npm run test

# 运行单元测试
npm run test:unit

# 运行单元测试 (监听模式)
npm run test:unit:watch

# 运行测试覆盖率
npm run test:unit:coverage

# 运行冒烟测试
npm run test:smoke

# 运行服务端测试
npm run test:server

# 运行 API 集成测试
npm run test:api

# 运行 E2E 测试
npm run test:e2e

# 运行 E2E 测试 (UI 模式)
npm run test:e2e:ui

# 运行 E2E 测试 (调试模式)
npm run test:e2e:debug

# 运行全部测试
npm run test:all
```

### 开发注意事项

1. **热更新**: Vite 支持即时热更新，修改代码后无需刷新
2. **类型检查**: 使用 TypeScript 严格模式，确保类型安全
3. **环境变量**: 前端环境变量必须以 `VITE_` 开头

---

## 🍎 iOS 开发

> ⚠️ **注意**: iOS 开发只能在 macOS 上进行

### 前置要求

1. 安装 Xcode >= 15
2. 安装 XcodeGen: `brew install xcodegen`
3. 安装 SwiftLint: `brew install swiftlint`

### 生成项目

```bash
cd ios
xcodegen generate
```

### 运行项目

1. 打开 `ios/TRIX3DCompanion.xcworkspace`
2. 选择目标设备或模拟器
3. 点击运行 (⌘R)

### 代码规范

- 遵循 `.swiftlint.yml` 配置
- 使用 `@available` 标记 iOS 版本特性
- 保持与 Web 端字段名一致

---

## 🗄️ 数据库

### Supabase 本地开发

1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 创建新项目
3. 获取 Project URL 和 anon key
4. 填入 `.env` 文件

### 数据库迁移

```bash
# 执行初始化脚本 (通过 Supabase Dashboard SQL Editor)
# 或使用 Supabase CLI
supabase db reset
```

数据库 Schema 详见: `docs/DATABASE_SCHEMA.md`

---

## 🔌 后端服务 (可选)

### 本地运行

```bash
cd server/clawbot-channel
npm install
npm run dev
```

服务器将在 `http://localhost:8765` 启动。

### 主要 API 模块

| 模块 | 前缀 | 描述 |
|------|------|------|
| 用户 | `/user` | 用户资料管理 |
| 好友 | `/friends` | 好友关系 |
| 聊天 | `/chat` | 实时消息 |
| 学习 | `/study` | 学习记录、自习室、目标 |
| 日程 | `/schedules` | 日程管理 |
| 待办 | `/todos` | 待办管理 |
| 成就 | `/achievements` | 成就系统 |
| 商城 | `/mall` | 商品购买 |
| 衣柜 | `/wardrobe` | 虚拟装扮 |
| 积分 | `/points` | 积分系统 |
| 配对 | `/pairing` | 设备配对 |
| 通知 | `/notifications` | 推送通知 |
| 地点 | `/places` | 地点搜索收藏 |
| 位置 | `/locations` | 位置共享 |
| 快照 | `/snapshots` | 截图功能 |
| AI 对话 | `/clawbot` | AI 对话 |

完整 API 文档: [API.md](./API.md)

---

## 🐛 常见问题

### Q: 前端启动失败

检查以下内容：
1. `.env` 文件是否正确配置
2. Node.js 版本是否 >= 18
3. 依赖是否完整安装 (`npm install`)

### Q: 无法连接 Supabase

1. 确认 `.env` 中的 URL 和 key 正确
2. 检查 Supabase 项目的 API 设置
3. 确认网络可以访问 Supabase

### Q: iOS 构建失败

1. 确认在 macOS 上操作
2. 确认 Xcode 版本 >= 15
3. 运行 `xcodegen generate` 重新生成项目

### Q: 后端 API 报错

1. 确认后端服务已启动
2. 检查端口 8765 是否被占用
3. 查看后端日志排查问题

---

## 📚 更多信息

| 文档 | 说明 |
|------|------|
| [README.md](./README.md) | 项目概览 |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 贡献指南 |
| [API.md](./API.md) | API 快速参考 |
| [docs/INDEX.md](./docs/INDEX.md) | 完整文档索引 |

---

**最后更新**: 2026-03-08
