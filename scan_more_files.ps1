# Scan for large files - lower threshold (20MB)
$days = 365
$sizeMB = 20
$date = (Get-Date).AddDays(-$days)

Write-Host "Scanning for files not accessed in $days days and larger than $sizeMB MB..."
Write-Host ""

# Exclude system and program directories
$excludePatterns = @(
    '*\Windows\*',
    '*\Program Files\*',
    '*\Program Files (x86)\*',
    '*\ProgramData\*',
    '*\$Recycle.Bin\*',
    '*\System Volume Information\*',
    '*\$WINDOWS.~BT\*',
    '*\$WINDOWS.~WS\*',
    '*\Steam\steamapps\common\*',
    '*\Steam\steamapps\downloading\*',
    '*\node_modules\*',
    '*\AppData\Local\Microsoft\*',
    '*\AppData\Local\Google\*',
    '*\.git\*'
)

foreach ($drive in @('C', 'D', 'E')) {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Scanning $drive drive" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan

    $path = "${drive}:\"
    if (-not (Test-Path $path)) {
        Write-Host "Drive not found"
        Write-Host ""
        continue
    }

    $files = Get-ChildItem -Path $path -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object {
            $_.LastAccessTime -lt $date -and
            $_.Length -gt ($sizeMB * 1MB) -and
            -not ($excludePatterns | Where-Object { $_.FullName -like $_ })
        } |
        Sort-Object Length -Descending |
        Select-Object -First 30

    if ($files.Count -eq 0) {
        Write-Host "No old files found" -ForegroundColor Green
        Write-Host ""
        continue
    }

    $total = 0
    $i = 1

    foreach ($file in $files) {
        $mb = [math]::Round($file.Length / 1MB, 2)
        $total += $file.Length
        $daysAgo = [math]::Round(((Get-Date) - $file.LastAccessTime).TotalDays, 0)
        $ext = if ($file.Extension) { $file.Extension } else { "No extension" }

        Write-Host "$i. $($file.FullName)"
        Write-Host "   Size: $mb MB | Type: $ext | Last access: $($file.LastAccessTime.ToString('yyyy-MM-dd')) ($daysAgo days ago)"
        Write-Host ""

        $i++
    }

    $totalMB = [math]::Round($total / 1MB, 2)
    $totalGB = [math]::Round($total / 1GB, 2)
    Write-Host "Total size: $totalMB MB ($totalGB GB)" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Scan complete!" -ForegroundColor Green
