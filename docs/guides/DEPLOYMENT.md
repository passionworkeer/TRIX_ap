# TRIX 3D Companion - 部署指南

> 本文档详细介绍生产环境部署流程
> **最后更新**: 2026-03-31（桌面端 101 IPC handlers；preload 79 methods；Float 260×280；pet-state.ts 模块；Gateway Triple-layer Health + WS RPC；preferences/friends/notifications stubs 待 IPC 实现）

---

## 目录

1. [架构概览](#1-架构概览)
2. [服务器要求](#2-服务器要求)
3. [部署步骤](#3-部署步骤)
4. [前端部署](#4-前端部署)
5. [TRIX Native Server 部署](#5-trix-native-server-部署)
6. [Nginx 配置](#6-nginx-配置)
7. [PM2 进程管理](#7-pm2-进程管理)
8. [域名与 HTTPS](#8-域名与-https)
9. [监控与维护](#9-监控与维护)
10. [故障排查](#10-故障排查)

---

## 1. 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                        生产架构                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────┐    ┌──────────────────┐    ┌───────────────┐   │
│   │  用户设备  │───▶│    Nginx        │───▶│  Web 前端    │   │
│   │ (Browser) │    │  (负载均衡/静态) │    │  (Vite 构建)  │   │
│   └──────────┘    └────────┬─────────┘    └───────────────┘   │
│                             │                                     │
│                             ▼                                     │
│                    ┌──────────────────┐                          │
│                    │  TRIX Native    │                          │
│                    │  Server          │                          │
│                    │  (端口 8788)      │                          │
│                    └────────┬─────────┘                          │
│                             │                                     │
│                             ▼                                     │
│                    ┌──────────────────┐                          │
│                    │  OpenClaw        │                          │
│                    │  Gateway         │                          │
│                    │  (端口 18789)     │                          │
│                    └──────────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 服务端口

| 服务 | 端口 | 协议 | 说明 |
|------|------|------|------|
| Nginx | 80/443 | HTTP/HTTPS | Web 前端入口 |
| TRIX Native Server | 8788 | HTTP/WebSocket | iOS-Web 消息同步 |
| OpenClaw Gateway | 18789 | WebSocket | AI 消息网关 |

---

## 2. 服务器要求

### 最低配置

| 资源 | 最低要求 |
|------|----------|
| CPU | 2 核心 |
| 内存 | 2 GB |
| 磁盘 | 20 GB SSD |
| 带宽 | 5 Mbps |

### 推荐配置

| 资源 | 推荐配置 |
|------|----------|
| CPU | 4 核心 |
| 内存 | 4 GB |
| 磁盘 | 50 GB SSD |
| 带宽 | 10 Mbps |

---

## 3. 部署步骤

### 整体流程

```
1. 服务器初始化
      │
      ▼
2. 部署 Nginx
      │
      ▼
3. 部署 TRIX Native Server
      │
      ▼
4. 部署 OpenClaw Gateway (可选)
      │
      ▼
5. 构建并部署前端
      │
      ▼
6. 配置域名与 SSL
```

---

## 4. 前端部署

### 4.1 构建前端

```bash
# 进入项目目录
cd trix-3d-companion

# 安装依赖
npm install

# 构建生产版本
npm run build
```

构建产物输出到 `dist/` 目录。

### 4.2 上传到服务器

```bash
# 上传构建产物
scp -r ./dist/* root@<服务器IP>:/var/www/html/

# 或使用 rsync
rsync -avz --delete ./dist/ root@<服务器IP>:/var/www/html/
```

---

## 5. TRIX Native Server 部署

### 5.1 安装依赖

```bash
# 连接服务器
ssh root@<服务器IP> -p 22222

# 安装 Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# 安装 PM2
npm install -g pm2
```

### 5.2 部署 Server

```bash
# 进入项目目录
cd /root/trix-3d-companion

# 安装依赖
npm install

# 构建 packages
cd packages/trix-openclaw-native
npm install
npm run build
```

### 5.3 启动服务

```bash
# 使用 PM2 启动
pm2 start /root/trix-3d-companion/packages/trix-openclaw-native/dist/server/TrixNativeServer.js \
  --name trix-native \
  --env PORT=8788 \
  --env NODE_ENV=production \
  --env TRIX_NATIVE_ADMIN_TOKEN=your-secure-token \
  --env TRIX_NATIVE_PUBLIC_BASE_URL=https://trix.love
```

---

## 6. Nginx 配置

### 6.1 安装 Nginx

```bash
apt-get update
apt-get install -y nginx
```

### 6.2 配置文件

创建 `/etc/nginx/sites-available/trix-3d-companion`:

```nginx
server {
    listen 80;
    server_name trix.love;

    # 前端静态文件
    root /var/www/html;
    index index.html;

    # 前端路由支持 (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # TRIX Native Server 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:8788;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 支持
    # ⚠️ 注意: proxy_pass 必须包含 /ws 前缀，否则 Nginx 会将 /ws/phone 转发为 /phone（剥离 /ws/）
    # 正确写法 1: proxy_pass http://127.0.0.1:8788/ws;  (推荐，保留路径)
    # 正确写法 2: proxy_pass http://127.0.0.1:8788; + rewrite ^/ws/(.*) /$1 break;
    location /ws {
        proxy_pass http://127.0.0.1:8788/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    # 附件静态服务
    location /attachments/ {
        alias /var/www/html/attachments/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

### 6.3 启用配置

```bash
# 启用站点
ln -s /etc/nginx/sites-available/trix-3d-companion /etc/nginx/sites-enabled/

# 测试配置
nginx -t

# 重载 Nginx
systemctl reload nginx
```

---

## 7. PM2 进程管理

### 常用命令

```bash
# 查看进程状态
pm2 list

# 查看日志
pm2 logs trix-native

# 重启服务
pm2 restart trix-native

# 停止服务
pm2 stop trix-native

# 删除服务
pm2 delete trix-native

# 开机自启
pm2 save
pm2 startup
```

### 7.1 配置文件

创建 `/root/trix-3d-companion/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'trix-native',
    script: './packages/trix-openclaw-native/dist/server/TrixNativeServer.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'development',
      PORT: 8788
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 8788,
      TRIX_NATIVE_ADMIN_TOKEN: 'your-secure-token',
      TRIX_NATIVE_PUBLIC_BASE_URL: 'https://trix.love'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    max_memory_restart: '500M',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

### 7.2 使用配置启动

```bash
# 启动
pm2 start ecosystem.config.js --env production

# 保存进程列表 (开机自启)
pm2 save
```

---

## 8. 域名与 HTTPS

### 8.1 配置域名

1. 在域名服务商处添加 A 记录:
   - `trix.love` → `TRIX_SERVER_HOST`
2. 或使用 IP 直接访问

### 8.2 配置 SSL (Let's Encrypt)

```bash
# 安装 Certbot
apt-get install -y certbot python3-certbot-nginx

# 获取证书
certbot --nginx -d trix.love

# 自动续期
certbot renew --dry-run
```

---

## 9. 监控与维护

### 9.1 健康检查

```bash
# 检查前端
curl https://trix.love/

# 检查 TRIX Native Server（通过 Nginx 反向代理）
curl https://trix.love/api/health

# 检查 WebSocket
wscat -c wss://trix.love/ws/phone?code=test
```

### 9.2 日志管理

```bash
# Nginx 访问日志
tail -f /var/log/nginx/access.log

# Nginx 错误日志
tail -f /var/log/nginx/error.log

# TRIX Native Server 日志
pm2 logs trix-native --lines 100
```

### 9.3 性能监控

推荐监控项:
- CPU 使用率
- 内存使用率
- 磁盘空间
- 网络带宽
- 请求响应时间

---

## 10. 故障排查

### 10.1 前端加载失败

```bash
# 检查 Nginx 状态
systemctl status nginx

# 检查文件权限
ls -la /var/www/html/

# 检查 Nginx 错误日志
tail -f /var/log/nginx/error.log
```

### 10.2 TRIX Native Server 无法连接

```bash
# 检查端口是否监听
netstat -tlnp | grep 8788

# 检查防火墙
ufw status

# 检查 PM2 进程
pm2 list
pm2 logs trix-native
```

### 10.3 WebSocket 连接失败

```bash
# 检查 WebSocket 端口（TRIX Native Server :8788）
netstat -tlnp | grep 8788

# 测试 WebSocket 连接（TRIX Native Server）
wscat -c wss://trix.love/ws
```

### 10.4 文件上传失败

```bash
# 检查 OSS 配置
# 1. 检查 Access Key 权限
# 2. 检查 Bucket 策略
# 3. 检查防火墙端口 (443, 80)
```

---

## 快速部署命令汇总

```bash
# 1. 服务器初始化
ssh root@TRIX_SERVER_HOST -p 22222
apt-get update && apt-get install -y nodejs nginx pm2

# 2. 部署 TRIX Native Server
cd /root/trix-3d-companion
npm install
cd packages/trix-openclaw-native && npm install && npm run build
pm2 start ecosystem.config.js --env production
pm2 save

# 3. 配置 Nginx
# (按上文配置 Nginx)

# 4. 部署前端
# (本地执行) npm run build
# (上传) scp -r ./dist/* root@TRIX_SERVER_HOST:/var/www/html/

# 5. 验证
curl https://trix.love/api/health
```

---

## 相关文档

- [TRIX Native 通道指南](../TRIX_NATIVE_CHANNEL.md)
- [TRIX Native Channel 完整协议](../TRIX_NATIVE_CHANNEL.md)
- [API 文档](../api/API_DOCUMENTATION.md)
- [服务器操作指南](./SERVER_GUIDE.md)

---

**最后更新**: 2026-03-30（生产域名迁移至 trix.love；Nginx server_name、certbot、健康检查全部更新）
