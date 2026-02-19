#!/bin/bash
# ============================================================
# 手动部署指南 - 服务器端部署脚本
# ============================================================
# 请在服务器 47.243.55.130 上手动执行以下命令

echo "╔════════════════════════════════════════════════════════╗"
echo "║     OpenClaw Gateway Bridge - 服务器部署脚本         ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# 1. 创建工作目录
echo "[1/7] 创建工作目录..."
mkdir -p /root/nanobot
cd /root/nanobot
echo "✅ 工作目录: $(pwd)"
echo ""

# 2. 安装Python依赖
echo "[2/7] 安装Python依赖..."
pip3 install websockets aiohttp asyncio -q
echo "✅ Python依赖安装完成"
echo ""

# 3. 停止旧服务
echo "[3/7] 停止旧服务..."
if command -v pm2 &> /dev/null; then
    pm2 stop relay-server 2>/dev/null || echo "无旧服务"
    pm2 delete relay-server 2>/dev/null || true
    echo "✅ 旧服务已停止"
else
    echo "⚠️  PM2未安装，将安装PM2"
    npm install -g pm2
fi
echo ""

# 4. 检查Relay Server文件
echo "[4/7] 检查Relay Server文件..."
if [ ! -f "relay_server_with_bridge.py" ]; then
    echo "❌ 找不到 relay_server_with_bridge.py"
    echo ""
    echo "请在本地电脑执行以下命令上传文件："
    echo "scp e:\\desktop\\trix-3d-companion\\bridge\\relay_server_with_bridge.py root@47.243.55.130:/root/nanobot/"
    echo ""
    exit 1
fi
echo "✅ Relay Server文件存在"
echo ""

# 5. 启动服务
echo "[5/7] 启动Relay Server..."
pm2 start relay_server_with_bridge.py --name relay-server --interpreter python3
pm2 save
echo "✅ 服务已启动"
echo ""

# 6. 验证服务状态
echo "[6/7] 验证服务状态..."
sleep 2
pm2 status relay-server
echo ""

# 7. 检查端口
echo "[7/7] 检查端口监听..."
if command -v netstat &> /dev/null; then
    netstat -tuln | grep 8765 && echo "✅ 端口8765已监听" || echo "⚠️  端口8765未监听"
elif command -v ss &> /dev/null; then
    ss -tuln | grep 8765 && echo "✅ 端口8765已监听" || echo "⚠️  端口8765未监听"
fi
echo ""

# 8. 检查防火墙
echo "[防火墙] 检查防火墙规则..."
if command -v ufw &> /dev/null; then
    ufw status | grep 8765 && echo "✅ 端口8765已开放" || echo "⚠️  需要开放端口: sudo ufw allow 8765"
fi
echo ""

echo "╔════════════════════════════════════════════════════════╗"
echo "║                  🎉 部署完成！                          ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "📋 常用命令:"
echo "  pm2 status                    # 查看服务状态"
echo "  pm2 logs relay-server         # 查看日志"
echo "  pm2 restart relay-server      # 重启服务"
echo "  pm2 stop relay-server         # 停止服务"
echo ""
echo "🔗 配置信息:"
echo "  WebSocket地址: ws://47.243.55.130:8765"
echo ""
echo "📱 下一步:"
echo "  1. 确保本地Bridge运行: cd e:\\desktop\\trix-3d-companion\\bridge && node openclaw-bridge.js"
echo "  2. 手机访问: http://47.243.55.130"
echo "  3. 在App中配对OpenClaw"
echo ""
