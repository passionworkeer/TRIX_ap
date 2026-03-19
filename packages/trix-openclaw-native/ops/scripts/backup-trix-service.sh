#!/usr/bin/env bash
set -euo pipefail

STATE_DIR="${1:-/root/trix-e2e/state}"
BACKUP_DIR="${2:-/root/trix-e2e/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="$BACKUP_DIR/trix-service-$STAMP.tar.gz"

tar -C "$(dirname "$STATE_DIR")" -czf "$ARCHIVE" "$(basename "$STATE_DIR")"
find "$BACKUP_DIR" -type f -name 'trix-service-*.tar.gz' -mtime +"$RETENTION_DAYS" -delete

echo "$ARCHIVE"
