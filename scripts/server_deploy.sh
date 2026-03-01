#!/bin/bash
# TRIX 3D Companion - 一键部署辅助脚本
# 将此脚本内容复制到服务器执行

set -e

echo "=========================================="
echo "  TRIX 3D Companion - 服务器端部署"
echo "=========================================="
echo ""

DEPLOY_PATH="/var/www/trix-3d-companion"
TEMP_FILE="/tmp/trix-build.tar.gz"

echo "📁 [1/3] 创建部署目录..."
sudo mkdir -p $DEPLOY_PATH
echo "✅ 完成"

echo ""
echo "📦 [2/3] 解压文件到部署目录..."
if [ -f "$TEMP_FILE" ]; then
    sudo tar -xzf $TEMP_FILE -C $DEPLOY_PATH
    echo "✅ 完成"
else
    echo "❌ 错误: 找不到构建文件 $TEMP_FILE"
    echo "请先执行以下命令上传文件:"
    echo "  scp trix-build.tar.gz meowdoone@TRIX_SERVER_HOST:/tmp/"
    exit 1
fi

echo ""
echo "🔐 [3/3] 设置权限..."
sudo chown -R www-data:www-data $DEPLOY_PATH
sudo chmod -R 755 $DEPLOY_PATH
echo "✅ 完成"

echo ""
echo "🧹 清理临时文件..."
sudo rm $TEMP_FILE
echo "✅ 完成"

echo ""
echo "=========================================="
echo "  ✅ 部署成功!"
echo "=========================================="
echo ""
echo "🌐 访问地址: http://TRIX_SERVER_HOST"
echo ""
