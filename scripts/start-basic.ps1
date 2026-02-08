# ============================================
# 🚀 TRIX App 一键启动脚本
# ============================================

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  TRIX App 启动脚本" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 1. 检查 Gateway 是否运行
Write-Host "[1/4] 检查 Clawbot Gateway..." -ForegroundColor Yellow
$gatewayRunning = netstat -an | Select-String "18789" | Select-String "LISTENING"

if ($gatewayRunning) {
    Write-Host "✅ Gateway 已运行" -ForegroundColor Green
} else {
    Write-Host "❌ Gateway 未运行" -ForegroundColor Red
    Write-Host "   请手动启动: openclaw-cn gateway" -ForegroundColor Yellow
    Write-Host ""
    $startGateway = Read-Host "是否现在启动 Gateway? (y/n)"
    if ($startGateway -eq "y") {
        Write-Host "启动 Gateway..." -ForegroundColor Yellow
        Start-Process -FilePath "openclaw-cn" -ArgumentList "gateway" -WindowStyle Normal
        Start-Sleep -Seconds 3
    }
}

Write-Host ""

# 2. 获取本机 IP
Write-Host "[2/4] 获取本机 IP 地址..." -ForegroundColor Yellow
$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -like "*Wi-Fi*" -or $_.InterfaceAlias -like "*以太网*" } | Select-Object -First 1).IPAddress

if ($ipAddress) {
    Write-Host "✅ IP 地址: $ipAddress" -ForegroundColor Green
} else {
    Write-Host "⚠️  无法自动获取 IP，使用默认值" -ForegroundColor Yellow
    $ipAddress = "192.168.101.4"
}

Write-Host ""

# 3. 检查 .env 配置
Write-Host "[3/4] 检查 .env 配置..." -ForegroundColor Yellow
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "VITE_PC_WEBSOCKET_URL") {
        Write-Host "✅ .env 文件存在" -ForegroundColor Green
        
        # 显示关键配置
        Write-Host ""
        Write-Host "   关键配置:" -ForegroundColor Cyan
        $envContent | Select-String "VITE_PC_WEBSOCKET_URL|VITE_PC_AUTH_TOKEN" | ForEach-Object {
            Write-Host "   $_" -ForegroundColor Gray
        }
    } else {
        Write-Host "⚠️  .env 配置不完整" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ .env 文件不存在" -ForegroundColor Red
}

Write-Host ""

# 4. 显示访问信息
Write-Host "[4/4] 访问信息" -ForegroundColor Yellow
Write-Host ""
Write-Host "   📱 手机访问:" -ForegroundColor Cyan
Write-Host "      http://$ipAddress:5173/" -ForegroundColor Green
Write-Host ""
Write-Host "   💻 电脑访问:" -ForegroundColor Cyan
Write-Host "      http://localhost:5173/" -ForegroundColor Green
Write-Host "      http://$ipAddress:5173/" -ForegroundColor Green
Write-Host ""
Write-Host "   🔧 Gateway Dashboard:" -ForegroundColor Cyan
Write-Host "      http://$ipAddress:18789/" -ForegroundColor Green
Write-Host ""

# 5. 防火墙提示
Write-Host "⚠️  防火墙提示:" -ForegroundColor Yellow
Write-Host "   如果手机无法访问，请运行以下命令:" -ForegroundColor Gray
Write-Host '   netsh advfirewall firewall add rule name="Vite Dev Server" dir=in action=allow protocol=TCP localport=5173' -ForegroundColor Gray
Write-Host ""

# 6. 启动开发服务器
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
$start = Read-Host "是否启动 Vite 开发服务器? (y/n)"

if ($start -eq "y") {
    Write-Host ""
    Write-Host "🚀 启动 Vite..." -ForegroundColor Green
    Write-Host ""
    npm run dev
} else {
    Write-Host ""
    Write-Host "手动启动命令: npm run dev" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  启动完成！" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
