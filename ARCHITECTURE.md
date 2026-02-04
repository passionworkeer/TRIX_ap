# 🏗️ TRIX 系统架构

## 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         TRIX MOBILE APP                         │
│                        (React + TypeScript)                     │
└────────────┬────────────────────────────────────┬───────────────┘
             │                                    │
             │                                    │
    ┌────────▼────────┐                  ┌────────▼────────┐
    │  DATA LAYER     │                  │  ACTION LAYER   │
    │  (The Memory)   │                  │  (The Nerve)    │
    │                 │                  │                 │
    │   Supabase      │                  │   WebSocket     │
    │   (Cloud)       │                  │   (Local PC)    │
    └────────┬────────┘                  └────────┬────────┘
             │                                    │
             │                                    │
    ┌────────▼────────┐                  ┌────────▼────────┐
    │  PostgreSQL DB  │                  │  Python Server  │
    │                 │                  │   (Port 8080)   │
    │  • profiles     │                  │                 │
    │  • task_history │                  │  • OpenClaw     │
    │  • auth.users   │                  │  • Commands     │
    └─────────────────┘                  └─────────────────┘
```

---

## 数据流向

### 📥 用户注册/登录流程

```
┌──────────┐      ┌──────────────┐      ┌───────────┐      ┌──────────┐
│ Auth.tsx │─────▶│ AuthContext  │─────▶│ Supabase  │─────▶│ Database │
│ (UI)     │      │ signUp()     │      │ Auth API  │      │ profiles │
└──────────┘      └──────────────┘      └───────────┘      └──────────┘
     │                                         │
     │                                         │
     ▼                                         ▼
┌──────────┐                            ┌───────────┐
│ Home.tsx │◀───────────────────────────│  Session  │
│ (显示用户)│                            │  Created  │
└──────────┘                            └───────────┘
```

### 🚀 命令执行流程

```
┌────────────────┐     ┌─────────────────┐     ┌──────────────┐
│ ChatDetail.tsx │────▶│ usePCConnection │────▶│  WebSocket   │
│ 用户输入命令    │     │ sendCommand()   │     │  Client      │
└────────────────┘     └─────────────────┘     └──────┬───────┘
                                                       │
                                                       │ ws://
                                                       │
                                                ┌──────▼───────┐
                                                │  server.py   │
                                                │  (Python)    │
                                                └──────┬───────┘
                                                       │
                                                       ▼
        ┌──────────────────────────────────────────────────────┐
        │            Command Router                            │
        │                                                      │
        │  organize_files() │ clean_downloads() │ screenshot()│
        └──────┬────────────┴───────┬───────────┴──────┬──────┘
               │                    │                   │
               ▼                    ▼                   ▼
        ┌─────────────┐      ┌─────────────┐    ┌─────────────┐
        │ File System │      │ Downloads   │    │ Screenshot  │
        │ Operations  │      │ Cleanup     │    │ Capture     │
        └──────┬──────┘      └──────┬──────┘    └──────┬──────┘
               │                    │                   │
               └────────────────────┴───────────────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │ Progress Updates │
                          │ (WebSocket Back) │
                          └────────┬─────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │ ChatDetail.tsx  │
                          │ Update Progress │
                          │ Bar in Real-Time│
                          └─────────────────┘
