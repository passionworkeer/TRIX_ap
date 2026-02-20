#!/bin/bash
# 快速诊断脚本

echo "🔍 诊断 TRIX 项目状态..."
echo ""

# 检查类型错误
echo "📝 TypeScript 类型检查..."
npm run type-check 2>&1 | head -20

# 检查代码规范
echo ""
echo "🔍 ESLint 检查..."
npm run lint 2>&1 | head -20

# 检查测试
echo ""
echo "🧪 测试检查..."
npm test -- --run 2>&1 | tail -10

# 检查构建
echo ""
echo "🏗️ 构建检查..."
npm run build 2>&1 | tail -5

# 检查环境变量
echo ""
echo "🔑 环境变量检查..."
if [ -f .env.local ]; then
  echo "✅ .env.local 存在"
  grep -q "VITE_SUPABASE_URL" .env.local && echo "✅ SUPABASE_URL 已设置" || echo "⚠️  SUPABASE_URL 未设置"
else
  echo "⚠️  .env.local 不存在"
fi

# 检查依赖安全
echo ""
echo "🔒 依赖安全检查..."
npm audit --audit-level=moderate 2>&1 | tail -5

echo ""
echo "✅ 诊断完成！"
