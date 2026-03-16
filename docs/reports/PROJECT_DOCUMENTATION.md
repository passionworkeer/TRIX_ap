# TRIX 3D Companion - 完整项目文档

> 📚 **文档版本**: 2.0
> 📅 **最后更新**: 2026-03-01
> 🎯 **项目概述**: 跨平台 3D 学习伴侣应用（Web + iOS）

---

## 📖 文档导航

### Web 端文档
- [Web 架构文档](./WEB_ARCHITECTURE.md) - React 前端架构详解
- [Web API 文档](./WEB_API.md) - 前端服务层 API

### iOS 端文档
- [iOS 架构文档](./IOS_ARCHITECTURE.md) - Swift iOS 架构详解
- [iOS API 文档](./IOS_API.md) - iOS 服务层 API

### 后端文档
- [后端架构文档](./BACKEND_ARCHITECTURE.md) - Node.js 后端架构
- [后端 API 文档](./BACKEND_API.md) - WebSocket/HTTP API

### 数据库文档
- [数据库设计文档](./DATABASE_SCHEMA.md) - Supabase PostgreSQL 数据库设计

---

## 🏗️ 项目概览

### 技术栈总览

| 平台 | 技术栈 | 描述 |
|------|--------|------|
| **Web 前端** | React 19 + TypeScript + Vite | 响应式 Web 应用 |
| **iOS 端** | Swift 5.9 + SwiftUI | 原生 iOS 应用 |
| **后端服务** | Node.js + Express + Socket.io | 实时通信服务器 |
| **数据库** | Supabase (PostgreSQL) | 云端数据库 + 认证 |
| **存储** | 阿里云 OSS | 文件/图片存储 |
| **实时通信** | WebSocket (Socket.io) | 双向实时消息 |

### 核心功能

```
┌─────────────────────────────────────────────────────────────┐
│                      TRIX 3D Companion                       │
├─────────────────────────────────────────────────────────────┤
│  📱 跨平台支持                                               │
│     ├── Web (React) - 浏览器访问                             │
│     └── iOS (Swift) - App Store                             │
├─────────────────────────────────────────────────────────────┤
│  💬 核心功能                                                 │
│     ├── 实时聊天 - WebSocket 双向通信                        │
│     ├── 机器人配对 - QR 码/Token 配对                        │
│     ├── 学习模式 - 专注计时 + 统计                           │
│     ├── 好友系统 - 状态/消息/互动                            │
│     ├── 积分商城 - 虚拟货币 + 商品兑换                       │
│     ├── 地图功能 - 位置共享 + 地点标记                       │
│     ├── 待办事项 - 任务管理 + 提醒                           │
│     ├── 日程管理 - 日历 + 事件                               │
│     └── 个性化 - 服装/角色/主题                              │
├─────────────────────────────────────────────────────────────┤
│  🔗 数据同步                                                 │
│     ├── 实时同步 - WebSocket                                 │
│     ├── 离线缓存 - 本地存储                                  │
│     └── 云端备份 - Supabase                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 项目结构

```
trix-3d-companion/
├── src/                          # Web 前端源码
│   ├── components/               # React 组件
│   │   ├── ui/                   # UI 基础组件
│   │   └── map/                  # 地图组件
│   ├── screens/                  # 页面/屏幕
│   ├── features/                 # 功能模块
│   │   ├── chat/                 # 聊天功能
│   │   ├── study/                # 学习功能
│   │   ├── todo/                 # 待办事项
│   │   ├── schedule/             # 日程管理
│   │   └── location/             # 位置功能
│   ├── services/                 # 服务层 API
│   ├── contexts/                 # React Context 状态
│   ├── hooks/                    # 自定义 Hooks
│   ├── types/                    # TypeScript 类型
│   ├── config/                   # 配置文件
│   ├── database/                 # 数据库脚本
│   └── i18n/                     # 国际化
│
├── ios/                          # iOS 项目
│   └── TRIX3DCompanion/
│       ├── App/                  # 应用入口
│       ├── Core/                 # 核心模块
│       │   ├── Network/          # 网络层
│       │   ├── Services/         # 服务层
│       │   ├── Storage/          # 存储层
│       │   ├── Analytics/        # 分析监控
│       │   └── Utilities/        # 工具类
│       ├── Features/             # 功能模块
│       │   ├── Auth/             # 认证
│       │   ├── Chat/             # 聊天
│       │   ├── Home/             # 首页
│       │   ├── Map/              # 地图
│       │   ├── Pairing/          # 配对
│       │   ├── Profile/          # 个人资料
│       │   ├── Snapshot/         # 相机
│       │   ├── Store/            # 商店
│       │   ├── Study/            # 学习
│       │   └── Voice/            # 语音
│       └── Shared/               # 共享组件
│           └── Theme/            # 主题系统
│
├── packages/                       # npm 包
│   ├── trix-openclaw-native/     # TRIX Native OpenClaw 通道
│   └── trix-relay-client/        # WebSocket 中继客户端
│
├── docs/                         # 文档目录
├── package.json                  # Web 依赖
└── CLAUDE.md                     # Claude Code 配置
```

---

## 🚀 快速开始

### Web 端开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试
npm run test

# 类型检查
npm run type-check

# 构建生产版本
npm run build
```

