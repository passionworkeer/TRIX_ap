# 🚀 TRIX 三端联通 - 快速启动指南

## ⚡ 30 秒快速启动

### 第 1 步：PC 端启动（10 秒）

```bash
# 在 OpenClaw 中输入：
启动 TRIX Channel

# 等待看到：
✅ TRIX Channel 已启动
📡 服务器: http://47.243.55.130:8765
```

### 第 2 步：生成配对码（5 秒）

```bash
# 在 OpenClaw 中输入：
生成 TRIX 配对码

# 会显示：
✅ 配对码已生成！
📱 配对码：ABC123
⏰ 有效期：5分钟
```

### 第 3 步：App 配对（15 秒）

```
1. 打开 TRIX App
2. 进入配对页面
3. 输入配对码：ABC123
4. 点击确认配对
5. ✅ 配对成功！
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
PC 端：OpenClaw 自动回复
✅ App 应该收到回复
```

### 测试 3：离线消息（关键！）
```
1. App 发送消息
2. 立即锁屏/切后台
3. PC 端回复
4. 解锁/切回 App
5. ✅ 消息应该自动出现！
```

---

## 🔧 如果遇到问题

### PC 端无法启动

**检查 OpenClaw Gateway**：
```bash
# Windows
netstat -ano | findstr 18789

# Linux/Mac
lsof -i :18789
```

**解决方案**：
- 确保 OpenClaw 正在运行
- Gateway 默认端口：18789

### App 无法配对

**检查网络**：
```bash
ping 47.243.55.130
```

**检查服务器状态**：
```bash
curl http://47.243.55.130:8765/health
```

### 消息收不到

**查看服务器日志**：
```bash
ssh root@47.243.55.130
pm2 logs clawbot-channel --lines 100
```

**查看关键词**：
- `app_message` - App 发来的消息
- `bot_response` - Bot 的回复
- `消息已保存` - 消息落库成功

---

## 📊 性能指标

| 操作 | 预期时间 |
|------|----------|
| 启动 Channel | ~3 秒 |
| 生成配对码 | ~1 秒 |
| App 配对 | ~2 秒 |
| 消息延迟 | ~100ms |
| 重连时间 | ~2 秒 |
| 消息同步 | ~500ms |

---

## 🎯 成功标志

当你看到以下日志时，说明系统运行正常：

### PC 端
```
✅ TRIX Channel 已启动
♻️  恢复配对: pair_xxx
📩 收到 App 消息: ...
```

### 服务器端
```
✅ 消息表已就绪
📩 收到 Bot 响应
✅ Bot 消息已保存到数据库
➡️  已转发给 App
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
curl -I http://47.243.55.130:8765

# 预期：HTTP 200 OK
```

### 2. 配对问题
```bash
# 检查配对状态
# App 端查看 localStorage
localStorage.getItem('clawbot_paired')
# 应该返回："true"
```

### 3. 消息问题
```bash
# 测试消息同步 API
curl "http://47.243.55.130:8765/api/messages/sync?userId=test&lastTimestamp=0"

# 预期：{"success":true,"messages":[...]}
```

---

## 🎊 完成！

**如果以上所有测试都通过，恭喜你！三端联通系统已成功运行！** 🎉

---

**需要帮助？** 查看 [THREE_TIER_TEST_GUIDE.md](THREE_TIER_TEST_GUIDE.md) 完整测试指南
