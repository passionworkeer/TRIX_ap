# OpenClaw Gateway Bridge 集成实施指南

## ✅ 已完成的步骤

### 1. OpenClaw Gateway 运行状态
- **状态**: ✅ 已启动并运行
- **端口**: 18789
- **验证**: `curl http://127.0.0.1:18789/health` 返回正常

### 2. 本地 Bridge 进程
- **状态**: ✅ 已创建并成功连接到云端 Relay Server
- **位置**: `e:\desktop\trix-3d-companion\bridge\openclaw-bridge.js`
- **连接**: ✅ ws://TRIX_SERVER_HOST:8765
- **依赖**: axios, socket.io-client 已安装

### 3. 云端 Relay Server 扩展
- **状态**: ⚠️ 需要在服务器上安装
- **文件**: `cloud_server_bridge_extension.py`
- **操作**: 需要手动上传到服务器并集成

## 📋 下一步操作

### 方案 A: 修改云端服务器（推荐）

1. **SSH 登录到云端服务器**:
   ```bash
   ssh root@TRIX_SERVER_HOST
   ```

2. **找到 cloud_server.py 文件**:
   ```bash
   cd /path/to/nanobot
   find . -name "cloud_server.py"
   ```

3. **备份原文件**:
   ```bash
   cp cloud_server.py cloud_server.py.backup
   ```

4. **集成 Bridge 扩展**:
   - 将 `cloud_server_bridge_extension.py` 中的方法复制到 `CloudServer` 类中
   - 在 `__init__` 方法中添加: `self.bridges = {}`
   - 在 `handle_message` 方法中添加新的事件处理

5. **重启服务器**:
   ```bash
   # 如果使用 systemd
   sudo systemctl restart nanobot-cloud

   # 或直接重启 Python 进程
   pkill -f cloud_server.py
   python cloud_server.py &
   ```

### 方案 B: 使用本地测试服务器（临时方案）

如果暂时无法修改云端服务器，可以使用本地测试服务器：

1. **在本地运行简化版 Relay Server**:
   ```bash
   cd e:\desktop\trix-3d-companion\bridge
   node relay-server-test.js
   ```

2. **修改 App 配置指向本地服务器**:
   ```env
   VITE_CLAWBOT_CHANNEL_URL=ws://localhost:8765
   ```

## 🧪 测试验证

完成服务器配置后，进行端到端测试：

### 1. 验证 Bridge 连接

```bash
# 查看 Bridge 日志
pm2 logs openclaw-bridge
# 或
tail -f /path/to/bridge.log
```

**预期输出**:
```
[Bridge] ✅ 已连接到云端 Relay Server
[Bridge] 📨 收到 App 消息: ...
[Bridge] 调用 OpenClaw Gateway (尝试 1/4)
[Bridge] ✅ OpenClaw 响应成功: ...
```

### 2. 发送测试消息

启动 App 并发送测试消息:
```bash
cd e:\desktop\trix-3d-companion
npm run dev
```

1. 打开 http://localhost:5173
2. 进入 Clawbot 聊天页面
3. 发送消息: "你好 OpenClaw"
4. **预期**: <1 秒收到 AI 响应

### 3. 检查服务器日志

在云端服务器上检查日志:
```bash
tail -f /var/log/nanobot-cloud.log
```

**预期输出**:
```
[Relay Server] ✅ OpenClaw Bridge 注册成功 (v1.0.0)
[Relay Server] 📨 收到 App 消息: 你好 OpenClaw
[Relay Server] 📤 转发消息到 OpenClaw Bridge...
[Relay Server] 📨 收到 Bridge 响应: 你好！我是...
```

## 🐛 故障排查

### 问题 1: Bridge 连接失败

**症状**: `[Bridge] ❌ 连接失败: xhr poll error`

**解决方案**:
1. 检查云端服务器是否运行: `ping TRIX_SERVER_HOST`
2. 检查端口是否开放: `telnet TRIX_SERVER_HOST 8765`
3. 检查防火墙规则

### 问题 2: 服务器未识别 Bridge

**症状**: Bridge 连接成功但服务器无响应

**解决方案**:
1. 确认服务器已安装 Bridge 扩展
2. 检查 `bridge_register` 事件处理是否添加
3. 查看服务器错误日志

### 问题 3: OpenClaw Gateway 无响应

**症状**: `[Bridge] ❌ OpenClaw 调用失败`

**解决方案**:
1. 检查 OpenClaw 是否运行: `netstat -ano | findstr :18789`
2. 测试 API 端点: `curl http://127.0.0.1:18789/v1/chat/completions`
3. 检查 Token 是否正确

## 📊 性能监控

### 使用 PM2 监控 Bridge

```bash
# 安装 PM2
npm install -g pm2

# 启动 Bridge
pm2 start openclaw-bridge.js --name openclaw-bridge

# 查看状态
pm2 status

# 查看日志
pm2 logs openclaw-bridge

# 监控
pm2 monit
```

### 关键指标

- **连接状态**: Bridge 是否保持连接
- **消息延迟**: App 发送消息到收到响应的时间
- **重试次数**: API 调用失败重试统计
- **错误率**: 失败消息比例

## 🎯 优化建议

1. **启用 PM2 开机自启**:
   ```bash
   pm2 startup
   pm2 save
   ```

2. **添加日志轮转**:
   ```bash
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 10M
   pm2 set pm2-logrotate:retain 7
   ```

3. **启用流式输出**:
   修改 Bridge 代码，设置 `stream: true`

4. **添加健康检查**:
   创建 HTTP 健康检查端点

## 📞 技术支持

如遇问题，请检查:
1. OpenClaw Gateway 日志
2. Bridge 进程日志
3. 云端 Relay Server 日志
4. App 浏览器控制台

---

**集成方案版本**: v1.0
**最后更新**: 2026-02-18
**文档作者**: Claude Sonnet 4.6
