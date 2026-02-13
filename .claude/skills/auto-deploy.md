# 自动部署 Skill

## 描述
快速配置 GitHub Actions 自动部署到服务器，实现 `git push` 后自动构建和部署。

---

## 使用场景

当你需要：
- 将前端项目部署到服务器
- 实现自动化 CI/CD 流程
- 快速部署更新到生产环境
- 配置轻量级部署方案（适合小型服务器）

---

## 前置要求

### 服务器要求
- Ubuntu/Debian 服务器
- SSH 访问权限（root 或 sudo 用户）
- 开放端口：22（SSH）、80（HTTP）、443（HTTPS）
- 最低配置：1GB 内存、10GB 磁盘

### 本地要求
- Git 已安装
- GitHub CLI (`gh`) 已安装
- 项目已推送到 GitHub 仓库

---

## 快速开始

### 第 1 步：收集信息

**提示词**：
```
我需要配置 GitHub Actions 自动部署，请帮我完成。

项目信息：
- GitHub 仓库：[your-username/your-repo]
- 服务器 IP：[your-server-ip]
- SSH 用户：[root 或其他用户]
- 框架：[React/Vue/Next.js/其他]
- 构建命令：[npm run build]
- 输出目录：[dist 或其他]

请：
1. 在服务器上安装必要软件
2. 生成 SSH 密钥对
3. 配置 GitHub Secrets
4. 创建 GitHub Actions 工作流
5. 配置 Nginx
6. 测试自动部署
```

### 第 2 步：提供服务器访问

**方式 A - 提供密码**（临时）：
```
服务器信息：
- IP: 47.243.55.130
- 用户: root
- 密码: [你的密码]

请帮我完成自动部署配置。
```

**方式 B - 本地已有 SSH 密钥**：
```
我已经可以通过 SSH 连接服务器：
ssh root@47.243.55.130

请帮我完成自动部署配置。
```

---

## 配置流程

### 阶段 1: 服务器初始化（5-10 分钟）

**AI 会执行**：
1. ✅ 连接服务器并安装 Nginx、Node.js、Git
2. ✅ 停止冲突服务（如 Apache）
3. ✅ 创建网站目录并设置权限
4. ✅ 生成 SSH 密钥对（用于 GitHub Actions）
5. ✅ 配置公钥到服务器授权列表
6. ✅ 配置 Nginx 虚拟主机

**预期输出**：
```bash
✅ Nginx 已安装并运行
✅ Node.js 20.x 已安装
✅ SSH 密钥已生成：~/.ssh/github_actions
✅ 网站目录已创建：/var/www/[project-name]
```

---

### 阶段 2: GitHub 配置（2-3 分钟）

**AI 会执行**：
1. ✅ 使用 GitHub CLI 配置 Secrets
   - `SERVER_HOST`: 服务器 IP
   - `SERVER_USER`: SSH 用户名
   - `SSH_PRIVATE_KEY`: 私钥内容
2. ✅ 创建 `.github/workflows/deploy.yml`
3. ✅ 提交并推送到 GitHub

**预期输出**：
```bash
✅ GitHub Secrets 已配置
✅ 工作流文件已创建
✅ 代码已推送到 main 分支
```

---

### 阶段 3: 自动部署测试（1-2 分钟）

**AI 会执行**：
1. ✅ 触发 GitHub Actions
2. ✅ 监控部署进度
3. ✅ 验证服务器文件更新
4. ✅ 验证网站访问

**预期输出**：
```bash
✅ GitHub Actions 运行成功
✅ 网站已更新：http://[your-ip]
✅ 部署时间：约 70 秒
```

---

## 关键配置文件

### 1. GitHub Actions 工作流

**文件**: `.github/workflows/deploy.yml`

```yaml
name: 自动部署到服务器

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: 检出代码
        uses: actions/checkout@v4

      - name: 设置 Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: 安装依赖
        run: npm install

      - name: 构建项目
        run: npm run build

      - name: 打包构建产物
        run: |
          cd dist  # 或你的输出目录
          tar -czf ../build.tar.gz .
          cd ..

      - name: 上传到服务器
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          source: "build.tar.gz"
          target: "/tmp/"

      - name: 在服务器上部署
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            # 备份
            if [ -d "/var/www/[project]" ]; then
              rm -rf /var/www/[project]-backup
              cp -r /var/www/[project] /var/www/[project]-backup
            fi

            # 部署
            mkdir -p /tmp/deploy
            tar -xzf /tmp/build.tar.gz -C /tmp/deploy
            rm -rf /var/www/[project]/*
            cp -r /tmp/deploy/* /var/www/[project]/

            # 权限
            chown -R www-data:www-data /var/www/[project]
            chmod -R 755 /var/www/[project]

            # 清理
            rm -rf /tmp/deploy /tmp/build.tar.gz

            # 重启 Nginx
            nginx -t && systemctl reload nginx

            echo "✓ 部署成功"
```

**自定义点**：
- `branches: [main]` - 触发分支
- `cd dist` - 改为你的输出目录
- `/var/www/[project]` - 改为你的项目名称

---

### 2. Nginx 配置模板

**文件**: `/etc/nginx/sites-available/[project]`

