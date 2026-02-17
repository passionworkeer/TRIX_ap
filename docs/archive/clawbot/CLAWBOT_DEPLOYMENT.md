# Clawbot Channel 服务器部署文档

> **部署日期**: 2026-02-15
> **服务器**: 47.243.55.130:8765
> **状态**: ✅ 生产环境运行中

---

## 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│  [App] m.jmtrick.com (localhost:5173)                  │
│  React + Vite + TypeScript + Socket.io-client              │
│  - Supabase Auth (user.id)                                │
│  - 连接到 wss://47.243.55.130:8765                         │
└────────────────┬────────────────────────────────────────────────┘
                 │ WebSocket (Socket.io)
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  [服务器 47.243.55.130:8765]                            │
│  Node.js + Express + Socket.io + SQLite                    │
│  - 配对管理 (pairings 表)                                   │
│  - 消息转发 (messages 表)                                   │
│  - App Room (user_{userId})                                 │
│  - Clawbot Socket 存储 (Map: deviceId → socket)            │
└────────────────┬────────────────────────────────────────────────┘
                 │ HTTP Webhook + WebSocket Client
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  [Clawbot] 本地 OpenClaw                                    │
│  运行 Custom Channel 插件                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 服务器部署

### 1. 部署位置

- **目录**: `/opt/clawbot-channel/`
- **用户**: root
- **进程管理**: PM2

### 2. 文件结构

```
/opt/clawbot-channel/
├── server.js                  # 主服务器入口 (Express + Socket.io)
├── package.json              # 依赖配置
├── ecosystem.config.js      # PM2 配置
├── .env                      # 环境变量 (从 .env.example 复制)
├── .env.example             # 环境变量示例
├── config/
│   └── database.js         # SQLite 数据库配置
└── services/
    ├── pairingService.js   # 配对管理服务
    ├── messageService.js   # 消息存储服务
    └── ossService.js      # 阿里云 OSS 集成
```

---

## 环境配置

### .env 配置

```bash
# 服务器端口
PORT=8765

# Supabase 配置
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# 阿里云 OSS 配置（可选）
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=trix-companion
OSS_ACCESS_KEY_ID=your_access_key
OSS_ACCESS_KEY_SECRET=your_secret_key

# 配对码有效期（秒）
PAIRING_CODE_EXPIRES=600

# 日志级别
LOG_LEVEL=info
```

### ecosystem.config.js

```javascript
module.exports = {
  apps: [{
    name: 'clawbot-channel',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 8765
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G'
  }]
};
```

---

## 数据库设计

### SQLite 数据库

**位置**: `/opt/clawbot-channel/database/clawbot.db`

### 表结构

#### pairings 表

```sql
CREATE TABLE pairings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pairing_id TEXT UNIQUE NOT NULL,
  pairing_code TEXT UNIQUE NOT NULL,
  device_id TEXT NOT NULL,
  user_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  status TEXT DEFAULT 'pending'
);
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `pairing_id` | TEXT | UUID，配对唯一标识 |
| `pairing_code` | TEXT | 6 位配对码 |
| `device_id` | TEXT | Clawbot 设备 ID |
| `user_id` | TEXT | Supabase 用户 ID（可为 NULL） |
| `status` | TEXT | pending/paired/expired |
| `expires_at` | DATETIME | 过期时间 |

#### messages 表

```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pairing_id TEXT NOT NULL,
  sender_type TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text',
  media_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pairing_id) REFERENCES pairings(pairing_id)
);
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `sender_type` | TEXT | 'app' 或 'clawbot' |
| `content` | TEXT | 消息内容 |
| `content_type` | TEXT | text/image/video/file |
| `media_url` | TEXT | 媒体文件 URL |

---

## PM2 命令

### 基本操作

```bash
# 启动服务
pm2 start ecosystem.config.js

# 停止服务
pm2 stop clawbot-channel

# 重启服务
pm2 restart clawbot-channel

# 删除服务
pm2 delete clawbot-channel

# 查看状态
pm2 status

# 查看日志
pm2 logs clawbot-channel
pm2 logs clawbot-channel --lines 100

# 清空日志
pm2 flush
```

### 开机自启

```bash
# 保存当前 PM2 进程列表
pm2 save

# 生成开机启动脚本
pm2 startup

# 按照提示执行生成的命令
```

### 监控

```bash
# 实时监控
pm2 monit

# 查看详细信息
pm2 show clawbot-channel
```

---

## 部署步骤

### 初始部署

```bash
# 1. SSH 连接到服务器
ssh root@47.243.55.130

# 2. 创建项目目录
mkdir -p /opt/clawbot-channel
cd /opt/clawbot-channel

# 3. 上传文件
# (使用 scp 或 git clone)

# 4. 安装依赖
npm install

# 5. 配置环境变量
cp .env.example .env
nano .env

# 6. 创建日志目录
mkdir -p logs
mkdir -p database

# 7. 初始化数据库
# (数据库会在首次运行时自动创建)

# 8. 启动服务
pm2 start ecosystem.config.js

# 9. 查看状态
pm2 status
pm2 logs clawbot-channel
```

