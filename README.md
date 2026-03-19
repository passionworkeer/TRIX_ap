# TRIX 3D Companion

> AI 伴侣应用 · Web + iOS + Windows 桌面

[![React](https://img.shields.io/badge/React-19.2.4-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2.0-purple)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com/)

**Zero UI 理念**：首页仅展示 3D 角色，点击后展开功能面板。

---

## 快速导航

| 文档 | 说明 |
|------|------|
| [docs/INDEX.md](docs/INDEX.md) | 完整文档索引 |
| [docs/guides/PAIRING.md](docs/guides/PAIRING.md) | 三端配对指南 |
| [docs/TRIX_NATIVE_CHANNEL.md](docs/TRIX_NATIVE_CHANNEL.md) | Native Channel 协议 |
| [docs/guides/DEPLOYMENT.md](docs/guides/DEPLOYMENT.md) | 生产部署 |
| [docs/development/TESTING.md](docs/development/TESTING.md) | 测试指南 |

---

## 快速开始

### Web 前端

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build

# 类型检查
npm run type-check
```

### Windows 桌面端

```bash
cd desktop && npm install
npm run dev:desktop        # 开发模式
npm run build:desktop     # 打包
```

### iOS 端

```bash
cd ios/TRIX3DCompanion
# 使用 Xcode 打开 .xcworkspace
# 选择目标设备和 scheme，点击 Run
```

---

## 技术栈

| 端 | 技术 |
|----|------|
| **Web** | React 19 + TypeScript 5.8 + Vite 6 + Tailwind CSS 4 |
| **iOS** | SwiftUI + MVVM + Protocol-Oriented |
| **桌面** | Electron 38 + Vite |
| **后端** | Supabase (PostgreSQL + Realtime) + OpenClaw Gateway |
| **通信** | WebSocket + TRIX Native Channel |

---

## 三端架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Web 前端      │    │    iOS App       │    │  Windows 桌面   │
│  React + Vite   │    │   SwiftUI        │    │   Electron      │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         │         QR 配对      │                      │  Float QR 窗口
         │◄────────────────────┤                      │
         │                     │                      │
         └──────────────────┬──┴──────────────────────┘
                            │
                   ┌────────▼────────┐
                   │   OpenClaw           │
                   │   Gateway (:18789)  │
                   │   (子进程/本地)      │
                   └────────┬────────┘
                            │
                   ┌────────▼────────┐
                   │  TRIX AI Agent  │
                   │  (AI 机器人)    │
                   └─────────────────┘

         ┌──────────────────────────────────────────┐
         │          Supabase (共享数据层)             │
         │  用户 · 消息 · 好友 · 学习记录 · 积分    │
         └──────────────────────────────────────────┘
```

---

## 核心功能

- **Zero UI 首页** — 3D 角色 + 毛玻璃 Dock
- **AI 对话** — WebSocket 流式响应（OpenClaw Gateway）
- **TRIX Native Channel** — 三端消息同步（Web / iOS / Desktop）
- **QR 配对** — 桌面端生成 QR，手机扫码配对
- **番茄钟学习** — 专注计时 + 学习室
- **社交** — 好友列表、实时消息、位置打卡
- **虚拟衣柜** — 积分商城 + 服装系统

---

## 测试

```bash
npm run test:unit         # 单元测试（Vitest）
npm run test:smoke        # 冒烟测试
npm run test:e2e          # E2E 测试（Playwright）
npm run test:all          # 全部测试
```

---

## 项目结构

```
trix-3d-companion/
├── src/                      # Web 前端源码
│   ├── components/           # UI 组件 (60+)
│   ├── screens/              # 页面 (14个)
│   ├── services/             # 服务层 (30+)
│   ├── contexts/             # React Context (6个)
│   ├── hooks/                # 自定义 Hooks
│   └── features/            # 功能模块
│
├── packages/
│   ├── trix-openclaw-native/ # TRIX Native Channel 插件
│   └── trix-relay-client/   # Relay 中继客户端
│
├── desktop/                   # Windows Electron 桌面端
│   └── src/
│       ├── main/              # 主进程（窗口 + Tray + Gateway）
│       ├── renderer/          # Float 窗口 UI
│       └── preload/           # contextBridge
│
├── ios/                       # iOS SwiftUI 应用
│   └── TRIX3DCompanion/
│       ├── Core/              # 网络、存储、分析
│       └── Features/          # 页面模块
│
├── database/                  # Supabase SQL 脚本
├── tests/                     # E2E + 冒烟测试
└── docs/                      # 项目文档 (36个)
```

---

## 环境变量

```bash
# Web 前端
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx
VITE_GATEWAY_URL=ws://127.0.0.1:18789
```

详见 [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)

---

## 文档目录

```
docs/
├── 核心
│   ├── INDEX.md                   # 文档索引
│   ├── CHANGELOG.md               # 开发日志
│   └── TRIX_NATIVE_CHANNEL.md    # Native Channel 唯一权威文档
│
├── 需求规格
│   ├── PRD-WEB.md
│   ├── PRD-IOS.md
│   └── PRD-DESKTOP.md
│
├── 架构
│   ├── architecture/WEB_ARCHITECTURE.md
│   ├── architecture/BACKEND_ARCHITECTURE.md
│   ├── ios/IOS_ARCHITECTURE.md
│   └── desktop/DESKTOP_ARCHITECTURE.md
│
├── 开发
│   ├── development/TESTING.md
│   └── development/TDD-EXAMPLES.md
│
├── 操作指南
│   ├── guides/PAIRING.md          # 配对指南
│   ├── guides/DEPLOYMENT.md        # 部署指南
│   └── guides/SSH-SETUP.md
│
└── 数据库
    └── database/DATABASE_SCHEMA.md
```

完整索引：[docs/INDEX.md](docs/INDEX.md)

---

## 贡献

欢迎提交 Issue 和 Pull Request！

---

## 许可证

MIT License

---

**版本**: 0.0.0
**最后更新**: 2026-03-19
