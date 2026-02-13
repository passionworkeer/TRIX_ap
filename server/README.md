# Nanobot 云端服务器部署指南

## 架构说明

```
┌─────────────────┐         ┌──────────────────────────┐         ┌─────────────────┐
│   手机 App      │ ◄─────► │      阿里云服务器         │ ◄─────► │   本地 Nanobot  │
│  (React Web)    │         │   (WebSocket Server)      │         │  (Python Flask) │
│                 │         │                          │         │                 │
│  • 输入配对码   │         │  • 设备注册管理          │         │  • 生成配对码   │
│  • 发送消息     │         │  • 配对关系维护          │         │  • 执行操作     │
│  • 接收回复     │         │  • 消息转发              │         │  • 返回结果     │
└─────────────────┘         └──────────────────────────┘         └─────────────────┘
```

## 文件结构

```
server/
├── cloud_server.py    # 云端 WebSocket 服务器
├── deploy.sh          # 一键部署脚本
└── nginx.conf         # Nginx 配置文件
```

## 部署步骤

### 1. 上传代码到服务器

```bash
# 方式一：使用 SCP
scp -r server/* root@47.243.55.130:/opt/nanobot-cloud/

# 方式二：使用 Git（推荐）
git clone <your-repo>
cd trix-3d-companion/server
```

### 2. 执行部署脚本

```bash
# SSH 登录服务器
ssh root@47.243.55.130

# 进入目录
cd /opt/nanobot-cloud

# 执行部署
chmod +x deploy.sh
./deploy.sh
```

### 3. 配置 Nginx

```bash
# 复制配置文件
cp nginx.conf /etc/nginx/sites-available/nanobot

# 启用站点
ln -s /etc/nginx/sites-available/nanobot /etc/nginx/sites-enabled/

# 测试配置
nginx -t

# 重载 Nginx
systemctl reload nginx
```

### 4. 检查运行状态

```bash
# 查看服务状态
systemctl status nanobot-cloud

# 查看日志
journalctl -u nanobot-cloud -f

# 重启服务
systemctl restart nanobot-cloud

# 停止服务
systemctl stop nanobot-cloud
```

## 端口说明

| 端口 | 用途 | 说明 |
|------|------|------|
| 80 | HTTP | Nginx 入口 |
| 8765 | WebSocket | 云端服务器 |

## 防火墙配置

确保以下端口已开放：

```bash
# 阿里云安全组规则
# 端口: 80/80, 协议: TCP, 授权: 0.0.0.0/0
# 端口: 443/443, 协议: TCP, 授权: 0.0.0.0/0

# 服务器防火墙（如果启用）
ufw allow 80/tcp
ufw allow 443/tcp
```

## 使用流程

### App 端

1. 打开 App，进入 Nanobot 配对页面
2. 输入从本地 Nanobot 获取的 8 位配对码
3. 点击"连接"
4. 配对成功后可以发送消息

### 本地 Nanobot 端

1. 启动本地 Nanobot 服务
2. 调用云端 API 注册配对码
3. 等待 App 连接
4. 收到消息后处理并返回

## 消息协议

### 注册设备

```json
{
  "type": "register",
  "device_id": "app_xxx",
  "device_type": "mobile_app"
}
```

### App 配对

```json
{
  "type": "app_pairing",
  "code": "A1B2C3D4",
  "device_id": "app_xxx",
  "client_info": {
    "device_name": "iPhone",
    "platform": "mobile"
  }
}
```

### 发送消息

```json
{
  "type": "chat_message",
  "device_id": "app_xxx",
  "message": "你好",
  "msg_id": "1234567890",
  "message_type": "text"
}
```

### 收到回复

```json
{
  "type": "chat_response",
  "msg_id": "1234567890",
  "response": "你好！有什么可以帮助你？",
  "timestamp": "2025-01-15T10:30:00"
}
```

## 故障排查

### 服务无法启动

```bash
# 查看详细日志
journalctl -u nanobot-cloud -n 100

# 检查端口占用
netstat -tlnp | grep 8765

# 检查 Python 环境
python3 --version
pip3 list | grep websockets
```

### App 无法连接

1. 检查网络连接
2. 确认服务器地址正确：`ws://47.243.55.130/nanobot`
3. 查看浏览器控制台错误信息
4. 确认配对码有效（1 小时内）

### Nginx 代理问题

```bash
# 检查 Nginx 配置
nginx -t

# 查看 Nginx 日志
tail -f /var/log/nginx/error.log

# 重载 Nginx
systemctl reload nginx
```

## MVP 版本限制

- 无 Redis 持久化，服务重启后配对关系丢失
- 不支持离线消息存储
- 无用户认证机制
- 配对码有效期 1 小时
- 单机部署，无负载均衡

## 下一步优化

- [ ] 添加 Redis 持久化
- [ ] 实现用户认证
- [ ] 支持离线消息队列
- [ ] 添加消息加密
- [ ] 实现多服务器负载均衡
- [ ] 添加监控和告警
