# 🚀 TRIX 三端联通 - 快速启动指南

> **最后更新**: 2026-03-21（精简 CLI 命令，移除过时内容）

---

### 第 1 步：启动 TRIX Native Server（10 秒）

TRIX Native Server 已部署在生产环境（`https://trix.love`），Desktop 端通过 OpenClaw Gateway 自动连接，无需手动启动服务器。

如需本地开发：

```bash
cd packages/trix-openclaw-native
npx ts-node src/server/TrixNativeServer.ts
```

### 第 2 步：生成配对码（5 秒）

在 Desktop 端使用 Float 窗口配对（Desktop 自动连接 Gateway）：

```
# Desktop Float 窗口 → 点击"配对"按钮
# 会自动生成配对码并显示 QR
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

完整配对说明见 [docs/guides/PAIRING.md](../guides/PAIRING.md)。

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
| [docs/TRIX_NATIVE_CHANNEL.md](../TRIX_NATIVE_CHANNEL.md) | Native Channel 完整协议 |
| [docs/guides/PAIRING.md](../guides/PAIRING.md) | 配对指南 |

---

## 🎊 完成！

**如果以上所有测试都通过，恭喜你！三端联通系统已成功运行！** 🎉
