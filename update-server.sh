#!/bin/bash
# Clawbot Channel 服务器更新脚本
# 日期: 2026-02-15

SERVER="TRIX_SERVER_HOST"
USER="root"
APP_DIR="/opt/clawbot-channel"
BRANCH="feature/nanobot-integration"

echo "========================================="
echo "  Clawbot Channel 服务器更新脚本"
echo "========================================="
echo ""
echo "服务器: $USER@$SERVER"
echo "分支: $BRANCH"
echo "目录: $APP_DIR"
echo ""

# 检查 SSH 连接
echo "🔍 检查 SSH 连接..."
ssh -o ConnectTimeout=5 $USER@$SERVER "echo '✅ SSH 连接成功'" || {
  echo "❌ SSH 连接失败，请检查网络或手动执行以下命令："
  echo ""
  echo "ssh $USER@$SERVER"
  echo "cd $APP_DIR"
  echo "git pull origin $BRANCH"
  echo "cd server/clawbot-channel && npm install express-rate-limit"
  echo "pm2 restart clawbot-channel"
  echo "pm2 logs clawbot-channel"
  exit 1
}

echo ""
echo "📥 更新代码..."
ssh $USER@$SERVER << EOF
cd $APP_DIR
echo "当前分支: \$(git branch --show-current)"
echo "拉取最新代码..."
git fetch origin
git pull origin $BRANCH
echo "✅ 代码更新完成"
EOF

if [ $? -ne 0 ]; then
  echo "❌ 代码更新失败"
  exit 1
fi

echo ""
echo "📦 安装新依赖..."
ssh $USER@$SERVER << EOF
cd $APP_DIR/server/clawbot-channel
npm install express-rate-limit
echo "✅ 依赖安装完成"
EOF

if [ $? -ne 0 ]; then
  echo "❌ 依赖安装失败"
  exit 1
fi

echo ""
echo "🔄 重启服务..."
ssh $USER@$SERVER << EOF
pm2 restart clawbot-channel
echo "✅ 服务已重启"
EOF

if [ $? -ne 0 ]; then
  echo "❌ 服务重启失败"
  exit 1
fi

echo ""
echo "📊 查看服务状态..."
ssh $USER@$SERVER << EOF
pm2 status clawbot-channel
EOF

echo ""
echo "✅ 更新完成！"
echo ""
echo "📝 查看实时日志："
echo "ssh $USER@$SERVER 'pm2 logs clawbot-channel'"
echo ""
echo "🔍 查看配对日志："
echo "ssh $USER@$SERVER 'pm2 logs clawbot-channel | grep 配对'"
