# TRIX 测试启动脚本
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  启动 TRIX 测试环境" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查依赖
Write-Host "检查依赖..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "安装 npm 依赖..." -ForegroundColor Yellow
    npm install
}

# 启动真实的 Clawdbot Gateway
Write-Host ""
Write-Host "启动 Clawdbot Gateway (端口 18789)..." -ForegroundColor Green
Write-Host "请确保已在另一个窗口运行: openclaw-cn gateway" -ForegroundColor Yellow
Write-Host "按任意键继续..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')

# 启动 Vite
Write-Host "启动 Vite 前端 (端口 3000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev"

# 等待 Vite 启动
Start-Sleep -Seconds 3

# 打开浏览器
Write-Host "打开浏览器..." -ForegroundColor Green
Start-Process "http://localhost:3000/"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TRIX 已启动!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "访问地址:" -ForegroundColor Cyan
Write-Host "  电脑: http://localhost:3000/" -ForegroundColor White
Write-Host "  手机: http://192.168.101.4:3000/" -ForegroundColor White
Write-Host ""
Write-Host "WebSocket:" -ForegroundColor Cyan
Write-Host "  Mock Gateway: ws://192.168.101.4:18789" -ForegroundColor White
Write-Host ""
Write-Host "提示:" -ForegroundColor Yellow
Write-Host "  - 这是测试环境,使用 Mock Gateway" -ForegroundColor Gray
Write-Host "  - 若要使用真实 AI,需要启动 Clawdbot Gateway" -ForegroundColor Gray
Write-Host ""
Write-Host "按任意键关闭此窗口..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
