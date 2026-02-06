# 🔧 环境变量诊断页面使用指南

## ✅ 已创建诊断页面

我已经在 TRIX App 中添加了一个**环境变量诊断页面**，可以直接在应用内检查配置。

---

## 🚀 如何访问

### 方法 1: 直接访问 URL（推荐）

```
http://localhost:5173/#/diagnostic
```

或者

```
http://192.168.101.4:5173/#/diagnostic
```

### 方法 2: 在浏览器控制台中跳转

```javascript
// 打开 TRIX App 后，在控制台输入：
window.location.hash = '/diagnostic'
```

---

## 📋 诊断页面功能

### 1. 环境变量检查 ✅

显示以下环境变量的实际值：
- `VITE_PC_WEBSOCKET_URL`
- `VITE_PC_AUTH_TOKEN`
- `VITE_SUPABASE_URL`

### 2. 页面信息 ✅

显示当前页面的：
- 完整 URL
- 协议 (http/https)
- 主机名
- 端口

### 3. WebSocket 连接测试 ✅

点击按钮自动测试：
- WebSocket 连接
- Challenge 认证
- 完整的握手流程

### 4. 诊断建议 ✅

根据检查结果自动提供：
- 问题诊断
- 修复建议
- 详细步骤

---

## 🔍 预期结果

### 如果配置正确

你应该看到：

```
📋 环境变量
VITE_PC_WEBSOCKET_URL: ws://192.168.101.4:18789 ✅
VITE_PC_AUTH_TOKEN: 8743d26357758f202c9bb5a21db706185d66f9c98f9c3ff1 ✅
VITE_SUPABASE_URL: https://bqzjumxfzikikgjtsckj.supabase.co ✅

🔌 连接测试
✅ 连接和认证都成功！
```

### 如果配置错误

你会看到：

```
VITE_PC_WEBSOCKET_URL: ❌ 未定义
或
VITE_PC_WEBSOCKET_URL: ws://localhost:18789 ⚠️ (应该是局域网 IP)
```

---

## 📊 对比测试

为了找出问题，请进行对比测试：

### 步骤 1: localhost 访问

```
打开: http://localhost:5173/#/diagnostic
查看: VITE_PC_WEBSOCKET_URL 的值
```

### 步骤 2: 局域网 IP 访问

```
打开: http://192.168.101.4:5173/#/diagnostic
查看: VITE_PC_WEBSOCKET_URL 的值
```

### 步骤 3: 对比结果

两者应该显示**完全相同**的配置：
```
VITE_PC_WEBSOCKET_URL: ws://192.168.101.4:18789
```

如果不同，说明有浏览器缓存或配置问题。

---

## 💡 常见问题诊断

### 情况 1: 显示 "❌ 未定义"

**原因**: .env 文件未正确加载

**解决**:
```powershell
# 1. 检查 .env 文件是否存在
ls .env

# 2. 检查内容
cat .env

# 3. 重启开发服务器
Ctrl+C
npm run dev
```

### 情况 2: 显示 "ws://localhost:18789"

**原因**: .env 文件中的值是 localhost

**解决**:
```powershell
# 修改 .env 文件
# 将 VITE_PC_WEBSOCKET_URL=ws://localhost:18789
# 改为 VITE_PC_WEBSOCKET_URL=ws://192.168.101.4:18789

# 然后重启服务器
```

### 情况 3: localhost 和局域网 IP 显示不同的值

**原因**: 浏览器缓存或 Service Worker

**解决**:
```
1. F12 → Application → Clear storage
2. 勾选所有选项
3. 点击 "Clear site data"
4. 硬刷新 Ctrl+Shift+R
```

---

## 🎯 下一步

### 立即执行：

1. **访问诊断页面**
   ```
   http://localhost:5173/#/diagnostic
   ```

2. **截图或复制显示的配置**

3. **点击"开始测试连接"按钮**

4. **告诉我结果**，特别是：
   - `VITE_PC_WEBSOCKET_URL` 显示什么？
   - `VITE_PC_AUTH_TOKEN` 显示什么？
   - 连接测试的结果？

---

## 📝 检查清单

在诊断页面上，你应该确认：

- ✅ `VITE_PC_WEBSOCKET_URL` = `ws://192.168.101.4:18789`
- ✅ `VITE_PC_AUTH_TOKEN` = `8743d26357758f202c9bb5a21db706185d66f9c98f9c3ff1`
- ✅ `VITE_SUPABASE_URL` = `https://bqzjumxfzikikgjtsckj.supabase.co`
- ✅ 页面 URL 包含当前访问的地址
- ✅ 连接测试成功

---

**现在请访问诊断页面并告诉我你看到了什么！** 🚀

地址：`http://localhost:5173/#/diagnostic`
