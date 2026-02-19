@echo off
REM ============================================================
REM 强制更新服务器App - 完整部署脚本
REM ============================================================

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║     强制更新服务器App - 最新版本                      ║
echo ╚════════════════════════════════════════════════════════╝
echo.

set SERVER=47.243.55.130
set USER=root
set LOCAL_DIST=e:\desktop\trix-3d-companion\dist
set REMOTE_DIR=/var/www/html

echo [1/6] 检查本地构建文件...
if not exist "%LOCAL_DIST%\index.html" (
    echo ❌ 本地构建文件不存在
    echo 请先运行: npm run build
    pause
    exit /b 1
)
echo ✅ 本地构建文件存在
echo.

echo [2/6] 清空服务器Web目录...
echo 正在清空 %REMOTE_DIR%...
ssh %USER%@%SERVER% "rm -rf %REMOTE_DIR%/*"
if errorlevel 1 (
    echo ⚠️  清空目录失败，继续...
)
echo ✅ 目录已清空
echo.

echo [3/6] 上传最新文件...
echo 正在上传，可能需要几分钟...
scp -r %LOCAL_DIST%\* %USER%@%SERVER:%REMOTE_DIR%/
if errorlevel 1 (
    echo ❌ 上传失败
    pause
    exit /b 1
)
echo ✅ 文件已上传
echo.

echo [4/6] 设置文件权限...
ssh %USER%@%SERVER% "chown -R www-data:www-data %REMOTE_DIR% && chmod -R 755 %REMOTE_DIR%"
echo ✅ 权限已设置
echo.

echo [5/6] 重启Nginx...
ssh %USER%@%SERVER% "nginx -s reload && systemctl restart nginx"
echo ✅ Nginx已重启
echo.

echo [6/6] 验证部署...
ssh %USER%@%SERVER% "ls -lh %REMOTE_DIR%/index.html"
echo.

echo ╔════════════════════════════════════════════════════════╗
echo ║                  🎉 部署完成！                          ║
echo ╚════════════════════════════════════════════════════════╝
echo.
echo 部署信息:
echo   服务器: %SERVER%
echo   Web目录: %REMOTE_DIR%
echo   本地源: %LOCAL_DIST%
echo.
echo 📱 下一步:
echo   1. 在手机浏览器访问: http://%SERVER%
echo   2. 强制刷新: Ctrl+Shift+R (或清除缓存)
echo   3. 进入配对页面: http://%SERVER%/#/qr-pairing
echo   4. 检查是否为新界面
echo.
echo 🔍 如果还是旧界面:
echo   1. 清除浏览器缓存
echo   2. 使用无痕/隐私模式
echo   3. 或使用其他浏览器
echo.
pause
