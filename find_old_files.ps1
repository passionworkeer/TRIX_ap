# Find old files - improved version
$daysInactive = 365
$minSizeMB = 50
$cutoffDate = (Get-Date).AddDays(-$daysInactive)

Write-Host "查找超过 $daysInactive 天未访问的大文件..." -ForegroundColor Cyan
Write-Host "最小文件大小: $minSizeMB MB"
Write-Host "截止日期: $cutoffDate"
Write-Host ""

function Find-OldFiles {
    param(
        [string]$DrivePath,
        [datetime]$CutoffDate,
        [long]$MinSizeBytes
    )

    $oldFiles = @()

    if (-not (Test-Path $DrivePath)) {
        Write-Host "驱动器 $DrivePath 未找到。" -ForegroundColor Yellow
        return $oldFiles
    }

    Write-Host "正在扫描 $DrivePath ..." -ForegroundColor Cyan

    try {
        # Get files with error handling
        $files = Get-ChildItem -Path $DrivePath -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object {
                $_.LastAccessTime -lt $CutoffDate -and
                $_.Length -gt $MinSizeBytes
            } |
            Sort-Object Length -Descending |
            Select-Object -First 50

        $oldFiles = $files
    }
    catch {
        Write-Host "扫描错误: $_" -ForegroundColor Red
    }

    return $oldFiles
}

# Scan drives
$drives = @(
    @{Path='C:\'; Name='C'},
    @{Path='D:\'; Name='D'},
    @{Path='E:\'; Name='E'}
)

$minSizeBytes = $minSizeMB * 1MB

foreach ($drive in $drives) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "扫描 $($drive.Name) 盘" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan

    $files = Find-OldFiles -DrivePath $drive.Path -CutoffDate $cutoffDate -MinSizeBytes $minSizeBytes

    if ($files.Count -eq 0) {
        Write-Host "未找到超过 $daysInactive 天未访问的大文件 (>$minSizeMB MB)" -ForegroundColor Green
        continue
    }

    Write-Host "找到 $($files.Count) 个文件:" -ForegroundColor Yellow
    Write-Host ""

    $totalSize = 0
    $i = 1

    foreach ($file in $files) {
        $sizeMB = [math]::Round($file.Length / 1MB, 2)
        $totalSize += $file.Length
        $daysSinceAccess = [math]::Round(((Get-Date) - $file.LastAccessTime).TotalDays, 0)
        $fileType = if ($file.Extension) { $file.Extension } else { "无扩展名" }

        Write-Host "$i. " -NoNewline
        Write-Host "$($file.FullName)" -ForegroundColor White
        Write-Host "   大小: " -NoNewline
        Write-Host "$sizeMB MB" -ForegroundColor Yellow
        Write-Host "   类型: " -NoNewline
        Write-Host "$fileType" -ForegroundColor Gray
        Write-Host "   最后访问: " -NoNewline
        Write-Host "$($file.LastAccessTime.ToString('yyyy-MM-dd'))" -ForegroundColor Gray
        Write-Host "   (" -NoNewline
        Write-Host "$daysSinceAccess 天前" -ForegroundColor Red
        Write-Host ")"
        Write-Host ""

        if ($i -ge 30) {
            Write-Host "仅显示前30个最大的文件..." -ForegroundColor Gray
            break
        }
        $i++
    }

    $totalSizeMB = [math]::Round($totalSize / 1MB, 2)
    $totalSizeGB = [math]::Round($totalSize / 1GB, 2)

    Write-Host "总大小: " -NoNewline
    Write-Host "$totalSizeMB MB ($totalSizeGB GB)" -ForegroundColor Yellow
}

Write-Host "`n扫描完成!" -ForegroundColor Green
