# 🛠️ 技术问题排查指南

## 🚀 TRIX App 基础连接启动指南

### ✅ 目标

1. **局域网访问**: 电脑和手机都能访问应用
2. **图片渲染**: 所有图片资源正常显示
3. **Bot 连接**: 成功连接到 Clawbot Gateway

---

### 📋 启动前检查清单

#### 1. 环境配置 ✅

**.env 文件配置**:
```properties
VITE_PC_WEBSOCKET_URL=ws://192.168.101.4:18789
VITE_PC_AUTH_TOKEN=trix-app-mobile-access-2026-02-05-v2
VITE_SUPABASE_URL=https://bqzjumxfzikikgjtsckj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

**vite.config.ts 配置**:
```typescript
server: {
  port: 5173,
  host: '0.0.0.0',  // ✅ 允许局域网访问
  strictPort: false,
}
```

#### 2. 多用户功能已注释 ✅

已注释以下功能（专注于基础 Bot 连接）:
- ✅ `App.tsx` - UserSwitcher 组件
- ✅ `databaseService.ts` - 用户间消息路由
- ✅ `databaseService.ts` - 会话管理函数
- ✅ `supabase.ts` - 动态用户 ID

#### 3. 网络配置

---

## 🔍 浏览器控制台测试指南

### 问题分析

网络层诊断显示**一切正常**:
- ✅ TCP 连接: localhost 和 IP 都成功
- ✅ WebSocket 连接: PowerShell 测试都成功
- ✅ 防火墙: 规则已添加
- ✅ Gateway: 正常监听

**但是 React 应用可能还是连接失败!**

所以问题很可能在**应用层**:
- CORS/Origin 检查?
- WebSocket 协议参数?
- 浏览器安全策略?
- React 代码逻辑?

---

### 立即测试 (3 分钟)

#### 步骤 1: 打开 React 应用

在浏览器中打开 **任意一个**:

```
电脑: http://localhost:5173/#/chat
手机: http://192.168.101.4:5173/#/chat
```

#### 步骤 2: 打开开发者工具

按 **F12** 或右键 → 检查

#### 步骤 3: 粘贴测试代码

切换到 **Console** 标签,粘贴并运行:

```javascript
// 示例代码
```

---

## 🔧 环境变量诊断页面使用指南

### ✅ 已创建诊断页面

我已经在 TRIX App 中添加了一个**环境变量诊断页面**，可以直接在应用内检查配置。

---

### 🚀 如何访问

#### 方法 1: 直接访问 URL（推荐）

```
http://localhost:5173/#/diagnostic
```

或者

```
http://192.168.101.4:5173/#/diagnostic
```

#### 方法 2: 在浏览器控制台中跳转

```javascript
// 打开 TRIX App 后，在控制台输入：
window.location.hash = '/diagnostic'
```

---

### 📋 诊断页面功能

#### 1. 环境变量检查 ✅

显示以下环境变量的实际值：
- `VITE_PC_WEBSOCKET_URL`
- `VITE_PC_AUTH_TOKEN`
- `VITE_SUPABASE_URL`

---

## 🔐 GitHub 身份验证解决方案

### 问题诊断
仓库存在于 https://github.com/meowdoone/TRIX_ap，但无法推送。
这是因为 GitHub 需要身份验证。

### ✅ 推荐解决方案：使用 GitHub CLI（最简单）

#### 步骤 1: 安装 GitHub CLI

如果还没安装，在 PowerShell 中运行：

```powershell
winget install --id GitHub.cli
```

或者下载安装：https://cli.github.com/

#### 步骤 2: 登录 GitHub

```powershell
gh auth login
```

按照提示操作：
1. 选择 `GitHub.com`
2. 选择 `HTTPS`
3. 选择 `Login with a web browser`
4. 复制一次性代码，在浏览器中授权

#### 步骤 3: 推送代码

```powershell
git push -u origin main
```

---

### 🔑 备选方案：使用 Personal Access Token

---

## 🔧 Supabase 配置快速指南

### ❌ 常见错误：Invalid API key

如果你看到这个错误：
```
获取好友列表失败: {message: 'Invalid API key', hint: 'Double check your Supabase `anon` or `service_role` API key.'}
```

**原因**：使用了错误格式的 API Key（如 `sb_publishable_...` 开头的密钥）

### ✅ 正确的配置步骤

#### 1️⃣ 访问 Supabase 项目设置

打开浏览器，访问：
```
https://supabase.com/dashboard/project/bqzjumxfzikikgjtsckj/settings/api
```

#### 2️⃣ 找到正确的密钥

在页面上你会看到：

##### 📍 Project URL
```
https://bqzjumxfzikikgjtsckj.supabase.co
```
✅ 这个 URL 是正确的

##### 🔑 Project API keys

这里有两个密钥：

1. **anon public** ✅ 这是你需要的！
   - 格式：`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ...`
   - 特征：以 `eyJ` 开头，非常长（约 200+ 字符）
   - 用途：前端应用使用

2. **service_role** ❌ 不要用这个！