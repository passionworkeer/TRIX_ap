# 🛠️ TRIX 项目指南

## 📖 项目概览

### 项目信息
- **项目名称**: TRIX - 3D Companion App
- **交付日期**: 2026年2月3日
- **版本**: v1.0.0 - Production Mode
- **架构**: 混合架构 (Cloud Data + Local Actions)

---

### 核心功能

#### 已实现 ✅
- ✅ 用户注册/登录 (Supabase Auth)
- ✅ 实时 PC 连接状态显示
- ✅ WebSocket 双向通信
- ✅ 命令发送与执行
- ✅ 实时进度反馈
- ✅ 任务状态追踪

#### 开发中 🚧
- 🚧 用户资料管理
- 🚧 积分系统
- 🚧 任务历史记录
- 🚧 OpenClaw 真实现集成

---

## 🚀 快速启动指南

### 启动项目

```bash
cd E:\desktop\trix-3d-companion
npm run dev
```

浏览器打开: http://localhost:5173

---

### 功能演示路径

#### 1️⃣ 聊天历史记录 (Chat History)

**测试步骤:**
1. 点击右下角紫色聊天气泡 → 进入 Clawbot 对话
2. 发送几条消息（例如：“你好”、“帮我解释一下算法”）
3. 刷新页面 (F5)
4. ✅ **验证**: 之前的对话完整保留！

**也可以测试好友聊天:**
1. 底部导航 → 点击"聊天"图标
2. 点击任意好友 (例如：爱丽丝)
3. 发送消息
4. 返回后再进入 → 历史记录保留

---

#### 2️⃣ 项目进度管理 (Project Progress)

**查看项目:**
1. 在 **Home 首页** 向下滚动
2. 看到 **"数据结构课程设计"** 卡片
3. 显示: 
   - 50% 进度条（带流光动画）
   - 已完成 5 / 待完成 5 / 高优先级 2

---

## 🏗️ 项目架构

### 前端
- **React** 18 + TypeScript
- **Vite** - 构建工具
- **TailwindCSS** - 样式
- **React Router** - 路由
- **Supabase Client** - 数据库客户端

### 后端
- **Python** 3.x
- **WebSockets** - 实时通信

---

## 📋 核心原则

### 当前工作原理（一句话版本）

**你的电脑上运行 Clawbot Gateway → 浏览器通过 WebSocket 连接 Gateway → 实时接收 AI 流式回复。**

---

### 技术栈

```
前端:
- React + TypeScript
- Vite (开发服务器)
- WebSocket API (原生支持)

后端:
- Clawbot Gateway (Python)
- GLM-4.7 本地模型
- WebSocket 协议
```

---

### 🌐 通信流程 (5 步)

#### 1️⃣ 用户打开应用
```
浏览器访问: http://192.168.101.4:3000/
Vite 返回: React App (HTML + JS)
```

#### 2️⃣ App 自动连接 Gateway
```typescript
// WebSocketContext.tsx (App 启动时执行)
const socket = new WebSocket('ws://192.168.101.4:18789');

socket.send({
  method: 'connect',
  params: {
    // ...
  }
});
```

---

## 🔍 下一步计划

### 测试结果总结

#### 网络层测试 ✅ 全部通过

| 测试项 | localhost | 局域网 IP | 结论 |
|--------|-----------|-----------|------|
| 连接成功 | ✅ 316ms | ✅ 10ms | 都能连接 |
| 认证成功 | ✅ | ✅ | 都能认证 |
| 消息发送 | ✅ 62条 | ✅ 61条 | 都能通信 |
| AI 回复 | ✅ | ✅ | 都能收到 |

**结论**: 网络层面没有任何问题！局域网 IP 连接甚至更快！（10ms vs 316ms）

---

### 问题定位

既然纯 WebSocket 测试都成功，但 TRIX App 只能用 localhost 连接，问题必定在于：

#### 1. **环境变量加载问题** ⭐ 最可能

**现象**: 
- 测试工具使用硬编码的 URL 和 Token → 成功 ✅
- TRIX App 使用 `import.meta.env` → 可能读取失败 ❌

**检查方法**: 打开 `check-env.html` 验证环境变量

#### 2. **浏览器缓存问题**

**现象**:
- 旧的 localhost 配置被缓存
- 新的局域网 IP 配置未生效

**检查方法**: 清除缓存 + 硬刷新 (Ctrl+Shift+R)

#### 3. **代码中的硬编码**

**现象**:
- ...