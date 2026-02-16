# Find large directories
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Scanning Large Directories" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$paths = @(
    "D:\",
    "E:\"
)

$excludeDirs = @(
    'Windows',
    'Program Files',
    'Program Files (x86)',
    '$Recycle.Bin',
    'System Volume Information'
)

foreach ($basePath in $paths) {
    Write-Host "`n=== Scanning $basePath ===" -ForegroundColor Cyan

    try {
        $folders = Get-ChildItem -Path $basePath -Directory -ErrorAction SilentlyContinue |
            Where-Object {
                -not ($excludeDirs -contains $_.Name)
            }

        $results = @()

        foreach ($folder in $folders) {
            $size = (Get-ChildItem -Path $folder.FullName -Recurse -File -ErrorAction SilentlyContinue |
                Measure-Object -Property Length -Sum).Sum

            if ($size -gt 500MB) {
                $sizeGB = [math]::Round($size / 1GB, 2)
                $results += @{
                    Name = $folder.Name
                    Path = $folder.FullName
                    SizeGB = $sizeGB
                    Size = $size
                }
            }
        }

        $results = $results | Sort-Object Size -Descending

        if ($results.Count -eq 0) {
            Write-Host "No large folders found" -ForegroundColor Green
            continue
        }

        $i = 1
        foreach ($result in $results) {
            Write-Host "$i. " -NoNewline
            Write-Host "$($result.Name)" -ForegroundColor Yellow
            Write-Host "   Size: $($result.SizeGB) GB" -ForegroundColor White
            Write-Host "   Path: $($result.Path)`n" -ForegroundColor Gray

            $i++

            if ($i -gt 15) {
                Write-Host "... more folders`n" -ForegroundColor Gray
                break
            }
        }

        $totalGB = [math]::Round(($results | Measure-Object -Property Size -Sum).Sum / 1GB, 2)
        Write-Host "Total: $($results.Count) folders, $totalGB GB`n" -ForegroundColor DarkCyan
    }
    catch {
        Write-Host "Error: $_`n" -ForegroundColor Red
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Scan Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