```nginx
server {
    listen 80;
    server_name your-ip-or-domain.com;

    root /var/www/[project];
    index index.html;

    # 日志
    access_log /var/log/nginx/[project]-access.log;
    error_log /var/log/nginx/[project]-error.log;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss;

    # 静态资源（开发阶段禁用缓存）
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**启用配置**：
```bash
ln -s /etc/nginx/sites-available/[project] /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## 不同框架适配

### React (Vite)
```yaml
- name: 构建项目
  run: npm run build

- name: 打包构建产物
  run: |
    cd dist
    tar -czf ../build.tar.gz .
```

### Next.js (静态导出)
```yaml
- name: 构建项目
  run: |
    npm run build
    npm run export  # 或在 next.config.js 中配置 output: 'export'

- name: 打包构建产物
  run: |
    cd out  # Next.js 默认输出到 out 目录
    tar -czf ../build.tar.gz .
```

### Vue (Vite)
```yaml
- name: 构建项目
  run: npm run build

- name: 打包构建产物
  run: |
    cd dist
    tar -czf ../build.tar.gz .
```

### 纯静态网站
```yaml
- name: 打包构建产物
  run: |
    tar -czf build.tar.gz .  # 直接打包当前目录
```

---

## 验证部署

### 检查清单

```bash
# 1. 检查 Git 状态
git status

# 2. 查看 GitHub Actions
gh run list --limit 3

# 3. 检查服务器文件
ssh root@[your-ip] "ls -la /var/www/[project]"

# 4. 检查 Nginx 状态
ssh root@[your-ip] "systemctl status nginx"

# 5. 验证网站访问
curl -I http://[your-ip]
```

---

## 常见问题

### Q1: 部署失败 - "Permission denied"
**解决**：SSH 密钥未正确配置
```bash
# 服务器上
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### Q2: 网站显示旧版本
**解决**：浏览器缓存
- 强制刷新：`Ctrl + Shift + R`
- 或在 Nginx 配置中设置 `expires -1`

### Q3: 如何回滚？
```bash
ssh root@[your-ip]
rm -rf /var/www/[project]
cp -r /var/www/[project]-backup /var/www/[project]
systemctl reload nginx
```

### Q4: 如何禁用自动部署？
```bash
mv .github/workflows/deploy.yml .github/workflows/deploy.yml.disabled
git commit -am "禁用自动部署" && git push
```

---

## 进阶功能

### 1. 配置 SSL 证书（Let's Encrypt）
```bash
# 在服务器上
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

### 2. 多环境部署
```yaml
on:
  push:
    branches:
      - main      # 生产环境
      - develop   # 测试环境

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: 设置环境变量
        run: |
          if [ "${{ github.ref }}" = "refs/heads/main" ]; then
            echo "DEPLOY_PATH=/var/www/production" >> $GITHUB_ENV
          else
            echo "DEPLOY_PATH=/var/www/staging" >> $GITHUB_ENV
          fi
```

### 3. 部署通知（Slack/Discord）
```yaml
- name: 发送部署通知
  if: always()
  run: |
    curl -X POST -H 'Content-type: application/json' \
      --data '{"text":"部署 ${{ job.status }}"}' \
      ${{ secrets.WEBHOOK_URL }}
```

---

## 成本优化

### 2GB 服务器优化建议
1. ✅ **使用 Nginx**（内存占用约 10MB）
2. ✅ **不在服务器构建**（在 GitHub Actions 构建）
3. ✅ **禁用不必要的服务**
4. ✅ **使用 Swap 分区**（可选）

### 检查内存使用
```bash
free -h
ps aux --sort=-%mem | head -10
```

---

## 完整示例项目

参考项目：[TRIX 3D Companion](https://github.com/meowdoone/TRIX_ap)

关键文件：
- [`.github/workflows/deploy.yml`](https://github.com/meowdoone/TRIX_ap/blob/main/.github/workflows/deploy.yml)
- [`deploy/nginx.conf`](https://github.com/meowdoone/TRIX_ap/blob/main/deploy/nginx.conf)
- [`docs/AUTO_DEPLOY_COMPLETE_GUIDE.md`](https://github.com/meowdoone/TRIX_ap/blob/main/docs/AUTO_DEPLOY_COMPLETE_GUIDE.md)

---

## 快速参考命令

```bash
# 查看 GitHub Actions 运行状态
gh run list --limit 5

# 查看最新部署日志
gh run view --log

# 触发部署（空提交）
git commit --allow-empty -m "触发部署" && git push

# SSH 连接服务器
ssh root@[your-ip]

# 查看 Nginx 日志
tail -f /var/log/nginx/[project]-access.log

# 重启 Nginx
systemctl reload nginx
```

---

## 标签

`github-actions` `deployment` `nginx` `ssh` `ci-cd` `automation` `server`

---

## 版本信息

- **创建日期**: 2026-02-12
- **适用范围**: 前端项目（React、Vue、Next.js 等）
- **测试环境**: Ubuntu 20.04、Node.js 20.x、Nginx 1.18

---

**注意**: 此 Skill 需要配合 [AUTO_DEPLOY_COMPLETE_GUIDE.md](AUTO_DEPLOY_COMPLETE_GUIDE.md) 使用。
