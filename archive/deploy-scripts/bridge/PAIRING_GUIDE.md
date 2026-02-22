# 📱 OpenClaw 配对功能完整指南

## 🎯 功能说明

实现手机App通过**配对码**或**二维码**与本地OpenClaw配对，类似WhatsApp Web的配对方式。

---

## 🚀 快速开始

### 步骤1: 生成配对码

在本地电脑运行：

```bash
cd e:\desktop\trix-3d-companion\bridge
node pairing-manager.js generate-code
```

**输出示例**：
```
配对码:  EXCJ76
有效期:  5分0秒
过期时间: 10:48:40
```

### 步骤2: 手机App配对

1. 打开手机App: `http://TRIX_SERVER_HOST`
2. 进入配对页面
3. 输入配对码: `EXCJ76`
4. 点击确认配对

### 步骤3: 开始使用

配对成功后，即可发送消息与OpenClaw对话！

---

## 📋 配对管理器命令

### 生成配对码

```bash
node pairing-manager.js generate-code
# 或
node pairing-manager.js code
```

### 生成二维码

```bash
node pairing-manager.js generate-qr
# 或
node pairing-manager.js qr
```

**输出示例**：
```
Token:   a1b2c3d4e5f6...
二维码:   trix://pair/a1b2c3d4e5f6...
有效期:  5分0秒
```

**生成二维码图片**：
访问在线二维码生成器：
```
https://api.qrserver.com/v1/create-qr-code/?data=trix://pair/YOUR_TOKEN
```

### 查看有效配对

```bash
node pairing-manager.js list
# 或
node pairing-manager.js l
```

---

## 🔄 完整配对流程

### 方式一: 配对码配对

```
┌─────────────┐                    ┌─────────────┐
│ 本地电脑     │                    │  手机App     │
├─────────────┤                    ├─────────────┤
│             │                    │             │
│ 运行:        │                    │ 访问:        │
│ pairing-     │ ① 显示配对码        │ http://47..  │
│ manager.js   │                    │             │
│             │                    │ ② 进入配对页  │
│ 得到:        │                    │             │
│ EXCJ76      │────────────────────→│ ③ 输入:      │
│             │                    │   EXCJ76     │
│             │                    │             │
│             │←─────────────────────│ ④ 配对成功   │
│             │                    │             │
│ 可以开始    │                    │ 可以开始    │
│ 聊天！      │                    │ 聊天！      │
└─────────────┘                    └─────────────┘
```

### 方式二: 二维码配对

```
┌─────────────┐                    ┌─────────────┐
│ 本地电脑     │                    │  手机App     │
├─────────────┤                    ├─────────────┤
│             │                    │             │
│ 运行:        │                    │ 访问:        │
│ pairing-     │ ① 生成二维码        │ http://47..  │
│ manager.js   │                    │             │
│             │                    │ ② 进入配对页  │
│ 得到:        │                    │             │
│ QR图片      │  ② 手机扫描  ───────→│ ③ 扫描二维码  │
│             │                    │             │
│             │←─────────────────────│ ④ 配对成功   │
│             │                    │             │
│ 可以开始    │                    │ 可以开始    │
│ 聊天！      │                    │ 聊天！      │
└─────────────┘                    └─────────────┘
```

---

## ⚙️ 高级用法

### 自动生成配对码（持续模式）

创建一个脚本持续生成配对码：

```bash
# watch -n 300 node pairing-manager.js generate-code
# 每5分钟自动生成新配对码
```

### 配合快捷方式

创建桌面快捷方式：

**Windows**:
```batch
@echo off
cd e:\desktop\trix-3d-companion\bridge
node pairing-manager.js generate-code
pause
```

保存为 `生成配对码.bat`

---

## 🔍 故障排查

### 问题1: 配对码无效

**原因**: 配对码已过期（5分钟有效期）

**解决**: 重新生成配对码
```bash
node pairing-manager.js generate-code
```

### 问题2: App无法连接

**检查**:
1. 本地Bridge是否运行
2. 云端Relay Server是否运行
3. 手机网络是否正常

**验证命令**:
```powershell
# 检查Bridge连接
netstat -ano | findstr "TRIX_SERVER_HOST:8765"

# 应该看到:
# TCP    10.60.x.x:xxxxx    TRIX_SERVER_HOST:8765    ESTABLISHED
```

### 问题3: 消息无响应

**检查**:
1. OpenClaw Gateway是否运行
```powershell
netstat -ano | findstr :18789
```

2. Bridge日志是否正常
查看运行Bridge的终端窗口

---

## 📊 配对状态检查

### 检查本地状态

```powershell
# 检查Bridge连接
netstat -ano | findstr "TRIX_SERVER_HOST:8765"

# 检查OpenClaw
netstat -ano | findstr :18789

# 查看配对码
node pairing-manager.js list
```

### 检查云端状态

```bash
ssh root@TRIX_SERVER_HOST "pm2 status relay-server"
```

---

## 🎯 使用场景

### 场景1: 在家使用

1. 电脑运行Bridge和OpenClaw
2. 生成配对码
3. 手机连接家里WiFi
4. 输入配对码配对
5. 开始聊天

### 场景2: 外出使用

1. 电脑运行Bridge和OpenClaw
2. 生成配对码
3. 手机使用4G/5G网络
4. 输入配对码配对
5. 开始聊天

**关键**: 只要Bridge能连接到云端Relay Server，手机在任何网络都能使用！

---

## 💡 提示

1. **配对码有效期**: 5分钟
2. **建议配对方式**: 配对码（更简单）
3. **推荐网络**: 手机和Bridge在同一网络时速度最快
4. **多设备**: 可以同时多个手机配对到同一个OpenClaw

---

## 📞 快速命令参考

```bash
# 生成配对码
node pairing-manager.js generate-code

# 生成二维码
node pairing-manager.js generate-qr

# 查看有效配对
node pairing-manager.js list

# 检查Bridge状态
netstat -ano | findstr "TRIX_SERVER_HOST:8765"

# 检查OpenClaw状态
netstat -ano | findstr :18789
```

---

**现在可以开始配对了！** 🚀

运行 `node pairing-manager.js generate-code` 生成配对码，然后在手机App中输入即可！
