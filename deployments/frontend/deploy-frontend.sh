#!/bin/bash

# ============================================
# TRIX 3D Companion - 前端一键部署脚本
# ============================================

set -e

echo "=========================================="
echo "TRIX 3D Companion 部署脚本"
echo "=========================================="

# 配置变量
SERVER_USER="root"           # 服务器用户名
SERVER_HOST="your-server-ip"  # 服务器 IP
SERVER_PATH="/var/www/trix-3d-companion"  # 部署路径
DOMAIN="your-domain.com"      # 域名

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 构建项目
echo ""
echo -e "${YELLOW}📦 步骤 1/5: 构建项目...${NC}"
npm run build

if [ ! -d "dist" ]; then
  echo -e "${RED}❌ 构建失败，dist 目录不存在${NC}"
  exit 1
fi

echo -e "${GREEN}✅ 构建成功${NC}"

# 2. 备份现有部署（如果存在）
echo ""
echo -e "${YELLOW}📦 步骤 2/5: 备份现有部署...${NC}"
ssh ${SERVER_USER}@${SERVER_HOST} "if [ -d ${SERVER_PATH} ]; then mv ${SERVER_PATH} ${SERVER_PATH}.backup.\$(date +%Y%m%d_%H%M%S); fi"

echo -e "${GREEN}✅ 备份完成${NC}"

# 3. 上传文件
echo ""
echo -e "${YELLOW}📦 步骤 3/5: 上传文件到服务器...${NC}"
rsync -avz --delete dist/ ${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/

echo -e "${GREEN}✅ 上传完成${NC}"

# 4. 配置 Nginx
echo ""
echo -e "${YELLOW}📦 步骤 4/5: 配置 Nginx...${NC}"

# 创建 Nginx 配置
ssh ${SERVER_USER}@${SERVER_HOST} "cat > /etc/nginx/sites-available/trix-3d-companion << 'EOF'
server {
    listen 80;
    server_name ${DOMAIN};

    root ${SERVER_PATH};
    index index.html;

    # SPA 路由支持
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|mp4|webp)$ {
        expires 1y;
        add_header Cache-Control \"public, immutable\";
    }

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
EOF
"

# 启用站点
ssh ${SERVER_USER}@${SERVER_HOST} "
  ln -sf /etc/nginx/sites-available/trix-3d-companion /etc/nginx/sites-enabled/
  nginx -t
"

echo -e "${GREEN}✅ Nginx 配置完成${NC}"

# 5. 重启 Nginx
echo ""
echo -e "${YELLOW}📦 步骤 5/5: 重启 Nginx...${NC}"
ssh ${SERVER_USER}@${SERVER_HOST} "systemctl reload nginx"

echo -e "${GREEN}✅ Nginx 重启完成${NC}"

# 完成
echo ""
echo "=========================================="
echo -e "${GREEN}🎉 部署完成！${NC}"
echo "=========================================="
echo ""
echo "访问地址："
echo "  http://${DOMAIN}"
echo ""
echo "后续步骤："
echo "  1. 执行数据库迁移: database/migration-2026-02-17-user-settings.sql"
echo "  2. 配置 HTTPS (Let's Encrypt)"
echo "  3. 测试所有功能"
echo ""
echo -e "${YELLOW}⚠️  注意：请修改脚本中的配置变量${NC}"
echo "   - SERVER_USER: 服务器用户名"
echo "   - SERVER_HOST: 服务器 IP"
echo "   - DOMAIN: 域名"
echo ""
