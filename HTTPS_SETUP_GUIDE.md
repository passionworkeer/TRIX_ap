# 🔐 手机访问相机功能 - HTTPS 配置指南

## ❗ 问题说明

浏览器出于安全考虑，**只允许在以下情况访问相机**：
- ✅ `https://` (HTTPS 协议)
- ✅ `localhost` (本地访问)
- ❌ `http://192.168.x.x` (局域网 HTTP) - **不允许！**

所以当你用手机通过局域网 IP 访问时，会报错：
```
Cannot read properties of undefined (reading 'getUserMedia')
```

---

## 🎯 解决方案（3 种）

### 方案 1：使用 ngrok（推荐，最简单）

**步骤：**

1. **安装 ngrok**
```bash
# macOS
brew install ngrok

# Windows (使用 Chocolatey)
choco install ngrok

# 或直接下载
# https://ngrok.com/download
```

2. **注册并获取 authtoken**
```bash
# 访问 https://dashboard.ngrok.com/get-started/your-authtoken
# 复制 authtoken

ngrok config add-authtoken <your_token>
```

3. **启动 TRIX 开发服务器**
```bash
npm run dev
# 运行在 http://localhost:5173
```

4. **启动 ngrok 隧道**
```bash
ngrok http 5173
```

5. **获取 HTTPS 地址**
```
Forwarding  https://abc123.ngrok.io -> http://localhost:5173
```

6. **在手机上访问**
```
https://abc123.ngrok.io
```

✅ **优点**：
- 自动配置 HTTPS 证书
- 全球可访问
- 免费版够用

❌ **缺点**：
- 需要联网
- 免费版每次启动 URL 会变

---

### 方案 2：生成自签名证书（局域网）

**步骤：**

1. **安装 mkcert**
```bash
# macOS
brew install mkcert
brew install nss  # Firefox 支持

# Windows
choco install mkcert

# 初始化
mkcert -install
```

2. **生成证书**
```bash
cd e:\desktop\trix-3d-companion

# 生成本地证书
mkcert localhost 192.168.101.4 127.0.0.1 ::1

# 会生成两个文件:
# - localhost+3.pem (证书)
# - localhost+3-key.pem (私钥)
```

3. **配置 Vite 使用 HTTPS**

修改 `vite.config.ts`:
```typescript
import fs from 'fs';

export default defineConfig(({ mode }) => {
  return {
    server: {
      host: '0.0.0.0',
      https: {
        key: fs.readFileSync('./localhost+3-key.pem'),
        cert: fs.readFileSync('./localhost+3.pem'),
      },
      // ...其他配置
    },
    // ...
  };
});
```

4. **启动服务器**
```bash
npm run dev
```

5. **在手机上访问**
```
https://192.168.101.4:5173
```

✅ **优点**：
- 局域网访问
- 不需要外网
- 证书稳定

❌ **缺点**：
- 需要手动配置
- 手机需要信任证书

---

### 方案 3：使用手动输入配对码（无需相机）

如果不想配置 HTTPS，可以不用扫码功能：

**步骤：**

1. 在配对页面点击 **"手动输入配对码"**
2. 从电脑端复制 JSON 配对码
3. 粘贴到手机输入框
4. 点击"使用配对码连接"

✅ **优点**：
- 无需 HTTPS
- 无需相机权限
- 兼容所有环境

❌ **缺点**：
- 需要手动复制粘贴
- 体验不如扫码

---

## 🚀 推荐方案对比

| 方案 | 难度 | 体验 | 适用场景 |
|------|------|------|----------|
| **ngrok** | ⭐ 简单 | ⭐⭐⭐ 最好 | 快速测试、演示 |
| **自签名证书** | ⭐⭐ 中等 | ⭐⭐ 好 | 局域网长期开发 |
| **手动输入** | ⭐ 简单 | ⭐ 一般 | 应急、兼容性优先 |

---

## 📝 方案 1 详细操作（ngrok）

