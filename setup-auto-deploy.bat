@echo off
REM ============================================
REM 配置 GitHub Actions 自动部署
REM ============================================

echo.
echo ============================================
echo   配置 GitHub Actions 自动部署
echo ============================================
echo.

echo [1/4] 生成 SSH 密钥对（如果不存在）...
if not exist "%USERPROFILE%\.ssh\github_actions" (
    echo 正在生成 SSH 密钥对...
    ssh-keygen -t rsa -b 4096 -C "github-actions" -f %USERPROFILE%\.ssh\github_actions -N ""
    echo ✅ SSH 密钥对已生成
) else (
    echo ✅ SSH 密钥对已存在
)
echo.

echo [2/4] 上传公钥到服务器...
type %USERPROFILE%\.ssh\github_actions.pub | ssh root@47.243.55.130 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
echo ✅ 公钥已上传到服务器
echo.

echo [3/4] 获取私钥内容...
echo.
echo ============================================
echo   复制以下私钥内容（包括 BEGIN 和 END 行）
echo ============================================
echo.
type %USERPROFILE%\.ssh\github_actions
echo.
echo ============================================
echo.
pause

echo.
echo [4/4] 配置 GitHub Secrets...
echo.
echo 请按照以下步骤操作：
echo.
echo 1. 打开浏览器，访问：
echo    https://github.com/meowdoone/TRIX_ap/settings/secrets/actions
echo.
echo 2. 点击 "New repository secret"，添加以下 Secrets：
echo.
echo    Name: SERVER_HOST
echo    Value: 47.243.55.130
echo.
echo    Name: SERVER_USER
echo    Value: root
echo.
echo    Name: SSH_PRIVATE_KEY
echo    Value: (粘贴上面显示的私钥内容)
echo.
echo    Name: VITE_SUPABASE_URL
echo    Value: https://hmbukjvrbyhbuqumqdug.supabase.co
echo.
echo    Name: VITE_SUPABASE_ANON_KEY
echo    Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtYnVranZyYnloYnVxdW1xZHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MDY5NTgsImV4cCI6MjA4NjI4Mjk1OH0.i6xwAotL826Dob_P71YrnhW6jITyVMV3xU5zmIbNs20
echo.
echo 3. 添加完成后，按任意键继续...
pause > nul
echo.

echo [完成] 推送代码到 GitHub 触发自动部署...
git add .github/workflows/deploy.yml
git commit -m "feat: 配置 GitHub Actions 自动部署"
git push origin feature-nanobot-integration

echo.
echo ============================================
echo   ✅ 配置完成！
echo ============================================
echo.
echo 现在每次推送代码到 feature-nanobot-integration 分支，
echo GitHub Actions 会自动构建并部署到服务器！
echo.
echo 📊 查看部署状态：
echo    https://github.com/meowdoone/TRIX_ap/actions
echo.
pause
