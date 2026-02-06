# ============================================
# 🔧 自动修复防火墙规则
# ============================================
# 需要以管理员权限运行

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  防火墙规则修复脚本" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ 此脚本需要管理员权限" -ForegroundColor Red
    Write-Host ""
    Write-Host "请右键点击 PowerShell，选择 '以管理员身份运行'" -ForegroundColor Yellow
    Write-Host "然后再次运行此脚本" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "按 Enter 键退出"
    exit 1
}

Write-Host "✅ 已获取管理员权限" -ForegroundColor Green
Write-Host ""

# 删除旧规则（如果存在）
Write-Host "[1/4] 删除旧规则（如果存在）..." -ForegroundColor Yellow
try {
    netsh advfirewall firewall delete rule name="Clawbot Gateway - Port 18789" 2>$null
    netsh advfirewall firewall delete rule name="Vite Dev Server - Port 5173" 2>$null
    Write-Host "   完成" -ForegroundColor Gray
} catch {
    Write-Host "   没有找到旧规则" -ForegroundColor Gray
}

Write-Host ""

# 添加 Gateway 规则
Write-Host "[2/4] 添加 Clawbot Gateway 防火墙规则..." -ForegroundColor Yellow
$result1 = netsh advfirewall firewall add rule name="Clawbot Gateway - Port 18789" dir=in action=allow protocol=TCP localport=18789

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ 成功添加规则：端口 18789" -ForegroundColor Green
} else {
    Write-Host "   ❌ 添加规则失败" -ForegroundColor Red
    Write-Host "   $result1" -ForegroundColor Red
}

Write-Host ""

# 添加 Vite 规则
Write-Host "[3/4] 添加 Vite Dev Server 防火墙规则..." -ForegroundColor Yellow
$result2 = netsh advfirewall firewall add rule name="Vite Dev Server - Port 5173" dir=in action=allow protocol=TCP localport=5173

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ 成功添加规则：端口 5173" -ForegroundColor Green
} else {
    Write-Host "   ❌ 添加规则失败" -ForegroundColor Red
    Write-Host "   $result2" -ForegroundColor Red
}

Write-Host ""

# 验证规则
Write-Host "[4/4] 验证防火墙规则..." -ForegroundColor Yellow
$rules = netsh advfirewall firewall show rule name=all | Select-String "Clawbot Gateway|Vite Dev Server"

if ($rules) {
    Write-Host "   ✅ 规则已成功创建" -ForegroundColor Green
    Write-Host ""
    Write-Host "   已创建的规则:" -ForegroundColor Cyan
    netsh advfirewall firewall show rule name="Clawbot Gateway - Port 18789"
    Write-Host ""
    netsh advfirewall firewall show rule name="Vite Dev Server - Port 5173"
} else {
    Write-Host "   ⚠️  无法验证规则" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  修复完成！" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 下一步操作:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. 重启 Gateway:" -ForegroundColor White
Write-Host "   openclaw-cn gateway" -ForegroundColor Gray
Write-Host ""
Write-Host "2. 测试连接:" -ForegroundColor White
Write-Host "   访问: http://192.168.101.4:5173/#/diagnostic" -ForegroundColor Gray
Write-Host "   点击: 开始测试连接" -ForegroundColor Gray
Write-Host ""
Write-Host "3. 如果仍然失败:" -ForegroundColor White
Write-Host "   - 检查是否有第三方防火墙软件" -ForegroundColor Gray
Write-Host "   - 检查杀毒软件是否拦截" -ForegroundColor Gray
Write-Host "   - 查看 Windows 防火墙日志" -ForegroundColor Gray
Write-Host ""

Read-Host "按 Enter 键退出"
