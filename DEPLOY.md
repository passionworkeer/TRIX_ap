# TRIX 3D Companion - 服务器部署指南

适用于 **2GB 内存服务器** 的轻量级部署方案。

---

## 📋 部署方案概述

### 技术栈

- **前端**: React + Vite (已优化构建)
- **Web 服务器**: Nginx (超轻量级，内存占用约 10-20MB)
- **后端**: Supabase (托管服务，无需服务器部署)
- **WebSocket**: Clawbot Gateway (如需部署在同一服务器)

### 预估资源占用

| 组件 | 内存占用 | 说明 |
|------|---------|------|
| Nginx | 10-20MB | 静态文件服务 |
| 操作系统 | ~300MB | Ubuntu/Debian 基础 |
| **总计** | ~350MB | 剩余 1.6GB 可用 |

---

## 🚀 快速部署（3 步）

### 步骤 1: 初始化服务器

SSH 连接到你的服务器并运行：

```bash
# 下载并运行初始化脚本
wget https://raw.githubusercontent.com/your-repo/deploy/server-setup.sh
chmod +x server-setup.sh
sudo bash server-setup.sh
```

**脚本会自动安装：**
- ✅ Nginx (Web 服务器)
- ✅ Node.js 20.x (构建工具)
- ✅ Git (代码管理)
- ✅ PM2 (进程管理)
- ✅ UFW 防火墙 (可选)

---

### 步骤 2: 克隆项目并配置

```bash
# 克隆项目
git clone <your-git-repo-url> /var/www/trix-3d-companion
cd /var/www/trix-3d-companion

# 复制 Nginx 配置
sudo cp deploy/nginx.conf /etc/nginx/sites-available/trix-3d-companion

# 创建软链接
sudo ln -s /etc/nginx/sites-available/trix-3d-companion /etc/nginx/sites-enabled/

# 编辑配置（修改域名）
sudo nano /etc/nginx/sites-available/trix-3d-companion
# 将 `server_name your-domain.com` 改为你的域名或 IP

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl reload nginx
```

---

### 步骤 3: 本地构建并部署

**在本地电脑（Windows/Mac/Linux）上运行：**

```bash
# 安装依赖（如果还没安装）
npm install

# 安装新增的压缩插件
npm install --save-dev vite-plugin-compression

# 运行部署脚本
chmod +x deploy.sh
./deploy.sh
```

**脚本会自动完成：**
1. ✅ 本地构建项目（生产优化）
2. ✅ 打包构建产物
3. ✅ 上传到服务器
4. ✅ 解压并设置权限
5. ✅ 重启 Nginx

---

## 🔐 配置 SSL 证书（推荐）

使用 Let's Encrypt 免费证书：

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 自动配置 SSL
sudo certbot --nginx -d your-domain.com

# 自动续期（已自动配置）
sudo certbot renew --dry-run
```

---

## 📁 项目结构说明

### 部署相关文件

```
trix-3d-companion/
├── deploy/
│   └── nginx.conf              # Nginx 配置文件
├── deploy.sh                    # 自动化部署脚本
├── server-setup.sh              # 服务器初始化脚本
├── vite.config.ts              # 已优化的构建配置
└── package.json                # 已添加压缩插件
```

---

## ⚡ 性能优化说明

### 1. Vite 构建优化（已完成）

- ✅ 代码分割（React、Supabase、Leaflet 分离）
- ✅ Terser 压缩（移除 console、debugger）
- ✅ Gzip 压缩（仅压缩 >10KB 文件）
- ✅ 生产源码映射关闭（减小体积）

### 2. Nginx 优化（已配置）

- ✅ Gzip 压缩
- ✅ 静态资源缓存（1 年）
- ✅ 工作进程自动调优
- ✅ 隐藏版本号（安全性）

### 3. 文件大小预估

| 类型 | 原始大小 | 压缩后 (Gzip) |
|------|---------|--------------|
| JS Bundle | ~500KB | ~150KB |
| CSS | ~50KB | ~15KB |
| **首页加载** | ~550KB | ~165KB |

---

## 🌐 环境变量配置

### 前端环境变量

在服务器上创建 `.env.production`：

```bash
cd /var/www/trix-3d-companion
nano .env.production
```

添加以下内容：

```bash
# Supabase 配置
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Clawbot Gateway 配置
VITE_PC_WEBSOCKET_URL=ws://your-server-ip:18789
VITE_PC_WEBSOCKET_URL_MOBILE=ws://your-server-ip:18789
VITE_PC_AUTH_TOKEN=your_auth_token_here
```

**重要**: 在部署脚本运行时，这些变量会被注入到构建中。

---

## 🔧 常见问题

### 1. 部署后页面空白

**原因**: 环境变量未配置或构建失败

**解决**:
```bash
# 检查 Nginx 错误日志
sudo tail -f /var/log/nginx/trix-3d-companion-error.log

