#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-default}"
SERVICE_URL="${2:-https://trix.love}"
DURATION_SECONDS="${DURATION_SECONDS:-1800}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-60}"
OUTPUT_DIR="${OUTPUT_DIR:-$HOME/.openclaw-soak}"

mkdir -p "$OUTPUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$OUTPUT_DIR/trix-soak-$STAMP.log"

end_at=$(( $(date +%s) + DURATION_SECONDS ))

echo "profile=$PROFILE" | tee -a "$LOG_FILE"
echo "service_url=$SERVICE_URL" | tee -a "$LOG_FILE"
echo "duration_seconds=$DURATION_SECONDS" | tee -a "$LOG_FILE"
echo "interval_seconds=$INTERVAL_SECONDS" | tee -a "$LOG_FILE"

while [ "$(date +%s)" -lt "$end_at" ]; do
  now="$(date '+%Y-%m-%d %H:%M:%S %z')"
  echo "[$now] openclaw channels status --probe" | tee -a "$LOG_FILE"
  openclaw --profile "$PROFILE" channels status --probe 2>&1 | tee -a "$LOG_FILE"
  echo "[$now] openclaw plugins doctor" | tee -a "$LOG_FILE"
  openclaw --profile "$PROFILE" plugins doctor 2>&1 | tee -a "$LOG_FILE"
  echo "[$now] curl $SERVICE_URL/health" | tee -a "$LOG_FILE"
  curl --fail --silent --show-error "$SERVICE_URL/health" | tee -a "$LOG_FILE"
  echo "" | tee -a "$LOG_FILE"
  sleep "$INTERVAL_SECONDS"
done

echo "$LOG_FILE"
