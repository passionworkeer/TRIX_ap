#!/bin/bash
# 云端 Relay Server 部署脚本
# 服务器: 47.243.55.130
# 用途: 中转手机App和电脑OpenClaw之间的消息

set -e  # 遇到错误立即退出

echo "╔════════════════════════════════════════════════════════╗"
echo "║     OpenClaw Gateway Bridge - 云端部署脚本            ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. 检查Python环境
echo -e "${YELLOW}[1/6] 检查 Python 环境...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python3 未安装${NC}"
    exit 1
fi
PYTHON_VERSION=$(python3 --version)
echo -e "${GREEN}✅ Python 已安装: $PYTHON_VERSION${NC}"

# 2. 安装Python依赖
echo ""
echo -e "${YELLOW}[2/6] 安装 Python 依赖...${NC}"
pip3 install websockets aiohttp asyncio -q || {
    echo -e "${RED}❌ 依赖安装失败${NC}"
    exit 1
}
echo -e "${GREEN}✅ 依赖安装成功${NC}"

# 3. 停止旧服务
echo ""
echo -e "${YELLOW}[3/6] 停止旧服务...${NC}"
if command -v pm2 &> /dev/null; then
    pm2 stop relay-server 2>/dev/null || echo "无旧服务运行"
    pm2 delete relay-server 2>/dev/null || true
    echo -e "${GREEN}✅ 旧服务已停止${NC}"
else
    echo -e "${YELLOW}⚠️  PM2 未安装，将直接运行服务${NC}"
fi

# 4. 备份旧配置
echo ""
echo -e "${YELLOW}[4/6] 备份旧配置...${NC}"
if [ -f "relay_server_with_bridge.py" ]; then
    cp relay_server_with_bridge.py "relay_server_with_bridge.py.backup.$(date +%Y%m%d_%H%M%S)"
    echo -e "${GREEN}✅ 已备份旧配置${NC}"
fi

# 5. 启动服务
echo ""
echo -e "${YELLOW}[5/6] 启动 Relay Server...${NC}"

if command -v pm2 &> /dev/null; then
    # 使用PM2启动
    pm2 start relay_server_with_bridge.py \
        --name relay-server \
        --interpreter python3 \
        -- --port 8765

    # 保存PM2配置
    pm2 save

    # 设置开机自启
    pm2 startup | tail -n 1 > /tmp/pm2_startup.sh 2>/dev/null || true

    echo -e "${GREEN}✅ 服务已通过 PM2 启动${NC}"
else
    # 直接运行（后台）
    nohup python3 relay_server_with_bridge.py > relay-server.log 2>&1 &
    echo $! > relay-server.pid
    echo -e "${GREEN}✅ 服务已直接启动（PID: $(cat relay-server.pid)）${NC}"
fi

# 6. 验证服务状态
echo ""
echo -e "${YELLOW}[6/6] 验证服务状态...${NC}"
sleep 2

if command -v pm2 &> /dev/null; then
    pm2 status relay-server
else
    if [ -f "relay-server.pid" ]; then
        PID=$(cat relay-server.pid)
        if ps -p $PID > /dev/null; then
            echo -e "${GREEN}✅ 服务运行中 (PID: $PID)${NC}"
        else
            echo -e "${RED}❌ 服务未运行${NC}"
            exit 1
        fi
    fi
fi

# 7. 检查端口
echo ""
if command -v netstat &> /dev/null; then
    if netstat -tuln | grep -q ":8765 "; then
        echo -e "${GREEN}✅ 端口 8765 已监听${NC}"
    else
        echo -e "${YELLOW}⚠️  端口 8765 似乎未监听，请检查防火墙${NC}"
    fi
elif command -v ss &> /dev/null; then
    if ss -tuln | grep -q ":8765 "; then
        echo -e "${GREEN}✅ 端口 8765 已监听${NC}"
    else
        echo -e "${YELLOW}⚠️  端口 8765 似乎未监听，请检查防火墙${NC}"
    fi
fi

# 完成
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║                  🎉 部署完成！                          ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "📋 常用命令:"
if command -v pm2 &> /dev/null; then
    echo "  查看状态:  pm2 status"
    echo "  查看日志:  pm2 logs relay-server"
    echo "  重启服务:  pm2 restart relay-server"
    echo "  停止服务:  pm2 stop relay-server"
else
    echo "  查看日志:  tail -f relay-server.log"
    echo "  停止服务:  kill \$(cat relay-server.pid)"
fi
echo ""
echo "🔗 配置信息:"
echo "  WebSocket 地址:  ws://47.243.55.130:8765"
echo "  备用地址:        wss://m.jmtrick.com"
echo ""
echo "📱 下一步:"
echo "  1. 修改本地 Bridge 配置: RELAY_SERVER_URL = 'ws://47.243.55.130:8765'"
echo "  2. 重启本地 Bridge"
echo "  3. 手机 App 访问服务器 IP"
echo ""
