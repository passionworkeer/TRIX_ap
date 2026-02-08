# 🚀 部署与问题解决指南

## 🛠️ Git 推送指南

### ❌ 当前错误

```
remote: Repository not found.
fatal: repository 'https://github.com/meowdoone/TRIX_ap.git/' not found
```

### 🔍 可能的原因

1. **仓库不存在** - GitHub 上没有创建 `TRIX_ap` 仓库
2. **仓库是私有的** - 需要认证才能访问
3. **仓库名称错误** - 大小写敏感

### ✅ 解决方案

#### 方案 1: 在 GitHub 创建新仓库

1. 访问：https://github.com/new
2. 仓库名称：`TRIX_ap`
3. 选择 Public 或 Private
4. **不要**勾选 "Initialize this repository with a README"
5. 点击 "Create repository"
6. 回到终端运行：
   ```powershell
   git push -u origin main
   ```

#### 方案 2: 使用 SSH 认证（推荐）

如果你已经配置了 SSH 密钥：

```powershell
# 修改远程地址为 SSH
git remote set-url origin git@github.com:meowdoone/TRIX_ap.git

# 推送
git push -u origin main
```

---

## 🔧 Hairpin NAT 问题完整解决方案

### 🔴 问题现象

- ✅ 电脑通过 `http://localhost:5173` 访问 → WebSocket 连接成功
- ❌ 电脑通过 `http://192.168.101.4:5173` 访问 → WebSocket 连接失败
- ❌ 手机通过 `http://192.168.101.4:5173` 访问 → WebSocket 连接失败

错误信息:
```
WebSocket connection to 'ws://192.168.101.4:18789/' failed
code=1006, reason=(empty)
```

### 🔍 根本原因

**Windows Hairpin NAT 限制**

当设备尝试通过自己的**公网 IP** 或**局域网 IP** 访问自己时，Windows 网络栈会阻止这种"发夹回环"连接。

```
[电脑] → 192.168.101.4:5173 → 尝试连接 ws://192.168.101.4:18789
   ↓
[Windows 内核] → "这是环回连接!" → ❌ 阻止
```

### ✅ 解决方案 1: 修改 Hosts 文件（推荐）

#### 原理
让电脑通过**域名**访问，DNS 解析到 `127.0.0.1`，避免环回限制。

---

## 🚀 多用户功能部署指南

### 📋 快速开始（5 分钟）

#### 第 1 步：更新数据库 (2分钟)

1. **访问 Supabase SQL 编辑器**:
   ```
   https://supabase.com/dashboard/project/bqzjumxfzikikgjtsckj/sql
   ```

2. **复制并执行脚本**:
   - 打开文件: `database/add_multi_user_support.sql`
   - 全选复制
   - 粘贴到 SQL 编辑器
   - 点击 "Run" 执行

3. **验证结果**:
   ```sql
   -- 检查用户表
   SELECT * FROM users;
   -- 应该看到 2 个用户

   -- 检查好友关系
   SELECT * FROM friends WHERE friend_id LIKE 'user_%';
   -- 应该看到 2 条好友关系

   -- 检查会话表
   SELECT * FROM user_sessions;
   -- 应该看到 2 个会话记录
   ```

#### 第 2 步：启动应用 (1分钟)

```powershell
# 启动前端
npm run dev
```

---

## 🖥️ TRIX App 与 Clawbot 对话核心原理及移动端部署分析

### 📡 核心通信原理

#### 1. 架构概览

```
┌──────────────────────────────────────────────────────────────┐
│                        当前架构                               │
└──────────────────────────────────────────────────────────────┘

┌──────────────┐                              ┌──────────────┐
│              │      WebSocket (ws://)       │              │
│  TRIX App    │◀────────────────────────────▶│  Clawbot     │
│  (浏览器)     │   ws://192.168.101.4:18789   │  Gateway     │
│              │                              │              │
└──────────────┘                              └──────────────┘
      ▲                                              ▲
      │                                              │
      │ HTTP (加载页面)                               │ 调用 AI 模型
      │                                              │
      ▼                                              ▼
┌──────────────┐                              ┌──────────────┐
│              │                              │              │
│  Vite Server │                              │  GLM-4.7     │
│  :3000       │                              │  (本地模型)   │
│              │                              │              │
└──────────────┘                              └──────────────┘
```

#### 2. 通信流程详解

##### 阶段 1: 加载应用
```
1. 用户访问: http://192.168.101.4:3000/
2. Vite Server 返回: index.html + React App (打包后的 JS)
3. 浏览器加载并运行 React 应用
```

##### 阶段 2: 建立 WebSocket 连接 (App 启动时)

---

## 🎯 项目交付总结

### 项目信息
- **项目名称**: TRIX - 3D Companion App
- **交付日期**: 2026年2月3日
- **版本**: v1.0.0 - Production Mode
- **架构**: 混合架构 (Cloud Data + Local Actions)

### ✅ 已完成的工作

#### 1️⃣ Supabase 集成 (数据层)

##### 创建的文件:
```
✨ src/lib/supabase.ts
✨ src/contexts/AuthContext.tsx
✨ .env.example
```

##### 数据库设计:
- ✅ `profiles` 表 - 用户资料 (username, points, avatar_config)
- ✅ `task_history` 表 - 任务历史记录
- ✅ Row Level Security (RLS) - 数据安全隔离
- ✅ 自动触发器 - 用户注册时自动创建资料

##### 功能实现:
- ✅ 用户注册 (signUp)
- ✅ 用户登录 (signIn)
- ✅ 会话管理 (自动刷新)
- ✅ 用户资料获取
- ✅ 资料更新 (updateProfile)
- ✅ 登出 (signOut)

#### 2️⃣ WebSocket 集成 (操作层)

##### 创建的文件:
...