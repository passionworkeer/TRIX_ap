# ============================================
# 🔍 WebSocket 连接诊断脚本
# ============================================

param(
    [string]$TestType = "both" # localhost, network, both
)

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  WebSocket 连接诊断工具" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 配置
$LocalhostUrl = "ws://localhost:18789"
$NetworkUrl = "ws://192.168.101.4:18789"
$AuthToken = "8743d26357758f202c9bb5a21db706185d66f9c98f9c3ff1"

# ============================================
# 1. 端口监听检查
# ============================================
Write-Host "[1] 检查端口监听状态..." -ForegroundColor Yellow
Write-Host ""

$listening = netstat -an | Select-String "18789" | Select-String "LISTENING"
if ($listening) {
    Write-Host "✅ 端口 18789 正在监听" -ForegroundColor Green
    Write-Host "   $listening" -ForegroundColor Gray
} else {
    Write-Host "❌ 端口 18789 未监听" -ForegroundColor Red
    Write-Host "   请先启动 Gateway: openclaw-cn gateway" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# ============================================
# 2. 网络连通性测试
# ============================================
Write-Host "[2] 网络连通性测试..." -ForegroundColor Yellow
Write-Host ""

# 测试 localhost
Write-Host "   测试 localhost:18789..." -NoNewline
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.Connect("localhost", 18789)
    $tcpClient.Close()
    Write-Host " ✅" -ForegroundColor Green
} catch {
    Write-Host " ❌" -ForegroundColor Red
    Write-Host "   错误: $_" -ForegroundColor Red
}

# 测试局域网 IP
Write-Host "   测试 192.168.101.4:18789..." -NoNewline
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.Connect("192.168.101.4", 18789)
    $tcpClient.Close()
    Write-Host " ✅" -ForegroundColor Green
} catch {
    Write-Host " ❌" -ForegroundColor Red
    Write-Host "   错误: $_" -ForegroundColor Red
}

Write-Host ""

# ============================================
# 3. HTTP 测试
# ============================================
Write-Host "[3] HTTP 连接测试..." -ForegroundColor Yellow
Write-Host ""

# 测试 localhost HTTP
Write-Host "   测试 http://localhost:18789..." -NoNewline
try {
    $response = Invoke-WebRequest -Uri "http://localhost:18789" -TimeoutSec 5 -UseBasicParsing
    Write-Host " ✅ 状态码: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host " ❌" -ForegroundColor Red
    Write-Host "   错误: $($_.Exception.Message)" -ForegroundColor Red
}

# 测试局域网 IP HTTP
Write-Host "   测试 http://192.168.101.4:18789..." -NoNewline
try {
    $response = Invoke-WebRequest -Uri "http://192.168.101.4:18789" -TimeoutSec 5 -UseBasicParsing
    Write-Host " ✅ 状态码: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host " ❌" -ForegroundColor Red
    Write-Host "   错误: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# ============================================
# 4. 防火墙检查
# ============================================
Write-Host "[4] 防火墙规则检查..." -ForegroundColor Yellow
Write-Host ""

$firewallRules = Get-NetFirewallRule | Where-Object { $_.DisplayName -like "*18789*" -or $_.DisplayName -like "*Clawbot*" -or $_.DisplayName -like "*Gateway*" }
if ($firewallRules) {
    Write-Host "✅ 找到相关防火墙规则:" -ForegroundColor Green
    $firewallRules | ForEach-Object {
        Write-Host "   - $($_.DisplayName) [$($_.Enabled)]" -ForegroundColor Gray
    }
} else {
    Write-Host "⚠️  未找到相关防火墙规则" -ForegroundColor Yellow
    Write-Host "   建议添加规则:" -ForegroundColor Yellow
    Write-Host '   netsh advfirewall firewall add rule name="Clawbot Gateway" dir=in action=allow protocol=TCP localport=18789' -ForegroundColor Gray
}

Write-Host ""

# ============================================
# 5. 网络接口信息
# ============================================
Write-Host "[5] 网络接口信息..." -ForegroundColor Yellow
Write-Host ""

$networkInterfaces = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" }
Write-Host "   可用 IP 地址:" -ForegroundColor Cyan
$networkInterfaces | ForEach-Object {
    Write-Host "   - $($_.IPAddress) [$($_.InterfaceAlias)]" -ForegroundColor Gray
}

Write-Host ""

# ============================================
# 6. WebSocket 连接测试（需要浏览器）
# ============================================
Write-Host "[6] WebSocket 连接测试..." -ForegroundColor Yellow
Write-Host ""
Write-Host "   📋 使用浏览器测试工具进行 WebSocket 连接测试" -ForegroundColor Cyan
Write-Host ""
Write-Host "   测试文件: websocket-test.html" -ForegroundColor Green
Write-Host ""

$openBrowser = Read-Host "是否在浏览器中打开测试工具? (y/n)"
if ($openBrowser -eq "y") {
    $testFile = Join-Path $PSScriptRoot "websocket-test.html"
    if (Test-Path $testFile) {
        Start-Process $testFile
        Write-Host ""
        Write-Host "✅ 已在浏览器中打开测试工具" -ForegroundColor Green
        Write-Host ""
        Write-Host "   请按照以下步骤测试:" -ForegroundColor Yellow
        Write-Host "   1. 点击 'localhost 连接' 按钮" -ForegroundColor Gray
        Write-Host "   2. 检查连接状态和日志" -ForegroundColor Gray
        Write-Host "   3. 点击 '局域网 IP 连接' 按钮" -ForegroundColor Gray
        Write-Host "   4. 对比两者的连接时间和日志" -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-Host "❌ 未找到测试文件: websocket-test.html" -ForegroundColor Red
    }
}

# ============================================
# 7. 诊断总结
# ============================================
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  诊断总结" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "🔍 可能的问题原因:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. DNS 解析问题" -ForegroundColor White
Write-Host "   - localhost 直接解析为 127.0.0.1" -ForegroundColor Gray
Write-Host "   - 局域网 IP 需要路由转发" -ForegroundColor Gray
Write-Host ""
Write-Host "2. 防火墙策略" -ForegroundColor White
Write-Host "   - localhost 通常绕过防火墙" -ForegroundColor Gray
Write-Host "   - 局域网连接需要防火墙规则" -ForegroundColor Gray
Write-Host ""
Write-Host "3. 网络路由" -ForegroundColor White
Write-Host "   - 同一 IP 不同端口可能有路由策略" -ForegroundColor Gray
Write-Host "   - 检查路由表和网关配置" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Gateway 绑定地址" -ForegroundColor White
Write-Host "   - 确认 Gateway 监听 0.0.0.0 而非 127.0.0.1" -ForegroundColor Gray
Write-Host "   - 查看 Gateway 启动日志" -ForegroundColor Gray
Write-Host ""

Write-Host "💡 建议操作:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. 查看 Gateway 启动日志，确认监听地址" -ForegroundColor Gray
Write-Host "2. 添加防火墙规则（如果尚未添加）" -ForegroundColor Gray
Write-Host "3. 使用浏览器测试工具对比详细日志" -ForegroundColor Gray
Write-Host "4. 检查路由表: route print" -ForegroundColor Gray
Write-Host "5. 尝试使用其他局域网设备测试" -ForegroundColor Gray
Write-Host ""

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
