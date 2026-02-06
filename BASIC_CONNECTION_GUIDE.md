# 🚀 TRIX App 基础连接启动指南

## ✅ 目标

1. **局域网访问**: 电脑和手机都能访问应用
2. **图片渲染**: 所有图片资源正常显示
3. **Bot 连接**: 成功连接到 Clawbot Gateway

---

## 📋 启动前检查清单

### 1. 环境配置 ✅

**.env 文件配置**:
```properties
VITE_PC_WEBSOCKET_URL=ws://192.168.101.4:18789
VITE_PC_AUTH_TOKEN=trix-app-mobile-access-2026-02-05-v2
VITE_SUPABASE_URL=https://__SUPABASE_PROJECT_REF_REDACTED__.supabase.co
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

### 2. 多用户功能已注释 ✅

已注释以下功能（专注于基础 Bot 连接）:
- ✅ `App.tsx` - UserSwitcher 组件
- ✅ `databaseService.ts` - 用户间消息路由
- ✅ `databaseService.ts` - 会话管理函数
- ✅ `supabase.ts` - 动态用户 ID

### 3. 网络配置

**查看电脑 IP 地址**:
```powershell
# Windows PowerShell
ipconfig | findstr "IPv4"
```

**确认当前 IP**: `192.168.101.4`

**防火墙规则** (如果需要):
```powershell
# 允许端口 5173 (Vite)
netsh advfirewall firewall add rule name="Vite Dev Server" dir=in action=allow protocol=TCP localport=5173

# 允许端口 18789 (Clawbot Gateway)
netsh advfirewall firewall add rule name="Clawbot Gateway" dir=in action=allow protocol=TCP localport=18789
```

---

## 🎯 启动步骤

### 步骤 1: 启动 Clawbot Gateway

```bash
openclaw-cn gateway
```

**验证启动成功**:
- ✅ 看到 "Gateway started on 0.0.0.0:18789"
- ✅ 访问 `http://192.168.101.4:18789` 看到 Dashboard

### 步骤 2: 启动 Vite 开发服务器

```powershell
npm run dev
```

**预期输出**:
```
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.101.4:5173/
```

### 步骤 3: 测试访问

#### 电脑访问 ✅
```
浏览器打开: http://localhost:5173/
或: http://192.168.101.4:5173/
```

#### 手机访问 ✅
```
确保手机和电脑在同一 WiFi 网络
浏览器打开: http://192.168.101.4:5173/
```

---

## 🔍 验证检查

### 1. 图片渲染检查

**测试位置**:
- Home 页面背景图
- BottomNav 图标
- Profile 头像

**验证方法**:
1. 打开浏览器开发者工具 (F12)
2. 切换到 Network 标签
3. 刷新页面
4. 检查图片资源是否成功加载 (状态码 200)

**常见问题**:
- ❌ 404 错误 → 检查图片路径
- ❌ CORS 错误 → 检查 Vite 配置
- ✅ 200 成功 → 图片正常加载

### 2. WebSocket 连接检查

**打开浏览器控制台**，应该看到:

```
🔌 启动全局连接: ws://192.168.101.4:18789
✅ WebSocket 连接已建立，等待 challenge...
📨 收到消息: {
  "event": "connect.challenge",
  "payload": {
    "nonce": "xxx-xxx-xxx",
    "ts": 1770278025767
  }
}
🎯 收到 challenge
   Nonce: xxx-xxx-xxx
   Timestamp: 1770278025767
📤 发送 challenge 响应: {...}
🟢 握手成功，连接已建立
```

**连接状态**:
- ✅ `CONNECTED` - 连接成功
- ❌ `AUTH_FAILED` - 认证失败 (检查 Token)
- ❌ `ERROR` - 连接错误 (检查 Gateway)

### 3. 发送消息测试

**测试步骤**:
1. 进入 Chat 页面
2. 点击 "TRIX 机器人"
3. 输入 "你好"
4. 发送消息

**预期日志**:
```
📤 发送消息:
   内容: 你好
   消息 ID: msg-1770278025767-abc123
📝 增量回复 (delta): 你好！
📝 增量回复 (delta): 我是
📝 增量回复 (delta): TRIX
✅ 回复完成
   总长度: 12
   完整内容: 你好！我是TRIX
```

---

## 📱 手机调试技巧

### 方法 1: Chrome Remote Debugging

