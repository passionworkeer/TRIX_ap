# Find large files in user directories
$days = 180
$sizeMB = 30
$date = (Get-Date).AddDays(-$days)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Scanning User Directories" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Focus on user directories
$userPaths = @(
    "E:\王健俊\",
    "D:\Users\王健俊\",
    "E:\王健俊\Documents\",
    "E:\王健俊\文档\",
    "E:\王健俊\下载\",
    "E:\王健俊\Videos\"
)

$totalFound = 0

foreach ($basePath in $userPaths) {
    if (-not (Test-Path $basePath)) {
        continue
    }

    Write-Host "Scanning: $basePath" -ForegroundColor Cyan

    $files = Get-ChildItem -Path $basePath -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object {
            $_.LastAccessTime -lt $date -and
            $_.Length -gt ($sizeMB * 1MB)
        } |
        Sort-Object Length -Descending |
        Select-Object -First 20

    if ($files.Count -eq 0) {
        Write-Host "No large files found`n" -ForegroundColor Green
        continue
    }

    $i = 1
    foreach ($file in $files) {
        $mb = [math]::Round($file.Length / 1MB, 2)
        $daysAgo = [math]::Round(((Get-Date) - $file.LastAccessTime).TotalDays, 0)
        $ext = if ($file.Extension) { $file.Extension } else { "(no ext)" }
        $fileName = Split-Path $file.FullName -Leaf

        Write-Host "$i. $fileName" -ForegroundColor White
        Write-Host "   Size: $mb MB | Type: $ext | $daysAgo days ago" -ForegroundColor Gray
        Write-Host "   Path: $($file.FullName)" -ForegroundColor DarkGray
        Write-Host ""

        $i++
        $totalFound++
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Total files found: $totalFound" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
