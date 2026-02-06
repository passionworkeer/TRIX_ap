# 诊断 React 应用 vs 测试工具的差异
# 分析为什么测试工具能连接,React 应用不行

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  React 应用差异诊断工具" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 检查 React 应用是否在运行
Write-Host "[1/5] 检查 React 应用状态" -ForegroundColor Yellow
Write-Host ""

$viteProcess = Get-Process | Where-Object { $_.ProcessName -eq 'node' } | ForEach-Object {
    $connections = Get-NetTCPConnection -OwningProcess $_.Id -ErrorAction SilentlyContinue | 
                   Where-Object { $_.LocalPort -eq 5173 }
    if ($connections) {
        return @{
            PID = $_.Id
            Connections = $connections
        }
    }
}

if ($viteProcess) {
    Write-Host "✅ Vite 正在运行" -ForegroundColor Green
    Write-Host "   PID: $($viteProcess.PID)" -ForegroundColor Gray
    Write-Host "   监听端口: 5173" -ForegroundColor Gray
} else {
    Write-Host "❌ Vite 未运行" -ForegroundColor Red
    Write-Host "   请运行: npm run dev" -ForegroundColor Yellow
    exit
}

# 2. 测试从浏览器访问
Write-Host ""
Write-Host "[2/5] 测试 HTTP 访问" -ForegroundColor Yellow
Write-Host ""

$urls = @(
    "http://localhost:5173",
    "http://192.168.101.4:5173"
)

foreach ($url in $urls) {
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 5 -UseBasicParsing
        Write-Host "✅ $url" -ForegroundColor Green
        Write-Host "   状态码: $($response.StatusCode)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ $url" -ForegroundColor Red
        Write-Host "   错误: $($_.Exception.Message)" -ForegroundColor Gray
    }
}

# 3. 检查 WebSocketContext.tsx 的配置
Write-Host ""
Write-Host "[3/5] 检查 WebSocket 配置" -ForegroundColor Yellow
Write-Host ""

$wsContextPath = "src\contexts\WebSocketContext.tsx"
if (Test-Path $wsContextPath) {
    $content = Get-Content $wsContextPath -Raw
    
    # 查找 WebSocket URL 配置
    if ($content -match "ws://") {
        Write-Host "✅ 找到 WebSocket 配置" -ForegroundColor Green
        
        # 提取关键代码行
        $lines = $content -split "`n"
        $relevantLines = $lines | Where-Object { 
            $_ -match "ws://" -or 
            $_ -match "getWebSocketURL" -or 
            $_ -match "window.location.hostname" 
        }
        
        Write-Host ""
        Write-Host "关键代码:" -ForegroundColor Cyan
        foreach ($line in $relevantLines | Select-Object -First 10) {
            Write-Host "  $($line.Trim())" -ForegroundColor Gray
        }
    }
    
    # 检查是否有环境变量配置
    if ($content -match "import.meta.env") {
        Write-Host ""
        Write-Host "⚠️ 使用了环境变量" -ForegroundColor Yellow
        
        $envLines = $lines | Where-Object { $_ -match "import.meta.env" }
        foreach ($line in $envLines | Select-Object -First 5) {
            Write-Host "  $($line.Trim())" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "❌ 未找到 WebSocketContext.tsx" -ForegroundColor Red
}

# 4. 检查 .env 文件
Write-Host ""
Write-Host "[4/5] 检查环境变量" -ForegroundColor Yellow
Write-Host ""

if (Test-Path ".env") {
    Write-Host "✅ 找到 .env 文件" -ForegroundColor Green
    Write-Host ""
    
    $envContent = Get-Content ".env"
    foreach ($line in $envContent) {
        if ($line -match "WEBSOCKET" -or $line -match "GATEWAY" -or $line -match "TOKEN") {
            Write-Host "  $line" -ForegroundColor Cyan
        }
    }
} else {
    Write-Host "⚠️ 未找到 .env 文件" -ForegroundColor Yellow
}

# 5. 实际测试 WebSocket 连接 (模拟 React)
Write-Host ""
Write-Host "[5/5] 实际 WebSocket 测试" -ForegroundColor Yellow
Write-Host ""

function Test-WebSocketWithOrigin {
    param(
        [string]$WsUrl,
        [string]$Origin,
        [string]$Label
    )
    
    Write-Host "测试: $Label" -ForegroundColor Cyan
    Write-Host "  WebSocket URL: $WsUrl" -ForegroundColor Gray
    Write-Host "  Origin: $Origin" -ForegroundColor Gray
    
    try {
        $ws = New-Object System.Net.WebSockets.ClientWebSocket
        
        # 尝试设置 Origin (虽然 .NET 的 ClientWebSocket 不直接支持)
        $uri = [System.Uri]::new($WsUrl)
        $cts = [System.Threading.CancellationToken]::None
        
        $task = $ws.ConnectAsync($uri, $cts)
        
        if ($task.Wait(5000)) {
            Write-Host "  ✅ 连接成功!" -ForegroundColor Green
            Write-Host "  状态: $($ws.State)" -ForegroundColor Gray
            $ws.Dispose()
        } else {
            Write-Host "  ❌ 连接超时" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ❌ 连接失败: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
}

# 测试两种场景
Test-WebSocketWithOrigin -WsUrl "ws://localhost:18789" -Origin "http://localhost:5173" -Label "localhost → localhost"
Test-WebSocketWithOrigin -WsUrl "ws://192.168.101.4:18789" -Origin "http://192.168.101.4:5173" -Label "IP → IP"

# 6. 总结和建议
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  诊断总结" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "现在请测试:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1️⃣ 打开测试工具:" -ForegroundColor Cyan
Write-Host "   在浏览器中打开: file:///E:/desktop/trix-3d-companion/app-layer-diagnosis.html" -ForegroundColor White
Write-Host ""
Write-Host "2️⃣ 运行所有测试,查看差异" -ForegroundColor Cyan
Write-Host ""
Write-Host "3️⃣ 打开 React 应用:" -ForegroundColor Cyan
Write-Host "   电脑: http://localhost:5173/#/chat" -ForegroundColor White
Write-Host "   手机: http://192.168.101.4:5173/#/chat" -ForegroundColor White
Write-Host ""
Write-Host "4️⃣ 打开浏览器开发者工具 (F12):" -ForegroundColor Cyan
Write-Host "   - 切换到 Console 标签" -ForegroundColor White
Write-Host "   - 切换到 Network 标签,筛选 WS" -ForegroundColor White
Write-Host "   - 查看 WebSocket 连接的详细信息" -ForegroundColor White
Write-Host ""
Write-Host "5️⃣ 对比两者的差异:" -ForegroundColor Cyan
Write-Host "   - 测试工具能连接吗?" -ForegroundColor White
Write-Host "   - React 应用能连接吗?" -ForegroundColor White
Write-Host "   - 错误信息是什么?" -ForegroundColor White
Write-Host "   - Headers 有什么不同?" -ForegroundColor White
Write-Host ""

Write-Host "按 Enter 退出..."
Read-Host
