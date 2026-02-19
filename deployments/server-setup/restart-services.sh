#!/bin/bash
# Clawbot Channel 重启脚本

set -e

APP_NAME="clawbot-channel"
APP_DIR="/opt/clawbot-channel"

echo "Restarting ${APP_NAME}..."

if ! command -v pm2 > /dev/null 2>&1; then
    echo "Error: pm2 is not installed. Please install pm2 first."
    exit 1
fi

if [ ! -d "$APP_DIR" ]; then
    echo "Error: app directory not found: $APP_DIR"
    exit 1
fi

cd "$APP_DIR"

if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
    echo "Restart existing PM2 process..."
    pm2 restart "$APP_NAME"
else
    echo "PM2 process not found, start from ecosystem config..."
    pm2 start ecosystem.config.js --only "$APP_NAME"
fi

echo "PM2 status:"
pm2 status "$APP_NAME"

echo "Health check:"
if curl -fsS http://127.0.0.1:8765/health > /dev/null; then
    echo "Health check passed: http://127.0.0.1:8765/health"
else
    echo "Warning: health check failed, please inspect logs: pm2 logs $APP_NAME"
fi
