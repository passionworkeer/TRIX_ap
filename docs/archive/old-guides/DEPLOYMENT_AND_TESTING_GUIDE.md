# 云端服务器部署与测试指南

> **完成日期**: 2026-02-14
> **目标**: 部署支持 SQLite + QR码 + Supabase 认证的云端服务器

---

## 📋 前提条件

### 本地已完成 ✅
- ✅ [cloud_server_advanced.py](../server/cloud_server_advanced.py) 已创建
- ✅ [NanobotBridge.ts](../src/services/NanobotBridge.ts) Supabase 集成已完成
- ✅ 云端服务器文件已上传至 `/opt/nanobot-cloud/cloud_server_advanced.py`

### 云端服务器信息
- **IP地址**: TRIX_SERVER_HOST
- **端口**: 8765
- **系统**: Linux (阿里云)
- **Python版本**: 3.8+

---

## 🚀 部署步骤

### 步骤 1: 连接到云端服务器

```bash
ssh root@TRIX_SERVER_HOST
```

### 步骤 2: 停止旧版服务器

```bash
# 查找占用 8765 端口的进程
lsof -ti:8765 | xargs kill -9

# 或者
pkill -f cloud_server.py
```

### 步骤 3: 验证依赖包

```bash
# 检查 Python 3
python3 --version

# 安装 websockets (如果未安装)
pip3 install websockets qrcode pillow

# 或使用 pip
pip install websockets qrcode pillow
```

### 步骤 4: 启动高级版服务器

```bash
# 方式 1: 直接运行 (用于调试)
python3 /opt/nanobot-cloud/cloud_server_advanced.py

# 方式 2: 后台运行 (推荐)
nohup python3 /opt/nanobot-cloud/cloud_server_advanced.py > /tmp/cloud_server_advanced.log 2>&1 &
echo $! > /tmp/cloud_server_advanced.pid
```

### 步骤 5: 验证服务器启动

**检查进程**:
```bash
ps aux | grep cloud_server_advanced
```

**查看日志**:
```bash
tail -f /tmp/cloud_server_advanced.log
```

**预期输出**:
```
2026-02-14 14:41:14,661 - INFO - ✅ 数据库初始化完成: /tmp/nanobot.db
2026-02-14 14:41:14,661 - INFO - ✅ 云服务器初始化完成 (SQLite + QR码 + Supabase认证)
2026-02-14 14:41:14,662 - INFO - 🚀 WebSocket 服务器启动: ws://0.0.0.0:8765
```

**检查端口**:
```bash
lsof -i :8765
# 或
netstat -tlnp | grep 8765
```

**检查数据库**:
```bash
sqlite3 /tmp/nanobot.db ".tables"
# 预期输出: pairings  devices  user_bindings

sqlite3 /tmp/nanobot.db "SELECT name FROM sqlite_master WHERE type='table';"
```

---

## 🧪 三端连通测试

### 测试 1: 本地 Nanobot 生成配对码

**启动 Nanobot**:
```bash
cd e:\desktop\nanobot\nanobot
python web_interface_final.py
```

**访问**: http://localhost:5000

**操作**:
1. 点击 **"生成配对码"**
2. 等待配对码显示 (例如: A1B2C3D4)
3. 验证 QR 码是否出现

**预期结果**:
- ✅ 配对码显示 (8位大写字母+数字)
- ✅ QR 码图片显示
- ✅ 配对码有效期显示 (1小时)

**云端日志检查**:
```bash
ssh root@TRIX_SERVER_HOST "tail -20 /tmp/cloud_server_advanced.log"
```

预期日志:
```
🔗 配对码注册: A1B2C3D4 (Nanobot: nanobot_xxx)
💾 配对码已保存: A1B2C3D4 -> nanobot_xxx
```

---

### 测试 2: App 配对 (带 Supabase 认证)

**启动 App 前端**:
```bash
cd e:\desktop\trix-3d-companion
npm run dev
```

**访问**: http://localhost:5173

**操作**:
1. **登录 Supabase** (确保已登录)
2. 进入 **Nanobot 配对界面**
3. 输入配对码: `A1B2C3D4` (或扫描 QR 码)
4. 点击 **"配对"**

**浏览器控制台 (F12) 预期输出**:
```
[NanobotBridge] 服务器地址: ws://TRIX_SERVER_HOST:8765
[NanobotBridge] 设备 ID: app_xxx
[NanobotBridge] WebSocket 已连接
[NanobotBridge] 设备注册成功: app_xxx
[NanobotBridge] 获取 Supabase User ID: <uuid-xxx>
[NanobotBridge] 发送配对请求: A1B2C3D4 (User: <uuid-xxx>)
[NanobotBridge] 配对成功: {code: 'A1B2C3D4', nanobot_device_id: 'nanobot_xxx', user_id: '<uuid-xxx>'}
```

