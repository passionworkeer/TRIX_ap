<#
  collect_tests.ps1
  - 在仓库根创建 tests/ 目录
  - 查找文件名中包含 "test" 或以 "test"/"spec" 为标识的文件并复制到 tests/
  - 为安全起见采用复制而非移动，避免破坏现有运行文件
#>

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root

$testsDir = Join-Path $root 'tests'
if (-not (Test-Path $testsDir)) { New-Item -ItemType Directory -Path $testsDir | Out-Null }

Write-Host "Searching for files with 'test' or 'spec' in file name (excluding common vendor dirs)..."

# 更保守的搜索：排除 node_modules、.venv、.git、docs、tests、TRIX_ap、database 等目录
$found = Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
        ($_.Name -match '(?i)test|(?i)spec') -and
        ($_.FullName -notmatch '\\node_modules\\|\\.venv\\|\\.git\\|\\\bdocs\\\b|\\\btests\\\b|\\TRIX_ap\\|\\database\\')
    } | Select-Object -Unique
if ($found.Count -eq 0) {
    Write-Host "No test-like files found."
    exit 0
}

foreach ($f in $found) {
    $dest = Join-Path $testsDir ($f.Name)
    Copy-Item -Path $f.FullName -Destination $dest -Force
    Write-Host "Copied: $($f.FullName) -> tests/$($f.Name)"
}

Write-Host "Done. Review files in 'tests/'." 