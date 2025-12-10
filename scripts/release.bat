@echo off
REM Windows 批处理脚本 - 快速发布
REM 自动使用 PowerShell 脚本

setlocal

REM 检查 PowerShell 是否可用
where powershell >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PowerShell 未安装
    exit /b 1
)

REM 切换到脚本目录
cd /d "%~dp0"

REM 运行 PowerShell 脚本
powershell -ExecutionPolicy Bypass -File "%~dp0release.ps1" %*

endlocal

