# TRIX 3D Companion 项目全面审核报告

> 审核日期：2026-02-14

---

## 目录

1. [项目概述](#1-项目概述)
2. [核心文件清单](#2-核心文件清单)
3. [目录结构详解](#3-目录结构详解)
4. [架构设计分析](#4-架构设计分析)
5. [潜在问题与隐患](#5-潜在问题与隐患)
6. [改进建议](#6-改进建议)

---

## 1. 项目概述

**TRIX 3D Companion** 是一款面向移动端的 AI 伴侣应用，采用 Zero UI 设计理念。

| 项目信息 | 详情 |
|---------|------|
| 技术栈 | React 19 + TypeScript 5.8 + Vite 6 |
| 数据库 | Supabase (PostgreSQL) |
| 样式 | Tailwind CSS (CDN) |
| 实时通信 | WebSocket + Supabase Realtime |
| 动画 | Framer Motion 12 |
| 存储 | 阿里云 OSS + Supabase Storage |

### 主要功能模块

- 用户认证系统
- 实时聊天功能
- AI Bot 对话
- 自习室/番茄钟功能
- 多设备配对（二维码/Nanobot）
- 文件上传与存储
- 地图快拍功能

---

## 2. 核心文件清单

### 2.1 入口与配置文件

| 文件 | 用途 | 重要程度 |
|------|------|---------|
| `src/index.tsx` | 应用入口，React 18 createRoot 渲染 | 核心 |
| `src/App.tsx` | 根组件：路由配置 + Provider 嵌套 + 导航控制 | 核心 |
| `src/types.ts` | 路由枚举定义 `AppRoutes` | 重要 |
| `src/constants.ts` | 静态资源常量（头像、背景图 URL） | 普通 |
| `vite.config.ts` | Vite 构建配置：代码分割、压缩、别名 | 核心 |
| `tsconfig.json` | TypeScript 编译配置 | 核心 |
| `package.json` | 项目依赖与脚本配置 | 核心 |

### 2.2 状态管理层 (Contexts)

| 文件 | 用途 | 代码行数 |
|------|------|---------|
| `src/contexts/AuthContext.tsx` | 用户认证、Session 管理、登录/注册/登出 | ~200 |
| `src/contexts/NanobotContext.tsx` | Nanobot WebSocket 连接、消息收发、配对码管理 | ~300 |
| `src/contexts/WebSocketContext.tsx` | Clawbot Gateway 连接、流式响应、心跳保活、指数退避重连 | ~400 |
| `src/contexts/QRCodePairingContext.tsx` | 二维码配对流程状态管理 | ~200 |

### 2.3 服务层 (Services)

| 文件 | 用途 | 代码行数 |
|------|------|---------|
| `src/services/databaseService.ts` | **核心数据库服务**：好友/聊天/通知/学习记录/实时订阅 | ~970 |
| `src/services/NanobotBridge.ts` | Nanobot 云端桥接：WebSocket 连接、配对绑定、媒体上传 | ~400 |
| `src/services/OSSService.ts` | 阿里云 OSS 上传：HMAC-SHA1 签名、文件上传 | ~200 |
| `src/services/uploadService.ts` | Supabase Storage 上传：压缩、元数据、缩略图 | ~300 |
| `src/services/clawbotPairingService.ts` | Clawbot 配对服务：二维码生成、状态轮询、直接连接 | ~870 |
| `src/services/projectService.ts` | 项目进度管理：localStorage CRUD | ~150 |

### 2.4 核心页面组件 (Screens)

| 文件 | 用途 | 代码行数 |
|------|------|---------|
| `src/screens/Home.tsx` | 首页：3D 角色展示、AI 对话气泡入口 | ~300 |
| `src/screens/Auth.tsx` | 登录/注册页面 | ~250 |
| `src/screens/Chat.tsx` | 聊天列表页：好友列表、未读计数 | ~200 |
| `src/screens/ChatDetail.tsx` | **聊天详情页**：消息收发、媒体支持、Bot 对话 | ~750 |
| `src/screens/Study.tsx` | **自习计时器**：番茄钟、学习记录、统计 | ~925 |
| `src/screens/Pairing.tsx` | 设备配对入口页 | ~150 |
| `src/screens/QRCodePairing.tsx` | 二维码配对页：扫描/生成 | ~300 |
| `src/screens/NanobotPairing.tsx` | Nanobot 配对页：配对码输入 | ~250 |
| `src/screens/Profile.tsx` | 用户资料页 | ~200 |

### 2.5 重要 UI 组件

| 文件 | 用途 |
|------|------|
| `src/components/GlassDock.tsx` | 底部导航栏，iOS 风格磨砂玻璃效果 |
| `src/components/GlassPanel.tsx` | 通用玻璃面板容器组件 |
| `src/components/HeroBackground.tsx` | 首页全屏 3D 角色背景层 |
| `src/components/QRScanner.tsx` | 二维码扫描组件 (html5-qrcode) |
| `src/components/MediaMessage.tsx` | 媒体消息展示组件 |
| `src/components/StudyRoom.tsx` | 自习室组件 |
| `src/components/NotificationPanel.tsx` | 通知面板 |
| `src/components/AIActionModal.tsx` | AI 操作模态框 |

### 2.6 类型定义

| 文件 | 用途 | 代码行数 |
|------|------|---------|
| `src/types/clawbot.ts` | Clawbot Gateway 完整类型定义 | ~540 |
| `src/config/supabase.ts` | Supabase 客户端配置 + 数据库表接口 | ~150 |

### 2.7 后端服务

| 文件 | 用途 |
|------|------|
| `server/cloud_server.py` | Nanobot 云端配对服务 (Python WebSocket) |
| `deploy/deploy.sh` | 部署脚本 |
| `deploy/nginx.conf` | Nginx 配置 |

### 2.8 数据库脚本

| 文件 | 用途 |
|------|------|
| `database/init.sql` | 初始数据库架构 |
| `database/complete-init.sql` | 完整初始化 SQL 脚本 |
| `database/add-*.sql` | 各类增量迁移脚本 |

---

## 3. 目录结构详解

```
trix-3d-companion/
├── 📁 .claude/                    # Claude AI 配置目录
│   └── settings.local.json        # 本地设置
│
├── 📁 .github/workflows/          # GitHub Actions CI/CD
│   └── deploy.yml                 # 自动部署配置
│
├── 📁 .vscode/                    # VS Code 配置
│   ├── settings.json              # 编辑器设置
│   ├── launch.json                # 调试配置
│   └── c_cpp_properties.json      # C/C++ 配置
│
├── 📁 database/                   # 数据库脚本目录
│   ├── init.sql                   # 初始化脚本
│   ├── complete-init.sql          # 完整初始化
│   ├── add-is-studying-to-profiles.sql
│   ├── add-companion-to-profiles.sql
│   ├── add-media-support-to-chat-messages.sql
│   └── ...                        # 其他迁移脚本
│
├── 📁 deploy/                     # 部署配置目录
│   ├── pairing_server.py          # 配对服务
│   ├── deploy.sh                  # 部署脚本
│   ├── nginx.conf                 # Nginx 配置
│   └── README.md                  # 部署说明
│
├── 📁 dist/                       # 构建输出目录 (git ignored)
│
├── 📁 docs/                       # 项目文档目录
│   ├── INDEX.md                   # 文档索引
│   ├── PROJECT.md                 # 项目结构
│   ├── CHANGELOG.md               # 变更日志
│   ├── guides/                    # 用户指南
│   ├── api/                       # API 文档
│   ├── deployment/                # 部署文档
│   ├── features/                  # 功能文档
│   └── archive/                   # 归档文档
│
├── 📁 public/                     # 静态资源目录
│   ├── env-check.html             # 环境检查页面
│   └── companion-check.html       # 伴侣检查页面
│
├── 📁 server/                     # 后端服务目录
│   ├── cloud_server.py            # 云端配对服务
│   └── README.md
│
├── 📁 src/                        # 源代码目录 ⭐
│   ├── index.tsx                  # 应用入口
│   ├── index.css                  # 全局样式
│   ├── App.tsx                    # 根组件
│   ├── types.ts                   # 路由类型
│   ├── constants.ts               # 静态常量
│   │
│   ├── 📁 assets/                 # 静态资源
│   │   ├── background.jpg
│   │   ├── StudyRoomBG.png
│   │   └── roles/                 # 角色资源
│   │       ├── role1/             # 角色1 (Wizard Boy)
│   │       └── role2/             # 角色2
│   │
│   ├── 📁 components/             # UI 组件 (17个)
│   │   ├── GlassDock.tsx
│   │   ├── GlassPanel.tsx
│   │   ├── HeroBackground.tsx
│   │   └── ...
│   │
│   ├── 📁 screens/                # 页面组件 (15个)
│   │   ├── Home.tsx
│   │   ├── Auth.tsx
│   │   ├── Chat.tsx
│   │   ├── ChatDetail.tsx
│   │   ├── Study.tsx
│   │   └── ...
│   │
│   ├── 📁 contexts/               # React Context (4个)
│   │   ├── AuthContext.tsx
│   │   ├── NanobotContext.tsx
│   │   ├── WebSocketContext.tsx
│   │   └── QRCodePairingContext.tsx
│   │
│   ├── 📁 services/               # 业务服务 (6个)
│   │   ├── databaseService.ts
│   │   ├── NanobotBridge.ts
│   │   ├── OSSService.ts
│   │   ├── uploadService.ts
│   │   ├── clawbotPairingService.ts
│   │   └── projectService.ts
│   │
│   ├── 📁 hooks/                  # 自定义 Hooks (3个)
│   │   ├── useCamera.ts
│   │   ├── useSpeechToText.ts
│   │   └── useNotification.ts
│   │
│   ├── 📁 config/                 # 配置文件
│   │   ├── supabase.ts
│   │   └── metadata.json
│   │
│   ├── 📁 types/                  # 类型定义
│   │   └── clawbot.ts
│   │
│   └── 📁 clawbot/                # Clawbot 模块
│       └── index.ts
│
├── 📁 node_modules/               # npm 依赖 (git ignored)
│
├── 📄 .env                        # 环境变量 (敏感)
├── 📄 .env.example                # 环境变量模板
├── 📄 .gitignore                  # Git 忽略规则
├── 📄 index.html                  # 入口 HTML
├── 📄 package.json                # npm 配置
├── 📄 tsconfig.json               # TypeScript 配置
├── 📄 vite.config.ts              # Vite 构建配置
├── 📄 deploy.ps1                  # Windows 部署脚本
├── 📄 deploy.sh                   # Linux 部署脚本
├── 📄 README.md                   # 项目说明
└── 📄 PROJECT_SUMMARY.md          # 项目总结
```

---

## 4. 架构设计分析

### 4.1 三层 UI 布局

```
┌─────────────────────────────────────┐
│ Layer 0: 背景层                      │
│ HeroBackground - 全屏 3D 角色展示    │
├─────────────────────────────────────┤
│ Layer 10: 内容层                     │
│ Routes - 可滚动页面内容              │
├─────────────────────────────────────┤
│ Layer 50: 悬浮层                     │
│ GlassDock - 底部毛玻璃导航栏         │
└─────────────────────────────────────┘
```

### 4.2 数据流架构

```
┌──────────────┐     WebSocket      ┌───────────────────┐
│  Mobile App  │◄──────────────────►│  Clawbot Gateway  │
│   (React)    │                    │   (本地电脑)       │
└──────┬───────┘                    └───────────────────┘
       │
       │ Supabase Realtime
       ▼
┌──────────────┐
│  PostgreSQL  │
│   数据库      │
└──────────────┘
       ▲
       │ WebSocket
       │
┌──────┴───────┐     WebSocket      ┌───────────────────┐
│   Nanobot    │◄──────────────────►│   云端配对服务     │
│  云端服务     │                    │  (阿里云服务器)    │
└──────────────┘                    └───────────────────┘
```

### 4.3 分层架构

```
┌─────────────────────────────────────────────────────────┐
│                    入口层 (Entry)                        │
│              index.tsx → App.tsx                         │
├─────────────────────────────────────────────────────────┤
│                   状态层 (Context)                       │
│    AuthContext | NanobotContext | WebSocketContext      │
├─────────────────────────────────────────────────────────┤
│                   页面层 (Screen)                        │
│     Home | Chat | ChatDetail | Study | Profile          │
├─────────────────────────────────────────────────────────┤
│                   组件层 (Component)                     │
│   GlassDock | GlassPanel | QRScanner | MediaMessage     │
├─────────────────────────────────────────────────────────┤
│                   服务层 (Service)                       │
│  databaseService | NanobotBridge | OSSService           │
├─────────────────────────────────────────────────────────┤
│                   API/存储层                             │
│      Supabase | OSS | WebSocket | localStorage          │
└─────────────────────────────────────────────────────────┘
```

---

## 5. 潜在问题与隐患

### 5.1 安全问题 (严重)

#### 🔴 问题 1: API 密钥暴露

**位置**: `.env` 文件已提交到代码库

```env
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_ALIYUN_OSS_ACCESS_KEY_ID=__ALIYUN_ACCESS_KEY_ID_REDACTED__
VITE_ALIYUN_OSS_ACCESS_KEY_SECRET=__ALIYUN_ACCESS_KEY_SECRET_REDACTED__
VITE_PC_AUTH_TOKEN=__PC_AUTH_TOKEN_REDACTED__
```

**风险**:
- 所有环境变量会被打包到前端 JavaScript
- 任何人可在浏览器开发者工具中查看
- 阿里云 OSS 密钥可能被滥用

**解决方案**:
```bash
# 从 Git 中移除已追踪的 .env
git rm --cached .env

# 立即轮换所有已暴露的密钥
# OSS 密钥应通过后端代理使用
```

#### 🔴 问题 2: OSS 密钥前端直接使用

**位置**: `src/services/OSSService.ts`

```typescript
constructor() {
  this.config = {
    accessKeyId: import.meta.env.VITE_ALIYUN_OSS_ACCESS_KEY_ID,
    accessKeySecret: import.meta.env.VITE_ALIYUN_OSS_ACCESS_KEY_SECRET,
    // 密钥直接暴露在前端
  };
}
```

**风险**: 攻击者可使用这些凭据上传任意文件到你的 OSS

**解决方案**: 实现后端 API 代理上传，或使用 STS 临时凭证

#### 🟡 问题 3: localStorage 敏感数据

**位置**: 多个文件

```typescript
// clawbotPairingService.ts
localStorage.setItem('clawbot_device_token', authToken);

// NanobotBridge.ts
localStorage.setItem('nanobot_device_id', deviceId);
localStorage.setItem('nanobot_pairing_code', pairingCode);
```

**风险**: XSS 攻击可窃取这些数据

**解决方案**: 对敏感数据加密后存储，或使用 sessionStorage

### 5.2 代码质量问题

#### 🟡 问题 4: 大量使用 `any` 类型

**位置**: 多个文件

```typescript
// WebSocketContext.tsx
const messagePayload: any = { ... };

// databaseService.ts
const updateData: any = { ... };

// ChatDetail.tsx
let mediaData: any = null;
```

**风险**: 降低类型安全性，可能隐藏运行时错误

#### 🟡 问题 5: 生产代码中大量 console.log

**位置**: 几乎所有源文件

```typescript
console.log('🚀 [发送消息] 开始:', { ... });
console.log('📦 [会话ID]:', conversationId);
```

**风险**: 生产环境泄露调试信息，影响性能

#### 🟡 问题 6: 错误处理不一致

**位置**: `src/services/databaseService.ts`

有些函数返回空数组，有些抛出异常，缺乏统一策略。

### 5.3 依赖问题

#### 🟡 问题 7: 未使用的前端依赖

```json
{
  "dependencies": {
    "ws": "^8.19.0"  // Node.js WebSocket 库，前端不需要
  }
}
```

#### 🟡 问题 8: React 版本不稳定

```json
{
  "dependencies": {
    "react": "^19.2.4",  // 实验性版本
    "react-dom": "^19.2.4"
  }
}
```

**建议**: 生产环境使用 React 18 稳定版

### 5.4 配置问题

#### 🟡 问题 9: TypeScript 配置过于宽松

```json
{
  "skipLibCheck": true,  // 跳过库类型检查
  "allowJs": true        // 允许 JS 文件
}
```

#### 🟢 问题 10: 缺少环境变量验证

**位置**: `src/config/supabase.ts`

```typescript
// 没有验证环境变量是否存在
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey);
```

### 5.5 性能问题

#### 🟢 问题 11: 缺少 React 性能优化

**位置**: `src/screens/Chat.tsx`

```typescript
// 每次都重新过滤，没有使用 useMemo
filteredFriends = friends.filter(friend =>
  friend.name.toLowerCase().includes(searchQuery.toLowerCase())
);
```

#### 🟢 问题 12: 大文件无分块上传

**位置**: `src/services/OSSService.ts`

一次性上传整个文件，无进度显示和断点续传。

---

## 6. 改进建议

### 6.1 立即处理 (P0)

| 优先级 | 问题 | 行动项 |
|--------|------|--------|
| P0 | API 密钥暴露 | 1. `git rm --cached .env` 2. 轮换所有密钥 3. 确保 .env 在 .gitignore |
| P0 | OSS 密钥暴露 | 实现后端上传代理或使用 STS |

### 6.2 高优先级 (P1)

| 优先级 | 问题 | 行动项 |
|--------|------|--------|
| P1 | 类型安全 | 定义明确接口替代 `any`，启用 `strict: true` |
| P1 | localStorage 安全 | 敏感数据加密存储 |
| P1 | 错误处理 | 统一错误处理策略，使用 Result 类型 |

### 6.3 中优先级 (P2)

| 优先级 | 问题 | 行动项 |
|--------|------|--------|
| P2 | console.log | 实现日志级别，生产构建移除 |
| P2 | 依赖清理 | 移除 `ws` 依赖，评估 React 19 稳定性 |
| P2 | 性能优化 | 使用 useMemo/useCallback，列表虚拟化 |

### 6.4 低优先级 (P3)

| 优先级 | 问题 | 行动项 |
|--------|------|--------|
| P3 | 文件上传 | 实现分块上传和进度显示 |
| P3 | 安全 Headers | 添加 CSP、X-Frame-Options 等 |
| P3 | 代码风格 | 添加 ESLint spellcheck 插件 |

---

## 附录: 关键文件路径快速索引

```
核心入口:
  src/index.tsx → src/App.tsx

认证:
  src/contexts/AuthContext.tsx
  src/screens/Auth.tsx

聊天:
  src/screens/Chat.tsx
  src/screens/ChatDetail.tsx
  src/services/databaseService.ts

自习:
  src/screens/Study.tsx
  src/components/StudyRoom.tsx

配对:
  src/screens/Pairing.tsx
  src/screens/QRCodePairing.tsx
  src/screens/NanobotPairing.tsx
  src/services/NanobotBridge.ts
  src/services/clawbotPairingService.ts

存储:
  src/services/OSSService.ts
  src/services/uploadService.ts

WebSocket:
  src/contexts/WebSocketContext.tsx
  src/contexts/NanobotContext.tsx

类型:
  src/types/clawbot.ts
  src/config/supabase.ts
```

---

*报告生成时间: 2026-02-14*