### 更新部署

```bash
# 1. 备份当前版本
pm2 stop clawbot-channel
cp -r /opt/clawbot-channel /opt/clawbot-channel.backup

# 2. 更新代码
cd /opt/clawbot-channel
git pull  # 或重新上传文件

# 3. 安装新依赖
npm install

# 4. 重启服务
pm2 restart clawbot-channel

# 5. 检查状态
pm2 status
pm2 logs clawbot-channel --lines 50
```

---

## 健康检查

### 检查脚本

```bash
#!/bin/bash
# health-check.sh

echo "=== Clawbot Channel 健康检查 ==="

# 1. 检查进程
echo -e "\n1. PM2 进程状态:"
pm2 status clawbot-channel

# 2. 检查端口
echo -e "\n2. 端口监听:"
netstat -tuln | grep 8765

# 3. 检查日志
echo -e "\n3. 最近日志:"
pm2 logs clawbot-channel --lines 10 --nostream

# 4. 检查数据库
echo -e "\n4. 数据库文件:"
ls -lh /opt/clawbot-channel/database/

# 5. 检查内存
echo -e "\n5. 内存使用:"
pm2 show clawbot-channel | grep memory
```

### 定时检查

```bash
# 添加到 crontab，每小时检查一次
crontab -e

# 添加以下行：
0 * * * * /opt/clawbot-channel/health-check.sh >> /var/log/clawbot-health.log 2>&1
```

---

## 日志管理

### 日志位置

```
/opt/clawbot-channel/logs/
├── error.log     # 错误日志
└── out.log       # 输出日志
```

### 日志轮转

```bash
# 安装 logrotate
apt install logrotate

# 创建配置文件
cat > /etc/logrotate.d/clawbot-channel << EOF
/opt/clawbot-channel/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

---

## 防火墙配置

### 开放端口

```bash
# UFW 防火墙
ufw allow 8765/tcp
ufw reload

# iptables
iptables -A INPUT -p tcp --dport 8765 -j ACCEPT
service iptables save
```

### 验证端口

```bash
# 检查端口监听
netstat -tuln | grep 8765

# 测试连接
telnet 47.243.55.130 8765
```

---

## 性能优化

### Node.js 优化

```bash
# 设置 Node 环境变量
export NODE_ENV=production
export UV_THREADPOOL_SIZE=4

# 在 ecosystem.config.js 中添加
env: {
  NODE_ENV: 'production',
  UV_THREADPOOL_SIZE: 4
}
```

### SQLite 优化

```javascript
// config/database.js
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database/clawbot.db', (err) => {
  if (err) {
    console.error('数据库连接错误:', err);
  } else {
    // 性能优化设置
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA synchronous = NORMAL');
    db.run('PRAGMA cache_size = -64000');  // 64MB
    db.run('PRAGMA temp_store = MEMORY');
  }
});
```

---

## 备份策略

### 数据库备份

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/opt/backups/clawbot-channel"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 备份数据库
cp /opt/clawbot-channel/database/clawbot.db $BACKUP_DIR/clawbot_$DATE.db

# 压缩备份
gzip $BACKUP_DIR/clawbot_$DATE.db

# 删除 7 天前的备份
find $BACKUP_DIR -name "clawbot_*.db.gz" -mtime +7 -delete

echo "备份完成: clawbot_$DATE.db.gz"
```

### 定时备份

```bash
# 添加到 crontab，每天凌晨 2 点备份
crontab -e

# 添加以下行：
0 2 * * * /opt/clawbot-channel/backup.sh
```

---

## 故障排查

### 常见问题

#### 1. 服务无法启动

```bash
# 查看详细错误
pm2 logs clawbot-channel --err

# 检查端口占用
lsof -i :8765

# 检查权限
ls -la /opt/clawbot-channel/
```

#### 2. 内存泄漏

```bash
# 查看内存使用
pm2 show clawbot-channel | grep memory

# 重启服务
pm2 restart clawbot-channel

# 设置内存限制自动重启
# 在 ecosystem.config.js 中:
max_memory_restart: '500M'
```

#### 3. 数据库锁定

```bash
# 检查数据库锁
lsof /opt/clawbot-channel/database/clawbot.db

# 重启服务释放锁
pm2 restart clawbot-channel
```

---

## 安全建议

1. **使用 HTTPS/WSS**: 生产环境使用 SSL 证书
2. **限制访问**: 配置防火墙白名单
3. **定期备份**: 设置自动备份任务
4. **监控日志**: 定期检查异常日志
5. **更新依赖**: 定期更新 npm 包
6. **配置 CORS**: 限制允许的来源

---

## 相关文档

- [Clawbot Channel 集成指南](./CLAWBOT_CHANNEL_GUIDE.md) - 完整集成文档
- [Clawbot WebSocket 协议](./CLAWBOT_PROTOCOL.md) - 协议规范