**云端日志检查**:
```bash
ssh root@TRIX_SERVER_HOST "tail -30 /tmp/cloud_server_advanced.log"
```

预期日志:
```
📱 设备注册: app_xxx (mobile_app)
✅ 配对成功: A1B2C3D4 (App: app_xxx, Nanobot: nanobot_xxx, User: <uuid-xxx>)
💾 配对关系已更新: A1B2C3D4 -> User:<uuid-xxx>
✅ 已通知 Nanobot nanobot_xxx 配对成功
```

**数据库验证**:
```bash
ssh root@TRIX_SERVER_HOST "sqlite3 /tmp/nanobot.db 'SELECT code, nanobot_device_id, app_device_id, user_id, status FROM pairings;'"
```

预期输出:
```
A1B2C3D4|nanobot_xxx|app_xxx|<uuid-xxx>|connected
```

---

### 测试 3: 消息发送 (App → Nanobot → App)

**在 App 中发送消息**:
1. 在聊天界面输入: "你好，Nanobot"
2. 点击发送

**App 浏览器控制台预期**:
```
[NanobotBridge] 消息已发送: <msg_id>
[NanobotBridge] 收到回复: {msg_id: '<msg_id>', response: '你好！我是 Nanobot，有什么可以帮助你的吗？', timestamp: '...'}
```

**云端日志**:
```bash
ssh root@TRIX_SERVER_HOST "tail -20 /tmp/cloud_server_advanced.log"
```

预期:
```
💬 消息转发: App app_xxx -> Nanobot nanobot_xxx
💬 回复转发: Nanobot nanobot_xxx -> App app_xxx
```

**Nanobot 日志** (在 Nanobot 终端):
```
收到来自 App 的消息: 你好，Nanobot
正在处理消息...
发送回复: 你好！我是 Nanobot，有什么可以帮助你的吗？
```

---

## 🔍 故障排查

### 问题 1: 端口被占用

**错误**:
```
OSError: [Errno 98] error while attempting to bind on address ('0.0.0.0', 8765): address already in use
```

**解决**:
```bash
# 查找占用端口的进程
lsof -ti:8765

# 杀死进程
kill -9 $(lsof -ti:8765)

# 或
fuser -k 8765/tcp
```

---

### 问题 2: 依赖包缺失

**错误**:
```
ModuleNotFoundError: No module named 'qrcode'
```

**解决**:
```bash
pip3 install qrcode pillow websockets
```

---

### 问题 3: 数据库权限问题

**错误**:
```
sqlite3.OperationalError: unable to open database file
```

**解决**:
```bash
# 检查目录权限
ls -la /tmp/nanobot.db

# 修改权限
chmod 666 /tmp/nanobot.db

# 或更改数据库路径
# 在 cloud_server_advanced.py 中修改 DB_PATH
```

---

### 问题 4: App 无法连接

**症状**:
- 浏览器控制台: `[NanobotBridge] WebSocket 错误`
- 配对一直失败

**检查清单**:
1. ✅ 云端服务器是否运行?
   ```bash
   ssh root@TRIX_SERVER_HOST "ps aux | grep cloud_server_advanced"
   ```

2. ✅ 防火墙是否开放 8765 端口?
   ```bash
   ssh root@TRIX_SERVER_HOST "iptables -L -n | grep 8765"
   ```

3. ✅ 本地网络是否可访问云端?
   ```bash
   ping TRIX_SERVER_HOST
   telnet TRIX_SERVER_HOST 8765
   ```

4. ✅ WebSocket 地址是否正确?
   - 检查 `.env.local` 文件:
     ```
     VITE_NANOBOT_SERVER_URL=ws://TRIX_SERVER_HOST:8765
     ```

---

### 问题 5: Supabase 认证失败

**症状**:
- App 控制台: `[NanobotBridge] 未登录，将使用匿名模式`

**检查**:
```javascript
// 在浏览器控制台执行
const { data: { session } } = await supabase.auth.getSession();
console.log('User ID:', session?.user?.id);
console.log('Email:', session?.user?.email);
```

**解决**:
1. 确保已登录 Supabase
2. 检查 `.env.local` 配置:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

---

## 📊 性能监控

### 实时日志监控

