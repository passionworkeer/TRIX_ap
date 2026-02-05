# 🔧 TRIX 访问问题故障排除指南

## ❌ 问题 1: "Cannot GET /" 错误

### 原因
Vite 找不到入口文件或路由配置错误

### ✅ 已修复
- ✅ 更新了 `vite.config.ts` 添加 `root: '.'`
- ✅ 修复了 `index.html` 中的脚本引用
- ✅ 确认 `index.tsx` 和 `App.tsx` 存在

### 验证方法
```bash
# 1. 重启开发服务器
npm run dev

# 2. 在浏览器访问
http://localhost:3000/

# 3. 应该看到 TRIX 应用界面
```

---

## ❌ 问题 2: 192.168.101.4 被拒绝 (网络访问失败)

### 原因
Windows 防火墙阻止了端口 3000 的入站连接

### ✅ 解决方案

#### 方法 1: 运行防火墙配置脚本 (推荐)

1. **右键点击** `setup-firewall.ps1`
2. **选择** "以管理员身份运行"
3. **等待** 脚本执行完成
4. **完成!** 防火墙规则已添加

#### 方法 2: 手动配置 (GUI)

1. 打开 **控制面板** → **Windows Defender 防火墙**
2. 点击左侧 **"高级设置"**
3. 点击左侧 **"入站规则"**
4. 点击右侧 **"新建规则..."**
5. 选择 **"端口"** → 下一步
6. 选择 **"TCP"** → 输入端口 **3000** → 下一步
7. 选择 **"允许连接"** → 下一步
8. 勾选 **所有配置文件** → 下一步
9. 名称输入 **"TRIX Vite Dev Server"** → 完成

#### 方法 3: PowerShell 命令 (管理员)

```powershell
# 以管理员身份打开 PowerShell
New-NetFirewallRule -DisplayName "TRIX Vite Dev Server" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 3000 `
    -Action Allow `
    -Profile Any
```

---

## 📱 测试网络访问

### 从手机访问

1. **确保手机和电脑在同一 WiFi 网络**
2. **在手机浏览器访问:**
   ```
   http://192.168.101.4:3000/
   ```
3. **应该看到 TRIX 应用界面**

### 从电脑测试

```bash
# 本地访问
http://localhost:3000/

# 网络访问 (模拟手机)
http://192.168.101.4:3000/
```

---

## 🔍 验证检查清单

### ✅ 服务器运行检查

```bash
# 1. 确认 Vite 正在运行
npm run dev

# 应该看到:
#   ➜  Local:   http://localhost:3000/
#   ➜  Network: http://192.168.101.4:3000/
```

### ✅ 防火墙检查

```powershell
# 检查防火墙规则是否存在
Get-NetFirewallRule -DisplayName "*TRIX*"

# 应该看到一条规则
```

### ✅ 端口检查

```powershell
# 检查端口 3000 是否在监听
netstat -ano | findstr :3000

# 应该看到:
# TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING
```

### ✅ 网络检查

```powershell
# 确认你的 IP 地址
ipconfig | findstr IPv4

# 应该看到类似:
# IPv4 地址 . . . . . . . . . . . . : 192.168.101.4
```

---

## 🐛 常见问题

### Q: 本地可以访问,但手机不行?
**A:** 
- ✅ 检查防火墙规则是否已添加
- ✅ 确认手机和电脑在同一网络
- ✅ 尝试关闭 Windows 防火墙测试 (不推荐长期)

### Q: IP 地址变了怎么办?
**A:**
- 电脑重新连接 WiFi 后,IP 可能改变
- 重新运行 `ipconfig` 获取新 IP
- 使用新 IP 地址访问

### Q: 显示 "连接超时"?
**A:**
- ✅ 检查 Vite 服务器是否运行
- ✅ 检查 IP 地址是否正确
- ✅ 检查防火墙规则
- ✅ 尝试重启路由器

### Q: 显示 "ERR_CONNECTION_REFUSED"?
**A:**
- ✅ 防火墙阻止了连接
- ✅ 运行 `setup-firewall.ps1` 脚本
- ✅ 或手动添加防火墙规则

---

## 🚀 快速启动流程

### 第一次运行

```bash
# 1. 运行防火墙配置 (右键管理员运行)
setup-firewall.ps1

# 2. 启动开发服务器
npm run dev

# 3. 电脑浏览器访问
http://localhost:3000/

# 4. 手机浏览器访问
http://192.168.101.4:3000/
```

### 日常开发

```bash
# 启动服务器
npm run dev

# 访问应用
浏览器: http://localhost:3000/
手机: http://192.168.101.4:3000/
```

---

## 📊 网络架构图

```
┌─────────────────┐
│   电脑 (开发)    │
│  192.168.101.4  │
│                 │
│  Vite Server    │
│  Port: 3000     │
└────────┬────────┘
         │
         │ WiFi 路由器
         │ 192.168.101.1
         │
         │
┌────────┴────────┐
│   手机设备       │
│  192.168.101.X  │
│                 │
│  浏览器访问:     │
│  192.168.101.4  │
│      :3000      │
└─────────────────┘
```

---

## ✅ 成功标志

当一切正常时,你应该看到:

### 终端输出:
```
  VITE v6.4.1  ready in 449 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.101.4:3000/
  ➜  press h + enter to show help
```

### 浏览器:
- ✅ 看到 TRIX 登录界面
- ✅ 背景渐变动画流畅
- ✅ 底部导航栏显示正常

### 手机:
- ✅ 可以访问网络地址
- ✅ 响应式布局正常
- ✅ 触摸交互流畅

---

## 📞 需要帮助?

如果以上方法都不行:

1. **检查错误日志**
   - 浏览器控制台 (F12)
   - Vite 终端输出

2. **临时关闭防火墙测试**
   ```powershell
   # 控制面板 → Windows Defender 防火墙 → 关闭防火墙
   # 测试后记得重新打开!
   ```

3. **重启服务**
   ```bash
   # Ctrl+C 停止 Vite
   npm run dev  # 重新启动
   ```

4. **清除缓存**
   ```bash
   # 删除缓存
   Remove-Item -Recurse -Force node_modules/.vite
   
   # 重启
   npm run dev
   ```

---

**更新时间:** 2026年2月4日  
**版本:** v1.1.0  
**状态:** ✅ 问题已解决
