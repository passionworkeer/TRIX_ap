# Origin 检查诊断脚本

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  测试不同 Origin 的 WebSocket 握手" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$gatewayUrl = "192.168.101.4"
$gatewayPort = 18789

$origins = @(
    "http://192.168.101.4:5173",
    "http://localhost:5173",
    "http://192.168.101.4:18789",
    "null"
)

foreach ($origin in $origins) {
    Write-Host "测试 Origin: $origin" -ForegroundColor Yellow
    
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.Connect($gatewayUrl, $gatewayPort)
        
        $stream = $tcpClient.GetStream()
        $writer = New-Object System.IO.StreamWriter($stream)
        $reader = New-Object System.IO.StreamReader($stream)
        
        $webSocketKey = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([Guid]::NewGuid().ToString()))
        
        $handshake = @"
GET / HTTP/1.1
Host: $gatewayUrl`:$gatewayPort
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: $webSocketKey
Sec-WebSocket-Version: 13
Origin: $origin


"@ -replace "`r?`n", "`r`n"
        
        $writer.Write($handshake)
        $writer.Flush()
        
        $stream.ReadTimeout = 1000
        
        try {
            $statusLine = $reader.ReadLine()
            if ($statusLine -match "101") {
                Write-Host "   ✅ 成功 (101 Switching Protocols)" -ForegroundColor Green
            } elseif ($statusLine -match "403") {
                Write-Host "   ❌ 被拒绝 (403 Forbidden)" -ForegroundColor Red
            } else {
                Write-Host "   ⚠️ 其他响应: $statusLine" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "   ❌ 读取响应超时" -ForegroundColor Red
        }
        
        $stream.Close()
        $tcpClient.Close()
        
    } catch {
        Write-Host "   ❌ 连接失败: $_" -ForegroundColor Red
    }
    
    Write-Host ""
}

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "如果所有 Origin 都返回 403," -ForegroundColor Yellow
Write-Host "说明 Gateway 可能不接受外部 WebSocket 连接" -ForegroundColor Yellow
Write-Host "=====================================" -ForegroundColor Cyan
