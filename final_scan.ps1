# Final comprehensive scan
$days = 90
$sizeMB = 5
$date = (Get-Date).AddDays(-$days)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Final Comprehensive Scan" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Files not accessed in $days days" -ForegroundColor Gray
Write-Host "Larger than $sizeMB MB" -ForegroundColor Gray
Write-Host ""

# Get ALL drives
$drives = Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -ne $null } | Select-Object -ExpandProperty Root

$totalSize = 0
$totalFiles = 0

foreach ($drive in $drives) {
    Write-Host "`n=== Drive: $drive ===" -ForegroundColor Cyan

    try {
        $files = Get-ChildItem -Path $drive -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object {
                $_.LastAccessTime -lt $date -and
                $_.Length -gt ($sizeMB * 1MB)
            } |
            Sort-Object Length -Descending |
            Select-Object -First 100

        if ($files.Count -eq 0) {
            Write-Host "No files found"
            continue
        }

        $driveSize = 0
        $i = 1

        foreach ($file in $files) {
            $mb = [math]::Round($file.Length / 1MB, 2)
            $driveSize += $file.Length
            $totalSize += $file.Length
            $daysAgo = [math]::Round(((Get-Date) - $file.LastAccessTime).TotalDays, 0)
            $ext = if ($file.Extension) { $file.Extension } else { "" }

            # Skip certain system folders
            if ($file.FullName -match '\\Windows\\' -or
                $file.FullName -match '\\Program Files\\' -or
                $file.FullName -match '\\\$Recycle' -or
                $file.FullName -match '\\System Volume') {
                continue
            }

            Write-Host "$i. " -NoNewline
            Write-Host "$mb MB" -ForegroundColor Yellow
            Write-Host "   $($file.FullName)" -ForegroundColor White
            Write-Host "   $ext | $daysAgo days ago`n" -ForegroundColor Gray

            $i++
            $totalFiles++
        }

        $totalMB = [math]::Round($driveSize / 1MB, 2)
        Write-Host "Drive subtotal: $totalMB MB`n" -ForegroundColor DarkCyan
    }
    catch {
        Write-Host "Error: $_"
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Total files: $totalFiles" -ForegroundColor Yellow
$totalAllMB = [math]::Round($totalSize / 1MB, 2)
$totalAllGB = [math]::Round($totalSize / 1GB, 2)
Write-Host "Total size: $totalAllMB MB ($totalAllGB GB)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
