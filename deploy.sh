#!/bin/bash
# ============================================
# TRIX 3D Companion - 自动化部署脚本
# 适用于 2GB 内存的服务器
# ============================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量
SERVER_USER="root"  # 修改为你的服务器用户
SERVER_HOST="your-server-ip"  # 修改为你的服务器IP
DEPLOY_PATH="/var/www/trix-3d-companion"
NGINX_CONF_PATH="/etc/nginx/sites-available/trix-3d-companion"

echo -e "${GREEN}===========================================${NC}"
echo -e "${GREEN}  TRIX 3D Companion - 自动化部署${NC}"
echo -e "${GREEN}===========================================${NC}"
echo ""

# 1. 本地构建
echo -e "${YELLOW}[1/5] 本地构建项目...${NC}"
npm run build
echo -e "${GREEN}✓ 构建完成${NC}"
echo ""

# 2. 打包构建产物
echo -e "${YELLOW}[2/5] 打包构建产物...${NC}"
cd dist
tar -czf ../trix-build.tar.gz .
cd ..
echo -e "${GREEN}✓ 打包完成${NC}"
echo ""

# 3. 上传到服务器
echo -e "${YELLOW}[3/5] 上传到服务器...${NC}"
echo "服务器: $SERVER_USER@$SERVER_HOST"

# 创建远程目录
ssh $SERVER_USER@$SERVER_HOST "mkdir -p $DEPLOY_PATH"

# 上传构建包
scp trix-build.tar.gz $SERVER_USER@$SERVER_HOST:/tmp/
echo -e "${GREEN}✓ 上传完成${NC}"
echo ""

# 4. 服务器端部署
echo -e "${YELLOW}[4/5] 服务器部署...${NC}"
ssh $SERVER_USER@$SERVER_HOST << 'ENDSSH'
set -e

# 解压到目标目录
echo "解压文件..."
tar -xzf /tmp/trix-build.tar.gz -C /var/www/trix-3d-companion

# 设置权限
echo "设置权限..."
chown -R www-data:www-data /var/www/trix-3d-companion
chmod -R 755 /var/www/trix-3d-companion

# 清理临时文件
rm /tmp/trix-build.tar.gz

echo "✓ 部署完成"
ENDSSH
echo ""

# 5. 重启 Nginx
echo -e "${YELLOW}[5/5] 重启 Nginx...${NC}"
ssh $SERVER_USER@$SERVER_HOST "nginx -t && systemctl reload nginx"
echo -e "${GREEN}✓ Nginx 重启完成${NC}"
echo ""

# 清理本地临时文件
echo -e "${YELLOW}清理本地临时文件...${NC}"
rm -f trix-build.tar.gz
echo -e "${GREEN}✓ 清理完成${NC}"
echo ""

echo -e "${GREEN}===========================================${NC}"
echo -e "${GREEN}  部署成功！${NC}"
echo -e "${GREEN}===========================================${NC}"
echo ""
echo "访问地址: http://$SERVER_HOST"
echo ""
