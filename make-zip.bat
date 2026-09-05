@echo off
echo 打包 ZIP 安装包...
cd /d "%~dp0"

if not exist "dist" (
    echo 请先运行 build.bat 生成 EXE
    pause
    exit /b 1
)

powershell -Command "Compress-Archive -Path 'dist\XQQClash*Setup.exe' -DestinationPath 'XQQClash-Setup.zip' -Force"
if exist "XQQClash-Setup.zip" (
    echo ZIP 已生成: XQQClash-Setup.zip
) else (
    echo ZIP 生成失败
)
pause
