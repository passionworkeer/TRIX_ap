# 🔥 防火墙问题 - 快速修复指南

## 🎯 问题确认

**症状**:
- ✅ `localhost` 能连接到 Gateway
- ❌ `192.168.101.4` (局域网 IP) 不能连接
- 错误: `WebSocket connection to 'ws://192.168.101.4:18789/' failed`

**根本原因**: **Windows 防火墙阻止了外部连接**

---

## ⚡ 快速修复（推荐）

### 方法 1: 使用自动化脚本

1. **右键点击 PowerShell，选择"以管理员身份运行"**

2. **运行修复脚本**:
   ```powershell
   cd E:\desktop\trix-3d-companion
   .\fix-firewall.ps1
   ```

3. **等待完成**，应该看到：
   ```
   ✅ 成功添加规则：端口 18789
   ✅ 成功添加规则：端口 5173
   ```

4. **测试连接**:
   ```
   http://192.168.101.4:5173/#/diagnostic
   ```

---

## 🔧 方法 2: 手动添加规则

如果脚本失败，手动执行：

```powershell
# 以管理员身份运行 PowerShell，然后执行：

# 允许 Gateway 端口
netsh advfirewall firewall add rule name="Clawbot Gateway" dir=in action=allow protocol=TCP localport=18789

# 允许 Vite 端口
netsh advfirewall firewall add rule name="Vite Dev Server" dir=in action=allow protocol=TCP localport=5173
```

---

## 📊 验证修复

### 步骤 1: 检查规则是否创建

```powershell
netsh advfirewall firewall show rule name="Clawbot Gateway"
```

应该看到规则详情，包括：
```
规则名称:                     Clawbot Gateway
启用:                         是
操作:                         允许
```

### 步骤 2: 测试连接

```
访问: http://192.168.101.4:5173/#/diagnostic
点击: 开始测试连接
```

应该看到：
```
✅ 连接和认证都成功！
```

### 步骤 3: 测试实际应用

```
访问: http://192.168.101.4:5173/#/chat
进入: TRIX 机器人
发送: 你好
```

应该能收到 AI 回复。

---

## 🔍 故障排除

### 问题 1: 脚本提示需要管理员权限

**解决**:
1. 关闭当前 PowerShell
2. 右键点击 PowerShell 图标
3. 选择"以管理员身份运行"
4. 重新运行脚本

### 问题 2: 规则添加成功但仍无法连接

**可能原因**:
- 第三方防火墙软件拦截
- 杀毒软件拦截
- 路由器防火墙

**检查**:
1. 临时关闭第三方防火墙/杀毒软件
2. 重新测试
3. 如果成功，在第三方软件中添加例外

### 问题 3: 手机仍无法连接

**检查**:
1. 手机和电脑在同一 WiFi 网络
2. WiFi 是否启用了客户端隔离（AP 隔离）
3. 路由器是否有访问控制规则

---

## 📱 手机测试

防火墙修复后，手机应该也能访问：

```
手机浏览器打开:
http://192.168.101.4:5173/

或扫描二维码（可以用在线工具生成）
```

---

## 🎯 预期结果

修复后，你应该能：

1. ✅ 电脑通过 `http://192.168.101.4:5173` 访问应用
2. ✅ 手机通过 `http://192.168.101.4:5173` 访问应用
3. ✅ WebSocket 连接到 `ws://192.168.101.4:18789` 成功
4. ✅ 发送消息给 Bot 并收到回复
5. ✅ 所有图片资源正常显示

---

## 📝 快速命令参考

```powershell
# 查看现有防火墙规则
netsh advfirewall firewall show rule name=all | findstr "18789"

# 删除规则
netsh advfirewall firewall delete rule name="Clawbot Gateway"

# 添加规则
netsh advfirewall firewall add rule name="Clawbot Gateway" dir=in action=allow protocol=TCP localport=18789

# 禁用规则（不删除）
netsh advfirewall firewall set rule name="Clawbot Gateway" new enable=no

# 启用规则
netsh advfirewall firewall set rule name="Clawbot Gateway" new enable=yes
```

---

## 🚀 立即执行

**现在请执行以下步骤**:

1. **以管理员身份运行 PowerShell**
2. **执行**: `.\fix-firewall.ps1`
3. **等待完成**
4. **测试**: `http://192.168.101.4:5173/#/diagnostic`
5. **告诉我结果** 🎉

---

**防火墙规则添加后，问题应该立即解决！** 🔥
