# Nanobot 三端配置状态总结

> **配置日期**: 2026-02-14
> **配置状态**: ✅ 云端服务器已就绪

---

## 📊 当前配置状态

### ✅ 云端服务器（已完成）

| 配置项 | 状态 | 值 |
|--------|------|------|
| **服务器 IP** | ✅ 配置完成 | `TRIX_SERVER_HOST` |
| **WebSocket 端口** | ✅ 运行中 | `8765` |
| **完整地址** | ✅ 可访问 | `ws://TRIX_SERVER_HOST:8765` |
| **服务文件** | ✅ 已上传 | `/root/cloud_server.py` |
| **运行状态** | ✅ 运行中 | 进程 ID: 随机 |
| **日志文件** | ✅ 正常记录 | `/tmp/cloud_server.log` |

**启动命令**：
```bash
ssh root@TRIX_SERVER_HOST "python3 /root/cloud_server.py > /tmp/cloud_server.log 2>&1 &"
```

**查看日志**：
```bash
ssh root@TRIX_SERVER_HOST "tail -f /tmp/cloud_server.log"
```

---

### ⏳ 本地 Nanobot（待启动）

| 配置项 | 状态 | 值 |
|--------|------|------|
| **项目路径** | ✅ 已确认 | `e:\desktop\nanobot\nanobot` |
| **配置文件** | ✅ 已配置 | `web_interface_final.py` |
| **云端地址** | ✅ 已配置 | `ws://TRIX_SERVER_HOST:8765/nanobot/ws` (L18) |
| **Web 界面** | ⏳ 待启动 | `http://localhost:5000` |

**启动命令**（在 Windows 命令行中）：
```bash
cd e:\desktop\nanobot\nanobot
python web_interface_final.py
```

**访问地址**：
```
http://localhost:5000
```

---

### ⏳ App 前端（待启动）

| 配置项 | 状态 | 值 |
|--------|------|------|
| **项目路径** | ✅ 已确认 | `e:\desktop\trix-3d-companion` |
| **配置文件** | ✅ 已配置 | `src/services/NanobotBridge.ts` |
| **云端地址** | ✅ 已配置 | `ws://TRIX_SERVER_HOST:8765` (L49) |
| **开发服务器** | ⏳ 待启动 | `http://localhost:5173` |

**启动命令**（在 PowerShell 中）：
```bash
cd e:\desktop\trix-3d-companion
npm run dev
```

**访问地址**：
```
http://localhost:5173
```

---

## 🚀 快速启动三端

### 第 1 步：确认云端运行（已完成✅）

```bash
# 检查端口监听
ssh root@TRIX_SERVER_HOST "netstat -tuln | grep 8765"

# 应该看到：
# tcp  0.0.0.0:8765  0.0.0.0:*  LISTEN
```

**状态**: ✅ 已完成

---

### 第 2 步：启动本地 Nanobot

**在 Windows 命令行（CMD/PowerShell）中**：

```bash
# 1. 进入目录
cd e:\desktop\nanobot\nanobot

# 2. 启动服务
python web_interface_final.py

# 3. 看到以下输出表示成功：
# * Running on http://127.0.0.1:5000
# * Running on http://localhost:5000
```

**验证连接**：
```
浏览器访问: http://localhost:5000
应该看到: Nanobot AI Agent Console
应该看到: 左侧显示配对码（8位，如 A1B2C3D4）
```

**状态**: ⏳ 需要手动启动

---

### 第 3 步：启动 App 前端

**在 PowerShell 中**：

```bash
# 1. 进入目录
cd e:\desktop\trix-3d-companion

# 2. 启动开发服务器
npm run dev

# 3. 看到以下输出表示成功：
# VITE v6.x.x  ready in xxx ms
# ➜  Local:   http://localhost:5173/
```

**验证访问**：
```
浏览器访问: http://localhost:5173
应该看到: TRIX 3D Companion 界面
```

**状态**: ⏳ 需要手动启动

---

## 🧪 测试三端连通

### 测试 1：本地 Nanobot 连接云端

**在 Nanobot Web 界面中** (`http://localhost:5000`)：

**检查点**：
- ✅ 左侧边栏显示"配对码"
- ✅ 显示 8 位配对码（如：`A1B2C3D4`）
- ✅ 显示配对码有效期（默认 3600 秒）
- ✅ 控制台日志显示："云端已连接"

**预期日志**：
```
正在连接云端: ws://TRIX_SERVER_HOST:8765/nanobot/ws...
设备注册成功: nanobot_local_xxxxxx
配对码已发送到云端: A1B2C3D4
```

---

### 测试 2：App 配对 Nanobot

**在 App 中** (`http://localhost:5173`)：

1. **进入配对功能**
   - 点击"配对"或"Nanobot"入口

2. **输入配对码**
   - 输入 Nanobot 显示的配对码（如：`A1B2C3D4`）

3. **点击连接**
   - 点击"连接到 Nanobot"按钮

**成功标志**：
- ✅ 界面显示"配对成功"
- ✅ 显示 Nanobot 设备信息
- ✅ 浏览器控制台（F12）显示：
  ```
  [NanobotBridge] 设备注册成功
  [NanobotBridge] 配对成功
  [NanobotBridge] WebSocket 已连接
  ```

---

### 测试 3：端到端消息测试

**在 App 中**：

1. **进入与 Nanobot 的聊天**
   - 配对成功后进入聊天界面

2. **发送测试消息**
   ```
   你好
   ```

