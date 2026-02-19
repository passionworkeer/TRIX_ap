@echo off
REM ============================================================
REM OpenClaw Gateway Bridge - 一键部署脚本
REM 用途: 将云端 Relay Server 部署到 TRIX_SERVER_HOST
REM ============================================================

setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║     OpenClaw Gateway Bridge - 一键部署工具             ║
echo ╚════════════════════════════════════════════════════════╝
echo.

REM 配置
set SERVER=TRIX_SERVER_HOST
set SERVER_USER=root
set SERVER_DIR=/root/nanobot
set LOCAL_DIR=e:\desktop\trix-3d-companion\bridge

echo [1/5] 检查本地文件...
if not exist "%LOCAL_DIR%\relay_server_with_bridge.py" (
    echo ❌ 错误: 找不到 relay_server_with_bridge.py
    pause
    exit /b 1
)
if not exist "%LOCAL_DIR%\deploy_production.sh" (
    echo ❌ 错误: 找不到 deploy_production.sh
    pause
    exit /b 1
)
echo ✅ 本地文件检查通过
echo.

echo [2/5] 上传文件到服务器...
echo 正在上传 relay_server_with_bridge.py...
scp "%LOCAL_DIR%\relay_server_with_bridge.py" %SERVER_USER%@%SERVER%:%SERVER_DIR%/
if errorlevel 1 (
    echo ❌ 上传失败
    pause
    exit /b 1
)
echo ✅ relay_server_with_bridge.py 上传成功

echo 正在上传 deploy_production.sh...
scp "%LOCAL_DIR%\deploy_production.sh" %SERVER_USER%@%SERVER%:%SERVER_DIR%/
if errorlevel 1 (
    echo ❌ 上传失败
    pause
    exit /b 1
)
echo ✅ deploy_production.sh 上传成功
echo.

echo [3/5] 在服务器上执行部署脚本...
ssh %SERVER_USER%@%SERVER% "cd %SERVER_DIR% && chmod +x deploy_production.sh && ./deploy_production.sh"
if errorlevel 1 (
    echo ❌ 部署失败
    pause
    exit /b 1
)
echo.

echo [4/5] 验证服务状态...
ssh %SERVER_USER%@%SERVER% "pm2 status relay-server"
echo.

echo [5/5] 重启本地 Bridge...
cd /d "%LOCAL_DIR%"
echo 正在停止旧的 Bridge 进程...
pm2 stop openclaw-bridge 2>nul
pm2 delete openclaw-bridge 2>nul
echo.

echo 启动生产模式 Bridge...
pm2 start openclaw-bridge.js --name openclaw-bridge --env production
if errorlevel 1 (
    echo ⚠️  PM2 启动失败，尝试直接运行...
    set NODE_ENV=production
    node openclaw-bridge.js
)
echo.

echo ╔════════════════════════════════════════════════════════╗
echo ║                  🎉 部署完成！                          ║
echo ╚════════════════════════════════════════════════════════╝
echo.
echo 📋 部署信息:
echo   云端服务器:     %SERVER%
echo   Relay Server:   ws://%SERVER%:8765
echo   本地 Bridge:    连接到云端 ✅
echo   OpenClaw:       localhost:18789 ✅
echo.
echo 📱 下一步:
echo   1. 确保本地 Bridge 正在运行
echo   2. 手机访问: http://%SERVER%
echo   3. 在 App 中配对 OpenClaw
echo.
echo 🔧 常用命令:
echo   查看云端日志:   ssh %SERVER_USER%@%SERVER% "pm2 logs relay-server"
echo   查看本地日志:   pm2 logs openclaw-bridge
echo   重启本地Bridge: pm2 restart openclaw-bridge
echo.
pause
