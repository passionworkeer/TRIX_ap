<#
  organize_docs.ps1
  - 将仓库根目录下的大部分 Markdown 文件归档到 docs/ 目录
  - 不会移动 `README.md`、`TRIX_ap/` 子项目或 `database/` 目录下的文件
  - 脚本默认进行复制（非移动），以便安全回滚；可改为 Move-Item 来真正移动
#>

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root

$docsDir = Join-Path $root 'docs'
if (-not (Test-Path $docsDir)) { New-Item -ItemType Directory -Path $docsDir | Out-Null }

# 收集根目录下的 .md 文件（不包含 README.md）
$mdFiles = Get-ChildItem -Path $root -Filter '*.md' -File | Where-Object { $_.Name -ne 'README.md' }

if ($mdFiles.Count -eq 0) {
    Write-Host "No top-level .md files to copy."
    exit 0
}

Write-Host "Found $($mdFiles.Count) top-level .md files. Copying to docs/ (preserve originals)..."

foreach ($f in $mdFiles) {
    $dest = Join-Path $docsDir $f.Name
    Copy-Item -Path $f.FullName -Destination $dest -Force
    Write-Host "Copied: $($f.Name) -> docs/"
}

Write-Host "Done. Review files in 'docs/'. If you want to move instead of copy, run Move-Item manually or edit this script." 