3. **等待回复**（应该很快）

**预期流程**：

1. **App 发送消息**
   ```
   [NanobotBridge] 消息已发送: 1234567890
   ```

2. **云端转发到 Nanobot**
   ```
   [云端日志] 消息转发: app_xxx -> nanobot_local_xxx
   ```

3. **Nanobot 处理并回复**
   - Nanobot Web 界面显示消息："你好"
   - AI 生成回复
   - 回复显示在 Nanobot Web 界面

4. **云端转发到 App**
   ```
   [云端日志] 回复转发: nanobot_local_xxx -> app_xxx
   ```

5. **App 收到回复**
   ```
   [NanobotBridge] 收到回复: {...}
   界面显示 AI 回复
   ```

---

## 📝 日志查看位置

### 云端服务器日志

**实时查看**：
```bash
ssh root@TRIX_SERVER_HOST "tail -f /tmp/cloud_server.log"
```

**关键日志**：
```log
2026-02-14 09:09:24 - INFO - 云服务器初始化完成 (内存存储模式)
2026-02-14 09:09:25 - INFO - server listening on 0.0.0.0:8765
2026-02-14 09:09:25 - INFO - WebSocket 服务器启动: ws://0.0.0.0:8765
2026-02-14 09:15:00 - INFO - 设备注册: nanobot_local_xxxxxx (nanobot_local)
2026-02-14 09:15:05 - INFO - 配对码注册: A1B2C3D4
2026-02-14 09:16:00 - INFO - 设备注册: app_xxxxxx (mobile_app)
2026-02-14 09:16:05 - INFO - 配对成功: A1B2C3D4
2026-02-14 09:17:00 - INFO - 消息转发: app_xxx -> nanobot_local_xxx
2026-02-14 09:17:05 - INFO - 回复转发: nanobot_local_xxx -> app_xxx
```

### 本地 Nanobot 日志

**Windows 命令行输出**：
```
正在连接云端: ws://TRIX_SERVER_HOST:8765/nanobot/ws...
设备注册成功: nanobot_local_xxxxxx
配对码已发送到云端: A1B2C3D4
收到消息: 你好
```

### App 前端日志

**浏览器控制台**（按 F12）：
```
[NanobotBridge] 服务器地址: ws://TRIX_SERVER_HOST:8765
[NanobotBridge] 设备 ID: app_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
[NanobotBridge] WebSocket 已连接
[NanobotBridge] 配对成功
[NanobotBridge] 消息已发送: 1234567890
[NanobotBridge] 收到回复: {...}
```

---

## 🔧 常用命令

### 重启云端服务器

```bash
ssh root@TRIX_SERVER_HOST

# 查看进程
ps aux | grep cloud_server

# 停止服务器
pkill -f cloud_server.py

# 启动服务器
python3 /root/cloud_server.py > /tmp/cloud_server.log 2>&1 &

# 验证启动
netstat -tuln | grep 8765
```

### 查看端口占用

```bash
ssh root@TRIX_SERVER_HOST

# 查看所有监听端口
netstat -tuln

# 查看特定端口
netstat -tuln | grep 8765

# 或使用 ss 命令
ss -tuln | grep 8765
```

### 测试 WebSocket 连接

**在本地 Windows PowerShell 中**：
```bash
# 使用 telnet 测试端口
telnet TRIX_SERVER_HOST 8765

# 或使用 curl 测试
curl -i http://TRIX_SERVER_HOST:8765
```

---

## 📖 完整文档

详细配置和故障排查，请参考：
- **[NANOBOT_THREE_WAY_CONNECTION_GUIDE.md](NANOBOT_THREE_WAY_CONNECTION_GUIDE.md)** - 完整的三端连通指南
- **[CLOUD_SERVER_AND_APP_IMPLEMENTATION.md](CLOUD_SERVER_AND_APP_IMPLEMENTATION.md)** - 云端服务器实现文档
- **[MYAPP_INTEGRATION_GUIDE.md](MYAPP_INTEGRATION_GUIDE.md)** - App 集成指南

---

## 📞 配置支持

### 云端服务器问题
- 日志位置：`/tmp/cloud_server.log`
- 重启命令：`pkill -f cloud_server.py && python3 /root/cloud_server.py > /tmp/cloud_server.log 2>&1 &`
- 端口检查：`netstat -tuln | grep 8765`

### 本地 Nanobot 问题
- 启动位置：`e:\desktop\nanobot\nanobot`
- 启动命令：`python web_interface_final.py`
- 访问地址：`http://localhost:5000`

### App 前端问题
- 启动位置：`e:\desktop\trix-3d-companion`
- 启动命令：`npm run dev`
- 访问地址：`http://localhost:5173`
- 控制台：按 F12 打开

---

## ✅ 配置完成清单

- [x] **云端服务器** - 已启动并运行在 `TRIX_SERVER_HOST:8765`
- [ ] **本地 Nanobot** - 需要启动：`python web_interface_final.py`
- [ ] **App 前端** - 需要启动：`npm run dev`
- [ ] **本地 Nanobot 连接云端** - 启动后自动连接
- [ ] **App 配对 Nanobot** - 使用配对码配对
- [ ] **端到端消息测试** - 发送"你好"测试

---

**配置完成度**: 1/3 （云端服务器✅ | 本地Nanobot⏳ | App前端⏳）

**下一步**: 启动本地 Nanobot 和 App 前端，完成三端连通！
