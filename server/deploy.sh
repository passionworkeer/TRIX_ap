#!/bin/bash

# ============================================
# Nanobot 云端服务器部署脚本 (MVP 版本)
# 服务器: TRIX_SERVER_HOST
# ============================================

set -e

echo "=========================================="
echo "  Nanobot 云端服务器部署"
echo "=========================================="

# 检查是否以 root 运行
if [ "$EUID" -ne 0 ]; then
  echo "请使用 root 权限运行此脚本"
  exit 1
fi

# 1. 安装依赖
echo ""
echo "[1/5] 安装 Python 依赖..."
pip3 install websockets

# 2. 创建目录
echo ""
echo "[2/5] 创建部署目录..."
mkdir -p /opt/nanobot-cloud

# 3. 复制代码
echo ""
echo "[3/5] 复制服务器代码..."
cp cloud_server.py /opt/nanobot-cloud/
chmod +x /opt/nanobot-cloud/cloud_server.py

# 4. 创建 systemd 服务
echo ""
echo "[4/5] 创建 systemd 服务..."
cat > /etc/systemd/system/nanobot-cloud.service << 'EOF'
[Unit]
Description=Nanobot Cloud Server (MVP)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/nanobot-cloud
ExecStart=/usr/bin/python3 /opt/nanobot-cloud/cloud_server.py
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# 5. 启动服务
echo ""
echo "[5/5] 启动服务..."
systemctl daemon-reload
systemctl enable nanobot-cloud
systemctl restart nanobot-cloud

echo ""
echo "=========================================="
echo "  部署完成!"
echo "=========================================="
echo ""
echo "服务状态: systemctl status nanobot-cloud"
echo "查看日志: journalctl -u nanobot-cloud -f"
echo "重启服务: systemctl restart nanobot-cloud"
echo ""
echo "WebSocket 地址: ws://TRIX_SERVER_HOST:8765"
echo ""
