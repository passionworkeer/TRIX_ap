#!/bin/bash
set -e

# ============================================
# 颜色输出
# ============================================
GREEN='\033[92m'
RED='\033[91m'
YELLOW='\033[93m'
RESET='\033[0m'

# ============================================
# 服务器配置
# ============================================
SERVER_HOST="TRIX_SERVER_HOST"
SERVER_USER="root"
SERVER_PATH="/opt/clawbot-channel"

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GREEN}🚀 Clawbot Channel 服务器更新工具${RESET}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "📡 服务器: ${YELLOW}${SERVER_HOST}${RESET}"
echo -e "👤 用户: ${YELLOW}${SERVER_USER}${RESET}"
echo -e "📁 路径: ${YELLOW}${SERVER_PATH}${RESET}"
echo ""

# ============================================
# 步骤 1: 备份原文件
# ============================================
echo -e "${YELLOW}[1/5]${RESET} 备份原服务器文件..."
ssh ${SERVER_USER}@${SERVER_HOST} "cp ${SERVER_PATH}/server.js ${SERVER_PATH}/server.js.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "${GREEN}✅ 备份完成${RESET}"
echo ""

# ============================================
# 步骤 2: 上传修复后的文件
# ============================================
echo -e "${YELLOW}[2/5]${RESET} 上传修复后的 server.js..."
scp server/clawbot-channel/server.js ${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/server.js
echo -e "${GREEN}✅ 上传完成${RESET}"
echo ""

# ============================================
# 步骤 3: 重启服务
# ============================================
echo -e "${YELLOW}[3/5]${RESET} 重启 clawbot-channel 服务..."
ssh ${SERVER_USER}@${SERVER_HOST} "cd ${SERVER_PATH} && pm2 restart clawbot-channel"
echo -e "${GREEN}✅ 服务已重启${RESET}"
echo ""

# ============================================
# 步骤 4: 验证服务状态
# ============================================
echo -e "${YELLOW}[4/5]${RESET} 检查服务状态..."
ssh ${SERVER_USER}@${SERVER_HOST} "pm2 status clawbot-channel"
echo ""

# ============================================
# 步骤 5: 查看日志
# ============================================
echo -e "${YELLOW}[5/5]${RESET} 查看最新日志..."
ssh ${SERVER_USER}@${SERVER_HOST} "pm2 logs clawbot-channel --lines 20 --nostream"
echo ""

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GREEN}✅ 服务器更新完成！${RESET}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo "📝 下一步："
echo "   1. 测试配对功能: node openclaw-skills/pairing/test-pairing.js"
echo "   2. 在 OpenClaw 中生成配对码"
echo "   3. 在手机 App 中输入配对码"
echo ""
