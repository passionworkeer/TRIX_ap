# ============================================
# TRIX 3D Companion - Windows 部署脚本
# 适用于 PowerShell 7+
# ============================================

$ErrorActionPreference = "Stop"

# 配置变量 - 请修改这些值
$SERVER_USER = "root"           # 服务器用户名
$SERVER_HOST = "47.243.55.130"  # 服务器 IP 地址
$DEPLOY_PATH = "/var/www/trix-3d-companion"

Write-Host "============================================" -ForegroundColor Green
Write-Host "  TRIX 3D Companion - 自动化部署" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

# 检查是否安装了依赖
Write-Host "[检查] 检测依赖..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    $npmVersion = npm --version
    $gitVersion = git --version

    Write-Host "  ✓ Node.js: $nodeVersion" -ForegroundColor Green
    Write-Host "  ✓ npm: $npmVersion" -ForegroundColor Green
    Write-Host "  ✓ Git: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ 缺少依赖，请先安装 Node.js 和 Git" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 1. 本地构建
Write-Host "[1/5] 本地构建项目..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ 构建失败" -ForegroundColor Red
    exit 1
}
Write-Host "✓ 构建完成" -ForegroundColor Green
Write-Host ""

# 2. 打包构建产物
Write-Host "[2/5] 打包构建产物..." -ForegroundColor Yellow
Compress-Archive -Path "dist\*" -DestinationPath "trix-build.zip" -Force
Write-Host "✓ 打包完成" -ForegroundColor Green
Write-Host ""

# 3. 上传到服务器 (使用 scp)
Write-Host "[3/5] 上传到服务器..." -ForegroundColor Yellow
Write-Host "  服务器: ${SERVER_USER}@${SERVER_HOST}" -ForegroundColor Cyan

# 检查是否安装了 OpenSSH 客户端
$sshInstalled = Get-Service -Name OpenSSH* -ErrorAction SilentlyContinue
if (-not $sshInstalled) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Yellow
    Write-Host "  需要手动上传文件" -ForegroundColor Yellow
    Write-Host "============================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "由于 Windows 环境限制，请手动完成以下步骤:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. 使用工具将以下文件上传到服务器:" -ForegroundColor White
    Write-Host "   - trix-build.zip" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. 在服务器上执行:" -ForegroundColor White
    Write-Host "   mkdir -p $DEPLOY_PATH" -ForegroundColor Cyan
    Write-Host "   unzip trix-build.zip -d $DEPLOY_PATH" -ForegroundColor Cyan
    Write-Host "   chown -R www-data:www-data $DEPLOY_PATH" -ForegroundColor Cyan
    Write-Host "   chmod -R 755 $DEPLOY_PATH" -ForegroundColor Cyan
    Write-Host "   systemctl reload nginx" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "推荐工具:" -ForegroundColor Yellow
    Write-Host "  - WinSCP: https://winscp.net/" -ForegroundColor White
    Write-Host "  - FileZilla: https://filezilla-project.org/" -ForegroundColor White
    Write-Host "  - MobaXterm: https://mobaxterm.mobatek.net/" -ForegroundColor White
    Write-Host ""

    # 询问是否继续
    $continue = Read-Host "是否继续配置服务器环境变量? (y/n)"
    if ($continue -ne "y") {
        exit 0
    }
} else {
    # 使用 scp 上传（如果可用）
    scp trix-build.zip "${SERVER_USER}@${SERVER_HOST}:/tmp/"
    Write-Host "✓ 上传完成" -ForegroundColor Green
    Write-Host ""

    # 4. 服务器端部署
    Write-Host "[4/5] 服务器部署..." -ForegroundColor Yellow

    $sshCommand = @"
        mkdir -p $DEPLOY_PATH
        unzip -o /tmp/trix-build.zip -d $DEPLOY_PATH
        chown -R www-data:www-data $DEPLOY_PATH
        chmod -R 755 $DEPLOY_PATH
        rm /tmp/trix-build.zip
        echo "✓ 部署完成"
"@

    ssh "${SERVER_USER}@${SERVER_HOST}" $sshCommand
    Write-Host ""

    # 5. 重启 Nginx
    Write-Host "[5/5] 重启 Nginx..." -ForegroundColor Yellow
    ssh "${SERVER_USER}@${SERVER_HOST}" "nginx -t && systemctl reload nginx"
    Write-Host "✓ Nginx 重启完成" -ForegroundColor Green
    Write-Host ""
}

# 6. 配置环境变量
Write-Host "[环境变量] 配置提示" -ForegroundColor Yellow
Write-Host ""
Write-Host "请在服务器上创建 .env.production 文件:" -ForegroundColor White
Write-Host "  cd $DEPLOY_PATH" -ForegroundColor Cyan
Write-Host "  nano .env.production" -ForegroundColor Cyan
Write-Host ""
Write-Host "添加以下内容:" -ForegroundColor White
Write-Host "  VITE_SUPABASE_URL=https://your-project-id.supabase.co" -ForegroundColor Gray
Write-Host "  VITE_SUPABASE_ANON_KEY=your_anon_key_here" -ForegroundColor Gray
Write-Host "  VITE_PC_WEBSOCKET_URL=ws://$SERVER_HOST:18789" -ForegroundColor Gray
Write-Host "  VITE_PC_AUTH_TOKEN=your_auth_token_here" -ForegroundColor Gray
Write-Host ""

# 7. 清理临时文件
Write-Host "[清理] 删除本地临时文件..." -ForegroundColor Yellow
Remove-Item trix-build.zip -Force -ErrorAction SilentlyContinue
Write-Host "✓ 清理完成" -ForegroundColor Green
Write-Host ""

Write-Host "============================================" -ForegroundColor Green
Write-Host "  部署脚本执行完成！" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "访问地址: http://$SERVER_HOST" -ForegroundColor Cyan
Write-Host ""
