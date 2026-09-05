@echo off
echo ========================================
echo   XQQ Clash - 打包工具
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] 安装依赖...
call npm install
if errorlevel 1 (
    echo 依赖安装失败！
    pause
    exit /b 1
)

echo.
echo [2/3] 打包 EXE (便携版 + 安装版)...
call npx electron-builder --win
if errorlevel 1 (
    echo 打包失败！
    pause
    exit /b 1
)

echo.
echo [3/3] 完成！
echo 输出目录: dist\
dir /b dist\*.exe 2>nul
echo.
pause
