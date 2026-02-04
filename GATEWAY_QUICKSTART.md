# 🎯 TRIX Gateway 快速启动指南

## ❗ 重要发现

根据项目文档,TRIX 使用 **Clawdbot Gateway** 作为 WebSocket 服务器。

---

## 🔍 当前状态

```
❌ Clawdbot Gateway 未运行 (进程 16332 已关闭)
✅ Vite 前端准备就绪 (http://192.168.101.4:3000)
✅ 配置文件已更新 (ws://192.168.101.4:18789)
```

---

## 🚀 解决方案

### 方案 A: 使用 Mock Gateway (立即测试前端)

我已经创建了一个 Mock Gateway 用于测试前端功能!

#### 1. 安装 ws 依赖
```powershell
cd E:\desktop\trix-3d-companion
npm install ws
```

#### 2. 启动 Mock Gateway
```powershell
# 新开一个 PowerShell 窗口
node mock-gateway.js
```

应该看到:
```
🚀 Starting TRIX Mock Gateway...
✅ Mock Gateway listening on 0.0.0.0:18789
   - Local:   ws://localhost:18789
   - Network: ws://192.168.101.4:18789
```

#### 3. 启动前端 (如果没运行)
```powershell
# 另一个窗口
npm run dev
```

#### 4. 测试应用
- 电脑: http://localhost:3000/
- 手机: http://192.168.101.4:3000/
- 进入 Chat → Clawdbot Gateway
- 状态应显示: 🟢 已连接
- 发送消息测试!

---

### 方案 B: 使用真实的 Clawdbot Gateway

如果你有真实的 Clawdbot Gateway:

#### 1. 找到 Gateway 安装位置

可能的位置:
- GitHub 仓库: https://github.com/search?q=clawdbot+gateway
- npm 包: `npm install -g clawdbot-gateway`
- Python 包: `pip install clawdbot-gateway`

#### 2. 修改 Gateway 配置

找到配置文件 (gateway.config.json 或类似),修改:
```json
{
  "host": "0.0.0.0",
  "port": 18789
}
```

#### 3. 启动 Gateway
```bash
clawdbot-gateway start
# 或
python -m clawdbot.gateway
```

---

## ✅ 验证连接

### 检查端口监听
```powershell
netstat -ano | Select-String "18789"
```

期望输出:
```
TCP    0.0.0.0:18789    LISTENING    <PID>  ← 正确!
```

### 测试 WebSocket (浏览器控制台)
```javascript
const ws = new WebSocket('ws://192.168.101.4:18789');
ws.onopen = () => {
  console.log('✅ Connected!');
  ws.send(JSON.stringify({ action: 'auth', token: '__PC_AUTH_TOKEN_REDACTED__' }));
};
ws.onmessage = (e) => console.log('📥', e.data);
ws.onerror = (e) => console.error('❌', e);
```

---

## 🔥 快速启动脚本

创建 `start-trix.ps1`:

```powershell
# 启动 Mock Gateway
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd E:\desktop\trix-3d-companion; node mock-gateway.js"

# 等待 2 秒
Start-Sleep -Seconds 2

# 启动 Vite
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd E:\desktop\trix-3d-companion; npm run dev"

# 等待 3 秒后打开浏览器
Start-Sleep -Seconds 3
Start-Process "http://localhost:3000/"

Write-Host "✅ TRIX 已启动!" -ForegroundColor Green
Write-Host "   - Mock Gateway: ws://192.168.101.4:18789" -ForegroundColor Cyan
Write-Host "   - Frontend:     http://192.168.101.4:3000/" -ForegroundColor Cyan
```

---

## 📋 完整步骤总结

1. **安装依赖**
   ```powershell
   npm install ws
   ```

2. **启动 Mock Gateway** (窗口 1)
   ```powershell
   node mock-gateway.js
   ```

3. **启动 Vite** (窗口 2)
   ```powershell
   npm run dev
   ```

4. **打开浏览器**
   ```
   http://localhost:3000/
   或
   http://192.168.101.4:3000/ (手机)
   ```

5. **测试连接**
   - 进入 Chat 界面
   - 看到 "Clawdbot Gateway" 卡片
   - 状态显示 🟢 已连接
   - 发送消息,应该收到 Mock 回复

---

## 🆘 需要帮助?

如果遇到问题,提供:
1. `netstat -ano | Select-String "18789"` 输出
2. Mock Gateway 终端输出
3. 浏览器控制台 (F12) 截图
