# 完整的网络诊断脚本
# 用于诊断为什么从 192.168.101.4 无法连接到 192.168.101.4:18789

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  完整网络诊断 - Windows Hairpin NAT 问题" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

$localIP = "192.168.101.4"
$gatewayPort = 18789

# 测试 1: 基本网络信息
Write-Host "[1/8] 网络接口信息" -ForegroundColor Yellow
Write-Host ""

$adapters = Get-NetAdapter | Where-Object { $_.Status -eq "Up" }
foreach ($adapter in $adapters) {
    $ip = Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue
    if ($ip) {
        Write-Host "  网卡: $($adapter.Name)" -ForegroundColor White
        Write-Host "  IP: $($ip.IPAddress)" -ForegroundColor Gray
        Write-Host "  掩码: $($ip.PrefixLength)" -ForegroundColor Gray
        Write-Host ""
    }
}

# 测试 2: 路由表
Write-Host "[2/8] 检查路由表" -ForegroundColor Yellow
Write-Host ""

$route = Get-NetRoute -DestinationPrefix "$localIP/32" -ErrorAction SilentlyContinue
if ($route) {
    Write-Host "  ✅ 找到到 $localIP 的路由" -ForegroundColor Green
    Write-Host "  下一跳: $($route.NextHop)" -ForegroundColor Gray
} else {
    Write-Host "  ⚠️ 没有到 $localIP 的直接路由" -ForegroundColor Yellow
    Write-Host "  这可能导致 hairpin NAT 问题" -ForegroundColor Yellow
}

# 测试 3: TCP 连接测试
Write-Host ""
Write-Host "[3/8] TCP 连接测试" -ForegroundColor Yellow
Write-Host ""

# 测试 localhost
$testLocalhostTCP = Test-NetConnection -ComputerName "localhost" -Port $gatewayPort -WarningAction SilentlyContinue
Write-Host "  localhost:$gatewayPort - $(if ($testLocalhostTCP.TcpTestSucceeded) { '✅ 成功' } else { '❌ 失败' })" -ForegroundColor $(if ($testLocalhostTCP.TcpTestSucceeded) { 'Green' } else { 'Red' })

# 测试 127.0.0.1
$test127TCP = Test-NetConnection -ComputerName "127.0.0.1" -Port $gatewayPort -WarningAction SilentlyContinue
Write-Host "  127.0.0.1:$gatewayPort - $(if ($test127TCP.TcpTestSucceeded) { '✅ 成功' } else { '❌ 失败' })" -ForegroundColor $(if ($test127TCP.TcpTestSucceeded) { 'Green' } else { 'Red' })

# 测试局域网 IP
$testIPTCP = Test-NetConnection -ComputerName $localIP -Port $gatewayPort -WarningAction SilentlyContinue
Write-Host "  $localIP`:$gatewayPort - $(if ($testIPTCP.TcpTestSucceeded) { '✅ 成功' } else { '❌ 失败' })" -ForegroundColor $(if ($testIPTCP.TcpTestSucceeded) { 'Green' } else { 'Red' })

# 测试 4: 监听状态
Write-Host ""
Write-Host "[4/8] Gateway 监听状态" -ForegroundColor Yellow
Write-Host ""

$listening = netstat -ano | Select-String "18789" | Select-String "LISTENING"
if ($listening) {
    Write-Host "  ✅ Gateway 正在监听端口 18789" -ForegroundColor Green
    $listening | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
} else {
    Write-Host "  ❌ Gateway 未在监听!" -ForegroundColor Red
}

# 测试 5: WebSocket 连接测试
Write-Host ""
Write-Host "[5/8] WebSocket 连接测试" -ForegroundColor Yellow
Write-Host ""

# 测试 localhost
try {
    $ws1 = New-Object System.Net.WebSockets.ClientWebSocket
    $uri1 = [System.Uri]::new('ws://localhost:18789')
    $task1 = $ws1.ConnectAsync($uri1, [System.Threading.CancellationToken]::None)
    $task1.Wait(3000) | Out-Null
    if ($ws1.State -eq 'Open') {
        Write-Host "  ws://localhost:18789 - ✅ 成功" -ForegroundColor Green
        $ws1.Dispose()
    } else {
        Write-Host "  ws://localhost:18789 - ❌ 失败 (状态: $($ws1.State))" -ForegroundColor Red
    }
} catch {
    Write-Host "  ws://localhost:18789 - ❌ 异常: $_" -ForegroundColor Red
}

# 测试局域网 IP
try {
    $ws2 = New-Object System.Net.WebSockets.ClientWebSocket
    $uri2 = [System.Uri]::new("ws://$localIP`:$gatewayPort")
    $task2 = $ws2.ConnectAsync($uri2, [System.Threading.CancellationToken]::None)
    $task2.Wait(3000) | Out-Null
    if ($ws2.State -eq 'Open') {
        Write-Host "  ws://$localIP`:$gatewayPort - ✅ 成功" -ForegroundColor Green
        $ws2.Dispose()
    } else {
        Write-Host "  ws://$localIP`:$gatewayPort - ❌ 失败 (状态: $($ws2.State))" -ForegroundColor Red
    }
} catch {
    Write-Host "  ws://$localIP`:$gatewayPort - ❌ 异常: $_" -ForegroundColor Red
}

