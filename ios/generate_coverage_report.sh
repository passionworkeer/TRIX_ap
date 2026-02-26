#!/bin/bash

# iOS Test Coverage Report Generator
# Usage: ./generate_coverage_report.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="TRIX3DCompanion"
SCHEME="TRIX3DCompanion"
WORKSPACE="TRIX3DCompanion.xcworkspace"
PROJECT="TRIX3DCompanion.xcodeproj"
RESULT_BUNDLE_PATH="TestResults.xcresult"
COVERAGE_REPORT_HTML="coverage_report.html"
COVERAGE_REPORT_JSON="coverage_report.json"
TARGET_COVERAGE=80

echo -e "${BLUE}====================================${NC}"
echo -e "${BLUE}iOS Test Coverage Report Generator${NC}"
echo -e "${BLUE}====================================${NC}"
echo ""

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}Error: This script must be run on macOS${NC}"
    echo "Please run this script on a Mac with Xcode installed"
    exit 1
fi

# Check for xcodebuild
if ! command -v xcodebuild &> /dev/null; then
    echo -e "${RED}Error: xcodebuild not found${NC}"
    echo "Please install Xcode Command Line Tools"
    exit 1
fi

# Navigate to iOS project
IOS_DIR="$(dirname "$0")"
cd "$IOS_DIR" || exit 1

echo -e "${BLUE}Current directory: $(pwd)${NC}"
echo ""

# Check for workspace or project
if [ -f "$WORKSPACE" ]; then
    BUILD_CMD="-workspace '$WORKSPACE' -scheme '$SCHEME'"
    echo -e "${GREEN}Using workspace: $WORKSPACE${NC}"
elif [ -f "$PROJECT" ]; then
    BUILD_CMD="-project '$PROJECT' -scheme '$SCHEME'"
    echo -e "${GREEN}Using project: $PROJECT${NC}"
else
    echo -e "${RED}Error: Neither workspace nor project found${NC}"
    exit 1
fi

echo ""

# Clean previous results
echo -e "${YELLOW}Cleaning previous test results...${NC}"
rm -rf "$RESULT_BUNDLE_PATH"
rm -f "$COVERAGE_REPORT_HTML"
rm -f "$COVERAGE_REPORT_JSON"
echo -e "${GREEN}Cleaned previous results${NC}"
echo ""

# Run tests with coverage
echo -e "${BLUE}====================================${NC}"
echo -e "${BLUE}Running Tests with Code Coverage${NC}"
echo -e "${BLUE}====================================${NC}"
echo ""

eval "xcodebuild test \
    $BUILD_CMD \
    -destination 'platform=iOS Simulator,name=iPhone 15,OS=latest' \
    -enableCodeCoverage YES \
    -resultBundlePath '$RESULT_BUNDLE_PATH' \
    | xcpretty || true"

echo ""

# Check if tests ran successfully
if [ ! -d "$RESULT_BUNDLE_PATH" ]; then
    echo -e "${RED}Error: Test results not found${NC}"
    echo "Tests may have failed. Check the output above."
    exit 1
fi

echo -e "${GREEN}Tests completed successfully${NC}"
echo ""

# Generate coverage report (HTML)
echo -e "${BLUE}====================================${NC}"
echo -e "${BLUE}Generating Coverage Report${NC}"
echo -e "${BLUE}====================================${NC}"
echo ""

xcrun llvm-cov report \
    "$RESULT_BUNDLE_PATH" \
    --format=html \
    > "$COVERAGE_REPORT_HTML" 2>&1

# Generate coverage report (JSON for parsing)
xcrun llvm-cov report \
    "$RESULT_BUNDLE_PATH" \
    --format=json \
    > "$COVERAGE_REPORT_JSON" 2>&1 || true

# Get total coverage percentage
COVERAGE_OUTPUT=$(xcrun llvm-cov report "$RESULT_BUNDLE_PATH" 2>&1)
TOTAL_COVERAGE=$(echo "$COVERAGE_OUTPUT" | grep "TOTAL" | awk '{print $NF}' | sed 's/%//')

echo ""
echo -e "${GREEN}Coverage report generated${NC}"
echo ""

# Parse and display coverage
echo -e "${BLUE}====================================${NC}"
echo -e "${BLUE}Coverage Summary${NC}"
echo -e "${BLUE}====================================${NC}"
echo ""

# Display individual file coverage
echo "$COVERAGE_OUTPUT" | grep -E "\.swift:" || true

echo ""
echo -e "${BLUE}====================================${NC}"

# Check if target coverage is met
if [ -n "$TOTAL_COVERAGE" ]; then
    echo -e "Total Coverage: ${BLUE}${TOTAL_COVERAGE}%${NC}"
    echo ""

    # Convert to integer for comparison
    COVERAGE_INT=${TOTAL_COVERAGE%.*}

    if [ "$COVERAGE_INT" -ge "$TARGET_COVERAGE" ]; then
        echo -e "${GREEN}✓ Target coverage of ${TARGET_COVERAGE}% met!${NC}"
    else
        echo -e "${YELLOW}⚠ Target coverage of ${TARGET_COVERAGE}% not met (current: ${TOTAL_COVERAGE}%)${NC}"
    fi
else
    echo -e "${YELLOW}Warning: Could not determine total coverage percentage${NC}"
fi

echo ""
echo -e "${BLUE}====================================${NC}"
echo ""

# Open HTML report
if command -v open &> /dev/null; then
    echo -e "${GREEN}Opening coverage report in browser...${NC}"
    open "$COVERAGE_REPORT_HTML"
fi

# List files below coverage threshold
echo -e "${YELLOW}Files with coverage below ${TARGET_COVERAGE}%:${NC}"
echo "$COVERAGE_OUTPUT" | awk -v target="$TARGET_COVERAGE" '
{
    # Check if line contains percentage
    if (match($0, /[0-9]+\.[0-9]+%/)) {
        # Extract percentage
        percent = substr($0, RSTART, RLENGTH-1)
        gsub(/%/, "", percent)

        # Get filename
        split($0, parts, "|")
        filename = parts[1]
        gsub(/^[ \t]+|[ \t]+$/, "", filename)

        # Check if below target
        if (percent < target && percent > 0) {
            printf "  - %s: %.1f%%\n", filename, percent
        }
    }
}'
echo ""

# List test files with counts
echo -e "${BLUE}Test Files Summary:${NC}"
TEST_COUNT=$(find . -name "*Tests.swift" -o -name "*Test.swift" 2>/dev/null | wc -l)
echo "  Total test files: $TEST_COUNT"
echo ""

echo -e "${GREEN}Coverage report saved to:${NC}"
echo "  - HTML: $COVERAGE_REPORT_HTML"
echo "  - JSON: $COVERAGE_REPORT_JSON"
echo "  - XCResult: $RESULT_BUNDLE_PATH"
echo ""

echo -e "${BLUE}====================================${NC}"
echo -e "${BLUE}Report Generation Complete${NC}"
echo -e "${BLUE}====================================${NC}"
