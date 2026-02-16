# Manual scan for unused software directories
$daysUnused = 365
$cutoffDate = (Get-Date).AddDays(-$daysUnused)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Manual Software Scan" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Specific software directories to check
$softwareDirs = @(
    "D:\CloudMusic",
    "D:\anaconda",
    "D:\QQNT",
    "D:\Weixin",
    "D:\Kimi",
    "D:\Doubao",
    "D:\feishu",
    "D:\i4Tools8",
    "D:\Kiro",
    "D:\Cursor",
    "D:\LeStoreDownload",
    "D:\Drivers",
    "D:\java",
    "D:\nodejs_cache",
    "D:\nodejs_global",
    "E:\douyin",
    "E:\Battle.net",
    "E:\LenovoSoftstore"
)

$results = @()

foreach ($dir in $softwareDirs) {
    if (-not (Test-Path $dir)) {
        continue
    }

    Write-Host "Checking: $dir" -ForegroundColor Gray

    try {
        # Find exe files
        $exes = Get-ChildItem -Path $dir -Recurse -Filter "*.exe" -ErrorAction SilentlyContinue |
            Where-Object {
                $_.Name -notmatch "unins|uninstall|setup|install|update|crashreport|helper|launcher" -and
                $_.Length -gt 500KB
            } |
            Sort-Object LastAccessTime -Descending |
            Select-Object -First 3

        if ($exes) {
            $latestAccess = ($exes | Sort-Object LastAccessTime -Descending | Select-Object -First 1).LastAccessTime

            if ($latestAccess -lt $cutoffDate) {
                $daysSince = [math]::Round(((Get-Date) - $latestAccess).TotalDays, 0)
                $folderSize = (Get-ChildItem -Path $dir -Recurse -File -ErrorAction SilentlyContinue |
                    Measure-Object -Property Length -Sum).Sum

                $sizeMB = [math]::Round($folderSize / 1MB, 2)

                $results += @{
                    Name = Split-Path $dir -Leaf
                    Path = $dir
                    LastAccess = $latestAccess
                    DaysSince = $daysSince
                    SizeMB = $sizeMB
                    MainExes = $exes | Select-Object -First 2 | ForEach-Object { $_.Name }
                }
            }
        }
    }
    catch {
        Write-Host "Error: $_" -ForegroundColor Red
    }
}

# Sort by size
$results = $results | Sort-Object SizeMB -Descending

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "UNUSED SOFTWARE (>1 year)" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Cyan

if ($results.Count -eq 0) {
    Write-Host "No unused software found!" -ForegroundColor Green
}
else {
    $i = 1
    foreach ($app in $results) {
        Write-Host "$i. " -NoNewline
        Write-Host "$($app.Name)" -ForegroundColor Yellow
        Write-Host "   Size: " -NoNewline
        Write-Host "$($app.SizeMB) MB" -ForegroundColor White
        Write-Host "   Last used: $($app.LastAccess.ToString('yyyy-MM-dd')) ($($app.DaysSince) days ago)" -ForegroundColor Red
        Write-Host "   Main apps: $($app.MainExes -join ', ')" -ForegroundColor Gray
        Write-Host "   Path: $($app.Path)`n" -ForegroundColor DarkGray

        $i++
    }

    $totalSize = ($results | Measure-Object -Property SizeMB -Sum).Sum
    $totalGB = [math]::Round($totalSize / 1024, 2)

    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Total: $($results.Count) programs" -ForegroundColor Yellow
    Write-Host "Total size: $([math]::Round($totalSize, 2)) MB ($totalGB GB)" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
}