# 重新构建并部署
./deploy.sh
```

### 2. WebSocket 连接失败

**原因**: 端口未开放或防火墙阻止

**解决**:
```bash
# 开放端口
sudo ufw allow 18789/tcp

# 或直接关闭防火墙（不推荐）
sudo ufw disable
```

### 3. 内存不足

**原因**: 2GB 服务器运行了过多服务

**解决**:
```bash
# 查看内存占用
free -h

# 查看进程占用
ps aux --sort=-%mem | head

# 如果有其他服务占用过多内存，考虑停止或迁移
```

### 4. Nginx 403 Forbidden

**原因**: 文件权限问题

**解决**:
```bash
sudo chown -R www-data:www-data /var/www/trix-3d-companion
sudo chmod -R 755 /var/www/trix-3d-companion
```

---

## 🔄 更新部署

当代码更新后，只需重新运行部署脚本：

```bash
./deploy.sh
```

脚本会自动完成构建、上传、部署全流程。

---

## 📊 监控服务器

### 查看实时资源占用

```bash
htop  # 需要先安装: sudo apt install htop
```

### 查看 Nginx 日志

```bash
# 访问日志
sudo tail -f /var/log/nginx/trix-3d-companion-access.log

# 错误日志
sudo tail -f /var/log/nginx/trix-3d-companion-error.log
```

### 查看 Nginx 状态

```bash
sudo systemctl status nginx
```

---

## 🎯 进阶配置

### 1. 配置 CDN（可选）

使用 Cloudflare CDN 加速访问：

1. 在 Cloudflare 添加域名
2. 将域名 DNS 指向服务器 IP
3. 启用 "Auto Minify" 和 "Brotli" 压缩

### 2. 配置缓存策略（可选）

对于不经常变动的资源，可以在 Nginx 中配置更长的缓存时间：

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    expires 2y;  # 改为 2 年
    add_header Cache-Control "public, immutable";
}
```

### 3. 启用 HTTP/2（可选）

在 Nginx 配置中添加：

```nginx
listen 443 ssl http2;  # 启用 HTTP/2
```

---

## 📞 获取帮助

- GitHub Issues: [https://github.com/your-repo/issues](https://github.com/your-repo/issues)
- 文档: [docs/](docs/)
- Supabase 文档: [https://supabase.com/docs](https://supabase.com/docs)

---

## ✅ 部署检查清单

- [ ] 服务器已初始化（运行 `server-setup.sh`）
- [ ] 项目代码已克隆到服务器
- [ ] Nginx 配置已更新（域名/IP）
- [ ] 环境变量已配置（.env.production）
- [ ] 本地依赖已安装（`npm install`）
- [ ] 部署脚本已运行（`./deploy.sh`）
- [ ] 网站可访问（浏览器打开测试）
- [ ] SSL 证书已配置（推荐）
- [ ] WebSocket 连接正常（如适用）

---

**部署成功！** 🎉

现在你可以访问你的网站了：`http://your-domain.com`
