# TRIX 防火墙配置脚本
# 右键此文件 -> 以管理员身份运行

Write-Host "正在配置 TRIX 开发服务器防火墙规则..." -ForegroundColor Cyan

# 检查是否已存在规则
$existingRule = Get-NetFirewallRule -DisplayName "TRIX Vite Dev Server" -ErrorAction SilentlyContinue

if ($existingRule) {
    Write-Host "删除旧的防火墙规则..." -ForegroundColor Yellow
    Remove-NetFirewallRule -DisplayName "TRIX Vite Dev Server"
}

# 添加新规则
Write-Host "添加新的防火墙规则 (端口 3000)..." -ForegroundColor Green
New-NetFirewallRule -DisplayName "TRIX Vite Dev Server" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 3000 `
    -Action Allow `
    -Profile Any `
    -Enabled True `
    -Description "允许 TRIX 移动应用通过局域网连接到开发服务器"

Write-Host ""
Write-Host "✅ 防火墙规则配置成功!" -ForegroundColor Green
Write-Host ""
Write-Host "现在你可以通过以下地址访问 TRIX:" -ForegroundColor Cyan
Write-Host "  本地: http://localhost:3000/" -ForegroundColor White
Write-Host "  手机: http://192.168.101.4:3000/" -ForegroundColor White
Write-Host ""
Write-Host "按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
