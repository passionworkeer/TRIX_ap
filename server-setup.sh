#!/bin/bash
# ============================================
# TRIX 3D Companion - 服务器初始化脚本
# 适用于 Ubuntu/Debian 2GB 内存服务器
# ============================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===========================================${NC}"
echo -e "${BLUE}  TRIX 3D Companion - 服务器初始化${NC}"
echo -e "${BLUE}===========================================${NC}"
echo ""

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}错误: 请使用 root 用户运行此脚本${NC}"
    echo "使用命令: sudo bash server-setup.sh"
    exit 1
fi

# 1. 更新系统
echo -e "${YELLOW}[1/7] 更新系统...${NC}"
apt update && apt upgrade -y
echo -e "${GREEN}✓ 系统更新完成${NC}"
echo ""

# 2. 安装 Nginx
echo -e "${YELLOW}[2/7] 安装 Nginx...${NC}"
apt install -y nginx
echo -e "${GREEN}✓ Nginx 安装完成${NC}"
echo ""

# 3. 安装 Node.js（用于本地构建，生产环境不需要）
echo -e "${YELLOW}[3/7] 安装 Node.js...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node --version
npm --version
echo -e "${GREEN}✓ Node.js 安装完成${NC}"
echo ""

# 4. 安装 Git
echo -e "${YELLOW}[4/7] 安装 Git...${NC}"
apt install -y git
echo -e "${GREEN}✓ Git 安装完成${NC}"
echo ""

# 5. 安装 PM2（用于管理 Node.js 进程）
echo -e "${YELLOW}[5/7] 安装 PM2...${NC}"
npm install -g pm2
echo -e "${GREEN}✓ PM2 安装完成${NC}"
echo ""

# 6. 创建网站目录
echo -e "${YELLOW}[6/7] 创建网站目录...${NC}"
mkdir -p /var/www/trix-3d-companion
chown -R www-data:www-data /var/www/trix-3d-companion
chmod -R 755 /var/www/trix-3d-companion
echo -e "${GREEN}✓ 目录创建完成${NC}"
echo ""

# 7. 配置 Nginx
echo -e "${YELLOW}[7/7] 配置 Nginx...${NC}"
echo "请手动复制 deploy/nginx.conf 到 /etc/nginx/sites-available/trix-3d-companion"
echo "然后执行以下命令:"
echo "  sudo ln -s /etc/nginx/sites-available/trix-3d-companion /etc/nginx/sites-enabled/"
echo "  sudo nginx -t"
echo "  sudo systemctl reload nginx"
echo -e "${GREEN}✓ Nginx 配置提示完成${NC}"
echo ""

# 8. 安装 UFW 防火墙（可选）
echo -e "${YELLOW}[可选] 配置防火墙...${NC}"
read -p "是否配置防火墙? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    apt install -y ufw
    ufw allow OpenSSH
    ufw allow 'Nginx Full'
    ufw --force enable
    echo -e "${GREEN}✓ 防火墙配置完成${NC}"
else
    echo -e "${YELLOW}跳过防火墙配置${NC}"
fi
echo ""

# 9. 优化 Nginx 配置（针对 2GB 内存）
echo -e "${YELLOW}优化 Nginx 配置...${NC}"
cat > /etc/nginx/nginx.conf << 'EOF'
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    ##
    # Basic Settings
    ##
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;  # 隐藏 Nginx 版本

    # client_body_timeout 12;
    # client_header_timeout 12;
    # send_timeout 10;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    ##
    # SSL Settings
    ##
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    ##
    # Logging Settings
    ##
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    ##
    # Gzip Settings
    ##
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;

    ##
    # Virtual Host Configs
    ##
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
EOF
echo -e "${GREEN}✓ Nginx 配置优化完成${NC}"
echo ""

# 10. 启动 Nginx
echo -e "${YELLOW}启动 Nginx 服务...${NC}"
systemctl enable nginx
systemctl start nginx
systemctl status nginx --no-pager
echo -e "${GREEN}✓ Nginx 启动完成${NC}"
echo ""

# 完成
echo -e "${GREEN}===========================================${NC}"
echo -e "${GREEN}  服务器初始化完成！${NC}"
echo -e "${GREEN}===========================================${NC}"
echo ""
echo "下一步操作:"
echo "1. 克隆项目代码:"
echo "   git clone <your-git-repo-url> /var/www/trix-3d-companion"
echo ""
echo "2. 配置 Nginx:"
echo "   sudo cp deploy/nginx.conf /etc/nginx/sites-available/trix-3d-companion"
echo "   sudo ln -s /etc/nginx/sites-available/trix-3d-companion /etc/nginx/sites-enabled/"
echo "   sudo nano /etc/nginx/sites-available/trix-3d-companion  # 修改域名"
echo "   sudo nginx -t"
echo "   sudo systemctl reload nginx"
echo ""
echo "3. 配置 SSL（推荐使用 Let's Encrypt）:"
echo "   sudo apt install -y certbot python3-certbot-nginx"
echo "   sudo certbot --nginx -d your-domain.com"
echo ""
echo "4. 部署项目:"
echo "   chmod +x deploy.sh"
echo "   ./deploy.sh"
echo ""
