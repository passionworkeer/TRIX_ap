@echo off
REM ============================================================
REM 上传App到服务器脚本
REM ============================================================

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║     上传App到服务器 - 47.243.55.130                   ║
echo ╚════════════════════════════════════════════════════════╝
echo.

echo [1/4] 检查本地构建文件...
if not exist "e:\desktop\trix-3d-companion\dist\index.html" (
    echo ❌ 错误: 构建文件不存在
    echo 请先运行: npm run build
    pause
    exit /b 1
)
echo ✅ 构建文件存在
echo.

echo [2/4] 上传到服务器...
echo 正在上传，可能需要几分钟...
echo.

scp -r e:\desktop\trix-3d-companion\dist\* root@47.243.55.130:/var/www/html/

if errorlevel 1 (
    echo ❌ 上传失败
    pause
    exit /b 1
)
echo ✅ 上传完成
echo.

echo [3/4] 重启服务器Nginx...
ssh root@47.243.55.130 "systemctl restart nginx && systemctl status nginx"

if errorlevel 1 (
    echo ⚠️ Nginx重启失败，可能需要手动重启
)
echo.

echo [4/4] 验证部署...
echo.
echo 请在浏览器中访问:
echo   http://47.243.55.130
echo.
echo 按Ctrl+Shift+R强制刷新缓存
echo.

echo ╔════════════════════════════════════════════════════════╗
echo ║                  🎉 部署完成！                          ║
echo ╚════════════════════════════════════════════════════════╝
echo.
echo 当前状态:
echo   ✅ 本地Bridge: 已连接到云端
echo   ✅ 云端Relay Server: 运行中
echo   ✅ OpenClaw Gateway: 运行中
echo   ✅ Web App: 已部署到服务器
echo.
echo 现在可以通过手机访问: http://47.243.55.130
echo.
pause
