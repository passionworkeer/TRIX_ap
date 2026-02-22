# ═════════════════════════════════════════════════════════
#          服务器Git部署完整指南
# ═════════════════════════════════════════════════════════

## 步骤1: SSH登录服务器

```bash
ssh root@47.243.55.130
```

## 步骤2: 执行部署（复制粘贴以下命令）

```bash
# 创建项目目录并clone代码
mkdir -p /var/www
cd /var/www

# 如果已存在项目目录，先进入
if [ -d "trix-3d-companion" ]; then
    cd trix-3d-companion
    git pull origin feature/nanobot-integration
else
    git clone -b feature/nanobot-integration git@github.com:meowdoone/TRIX_ap.git trix-3d-companion
    cd trix-3d-companion
fi

# 安装依赖
npm install

# 构建项目
npm run build

# 部署到Web目录
cp -r dist/* /var/www/html/
chown -R www-data:www-data /var/www/html

# 重启Nginx
nginx -s reload
systemctl restart nginx

# 检查状态
systemctl status nginx

echo "✅ 部署完成！访问: http://47.243.55.130"
```

## 或者：使用自动化脚本（复制粘贴）

```bash
cat > /tmp/deploy.sh << 'EOF'
#!/bin/bash
cd /var/www
if [ -d "trix-3d-companion" ]; then
    cd trix-3d-companion
    git pull origin feature/nanobot-integration
else
    git clone -b feature/nanobot-integration git@github.com:meowdoone/TRIX_ap.git trix-3d-companion
    cd trix-3d-companion
fi
npm install
npm run build
cp -r dist/* /var/www/html/
chown -R www-data:www-data /var/www/html
nginx -s reload
systemctl restart nginx
echo "✅ 部署完成！"
EOF

chmod +x /tmp/deploy.sh
bash /tmp/deploy.sh
```

## 步骤3: 验证部署

在浏览器打开：
```
http://47.243.55.130
```

强制刷新：`Ctrl+Shift+R`

## 常见问题

### 问题1: Git未安装

```bash
yum install git -y   # CentOS/AlmaLinux
# 或
apt install git -y   # Ubuntu/Debian
```

### 问题2: Node.js未安装

```bash
# 安装Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs
```

### 问题3: 权限问题

```bash
chown -R www-data:www-data /var/www/html
chmod -R 755 /var/www/html
```

---

**部署完成后，手机访问 http://47.243.55.130 即可使用！** 🚀
