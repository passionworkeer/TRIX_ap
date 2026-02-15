# Comprehensive scan - 10MB threshold, 180 days
$days = 180
$sizeMB = 10
$date = (Get-Date).AddDays(-$days)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deep Scan for Large Files" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Files not accessed in $days days" -ForegroundColor Gray
Write-Host "Larger than $sizeMB MB" -ForegroundColor Gray
Write-Host ""

# Exclude more patterns
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
    '*\.git\*',
    '*\node_modules\*',
    '*\AppData\Local\Microsoft\Edge\*',
    '*\AppData\Local\Microsoft\OneDrive\*',
    '*\AppData\Local\Google\Chrome\User Data\*'
)

$totalFound = 0

foreach ($drive in @('C', 'D', 'E')) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "Scanning $drive drive" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan

    $path = "${drive}:\"
    if (-not (Test-Path $path)) {
        Write-Host "Drive not found`n"
        continue
    }

    $files = Get-ChildItem -Path $path -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object {
            $_.LastAccessTime -lt $date -and
            $_.Length -gt ($sizeMB * 1MB) -and
            -not ($excludePatterns | Where-Object { $_.FullName -like $_ })
        } |
        Sort-Object Length -Descending |
        Select-Object -First 50

    if ($files.Count -eq 0) {
        Write-Host "No files found`n" -ForegroundColor Green
        continue
    }

    $total = 0
    $i = 1

    foreach ($file in $files) {
        $mb = [math]::Round($file.Length / 1MB, 2)
        $total += $file.Length
        $daysAgo = [math]::Round(((Get-Date) - $file.LastAccessTime).TotalDays, 0)
        $ext = if ($file.Extension) { $file.Extension } else { "(no ext)" }
        $fileName = Split-Path $file.FullName -Leaf

        # Determine file category
        $category = "Unknown"
        if ($ext -in @('.mp4', '.mkv', '.avi', '.mov', '.flv', '.wmv')) { $category = "Video" }
        elseif ($ext -in @('.zip', '.rar', '.7z', '.tar', '.gz')) { $category = "Archive" }
        elseif ($ext -in @('.exe', '.msi', '.apk')) { $category = "Installer" }
        elseif ($ext -in @('.dll', '.sys', '.so')) { $category = "System" }
        elseif ($ext -in @('.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx')) { $category = "Document" }
        elseif ($ext -in @('.mp3', '.flac', '.wav', '.m4a', '.aac')) { $category = "Audio" }
        elseif ($ext -in @('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp')) { $category = "Image" }
        elseif ($ext -in @('.db', '.sqlite', '.mdb')) { $category = "Database" }

        Write-Host "$i. " -NoNewline
        Write-Host "$category" -ForegroundColor Cyan
        Write-Host "   File: $fileName" -ForegroundColor White
        Write-Host "   Path: $($file.FullName)" -ForegroundColor Gray
        Write-Host "   Size: " -NoNewline
        Write-Host "$mb MB" -ForegroundColor Yellow
        Write-Host "   Type: " -NoNewline
        Write-Host "$ext" -ForegroundColor DarkGray
        Write-Host "   Last access: " -NoNewline
        Write-Host "$($file.LastAccessTime.ToString('yyyy-MM-dd'))" -ForegroundColor Gray
        Write-Host "   (" -NoNewline
        Write-Host "$daysAgo days ago" -ForegroundColor Red
        Write-Host ")"
        Write-Host ""

        $i++
        $totalFound++
    }

    $totalMB = [math]::Round($total / 1MB, 2)
    $totalGB = [math]::Round($total / 1GB, 2)
    Write-Host "Total size: $totalMB MB ($totalGB GB)" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Scan Complete!" -ForegroundColor Green
Write-Host "Total files found: $totalFound" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
