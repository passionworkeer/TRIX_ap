# 🚀 TRIX 完整启动指南

## 📋 架构说明

TRIX 项目有 **3 个独立的部分**:

```
┌─────────────────────────────────────────────────────────┐
│                    TRIX 完整架构                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1️⃣ 前端 (必须) - Vite + React                          │
│     端口: 3000                                           │
│     作用: 用户界面 (登录、聊天、拍照等)                    │
│     启动: npm run dev                                    │
│                                                         │
│  2️⃣ Python 后端 (可选) - WebSocket 服务器                │
│     端口: 8765                                           │
│     作用: 旧版本的 PC 控制,已被 Clawdbot Gateway 替代     │
│     启动: python server.py                               │
│     状态: ⚠️ 已废弃,不需要启动                           │
│                                                         │
│  3️⃣ Clawdbot Gateway (必须) - AI 控制网关                │
│     端口: 18789                                          │
│     作用: 真实的 PC 控制 + AI 对话                        │
│     启动: ❓ 需要找到真实的 Gateway 程序                  │
│     替代: 🧪 可以用 Mock Gateway 测试                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 你的问题回答

### ❓ 需要启动哪些服务?

根据你的需求,有两种方案:

### 方案 A: 完整功能 (需要真实 Clawdbot Gateway)

```
需要启动:
  ✅ 前端 Vite (npm run dev) - 端口 3000
  ✅ Clawdbot Gateway - 端口 18789
  ❌ server.py - 不需要 (已被 Gateway 替代)
```

**启动顺序:**
1. 先启动 Clawdbot Gateway (监听 18789)
2. 再启动 Vite 前端 (监听 3000)

---

### 方案 B: 测试前端功能 (使用 Mock Gateway)

```
需要启动:
  ✅ 前端 Vite (npm run dev) - 端口 3000
  ✅ Mock Gateway (node mock-gateway.js) - 端口 18789
  ❌ server.py - 不需要
  ❌ 真实 Gateway - 暂时不需要
```

**启动顺序:**
1. 启动 Mock Gateway (模拟 AI 回复)
2. 启动 Vite 前端

---

## 🚀 方案 B 快速启动 (推荐先测试这个)

### 窗口 1 - 启动 Mock Gateway

```powershell
cd E:\desktop\trix-3d-companion
node mock-gateway.js
```

**期望输出:**
```
🚀 Starting TRIX Mock Gateway...
✅ Mock Gateway listening on 0.0.0.0:18789
   - Local:   ws://localhost:18789
   - Network: ws://192.168.101.4:18789
```

### 窗口 2 - 启动前端

```powershell
cd E:\desktop\trix-3d-companion
npm run dev
```

**期望输出:**
```
VITE v6.4.1  ready in 364 ms
➜  Local:   http://localhost:3000/
➜  Network: http://192.168.101.4:3000/
```

### 浏览器测试

```
http://localhost:3000/
```

1. 登录账号
2. 进入 Chat → Clawdbot Gateway
3. 状态应显示: 🟢 已连接
4. 发送消息,收到 Mock 回复

---

## 🔍 关于 Clawdbot Gateway

### 真实的 Gateway 在哪里?

根据你之前运行的进程 (PID 16332),真实的 Gateway 已经在运行过。但我们没找到:
- ✅ 启动脚本
- ✅ 配置文件
- ✅ 可执行文件路径

### 可能的位置

1. **npm 全局包**
   ```powershell
   npm list -g | Select-String "clawdbot|gateway"
   ```

2. **Python 包**
   ```powershell
   pip list | Select-String "clawdbot|gateway"
   ```

3. **独立程序**
   - 桌面应用
   - 系统服务
   - 任务计划程序

4. **GitHub 仓库**
   - 可能克隆在某个目录

### 如何找到它?

运行这个命令:
```powershell
# 搜索最近运行的 node 进程
Get-WinEvent -FilterHashtable @{LogName='Application'; ID=1000} -MaxEvents 100 | 
  Where-Object {$_.Message -like "*node*" -or $_.Message -like "*gateway*"} | 
  Select-Object TimeCreated, Message
```

或者:
```powershell
# 搜索所有可能的目录
Get-ChildItem -Path "C:\", "E:\" -Recurse -Include "*gateway*.exe", "*clawdbot*.exe" -ErrorAction SilentlyContinue | Select-Object FullName
```

---

## 📝 一键启动脚本

创建 `start-trix-test.ps1`:

```powershell
# TRIX 测试启动脚本
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  启动 TRIX 测试环境" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查依赖
Write-Host "检查依赖..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "安装 npm 依赖..." -ForegroundColor Yellow
    npm install
}

# 启动 Mock Gateway
Write-Host ""
Write-Host "启动 Mock Gateway (端口 18789)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; node mock-gateway.js"

# 等待 Gateway 启动
Start-Sleep -Seconds 2

# 启动 Vite
Write-Host "启动 Vite 前端 (端口 3000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev"

# 等待 Vite 启动
Start-Sleep -Seconds 3

# 打开浏览器
Write-Host "打开浏览器..." -ForegroundColor Green
Start-Process "http://localhost:3000/"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TRIX 已启动!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "访问地址:" -ForegroundColor Cyan
Write-Host "  电脑: http://localhost:3000/" -ForegroundColor White
Write-Host "  手机: http://192.168.101.4:3000/" -ForegroundColor White
Write-Host ""
Write-Host "WebSocket:" -ForegroundColor Cyan
Write-Host "  Mock Gateway: ws://192.168.101.4:18789" -ForegroundColor White
Write-Host ""
Write-Host "提示:" -ForegroundColor Yellow
Write-Host "  - 这是测试环境,使用 Mock Gateway" -ForegroundColor Gray
Write-Host "  - 若要使用真实 AI,需要启动 Clawdbot Gateway" -ForegroundColor Gray
```

---

## ✅ 验证清单

启动后检查:

### 1. Mock Gateway
```powershell
netstat -ano | Select-String ":18789"
```
应该看到:
```
TCP    0.0.0.0:18789    LISTENING
```

### 2. Vite 前端
```powershell
netstat -ano | Select-String ":3000"
```
应该看到:
```
TCP    0.0.0.0:3000    LISTENING
```

### 3. 浏览器测试
- ✅ 能打开 http://localhost:3000/
- ✅ 能登录账号
- ✅ Chat 界面显示 🟢 已连接
- ✅ 能发送消息并收到回复

---

## 🔧 故障排除

### 问题: Mock Gateway 无法启动

**错误:** `require is not defined`
**解决:** 已修复,使用 ES 模块语法

### 问题: 端口被占用

```powershell
# 清理所有进程
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force
```

### 问题: 前端无法连接 Gateway

检查 `.env` 配置:
```env
VITE_PC_WEBSOCKET_URL=ws://192.168.101.4:18789
```

重启 Vite 使配置生效。

---

## 📞 下一步

1. **先测试方案 B** (Mock Gateway)
   - 确保前端功能正常
   - 确保 WebSocket 连接正常

2. **找到真实 Gateway**
   - 查看进程历史
   - 搜索可执行文件
   - 检查 GitHub 仓库

3. **切换到真实 Gateway**
   - 修改 Gateway 监听地址为 `0.0.0.0`
   - 重启 Gateway
   - 测试真实 AI 功能

---

**现在运行:** `.\start-trix-test.ps1` 或手动启动两个窗口!