### 1. 安装 ngrok

**Windows:**
```powershell
# 使用 Chocolatey
choco install ngrok

# 或下载 exe
# https://ngrok.com/download
# 解压后放到 PATH 路径
```

**macOS:**
```bash
brew install ngrok
```

### 2. 配置 authtoken

```bash
# 注册 ngrok (免费)
# https://dashboard.ngrok.com/signup

# 获取 token
# https://dashboard.ngrok.com/get-started/your-authtoken

# 配置
ngrok config add-authtoken 你的token
```

### 3. 启动服务

**终端 1 - 启动 TRIX:**
```bash
cd e:\desktop\trix-3d-companion
npm run dev
```

**终端 2 - 启动 ngrok:**
```bash
ngrok http 5173
```

**输出示例:**
```
Session Status  online
Account         你的账号 (Plan: Free)
Forwarding      https://abc123-xyz.ngrok.io -> http://localhost:5173
```

### 4. 手机访问

在手机浏览器打开：
```
https://abc123-xyz.ngrok.io
```

✅ **现在可以使用相机扫码了！**

---

## 📝 方案 2 详细操作（mkcert）

### 1. 安装 mkcert

```bash
# macOS
brew install mkcert nss

# Windows
choco install mkcert

# 初始化本地 CA
mkcert -install
```

### 2. 生成证书

```bash
cd e:\desktop\trix-3d-companion

# 获取你的局域网 IP
# Windows: ipconfig
# macOS: ifconfig | grep "inet "

# 生成证书（替换为你的 IP）
mkcert localhost 192.168.101.4 127.0.0.1 ::1
```

**生成的文件:**
```
localhost+3.pem         # 证书
localhost+3-key.pem     # 私钥
```

### 3. 修改 vite.config.ts

```typescript
import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  return {
    server: {
      host: '0.0.0.0',
      https: {
        key: fs.readFileSync(path.resolve(__dirname, 'localhost+3-key.pem')),
        cert: fs.readFileSync(path.resolve(__dirname, 'localhost+3.pem')),
      },
      proxy: {
        '/gateway': {
          target: 'ws://127.0.0.1:18789',
          ws: true,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/gateway/, ''),
        },
      },
    },
    // ...其他配置
  };
});
```

### 4. 启动服务器

```bash
npm run dev
```

**输出:**
```
VITE ready in 500 ms

➜  Local:   https://localhost:5173/
➜  Network: https://192.168.101.4:5173/
```

### 5. 手机访问

```
https://192.168.101.4:5173
```

**首次访问可能需要：**
1. 点击"高级"
2. 点击"继续访问"
3. 或者在手机上安装 mkcert 根证书

---

## 🐛 常见问题

### 1. ngrok 显示 "Tunnel not found"

**原因:** 免费版 ngrok 会话过期

**解决:**
```bash
# 重新启动 ngrok
ngrok http 5173
```

### 2. 自签名证书手机不信任

**解决（iOS）:**
1. 设置 → 通用 → 关于本机
2. 证书信任设置
3. 启用 mkcert 根证书

**解决（Android）:**
1. 设置 → 安全 → 加密与凭据
2. 从存储设备安装
3. 选择证书文件

### 3. 相机还是无法使用

**检查:**
```javascript
// 在浏览器控制台运行
console.log(window.isSecureContext);  // 应该返回 true
console.log(navigator.mediaDevices);  // 应该有对象，不是 undefined
```

---

## ✅ 快速决策

**如果你只是想快速测试：**
→ 使用 **ngrok**（5 分钟搞定）

**如果你需要长期开发：**
→ 使用 **mkcert**（一次配置，永久使用）

**如果你不想配置任何东西：**
→ 使用 **手动输入配对码**

---

## 📞 获取帮助

遇到问题？
- GitHub Issues
- 查看浏览器控制台错误
- 确认 `window.isSecureContext === true`

---

**配置完成后，扫码功能就可以正常使用了！** 🎉
