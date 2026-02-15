$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deleting Files" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$deletedSize = 0
$deletedCount = 0

function Remove-File {
    param([string]$Path, [string]$Description)

    if (Test-Path $Path) {
        $size = (Get-Item $Path -ErrorAction SilentlyContinue).Length
        Write-Host "Deleting: $Description" -ForegroundColor Yellow
        Write-Host "Path: $Path" -ForegroundColor Gray

        try {
            Remove-Item $Path -Force -Recurse -ErrorAction Stop
            Write-Host "Success!" -ForegroundColor Green
            if ($size) {
                $sizeMB = [math]::Round($size / 1MB, 2)
                Write-Host "Size: $sizeMB MB`n" -ForegroundColor Gray
                $script:deletedSize += $size
                $script:deletedCount++
            }
        }
        catch {
            Write-Host "Failed: $_`n" -ForegroundColor Red
        }
    }
    else {
        Write-Host "Not found: $Path`n" -ForegroundColor Gray
    }
}

Write-Host "`n=== 1. Steam Cloud Cache ===" -ForegroundColor Cyan
Remove-File -Path "E:\steam\userdata\1008390442\2338770\local\CDN.BIN" -Desc "Steam Cloud CDN (2338770)"
Remove-File -Path "E:\steam\userdata\1008390442\1644960\local\CDN.BIN" -Desc "Steam Cloud CDN (1644960)"
Remove-File -Path "E:\steam\userdata\1008390442\2338770\local\TMP.BIN" -Desc "Steam Cloud TMP (2338770)"
Remove-File -Path "E:\steam\userdata\1008390442\1644960\local\TMP.BIN" -Desc "Steam Cloud TMP (1644960)"
Remove-File -Path "E:\steam\userdata\1008390442\2338770\local\SYNC.BIN" -Desc "Steam Cloud SYNC (2338770)"
Remove-File -Path "E:\steam\userdata\1008390442\1644960\local\SYNC.BIN" -Desc "Steam Cloud SYNC (1644960)"

Write-Host "`n=== 2. Software Installers ===" -ForegroundColor Cyan
Remove-File -Path "D:\Users\王健俊\AppData\Local\SquirrelTemp\KOOK-0.86.5-full.nupkg" -Desc "KOOK installer"
Remove-File -Path "D:\Users\王健俊\AppData\Local\SquirrelTemp\app.7z" -Desc "KOOK archive"
Remove-File -Path "D:\Users\王健俊\AppData\Local\SquirrelTemp\tempb" -Desc "KOOK temp files"
Remove-File -Path "D:\i4Tools8\Other\iTunes(12.13.2.3).exe" -Desc "iTunes installer"

Write-Host "`n=== 3. CS:GO Maps ===" -ForegroundColor Cyan
Remove-File -Path "E:\steam\steamapps\common\Counter-Strike Global Offensive\csgo\maps\workshop\1202643420\yprac_dust2.bsp" -Desc "yprac_dust2"
Remove-File -Path "E:\steam\steamapps\common\Counter-Strike Global Offensive\csgo\maps\yprac_dust2.bsp" -Desc "yprac_dust2 copy"
Remove-File -Path "E:\steam\steamapps\common\Counter-Strike Global Offensive\csgo\maps\csgohub_prac.bsp" -Desc "csgohub_prac"
Remove-File -Path "E:\steam\steamapps\common\Counter-Strike Global Offensive\csgo\maps\yprac_inferno.bsp" -Desc "yprac_inferno"
Remove-File -Path "E:\steam\steamapps\common\Counter-Strike Global Offensive\csgo\maps\workshop\1222094548\yprac_mirage.bsp" -Desc "yprac_mirage"
Remove-File -Path "E:\steam\steamapps\common\Counter-Strike Global Offensive\csgo\maps\config_generator.bsp" -Desc "config_generator"
Remove-File -Path "E:\steam\steamapps\common\Counter-Strike Global Offensive\csgo\maps\yprac_aim.bsp" -Desc "yprac_aim"
Remove-File -Path "E:\steam\steamapps\common\Counter-Strike Global Offensive\csgo\maps\workshop\1365781615\yprac_aim.bsp" -Desc "yprac_aim copy"
Remove-File -Path "E:\steam\steamapps\common\Counter-Strike Global Offensive\csgo\maps\de_cbble_old_pwa.bsp" -Desc "de_cbble_old"
Remove-File -Path "E:\steam\steamapps\common\Counter-Strike Global Offensive\csgo\maps\de_aztec.bsp" -Desc "de_aztec"
Remove-File -Path "E:\steam\steamapps\common\Counter-Strike Global Offensive\csgo\maps\xhair_v3.bsp" -Desc "xhair_v3"
Remove-File -Path "E:\steam\steamapps\common\Counter-Strike Global Offensive\csgo\maps\workshop\243702660\aim_botz.bsp" -Desc "aim_botz"

Write-Host "`n=== 4. Minecraft Java ===" -ForegroundColor Cyan
Remove-File -Path "E:\MCLDownload\ext\jre-v64-220420" -Desc "Minecraft Java Runtime"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Deletion Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Files deleted: $deletedCount" -ForegroundColor Yellow
$totalMB = [math]::Round($deletedSize / 1MB, 2)
$totalGB = [math]::Round($deletedSize / 1GB, 2)
Write-Host "Space freed: $totalMB MB ($totalGB GB)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
