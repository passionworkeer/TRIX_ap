# 🔍 WebSocket 连接诊断指南

## 问题描述

- ✅ **localhost 可以连接**: `ws://localhost:18789` 工作正常
- ❌ **局域网 IP 无法连接**: `ws://192.168.101.4:18789` 连接失败

---

## 📋 诊断工具

### 1. 浏览器测试工具（推荐）

```bash
# 在浏览器中打开
websocket-test.html
```

**功能**:
- ✅ 并排对比 localhost vs 局域网 IP
- ✅ 实时日志输出
- ✅ 连接时间统计
- ✅ 消息发送测试
- ✅ Challenge 认证流程展示

**使用方法**:
1. 双击 `websocket-test.html` 在浏览器打开
2. 点击 "连接测试" 按钮（分别测试 localhost 和局域网 IP）
3. 查看实时日志和连接统计
4. 对比两者的连接时间和日志差异

### 2. PowerShell 诊断脚本

```powershell
# 运行完整诊断
.\test-websocket-connection.ps1
```

**检查项目**:
- ✅ 端口监听状态
- ✅ TCP 连通性
- ✅ HTTP 连接
- ✅ 防火墙规则
- ✅ 网络接口信息

---

## 🔍 可能的原因

### 1. Gateway 绑定地址问题

**检查 Gateway 启动日志**:
```bash
openclaw-cn gateway
```

**应该看到**:
```
Gateway started on 0.0.0.0:18789  ✅
```

**而不是**:
```
Gateway started on 127.0.0.1:18789  ❌
```

### 2. 防火墙规则

**检查防火墙**:
```powershell
netstat -an | findstr "18789"
```

**添加防火墙规则**:
```powershell
netsh advfirewall firewall add rule name="Clawbot Gateway" dir=in action=allow protocol=TCP localport=18789
```

### 3. 网络路由问题

**查看路由表**:
```powershell
route print
```

**检查是否有特殊路由策略**:
- localhost (127.0.0.1) 通常有特殊路由
- 局域网 IP 需要经过网关

### 4. 客户端连接配置

**检查 WebSocketContext.tsx**:
```typescript
// 当前配置
const WS_URL = import.meta.env.VITE_PC_WEBSOCKET_URL;
// ws://192.168.101.4:18789

// 尝试临时改为 localhost 测试
// ws://localhost:18789
```

---

## 🧪 测试步骤

### 步骤 1: 确认 Gateway 配置

```bash
# 1. 停止现有 Gateway
Ctrl+C

# 2. 重新启动，观察绑定地址
openclaw-cn gateway

# 3. 查看启动日志
# 应该看到: "Gateway started on 0.0.0.0:18789"
```

### 步骤 2: 运行 PowerShell 诊断

```powershell
.\test-websocket-connection.ps1
```

**检查输出**:
- ✅ 端口监听: `0.0.0.0:18789 LISTENING`
- ✅ TCP 测试: localhost ✅, 局域网 IP ✅
- ✅ HTTP 测试: localhost ✅, 局域网 IP ✅

### 步骤 3: 浏览器测试工具

1. 打开 `websocket-test.html`
2. 点击 "localhost 连接"
3. 观察日志：
   ```
   ✅ WebSocket 连接成功！耗时: XXms
   🎯 收到 challenge
   📤 发送 challenge 响应
   🟢 认证成功！
   ```
4. 点击 "局域网 IP 连接"
5. 对比日志差异

### 步骤 4: 对比分析

**如果 localhost 成功，局域网 IP 失败**:

#### 情况 A: 连接超时
```
❌ WebSocket 错误: timeout
```
**可能原因**: 防火墙阻止

**解决方法**:
```powershell
netsh advfirewall firewall add rule name="Clawbot Gateway" dir=in action=allow protocol=TCP localport=18789
```

#### 情况 B: 连接被拒绝
```
❌ WebSocket 错误: connection refused
```
**可能原因**: Gateway 只监听 127.0.0.1

**解决方法**: 检查 Gateway 配置，确保监听 0.0.0.0

#### 情况 C: 认证失败
```
🎯 收到 challenge
❌ 认证失败: unauthorized: gateway token mismatch
```
**可能原因**: Token 不一致

**解决方法**: 检查 .env 中的 VITE_PC_AUTH_TOKEN

---

## 💡 快速修复方案

### 方案 1: 临时使用 localhost（快速）

**修改 .env**:
```properties
# 临时改为 localhost
VITE_PC_WEBSOCKET_URL=ws://localhost:18789
```

**限制**: 只能在电脑上使用，手机无法访问

### 方案 2: 添加防火墙规则（推荐）

```powershell
# 允许入站连接
netsh advfirewall firewall add rule name="Clawbot Gateway" dir=in action=allow protocol=TCP localport=18789

# 验证规则
netsh advfirewall firewall show rule name="Clawbot Gateway"
```

### 方案 3: 检查 Gateway 绑定

**查看 Gateway 配置文件**:
```bash
# Windows
cat %USERPROFILE%\.openclaw\config.json

# 或
cat ~/.openclaw/config.json
```

**确保配置**:
```json
{
  "gateway": {
    "host": "0.0.0.0",  // ← 应该是这个
    "port": 18789
  }
}
```

---

## 📊 诊断报告模板

运行测试后，请提供以下信息：

```
1. Gateway 启动日志:
   [粘贴启动日志]

2. 端口监听状态:
   netstat -an | findstr "18789"
   [粘贴输出]

3. localhost 测试结果:
   连接耗时: ___ms
   认证状态: 成功/失败
   错误信息: ___

4. 局域网 IP 测试结果:
   连接耗时: ___ms
   认证状态: 成功/失败
   错误信息: ___

5. 浏览器控制台日志:
   [粘贴关键日志]
```

---

## 🎯 下一步

1. **运行诊断脚本**:
   ```powershell
   .\test-websocket-connection.ps1
   ```

2. **打开浏览器测试工具**:
   - 双击 `websocket-test.html`
   - 分别测试 localhost 和局域网 IP
   - 截图保存日志

3. **提供诊断报告**:
   - 根据上面的模板整理结果
   - 重点关注两者的差异

---

## 🔧 常见问题

### Q1: 为什么 localhost 可以但局域网 IP 不行？

**A**: 可能原因：
1. Gateway 只监听 127.0.0.1（回环地址）
2. 防火墙阻止外部连接
3. 网络路由策略不同

### Q2: 如何确认 Gateway 监听地址？

**A**: 
```powershell
netstat -an | findstr "18789"

# 应该看到:
# TCP    0.0.0.0:18789    0.0.0.0:0    LISTENING  ✅

# 而不是:
# TCP    127.0.0.1:18789  0.0.0.0:0    LISTENING  ❌
```

### Q3: 防火墙规则添加后还是不行？

**A**: 
1. 重启 Gateway
2. 重启浏览器
3. 清除浏览器缓存
4. 检查是否有其他安全软件拦截

---

**祝调试顺利！🚀**
