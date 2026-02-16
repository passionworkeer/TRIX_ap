$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deep Cleaning - Phase 2" -ForegroundColor Cyan
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
                Write-Host "Deleted (folder)`n" -ForegroundColor Gray
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

Write-Host "`n=== 1. Duplicate Installers ===" -ForegroundColor Cyan
Remove-File -Path "D:\Users\王健俊\Desktop\me\ZWCADPJ\ZWCAD_2025_1.2_Chs_Win_64bit.exe" -Desc "ZWCAD installer (D drive)"
Remove-File -Path "E:\王健俊\下载\ZWCAD_2025_1.2_Chs_Win_64bit.exe" -Desc "ZWCAD installer (E drive)"
Remove-File -Path "E:\Program Files (x86)\WeGameInstaller\WeGameSetup5.3.2.5230_launcher_0_0.exe" -Desc "WeGame installer"
Remove-File -Path "D:\LeStoreDownload\4221-2025-04-22105343-1745290423265.msi" -Desc "LeStore installer"

Write-Host "`n=== 2. ML Model Files ===" -ForegroundColor Cyan
Remove-File -Path "E:\王健俊\文档\统计建模\chinese-bert-wwm-ext\pytorch_model.bin" -Desc "BERT model (392 MB)"
Remove-File -Path "E:\王健俊\文档\统计建模\tp_berta_model.pth" -Desc "Berta model (390 MB)"
Remove-File -Path "E:\王健俊\文档\统计建模\xiaofeizhe_tp_berta_model.pth" -Desc "Consumer Berta model (390 MB)"
Remove-File -Path "E:\王健俊\文档\统计建模\chinese-bert-wwm-ext\flax_model.msgpack" -Desc "Flax model (390 MB)"

Write-Host "`n=== 3. Remaining Game Files ===" -ForegroundColor Cyan
Remove-File -Path "E:\steam\steamapps\common\Counter-Strike Global Offensive\csgo\maps\vmodel_x04.bsp" -Desc "CS:GO vmodel_x04 map"
Remove-File -Path "E:\steam\steamapps\common\Counter-Strike Global Offensive\csgo\maps\recoil_master.bsp" -Desc "CS:GO recoil_master map"
Remove-File -Path "E:\steam\steamapps\common\Dying Light\dumps" -Desc "Dying Light crash dumps"

Write-Host "`n=== 4. Game Audio & Workshop ===" -ForegroundColor Cyan
Remove-File -Path "E:\steam\steamapps\common\Terraria\Content\Wave Bank.xwb" -Desc "Terraria audio bank"
Remove-File -Path "E:\steam\steamapps\workshop\content\431960\2781366806\stars 60f_2.00x_3840x2160_prob-1.mp4" -Desc "Steam workshop video"
Remove-File -Path "E:\steam\steamapps\workshop\content\431960\2858284176\ingame.mp4" -Desc "Steam workshop video 2"

Write-Host "`n=== 5. Old Installers & Archives ===" -ForegroundColor Cyan
Remove-File -Path "E:\王健俊\文档\个人资料\9月.rar" -Desc "Archive (157 MB)"
Remove-File -Path "E:\王健俊\下载\数学建模实验B1题1套文件.zip" -Desc "Math modeling files (155 MB)"
Remove-File -Path "E:\王健俊\下载\数学实验B2.rar" -Desc "Math experiment B2 (127 MB)"
Remove-File -Path "E:\王健俊\Documents\苹果ios系统大包保姆级安装教程.zip" -Desc "iOS tutorial (128 MB)"
Remove-File -Path "E:\王健俊\Documents\植物大战僵尸杂交版v2.1安装教程及攻略.zip" -Desc "Plants vs Zombies tutorial (78 MB)"
Remove-File -Path "E:\王健俊\Documents\植物大战僵尸杂交版v2.1安装教程及攻略\植物大战僵尸杂交版v2.1\植物大战僵尸杂交版v2.1安装包.exe" -Desc "PvZ installer (74 MB)"

Write-Host "`n=== 6. Video Files ===" -ForegroundColor Cyan
Remove-File -Path "E:\王健俊\下载\WeChat_20241011181103.mp4" -Desc "WeChat video (95 MB)"
Remove-File -Path "E:\王健俊\Videos\屏幕录制\屏幕录制 2025-06-23 214434.mp4" -Desc "Screen recording 1 (97 MB)"
Remove-File -Path "E:\王健俊\Videos\屏幕录制\屏幕录制 2025-07-07 180416.mp4" -Desc "Screen recording 2 (41 MB)"
Remove-File -Path "E:\王健俊\Documents\补帧补充头部帅哥教程\进阶版V2.0补帧补充教程\Magpie补帧补充教程.mp4" -Desc "Magpie tutorial (63 MB)"
Remove-File -Path "E:\王健俊\Documents\补帧补充头部帅哥教程\进阶版V2.0未修改文件\PVZ植物大战僵尸僵尸进阶教程.mp4" -Desc "PvZ tutorial (61 MB)"

Write-Host "`n=== 7. Old Backup Files ===" -ForegroundColor Cyan
Remove-File -Path "E:\王健俊\Documents\修改版\虚空大剑修改.zip" -Desc "Void sword mod (54 MB)"
Remove-File -Path "E:\王健俊\文档\竞赛模板\apmcm24c\Capmcm24201894fj .zip" -Desc "APMCM files (31 MB)"
Remove-File -Path "E:\王健俊\文档\统计建模\数据集下载-TJJM20250310038171.zip" -Desc "Dataset (40 MB)"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Deletion Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Files deleted: $deletedCount" -ForegroundColor Yellow
$totalMB = [math]::Round($deletedSize / 1MB, 2)
$totalGB = [math]::Round($deletedSize / 1GB, 2)
Write-Host "Space freed: $totalMB MB ($totalGB GB)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
