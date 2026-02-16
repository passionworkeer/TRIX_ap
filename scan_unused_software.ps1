# Scan for unused software applications
$daysUnused = 365
$cutoffDate = (Get-Date).AddDays(-$daysUnused)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Scanning for Unused Software" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Programs not used in $daysUnused+ days" -ForegroundColor Gray
Write-Host "Cutoff date: $($cutoffDate.ToString('yyyy-MM-dd'))" -ForegroundColor Gray
Write-Host ""

# Common software locations
$softwarePaths = @(
    "C:\Program Files\",
    "C:\Program Files (x86)\",
    "D:\Program Files\",
    "D:\Program Files (x86)\",
    "E:\Program Files\",
    "E:\Program Files (x86)\",
    "D:\",
    "E:\"
)

$excludeFolders = @(
    'Windows',
    'WindowsApps',
    '$Recycle.Bin',
    'System Volume Information',
    'Microsoft',
    'Intel',
    'NVIDIA Corporation',
    'Common Files',
    'Internet Explorer',
    'Windows NT',
    'Reference Assemblies',
    'MSBuild',
    'dotnet',
    'Package Management',
    'ModifiableWindowsApps'
)

$results = @()

foreach ($basePath in $softwarePaths) {
    if (-not (Test-Path $basePath)) {
        continue
    }

    Write-Host "Scanning: $basePath" -ForegroundColor Cyan

    try {
        $folders = Get-ChildItem -Path $basePath -Directory -ErrorAction SilentlyContinue |
            Where-Object {
                -not ($excludeFolders -contains $_.Name)
            }

        foreach ($folder in $folders) {
            # Look for main executable files
            $exeFiles = Get-ChildItem -Path $folder.FullName -Recurse -Filter "*.exe" -ErrorAction SilentlyContinue |
                Where-Object {
                    $_.Name -notmatch "unins|uninstall|setup|install|update|launcher|crashreport|helper" -and
                    $_.Length -gt 1MB
                } |
                Sort-Object Length -Descending |
                Select-Object -First 1

            if ($exeFiles) {
                $mainExe = $exeFiles[0]
                $lastAccess = $mainExe.LastAccessTime

                if ($lastAccess -lt $cutoffDate) {
                    $daysSinceAccess = [math]::Round(((Get-Date) - $lastAccess).TotalDays, 0)
                    $folderSize = (Get-ChildItem -Path $folder.FullName -Recurse -File -ErrorAction SilentlyContinue |
                        Measure-Object -Property Length -Sum).Sum

                    if ($folderSize -gt 50MB) {
                        $results += @{
                            Name = $folder.Name
                            Path = $folder.FullName
                            MainExe = $mainExe.Name
                            LastAccess = $lastAccess
                            DaysSince = $daysSinceAccess
                            Size = [math]::Round($folderSize / 1MB, 2)
                            SizeMB = $folderSize
                        }
                    }
                }
            }
        }
    }
    catch {
        Write-Host "Error scanning $basePath`: $_" -ForegroundColor Red
    }
}

# Sort by size and display
$results = $results | Sort-Object SizeMB -Descending

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "UNUSED SOFTWARE FOUND" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

if ($results.Count -eq 0) {
    Write-Host "No unused software found!" -ForegroundColor Green
}
else {
    $totalSize = 0
    $i = 1

    foreach ($app in $results) {
        $totalSize += $app.SizeMB

        Write-Host "$i. " -NoNewline
        Write-Host "$($app.Name)" -ForegroundColor Yellow
        Write-Host "   Size: " -NoNewline
        Write-Host "$($app.Size) MB" -ForegroundColor White
        Write-Host "   Main exe: $($app.MainExe)" -ForegroundColor Gray
        Write-Host "   Last used: $($app.LastAccess.ToString('yyyy-MM-dd')) ($($app.DaysSince) days ago)" -ForegroundColor Red
        Write-Host "   Path: $($app.Path)`n" -ForegroundColor DarkGray

        $i++

        if ($i -gt 50) {
            Write-Host "... and more programs`n" -ForegroundColor Gray
            break
        }
    }

    $totalGB = [math]::Round($totalSize / 1024, 2)
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Total: $($results.Count) unused programs" -ForegroundColor Yellow
    Write-Host "Total size: $([math]::Round($totalSize, 2)) MB ($totalGB GB)" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
}

Write-Host "`nScan complete!" -ForegroundColor Green
