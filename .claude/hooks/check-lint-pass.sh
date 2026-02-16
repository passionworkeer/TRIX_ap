#!/bin/bash
# PreToolUse hook: Ensure code passes linting before write operations
# Part of end-to-end-delivery skill quality gates

set -e  # Exit on error

echo "🔍 Running linting check..."

# Check if package.json exists
if [ ! -f "package.json" ]; then
  echo "⚠️  No package.json found, skipping lint check"
  exit 0
fi

# Check if lint script exists
if ! jq -e '.scripts.lint' package.json > /dev/null 2>&1; then
  echo "⚠️  No lint script found in package.json, skipping lint check"
  exit 0
fi

# Run lint
echo "🔍 Linting code..."
if npm run lint 2>&1; then
  echo "✅ Linting passed"
  exit 0
else
  echo "❌ Linting failed. Please fix linting errors."
  echo ""
  echo "Run 'npm run lint' to see the issues."
  echo "Many projects support 'npm run lint -- --fix' to auto-fix issues."
  exit 1
fi
