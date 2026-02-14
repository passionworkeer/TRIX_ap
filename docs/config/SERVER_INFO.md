# 服务器配置信息总结

> **重要**: 本文档包含 TRIX 3D Companion 项目的所有服务器配置信息

**最后更新**: 2026-02-12

---

## 🖥️ 服务器基本信息

| 项目 | 信息 |
|------|------|
| **服务器名称** | NextCloud-vrys |
| **服务器类型** | 阿里云 ECS 通用型 |
| **实例 ID** | `564d1fd68840409c95c9b7ad4e7b561c` |
| **操作系统** | Ubuntu 20.04.5 LTS (GNU/Linux 5.4.0-127-generic) |
| **CPU** | 2 vCPU |
| **内存** | 2 GiB |
| **系统盘** | ESSD 云盘 40 GiB |
| **创建时间** | 2026-01-25 22:46:02 |
| **到期时间** | 2026-02-26 00:00:00 |

---

## 🌐 网络配置

### IP 地址

| 类型 | IP 地址 |
|------|---------|
| **公网 IP** | `TRIX_SERVER_HOST` |
| **私有 IP** | `172.17.55.240` |

### 端口配置

| 端口 | 协议 | 用途 | 状态 |
|------|------|------|------|
| **22** | TCP | SSH | ✅ 开放 |
| **80** | TCP | HTTP | ✅ 开放 |
| **443** | TCP | HTTPS | ⚠️ 待配置 |
| **18789** | TCP | WebSocket (Clawbot Gateway) | ⚠️ 需确认 |

### 域名配置

| 类型 | 地址 |
|------|------|
| **临时访问** | `http://TRIX_SERVER_HOST` |
| **生产域名** | 待配置 |

---

## 🔐 SSH 访问配置

### 连接信息

| 项目 | 信息 |
|------|------|
| **SSH 用户** | `root` |
| **SSH 主机** | `TRIX_SERVER_HOST` |
| **SSH 端口** | `22` |
| **连接命令** | `ssh root@TRIX_SERVER_HOST` |

### SSH 密钥配置

| 密钥类型 | 路径 |
|---------|------|
| **GitHub Actions 私钥** | `~/.ssh/github_actions` |
| **GitHub Actions 公钥** | `~/.ssh/github_actions.pub` |
| **授权密钥列表** | `~/.ssh/authorized_keys` |

### SSH 连接命令

```bash
# 基础连接
ssh root@TRIX_SERVER_HOST

# 使用密钥连接（本地）
ssh -i ~/.ssh/github_actions root@TRIX_SERVER_HOST

# 跳过主机密钥检查（自动化脚本）
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@TRIX_SERVER_HOST
```

---

## 📁 服务器目录结构

### 网站文件目录

| 路径 | 用途 | 权限 |
|------|------|------|
| `/var/www/trix-3d-companion-web/` | 网站生产文件 | `www-data:www-data 755` |
| `/var/www/trix-3d-companion-web-backup/` | 自动备份（上一版本） | `www-data:www-data 755` |

### Nginx 配置目录

| 路径 | 说明 |
|------|------|
| `/etc/nginx/nginx.conf` | Nginx 主配置文件 |
| `/etc/nginx/sites-available/trix-3d-companion` | 网站虚拟主机配置 |
| `/etc/nginx/sites-enabled/trix-3d-companion` | 虚拟主机软链接 |

### 日志文件目录

| 路径 | 说明 |
|------|------|
| `/var/log/nginx/trix-3d-companion-access.log` | 访问日志 |
| `/var/log/nginx/trix-3d-companion-error.log` | 错误日志 |

### 临时文件目录

| 路径 | 用途 |
|------|------|
| `/tmp/` | 临时上传文件（自动清理） |

---

## 🌐 网站配置

### Nginx 虚拟主机配置

**配置文件**: `/etc/nginx/sites-available/trix-3d-companion`

