#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="${PACKAGE_DIR:-/root/trix-e2e/packages/trix-openclaw-native}"
STORAGE_DIR="${STORAGE_DIR:-/root/trix-e2e/state}"
ACCOUNT_ID="${ACCOUNT_ID:-default}"

/usr/bin/node "$PACKAGE_DIR/dist/cli.js" server rotate-service-token --storage-dir "$STORAGE_DIR" --account-id "$ACCOUNT_ID"
