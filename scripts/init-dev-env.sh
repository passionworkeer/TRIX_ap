#!/bin/bash
# 一键环境初始化脚本

set -e

echo "🚀 初始化 TRIX 3D Companion 开发环境..."

# 检查依赖
echo "📋 检查系统依赖..."
command -v node >/dev/null 2>&1 || { echo "❌ 需要安装 Node.js"; exit 1; }
command -v git >/dev/null 2>&1 || { echo "❌ 需要安装 Git"; exit 1; }

# 安装依赖
echo "📦 安装项目依赖..."
npm ci

# 生成环境变量模板
if [ ! -f .env.local ]; then
  echo "🔑 生成环境变量模板..."
  cat > .env.local << EOF
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
EOF
  echo "✅ .env.local 已创建，请填写正确的环境变量"
fi

# 运行测试
echo "🧪 运行测试..."
npm test -- --run

# 类型检查
echo "📝 类型检查..."
npm run type-check

echo "✅ 开发环境初始化完成！"
echo ""
echo "🎯 下一步："
echo "  1. 编辑 .env.local 填写环境变量"
echo "  2. 运行 npm run dev 启动开发服务器"
echo "  3. 访问 http://localhost:5173"
