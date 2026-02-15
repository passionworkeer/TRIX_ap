# ============================================
# Clawbot Channel - 自动部署脚本
# 适用于 PowerShell 5.1+
# ============================================

$ErrorActionPreference = "Stop"

# 配置变量
$SERVER_USER = "root"
$SERVER_HOST = "47.243.55.130"
$SERVER_PORT = "22"
$DEPLOY_PATH = "/opt/clawbot-channel"
$LOCAL_CODE_PATH = "E:\desktop\trix-3d-companion\server\clawbot-channel"
$ZIP_FILE = "E:\desktop\trix-3d-companion\clawbot-channel-deploy.zip"

Write-Host "============================================" -ForegroundColor Green
Write-Host "  Clawbot Channel - 自动化部署" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

# 步骤 0: 检查本地代码
Write-Host "[0/7] 检查本地代码..." -ForegroundColor Yellow
if (-not (Test-Path "$LOCAL_CODE_PATH")) {
    Write-Host "✗ 本地代码目录不存在: $LOCAL_CODE_PATH" -ForegroundColor Red
    exit 1
}
Write-Host "✓ 本地代码目录存在" -ForegroundColor Green
Write-Host ""

# 步骤 1: 创建部署包
Write-Host "[1/7] 创建部署压缩包..." -ForegroundColor Yellow
if (Test-Path $ZIP_FILE) {
    Remove-Item $ZIP_FILE -Force
}
Compress-Archive -Path "$LOCAL_CODE_PATH\*" -DestinationPath $ZIP_FILE -Force
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ 创建压缩包失败" -ForegroundColor Red
    exit 1
}
$zipSize = (Get-Item $ZIP_FILE).Length / 1MB
Write-Host "✓ 压缩包创建成功: $ZIP_FILE ($([math]::Round($zipSize, 2)) MB)" -ForegroundColor Green
Write-Host ""

# 步骤 2: 测试 SSH 连接
Write-Host "[2/7] 测试 SSH 连接..." -ForegroundColor Yellow
Write-Host "  服务器: ${SERVER_USER}@${SERVER_HOST}" -ForegroundColor Cyan
Write-Host ""
Write-Host "请手动执行以下命令测试连接：" -ForegroundColor White
Write-Host "  ssh ${SERVER_USER}@${SERVER_HOST}" -ForegroundColor Cyan
Write-Host ""

$testConn = Read-Host "SSH 连接是否成功? (y/n)"
if ($testConn -ne "y") {
    Write-Host "✗ SSH 连接失败，请检查网络或服务器配置" -ForegroundColor Red
    exit 1
}
Write-Host "✓ SSH 连接正常" -ForegroundColor Green
Write-Host ""

# 步骤 3: 上传压缩包
Write-Host "[3/7] 上传部署包到服务器..." -ForegroundColor Yellow
Write-Host "  正在上传，请稍候..." -ForegroundColor Cyan