# 测试 6: 防火墙规则
Write-Host ""
Write-Host "[6/8] 防火墙规则检查" -ForegroundColor Yellow
Write-Host ""

$rules = Get-NetFirewallRule | Where-Object { 
    $_.DisplayName -like "*18789*" -or 
    $_.DisplayName -like "*Gateway*" -or 
    $_.DisplayName -like "*Clawbot*" 
}

if ($rules) {
    Write-Host "  找到相关防火墙规则:" -ForegroundColor Green
    foreach ($rule in $rules) {
        Write-Host "  - $($rule.DisplayName): $(if ($rule.Enabled) { '启用' } else { '禁用' })" -ForegroundColor Gray
    }
} else {
    Write-Host "  ⚠️ 没有找到相关防火墙规则" -ForegroundColor Yellow
}

# 测试 7: Hairpin NAT 检测
Write-Host ""
Write-Host "[7/8] Hairpin NAT 检测" -ForegroundColor Yellow
Write-Host ""

$weakHostSend = Get-NetIPInterface | Where-Object { 
    $_.AddressFamily -eq "IPv4" -and $_.ConnectionState -eq "Connected" 
} | Select-Object InterfaceAlias, WeakHostSend, WeakHostReceive

Write-Host "  弱主机模型状态:" -ForegroundColor Gray
$weakHostSend | Format-Table -AutoSize | Out-String | ForEach-Object { Write-Host $_ -ForegroundColor DarkGray }

$allDisabled = ($weakHostSend | Where-Object { $_.WeakHostSend -eq $true }).Count -eq 0
if ($allDisabled) {
    Write-Host "  ⚠️ 所有接口的 WeakHostSend 都是 Disabled" -ForegroundColor Yellow
    Write-Host "  这可能导致 hairpin NAT 问题!" -ForegroundColor Yellow
}

# 测试 8: NAT 回环测试
Write-Host ""
Write-Host "[8/8] NAT 回环测试" -ForegroundColor Yellow
Write-Host ""

Write-Host "  尝试从本地 IP 连接到本地 IP..." -ForegroundColor Gray

try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.Connect($localIP, $gatewayPort)
    if ($tcpClient.Connected) {
        Write-Host "  ✅ 成功!" -ForegroundColor Green
        Write-Host "  本地 IP 可以连接到自己" -ForegroundColor Green
        $tcpClient.Close()
    }
} catch {
    Write-Host "  ❌ 失败: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "  这是典型的 Hairpin NAT 问题!" -ForegroundColor Red
    Write-Host "  原因: Windows 网络栈阻止了从局域网 IP 到同一局域网 IP 的连接" -ForegroundColor Red
}

# 总结和建议
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  诊断总结" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

if (!$testIPTCP.TcpTestSucceeded) {
    Write-Host "🔴 问题确认: Hairpin NAT / 环回限制" -ForegroundColor Red
    Write-Host ""
    Write-Host "现象:" -ForegroundColor Yellow
    Write-Host "  - localhost 可以连接 ✅" -ForegroundColor Gray
    Write-Host "  - 局域网 IP 无法连接自己 ❌" -ForegroundColor Gray
    Write-Host "  - 外部设备可以连接(理论上) ✅" -ForegroundColor Gray
    Write-Host ""
    Write-Host "💡 解决方案:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "方案 1: 使用不同的域名 (推荐)" -ForegroundColor White
    Write-Host "  - 修改 hosts 文件" -ForegroundColor Gray
    Write-Host "  - 电脑访问: http://trix.local:5173" -ForegroundColor Gray
    Write-Host "  - 手机访问: http://$localIP`:5173" -ForegroundColor Gray
    Write-Host "  - 执行: .\setup-hosts.ps1" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "方案 2: 启用弱主机模型 (高级)" -ForegroundColor White
    Write-Host "  - 可能有安全风险" -ForegroundColor Gray
    Write-Host "  - 需要管理员权限" -ForegroundColor Gray
    Write-Host "  - 执行: Set-NetIPInterface -InterfaceAlias '以太网' -WeakHostSend Enabled" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "方案 3: 使用反向代理 (复杂)" -ForegroundColor White
    Write-Host "  - 使用 nginx 或其他代理服务器" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "✅ 网络连接正常!" -ForegroundColor Green
    Write-Host "问题可能在应用层,请检查:" -ForegroundColor Yellow
    Write-Host "  - Gateway 配置" -ForegroundColor Gray
    Write-Host "  - WebSocket 协议版本" -ForegroundColor Gray
    Write-Host "  - Origin 检查" -ForegroundColor Gray
}

Write-Host ""
Read-Host "按 Enter 退出"
