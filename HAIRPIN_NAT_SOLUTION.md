# Hairpin NAT 问题完整解决方案

## 🔴 问题现象

- ✅ 电脑通过 `http://localhost:5173` 访问 → WebSocket 连接成功
- ❌ 电脑通过 `http://192.168.101.4:5173` 访问 → WebSocket 连接失败
- ❌ 手机通过 `http://192.168.101.4:5173` 访问 → WebSocket 连接失败

错误信息:
```
WebSocket connection to 'ws://192.168.101.4:18789/' failed
code=1006, reason=(empty)
```

---

## 🔍 根本原因

**Windows Hairpin NAT 限制**

当设备尝试通过自己的**公网 IP** 或**局域网 IP** 访问自己时,Windows 网络栈会阻止这种"发夹回环"连接。

```
[电脑] → 192.168.101.4:5173 → 尝试连接 ws://192.168.101.4:18789
   ↓
[Windows 内核] → "这是环回连接!" → ❌ 阻止
```

但是:
- `localhost` → `localhost`: ✅ 允许 (本地回环)
- `外部设备` → `192.168.101.4`: ✅ 允许 (真正的外部连接)
- `192.168.101.4` → `192.168.101.4`: ❌ **阻止** (Hairpin NAT)

---

## ✅ 解决方案 1: 修改 Hosts 文件 (推荐)

### 原理
让电脑通过**域名**访问,DNS 解析到 `127.0.0.1`,避开环回限制。

### 步骤

1. **以管理员身份运行 PowerShell**
   ```powershell
   .\setup-hosts.ps1
   ```

2. **脚本会自动**:
   - 备份 hosts 文件
   - 添加: `127.0.0.1  trix.local`
   - 刷新 DNS 缓存

3. **访问方式**:
   - 电脑: `http://trix.local:5173` → WebSocket: `ws://localhost:18789` ✅
   - 手机: `http://192.168.101.4:5173` → WebSocket: `ws://192.168.101.4:18789` ✅

### 优点
- ✅ 简单可靠
- ✅ 不影响系统安全
- ✅ 易于撤销 (删除 hosts 条目)

### 缺点
- ⚠️ 需要管理员权限
- ⚠️ 电脑和手机访问地址不同

---

## ✅ 解决方案 2: 启用弱主机模型

### 原理
Windows 默认使用"强主机模型",禁用环回连接。启用"弱主机模型"可以允许。

### 步骤

1. **以管理员身份运行 PowerShell**

2. **查看当前网卡**:
   ```powershell
   Get-NetIPInterface -AddressFamily IPv4
   ```

3. **启用弱主机模型** (替换 `以太网` 为你的网卡名):
   ```powershell
   Set-NetIPInterface -InterfaceAlias "以太网" -WeakHostSend Enabled
   Set-NetIPInterface -InterfaceAlias "以太网" -WeakHostReceive Enabled
   ```

4. **重启网卡**:
   ```powershell
   Restart-NetAdapter -Name "以太网"
   ```

5. **测试**:
   ```powershell
   Test-NetConnection -ComputerName 192.168.101.4 -Port 18789
   ```

### 优点
- ✅ 彻底解决问题
- ✅ 电脑和手机访问地址相同

### 缺点
- ❌ 可能有安全风险
- ❌ 修改系统网络配置
- ❌ 需要管理员权限

---

## ✅ 解决方案 3: 使用反向代理 (企业级)

### 原理
在本地运行 Nginx 或其他代理服务器,监听局域网 IP,代理到 localhost。

### 步骤

1. **安装 Nginx**

2. **配置 nginx.conf**:
   ```nginx
   server {
       listen 192.168.101.4:8080;
       
       location / {
           proxy_pass http://localhost:5173;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
       }
       
       location /ws/ {
           proxy_pass http://localhost:18789/;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
       }
   }
   ```

3. **访问**: `http://192.168.101.4:8080`

### 优点
- ✅ 最灵活
- ✅ 可以添加 SSL、负载均衡等

### 缺点
- ❌ 配置复杂
- ❌ 需要额外安装软件
- ❌ 资源开销

---

## 🧪 诊断工具

### 1. 完整网络诊断
```powershell
.\full-network-diagnosis.ps1
```

功能:
- 检查网络接口
- 检查路由表
- TCP/WebSocket 连接测试
- 防火墙规则检查
- Hairpin NAT 检测
- 提供解决建议

### 2. 一键启动
```powershell
.\start-all.ps1
```

功能:
- 检查 Gateway 是否运行
- 检查 Vite 是否运行
- 检查防火墙配置
- 网络连接测试
- 自动给出解决方案

### 3. 防火墙修复
```powershell
.\fix-firewall.ps1
```

功能:
- 添加端口 18789 的防火墙规则
- 添加端口 5173 的防火墙规则
- 验证规则创建成功

---

## 📋 快速开始

### 方式 1: Hosts 文件方案 (推荐新手)

```powershell
# 1. 以管理员身份运行 PowerShell
# 右键点击 PowerShell → 以管理员身份运行

# 2. 导航到项目目录
cd E:\desktop\trix-3d-companion

# 3. 运行 hosts 配置脚本
.\setup-hosts.ps1

# 4. 启动服务
.\start-all.ps1

# 5. 访问
# 电脑: http://trix.local:5173
# 手机: http://192.168.101.4:5173
```

### 方式 2: 保持现状 (临时方案)

```powershell
# 电脑访问
http://localhost:5173

# 手机访问 (需要确认手机能连接)
http://192.168.101.4:5173
```

---

## ❓ 常见问题

### Q1: 为什么 localhost 可以,IP 不行?

A: Windows 将 `localhost` 视为本地回环 (127.0.0.1),不经过网络栈。但访问自己的局域网 IP 会被视为"发夹回环",被内核阻止。

### Q2: 手机为什么也连接不上?

A: 如果你在电脑浏览器通过 `192.168.101.4:5173` 访问应用,应用会尝试连接 `ws://192.168.101.4:18789`,这触发了 Hairpin NAT 限制。

手机本身能连接,但如果 Gateway 配置有问题或防火墙阻止,也会失败。

### Q3: 测试工具能连接,为什么应用不行?

A: 测试工具 (`file:///...html`) 不受浏览器的同源策略影响,而且可能使用了不同的网络路径。React 应用从 `http://192.168.101.4:5173` 访问时,会触发 Hairpin NAT。

### Q4: 修改 hosts 文件后需要重启吗?

A: 不需要重启电脑,但需要:
1. 刷新 DNS 缓存: `ipconfig /flushdns`
2. 重启浏览器

### Q5: 如何撤销 hosts 修改?

A: 编辑 `C:\Windows\System32\drivers\etc\hosts`,删除包含 `trix.local` 的行,保存即可。

---

## 🔗 相关资源

- [Microsoft Docs: Weak Host Model](https://docs.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2008-R2-and-2008/dd392266(v=ws.10))
- [RFC 3022: NAT Hairpinning](https://tools.ietf.org/html/rfc3022)
- [Vite Proxy 配置](https://vitejs.dev/config/server-options.html#server-proxy)

---

## 📞 获取帮助

如果以上方案都无法解决,请提供:

1. `.\full-network-diagnosis.ps1` 的完整输出
2. Gateway 的启动日志
3. 浏览器控制台的错误信息
4. 网络拓扑 (路由器、交换机配置)

---

**最后更新**: 2026-02-06
