#!/bin/bash
# Pre-push hook: Ensure E2E tests pass for production deployments
# Part of end-to-end-delivery skill quality gates

set -e  # Exit on error

echo "🔍 Running E2E test check..."

# Check if Playwright is configured
if [ ! -f "playwright.config.ts" ] && [ ! -f "playwright.config.js" ]; then
  echo "⚠️  No Playwright config found, skipping E2E check"
  exit 0
fi

# Check if package.json has E2E test script
if [ -f "package.json" ]; then
  if ! jq -e '.scripts.test'e2e' package.json > /dev/null 2>&1; then
    echo "⚠️  No E2E test script found, skipping E2E check"
    exit 0
  fi
fi

# Run E2E tests
echo "🎭 Running E2E tests..."
if npx playwright test 2>&1; then
  echo "✅ All E2E tests passed"
  exit 0
else
  echo "❌ E2E tests failed. Cannot push."
  echo ""
  echo "Please fix the failing E2E tests before pushing."
  echo "Run 'npx playwright test' to see the failures."
  echo "Run 'npx playwright test --ui' for visual debugging."
  exit 1
fi
