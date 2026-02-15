$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deleting Additional Files" -ForegroundColor Cyan
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
            else {
                Write-Host "Deleted (folder)`n" -ForegroundColor Gray
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

Write-Host "`n=== 1. CS:GO Materials and Demos ===" -ForegroundColor Cyan
Remove-File -Path "E:\steam\steamapps\common\Counter-Strike Global Offensive\csgo\materials\pwa\winpanel" -Desc "CS:GO winpanel materials"
Remove-File -Path "E:\steam\steamapps\common\Counter-Strike Global Offensive\csgo\materials\top_coins" -Desc "CS:GO top_coins materials"
Remove-File -Path "E:\steam\steamapps\common\Counter-Strike Global Offensive\csgo\materials\overlays\top\emote" -Desc "CS:GO emote materials"
Remove-File -Path "E:\steam\steamapps\common\Counter-Strike Global Offensive\csgo\replays" -Desc "CS:GO replay demos"

Write-Host "`n=== 2. Twilight Struggle Game ===" -ForegroundColor Cyan
Remove-File -Path "E:\steam\steamapps\common\Twilight Struggle" -Desc "Twilight Struggle game (7 years unused)"

Write-Host "`n=== 3. NetEase Cloud Music Installer ===" -ForegroundColor Cyan
Remove-File -Path "E:\LenovoSoftstore\Install\wangyiyunyinle" -Desc "NetEase Cloud Music installer"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Deletion Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Files deleted: $deletedCount" -ForegroundColor Yellow
$totalMB = [math]::Round($deletedSize / 1MB, 2)
$totalGB = [math]::Round($deletedSize / 1GB, 2)
Write-Host "Space freed: $totalMB MB ($totalGB GB)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
