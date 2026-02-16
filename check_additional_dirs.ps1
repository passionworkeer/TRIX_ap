# Check additional software-like directories
$daysUnused = 365
$cutoffDate = (Get-Date).AddDays(-$daysUnused)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Checking Additional Software Directories" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$dirs = @(
    "D:\tools",
    "D:\user",
    "D:\xiezuo",
    "D:\Trae_outside",
    "E:\Trae CN",
    "E:\douyin",
    "D:\Bin",
    "E:\1"
)

foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        continue
    }

    Write-Host "=== $dir ===" -ForegroundColor Cyan

    try {
        # Get folder size
        $size = (Get-ChildItem -Path $dir -Recurse -File -ErrorAction SilentlyContinue |
            Measure-Object -Property Length -Sum).Sum

        $sizeMB = [math]::Round($size / 1MB, 2)
        $sizeGB = [math]::Round($size / 1GB, 2)

        Write-Host "Size: $sizeMB MB ($sizeGB GB)" -ForegroundColor White

        # Find exe files
        $exes = Get-ChildItem -Path $dir -Recurse -Filter "*.exe" -ErrorAction SilentlyContinue |
            Where-Object { $_.Length -gt 500KB } |
            Sort-Object LastAccessTime -Descending |
            Select-Object -First 5

        if ($exes) {
            $latestAccess = $exes[0].LastAccessTime
            $daysSince = [math]::Round(((Get-Date) - $latestAccess).TotalDays, 0)

            Write-Host "Latest access: $($latestAccess.ToString('yyyy-MM-dd')) ($daysSince days ago)" -ForegroundColor $(if ($daysSince -gt $daysUnused) { 'Red' } else { 'Green' })
            Write-Host "Main executables:" -ForegroundColor Gray

            foreach ($exe in $exes | Select-Object -First 3) {
                $exeDays = [math]::Round(((Get-Date) - $exe.LastAccessTime).TotalDays, 0)
                Write-Host "  - $($exe.Name) ($exeDays days ago)" -ForegroundColor DarkGray
            }
        }
        else {
            Write-Host "No executables found" -ForegroundColor Gray
        }

        Write-Host ""
    }
    catch {
        Write-Host "Error: $_`n" -ForegroundColor Red
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Scan Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
