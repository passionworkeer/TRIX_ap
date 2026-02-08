# 终极解决方案:修改 hosts 文件
# 这样电脑通过域名访问,避免 Hairpin NAT 问题

#Requires -RunAsAdministrator

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Hosts 文件修改方案" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$hostsPath = "C:\Windows\System32\drivers\etc\hosts"
$localIP = "192.168.101.4"
$hostname = "trix.local"

Write-Host "这个方案会:" -ForegroundColor Yellow
Write-Host "  1. 在 hosts 文件中添加: 127.0.0.1  $hostname" -ForegroundColor Gray
Write-Host "  2. 电脑通过 http://$hostname`:5173 访问" -ForegroundColor Gray
Write-Host "  3. 手机通过 http://$localIP`:5173 访问" -ForegroundColor Gray
Write-Host "  4. 电脑的 WebSocket 自动连接 localhost" -ForegroundColor Gray
Write-Host "  5. 手机的 WebSocket 自动连接局域网 IP" -ForegroundColor Gray
Write-Host ""

Write-Host "正在备份 hosts 文件..." -ForegroundColor Yellow
Copy-Item $hostsPath "$hostsPath.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Write-Host "✅ 备份完成" -ForegroundColor Green

Write-Host ""
Write-Host "正在修改 hosts 文件..." -ForegroundColor Yellow

$hostsContent = Get-Content $hostsPath
$newLine = "127.0.0.1  $hostname  # TRIX Companion - 避免 Hairpin NAT"

# 检查是否已存在
if ($hostsContent -match $hostname) {
    Write-Host "⚠️ hosts 文件中已存在 $hostname,跳过" -ForegroundColor Yellow
} else {
    Add-Content $hostsPath "`n$newLine"
    Write-Host "✅ 已添加: $newLine" -ForegroundColor Green
}

# 刷新 DNS 缓存
Write-Host ""
Write-Host "正在刷新 DNS 缓存..." -ForegroundColor Yellow
ipconfig /flushdns | Out-Null
Write-Host "✅ DNS 缓存已刷新" -ForegroundColor Green

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  配置完成!" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📱 使用方法:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1️⃣ 电脑浏览器访问:" -ForegroundColor White
Write-Host "   http://$hostname`:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "2️⃣ 手机浏览器访问:" -ForegroundColor White
Write-Host "   http://$localIP`:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 原理:" -ForegroundColor Yellow
Write-Host "  - 电脑访问 $hostname → DNS 解析到 127.0.0.1" -ForegroundColor Gray
Write-Host "  - WebSocket 自动连接 ws://localhost:18789 ✅" -ForegroundColor Gray
Write-Host "  - 手机访问 $localIP → 直接使用 IP" -ForegroundColor Gray
Write-Host "  - WebSocket 连接 ws://$localIP`:18789 ✅" -ForegroundColor Gray
Write-Host "  - 避开了 Windows Hairpin NAT 限制!" -ForegroundColor Green
Write-Host ""
Write-Host "🧪 测试:" -ForegroundColor Yellow
Write-Host "  1. 在电脑浏览器打开: http://$hostname`:5173/#/chat" -ForegroundColor Gray
Write-Host "  2. 在手机浏览器打开: http://$localIP`:5173/#/chat" -ForegroundColor Gray
Write-Host "  3. 两边都应该能连接到 Bot!" -ForegroundColor Gray
Write-Host ""

Read-Host "按 Enter 退出"
