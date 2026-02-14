# Nanobot 快速测试指南

> 5分钟快速验证三端连通

---

## 🎯 测试目标

- ✅ 云端服务器: TRIX_SERVER_HOST:8765
- ✅ 本地 Nanobot: localhost:5000
- ✅ App 前端: localhost:5173
- ✅ Supabase 认证集成

---

## 📝 测试前准备

### 1. 重启云端服务器 (首次部署)

```bash
# 方式 1: 使用脚本 (推荐)
ssh root@TRIX_SERVER_HOST "bash -s" < scripts/restart_cloud_server.sh

# 方式 2: 手动执行
ssh root@TRIX_SERVER_HOST
pkill -f cloud_server.py
nohup python3 /opt/nanobot-cloud/cloud_server_advanced.py > /tmp/cloud_server_advanced.log 2>&1 &
```

### 2. 验证云端服务器

```bash
ssh root@TRIX_SERVER_HOST "ps aux | grep cloud_server_advanced && tail -5 /tmp/cloud_server_advanced.log"
```

**预期输出**:
```
✅ 数据库初始化完成: /tmp/nanobot.db
✅ 云服务器初始化完成 (SQLite + QR码 + Supabase认证)
🚀 WebSocket 服务器启动: ws://0.0.0.0:8765
```

---

## 🧪 完整测试流程

### 终端 1: 启动云端服务器 (可选，用于查看实时日志)

```bash
ssh root@TRIX_SERVER_HOST "tail -f /tmp/cloud_server_advanced.log"
```

### 终端 2: 启动本地 Nanobot

```bash
cd e:\desktop\nanobot\nanobot
python web_interface_final.py
```

**访问**: http://localhost:5000

**操作**:
1. 点击 **"生成配对码"**
2. 记录配对码 (例如: `A1B2C3D4`)
3. 确认 QR 码显示

**✅ 验证点**:
- [ ] 配对码显示 (8位大写)
- [ ] QR 码图片显示
- [ ] 云端日志: `🔗 配对码注册: A1B2C3D4`

### 终端 3: 启动 App 前端

```bash
cd e:\desktop\trix-3d-companion
npm run dev
```

**访问**: http://localhost:5173

**操作**:
1. **登录 Supabase** (必须先登录!)
2. 进入 **Nanobot 配对界面**
3. 输入配对码: `A1B2C3D4`
4. 点击 **"配对"**

**打开浏览器控制台 (F12)**

**✅ 验证点**:
- [ ] 控制台: `[NanobotBridge] WebSocket 已连接`
- [ ] 控制台: `[NanobotBridge] 获取 Supabase User ID: <uuid>`
- [ ] 控制台: `[NanobotBridge] 发送配对请求: A1B2C3D4 (User: <uuid>)`
- [ ] 控制台: `[NanobotBridge] 配对成功`
- [ ] 云端日志: `✅ 配对成功: A1B2C3D4 (User: <uuid>)`

### 测试消息发送

**在 App 聊天界面**:
1. 输入: "你好"
2. 点击发送

**✅ 验证点**:
- [ ] App 控制台: `[NanobotBridge] 消息已发送`
- [ ] Nanobot 终端: `收到消息: 你好`
- [ ] App 控制台: `[NanobotBridge] 收到回复`
- [ ] 云端日志: `💬 消息转发` + `💬 回复转发`

---

## 🔍 关键日志对照

### App 浏览器控制台

```
[NanobotBridge] 服务器地址: ws://TRIX_SERVER_HOST:8765
[NanobotBridge] 设备 ID: app_xxx
[NanobotBridge] WebSocket 已连接
[NanobotBridge] 设备注册成功: app_xxx
[NanobotBridge] 获取 Supabase User ID: <uuid-xxx>     ← ⭐ 关键!
[NanobotBridge] 发送配对请求: A1B2C3D4 (User: <uuid-xxx>)  ← ⭐ 关键!
[NanobotBridge] 配对成功
```

### 云端服务器日志

```bash
ssh root@TRIX_SERVER_HOST "tail -30 /tmp/cloud_server_advanced.log"
```

