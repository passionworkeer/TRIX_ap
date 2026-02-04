# 🔧 Gateway 网络访问配置指南

## 问题诊断

### 当前状态
```
✅ Vite 前端: http://192.168.101.4:3000 (所有网络接口)
⚠️ Gateway:   ws://127.0.0.1:18789 (仅本地回环)
```

### 网络监听详情
```powershell
# Gateway 当前监听:
TCP    127.0.0.1:18789        LISTENING       (仅本机可访问)
TCP    [::1]:18789            LISTENING       (仅本机可访问 IPv6)

# Vite 服务器监听:
TCP    0.0.0.0:3000          LISTENING       (所有网络接口)
```

---

## 🎯 方案选择

### 方案 A: 前端本地访问 Gateway (当前已应用)

**适用场景:** 
- 前端和 Gateway 都在同一台电脑上运行
- 只需要本机测试,不需要手机/其他设备访问

**配置:**
```env
# .env 文件
VITE_PC_WEBSOCKET_URL=ws://localhost:18789
```

**优点:**
- ✅ 无需修改 Gateway 配置
- ✅ 更安全 (不暴露到局域网)
- ✅ 立即生效

**缺点:**
- ❌ 手机无法直接连接 Gateway
- ❌ 需要在同一台电脑上运行前端和后端

---

### 方案 B: 让 Gateway 监听所有网络接口 (推荐用于移动端测试)

**适用场景:**
- 需要手机通过 WiFi 连接 Gateway
- 多设备测试场景

**步骤:**

#### 1. 找到 Gateway 配置文件
通常是:
- `clawdbot.config.json`
- `gateway.config.json`
- 或者命令行启动参数

#### 2. 修改监听地址
将监听地址从 `127.0.0.1` 改为 `0.0.0.0`:

```json
{
  "host": "0.0.0.0",  // 或 "192.168.101.4"
  "port": 18789
}
```

或命令行参数:
```bash
clawdbot-gateway --host 0.0.0.0 --port 18789
```

#### 3. 配置防火墙
```powershell
# 添加 18789 端口规则
New-NetFirewallRule -DisplayName "Clawdbot Gateway" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 18789 `
    -Action Allow `
    -Profile Any `
    -Enabled True
```

#### 4. 更新前端配置
```env
# .env 文件
VITE_PC_WEBSOCKET_URL=ws://192.168.101.4:18789
```

#### 5. 重启 Gateway 和前端
```powershell
# 重启 Gateway (根据实际情况)
# 然后重启 Vite
npm run dev
```

**优点:**
- ✅ 手机可以直接连接
- ✅ 支持多设备测试
- ✅ 更符合实际使用场景

**缺点:**
- ⚠️ 需要修改 Gateway 配置
- ⚠️ 安全性稍低 (局域网内可访问)

---

## 🚀 快速测试

### 验证前端是否正常
```bash
# 1. 访问测试页面
http://localhost:3000/test.html

# 2. 打开浏览器控制台 (F12)
# 3. 查看是否有 WebSocket 连接错误
```

### 验证 Gateway 连接
```powershell
# 检查端口监听
netstat -ano | Select-String "18789"

# 应该看到:
# TCP    127.0.0.1:18789   (方案 A)
# 或
# TCP    0.0.0.0:18789     (方案 B)
```

### 测试 WebSocket 连接
在浏览器控制台 (F12) 运行:
```javascript
const ws = new WebSocket('ws://localhost:18789');
ws.onopen = () => console.log('✅ Gateway 连接成功!');
ws.onerror = (e) => console.error('❌ Gateway 连接失败:', e);
```

---

## 📱 移动端测试 (方案 B 才需要)

### 1. 确保手机和电脑在同一 WiFi
```
电脑 IP: 192.168.101.4
手机:    自动获取 (同网段)
```

### 2. 在手机浏览器访问
```
http://192.168.101.4:3000/test.html
```

### 3. 测试 Gateway 连接
在手机浏览器控制台运行:
```javascript
const ws = new WebSocket('ws://192.168.101.4:18789');
ws.onopen = () => alert('Gateway 连接成功!');
ws.onerror = (e) => alert('Gateway 连接失败');
```

---

## 🔍 常见问题

### Q: 浏览器显示 "WebSocket error 1006"
**A:** Gateway 未启动或监听地址不对
```powershell
# 检查 Gateway 进程
Get-Process | Where-Object {$_.ProcessName -like "*clawdbot*"}

# 检查端口
netstat -ano | Select-String "18789"
```

### Q: 前端可以访问,但 WebSocket 连接失败
**A:** 检查 `.env` 配置是否正确
```bash
# 重启 Vite 服务器使环境变量生效
npm run dev
```

### Q: 手机无法连接 Gateway (方案 B)
**A:** 检查防火墙规则
```powershell
# 查看规则
Get-NetFirewallRule -DisplayName "Clawdbot Gateway"

# 如果不存在,添加规则
New-NetFirewallRule -DisplayName "Clawdbot Gateway" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 18789 `
    -Action Allow
```

---

## ✅ 当前配置总结

**已完成:**
- ✅ `.env` 已更新为 `ws://localhost:18789` (方案 A)
- ✅ Vite 运行在 `:3000` 端口,所有网络接口
- ✅ 防火墙已配置 3000 端口入站规则

**下一步:**
1. **刷新浏览器** - 访问 `http://localhost:3000/test.html`
2. **查看控制台** - 确认没有 WebSocket 错误
3. **如需移动端测试** - 参考上述"方案 B"配置 Gateway

---

## 📞 需要帮助?

如果还有问题,提供以下信息:
1. 浏览器控制台 (F12) 的完整错误信息
2. Gateway 启动日志
3. `netstat -ano | Select-String "18789"` 输出结果
