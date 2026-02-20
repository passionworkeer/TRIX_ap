@echo off
setlocal enabledelayedexpansion

REM ============================================
REM 服务器配置
REM ============================================
set SERVER_HOST=TRIX_SERVER_HOST
set SERVER_USER=root
set SERVER_PATH=/opt/clawbot-channel

REM ============================================
REM 颜色输出
REM ============================================
set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "RESET=[0m"

echo %GREEN%━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%RESET%
echo %GREEN%🚀 Clawbot Channel 服务器更新工具%RESET%
echo %GREEN%━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%RESET%
echo.
echo 📡 服务器: %YELLOW%%SERVER_HOST%%RESET%
echo 👤 用户: %YELLOW%%SERVER_USER%%RESET%
echo 📁 路径: %YELLOW%%SERVER_PATH%%RESET%
echo.

REM ============================================
REM 步骤 1: 备份原文件
REM ============================================
echo %YELLOW%[1/5]%RESET% 备份原服务器文件...
scp %SERVER_USER%@%SERVER_HOST%:%SERVER_PATH%/server.js %SERVER_PATH%/server.js.backup
if errorlevel 1 (
    echo %RED%❌ 备份失败，请检查 SSH 连接%RESET%
    pause
    exit /b 1
)
echo %GREEN%✅ 备份完成%RESET%
echo.

REM ============================================
REM 步骤 2: 上传修复后的文件
REM ============================================
echo %YELLOW%[2/5]%RESET% 上传修复后的 server.js...
scp server/clawbot-channel/server.js %SERVER_USER%@%SERVER_HOST%:%SERVER_PATH%/server.js
if errorlevel 1 (
    echo %RED%❌ 上传失败%RESET%
    pause
    exit /b 1
)
echo %GREEN%✅ 上传完成%RESET%
echo.

REM ============================================
REM 步骤 3: 重启服务
REM ============================================
echo %YELLOW%[3/5]%RESET% 重启 clawbot-channel 服务...
ssh %SERVER_USER%@%SERVER_HOST% "cd %SERVER_PATH% && pm2 restart clawbot-channel"
if errorlevel 1 (
    echo %RED%❌ 重启失败%RESET%
    pause
    exit /b 1
)
echo %GREEN%✅ 服务已重启%RESET%
echo.

REM ============================================
REM 步骤 4: 验证服务状态
REM ============================================
echo %YELLOW%[4/5]%RESET% 检查服务状态...
ssh %SERVER_USER%@%SERVER_HOST% "pm2 status clawbot-channel"
echo.

REM ============================================
REM 步骤 5: 查看日志
REM ============================================
echo %YELLOW%[5/5]%RESET% 查看最新日志...
ssh %SERVER_USER%@%SERVER_HOST% "pm2 logs clawbot-channel --lines 20 --nostream"
echo.

echo %GREEN%━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%RESET%
echo %GREEN%✅ 服务器更新完成！%RESET%
echo %GREEN%━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%RESET%
echo.
echo 📝 下一步：
echo    1. 测试配对功能: node openclaw-skills/pairing/test-pairing.js
echo    2. 在 OpenClaw 中生成配对码
echo    3. 在手机 App 中输入配对码
echo.

pause
