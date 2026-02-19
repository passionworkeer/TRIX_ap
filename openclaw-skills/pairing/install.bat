@echo off
REM ============================================================
REM OpenClaw Pairing Skill 安装脚本
REM ============================================================

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║     OpenClaw Pairing Skill - 安装程序                  ║
echo ╚════════════════════════════════════════════════════════╝
echo.

set SOURCE_DIR=e:\desktop\trix-3d-companion\openclaw-skills\pairing
set TARGET_DIR=C:\Users\wang\.openclaw\skills\pairing

echo [1/4] 检查源目录...
if not exist "%SOURCE_DIR%\index.js" (
    echo ❌ 错误: 源目录不存在
    echo 请确保文件位于: %SOURCE_DIR%
    pause
    exit /b 1
)
echo ✅ 源目录存在
echo.

echo [2/4] 创建目标目录...
if not exist "%TARGET_DIR%" (
    mkdir "%TARGET_DIR%"
    echo ✅ 目标目录已创建
) else (
    echo ✅ 目标目录已存在
)
echo.

echo [3/4] 复制文件...
copy /Y "%SOURCE_DIR%\package.json" "%TARGET_DIR%\\" >nul
copy /Y "%SOURCE_DIR%\index.js" "%TARGET_DIR%\\" >nul
copy /Y "%SOURCE_DIR%\README.md" "%TARGET_DIR%\\" >nul
echo ✅ 文件已复制
echo.

echo [4/4] 安装依赖...
cd /d "%TARGET_DIR%"
call npm install qrcode
if errorlevel 1 (
    echo ⚠️  npm install 失败，请手动执行:
    echo    cd %TARGET_DIR%
    echo    npm install
) else (
    echo ✅ 依赖安装完成
)
echo.

echo ╔════════════════════════════════════════════════════════╗
echo ║                  🎉 安装完成！                          ║
echo ╚════════════════════════════════════════════════════════╝
echo.
echo Skill已安装到: %TARGET_DIR%
echo.
echo 使用方法:
echo   在OpenClaw对话中输入 "生成配对码"
echo.
echo 下一步:
echo   1. 重启OpenClaw Gateway
echo   2. 在OpenClaw中输入 "生成配对码"
echo   3. 在手机App中输入配对码
echo.
pause
