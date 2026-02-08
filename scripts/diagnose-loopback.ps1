# 检查和修复 Windows Loopback 访问问题

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Windows Loopback 诊断和修复" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$localIP = "192.168.101.4"
$port = 18789

Write-Host "[1/5] 检查网络接口配置..." -ForegroundColor Yellow
$adapters = Get-NetAdapter | Where-Object { $_.Status -eq "Up" }
foreach ($adapter in $adapters) {
    $ip = Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue
    if ($ip) {
        Write-Host "   网卡: $($adapter.Name)" -ForegroundColor Gray
        Write-Host "   IP: $($ip.IPAddress)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "[2/5] 检查路由表..." -ForegroundColor Yellow
$route = Get-NetRoute -DestinationPrefix "$localIP/32" -ErrorAction SilentlyContinue
if ($route) {
    Write-Host "   ✅ 找到到 $localIP 的路由" -ForegroundColor Green
    Write-Host "   接口: $($route.InterfaceAlias)" -ForegroundColor Gray
} else {
    Write-Host "   ⚠️ 没有找到到 $localIP 的直接路由" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[3/5] 测试 TCP 连接..." -ForegroundColor Yellow

# 测试 localhost
Write-Host "   测试 localhost:$port..." -ForegroundColor Gray
$localhostTest = Test-NetConnection -ComputerName "localhost" -Port $port -WarningAction SilentlyContinue
if ($localhostTest.TcpTestSucceeded) {
    Write-Host "   ✅ localhost:$port 可达" -ForegroundColor Green
} else {
    Write-Host "   ❌ localhost:$port 不可达" -ForegroundColor Red
}

# 测试 127.0.0.1
Write-Host "   测试 127.0.0.1:$port..." -ForegroundColor Gray
$loopbackTest = Test-NetConnection -ComputerName "127.0.0.1" -Port $port -WarningAction SilentlyContinue
if ($loopbackTest.TcpTestSucceeded) {
    Write-Host "   ✅ 127.0.0.1:$port 可达" -ForegroundColor Green
} else {
    Write-Host "   ❌ 127.0.0.1:$port 不可达" -ForegroundColor Red
}

# 测试局域网 IP
Write-Host "   测试 $localIP`:$port..." -ForegroundColor Gray
$ipTest = Test-NetConnection -ComputerName $localIP -Port $port -WarningAction SilentlyContinue
if ($ipTest.TcpTestSucceeded) {
    Write-Host "   ✅ $localIP`:$port 可达" -ForegroundColor Green
} else {
    Write-Host "   ❌ $localIP`:$port 不可达" -ForegroundColor Red
}

Write-Host ""
Write-Host "[4/5] 检查 Windows Defender 防火墙..." -ForegroundColor Yellow
$rule = Get-NetFirewallRule -DisplayName "*Clawbot*" -ErrorAction SilentlyContinue
if ($rule) {
    Write-Host "   ✅ 找到 Clawbot 防火墙规则" -ForegroundColor Green
    foreach ($r in $rule) {
        Write-Host "   - $($r.DisplayName): $($r.Enabled)" -ForegroundColor Gray
    }
} else {
    Write-Host "   ⚠️ 没有找到 Clawbot 防火墙规则" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[5/5] 检查弱主机模型 (Weak Host Model)..." -ForegroundColor Yellow
Write-Host "   这可能影响局域网 IP 的环回访问" -ForegroundColor Gray

$weakHostSend = Get-NetIPInterface | Where-Object { $_.AddressFamily -eq "IPv4" } | Select-Object InterfaceAlias, WeakHostSend
$weakHostReceive = Get-NetIPInterface | Where-Object { $_.AddressFamily -eq "IPv4" } | Select-Object InterfaceAlias, WeakHostReceive

Write-Host "   WeakHostSend 状态:" -ForegroundColor Gray
$weakHostSend | Format-Table -AutoSize | Out-String | Write-Host

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  诊断完成" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

if (!$ipTest.TcpTestSucceeded) {
    Write-Host "💡 建议的修复方案:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "方案 1: 使用 localhost 而不是局域网 IP" -ForegroundColor White
    Write-Host "   - 在电脑上访问: http://localhost:5173" -ForegroundColor Gray
    Write-Host "   - 在手机上访问: http://$localIP`:5173" -ForegroundColor Gray
    Write-Host "   - Gateway URL 保持 ws://localhost:18789" -ForegroundColor Gray
    Write-Host ""
    Write-Host "方案 2: 配置 Vite 代理 WebSocket" -ForegroundColor White
    Write-Host "   - 让 Vite 反向代理 Gateway" -ForegroundColor Gray
    Write-Host "   - 这样手机也能通过 Vite 访问 Gateway" -ForegroundColor Gray
    Write-Host ""
    Write-Host "方案 3: 启用弱主机模型 (不推荐)" -ForegroundColor White
    Write-Host "   - 可能有安全风险" -ForegroundColor Gray
}

Write-Host "按 Enter 退出..." -ForegroundColor Gray
Read-Host
