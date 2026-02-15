#!/bin/bash
# Clawbot Channel 服务器更新脚本

SERVER="47.243.55.130"
USER="root"
APP_DIR="/opt/clawbot-channel"
FILES="server.js config/database.js"

echo "========================================"
echo "  Clawbot Channel 服务器更新脚本"
echo "========================================"
echo ""
echo "服务器: $USER@$SERVER"
echo "目录: $APP_DIR"
echo "文件: $FILES"
echo ""

# 检查 SSH 连接
echo "🔍 检查 SSH 连接..."
ssh -o ConnectTimeout=5 $USER@$SERVER "echo '✅ SSH 连接成功'" || {
  echo "❌ SSH 连接失败"
  echo ""
  echo "🔧 手动上传步骤："
  echo "1. scp $FILES $USER@$SERVER:$APP_DIR/"
  echo "2. ssh $USER@$SERVER 'pm2 restart clawbot-channel'"
  echo "3. ssh $USER@$SERVER 'pm2 logs clawbot-channel --lines 50'"
  exit 1
}

echo ""
echo "📤 上传文件..."
scp -r $FILES $USER@$SERVER:$APP_DIR/

if [ $? -ne 0 ]; then
  echo "❌ 上传失败"
  exit 1
fi

echo "✅ 上传完成"
echo ""
echo "🔄 重启服务..."
ssh $USER@$SERVER "pm2 restart clawbot-channel" 2>&1 | tail -5

if [ $? -eq 0 ]; then
  echo "✅ 服务重启成功"
  echo ""
  echo "📊 查看服务状态..."
  ssh $USER@$SERVER "pm2 status clawbot-channel" 2>&1 | tail -5
  echo ""
  echo "📝 查看最新日志..."
  ssh $USER@$SERVER "pm2 logs clawbot-channel --lines 50 --nostream" 2>&1 | tail -10
fi

echo ""
echo "✅ 更新完成！"
echo ""
echo "📝 查看实时日志："
echo "ssh $USER@$SERVER 'pm2 logs clawbot-channel'"
echo ""
echo "🔍 查看配对日志："
echo "ssh $USER@$SERVER 'pm2 logs clawbot-channel | grep 配对'"