```bash
# 实时查看服务器日志
ssh root@TRIX_SERVER_HOST "tail -f /tmp/cloud_server_advanced.log"

# 查看最近 50 行
ssh root@TRIX_SERVER_HOST "tail -50 /tmp/cloud_server_advanced.log"

# 搜索特定日志
ssh root@TRIX_SERVER_HOST "grep '配对成功' /tmp/cloud_server_advanced.log"
```

### 数据库监控

```bash
# 查看所有配对关系
ssh root@TRIX_SERVER_HOST "sqlite3 /tmp/nanobot.db 'SELECT * FROM pairings;'"

# 查看活跃配对
ssh root@TRIX_SERVER_HOST "sqlite3 /tmp/nanobot.db \"SELECT code, status, created_at FROM pairings WHERE status='connected';\""

# 查看用户绑定
ssh root@TRIX_SERVER_HOST "sqlite3 /tmp/nanobot.db 'SELECT * FROM user_bindings;'"

# 清理过期配对码
ssh root@TRIX_SERVER_HOST "sqlite3 /tmp/nanobot.db \"DELETE FROM pairings WHERE status='waiting' AND datetime(expires_at) < datetime('now');\""
```

### 系统资源监控

```bash
# CPU 和内存使用
ssh root@TRIX_SERVER_HOST "top -n 1 | grep python"

# 磁盘使用
ssh root@TRIX_SERVER_HOST "df -h"

# 网络连接
ssh root@TRIX_SERVER_HOST "netstat -an | grep 8765"
```

---

## 🔄 服务器管理

### 重启服务器

```bash
# 停止服务器
ssh root@TRIX_SERVER_HOST "pkill -f cloud_server_advanced.py"

# 启动服务器
ssh root@TRIX_SERVER_HOST "nohup python3 /opt/nanobot-cloud/cloud_server_advanced.py > /tmp/cloud_server_advanced.log 2>&1 &"

# 一键重启
ssh root@TRIX_SERVER_HOST "pkill -f cloud_server_advanced.py && sleep 2 && nohup python3 /opt/nanobot-cloud/cloud_server_advanced.py > /tmp/cloud_server_advanced.log 2>&1 &"
```

### 停止服务器

```bash
# 优雅停止
ssh root@TRIX_SERVER_HOST "pkill -15 -f cloud_server_advanced.py"

# 强制停止
ssh root@TRIX_SERVER_HOST "pkill -9 -f cloud_server_advanced.py"

# 使用 PID
ssh root@TRIX_SERVER_HOST "kill $(cat /tmp/cloud_server_advanced.pid)"
```

---

## 📝 常用命令速查

```bash
# SSH 连接
ssh root@TRIX_SERVER_HOST

# 查看服务器状态
ps aux | grep cloud_server_advanced

# 查看日志
tail -f /tmp/cloud_server_advanced.log

# 查看端口
lsof -i :8765

# 查看数据库
sqlite3 /tmp/nanobot.db ".tables"

# 重启服务器
pkill -f cloud_server_advanced.py && nohup python3 /opt/nanobot-cloud/cloud_server_advanced.py > /tmp/cloud_server_advanced.log 2>&1 &

# 测试连接
telnet TRIX_SERVER_HOST 8765
```

---

## ✅ 部署验证清单

- [ ] 云端服务器已启动 (`ps aux | grep cloud_server_advanced`)
- [ ] 端口 8765 正在监听 (`lsof -i :8765`)
- [ ] 数据库已创建 (`sqlite3 /tmp/nanobot.db ".tables"`)
- [ ] 本地 Nanobot 可生成配对码
- [ ] 本地 Nanobot 可显示 QR 码
- [ ] App 可连接云端服务器
- [ ] App 可获取 Supabase User ID
- [ ] App 可成功配对
- [ ] App 可发送消息
- [ ] Nanobot 可接收消息
- [ ] Nanobot 可回复消息
- [ ] App 可收到回复
- [ ] 数据库中有配对记录
- [ ] 配对记录包含 User ID

---

## 🎯 下一步

部署成功后，可以进行以下优化:

1. **配置 SSL/TLS** - 使用 Let's Encrypt 证书
2. **设置域名** - 配置 DNS 解析
3. **启用 HTTPS** - 升级到 `wss://`
4. **添加监控** - Prometheus + Grafana
5. **设置备份** - 定期备份数据库
6. **日志轮转** - logrotate 配置

---

**文档版本**: 1.0.0
**最后更新**: 2026-02-14
**维护者**: Claude Sonnet 4.5
