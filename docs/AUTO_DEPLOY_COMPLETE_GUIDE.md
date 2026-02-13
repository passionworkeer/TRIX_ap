# GitHub Actions 自动部署完整指南

> **目标**: 通过 Git 推送代码自动部署到服务器，实现 `git push` 后自动构建、上传、部署的全流程

---

## 📋 目录

1. [架构概览](#架构概览)
2. [前置要求](#前置要求)
3. [服务器端配置](#服务器端配置)
4. [GitHub 配置](#github-配置)
5. [本地配置](#本地配置)
6. [工作原理](#工作原理)
7. [关键文件说明](#关键文件说明)
8. [常见问题](#常见问题)
9. [AI 协作指南](#ai-协作指南)

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                     自动部署流程架构                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐     push to main      ┌──────────────────┐   │
│  │ 本地开发环境 │ ──────────────────>  │  GitHub 仓库     │   │
│  │             │                      │  │                  │   │
│  │ git push   │                      │  └──────────────────┘   │
│  └─────────────┘                      │           │             │
│                                        │           │ trigger     │
│                                        ▼           ▼             │
│                                  ┌─────────────────────┐          │
│                                  │ GitHub Actions     │          │
│                                  │ Workflow:         │          │
│                                  │ 1. 检出代码      │          │
│                                  │ 2. 安装依赖      │          │
│                                  │ 3. 构建项目      │          │
│                                  │ 4. 打包产物      │          │
│                                  │ 5. SSH 连接服务器 │          │
│                                  │ 6. 上传文件      │          │
│                                  │ 7. 部署更新      │          │
│                                  └─────────────────────┘          │
│                                               │                │
│                                               │ SSH            │
│                                               ▼                │
│                                  ┌─────────────────────┐          │
│                                  │   你的服务器        │          │
│                                  │   TRIX_SERVER_HOST   │          │
│                                  │   ┌─────────────┐  │          │
│                                  │   │ Nginx       │  │          │
│                                  │   │ /var/www/   │  │          │
│                                  │   │  trix-3d-   │  │          │
│                                  │   │  companion- │  │          │
│                                  │   │  web/       │  │          │
│                                  │   └─────────────┘  │          │
│                                  └─────────────────────┘          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 前置要求

### 服务器要求
- **操作系统**: Ubuntu/Debian (本指南基于 Ubuntu 20.04)
- **内存**: 最低 1GB（本项目运行在 2GB 服务器上）
- **网络**: 公网 IP，开放 22（SSH）、80（HTTP）、443（HTTPS）端口

### 本地环境
- **Git**: 已安装并配置
- **GitHub CLI** (`gh`): 用于自动化配置 Secrets
- **Node.js**: 本地开发环境（可选，GitHub Actions 会自动安装）

### GitHub 仓库
- **仓库**: 已创建 GitHub 仓库
- **权限**: 有权限配置 Secrets 和 Actions

---

## 服务器端配置

### 步骤 1: 安装必要软件

**SSH 连接到服务器**:
```bash
ssh root@TRIX_SERVER_HOST
```

**安装 Nginx、Git、Node.js 20**:
```bash
# 更新系统
apt update && apt upgrade -y

# 安装 Nginx 和 Git
apt install -y nginx git curl

# 安装 Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 验证安装
nginx -v
git --version
node -v
npm -v
```

**停止 Apache（如果占用 80 端口）**:
```bash
systemctl stop apache2
systemctl disable apache2
systemctl start nginx
systemctl enable nginx
```

---

### 步骤 2: 创建网站目录

```bash
# 创建网站目录
mkdir -p /var/www/trix-3d-companion-web

# 设置权限（Nginx 运行用户）
chown -R www-data:www-data /var/www/trix-3d-companion-web
chmod -R 755 /var/www/trix-3d-companion-web

# 验证
ls -la /var/www/
```

---

### 步骤 3: 生成 SSH 密钥对

**生成 ed25519 密钥对**（推荐，更安全）:
```bash
# 生成密钥对
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions -N ""

# 查看公钥
cat ~/.ssh/github_actions.pub
```

**配置公钥到服务器**:
```bash
# 添加公钥到授权列表
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys

# 设置正确权限
chmod 700 ~/.ssh
chmod 600 ~/.ssh/github_actions
chmod 600 ~/.ssh/authorized_keys

# 测试密钥（可选）
ssh -i ~/.ssh/github_actions localhost "echo 'SSH 密钥配置成功'"
```

---

### 步骤 4: 配置 Nginx

**创建虚拟主机配置**:
```bash
nano /etc/nginx/sites-available/trix-3d-companion
```

**复制以下配置**（根据你的项目调整）:
```nginx
server {
    listen 80;
    server_name TRIX_SERVER_HOST;  # 修改为你的域名或 IP

    root /var/www/trix-3d-companion-web;
    index index.html;

    # 日志
    access_log /var/log/nginx/trix-3d-companion-access.log;
    error_log /var/log/nginx/trix-3d-companion-error.log;

    # 字符集
    charset utf-8;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss
               application/rss+xml font/truetype font/opentype
               application/vnd.ms-fontobject image/svg+xml;

    # 静态资源缓存（开发阶段禁用）
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
    }

    # 前端路由支持（SPA）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

**启用配置**:
```bash
# 创建软链接
ln -s /etc/nginx/sites-available/trix-3d-companion /etc/nginx/sites-enabled/

# 删除默认配置（可选）
rm -f /etc/nginx/sites-enabled/default

# 测试配置
nginx -t

# 重启 Nginx
systemctl restart nginx

# 验证运行
systemctl status nginx
```

---

### 步骤 5: 配置防火墙（可选）

```bash
# 安装 UFW
apt install -y ufw

# 允许 SSH
ufw allow OpenSSH

# 允许 HTTP/HTTPS
ufw allow 'Nginx Full'

# 启用防火墙
ufw --force enable

# 查看状态
ufw status
```

---

## GitHub 配置

### 步骤 1: 复制私钥

**在服务器上获取私钥**:
```bash
cat ~/.ssh/github_actions
```

**复制完整输出**，包括：
```
-----BEGIN OPENSSH PRIVATE KEY-----
...（私钥内容）...
-----END OPENSSH PRIVATE KEY-----
```

---

### 步骤 2: 配置 GitHub Secrets

**方式 A：使用 GitHub CLI（推荐）**

```bash
# 安装 GitHub CLI（如果未安装）
# Windows: winget install GitHub.cli
# Mac: brew install gh
# Linux: 参考 https://cli.github.com/

# 认证
gh auth login

# 设置 Secrets
gh secret set SERVER_HOST -b"TRIX_SERVER_HOST" -R your-username/TRIX_ap
gh secret set SERVER_USER -b"root" -R your-username/TRIX_ap
gh secret set SSH_PRIVATE_KEY -b"$(cat ~/.ssh/github_actions)" -R your-username/TRIX_ap

# 验证
gh secret list -R your-username/TRIX_ap
```

**方式 B：使用 GitHub Web UI**

1. 访问: `https://github.com/your-username/TRIX_ap/settings/secrets/actions`
2. 点击 "New repository secret"
3. 添加以下 3 个 Secrets:

   | Name | Value | 说明 |
   |-------|-------|------|
   | `SERVER_HOST` | `TRIX_SERVER_HOST` | 服务器 IP |
   | `SERVER_USER` | `root` | SSH 用户名 |
   | `SSH_PRIVATE_KEY` | (私钥内容) | 完整私钥 |

---

### 步骤 3: 创建 GitHub Actions 工作流

**创建工作流文件**: `.github/workflows/deploy.yml`

```yaml
name: 自动部署到服务器

on:
  push:
    branches:
      - main  # 推送到 main 分支时触发

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      # 1. 检出代码
      - name: 检出代码
        uses: actions/checkout@v4

      # 2. 安装 Node.js
      - name: 设置 Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      # 3. 安装依赖并构建
      - name: 安装依赖
        run: npm install

      - name: 构建项目
        run: |
          npm install terser --save-dev
          npm run build

      # 4. 打包构建产物
      - name: 打包构建产物
        run: |
          cd dist
          tar -czf ../trix-build.tar.gz .
          cd ..

      # 5. 上传构建产物到服务器
      - name: 复制文件到服务器
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          port: 22
          source: "trix-build.tar.gz"
          target: "/tmp/"

      # 6. 在服务器上部署
      - name: 在服务器上部署
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          port: 22
          script_stop: true
          script: |
            # 备份当前版本（可回滚）
            if [ -d "/var/www/trix-3d-companion-web" ]; then
              rm -rf /var/www/trix-3d-companion-web-backup
              cp -r /var/www/trix-3d-companion-web /var/www/trix-3d-companion-web-backup
            fi

            # 解压到临时目录
            mkdir -p /tmp/trix-deploy
            tar -xzf /tmp/trix-build.tar.gz -C /tmp/trix-deploy

            # 部署新版本
            rm -rf /var/www/trix-3d-companion-web/*
            cp -r /tmp/trix-deploy/* /var/www/trix-3d-companion-web/

            # 设置权限
            chown -R www-data:www-data /var/www/trix-3d-companion-web
            chmod -R 755 /var/www/trix-3d-companion-web

            # 刷新文件时间戳（防止缓存）
            find /var/www/trix-3d-companion-web -type f -exec touch {} +

            # 清理临时文件
            rm -rf /tmp/trix-deploy
            rm /tmp/trix-build.tar.gz

            # 检查 Nginx 配置
            nginx -t

            # 重启 Nginx
            systemctl reload nginx

            echo "✓ 部署成功！"
            echo "网站地址: http://TRIX_SERVER_HOST"
            free -h | grep "Mem:"
```

**提交并推送**:
```bash
git add .github/workflows/deploy.yml
git commit -m "feat: 添加 GitHub Actions 自动部署"
git push origin main
```

---

## 本地配置

### 步骤 1: 安装 GitHub CLI

**Windows**:
```powershell
winget install GitHub.cli
```

**Mac**:
```bash
brew install gh
```

**Linux (Ubuntu/Debian)**:
```bash
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
&& echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list \
&& apt update \
&& apt install gh
```

### 步骤 2: 认证 GitHub

```bash
gh auth login
# 选择 GitHub.com
# 选择 HTTPS（推荐）或 SSH
# 浏览器完成认证
```

### 步骤 3: 验证配置

```bash
# 查看 GitHub 用户
gh auth status

# 查看仓库
gh repo view your-username/TRIX_ap

# 查看 Secrets
gh secret list -R your-username/TRIX_ap
```

---

## 工作原理

### 自动化流程

```
1. 本地开发 → 修改代码
       ↓
2. git commit → 提交到本地仓库
       ↓
3. git push origin main → 推送到 GitHub
       ↓
4. GitHub 检测到 main 分支更新
       ↓
5. 触发 GitHub Actions 工作流
       ↓
6. GitHub Actions 执行：
    a. 检出代码
    b. 安装 Node.js 20
    c. 安装项目依赖 (npm install)
    d. 构建项目 (npm run build)
    e. 打包构建产物 (tar)
    f. 通过 SSH 连接服务器
    g. 上传构建产物
    h. 解压并部署到 /var/www/
    i. 备份上一版本
    j. 刷新 Nginx
       ↓
7. 部署完成 → 网站更新 ✅
```

### 关键技术

| 技术 | 作用 | 优势 |
|------|------|------|
| **GitHub Actions** | CI/CD 平台 | 免费、强大、易用 |
| **SSH 密钥认证** | 服务器访问 | 无需密码、更安全 |
| **GitHub Secrets** | 存储敏感信息 | 加密存储、不暴露 |
| **Nginx** | Web 服务器 | 高性能、低内存 |
| **构建在云端** | 在 GitHub 服务器构建 | 不占用本地/服务器资源 |

---

## 关键文件说明

### GitHub Actions 配置
**文件**: `.github/workflows/deploy.yml`

| 关键部分 | 说明 |
|----------|------|
| `on.push.branches` | 触发条件（main 分支） |
| `runs-on` | 运行环境（ubuntu-latest） |
| `steps` | 部署步骤 |
| `${{ secrets.* }}` | 引用 GitHub Secrets |

### Nginx 配置
**文件**: `/etc/nginx/sites-available/trix-3d-companion`

| 关键指令 | 说明 |
|---------|------|
| `root` | 网站根目录 |
| `gzip` | 启用压缩 |
| `try_files` | SPA 路由支持 |
| `expires -1` | 禁用缓存（开发阶段） |

### 服务器目录结构
```
/var/www/
├── trix-3d-companion-web/        # 网站文件（由 Actions 更新）
│   ├── index.html
│   ├── assets/
│   │   ├── index-*.js
│   │   └── index-*.css
│   └── ...（静态资源）
└── trix-3d-companion-web-backup/  # 备份版本（可回滚）
```

---

## 常见问题

### Q1: 部署失败 - "Permission denied"

**原因**: SSH 密钥未正确配置

**解决**:
```bash
# 服务器上检查
cat ~/.ssh/authorized_keys | grep github_actions

# 确保权限正确
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

---

### Q2: 部署失败 - "terser not found"

**原因**: Vite 配置了 terser 压缩，但未安装

**解决**: 在工作流中添加：
```yaml
- name: 安装 terser
  run: npm install terser --save-dev
```

---

### Q3: 网站显示旧版本

**原因**: 浏览器缓存

**解决**:
1. **强制刷新**: `Ctrl + Shift + R`
2. **清除缓存**: F12 → Network → 勾选 "Disable cache"
3. **Nginx 配置**: 设置 `expires -1` 禁用缓存

---

### Q4: 如何回滚到上一版本？

```bash
ssh root@TRIX_SERVER_HOST

# 回滚到备份
rm -rf /var/www/trix-3d-companion-web
cp -r /var/www/trix-3d-companion-web-backup /var/www/trix-3d-companion-web

# 重启 Nginx
systemctl reload nginx
```

---

### Q5: 如何禁用自动部署？

**方式 1**: 重命名工作流文件
```bash
mv .github/workflows/deploy.yml .github/workflows/deploy.yml.disable
git commit -am "禁用自动部署"
git push
```

**方式 2**: 修改触发条件
```yaml
on:
  push:
    branches:
      - main
    tags:  # 只在推送 tag 时触发
      - 'v*'
```

---

### Q6: 服务器内存不足

**检查内存**:
```bash
free -h
ps aux --sort=-%mem | head -10
```

**优化方案**:
- 使用轻量级 Web 服务器（Nginx）
- 不在服务器上构建（在 GitHub Actions 构建）
- 限制 Node.js 进程数
- 升级服务器配置

---

## AI 协作指南

### 概述

本文档设计的目的是让任何 AI（Claude、ChatGPT、GitHub Copilot 等）都能理解并复现这个自动部署流程。

### 核心原则

1. **自动化优先**: 所有能自动化的步骤都应该自动化
2. **配置即代码**: 将配置文件纳入版本控制
3. **安全第一**: 使用 Secrets 存储敏感信息，不硬编码
4. **可回滚**: 每次部署前自动备份上一版本
5. **云端构建**: 在 GitHub Actions 构建，不占用服务器资源

### 关键配置信息（供 AI 参考）

```yaml
# 服务器信息
server:
  host: "TRIX_SERVER_HOST"
  user: "root"
  port: 22
  web_root: "/var/www/trix-3d-companion-web"
  nginx_config: "/etc/nginx/sites-available/trix-3d-companion"

# GitHub 仓库
github:
  owner: "meowdoone"
  repo: "TRIX_ap"
  branch: "main"

# GitHub Actions 工作流
workflow:
  file: ".github/workflows/deploy.yml"
  trigger:
    branches: ["main"]
  runs_on: "ubuntu-latest"
  node_version: "20"

# 部署流程
deploy_steps:
  - checkout
  - setup_node
  - install_dependencies
  - build
  - package
  - upload_to_server
  - backup_current_version
  - deploy_new_version
  - reload_nginx

# 安全配置
secrets:
  - name: "SERVER_HOST"
    value: "TRIX_SERVER_HOST"
  - name: "SERVER_USER"
    value: "root"
  - name: "SSH_PRIVATE_KEY"
    type: "ssh_private_key"
    path_on_server: "~/.ssh/github_actions"
```

### AI 使用建议

#### 场景 1: AI 需要部署新版本

**提示词模板**:
```
我的项目已配置 GitHub Actions 自动部署到服务器 TRIX_SERVER_HOST。
请帮我：
1. 检查是否有未提交的代码
2. 提交并推送到 main 分支
3. 查看部署状态
4. 验证网站是否更新

服务器配置：
- IP: TRIX_SERVER_HOST
- 网站目录: /var/www/trix-3d-companion-web
- GitHub 仓库: meowdoone/TRIX_ap
```

#### 场景 2: AI 需要调试部署问题

**提示词模板**:
```
自动部署失败了，请帮我排查：

1. 查看最近的 GitHub Actions 运行日志
2. 检查失败原因
3. 提供解决方案

相关信息：
- 仓库: meowdoone/TRIX_ap
- 服务器: TRIX_SERVER_HOST
- 工作流文件: .github/workflows/deploy.yml
```

#### 场景 3: AI 需要修改部署配置

**提示词模板**:
```
请帮我修改自动部署配置：

需求: [描述你的需求]

当前配置：
- 工作流: .github/workflows/deploy.yml
- Nginx: /etc/nginx/sites-available/trix-3d-companion
- 服务器: TRIX_SERVER_HOST

请：
1. 修改配置文件
2. 测试配置语法
3. 提交并推送
4. 验证部署成功
```

### 关键文件清单

| 文件路径 | 用途 | 是否纳入版本控制 |
|---------|------|-----------------|
| `.github/workflows/deploy.yml` | GitHub Actions 工作流 | ✅ 是 |
| `deploy/nginx.conf` | Nginx 配置模板 | ✅ 是 |
| `docs/AUTO_DEPLOY_COMPLETE_GUIDE.md` | 本文档 | ✅ 是 |
| `/etc/nginx/sites-available/trix-3d-companion` | 服务器 Nginx 配置 | ❌ 否（服务器上） |
| `~/.ssh/github_actions` | SSH 私钥 | ❌ 否（GitHub Secrets） |
| `~/.ssh/github_actions.pub` | SSH 公钥 | ❌ 否（服务器上） |

### 验证清单

部署完成后，AI 可以运行以下检查：

```bash
# 1. 检查 Git 状态
git status
git log origin/main..main --oneline

# 2. 检查 GitHub Actions
gh run list -R meowdoone/TRIX_ap --limit 3

# 3. 检查服务器文件
ssh root@TRIX_SERVER_HOST "ls -la /var/www/trix-3d-companion-web"

# 4. 检查 Nginx 状态
ssh root@TRIX_SERVER_HOST "systemctl status nginx"

# 5. 验证网站访问
curl -I http://TRIX_SERVER_HOST
```

---

## 📚 参考资源

- [GitHub Actions 官方文档](https://docs.github.com/en/actions)
- [GitHub CLI 文档](https://cli.github.com/)
- [Nginx 官方文档](https://nginx.org/en/docs/)
- [SSH 密钥管理](https://www.ssh.com/academy/ssh/key)

---

## 📝 更新日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-02-12 | 1.0.0 | 初始版本 |
| 2026-02-12 | 1.1.0 | 添加 AI 协作指南 |

---

**作者**: Claude Sonnet 4.5
**项目**: TRIX 3D Companion
**仓库**: https://github.com/meowdoone/TRIX_ap

---

> 💡 **提示**: 将此文档保存到你的项目 `docs/` 目录，并分享给任何需要协助部署的 AI 助手！
