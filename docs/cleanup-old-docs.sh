#!/bin/bash
# 文档整理清理脚本
# 移除已整合到新文档中的旧版本

echo "开始清理已整合的冗余文档..."

# 定义归档目录
ARCHIVE_DIR="docs/archive"

# 创建归档目录（如果不存在）
mkdir -p "$ARCHIVE_DIR"

# 已整合的文档列表
declare -A ARCHIVED_DOCS=(
    # Nanobot 相关（已整合到 NANOBOT_INTEGRATION_GUIDE.md）
    ["docs/NANOBOT_CONFIG_STATUS.md"]="NANOBOT_INTEGRATION_GUIDE.md"
    ["docs/NANOBOT_THREE_WAY_CONNECTION_GUIDE.md"]="NANOBOT_INTEGRATION_GUIDE.md"
    ["docs/CLOUD_SERVER_AND_APP_IMPLEMENTATION.md"]="NANOBOT_INTEGRATION_GUIDE.md"
    ["docs/MYAPP_INTEGRATION_GUIDE.md"]="NANOBOT_INTEGRATION_GUIDE.md"
    ["docs/IMPLEMENTATION_COMPARISON.md"]="NANOBOT_INTEGRATION_GUIDE.md"

    # 部署相关（已整合到 DEPLOYMENT_GUIDE.md）
    ["docs/AUTO_DEPLOY_COMPLETE_GUIDE.md"]="DEPLOYMENT_GUIDE.md"
    ["docs/deployment/AUTO_DEPLOY.md"]="DEPLOYMENT_GUIDE.md"
    ["docs/deployment/DEPLOY.md"]="DEPLOYMENT_GUIDE.md"
    ["docs/deployment/HTTPS_SETUP_GUIDE.md"]="DEPLOYMENT_GUIDE.md"
)

# 移动文档到归档
for doc in "${!ARCHIVED_DOCS[@]}"; do
    if [ -f "$doc" ]; then
        echo "移动: $doc -> $ARCHIVE_DIR/"
        mv "$doc" "$ARCHIVE_DIR/"
    fi
done

# 移除归档目录中已完全重复的文档
echo "清理 archive/ 中完全重复的文档..."
cd "$ARCHIVE_DIR" || exit 1

# 保留列表（这些文档有参考价值，保留）
KEEP_DOCS=(
    "QR_PAIRING_IMPLEMENTATION.md"  # 配对实现历史
    "MEDIA_URL_DEBUG.md"             # 调试记录
    "TRIX_INTEGRATION_GUIDE.md"      # 外部集成指南
)

# 删除已移动到 archive 的冗余文档
for file in *; do
    if [ -f "$file" ]; then
        # 检查是否在保留列表中
        keep=0
        for keep_doc in "${KEEP_DOCS[@]}"; do
            if [ "$file" == "$keep_doc" ]; then
                keep=1
                break
            fi
        done

        # 如果不在保留列表中，删除
        if [ $keep -eq 0 ]; then
            echo "删除冗余文档: $file (已整合到新文档)"
            rm -f "$file"
        fi
    fi
done

cd - > /dev/null

echo "文档整理完成！"
echo ""
echo "新增文档:"
echo "  ✓ PROJECT_AUDIT_REPORT.md      - 项目审核报告"
echo "  ✓ TECH_STACK_AND_HIGHLIGHTS.md - 技术栈与亮点"
echo "  ✓ NANOBOT_INTEGRATION_GUIDE.md - Nanobot 集成指南"
echo "  ✓ DEPLOYMENT_GUIDE.md         - 部署完整指南"
echo ""
echo "已归档的旧文档已移动到 docs/archive/ 目录"
echo "建议手动审查后删除不必要的文档。"
