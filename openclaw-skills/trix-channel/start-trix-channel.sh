#!/bin/bash

echo "===================================="
echo "TRIX Channel Launcher"
echo "===================================="
echo ""

cd "$(dirname "$0")"

echo "[1/3] 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 安装依赖失败"
        exit 1
    fi
fi

echo "[2/3] 启动 TRIX Channel..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📡 服务器: http://TRIX_SERVER_HOST:8765"
echo "🌐 Gateway: ws://127.0.0.1:18789"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node index.js
