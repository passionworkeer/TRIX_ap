# 一键启动脚本 - 完整版
# 检查并启动所有必需的服务

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  TRIX Companion 一键启动" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" 
} | Select-Object -First 1).IPAddress

Write-Host "📍 本机局域网 IP: $localIP" -ForegroundColor Cyan
Write-Host ""

# 步骤 1: 检查 Gateway
Write-Host "[1/4] 检查 Gateway..." -ForegroundColor Yellow
$gatewayRunning = (Get-NetTCPConnection -LocalPort 18789 -ErrorAction SilentlyContinue) -ne $null

if ($gatewayRunning) {
    Write-Host "   ✅ Gateway 已在运行" -ForegroundColor Green
} else {
    Write-Host "   ⚠️ Gateway 未运行" -ForegroundColor Yellow
    Write-Host "   请手动启动: openclaw-cn gateway" -ForegroundColor Gray
    Write-Host ""
    $response = Read-Host "   是否现在启动? (y/n)"
    if ($response -eq 'y') {
        Write-Host "   启动中..." -ForegroundColor Gray
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "openclaw-cn gateway"
        Start-Sleep -Seconds 3
    }
}

# 步骤 2: 检查 Vite
Write-Host ""
Write-Host "[2/4] 检查 Vite..." -ForegroundColor Yellow
$viteRunning = (Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue) -ne $null

if ($viteRunning) {
    Write-Host "   ✅ Vite 已在运行" -ForegroundColor Green
} else {
    Write-Host "   ⚠️ Vite 未运行" -ForegroundColor Yellow
    Write-Host "   启动中..." -ForegroundColor Gray
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd E:\desktop\trix-3d-companion; npm run dev"
    Start-Sleep -Seconds 5
}

# 步骤 3: 检查防火墙
Write-Host ""
Write-Host "[3/4] 检查防火墙..." -ForegroundColor Yellow
$firewallRule = Get-NetFirewallRule -DisplayName "*Clawbot*" -ErrorAction SilentlyContinue

if ($firewallRule) {
    Write-Host "   ✅ 防火墙规则已配置" -ForegroundColor Green
} else {
    Write-Host "   ⚠️ 未找到防火墙规则" -ForegroundColor Yellow
    Write-Host "   建议运行: .\fix-firewall.ps1" -ForegroundColor Gray
}

# 步骤 4: 网络测试
Write-Host ""
Write-Host "[4/4] 网络连接测试..." -ForegroundColor Yellow

$testLocalhost = Test-NetConnection -ComputerName "localhost" -Port 18789 -WarningAction SilentlyContinue -InformationLevel Quiet
$testIP = Test-NetConnection -ComputerName $localIP -Port 18789 -WarningAction SilentlyContinue -InformationLevel Quiet

Write-Host "   localhost:18789 - $(if ($testLocalhost) { '✅' } else { '❌' })" -ForegroundColor $(if ($testLocalhost) { 'Green' } else { 'Red' })
Write-Host "   $localIP`:18789 - $(if ($testIP) { '✅' } else { '❌' })" -ForegroundColor $(if ($testIP) { 'Green' } else { 'Red' })

# 总结
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  启动完成" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

if (!$testIP -and $testLocalhost) {
    Write-Host "⚠️ 检测到 Hairpin NAT 问题!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "解决方案:" -ForegroundColor Yellow
    Write-Host "  1. 以管理员身份运行 PowerShell" -ForegroundColor White
    Write-Host "  2. 执行: .\setup-hosts.ps1" -ForegroundColor Cyan
    Write-Host "  3. 电脑访问: http://trix.local:5173" -ForegroundColor Cyan
    Write-Host "  4. 手机访问: http://$localIP`:5173" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "✅ 一切正常!" -ForegroundColor Green
    Write-Host ""
    Write-Host "访问地址:" -ForegroundColor Yellow
    Write-Host "  电脑: http://localhost:5173" -ForegroundColor Cyan
    Write-Host "  手机: http://$localIP`:5173" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "💡 提示:" -ForegroundColor Yellow
Write-Host "  - 查看完整诊断: .\full-network-diagnosis.ps1" -ForegroundColor Gray
Write-Host "  - 修复防火墙: .\fix-firewall.ps1" -ForegroundColor Gray
Write-Host "  - 配置 hosts: .\setup-hosts.ps1 (需要管理员)" -ForegroundColor Gray
Write-Host ""

Read-Host "按 Enter 退出"