### iOS 端开发

```bash
# 打开 Xcode 项目
cd ios
open TRIX3DCompanion.xcodeproj

# 或使用 Swift Package Manager
swift build
```

### TRIX Native Server

```bash
# TRIX Native Server 独立部署
# 详见 packages/trix-openclaw-native/README.md
```

---

## 🔐 环境配置

### 必需的环境变量

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key

# 后端服务
PORT=8765
CORS_ORIGINS=https://yourdomain.com

# 阿里云 OSS
OSS_ACCESS_KEY_ID=your_key
OSS_ACCESS_KEY_SECRET=your_secret
OSS_BUCKET=your_bucket
OSS_REGION=oss-cn-hangzhou

# 数据库
DATABASE_URL=postgresql://...
```

---

## 📊 功能矩阵

| 功能 | Web | iOS | 状态 |
|------|-----|-----|------|
| 用户认证 | ✅ | ✅ | 完成 |
| 实时聊天 | ✅ | ✅ | 完成 |
| 机器人配对 | ✅ | ✅ | 完成 |
| 学习模式 | ✅ | ✅ | 完成 |
| 好友系统 | ✅ | ✅ | 完成 |
| 积分商城 | ✅ | ✅ | 完成 |
| 地图功能 | ✅ | ✅ | 完成 |
| 待办事项 | ✅ | 🚧 | 开发中 |
| 日程管理 | ✅ | 🚧 | 开发中 |
| 语音消息 | ✅ | ✅ | 完成 |
| 相机功能 | ⚠️ | ✅ | Web 有限 |
| 推送通知 | ❌ | ✅ | 仅 iOS |
| 支付集成 | ❌ | ✅ | 仅 iOS |

---

## 🧪 测试覆盖

### Web 端测试

```bash
# 单元测试
npm run test:unit

# 覆盖率报告
npm run test:unit:coverage

# E2E 测试
npm run test:e2e

# 所有测试
npm run test:all
```

**测试统计**:
- 单元测试: 501 个
- 通过率: 100%
- 覆盖率: ~80%

### 包测试

```bash
cd packages/trix-openclaw-native
npm test
```

---

## 📈 性能指标

### Web 端

- 首屏加载: < 2s
- 交互响应: < 100ms
- 包大小: < 500KB (gzip)

### iOS 端

- 启动时间: < 1s
- 内存占用: < 100MB
- 电池消耗: 优化中

### 后端

- 响应延迟: < 50ms
- 并发连接: 1000+
- 可用性: 99.9%

---

## 🔧 维护与监控

### 日志系统

- Web: Console + 外部服务
- iOS: OSLog + Firebase
- Backend: Winston + PM2

### 错误追踪

- Sentry 集成
- 自动错误报告
- 性能监控

---

## 📞 联系方式

- **项目维护**: Claude Code
- **技术支持**: 通过 GitHub Issues
- **文档更新**: 2026-03-01

---

**最后更新**: 2026-03-01
**文档版本**: 2.0
**生成工具**: Claude Sonnet 4.6
