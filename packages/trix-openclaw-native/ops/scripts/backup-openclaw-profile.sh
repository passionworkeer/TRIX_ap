#!/usr/bin/env bash
set -euo pipefail

PROFILE_DIR="${1:-$HOME/.openclaw}"
BACKUP_DIR="${2:-$HOME/.openclaw-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="$BACKUP_DIR/openclaw-profile-$STAMP.tar.gz"

tar -C "$(dirname "$PROFILE_DIR")" -czf "$ARCHIVE" "$(basename "$PROFILE_DIR")"
find "$BACKUP_DIR" -type f -name 'openclaw-profile-*.tar.gz' -mtime +"$RETENTION_DAYS" -delete

echo "$ARCHIVE"
