# Deep scan for large files >100MB, unused >180 days
$days = 180
$sizeMB = 100
$date = (Get-Date).AddDays(-$days)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DEEP SCAN - Large Files" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Files not accessed in $days+ days" -ForegroundColor Gray
Write-Host "Larger than $sizeMB MB" -ForegroundColor Gray
Write-Host ""

$excludePatterns = @(
    '*\Windows\*',
    '*\Program Files\*',
    '*\Program Files (x86)\*',
    '*\ProgramData\*',
    '*\$Recycle.Bin\*',
    '*\System Volume Information\*',
    '*\$WINDOWS.~BT\*',
    '*\$WINDOWS.~WS\*'
)

$results = @()

foreach ($drive in @('C', 'D', 'E')) {
    Write-Host "`n=== Scanning $drive drive ===" -ForegroundColor Cyan

    $path = "${drive}:\"
    if (-not (Test-Path $path)) {
        Write-Host "Drive not found"
        continue
    }

    try {
        $files = Get-ChildItem -Path $path -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object {
                $_.LastAccessTime -lt $date -and
                $_.Length -gt ($sizeMB * 1MB) -and
                -not ($excludePatterns | Where-Object { $_.FullName -like $_ })
            } |
            Sort-Object Length -Descending

        if ($files.Count -eq 0) {
            Write-Host "No large files found`n" -ForegroundColor Green
            continue
        }

        Write-Host "Found $($files.Count) files`n" -ForegroundColor Yellow

        foreach ($file in $files) {
            $mb = [math]::Round($file.Length / 1MB, 2)
            $daysAgo = [math]::Round(((Get-Date) - $file.LastAccessTime).TotalDays, 0)
            $ext = if ($file.Extension) { $file.Extension } else { "" }

            $results += @{
                Drive = $drive
                Path = $file.FullName
                Size = $mb
                Extension = $ext
                DaysAgo = $daysAgo
                LastAccess = $file.LastAccessTime
            }
        }
    }
    catch {
        Write-Host "Error: $_`n" -ForegroundColor Red
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "RESULTS - All Large Files" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

if ($results.Count -eq 0) {
    Write-Host "No large files found!" -ForegroundColor Green
}
else {
    $grouped = $results | Group-Object -Property Drive

    foreach ($group in $grouped) {
        Write-Host "`n=== Drive $($group.Name) ===" -ForegroundColor Cyan
        $groupFiles = $group.Group | Sort-Object Size -Descending

        $i = 1
        foreach ($file in $groupFiles) {
            Write-Host "$i. " -NoNewline
            Write-Host "$($file.Size) MB" -ForegroundColor Yellow
            Write-Host "   Path: $($file.Path)" -ForegroundColor White
            Write-Host "   Type: $($file.Extension) | Last access: $($file.DaysAgo) days ago`n" -ForegroundColor Gray

            $i++

            if ($i -gt 30) {
                Write-Host "... and more files`n" -ForegroundColor Gray
                break
            }
        }

        $totalSize = ($groupFiles | Measure-Object -Property Size -Sum).Sum
        Write-Host "Total: $($group.Count) files, $([math]::Round($totalSize, 2)) MB`n" -ForegroundColor DarkCyan
    }

    $allSize = ($results | Measure-Object -Property Size -Sum).Sum
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "Grand Total: $($results.Count) files, $([math]::Round($allSize, 2)) MB ($([math]::Round($allSize / 1024, 2)) GB)" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
}
