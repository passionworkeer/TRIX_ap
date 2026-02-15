#!/bin/bash

set -e

echo "🚀 Deploying Clawbot Channel Server..."

# 1. 创建目录
sudo mkdir -p /opt/clawbot-channel
sudo chown -R $USER:$USER /opt/clawbot-channel

# 2. 复制文件（假设在本地开发后上传）
# 实际使用时用 scp 或 git
# scp -r ./* ubuntu@47.243.55.130:/opt/clawbot-channel/

# 3. 进入目录
cd /opt/clawbot-channel

# 4. 安装依赖
npm install

# 5. 创建数据目录
mkdir -p data logs

# 6. 配置环境变量（手动编辑）
if [ ! -f .env ]; then
  echo "⚠️  Please create .env file with your configuration"
  echo "   cp .env.example .env && nano .env"
  exit 1
fi

# 7. 使用 PM2 启动
if ! command -v pm2 &> /dev/null; then
  sudo npm install -g pm2
fi

pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd

echo "✅ Deployment complete!"
echo "   View logs: pm2 logs clawbot-channel"
echo "   Status: pm2 status"
