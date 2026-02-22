#!/bin/bash
# 云端 Relay Server 部署脚本
# 在服务器 TRIX_SERVER_HOST 上运行

echo "================================"
echo "云端 Relay Server 部署脚本"
echo "================================"
echo ""

# 1. 检查 Python 环境
echo "📋 检查 Python 环境..."
python3 --version || { echo "❌ Python3 未安装"; exit 1; }

# 2. 安装依赖
echo ""
echo "📦 安装 Python 依赖..."
pip3 install websockets aiohttp asyncio || { echo "❌ 依赖安装失败"; exit 1; }

# 3. 停止旧服务（如果存在）
echo ""
echo "🛑 停止旧服务..."
pm2 stop relay-server 2>/dev/null || echo "无旧服务运行"
pm2 delete relay-server 2>/dev/null || true

# 4. 启动新服务
echo ""
echo "🚀 启动 Relay Server..."
pm2 start relay_server_with_bridge.py --name relay-server --interpreter python3 || \
  { echo "❌ PM2 启动失败，尝试直接运行..."; python3 relay_server_with_bridge.py & }

# 5. 保存 PM2 配置
echo ""
echo "💾 保存 PM2 配置..."
pm2 save || echo "PM2 save 失败（可忽略）"

# 6. 检查服务状态
echo ""
echo "✅ 部署完成！服务状态："
pm2 status

echo ""
echo "================================"
echo "📋 查看日志: pm2 logs relay-server"
echo "🔄 重启服务: pm2 restart relay-server"
echo "🛑 停止服务: pm2 stop relay-server"
echo "================================"
