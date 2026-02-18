#!/bin/bash
# 云端服务器快速重启脚本
# 使用: bash restart_cloud_server.sh

echo "🔄 正在重启云端服务器..."

# 停止旧服务器
echo "1️⃣ 停止旧服务器..."
pkill -9 -f cloud_server.py
pkill -9 -f cloud_server_advanced.py
sleep 2

# 检查端口是否释放
if lsof -i :8765 > /dev/null 2>&1; then
    echo "❌ 端口 8765 仍被占用，强制清理..."
    lsof -ti:8765 | xargs kill -9
    sleep 1
fi

# 启动新服务器
echo "2️⃣ 启动高级版服务器..."
nohup python3 /opt/nanobot-cloud/cloud_server_advanced.py > /tmp/cloud_server_advanced.log 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > /tmp/cloud_server_advanced.pid

# 等待服务器启动
sleep 3

# 验证服务器
echo "3️⃣ 验证服务器状态..."
if ps -p $SERVER_PID > /dev/null; then
    echo "✅ 服务器启动成功 (PID: $SERVER_PID)"

    # 显示最新日志
    echo ""
    echo "📋 最新日志:"
    tail -10 /tmp/cloud_server_advanced.log

    echo ""
    echo "✨ 服务器已就绪!"
    echo "WebSocket: ws://TRIX_SERVER_HOST:8765"
    echo "日志文件: /tmp/cloud_server_advanced.log"
    echo "PID 文件: /tmp/cloud_server_advanced.pid"
else
    echo "❌ 服务器启动失败"
    echo "📋 错误日志:"
    tail -20 /tmp/cloud_server_advanced.log
    exit 1
fi
