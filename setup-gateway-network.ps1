# TRIX Gateway Network Configuration
# Run as Administrator

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TRIX Gateway Network Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Add firewall rule
Write-Host "Step 1/2: Configuring firewall rule (port 18789)..." -ForegroundColor Yellow

$existingRule = Get-NetFirewallRule -DisplayName "TRIX Clawdbot Gateway" -ErrorAction SilentlyContinue

if ($existingRule) {
    Write-Host "  Removing old rule..." -ForegroundColor Gray
    Remove-NetFirewallRule -DisplayName "TRIX Clawdbot Gateway"
}

Write-Host "  Creating new rule..." -ForegroundColor Gray
New-NetFirewallRule -DisplayName "TRIX Clawdbot Gateway" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 18789 `
    -Action Allow `
    -Profile Any `
    -Enabled True `
    -Description "Allow TRIX mobile app to connect to Clawdbot Gateway via LAN"

Write-Host "  [OK] Firewall configured!" -ForegroundColor Green
Write-Host ""

# Step 2: Check Gateway listening status
Write-Host "Step 2/2: Checking Gateway listening status..." -ForegroundColor Yellow

$listening = netstat -ano | Select-String "18789" | Select-String "LISTENING"

Write-Host "  Current listening ports:" -ForegroundColor Gray
$listening | ForEach-Object {
    Write-Host "    $_" -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Configuration Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$listeningText = $listening | Out-String

if ($listeningText -match "127\.0\.0\.1:18789") {
    Write-Host "[WARNING] Gateway only listens on localhost!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Gateway needs to listen on 0.0.0.0 or 192.168.101.4" -ForegroundColor Yellow
    Write-Host "to accept connections from phones/other devices." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "How to fix:" -ForegroundColor Cyan
    Write-Host "  1. Find Gateway config file or startup script" -ForegroundColor White
    Write-Host "  2. Change host from '127.0.0.1' to '0.0.0.0'" -ForegroundColor White
    Write-Host "  3. Restart Gateway" -ForegroundColor White
} elseif ($listeningText -match "0\.0\.0\.0:18789") {
    Write-Host "[OK] Gateway is correctly configured!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now access TRIX from:" -ForegroundColor Cyan
    Write-Host "  PC:    http://localhost:3000/" -ForegroundColor White
    Write-Host "  Phone: http://192.168.101.4:3000/" -ForegroundColor White
} else {
    Write-Host "[INFO] Gateway not detected on port 18789" -ForegroundColor Cyan
    Write-Host "Please make sure Gateway is running." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Next Steps" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Restart Gateway (if needed)" -ForegroundColor White
Write-Host "2. Restart Vite: npm run dev" -ForegroundColor White
Write-Host "3. Open http://192.168.101.4:3000/" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
