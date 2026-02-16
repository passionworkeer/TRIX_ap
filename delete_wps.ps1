$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deleting WPS PPT Templates" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$wpsPath = "C:\Users\王健俊\WPSDrive\1760719960\WPS企业云盘\广东医科大学\团队文档\全员团队\PPT模板"

if (Test-Path $wpsPath) {
    $sizeBefore = (Get-ChildItem -Path $wpsPath -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    $sizeMB = [math]::Round($sizeBefore / 1MB, 2)

    Write-Host "Found WPS PPT Templates folder" -ForegroundColor Yellow
    Write-Host "Path: $wpsPath" -ForegroundColor Gray
    Write-Host "Size: $sizeMB MB`n" -ForegroundColor Gray

    Write-Host "Deleting..." -ForegroundColor Yellow
    try {
        Remove-Item $wpsPath -Force -Recurse -ErrorAction Stop
        Write-Host "Success! Freed $sizeMB MB`n" -ForegroundColor Green
    }
    catch {
        Write-Host "Failed: $_`n" -ForegroundColor Red
    }
}
else {
    Write-Host "WPS templates folder not found`n" -ForegroundColor Gray
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "WPS Cleanup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