```

---

## 组件交互图

### 前端组件层级

```
App.tsx (AuthProvider)
│
├─ HashRouter
│  │
│  ├─ Home.tsx
│  │  └─ usePCConnection() ───┐
│  │     └─ useAuth()          │
│  │                           │
│  ├─ Auth.tsx                 │
│  │  └─ useAuth()             │
│  │     ├─ signIn()           │
│  │     └─ signUp()           │
│  │                           │
│  ├─ Chat.tsx                 │
│  │                           │
│  ├─ ChatDetail.tsx           │
│  │  ├─ usePCConnection() ◀──┘ (WebSocket 连接)
│  │  └─ useAuth()
│  │
│  ├─ Profile.tsx
│  │  └─ useAuth()
│  │
│  └─ BottomNav.tsx
```

### Context 与 Hook 关系

```
┌──────────────────────────────────────────────────┐
│            AuthContext (Provider)                │
│                                                  │
│  State:                                          │
│  • user (User)                                   │
│  • profile (Profile)                             │
│  • session (Session)                             │
│  • loading (boolean)                             │
│                                                  │
│  Methods:                                        │
│  • signIn(email, password)                       │
│  • signUp(email, password, username)             │
│  • signOut()                                     │
│  • updateProfile(updates)                        │
│  • refreshProfile()                              │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │   useAuth()    │
              │   (Hook)       │
              └────────┬───────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
   ┌────────┐    ┌──────────┐  ┌──────────┐
   │Home.tsx│    │Auth.tsx  │  │Profile.tsx│
   └────────┘    └──────────┘  └──────────┘


┌──────────────────────────────────────────────────┐
│        usePCConnection (Hook)                    │
│                                                  │
│  State:                                          │
│  • status ('online' | 'offline' | 'connecting') │
│  • lastMessage (PCMessage)                       │
│  • wsRef (WebSocket)                             │
│                                                  │
│  Methods:                                        │
│  • sendCommand(command, data)                    │
│  • connect()                                     │
│  • disconnect()                                  │
└──────────────────────┬───────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
   ┌────────┐    ┌──────────────┐  ┌────────┐
   │Home.tsx│    │ChatDetail.tsx│  │Chat.tsx│
   └────────┘    └──────────────┘  └────────┘
```

---

## 数据库关系图

```
┌─────────────────────────────────────────┐
│           auth.users (Supabase)         │
│                                         │
│  • id (UUID, PK)                        │
│  • email (TEXT)                         │
│  • encrypted_password (TEXT)            │
│  • created_at (TIMESTAMP)               │
└────────────┬────────────────────────────┘
             │
             │ 1:1 (Trigger: on_auth_user_created)
             │
             ▼
┌─────────────────────────────────────────┐
│           profiles (Public)             │
│                                         │
│  • id (UUID, PK, FK → auth.users)       │
│  • username (TEXT, UNIQUE)              │
│  • points (INTEGER, DEFAULT 0)          │
│  • avatar_config (JSONB)                │
│  • created_at (TIMESTAMP)               │
│  • updated_at (TIMESTAMP)               │
└────────────┬────────────────────────────┘
             │
             │ 1:N
             │
             ▼
┌─────────────────────────────────────────┐
│        task_history (Public)            │
│                                         │
│  • id (UUID, PK)                        │
│  • user_id (UUID, FK → profiles)        │
│  • task_type (TEXT)                     │
│  • task_description (TEXT)              │
│  • points_earned (INTEGER)              │
│  • status (TEXT)                        │
│  • created_at (TIMESTAMP)               │
└─────────────────────────────────────────┘

RLS Policies:
✅ Users can only access their own data
✅ Automatic profile creation on signup
✅ Auto-update timestamps
```

---

## WebSocket 消息协议

### 客户端 → 服务器

```json
{
  "type": "command",
  "command": "organize_files" | "clean_downloads" | "take_screenshot" | "ping"
}
```

### 服务器 → 客户端

#### 1. 进度更新
```json
{
  "type": "progress",
  "progress": 60,
  "output": "Moving files to Documents/...",
  "timestamp": "2026-02-03T10:30:45.123Z"
}
```

#### 2. 成功消息
```json
{
  "type": "success",
  "message": "Successfully organized 42 files!",
  "timestamp": "2026-02-03T10:30:48.123Z"
}
```

#### 3. 错误消息
```json
{
  "type": "error",
  "message": "Permission denied",
  "timestamp": "2026-02-03T10:30:48.123Z"
}
```

#### 4. 状态消息
```json
{
  "type": "status",
  "message": "Connected to TRIX Server",
  "timestamp": "2026-02-03T10:30:00.123Z"
}
```

---

## 安全架构

```
┌──────────────────────────────────────────────────┐
│                 SECURITY LAYERS                  │
└──────────────────────────────────────────────────┘

