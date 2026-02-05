# 🔧 TRIX WebSocket 连接问题完整解决方案

## 🎯 问题确认

### 检测结果
```
✅ Vite 前端:  http://192.168.101.4:3000 (正常,所有设备可访问)
❌ Gateway:    ws://127.0.0.1:18789 (仅本地,手机/浏览器无法连接)
```

### 网络监听状态
```
TCP    127.0.0.1:18789    LISTENING    (仅回环地址 - 手机无法访问)
TCP    [::1]:18789        LISTENING    (IPv6 回环 - 手机无法访问)
```

### 问题原因
Gateway 当前配置只监听 `127.0.0.1:18789`,这意味着:
- ✅ 本机程序可以连接 (如本地测试工具)
- ❌ 浏览器中的 Web 应用无法连接 (跨源安全限制)
- ❌ 手机/平板无法连接 (不在同一设备)

---

## 🚀 解决方案

### 方案 A: 找到并修改 Gateway 配置 (推荐)

#### 1. 查找 Gateway 进程路径
```powershell
# 查看 Gateway 进程详情
Get-Process -Id 16332 | Format-List *

# 或者查找所有 node 进程
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Format-Table Id, Path, StartTime
```

#### 2. 常见配置文件位置
可能的配置文件名:
- `gateway.config.json`
- `clawdbot.config.json`
- `config.json`
- `.env`
- `package.json` (scripts 部分)

搜索方法:
```powershell
# 在常见目录搜索配置文件
Get-ChildItem -Path "C:\Users\$env:USERNAME" -Recurse -Include "*gateway*.json", "*clawdbot*.json", "*.config.json" -ErrorAction SilentlyContinue

# 或者搜索文件内容
Select-String -Path "C:\path\to\gateway\*.json" -Pattern "18789" -CaseSensitive
```

#### 3. 修改配置文件
找到配置文件后,修改监听地址:

**JSON 配置文件:**
```json
{
  "host": "0.0.0.0",  // ← 改为 0.0.0.0 (所有网络接口)
  "port": 18789
}
```

**或 .env 文件:**
```env
HOST=0.0.0.0
PORT=18789
```

#### 4. 重启 Gateway
```powershell
# 停止当前进程
Stop-Process -Id 16332

# 重新启动 Gateway (根据实际启动方式)
node path/to/gateway.js
# 或
npm run gateway
```

---

### 方案 B: 修改 Gateway 启动脚本

#### 1. 查找 package.json 中的启动脚本
```json
{
  "scripts": {
    "gateway": "node server.js --host 127.0.0.1 --port 18789"
  }
}
```

#### 2. 修改启动参数
```json
{
  "scripts": {
    "gateway": "node server.js --host 0.0.0.0 --port 18789"
  }
}
```

#### 3. 重启 Gateway
```powershell
npm run gateway
```

---

### 方案 C: 直接修改 Gateway 源码 (最后手段)

#### 1. 查找监听代码
```javascript
// 找到类似这样的代码
server.listen(18789, '127.0.0.1', () => {
    console.log('Gateway listening on 127.0.0.1:18789');
});
```

#### 2. 修改为监听所有接口
```javascript
// 改为
server.listen(18789, '0.0.0.0', () => {
    console.log('Gateway listening on 0.0.0.0:18789');
});
```

#### 3. 重启 Gateway

---

## ✅ 验证修复

### 1. 检查端口监听
```powershell
netstat -ano | Select-String "18789"
```

**期望输出:**
```
TCP    0.0.0.0:18789      LISTENING    <PID>  ← 这个是对的!
```

### 2. 重启 Vite 前端
```powershell
# 停止当前 Vite (Ctrl+C)
# 重新启动
npm run dev
```

### 3. 测试连接

**电脑浏览器:**
```
http://localhost:3000/
```

**手机浏览器 (连接同一 WiFi):**
```
http://192.168.101.4:3000/
```

### 4. 查看 WebSocket 连接状态

打开浏览器开发者工具 (F12):
```javascript
// 应该看到连接成功的日志
🔌 Connecting to Clawdbot Gateway: ws://192.168.101.4:18789
✅ WebSocket connected
✅ Authentication successful - Gateway ready
```

---

## 🔥 如果找不到 Gateway 配置文件

### 临时解决方案: 使用 SSH Tunnel (端口转发)

```powershell
# 使用 netsh 端口转发 (需要管理员权限)
netsh interface portproxy add v4tov4 listenport=18789 listenaddress=0.0.0.0 connectport=18789 connectaddress=127.0.0.1

# 查看规则
netsh interface portproxy show all

# 删除规则 (不需要时)
netsh interface portproxy delete v4tov4 listenport=18789 listenaddress=0.0.0.0
```

**注意:** 这只是临时方案,最好还是修改 Gateway 配置!

---

## 📋 完整检查清单

- [ ] Gateway 修改为监听 `0.0.0.0:18789`
- [ ] Gateway 已重启
- [ ] 防火墙规则已添加 (端口 18789)
- [ ] Vite 前端已重启
- [ ] `.env` 文件配置为 `ws://192.168.101.4:18789`
- [ ] 电脑浏览器可以访问 `http://localhost:3000/`
- [ ] 手机浏览器可以访问 `http://192.168.101.4:3000/`
- [ ] WebSocket 连接成功 (查看控制台日志)

---

## 🆘 还是不行?

### 提供以下信息:

1. **Gateway 进程详情:**
```powershell
Get-Process -Id 16332 | Format-List ProcessName, Path, CommandLine
```

2. **Gateway 配置文件内容:**
```powershell
# 找到配置文件后
Get-Content path\to\config.json
```

3. **端口监听详情:**
```powershell
netstat -ano | Select-String "18789"
```

4. **浏览器控制台错误信息 (F12):**
截图或复制完整错误消息

---

## 📚 相关文件

- ✅ `.env` - 已更新为 `ws://192.168.101.4:18789`
- ✅ `setup-gateway-network.ps1` - 防火墙配置脚本 (已运行)
- ⏳ Gateway 配置 - **需要你手动修改!**

---

## 🎓 技术背景

### 为什么 localhost 不行?

在网络通信中,`localhost` 和 `127.0.0.1` 是**本地回环地址**:

```
电脑浏览器访问 http://192.168.101.4:3000/
  └─ 页面加载 ✅
  └─ JavaScript 尝试连接 ws://localhost:18789
      └─ localhost = 电脑自己 ❌ (但页面来自 192.168.101.4)
      └─ 跨源安全限制 → WebSocket 连接失败

手机浏览器访问 http://192.168.101.4:3000/
  └─ 页面加载 ✅
  └─ JavaScript 尝试连接 ws://localhost:18789
      └─ localhost = 手机自己 ❌ (手机上没有运行 Gateway)
      └─ 连接失败 ERR 1006
```

### 正确的方式

```
任何设备访问 http://192.168.101.4:3000/
  └─ 页面加载 ✅
  └─ JavaScript 连接 ws://192.168.101.4:18789
      └─ 192.168.101.4 = 电脑的 IP 地址 ✅
      └─ Gateway 监听 0.0.0.0:18789 (所有网络接口)
      └─ 连接成功! 🎉
```

---

**下一步:** 找到 Gateway 配置文件,修改监听地址为 `0.0.0.0`,然后重启!
