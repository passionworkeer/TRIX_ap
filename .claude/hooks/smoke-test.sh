#!/bin/bash
# PostToolUse hook: Verify deployment health after pushing
# Part of end-to-end-delivery skill quality gates

# Configuration - set these in your environment or project config
DEPLOY_URL="${DEPLOY_URL:-http://localhost:3000}"
HEALTH_CHECK_PATH="${HEALTH_CHECK_PATH:-/health}"
MAX_RETRIES="${MAX_RETRIES:-30}"
RETRY_DELAY="${RETRY_DELAY:-2}"

echo "🏥 Running deployment health check..."

# Function to check URL health
check_health() {
  local url=$1
  local attempt=$2

  echo "Attempt $attempt: Checking $url..."

  if curl -f -s -S "$url" > /dev/null 2>&1; then
    echo "✅ Health check passed"
    return 0
  else
    echo "❌ Health check failed"
    return 1
  fi
}

# Main health check loop
HEALTH_URL="$DEPLOY_URL$HEALTH_CHECK_PATH"

for ((i=1; i<=MAX_RETRIES; i++)); do
  if check_health "$HEALTH_URL" $i; then
    echo "✅ Deployment is healthy!"
    exit 0
  fi

  if [ $i -lt $MAX_RETRIES ]; then
    echo "Waiting ${RETRY_DELAY}s before retry..."
    sleep $RETRY_DELAY
  fi
done

echo "❌ Health check failed after $MAX_RETRIES attempts"
echo ""
echo "The deployment may not be working correctly."
echo "Please check:"
echo "  1. Deployment logs: gh run view --log"
echo "  2. Server status: systemctl status nginx"
echo "  3. Application logs: journalctl -u your-app"
echo ""
echo "You may need to rollback:"
echo "  git revert HEAD"
echo "  git push"

exit 1
