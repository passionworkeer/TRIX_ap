@echo off
echo ====================================
echo TRIX Channel Launcher
echo ====================================
echo.

cd /d "%~dp0"

echo [1/3] 检查依赖...
if not exist "node_modules" (
    echo 安装依赖...
    call npm install
    if errorlevel 1 (
        echo ❌ 安装依赖失败
        pause
        exit /b 1
    )
)

echo [2/3] 启动 TRIX Channel...
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 📡 服务器: http://TRIX_SERVER_HOST:8765
echo 🌐 Gateway: ws://127.0.0.1:18789
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

node index.js

if errorlevel 1 (
    echo.
    echo ❌ 启动失败
    pause
    exit /b 1
)
