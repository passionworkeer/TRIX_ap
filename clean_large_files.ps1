$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Cleaning Large Files" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$deletedSize = 0
$deletedCount = 0

function Remove-File {
    param([string]$Path, [string]$Description)

    if (Test-Path $Path) {
        $size = (Get-Item $Path -ErrorAction SilentlyContinue).Length
        Write-Host "Deleting: $Description" -ForegroundColor Yellow
        Write-Host "Path: $Path" -ForegroundColor Gray

        try {
            Remove-Item $Path -Force -Recurse -ErrorAction Stop
            Write-Host "Success!" -ForegroundColor Green
            if ($size) {
                $sizeMB = [math]::Round($size / 1MB, 2)
                Write-Host "Size: $sizeMB MB`n" -ForegroundColor Gray
                $script:deletedSize += $size
                $script:deletedCount++
            }
            else {
                Write-Host "Deleted`n" -ForegroundColor Gray
                $script:deletedCount++
            }
        }
        catch {
            Write-Host "Failed: $_`n" -ForegroundColor Red
        }
    }
    else {
        Write-Host "Not found: $Path`n" -ForegroundColor Gray
    }
}

Write-Host "`n=== 1. Machine Learning Models ===" -ForegroundColor Cyan
Remove-File -Path "E:\王健俊\文档\统计建模\chinese-bert-wwm-ext\pytorch_model.bin" -Desc "BERT model (392 MB)"
Remove-File -Path "E:\王健俊\文档\统计建模\tp_berta_model.pth" -Desc "Berta model 1 (390 MB)"
Remove-File -Path "E:\王健俊\文档\统计建模\xiaofeizhe_tp_berta_model.pth" -Desc "Berta model 2 (390 MB)"
Remove-File -Path "E:\王健俊\文档\统计建模\chinese-bert-wwm-ext\flax_model.msgpack" -Desc "Flax model (390 MB)"

Write-Host "`n=== 2. Installers & Archives ===" -ForegroundColor Cyan
Remove-File -Path "E:\王健俊\下载\ZWCAD_2025_1.2_Chs_Win_64bit.exe" -Desc "ZWCAD installer (521 MB)"
Remove-File -Path "E:\王健俊\下载\数学建模实验B1题1套文件.zip" -Desc "Math modeling B1 (155 MB)"
Remove-File -Path "E:\王健俊\文档\个人资料\9月.rar" -Desc "Archive (157 MB)"
Remove-File -Path "E:\王健俊\下载\数学实验B2.rar" -Desc "Math experiment B2 (127 MB)"
Remove-File -Path "E:\王健俊\Documents\苹果ios系统大包保姆级安装教程.zip" -Desc "iOS tutorial (128 MB)"

Write-Host "`n=== 3. Old DLL Files ===" -ForegroundColor Cyan
Remove-File -Path "D:\Drivers\NVIDIA_GFE\GFExperience\libcef.dll" -Desc "NVIDIA GFE DLL (106 MB)"
Remove-File -Path "D:\Drivers\NVIDIA_VGA\Display.Driver\nvoptix.dl_" -Desc "NVIDIA VGA driver (126 MB)"
Remove-File -Path "D:\Drivers\Intel_VGA\Source\Graphic\opencl-clang64.dll" -Desc "Intel VGA driver (79 MB)"

Write-Host "`n=== 4. Application Temp Files ===" -ForegroundColor Cyan
Remove-File -Path "D:\Users\王健俊\AppData\Local\SquirrelTemp\tempb" -Desc "KOOK temp files (130 MB)"
Remove-File -Path "D:\Program Files (x86)\Netease\MailMaster\Application\5.1.3.1014\libcef.dll" -Desc "Old MailMaster DLL (114 MB)"

Write-Host "`n=== 5. Large Document ===" -ForegroundColor Cyan
Remove-File -Path "E:\王健俊\文档\竞赛模板\建模24\E题\题目2.csv" -Desc "CSV data file (467 MB)"

Write-Host "`n=== 6. Kimi AI Runtime ===" -ForegroundColor Cyan
Remove-File -Path "E:\Kimi 智能助手\runtime\lib\modules" -Desc "Kimi runtime modules (119 MB)"

Write-Host "`n=== 7. Large PPT ===" -ForegroundColor Cyan
Remove-File -Path "E:\王健俊\文档\个人资料\我的生日4人聚会图片(1).pptx" -Desc "Birthday PPT (205 MB)"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Cleanup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Files deleted: $deletedCount" -ForegroundColor Yellow
$totalMB = [math]::Round($deletedSize / 1MB, 2)
$totalGB = [math]::Round($deletedSize / 1GB, 2)
Write-Host "Space freed: $totalMB MB ($totalGB GB)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
