# TRIX 3D Companion

TRIX 3D Companion 是一款面向移动端的 AI 伴侣应用，核心理念为"Zero UI"沉浸式交互。用户主页仅展示全屏 3D 角色（Clawbot），点击后才显示导航栏和功能面板。应用通过 WebSocket 连接本地 PC 上的 Clawbot Gateway，实现 AI 对话和桌面代理操控。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 6 |
| 路由 | React Router v7 (HashRouter) |
| 数据库 | Supabase (PostgreSQL) |
| 动画 | Framer Motion |
| 地图 | Leaflet + React Leaflet |
| 图标 | Lucide React |
| 样式 | Tailwind CSS (CDN) |
| 实时通信 | WebSocket (Clawbot Gateway) |

## 项目结构

```
src/
├── App.tsx                     # 主路由和三层布局（背景/内容/悬浮UI）
├── index.tsx                   # React 入口
├── index.css                   # 全局样式
├── constants.ts                # 图片资源常量映射
├── types.ts                    # 路由枚举和通用接口
├── vite-env.d.ts               # Vite 环境类型声明
│
├── components/                 # UI 组件
│   ├── Avatar.tsx              # 头像组件（支持图片/渐变回退）
│   ├── GlassDock.tsx           # 底部导航栏（毛玻璃效果）
│   ├── GlassPanel.tsx          # 通用毛玻璃容器
│   ├── HeroBackground.tsx      # 首页全屏背景和问候气泡
│   ├── MailPanel.tsx           # 邮件查看弹窗
│   ├── NotificationPanel.tsx   # 通知中心弹窗
│   ├── ProjectProgress.tsx     # 项目/任务进度面板
│   ├── StatusHeader.tsx        # 顶部状态栏（PC 连接状态、时间）
│   ├── StudyRoom.tsx           # 虚拟自习室弹窗
│   └── UserSwitcher.tsx        # 多用户切换面板
│
├── screens/                    # 页面组件
│   ├── Home.tsx                # 首页（沉浸式 3D 角色展示）
│   ├── Chat.tsx                # 聊天列表
│   ├── ChatDetail.tsx          # 聊天对话详情（支持 Bot/好友）
│   ├── Study.tsx               # 学习计时器（番茄钟）
│   ├── Map.tsx                 # 实时位置地图
│   ├── Profile.tsx             # 个人中心和设置
│   ├── Snapshot.tsx            # 拍照/截图功能
│   ├── Auth.tsx                # 登录/注册
│   ├── Pairing.tsx             # PC 代理配对
│   ├── Diagnostic.tsx          # 连接诊断工具
│   └── DiagnosticAdvanced.tsx  # 高级 WebSocket 诊断
│
├── contexts/                   # React Context 状态管理
│   ├── AuthContext.tsx          # 认证状态（Supabase Auth）
│   └── WebSocketContext.tsx     # Bot WebSocket 连接管理
│
├── services/                   # 业务服务层
│   ├── databaseService.ts      # Supabase 数据库操作 API
│   └── projectService.ts       # 项目任务管理（localStorage）
│
├── config/                     # 配置
│   └── supabase.ts             # Supabase 客户端和类型定义
│
├── hooks/                      # 自定义 Hooks
│   └── useSpeechToText.ts      # 语音识别 Hook
│
├── database/                   # 数据库脚本
│   ├── init.sql                # 数据库初始化脚本（表结构 + mock 数据）
│   ├── SCHEMA.md               # 数据库架构文档
│   └── README.md               # 数据库配置指南
│
└── assets/                     # 本地图片资源
    ├── role.jpg
    └── StudyRoomBG.png

public/
└── assets/                     # 静态资源
    ├── AvatarHead.png
    ├── hero_render.png
    ├── main.jpg
    ├── map.png
    ├── role.jpg
    └── StudyRoomBG.png
```

## 核心模块

### 三层布局架构 (App.tsx)

应用采用三层布局：
1. **背景层** — `HeroBackground` 组件，固定定位的全屏 3D 角色渲染
2. **内容层** — 可滚动的路由页面内容，首页透明显示背景
3. **悬浮 UI 层** — `GlassDock` 导航栏，首页点击后才显示，其他页面常驻

### WebSocket Bot 连接 (WebSocketContext.tsx)

通过 WebSocket 连接本地 Clawbot Gateway：
- 支持移动端/桌面端不同 URL 配置
- 自动重连机制（最多 5 次，间隔 3 秒）
- 协议握手认证（challenge-response 模式）
- 流式响应处理（增量 delta 拼接）

### 数据库服务 (databaseService.ts)

封装了 Supabase 的全部 CRUD 操作：
- **好友管理** — 列表查询、状态更新、学习状态同步
- **聊天记录** — 消息收发、已读标记、历史清空
- **通知/邮件** — 获取、已读、删除
- **学习记录** — 创建、查询、今日统计
- **实时订阅** — 消息、未读计数、通知的 Postgres 实时监听

### 数据库架构 (9 张核心表)

| 表名 | 用途 |
|------|------|
| users | 用户信息 |
| friends | 好友列表及状态 |
| chat_messages | 聊天消息记录 |
| unread_counts | 未读消息计数 |
| notifications | 系统通知 |
| mails | 邮件消息 |
| study_sessions | 学习时长记录 |
| study_rooms | 共享自习室 |
| study_room_members | 自习室成员 |

详细架构见 [src/database/SCHEMA.md](src/database/SCHEMA.md)。

## 开发配置

### 环境变量 (.env)

```env
VITE_SUPABASE_URL=<Supabase 项目 URL>
VITE_SUPABASE_ANON_KEY=<Supabase 匿名密钥>
VITE_PC_WEBSOCKET_URL=ws://localhost/gateway
VITE_PC_WEBSOCKET_URL_MOBILE=ws://<局域网IP>/gateway
VITE_PC_AUTH_TOKEN=<Clawbot Gateway 认证令牌>
```

### 启动开发

```bash
npm install
npm run dev        # 启动开发服务器
npm run build      # 生产构建
```

### WebSocket 代理

Vite 开发服务器内置反向代理，将 `/gateway` 路径转发到本地 Clawbot Gateway (`ws://127.0.0.1:18789`)，解决移动端跨域连接问题。

## 当前状态

- 单用户模式（固定用户 ID）
- 数据库迁移约 80% 完成（NotificationPanel 和 StudyRoom 待迁移）
- Bot 聊天为核心可用功能，好友聊天使用 mock 数据
- RLS 策略为开发模式（全开放），生产环境需收紧
