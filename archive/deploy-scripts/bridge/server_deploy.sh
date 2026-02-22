#!/bin/bash
# ============================================================
# 服务器部署脚本 - 通过Git同步
# ============================================================

echo "╔════════════════════════════════════════════════════════╗"
echo "║     从GitHub拉取最新代码并构建                        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# 项目目录
PROJECT_DIR="/var/www/trix-3d-companion"
GIT_REPO="git@github.com:meowdoone/TRIX_ap.git"
BRANCH="feature/nanobot-integration"

# 1. 检查并clone项目
echo "[1/5] 检查项目目录..."
if [ ! -d "$PROJECT_DIR" ]; then
    echo "项目目录不存在，正在clone..."
    cd /var/www
    git clone -b $BRANCH $GIT_REPO trix-3d-companion
    echo "✅ Clone完成"
else
    echo "✅ 项目目录存在"
fi
echo ""

# 2. 拉取最新代码
echo "[2/5] 拉取最新代码..."
cd $PROJECT_DIR
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH
echo "✅ 代码已更新"
echo ""

# 3. 安装依赖
echo "[3/5] 安装依赖..."
npm install
echo "✅ 依赖安装完成"
echo ""

# 4. 构建项目
echo "[4/5] 构建项目..."
npm run build
echo "✅ 构建完成"
echo ""

# 5. 部署到Web目录
echo "[5/5] 部署到Web目录..."
cp -r dist/* /var/www/html/
chown -R www-data:www-data /var/www/html
echo "✅ 部署完成"
echo ""

# 6. 重启Nginx
echo "重启Nginx..."
nginx -s reload
systemctl restart nginx
echo "✅ Nginx已重启"
echo ""

echo "╔════════════════════════════════════════════════════════╗"
echo "║                  🎉 部署完成！                          ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "现在可以访问: http://47.243.55.130"
echo ""