```
✅ 数据库初始化完成: /tmp/nanobot.db
✅ 云服务器初始化完成 (SQLite + QR码 + Supabase认证)
🚀 WebSocket 服务器启动: ws://0.0.0.0:8765
🔗 配对码注册: A1B2C3D4 (Nanobot: nanobot_xxx)
💾 配对码已保存: A1B2C3D4 -> nanobot_xxx
📱 设备注册: app_xxx (mobile_app)
✅ 配对成功: A1B2C3D4 (App: app_xxx, Nanobot: nanobot_xxx, User: <uuid-xxx>)  ← ⭐ 关键!
💾 配对关系已更新: A1B2C3D4 -> User:<uuid-xxx>  ← ⭐ 关键!
```

### 数据库验证

```bash
ssh root@TRIX_SERVER_HOST "sqlite3 /tmp/nanobot.db 'SELECT code, user_id, status FROM pairings;'"
```

预期输出:
```
A1B2C3D4|<uuid-xxx>|connected
```

---

## ❌ 常见问题快速修复

### 问题 1: 云端服务器未启动

**症状**: App 无法连接

**解决**:
```bash
ssh root@TRIX_SERVER_HOST "pkill -f cloud_server && nohup python3 /opt/nanobot-cloud/cloud_server_advanced.py > /tmp/cloud_server_advanced.log 2>&1 &"
```

### 问题 2: 端口被占用

**症状**: `OSError: [Errno 98] address already in use`

**解决**:
```bash
ssh root@TRIX_SERVER_HOST "lsof -ti:8765 | xargs kill -9"
```

### 问题 3: App 未登录 Supabase

**症状**: `[NanobotBridge] 未登录，将使用匿名模式`

**解决**:
1. 在 App 中登录 Supabase
2. 验证登录状态:
   ```javascript
   // 浏览器控制台
   const { data: { session } } = await supabase.auth.getSession();
   console.log('User ID:', session?.user?.id);
   ```

### 问题 4: QR 码不显示

**症状**: Nanobot 界面只显示配对码，没有 QR 码

**检查**:
1. 确认使用的是 `web_interface_final.py` (已修改版)
2. 检查云端日志: `qr_code` 字段是否存在

---

## ✅ 成功标志

所有以下条件满足即为成功:

- [x] 云端服务器运行中 (`ps aux | grep cloud_server_advanced`)
- [x] 数据库已创建 (`sqlite3 /tmp/nanobot.db ".tables"`)
- [x] Nanobot 可生成配对码 + QR 码
- [x] App 可登录 Supabase
- [x] App 可成功配对
- [x] 配对日志显示 User ID
- [x] 数据库记录包含 User ID
- [x] 消息可双向传递

---

## 📊 一键验证脚本

创建 `scripts/verify_deployment.sh`:

```bash
#!/bin/bash
echo "🔍 验证部署状态..."
echo ""

# 1. 服务器进程
echo "1️⃣ 服务器进程:"
ssh root@TRIX_SERVER_HOST "ps aux | grep cloud_server_advanced | grep -v grep"
echo ""

# 2. 端口监听
echo "2️⃣ 端口监听:"
ssh root@TRIX_SERVER_HOST "lsof -i :8765 | grep LISTEN"
echo ""

# 3. 数据库
echo "3️⃣ 数据库表:"
ssh root@TRIX_SERVER_HOST "sqlite3 /tmp/nanobot.db '.tables'"
echo ""

# 4. 最新日志
echo "4️⃣ 最新日志 (最近 5 行):"
ssh root@TRIX_SERVER_HOST "tail -5 /tmp/cloud_server_advanced.log"
echo ""

echo "✅ 验证完成!"
```

运行:
```bash
bash scripts/verify_deployment.sh
```

---

## 🎉 测试成功后

### 查看完整配对记录

```bash
ssh root@TRIX_SERVER_HOST "sqlite3 /tmp/nanobot.db <<EOF
.mode column
.headers on
SELECT
    code AS '配对码',
    nanobot_device_id AS 'Nanobot',
    app_device_id AS 'App',
    user_id AS 'User ID',
    status AS '状态',
    datetime(connected_at) AS '连接时间'
FROM pairings
WHERE status = 'connected';
EOF"
```

### 实时监控日志

```bash
ssh root@TRIX_SERVER_HOST "tail -f /tmp/cloud_server_advanced.log | grep --color -E '(配对成功|消息转发|回复转发|User:)'"
```

---

**文档版本**: 1.0.0
**最后更新**: 2026-02-14
