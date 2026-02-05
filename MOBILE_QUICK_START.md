# 📱 手机调试 TRIX - 快速指南

## 🚀 一键启动（推荐）

在 PowerShell **管理员模式**运行：

```powershell
.\start-mobile-debug.ps1
```

这个脚本会自动：
1. ✅ 检查并安装 openclaw-cn
2. ✅ 配置防火墙规则
3. ✅ 启动 Clawbot Gateway (端口 18789)
4. ✅ 启动 Vite 前端 (端口 5173)
5. ✅ 显示手机访问地址和二维码

---

## 📱 手机访问步骤

### 1. 确保同一 WiFi
手机和电脑必须连接到**同一个 WiFi 网络**。

### 2. 在手机浏览器打开
```
http://192.168.101.4:5173/
```

> 💡 具体 IP 地址请看启动脚本显示的地址

### 3. 测试功能
1. 进入 **Chat** 页面
2. 点击 **TRIX 机器人**
3. 检查连接状态：
   - ✅ `🟢 Gateway Connected` → 正常
   - ❌ `🔴 Gateway Disconnected` → 检查 Gateway 窗口
4. 发送测试消息

---

## 🔧 手动启动（备选）

### 步骤 1: 启动 Gateway
```powershell
# 新开 PowerShell 窗口
openclaw-cn gateway
```

### 步骤 2: 启动前端
```powershell
# 另一个窗口
cd E:\desktop\trix-3d-companion
npm run dev
```

### 步骤 3: 手机访问
```
http://192.168.101.4:5173/
```

---

## ❓ 常见问题

### Q1: 手机无法打开网页？

**检查防火墙：**
```powershell
# 管理员模式 PowerShell
New-NetFirewallRule -DisplayName "Vite Dev Server" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Clawbot Gateway" -Direction Inbound -LocalPort 18789 -Protocol TCP -Action Allow
```

**检查网络连接：**
- 确保手机和电脑在同一 WiFi
- 尝试在手机浏览器访问：`http://192.168.101.4`（应该显示错误页，说明网络通）

### Q2: Gateway Disconnected？

**检查 Gateway 是否在运行：**
```powershell
netstat -ano | Select-String "18789"
```

应该看到：
```
TCP    0.0.0.0:18789    0.0.0.0:0    LISTENING
```

**重新启动 Gateway：**
```powershell
openclaw-cn gateway
```

### Q3: 如何找到我的 IP 地址？

```powershell
ipconfig | Select-String "IPv4"
```

查找类似 `192.168.x.x` 的地址。

### Q4: 图片无法加载？

**当前项目没有图片资源**，如果以后添加图片：

- 放在 `public/images/` 下，使用 `/images/xxx.png`
- 或放在 `src/assets/` 下，使用 `import logo from './assets/logo.png'`

---

## 📋 检查清单

启动前检查：
- [ ] Python 已安装（`python --version`）
- [ ] openclaw-cn 已安装（`pip list | Select-String openclaw`）
- [ ] 防火墙规则已添加（运行一键启动脚本会自动添加）
- [ ] 手机和电脑在同一 WiFi

启动后验证：
- [ ] Gateway 窗口显示 "Gateway 已启动在 ws://0.0.0.0:18789"
- [ ] Vite 窗口显示 "Network: http://192.168.101.4:5173/"
- [ ] 手机可以打开网页
- [ ] TRIX 机器人显示 🟢 Gateway Connected

---

## 🎯 完整配置状态

### ✅ 已验证配置正确

1. **`.env` 文件**
   ```env
   VITE_PC_WEBSOCKET_URL=ws://192.168.101.4:18789  ✅
   ```

2. **`vite.config.ts`**
   ```typescript
   server: {
     host: '0.0.0.0',  ✅
     port: 5173,
   }
   ```

3. **图片资源**
   - ✅ 无硬编码路径问题

### 🎉 结论

所有配置都是正确的！只需运行启动脚本即可。

---

**详细报告**: `MOBILE_DEBUG_REPORT.md`  
**一键启动**: `.\start-mobile-debug.ps1`  
**最后更新**: 2026年2月5日
