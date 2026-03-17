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
git clone https://github.com/passionworkeer/TRIX_ap.git
cd TRIX_ap
```

### 2. 安装依赖

```bash
# 前端依赖
npm install

# 安装 OpenClaw 插件 (可选)
cd packages/trix-openclaw-native
npm install
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
# TRIX Native Channel (可选，本地开发)
# ===================
VITE_TRIX_NATIVE_SERVER_URL=http://localhost:8788
```

> ⚠️ **注意**: 生产环境的 URL 不能使用 `localhost` 或 `127.0.0.1`。

### 4. 启动开发服务器

```bash
# 前端开发服务器 (默认 http://localhost:5173)
npm run dev
```

---

## 🔧 项目结构

```
trix-3d-companion/
├── src/                    # React Web 前端
│   ├── screens/           # 页面组件 (18个)
│   ├── components/        # UI 组件 (60+)
│   ├── contexts/          # React Context (6个)
│   ├── services/         # 业务服务 (30+)
│   ├── hooks/            # 自定义 Hooks (12+)
│   ├── types/            # TypeScript 类型
│   ├── utils/            # 工具函数
│   └── lib/              # 库配置
│
├── ios/                   # SwiftUI iOS 应用 (25,000+ 行)
│   └── TRIX3DCompanion/
│       ├── App/           # 应用主程序
│       ├── Core/          # 核心功能
│       ├── Features/      # 功能模块
│       └── Shared/        # 共享代码
│
├── packages/              # NPM 包
│   ├── trix-openclaw-native/  # OpenClaw 原生通道插件 ⭐
│   └── trix-relay-client/    # Gateway 中继客户端
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

# 运行 E2E 测试
npm run test:e2e

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

数据库 Schema 详见: `docs/database/DATABASE_SCHEMA.md`

---

## 🔌 TRIX Native Channel

TRIX Native Channel 是项目的核心配对系统，提供 iOS 与 Web 的双向消息同步。

### 架构

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   iOS App   │────►│  TRIX Native     │────►│  OpenClaw       │
│             │◄────│  Server          │◄────│  Gateway        │
└─────────────┘     │  (端口 8788)    │     │  (端口 18789)   │
                    └──────────────────┘     └─────────────────┘
```

### 本地运行 TRIX Native Server

```bash
# 使用 CLI 启动
cd packages/trix-openclaw-native
npm run cli -- server start --port 8788
```

或通过 OpenClaw 插件运行：

```bash
# 安装插件后使用
openclaw plugins install ./packages/trix-openclaw-native
openclaw trix setup
```

### 配对方式

| 方式 | 描述 |
|------|------|
| QR 码扫描 | 使用手机扫描电脑上的配对 QR 码 |
| 手动输入 | 输入 6 位配对码完成配对 |

详见: `docs/requirements/TRIX_NATIVE_PAIRING_ARCHITECTURE.md`

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

### Q: TRIX Native 配对失败

1. 确认 TRIX Native Server 已启动 (`http://localhost:8788`)
2. 检查防火墙设置
3. 查看服务器日志排查问题

---

## 📚 更多信息

| 文档 | 说明 |
|------|------|
| [README.md](../README.md) | 项目概览 |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | 贡献指南 |
| [docs/INDEX.md](./INDEX.md) | 完整文档索引 |
| [docs/requirements/TRIX_NATIVE_PAIRING_ARCHITECTURE.md](./requirements/TRIX_NATIVE_PAIRING_ARCHITECTURE.md) | TRIX Native 配对架构 |

---

**最后更新**: 2026-03-17
