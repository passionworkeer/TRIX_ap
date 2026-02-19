@echo off
REM ============================================
REM TRIX 3D Companion - 一键自动部署脚本
REM ============================================
REM
REM 用途：将本地代码推送到 GitHub 后，自动部署到服务器
REM 使用：在本地修改代码后，运行此脚本即可自动部署

echo.
echo ============================================
echo   TRIX 3D Companion - 自动部署
echo ============================================
echo.

SET SERVER=47.243.55.130
SET USER=root

echo [1/6] 提交代码到 Git...
git add -A
git commit -m "auto-deploy: %date% %time%"
git push origin feature/nanobot-integration
if errorlevel 1 (
    echo ❌ Git 推送失败
    pause
    exit /b 1
)
echo ✅ Git 推送成功
echo.

echo [2/6] 本地构建...
call npm run build
if errorlevel 1 (
    echo ❌ 构建失败
    pause
    exit /b 1
)
echo ✅ 构建成功
echo.

echo [3/6] 清空服务器目录...
ssh %USER%@%SERVER "rm -rf /var/www/html/*"
echo ✅ 服务器目录已清空
echo.

echo [4/6] 上传文件...
scp dist\index.html %USER%@%SERVER:/var/www/html/
cd dist && tar -czf ..\build.tar.gz assets/ && cd ..
scp build.tar.gz %USER%@%SERVER:/tmp/
ssh %USER%@%SERVER "cd /var/www/html && tar -xzf /tmp/build.tar.gz && rm /tmp/build.tar.gz"
del build.tar.gz
echo ✅ 文件已上传
echo.

echo [5/6] 设置权限...
ssh %USER%@%SERVER "chown -R www-data:www-data /var/www/html/ && chmod -R 755 /var/www/html/"
echo ✅ 权限已设置
echo.

echo [6/6] 重启服务...
ssh %USER%@%SERVER "systemctl reload nginx"
echo ✅ Nginx 已重启
echo.

echo ============================================
echo   🎉 部署完成！
echo ============================================
echo.
echo 📱 访问地址: http://%SERVER%
echo.
echo 💡 提示：
echo    - 清除浏览器缓存查看最新版本
echo    - 使用 Ctrl+Shift+R 强制刷新
echo.
pause
