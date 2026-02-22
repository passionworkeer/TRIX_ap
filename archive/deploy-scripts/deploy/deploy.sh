#!/bin/bash

# ============================================
# MyApp Bridge 一键部署脚本
# ============================================

set -e

echo "=========================================="
echo "MyApp Bridge 部署脚本"
echo "=========================================="

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
  echo "❌ 请使用 root 用户或 sudo 运行此脚本"
  exit 1
fi

# 1. 安装系统依赖
echo ""
echo "📦 步骤 1/5: 安装系统依赖..."
apt-get update
apt-get install -y python3 python3-pip redis-server nginx

# 2. 安装 Python 依赖
echo ""
echo "📦 步骤 2/5: 安装 Python 依赖..."
pip3 install flask flask-socketio eventlet redis

# 3. 创建服务目录
echo ""
echo "📁 步骤 3/5: 创建服务目录..."
mkdir -p /opt/myapp-bridge
cp pairing_server.py /opt/myapp-bridge/
cd /opt/myapp-bridge

# 4. 创建 systemd 服务
echo ""
echo "🔧 步骤 4/5: 创建 systemd 服务..."
cat > /etc/systemd/system/myapp-bridge.service << 'EOF'
[Unit]
Description=MyApp Bridge Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/myapp-bridge
Environment="PATH=/usr/local/bin:/usr/bin"
ExecStart=/usr/bin/python3 /opt/myapp-bridge/pairing_server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 5. 启动服务
echo ""
echo "🚀 步骤 5/5: 启动服务..."
systemctl daemon-reload
systemctl enable myapp-bridge
systemctl start myapp-bridge

# 检查服务状态
if systemctl is-active --quiet myapp-bridge; then
  echo ""
  echo "✅ MyApp Bridge 服务启动成功！"
  echo ""
  systemctl status myapp-bridge --no-pager
else
  echo ""
  echo "❌ MyApp Bridge 服务启动失败，请检查日志："
  echo "   journalctl -u myapp-bridge -n 50"
  exit 1
fi

# 6. 配置 Nginx（可选）
echo ""
echo "=========================================="
echo "Nginx 配置"
echo "=========================================="
echo ""
echo "如果需要通过域名访问，请按以下步骤操作："
echo ""
echo "1. 上传 SSL 证书到 /etc/nginx/ssl/"
echo "   - cert.pem"
echo "   - key.pem"
echo ""
echo "2. 复制 nginx 配置："
echo "   cp nginx.conf /etc/nginx/sites-available/myapp-bridge"
echo "   ln -s /etc/nginx/sites-available/myapp-bridge /etc/nginx/sites-enabled/"
echo ""
echo "3. 修改 nginx.conf 中的域名："
echo "   server_name your-domain.com;"
echo ""
echo "4. 重启 Nginx："
echo "   nginx -t"
echo "   systemctl restart nginx"
echo ""
echo "=========================================="
echo "部署完成！"
echo "=========================================="
echo ""
echo "服务地址："
echo "  HTTP API:  http://your-server-ip:5001"
echo "  WebSocket: ws://your-server-ip:5001"
echo ""
echo "查看日志："
echo "  journalctl -u myapp-bridge -f"
echo ""
echo "重启服务："
echo "  systemctl restart myapp-bridge"
echo ""
