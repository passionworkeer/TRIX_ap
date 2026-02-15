# TRIX 3D Companion 部署完整指南

> **版本**: 2.0
> **最后更新**: 2026-02-14
> **目标**: 从本地开发到生产环境部署的完整流程

---

## 目录

1. [部署概览](#1-部署概览)
2. [GitHub Actions 自动部署](#2-github-actions-自动部署)
3. [服务器配置](#3-服务器配置)
4. [Nginx 配置](#4-nginx-配置)
5. [HTTPS 证书](#5-https-证书)
6. [手动部署](#6-手动部署)
7. [故障排查](#7-故障排查)

---

## 1. 部署概览

### 部署架构

```
┌───────────────┐      git push      ┌──────────────────┐
│  开发环境      │ ──────────────────►│  GitHub 仓库      │
│  (本地 PC)    │                     │  └─.github/workflows/
└───────────────┘                     └────────┬─────────┘
                                               │
                                       trigger on push to main
                                               ▼
                                    ┌───────────────────────┐
                                    │  GitHub Actions        │
                                    │  ├─ Checkout code      │
                                    │  ├─ Install Node.js    │
                                    │  ├─ npm install        │
                                    │  ├─ npm run build      │
                                    │  ├─ Package files      │
                                    │  └─ SSH Deploy         │
                                    └───────────┬───────────┘
                                                │
                                                ▼
                                    ┌───────────────────────────┐
                                    │  阿里云服务器            │
                                    │  TRIX_SERVER_HOST          │
                                    │  ├─ Nginx :80/:443      │
                                    │  └─ /var/www/trix-3d/  │
                                    └───────────────────────────┘
```

### 部署方式对比

| 方式 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **GitHub Actions** | 自动化、版本化 | 需要配置 Actions | 持续开发 |
| **手动部署** | 快速、可控 | 易出错 | 快速测试 |
| **一键脚本** | 简单 | 缺乏灵活性 | 小型项目 |

---

## 2. GitHub Actions 自动部署

### 2.1 前置要求

**服务器要求**:
- Ubuntu/Debian 系统
- SSH 访问权限
- 开放 22（SSH）、80（HTTP）、443（HTTPS）端口
- 已安装 Nginx

**GitHub 配置**:
- GitHub 仓库权限
- 配置 GitHub Secrets

### 2.2 配置 GitHub Secrets

在 GitHub 仓库中配置以下 Secrets：

| Secret 名称 | 说明 | 示例 |
|------------|------|------|
| `SSH_HOST` | 服务器 IP | `TRIX_SERVER_HOST` |
| `SSH_USERNAME` | SSH 用户名 | `root` |
| `SSH_PRIVATE_KEY` | SSH 私钥 | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `DEPLOY_PATH` | 部署路径 | `/var/www/trix-3d-companion-web` |

### 2.3 生成 SSH 密钥对

**在本地生成密钥**:
```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy
```

**复制公钥到服务器**:
```bash
ssh-copy-id -i ~/.ssh/github_deploy.pub root@TRIX_SERVER_HOST
```

**配置 GitHub Secret**:
```bash
# 查看私钥
cat ~/.ssh/github_deploy

# 复制整个私钥（包括 BEGIN/END 行）到 GitHub Secrets
# Secret 名称: SSH_PRIVATE_KEY
```

### 2.4 创建 GitHub Actions 工作流

文件: `.github/workflows/deploy.yml`

```yaml
name: Deploy to Server

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'

    - name: Install dependencies
      run: npm ci

    - name: Build project
      run: npm run build

    - name: Package build files
      run: |
        tar -czf trix-build.tar.gz -C dist .

    - name: Deploy to server
      uses: appleboy/ssh-action@v1.0.0
      with:
        host: ${{ secrets.SSH_HOST }}
        username: ${{ secrets.SSH_USERNAME }}
        key: ${{ secrets.SSH_PRIVATE_KEY }}
        script_stop: true
        script: |
          mkdir -p ${{ secrets.DEPLOY_PATH }}/backup
          mv ${{ secrets.DEPLOY_PATH }}/* ${{ secrets.DEPLOY_PATH }}/backup/ || true

    - name: Upload build files
      uses: appleboy/scp-action@v0.1.7
      with:
        host: ${{ secrets.SSH_HOST }}
        username: ${{ secrets.SSH_USERNAME }}
        key: ${{ secrets.SSH_PRIVATE_KEY }}
        source: "trix-build.tar.gz"
        target: ${{ secrets.DEPLOY_PATH }}

    - name: Extract build files
      uses: appleboy/ssh-action@v1.0.0
      with:
        host: ${{ secrets.SSH_HOST }}
        username: ${{ secrets.SSH_USERNAME }}
        key: ${{ secrets.SSH_PRIVATE_KEY }}
        script_stop: true
        script: |
          cd ${{ secrets.DEPLOY_PATH }}
          tar -xzf trix-build.tar.gz -C .
          rm trix-build.tar.gz

    - name: Reload Nginx
      uses: appleboy/ssh-action@v1.0.0
      with:
        host: ${{ secrets.SSH_HOST }}
        username: ${{ secrets.SSH_USERNAME }}
        key: ${{ secrets.SSH_PRIVATE_KEY }}
        script: |
          nginx -t && nginx -s reload
```

### 2.5 手动触发部署

1. 进入 GitHub 仓库
2. 点击 "Actions" 标签页
3. 选择 "Deploy to Server" 工作流
4. 点击 "Run workflow" 按钮
5. 选择分支并确认

---

## 3. 服务器配置

### 3.1 安装 Nginx

```bash
ssh root@TRIX_SERVER_HOST

# 更新系统
apt update && apt upgrade -y

# 安装 Nginx
apt install -y nginx curl git

# 启动 Nginx
systemctl enable nginx
systemctl start nginx

# 验证安装
nginx -v
```

### 3.2 创建部署目录

```bash
# 创建 Web 根目录
mkdir -p /var/www/trix-3d-companion-web

# 设置权限
chown -R www-data:www-data /var/www/trix-3d-companion-web

# 创建备份目录
mkdir -p /var/www/trix-3d-companion-web/backup
```

---

## 4. Nginx 配置

### 4.1 创建站点配置文件

```bash
nano /etc/nginx/sites-available/trix-3d-companion
```

**完整配置 (HTTP + HTTPS)**:

```nginx
# HTTP -> HTTPS 重定向
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com www.your-domain.com;

    # Let's Encrypt 验证路径
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # 其他请求重定向到 HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS 主站
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL 证书配置（见第 5 节）
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL 优化配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 安全 Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # 网站根目录
    root /var/www/trix-3d-companion-web;
    index index.html;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript
               application/javascript application/xml+rss
               application/json image/svg+xml;

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 所有请求返回 index.html（SPA 路由）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 日志
    access_log /var/log/nginx/trix-3d-companion-access.log;
    error_log /var/log/nginx/trix-3d-companion-error.log;
}
```

### 4.2 启用站点

```bash
# 创建符号链接
ln -s /etc/nginx/sites-available/trix-3d-companion /etc/nginx/sites-enabled/

# 测试配置
nginx -t

# 重载 Nginx
systemctl reload nginx
```

---

## 5. HTTPS 证书

### 5.1 使用 Let's Encrypt 免费 SSL

**安装 Certbot**:

```bash
apt install -y certbot python3-certbot-nginx
```

**获取证书**:

```bash
# 自动配置 Nginx
certbot --nginx -d your-domain.com -d www.your-domain.com

# 或只获取证书，手动配置
certbot certonly --nginx -d your-domain.com -d www.your-domain.com
```

**自动续期**:

```bash
# Certbot 会自动创建 systemd timer
systemctl status certbot.timer

# 手动测试续期
certbot renew --dry-run
```

### 5.2 证书配置

Nginx 配置（已在 4.1 节中）:

```nginx
ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
```

### 5.3 SSL 测试

**检查证书**:

```bash
# 检查证书信息
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# 在线测试
# https://www.ssllabs.com/ssltest/
```

---

## 6. 手动部署

### 6.1 本地构建

```bash
cd e:\desktop\trix-3d-companion

# 安装依赖
npm install

# 构建生产版本
npm run build

# 打包文件
tar -czf trix-build.tar.gz -C dist .
```

### 6.2 上传到服务器

```bash
# 方式 A：使用 SCP
scp trix-build.tar.gz root@TRIX_SERVER_HOST:/var/www/trix-3d-companion-web/

# 方式 B：使用 rsync
rsync -avz --delete dist/ root@TRIX_SERVER_HOST:/var/www/trix-3d-companion-web/
```

### 6.3 服务器端解压

```bash
ssh root@TRIX_SERVER_HOST

cd /var/www/trix-3d-companion-web

# 备份旧版本
mkdir -p backup
tar -czf backup/old-$(date +%Y%m%d-%H%M%S).tar.gz *

# 解压新版本
tar -xzf trix-build.tar.gz

# 清理
rm trix-build.tar.gz

# 设置权限
chown -R www-data:www-data /var/www/trix-3d-companion-web

# 重载 Nginx
nginx -s reload
```

---

## 7. 故障排查

### 7.1 部署失败

**GitHub Actions 失败**:

1. 检查 Secrets 是否正确配置
2. 查看 Actions 日志中的错误信息
3. 验证 SSH 连接：`ssh -i ~/.ssh/github_deploy root@TRIX_SERVER_HOST`

**构建失败**:

```bash
# 本地测试构建
npm run build

# 检查 Node.js 版本
node -v  # 应该是 20.x

# 清除缓存重新安装
rm -rf node_modules package-lock.json
npm install
```

### 7.2 Nginx 问题

**502 Bad Gateway**:

```bash
# 检查 Nginx 状态
systemctl status nginx

# 检查配置
nginx -t

# 查看错误日志
tail -f /var/log/nginx/trix-3d-companion-error.log
```

**404 Not Found**:

```bash
# 检查文件是否存在
ls -la /var/www/trix-3d-companion-web/

# 检查权限
ls -ld /var/www/trix-3d-companion-web

# 检查 Nginx 配置中的 root 路径
nginx -T | grep root
```

### 7.3 HTTPS 问题

**证书过期**:

```bash
# 手动续期
certbot renew

# 强制续期
certbot renew --force-renewal

# 重载 Nginx
nginx -s reload
```

**混合内容警告**:

确保所有资源都使用 HTTPS：
- 检查 HTML 中的 `<img>`、`<script>`、`<link>` 标签
- API 请求使用 `https://`
- WebSocket 使用 `wss://`

### 7.4 回滚部署

```bash
ssh root@TRIX_SERVER_HOST

cd /var/www/trix-3d-companion-web

# 查看备份
ls -lh backup/

# 解压备份
tar -xzf backup/old-YYYYMMDD-HHMMSS.tar.gz

# 重载 Nginx
nginx -s reload
```

---

## 附录

### A. 快速部署命令清单

```bash
# 本地
npm run build
tar -czf trix-build.tar.gz -C dist .
scp trix-build.tar.gz root@TRIX_SERVER_HOST:/var/www/trix-3d-companion-web/

# 服务器
ssh root@TRIX_SERVER_HOST
cd /var/www/trix-3d-companion-web
tar -xzf trix-build.tar.gz
rm trix-build.tar.gz
chown -R www-data:www-data .
nginx -s reload
```

### B. 监控命令

```bash
# 实时日志
tail -f /var/log/nginx/trix-3d-companion-access.log
tail -f /var/log/nginx/trix-3d-companion-error.log

# 网站可用性
curl -I https://your-domain.com

# SSL 证书到期
certbot certificates
```

### C. 相关文档

- [Nanobot 集成指南](NANOBOT_INTEGRATION_GUIDE.md)
- [项目审核报告](PROJECT_AUDIT_REPORT.md)
- [技术栈与亮点](TECH_STACK_AND_HIGHLIGHTS.md)

---

*文档整合自: AUTO_DEPLOY_COMPLETE_GUIDE.md, deployment/DEPLOY.md, deployment/AUTO_DEPLOY.md, deployment/HTTPS_SETUP_GUIDE.md*