| 配置项 | 值 |
|--------|-----|
| **监听端口** | `80` |
| **服务器名称** | `TRIX_SERVER_HOST` |
| **网站根目录** | `/var/www/trix-3d-companion-web` |
| **默认首页** | `index.html` |
| **访问日志** | `/var/log/nginx/trix-3d-companion-access.log` |
| **错误日志** | `/var/log/nginx/trix-3d-companion-error.log` |
| **字符集** | `utf-8` |
| **Gzip 压缩** | `on` |
| **静态资源缓存** | `expires -1` (开发阶段禁用) |

### Nginx 服务管理

```bash
# 检查配置语法
nginx -t

# 启动 Nginx
systemctl start nginx

# 停止 Nginx
systemctl stop nginx

# 重启 Nginx
systemctl restart nginx

# 重载配置（不中断服务）
systemctl reload nginx

# 查看 Nginx 状态
systemctl status nginx

# 设置开机自启
systemctl enable nginx
```

---

## 🔧 系统服务配置

### 已安装服务

| 服务 | 版本 | 状态 | 用途 |
|------|------|------|------|
| **Nginx** | 1.18.0 (Ubuntu) | ✅ 运行中 | Web 服务器 |
| **Node.js** | 20.20.0 | ✅ 已安装 | 构建工具（GitHub Actions 使用） |
| **npm** | 10.8.2 | ✅ 已安装 | 包管理器 |
| **Git** | 2.25.1 | ✅ 已安装 | 版本控制 |
| **PM2** | 最新 | ✅ 已安装 | 进程管理器 |

### 已停止服务

| 服务 | 状态 | 说明 |
|------|------|------|
| **Apache2** | ⏸️ 已停止 | 与 Nginx 端口冲突，已停用 |

---

## 🤖 GitHub Actions 自动部署配置

### GitHub Secrets 配置

| Secret 名称 | 值 | 用途 |
|-----------|-----|------|
| `SERVER_HOST` | `TRIX_SERVER_HOST` | 服务器 IP 地址 |
| `SERVER_USER` | `root` | SSH 登录用户 |
| `SSH_PRIVATE_KEY` | (存储在 GitHub Secrets) | SSH 私钥内容 |

### GitHub Actions 工作流

| 项目 | 信息 |
|------|------|
| **工作流文件** | `.github/workflows/deploy.yml` |
| **触发条件** | Push 到 `main` 分支 |
| **运行环境** | `ubuntu-latest` |
| **Node.js 版本** | `20.x` |
| **平均部署时间** | 约 70 秒 |

### 部署流程

```
git push origin main
  ↓
GitHub 检测到推送
  ↓
触发 GitHub Actions
  ↓
1. 检出代码
2. 安装 Node.js 20
3. 安装依赖 (npm install)
4. 安装 terser (npm install terser --save-dev)
5. 构建项目 (npm run build)
6. 打包构建产物 (tar)
7. SSH 连接服务器
8. 上传构建包
9. 备份当前版本
10. 解压并部署新版本
11. 设置权限
12. 重载 Nginx
  ↓
✓ 部署完成
```

---

## 📊 服务器资源使用情况

### 当前资源状态（2026-02-12）

| 资源 | 使用情况 | 说明 |
|------|---------|------|
| **总内存** | 1.9 GiB |
| **已使用** | 约 213-246 MiB |
| **可用内存** | 约 1.5 GiB |
| **Swap** | 0 B (未使用) |
| **磁盘使用** | 5.0 GiB / 40 GiB (14%) |
| **可用磁盘** | 33 GiB |

### Nginx 内存占用

| 进程 | 内存占用 |
|------|---------|
| **Nginx Master** | ~5 MB |
| **Nginx Workers** | 每个 ~1-2 MB |
| **总计** | 约 10-20 MB |

### 网站文件大小

| 类型 | 大小 |
|------|------|
| **构建产物总大小** | 约 14 MB |
| **index.html** | 3.13 kB (Gzip: 1.29 kB) |
| **主 JS bundle** | 322.69 kB (Gzip: 100.08 kB) |
| **首屏加载（压缩后）** | 约 170 kB |