Layer 1: Authentication (Supabase)
├─ JWT Token (Stored in localStorage)
├─ Session Management
└─ Automatic Token Refresh

Layer 2: Authorization (RLS)
├─ Row Level Security Policies
├─ User Data Isolation
└─ SQL Injection Prevention

Layer 3: Network Security
├─ HTTPS (Supabase API)
├─ Environment Variables (.env)
└─ API Key Protection

Layer 4: WebSocket Security (Current: Local Only)
├─ Local Network Only (ws://localhost)
└─ Future: WSS + Authentication Tokens

Layer 5: Data Validation
├─ Frontend Input Validation
├─ Backend Command Validation
└─ Database Constraints
```

---

## 文件系统结构

```
trix-3d-companion/
│
├── 📁 src/
│   ├── 📁 lib/
│   │   └── supabase.ts          ⭐ Supabase 客户端初始化
│   │
│   ├── 📁 contexts/
│   │   └── AuthContext.tsx      ⭐ 全局认证状态
│   │
│   ├── 📁 hooks/
│   │   └── usePCConnection.ts   ⭐ WebSocket 连接管理
│   │
│   ├── 📁 screens/
│   │   ├── Auth.tsx             🔄 认证页面 (Supabase)
│   │   ├── Home.tsx             🔄 主页 (PC 状态)
│   │   ├── ChatDetail.tsx       🔄 聊天详情 (WebSocket)
│   │   ├── Chat.tsx
│   │   ├── Profile.tsx
│   │   ├── Study.tsx
│   │   ├── Snapshot.tsx
│   │   └── Pairing.tsx
│   │
│   ├── 📁 components/
│   │   ├── BottomNav.tsx
│   │   └── GlassPanel.tsx
│   │
│   ├── App.tsx                  🔄 根组件 (AuthProvider)
│   ├── constants.ts
│   ├── types.ts
│   └── index.tsx
│
├── 📁 public/
│
├── server.py                    ⭐ Python WebSocket 服务器
├── requirements.txt             ⭐ Python 依赖
├── .env                         ⭐ 环境变量 (不要提交!)
├── .env.example                 ⭐ 环境变量模板
│
├── 📄 IMPLEMENTATION_GUIDE.md   📖 完整实施指南
├── 📄 INTEGRATION_SUMMARY.md    📖 集成总结
├── 📄 QUICK_REFERENCE.md        📖 快速参考
├── 📄 SERVER_SETUP.md           📖 服务器设置
├── 📄 ARCHITECTURE.md           📖 本文件 - 架构文档
│
├── setup.ps1                    🚀 自动安装脚本
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 部署架构 (未来)

```
┌─────────────────────────────────────────────────────────┐
│                    PRODUCTION SETUP                     │
└─────────────────────────────────────────────────────────┘

Frontend:
├─ Vercel / Netlify (Static Hosting)
└─ CDN (Global Distribution)

Backend - Data Layer:
├─ Supabase (Managed PostgreSQL)
└─ Global Edge Network

Backend - Action Layer:
├─ Desktop App (Electron + Python Server)
├─ System Tray Integration
└─ Auto-start on Boot

Optional - Cloud Control:
├─ Cloud VM (For Remote Access)
├─ VPN / Tunneling Service
└─ WSS (WebSocket Secure)
```

---

## 性能优化

### 前端
- ✅ React.memo() for expensive components
- ✅ useMemo() / useCallback() for memoization
- ✅ Code splitting (React.lazy)
- ✅ Image optimization

### WebSocket
- ✅ Auto-reconnect with exponential backoff
- ✅ Message queuing for offline mode
- ✅ Connection pooling

### Database
- ✅ Indexed columns (id, user_id)
- ✅ RLS for security (minimal overhead)
- ✅ Connection pooling (Supabase default)

---

**Last Updated:** 2026-02-03
**Version:** 1.0.0