1. 手机开启开发者模式
2. USB 连接电脑
3. 电脑 Chrome 访问: `chrome://inspect`
4. 选择手机设备查看控制台

### 方法 2: Eruda 调试工具

**临时添加到 `index.html`**:
```html
<script src="https://cdn.jsdelivr.net/npm/eruda"></script>
<script>eruda.init();</script>
```

在手机上打开应用，右下角会出现调试按钮。

### 方法 3: VConsole

```bash
npm install vconsole --save-dev
```

**在 `main.tsx` 中添加**:
```typescript
import VConsole from 'vconsole';
if (import.meta.env.DEV) {
  new VConsole();
}
```

---

## 🔧 常见问题排查

### 问题 1: 手机无法访问应用

**症状**: 手机浏览器打不开 `http://192.168.101.4:5173/`

**排查步骤**:
1. ✅ 确认手机和电脑在同一 WiFi
2. ✅ 电脑防火墙允许端口 5173
3. ✅ 电脑 IP 地址正确
4. ✅ Vite 配置 `host: '0.0.0.0'`

**快速测试**:
```powershell
# 电脑上测试端口是否监听
netstat -an | findstr "5173"

# 应该看到: 0.0.0.0:5173 LISTENING
```

### 问题 2: 图片无法加载

**症状**: 图片显示为空白或 404

**排查步骤**:
1. ✅ 检查图片路径（使用相对路径）
2. ✅ 检查图片文件是否存在
3. ✅ 检查浏览器 Network 标签

**正确的图片引用方式**:
```tsx
// ✅ 正确：相对路径
<img src="/assets/logo.png" />

// ✅ 正确：import 方式
import logo from '@/assets/logo.png';
<img src={logo} />

// ❌ 错误：绝对路径
<img src="file:///E:/desktop/trix-3d-companion/assets/logo.png" />
```

### 问题 3: WebSocket 连接失败

**症状**: 控制台显示 `WebSocket connection failed`

**排查步骤**:
1. ✅ Gateway 是否运行
2. ✅ IP 地址是否正确
3. ✅ 防火墙是否允许端口 18789
4. ✅ Token 是否正确

**测试 Gateway**:
```powershell
# 访问 Dashboard
curl http://192.168.101.4:18789

# 或者浏览器打开
start http://192.168.101.4:18789
```

### 问题 4: 认证失败

**症状**: 控制台显示 `❌ 认证失败: unauthorized: gateway token mismatch`

**解决方法**:
1. 检查 `.env` 中的 `VITE_PC_AUTH_TOKEN`
2. 重启 Gateway
3. 重启 Vite 开发服务器
4. 清除浏览器缓存

**获取正确的 Token**:
```bash
# 查看 Gateway 配置
openclaw-cn gateway --help

# 或查看配置文件
cat ~/.openclaw/config.json
```

---

## 📊 性能优化建议

### 1. 生产构建测试

```powershell
# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

### 2. 网络优化

- ✅ 使用局域网 IP（避免 localhost）
- ✅ 启用 HTTP/2（Vite 默认支持）
- ✅ 图片懒加载

### 3. 调试日志控制

**开发模式**: 详细日志  
**生产模式**: 最小日志

```typescript
// WebSocketContext.tsx
const DEBUG = import.meta.env.DEV;

if (DEBUG) {
  console.log('📨 收到消息:', data);
}
```

---

## 🎉 成功标志

当你看到以下所有项都 ✅ 时，说明配置成功：

- ✅ 电脑浏览器可以访问 `http://192.168.101.4:5173/`
- ✅ 手机浏览器可以访问 `http://192.168.101.4:5173/`
- ✅ 所有图片资源正常显示
- ✅ WebSocket 连接状态为 `CONNECTED`
- ✅ 可以发送消息给 Bot
- ✅ Bot 可以正常回复

---

## 📝 快速命令参考

```powershell
# 1. 启动 Gateway
openclaw-cn gateway

# 2. 启动开发服务器
npm run dev

# 3. 查看 IP 地址
ipconfig | findstr "IPv4"

# 4. 测试端口监听
netstat -an | findstr "5173"
netstat -an | findstr "18789"

# 5. 清除 npm 缓存（如果有问题）
npm cache clean --force
rm -rf node_modules
npm install
```

---

**祝你调试顺利！🚀**

如果遇到问题，请检查:
1. 浏览器控制台日志
2. Gateway 控制台输出
3. 网络连接状态
4. 防火墙设置
