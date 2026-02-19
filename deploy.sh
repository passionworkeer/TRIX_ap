#!/bin/bash
# TRIX 3D Companion 统一部署入口脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOYMENTS_DIR="$PROJECT_ROOT/deployments"

# 显示帮助信息
show_help() {
    echo "TRIX 3D Companion 部署脚本"
    echo ""
    echo "用法: ./deploy.sh [选项] [服务]"
    echo ""
    echo "服务:"
    echo "  frontend           部署前端应用"
    echo "  clawbot            部署 Clawbot Channel 服务"
    echo "  update-clawbot     更新 Clawbot Channel 服务"
    echo "  init-server        初始化服务器环境"
    echo "  restart            重启所有服务"
    echo ""
    echo "选项:"
    echo "  -h, --help         显示此帮助信息"
    echo "  -v, --verbose      详细输出模式"
    echo ""
    echo "示例:"
    echo "  ./deploy.sh frontend"
    echo "  ./deploy.sh clawbot"
    echo "  ./deploy.sh init-server"
}

# 检查脚本是否存在
check_script() {
    local script="$1"
    if [ ! -f "$script" ]; then
        echo -e "${RED}错误: 脚本不存在: $script${NC}"
        exit 1
    fi
}

# 部署前端
deploy_frontend() {
    echo -e "${GREEN}部署前端应用...${NC}"
    check_script "$DEPLOYMENTS_DIR/frontend/build-and-deploy.sh"
    bash "$DEPLOYMENTS_DIR/frontend/build-and-deploy.sh"
}

# 部署 Clawbot Channel
deploy_clawbot() {
    echo -e "${GREEN}部署 Clawbot Channel 服务...${NC}"
    check_script "$DEPLOYMENTS_DIR/backend/clawbot-channel/deploy.sh"
    bash "$DEPLOYMENTS_DIR/backend/clawbot-channel/deploy.sh"
}

# 更新 Clawbot Channel
update_clawbot() {
    echo -e "${GREEN}更新 Clawbot Channel 服务...${NC}"
    check_script "$DEPLOYMENTS_DIR/backend/clawbot-channel/update.sh"
    bash "$DEPLOYMENTS_DIR/backend/clawbot-channel/update.sh"
}

# 初始化服务器
init_server() {
    echo -e "${GREEN}初始化服务器环境...${NC}"
    check_script "$DEPLOYMENTS_DIR/server-setup/init-server.sh"
    bash "$DEPLOYMENTS_DIR/server-setup/init-server.sh"
}

# 重启服务
restart_services() {
    echo -e "${GREEN}重启所有服务...${NC}"
    check_script "$DEPLOYMENTS_DIR/server-setup/restart-services.sh"
    bash "$DEPLOYMENTS_DIR/server-setup/restart-services.sh"
}

# 主函数
main() {
    # 解析参数
    case "$1" in
        -h|--help)
            show_help
            exit 0
            ;;
        frontend)
            deploy_frontend
            ;;
        clawbot)
            deploy_clawbot
            ;;
        update-clawbot)
            update_clawbot
            ;;
        init-server)
            init_server
            ;;
        restart)
            restart_services
            ;;
        *)
            echo -e "${RED}错误: 未知的服务 '$1'${NC}"
            echo ""
            show_help
            exit 1
            ;;
    esac

    echo -e "${GREEN}部署完成！${NC}"
}

# 执行主函数
main "$@"
