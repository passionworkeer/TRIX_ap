#!/bin/bash
# ============================================
# TRIX 3D Companion - 一键自动部署脚本
# ============================================

SERVER="47.243.55.130"
USER="root"

deploy_clawbot() {
  echo "[deploy_clawbot] start"
}

deploy_clawbot

echo "============================================"
echo "  TRIX 3D Companion - 自动部署"
echo "============================================"
echo ""

echo "[1/6] 推送到 Git..."
git add -A
git commit -m "auto-deploy: $(date '+%Y-%m-%d %H:%M:%S')" || echo "  (没有新更改)"
git push origin feature/nanobot-integration
echo "✅ Git 推送完成"
echo ""

echo "[2/6] 本地构建..."
npm run build
echo "✅ 构建完成"
echo ""

echo "[3/6] 清空服务器..."
ssh ${USER}@${SERVER} "rm -rf /var/www/html/*"
echo "✅ 服务器已清空"
echo ""

echo "[4/6] 上传文件..."
scp dist/index.html ${USER}@${SERVER}:/var/www/html/
cd dist && tar -czf /tmp/build.tar.gz assets/ && scp /tmp/build.tar.gz ${USER}@${SERVER}:/tmp/ && ssh ${USER}@${SERVER} "cd /var/www/html && tar -xzf /tmp/build.tar.gz && rm /tmp/build.tar.gz" && cd ..
rm -f /tmp/build.tar.gz
echo "✅ 文件已上传"
echo ""

echo "[5/6] 设置权限..."
ssh ${USER}@${SERVER} "chown -R www-data:www-data /var/www/html/ && chmod -R 755 /var/www/html/"
echo "✅ 权限已设置"
echo ""

echo "[6/6] 重启服务..."
ssh ${USER}@${SERVER} "systemctl reload nginx"
echo "✅ Nginx 已重启"
echo ""

echo "============================================"
echo "  🎉 部署完成！"
echo "============================================"
echo ""
echo "📱 访问地址: http://${SERVER}"
echo ""
echo "💡 提示："
echo "   - 清除浏览器缓存查看最新版本"
echo "   - 使用 Ctrl+Shift+R 强制刷新"
echo ""
