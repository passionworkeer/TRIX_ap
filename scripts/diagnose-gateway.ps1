# Gateway 连接诊断脚本
# 用于检查 Gateway 是否正确响应 WebSocket 请求

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Gateway WebSocket 握手测试" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$gatewayUrl = "192.168.101.4"
$gatewayPort = 18789

# 测试 1: TCP 连接
Write-Host "[1/4] 测试 TCP 连接..." -ForegroundColor Yellow
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.Connect($gatewayUrl, $gatewayPort)
    Write-Host "   ✅ TCP 连接成功" -ForegroundColor Green
    $tcpClient.Close()
} catch {
    Write-Host "   ❌ TCP 连接失败: $_" -ForegroundColor Red
    exit 1
}

# 测试 2: HTTP GET 请求(看看 Gateway 响应什么)
Write-Host ""
Write-Host "[2/4] 测试 HTTP GET 请求..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://$gatewayUrl`:$gatewayPort/" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✅ HTTP 响应成功" -ForegroundColor Green
    Write-Host "   状态码: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "   内容类型: $($response.Headers['Content-Type'])" -ForegroundColor Gray
    Write-Host "   响应内容(前 200 字符):" -ForegroundColor Gray
    Write-Host "   $($response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)))" -ForegroundColor Gray
} catch {
    Write-Host "   ⚠️ HTTP 请求失败(这可能是正常的,如果 Gateway 只支持 WebSocket)" -ForegroundColor Yellow
    Write-Host "   错误: $_" -ForegroundColor Gray
}

# 测试 3: WebSocket 握手(手动发送 HTTP Upgrade)
Write-Host ""
Write-Host "[3/4] 测试 WebSocket 握手..." -ForegroundColor Yellow

try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.Connect($gatewayUrl, $gatewayPort)
    
    $stream = $tcpClient.GetStream()
    $writer = New-Object System.IO.StreamWriter($stream)
    $reader = New-Object System.IO.StreamReader($stream)
    
    # 生成 WebSocket Key
    $webSocketKey = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([Guid]::NewGuid().ToString()))
    
    # 构造 WebSocket 握手请求
    $handshake = @"
GET / HTTP/1.1
Host: $gatewayUrl`:$gatewayPort
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: $webSocketKey
Sec-WebSocket-Version: 13
Origin: http://$gatewayUrl`:5173


"@ -replace "`r?`n", "`r`n"
    
    Write-Host "   发送握手请求:" -ForegroundColor Gray
    Write-Host $handshake -ForegroundColor DarkGray
    
    $writer.Write($handshake)
    $writer.Flush()
    
    # 读取响应(设置 1 秒超时)
    $stream.ReadTimeout = 1000
    
    Write-Host ""
    Write-Host "   服务器响应:" -ForegroundColor Gray
    
    $responseLines = @()
    $lineCount = 0
    while ($lineCount -lt 20) {
        try {
            $line = $reader.ReadLine()
            if ($null -eq $line) { break }
            $responseLines += $line
            Write-Host "   $line" -ForegroundColor DarkGray
            $lineCount++
            if ($line -eq "") { break }  # 空行表示 headers 结束
        } catch {
            break
        }
    }
    
    # 检查响应
    $statusLine = $responseLines[0]
    if ($statusLine -match "101") {
        Write-Host ""
        Write-Host "   ✅ WebSocket 握手成功! (HTTP 101 Switching Protocols)" -ForegroundColor Green
    } elseif ($statusLine -match "200") {
        Write-Host ""
        Write-Host "   ⚠️ 收到 HTTP 200(而不是 101),这不是标准的 WebSocket 握手" -ForegroundColor Yellow
    } else {
        Write-Host ""
        Write-Host "   ❌ WebSocket 握手失败" -ForegroundColor Red
        Write-Host "   状态行: $statusLine" -ForegroundColor Red
    }
    
    $stream.Close()
    $tcpClient.Close()
    
} catch {
    Write-Host "   ❌ WebSocket 握手测试失败: $_" -ForegroundColor Red
}

# 测试 4: 检查 Gateway 进程
Write-Host ""
Write-Host "[4/4] 检查 Gateway 进程..." -ForegroundColor Yellow

$gatewayProcess = Get-NetTCPConnection -LocalPort 18789 -ErrorAction SilentlyContinue | 
    Select-Object -First 1 -ExpandProperty OwningProcess

if ($gatewayProcess) {
    $processInfo = Get-Process -Id $gatewayProcess -ErrorAction SilentlyContinue
    if ($processInfo) {
        Write-Host "   ✅ Gateway 进程运行中" -ForegroundColor Green
        Write-Host "   进程名: $($processInfo.ProcessName)" -ForegroundColor Gray
        Write-Host "   进程 ID: $gatewayProcess" -ForegroundColor Gray
        Write-Host "   内存: $([Math]::Round($processInfo.WorkingSet64/1MB, 2)) MB" -ForegroundColor Gray
        Write-Host "   启动时间: $($processInfo.StartTime)" -ForegroundColor Gray
    }
} else {
    Write-Host "   ❌ 没有找到监听端口 18789 的进程" -ForegroundColor Red
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  诊断完成" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 下一步:" -ForegroundColor Yellow
Write-Host "   1. 查看上面的 WebSocket 握手响应" -ForegroundColor White
Write-Host "   2. 检查 Gateway 是否有错误日志" -ForegroundColor White
Write-Host "   3. 尝试重启 Gateway" -ForegroundColor White
Write-Host ""
Write-Host "按 Enter 继续..." -ForegroundColor Gray
Read-Host
