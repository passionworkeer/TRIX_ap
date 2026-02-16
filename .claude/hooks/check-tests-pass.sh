#!/bin/bash
# Pre-commit hook: Ensure all tests pass before allowing commit
# Part of end-to-end-delivery skill quality gates

set -e  # Exit on error

echo "🔍 Running pre-commit test check..."

# Check if package.json exists
if [ ! -f "package.json" ]; then
  echo "⚠️  No package.json found, skipping test check"
  exit 0
fi

# Check if test script exists
if ! jq -e '.scripts.test' package.json > /dev/null 2>&1; then
  echo "⚠️  No test script found in package.json, skipping test check"
  exit 0
fi

# Run tests
echo "🧪 Running tests..."
if npm test 2>&1; then
  echo "✅ All tests passed"
  exit 0
else
  echo "❌ Tests failed. Cannot commit."
  echo ""
  echo "Please fix the failing tests before committing."
  echo "Run 'npm test' to see the failures."
  exit 1
fi