# 使用 scp 上传（需要安装 OpenSSH 客户端）
$scpCmd = "scp -P $SERVER_PORT `"$ZIP_FILE`" `${SERVER_USER}@${SERVER_HOST}:/tmp/`"

Write-Host "  执行: $scpCmd" -ForegroundColor Gray

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
    Write-Host "   - $ZIP_FILE" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. 上传到: /tmp/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "3. 在服务器上执行:" -ForegroundColor White
    Write-Host "   mkdir -p $DEPLOY_PATH" -ForegroundColor Cyan
    Write-Host "   unzip -o /tmp/clawbot-channel-deploy.zip -d $DEPLOY_PATH" -ForegroundColor Cyan
    Write-Host "   cd $DEPLOY_PATH" -ForegroundColor Cyan
    Write-Host "   npm install" -ForegroundColor Cyan
    Write-Host "   cp .env.example .env" -ForegroundColor Cyan
    Write-Host "   nano .env  # 修改配置" -ForegroundColor Cyan
    Write-Host "   pm2 start ecosystem.config.js" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "推荐工具:" -ForegroundColor Yellow
    Write-Host "  - WinSCP: https://winscp.net/" -ForegroundColor White
    Write-Host "  - FileZilla: https://filezilla-project.org/" -ForegroundColor White
    Write-Host "  - MobaXterm: https://mobaxterm.mobatek.net/" -ForegroundColor White
    Write-Host ""

    $continue = Read-Host "文件上传完成后是否继续配置服务器环境变量? (y/n)"
    if ($continue -ne "y") {
        exit 0
    }

    # 继续执行服务器端配置
    Write-Host ""
    Write-Host "[4/7] 配置服务器环境..." -ForegroundColor Yellow

    $sshCommands = @"
cd $DEPLOY_PATH
echo "✓ 目录: $(pwd)"
echo ""
echo "==================================="
echo "安装依赖..."
echo "==================================="
npm install
echo ""
echo "==================================="
echo "配置环境变量..."
echo "==================================="
cp .env.example .env
echo "⚠️  请手动编辑 .env 文件修改配置"
echo "   nano .env"
echo ""
"@

    ssh "${SERVER_USER}@${SERVER_HOST}" $sshCommands
    exit 0
} else {
    # 使用 scp 上传
    scp -P $SERVER_PORT $ZIP_FILE "${SERVER_USER}@${SERVER_HOST}:/tmp/"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ 上传失败" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ 上传完成" -ForegroundColor Green
    Write-Host ""
}

# 步骤 4: 服务器端部署
Write-Host "[4/7] 服务器端部署..." -ForegroundColor Yellow

$sshCommands = @"
# 停止旧服务器
echo "==================================="
echo "停止旧服务器..."
echo "==================================="
pkill -f cloud_server_advanced.py 2>/dev/null || true
lsof -ti:8765 | xargs kill -9 2>/dev/null || true
echo "✓ 旧服务器已停止"

# 创建目录
echo ""
echo "==================================="
echo "创建目录..."
echo "==================================="
mkdir -p $DEPLOY_PATH
echo "✓ 目录已创建: $DEPLOY_PATH"

# 解压文件
echo ""
echo "==================================="
echo "解压文件..."
echo "==================================="
unzip -o /tmp/clawbot-channel-deploy.zip -d $DEPLOY_PATH
rm /tmp/clawbot-channel-deploy.zip
echo "✓ 文件已解压"

# 安装依赖
echo ""
echo "==================================="
echo "安装 Node.js 依赖..."
echo "==================================="
cd $DEPLOY_PATH
npm install
echo ""
echo "✓ 依赖安装完成"
"@

ssh "${SERVER_USER}@${SERVER_HOST}" $sshCommands
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ 服务器部署失败" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 步骤 5: 配置环境变量
Write-Host "[5/7] 配置环境变量..." -ForegroundColor Yellow
Write-Host ""
Write-Host "请在服务器上创建 .env 文件:" -ForegroundColor White
Write-Host "  cd $DEPLOY_PATH" -ForegroundColor Cyan
Write-Host "  cp .env.example .env" -ForegroundColor Cyan
Write-Host "  nano .env" -ForegroundColor Cyan
Write-Host ""
Write-Host "需要修改的关键配置:" -ForegroundColor Yellow
Write-Host "  - CLAWBOT_WEBHOOK_SECRET (设置一个强密码)" -ForegroundColor White
Write-Host "  - OSS_* (如果需要文件上传功能)" -ForegroundColor White
Write-Host ""

$configDone = Read-Host "环境变量配置完成? (y/n)"
if ($configDone -ne "y") {
    Write-Host "✗ 环境变量未配置，部署暂停" -ForegroundColor Red
    Write-Host ""
    Write-Host "配置完成后，手动执行以下命令启动服务器:" -ForegroundColor Yellow
    Write-Host "  ssh ${SERVER_USER}@${SERVER_HOST}" -ForegroundColor Cyan
    Write-Host "  cd $DEPLOY_PATH" -ForegroundColor Cyan
    Write-Host "  pm2 start ecosystem.config.js" -ForegroundColor Cyan
    exit 0
}

# 步骤 6: 启动服务器
Write-Host "[6/7] 启动服务器..." -ForegroundColor Yellow

$sshCommands = @"
cd $DEPLOY_PATH
pm2 start ecosystem.config.js
pm2 save
echo ""
echo "✓ 服务器已启动"
pm2 status
"@

ssh "${SERVER_USER}@${SERVER_HOST}" $sshCommands
Write-Host ""

# 步骤 7: 验证部署
Write-Host "[7/7] 验证部署..." -ForegroundColor Yellow

$sshCommands = @"
cd $DEPLOY_PATH
echo ""
echo "==================================="
echo "检查服务状态..."
echo "==================================="
pm2 status
echo ""
echo "==================================="
echo "检查端口监听..."
echo "==================================="
lsof -i :8765
echo ""
echo "==================================="
echo "测试 HTTP API..."
echo "==================================="
curl -s http://localhost:8765/health | python3 -m json.tool
"@

ssh "${SERVER_USER}@${SERVER_HOST}" $sshCommands
Write-Host ""

# 清理临时文件
Write-Host "[清理] 删除本地临时文件..." -ForegroundColor Yellow
Remove-Item $ZIP_FILE -Force -ErrorAction SilentlyContinue
Write-Host "✓ 清理完成" -ForegroundColor Green
Write-Host ""

Write-Host "============================================" -ForegroundColor Green
Write-Host "  部署脚本执行完成！" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "查看日志:" -ForegroundColor Yellow
Write-Host "  ssh ${SERVER_USER}@${SERVER_HOST} \"pm2 logs clawbot-channel\"" -ForegroundColor Cyan
Write-Host ""
Write-Host "访问地址: http://${SERVER_HOST}" -ForegroundColor Cyan
Write-Host "WebSocket: ws://${SERVER_HOST}:8765" -ForegroundColor Cyan
Write-Host ""
