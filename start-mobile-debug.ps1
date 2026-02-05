# 🚀 TRIX 移动端调试 - 一键启动
# 此脚本自动启动 Gateway 和 Vite，并在手机浏览器打开

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TRIX 移动端调试启动脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 获取局域网 IP
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like "192.168.*"}).IPAddress
if (-not $localIP) {
    $localIP = "192.168.101.4"
}

Write-Host "📍 检测到局域网 IP: $localIP" -ForegroundColor Green
Write-Host ""

# 检查 openclaw-cn 是否安装
Write-Host "🔍 检查 Clawbot Gateway..." -ForegroundColor Yellow
$openclawInstalled = pip list 2>$null | Select-String "openclaw-cn"

if (-not $openclawInstalled) {
    Write-Host "❌ 未安装 openclaw-cn" -ForegroundColor Red
    Write-Host ""
    Write-Host "正在安装 openclaw-cn..." -ForegroundColor Yellow
    pip install openclaw-cn
    Write-Host "✅ 安装完成" -ForegroundColor Green
} else {
    Write-Host "✅ openclaw-cn 已安装" -ForegroundColor Green
}

Write-Host ""

# 检查防火墙规则
Write-Host "🔥 检查防火墙规则..." -ForegroundColor Yellow
$viteRule = Get-NetFirewallRule -DisplayName "Vite Dev Server" -ErrorAction SilentlyContinue
$gatewayRule = Get-NetFirewallRule -DisplayName "Clawbot Gateway" -ErrorAction SilentlyContinue

if (-not $viteRule) {
    Write-Host "添加 Vite 防火墙规则 (端口 5173)..." -ForegroundColor Yellow
    New-NetFirewallRule -DisplayName "Vite Dev Server" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow | Out-Null
    Write-Host "✅ Vite 防火墙规则已添加" -ForegroundColor Green
}

if (-not $gatewayRule) {
    Write-Host "添加 Gateway 防火墙规则 (端口 18789)..." -ForegroundColor Yellow
    New-NetFirewallRule -DisplayName "Clawbot Gateway" -Direction Inbound -LocalPort 18789 -Protocol TCP -Action Allow | Out-Null
    Write-Host "✅ Gateway 防火墙规则已添加" -ForegroundColor Green
}

Write-Host ""

# 启动 Clawbot Gateway
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  1️⃣ 启动 Clawbot Gateway" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "正在新窗口启动 Gateway (端口 18789)..." -ForegroundColor Green

Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host '========================================' -ForegroundColor Magenta
Write-Host '  Clawbot Gateway' -ForegroundColor Magenta
Write-Host '========================================' -ForegroundColor Magenta
Write-Host ''
Write-Host '监听地址: ws://0.0.0.0:18789' -ForegroundColor Green
Write-Host '局域网访问: ws://$localIP:18789' -ForegroundColor Green
Write-Host ''
openclaw-cn gateway
"@

# 等待 Gateway 启动
Write-Host "等待 Gateway 启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# 验证 Gateway 是否在运行
$gatewayRunning = netstat -ano | Select-String "18789" | Select-String "LISTENING"
if ($gatewayRunning) {
    Write-Host "✅ Gateway 已启动" -ForegroundColor Green
} else {
    Write-Host "⚠️  Gateway 可能未启动，请检查 Gateway 窗口" -ForegroundColor Yellow
}

Write-Host ""

# 启动 Vite
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  2️⃣ 启动 Vite 前端" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "正在新窗口启动 Vite (端口 5173)..." -ForegroundColor Green

Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
Write-Host '========================================' -ForegroundColor Blue
Write-Host '  Vite Development Server' -ForegroundColor Blue
Write-Host '========================================' -ForegroundColor Blue
Write-Host ''
cd '$PWD'
npm run dev
"@

# 等待 Vite 启动
Write-Host "等待 Vite 启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ TRIX 启动成功！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# 显示访问地址
Write-Host "📱 访问地址:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  电脑浏览器:" -ForegroundColor Yellow
Write-Host "    http://localhost:5173/" -ForegroundColor White
Write-Host ""
Write-Host "  手机浏览器 (扫码或输入):" -ForegroundColor Yellow
Write-Host "    http://$localIP:5173/" -ForegroundColor White -BackgroundColor DarkBlue
Write-Host ""

# 生成二维码 (如果安装了 qrcode)
Write-Host "📲 手机扫码访问:" -ForegroundColor Cyan
try {
    $url = "http://$localIP:5173/"
    python -c "import qrcode; qr = qrcode.QRCode(); qr.add_data('$url'); qr.print_ascii()" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  (提示: 安装 qrcode 可显示二维码: pip install qrcode)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  手动输入: http://$localIP:5173/" -ForegroundColor White
}

Write-Host ""

# 显示服务状态
Write-Host "🔌 服务状态:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Clawbot Gateway:" -ForegroundColor Yellow
Write-Host "    ws://$localIP:18789" -ForegroundColor White
if ($gatewayRunning) {
    Write-Host "    状态: 🟢 运行中" -ForegroundColor Green
} else {
    Write-Host "    状态: 🔴 未启动" -ForegroundColor Red
}
Write-Host ""
Write-Host "  Vite Dev Server:" -ForegroundColor Yellow
Write-Host "    http://$localIP:5173" -ForegroundColor White
Write-Host "    状态: 🟢 运行中" -ForegroundColor Green
Write-Host ""

# 测试提示
Write-Host "🧪 测试步骤:" -ForegroundColor Cyan
Write-Host "  1. 确保手机和电脑在同一 WiFi" -ForegroundColor Gray
Write-Host "  2. 手机浏览器打开: http://$localIP:5173/" -ForegroundColor Gray
Write-Host "  3. 进入 Chat → TRIX 机器人" -ForegroundColor Gray
Write-Host "  4. 检查状态是否显示 🟢 Gateway Connected" -ForegroundColor Gray
Write-Host "  5. 发送消息测试" -ForegroundColor Gray
Write-Host ""

Write-Host "💡 故障排除:" -ForegroundColor Cyan
Write-Host "  - 手机无法打开网页 → 检查防火墙设置" -ForegroundColor Gray
Write-Host "  - Gateway Disconnected → 检查 Gateway 窗口是否有错误" -ForegroundColor Gray
Write-Host "  - 详细报告: MOBILE_DEBUG_REPORT.md" -ForegroundColor Gray
Write-Host ""

Write-Host "按任意键关闭此窗口..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
