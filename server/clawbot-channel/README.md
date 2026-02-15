# Clawbot Channel Server

Clawbot Custom Channel 的云端配对服务器，支持 App 与 Clawbot 之间的 WebSocket 通信和配对管理。

## 功能特性

- **配对管理**: 生成配对码和二维码，支持两种配对方式
- **消息转发**: App 与 Clawbot 之间的实时消息转发
- **数据持久化**: SQLite 存储配对关系和消息历史
- **心跳重连**: 自动心跳检测和断线重连

## 技术栈

- Node.js + Express
- Socket.io (WebSocket 服务)
- SQLite (数据存储)
- PM2 (进程管理)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
nano .env
```

修改以下配置项：

```env
PORT=8765
CLAWBOT_WEBHOOK_SECRET=your-secret-here
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=your-bucket
OSS_ACCESS_KEY_ID=your-key
OSS_ACCESS_KEY_SECRET=your-secret
```

### 3. 启动服务器

开发模式：
```bash
npm run dev
```

生产模式（使用 PM2）：
```bash
npm run pm2:start
```

## 部署到服务器

### 方法一：手动部署

1. 将所有文件上传到服务器 `/opt/clawbot-channel/`
2. SSH 登录服务器
3. 执行部署脚本：

```bash
cd /opt/clawbot-channel
chmod +x deploy.sh
./deploy.sh
```

### 方法二：使用脚本上传

```bash
# 从本地执行
scp -r server/clawbot-channel/* ubuntu@47.243.55.130:/opt/clawbot-channel/
```

## API 文档

### HTTP API

#### GET /health
健康检查端点

**响应**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### POST /webhook/clawbot
接收 Clawbot 的 AI 回复

**请求头**:
- `X-Webhook-Secret`: Webhook 密钥（配置在环境变量中）

**请求体**:
```json
{
  "deviceId": "clawbot_xxx",
  "content": "AI 回复内容",
  "contentType": "text",
  "mediaUrl": "https://..."
}
```

#### GET /oss/signed-url?key=xxx
生成 OSS 预签名 URL

### Socket.io 事件

#### App 端事件

**发送**:
- `app_register`: 注册 App
  ```json
  { "userId": "user-uuid" }
  ```
- `request_pairing`: 请求配对
  ```json
  { "userId": "user-uuid", "deviceName": "TRIX Mobile App" }
  ```
- `pair_with_code`: 配对码配对
  ```json
  { "code": "ABC123" }
  ```
- `pair_with_token`: Token 配对
  ```json
  { "token": "uuid-token" }
  ```
- `app_message`: 发送消息
  ```json
  { "content": "消息内容", "contentType": "text", "mediaUrl": "..." }
  ```
- `ping`: 心跳
- `unpair`: 解绑

**接收**:
- `pairing_success`: 配对成功
- `bot_message`: Bot 消息
- `unpaired`: 已解绑
- `pong`: 心跳响应
- `error`: 错误消息

#### Clawbot 端事件

**发送**:
- `bot_connect`: Bot 连接
  ```json
  { "deviceId": "clawbot-xxx", "pairingId": "pairing-uuid" }
  ```

**接收**:
- `app_message`: App 消息

## 数据库结构

### pairings 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| pairing_code | TEXT | 配对码（6位） |
| pairing_token | TEXT | 二维码 Token |
| user_id | TEXT | 用户 ID |
| device_id | TEXT | Clawbot 设备 ID |
| device_name | TEXT | 设备名称 |
| status | TEXT | 状态: pending/paired/unpaired |
| created_at | DATETIME | 创建时间 |
| paired_at | DATETIME | 配对时间 |
| expires_at | DATETIME | 过期时间 |
| socket_id | TEXT | Socket.io 连接 ID |

### messages 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| pairing_id | TEXT | 关联配对 ID |
| direction | TEXT | app_to_bot / bot_to_app |
| content | TEXT | 消息内容 |
| content_type | TEXT | 消息类型: text/image/video |
| media_url | TEXT | 媒体文件 URL |
| created_at | DATETIME | 创建时间 |
| delivered | BOOLEAN | 是否已送达 |

## 维护命令

查看日志：
```bash
pm2 logs clawbot-channel
```

重启服务：
```bash
pm2 restart clawbot-channel
```

停止服务：
```bash
pm2 stop clawbot-channel
```

查看状态：
```bash
pm2 status
```

## 故障排查

1. **端口被占用**
   ```bash
   # 查看端口占用
   lsof -i :8765
   # 杀死进程
   kill -9 <PID>
   ```

2. **数据库错误**
   ```bash
   # 删除数据库重新初始化
   rm ./data/pairing.db
   pm2 restart clawbot-channel
   ```

3. **Socket.io 连接失败**
   - 检查防火墙规则
   - 确认 CORS 配置正确
   - 查看浏览器控制台错误信息
