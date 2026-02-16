Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FINAL CLEANING SUMMARY" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "=== PHASE 1: Initial Cleanup ===" -ForegroundColor Green
Write-Host "Steam Cloud Cache: 11.8 GB" -ForegroundColor White
Write-Host "CS:GO Old Maps: 1.95 GB" -ForegroundColor White
Write-Host "Software Installers: 201 MB" -ForegroundColor White
Write-Host "Minecraft Java: 0 MB (already deleted)" -ForegroundColor Gray
Write-Host "Total Phase 1: 13.68 GB`n" -ForegroundColor Yellow

Write-Host "=== PHASE 2: Game Files Cleanup ===" -ForegroundColor Green
Write-Host "CS:GO Materials/Demos: 80 MB" -ForegroundColor White
Write-Host "Twilight Struggle: 0 MB (already deleted)" -ForegroundColor Gray
Write-Host "NetEase Installer: 0 MB (already deleted)" -ForegroundColor Gray
Write-Host "Terraria Audio: 402 MB" -ForegroundColor White
Write-Host "Steam Workshop Videos: 372 MB" -ForegroundColor White
Write-Host "WeGame Installer: 216 MB" -ForegroundColor White
Write-Host "LeStore Installer: 177 MB" -ForegroundColor White
Write-Host "Total Phase 2: 1.25 GB`n" -ForegroundColor Yellow

Write-Host "=== TOTAL SPACE FREED: 14.93 GB ===" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "REMAINING LARGE FILES (OPTIONS)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "1. WPS Cloud PPT Templates (C: drive)" -ForegroundColor Yellow
Write-Host "   Size: ~1.8 GB" -ForegroundColor Gray
Write-Host "   Location: C:\Users\王健俊\WPSDrive\..." -ForegroundColor Gray
Write-Host "   Last access: 306 days ago" -ForegroundColor Gray
Write-Host "   Action: Can safely delete if not needed`n" -ForegroundColor Gray

Write-Host "2. WeChat Backup Files (D: drive)" -ForegroundColor Yellow
Write-Host "   Size: ~13 GB" -ForegroundColor Gray
Write-Host "   Location: D:\微信聊天记录\ & D:\xwechat_files\..." -ForegroundColor Gray
Write-Host "   Last access: 562 days ago" -ForegroundColor Gray
Write-Host "   Action: DELETE CAREFULLY - backup first if needed`n" -ForegroundColor Gray

Write-Host "3. QQ Chat Records (D: drive)" -ForegroundColor Yellow
Write-Host "   Size: ~9 GB" -ForegroundColor Gray
Write-Host "   Location: D:\qq记录\..." -ForegroundColor Gray
Write-Host "   Last access: 903 days ago" -ForegroundColor Gray
Write-Host "   Action: DELETE CAREFULLY - backup first if needed`n" -ForegroundColor Gray

Write-Host "4. Python/ML Libraries (D: drive)" -ForegroundColor Yellow
Write-Host "   Size: ~500 MB" -ForegroundColor Gray
Write-Host "   Location: D:\python\Lib\..." -ForegroundColor Gray
Write-Host "   Action: Keep if using Python/ML`n" -ForegroundColor Gray

Write-Host "5. WeGame/Thunder Programs (various)" -ForegroundColor Yellow
Write-Host "   Size: ~300 MB" -ForegroundColor Gray
Write-Host "   Action: Keep if using these apps`n" -ForegroundColor Gray

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "NEXT STEPS" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Option A: Clean WPS Templates (+1.8 GB)" -ForegroundColor White
Write-Host "   Run: Remove WPS PPT templates (safe)`n" -ForegroundColor Gray

Write-Host "Option B: Clean Chat Records (+22 GB)" -ForegroundColor White
Write-Host "   WARNING: Make sure to backup important chats first!`n" -ForegroundColor Gray

Write-Host "Option C: Keep everything as is" -ForegroundColor White
Write-Host "   You've already freed 14.93 GB!`n" -ForegroundColor Gray

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Summary: 14.93 GB cleaned successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
