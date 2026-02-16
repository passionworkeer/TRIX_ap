#!/bin/bash
# Pre-push hook: Ensure build passes before allowing push
# Part of end-to-end-delivery skill quality gates

set -e  # Exit on error

echo "🔍 Running pre-push build check..."

# Check if package.json exists
if [ ! -f "package.json" ]; then
  echo "⚠️  No package.json found, skipping build check"
  exit 0
fi

# Check if build script exists
if ! jq -e '.scripts.build' package.json > /dev/null 2>&1; then
  echo "⚠️  No build script found in package.json, skipping build check"
  exit 0
fi

# Run build
echo "🔨 Building project..."
if npm run build 2>&1; then
  echo "✅ Build successful"
  exit 0
else
  echo "❌ Build failed. Cannot push."
  echo ""
  echo "Please fix the build errors before pushing."
  echo "Run 'npm run build' to see the errors."
  exit 1
fi