---

## 🔐 安全配置

### 防火墙状态

| 状态 | 说明 |
|------|------|
| **UFW 防火墙** | ⚠️ 未配置（可选） |

### 建议配置（如需启用防火墙）

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

## 🔄 备份与回滚

### 自动备份机制

GitHub Actions 每次部署前会自动备份当前版本：

```bash
# 备份命令
cp -r /var/www/trix-3d-companion-web /var/www/trix-3d-companion-web-backup
```

### 手动回滚步骤

```bash
# 1. 连接服务器
ssh root@TRIX_SERVER_HOST

# 2. 删除当前版本
rm -rf /var/www/trix-3d-companion-web

# 3. 恢复备份版本
cp -r /var/www/trix-3d-companion-web-backup /var/www/trix-3d-companion-web

# 4. 重启 Nginx
systemctl reload nginx

# 5. 验证
curl -I http://TRIX_SERVER_HOST
```

---

## 📝 快速参考命令

### 服务器管理

```bash
# 连接服务器
ssh root@TRIX_SERVER_HOST

# 查看内存使用
free -h

# 查看磁盘使用
df -h

# 查看 Nginx 状态
systemctl status nginx

# 查看实时日志
tail -f /var/log/nginx/trix-3d-companion-error.log

# 查看最近 50 行访问日志
tail -n 50 /var/log/nginx/trix-3d-companion-access.log
```

### GitHub Actions 管理

```bash
# 查看最近 5 次部署
gh run list -R meowdoone/TRIX_ap --limit 5

# 查看最新部署日志
gh run view --log

# 查看特定部署（ID）
gh run view <run-id> --log
```

### Git 操作

```bash
# 查看本地和远程差异
git status

# 查看未推送的提交
git log origin/main..main --oneline

# 提交并推送（触发自动部署）
git add .
git commit -m "更新内容"
git push origin main
```

---

## 🔧 常见配置修改

### 修改服务器 IP 地址

需要修改的文件：
1. `deploy.sh` - 本地部署脚本
2. `.github/workflows/deploy.yml` - GitHub Actions 工作流
3. GitHub Secrets: `SERVER_HOST`
4. `/etc/nginx/sites-available/trix-3d-companion` - Nginx 配置中的 `server_name`

### 更换域名（从 IP 换成域名）

1. 在 Nginx 配置中修改：
   ```nginx
   server_name your-domain.com;  # 原来是 TRIX_SERVER_HOST
   ```

2. 配置 DNS 解析指向 `TRIX_SERVER_HOST`

3. 重启 Nginx：
   ```bash
   nginx -t && systemctl reload nginx
   ```

### 配置 SSL 证书

```bash
# 安装 Certbot
apt install -y certbot python3-certbot-nginx

# 自动配置 SSL
certbot --nginx -d TRIX_SERVER_HOST
# 或使用域名
certbot --nginx -d your-domain.com

# 自动续期（已配置）
certbot renew --dry-run
```

---

## 📞 支持与联系

### 问题排查流程

1. 检查 GitHub Actions 运行状态
2. 查看 Nginx 错误日志
3. 验证服务器连接
4. 查看文档：
   - [DEPLOY.md](DEPLOY.md) - 部署文档
   - [docs/AUTO_DEPLOY_COMPLETE_GUIDE.md](docs/AUTO_DEPLOY_COMPLETE_GUIDE.md) - 完整指南
   - [.claude/skills/auto-deploy.md](.claude/skills/auto-deploy.md) - AI 技能文档

### 获取帮助

- **GitHub Issues**: https://github.com/meowdoone/TRIX_ap/issues
- **项目仓库**: https://github.com/meowdoone/TRIX_ap

---

## 📅 变更日志

| 日期 | 变更内容 |
|------|---------|
| 2026-02-12 | 初始版本，记录所有服务器配置信息 |

---

**文档维护**: 本文档应随服务器配置变化而更新

**最后更新**: 2026-02-12 by Claude Sonnet 4.5
