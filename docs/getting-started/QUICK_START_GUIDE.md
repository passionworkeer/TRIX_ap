# 🚀 TRIX 三端联通 - 快速启动指南

## ⚡ 30 秒快速启动

### 第 1 步：启动 TRIX Native Server（10 秒）

```bash
# 方式 1: 使用 CLI 启动
cd packages/trix-openclaw-native
npm run cli -- server start --port 8788

# 方式 2: 使用 OpenClaw 插件
openclaw trix setup
```

服务器启动后会显示：
```
✅ TRIX Native Server 已启动
📡 服务器: http://localhost:8788
```

### 第 2 步：生成配对码（5 秒）

在 OpenClaw 中：
```
# 生成配对码
openclaw trix pair
```

会显示：
```
✅ 配对码已生成！
📱 配对码：ABC123
⏰ 有效期：30分钟
```

### 第 3 步：App 配对（15 秒）

```
1. 打开 TRIX App
2. 进入配对页面
3. 选择"扫码配对"或"手动输入"
4. 输入配对码：ABC123
5. 点击确认配对
6. ✅ 配对成功！
```

---

## ✅ 验证成功

### 测试 1：基本消息
```
App 发送：你好
✅ PC 端应该收到消息
```

### 测试 2：Bot 响应
```
OpenClaw: 自动回复
✅ App 应该收到回复
```

### 测试 3：离线消息（关键！）
```
1. App 发送消息
2. 立即锁屏/切后台
3. OpenClaw 回复
4. 解锁/切回 App
5. ✅ 消息应该自动出现！
```

---

## 🔧 如果遇到问题

### 服务器无法启动

**检查端口占用**：
```bash
# Windows
netstat -ano | findstr 8788

# Linux/Mac
lsof -i :8788
```

**解决方案**：
- 确保端口 8788 未被占用
- 检查 Node.js 版本 >= 18

### App 无法配对

**检查网络**：
```bash
ping TRIX_SERVER_HOST
```

**检查服务器状态**：
```bash
curl http://TRIX_SERVER_HOST:8788/health
```

### 消息收不到

**查看服务器日志**：
```bash
# 本地
pm2 logs trix-native

# 远程服务器
ssh root@TRIX_SERVER_HOST
pm2 logs trix-native --lines 100
```

**查看关键词**：
- `收到配对请求` - 配对流程
- `配对成功` - 配对完成
- `收到消息` - App 发来的消息

---

## 📊 性能指标

| 操作 | 预期时间 |
|------|----------|
| 启动 Server | ~3 秒 |
| 生成配对码 | ~1 秒 |
| App 配对 | ~2 秒 |
| 消息延迟 | ~100ms |
| 重连时间 | ~2 秒 |
| 消息同步 | ~500ms |

---

## 🎯 成功标志

当你看到以下日志时，说明系统运行正常：

### 服务端
```
✅ TRIX Native Server 已启动
📡 端口: 8788
✅ 配对成功: device_xxx
📩 收到 App 消息: ...
```

### OpenClaw 端
```
✅ TRIX Native Channel 已连接
♻️  恢复配对: pair_xxx
📩 收到 App 消息: ...
```

### App 端
```
✅ 已连接到服务器
✅ 配对成功
📱 App 切回前台，检查连接...
📩 收到消息同步指令，开始拉取遗漏消息...
✅ 拉取到 X 条遗漏消息
```

---

## 📞 快速排查

### 1. 连接问题
```bash
# 测试服务器连通性
curl -I http://TRIX_SERVER_HOST:8788/health

# 预期：{"status":"ok"}
```

### 2. 配对问题
```bash
# 检查配对状态 API
curl http://TRIX_SERVER_HOST:8788/api/pairings/{CODE}

# 预期：{"code":"XXX","status":"paired"}
```

### 3. 消息问题
```bash
# 测试消息同步 API
curl "http://TRIX_SERVER_HOST:8788/api/messages/{CONVERSATION_ID}" \
  -H "x-trix-client-token: {TOKEN}"

# 预期：{"success":true,"messages":[...]}
```

---

## 📚 相关文档

| 文档 | 说明 |
|------|------|
| [docs/requirements/TRIX_NATIVE_PAIRING_ARCHITECTURE.md](./requirements/TRIX_NATIVE_PAIRING_ARCHITECTURE.md) | 完整配对架构 |
| [docs/guides/QR_PAIRING_USER_GUIDE.md](./guides/QR_PAIRING_USER_GUIDE.md) | 扫码配对指南 |
| [docs/guides/PAIRING_INPUT_GUIDE.md](./guides/PAIRING_INPUT_GUIDE.md) | 手动输入配对 |

---

## 🎊 完成！

**如果以上所有测试都通过，恭喜你！三端联通系统已成功运行！** 🎉
