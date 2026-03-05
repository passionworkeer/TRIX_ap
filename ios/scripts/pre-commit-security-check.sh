#!/bin/bash
#
# Pre-commit hook to prevent hardcoded credentials in production code
# Install: cp pre-commit-security-check.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
#

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Exit on error
set -e

echo "Running security credential check..."

# Security check patterns
PATTERNS=(
    "demo@trix3d\.com"
    "demo123"
    "test123"
    "admin123"
    "password\s*=\s*['\"]\w+['\"]"
    "secret\s*=\s*['\"]\w+['\"]"
    "apiKey\s*=\s*['\"]\w+['\"]"
    "api_key\s*=\s*['\"]\w+['\"]"
    "Bearer\s+[a-zA-Z0-9_\-\.]{20,}"
)

EXCLUDED_DIRS=(
    ".env*"
    "*.xcconfig"
    "Tests/"
    "Test"
    "test"
    "vendor/"
    "Pods/"
    ".git/"
    "node_modules/"
    "reports/"
    "Docs/"
    "docs/"
)

# Build find command with exclusions
FIND_CMD="find . -type f \\( -name '*.swift' -o -name '*.m' -o -name '*.h' \\)"
for dir in "${EXCLUDED_DIRS[@]}"; do
    FIND_CMD="$FIND_CMD -not -path '*/$dir*'"
done

# Track issues found
ISSUES_FOUND=0

# Check each pattern
for pattern in "${PATTERNS[@]}"; do
    echo "Checking for pattern: $pattern"

    # Run grep with the find command output
    if eval "$FIND_CMD" | xargs grep -iE "$pattern" 2>/dev/null; then
        echo -e "${RED}❌ Security issue found: Potential hardcoded credential matching '$pattern'${NC}"
        ISSUES_FOUND=1
    fi
done

# Check for demo credentials specifically in AuthService.swift
if grep -q "demo@trix3d\.com" TRIX3DCompanion/Core/Services/AuthService.swift 2>/dev/null; then
    if ! grep -q "#if DEBUG" TRIX3DCompanion/Core/Services/AuthService.swift 2>/dev/null; then
        echo -e "${RED}❌ Security issue: Demo credentials found without DEBUG guard in AuthService.swift${NC}"
        ISSUES_FOUND=1
    fi
fi

# Check if demo function is exposed in Release builds
if grep -A 5 "#if !DEBUG" TRIX3DCompanion/Core/Services/AuthService.swift 2>/dev/null | grep -q "demoLogin"; then
    echo -e "${RED}❌ Security issue: Demo function exposed in Release builds${NC}"
    ISSUES_FOUND=1
fi

# Report results
if [ $ISSUES_FOUND -eq 1 ]; then
    echo -e "\n${RED}❌ SECURITY CHECK FAILED${NC}"
    echo -e "${YELLOW}Potential hardcoded credentials detected in the codebase.${NC}"
    echo -e "${YELLOW}Please remove them or wrap them in '#if DEBUG' blocks.${NC}"
    echo ""
    echo "To bypass this check (not recommended): git commit --no-verify"
    exit 1
fi

echo -e "${GREEN}✅ Security credential check passed${NC}"
exit 0
