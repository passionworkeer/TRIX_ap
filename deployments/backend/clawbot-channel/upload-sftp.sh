#!/bin/bash
# 使用 sftp 上传文件到服务器

SERVER="TRIX_SERVER_HOST"
USER="root"
PASSWORD=""

APP_DIR="/opt/clawbot-channel"
FILES=("server.js" "config/database.js")

echo "========================================"
echo "  使用 sftp 上传文件"
echo "========================================"
echo ""
echo "服务器: $USER@$SERVER"
echo "目录: $APP_DIR"
echo "文件: ${FILES[*]}"
echo ""

# 检查是否安装了 lftp
if ! command -v lftp &> /dev/null; then
  echo "❌ 未安装 sftp，正在安装..."
  sudo apt-get update && sudo apt-get install -y lftp
  if [ $? -ne 0 ]; then
    echo "❌ lftp 安装失败"
    exit 1
  fi
  echo "✅ lftp 安装完成"
fi

echo ""
echo "📤 开始上传..."
for FILE in "${FILES[@]}"; do
  echo "上传: $FILE"

  # 使用 sftp 上传
  lftp -u $USER -p $PASSWORD $SERVER <<EOF
    cd $APP_DIR
    put $FILE
    exit
EOF

  if [ $? -ne 0 ]; then
    echo "❌ 上传失败: $FILE"
    exit 1
  fi

  echo "✅ 上传成功: $FILE"
done

echo ""
echo "✅ 所有文件上传完成"
echo ""
echo "🔄 重启服务..."
ssh $USER@$SERVER "pm2 restart clawbot-channel"

if [ $? -eq 0 ]; then
  echo "✅ 服务重启成功"
else
  echo "❌ 服务重启失败"
  exit 1
fi

echo ""
echo "📊 查看服务状态..."
ssh $USER@$SERVER "pm2 status clawbot-channel" 2>&1 | tail -5

echo ""
echo "📝 查看最新日志..."
ssh $USER@$SERVER "pm2 logs clawbot-channel --lines 30 --nostream" 2>&1 | tail -10

echo ""
echo "✅ 更新完成！"