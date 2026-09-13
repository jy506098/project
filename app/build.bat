@echo off
chcp 65001 > nul
REM Windows 一键打包脚本：生成 dist\MyApp\ 目录
cd /d "%~dp0"

echo ==============================================
echo   MyApp 桌面壳打包 (PyInstaller --onedir)
echo ==============================================
echo.

REM 解析 Python：优先用同 venv 的 python
if exist "..\.venv\Scripts\python.exe" (
    set "PYEXE=..\.venv\Scripts\python.exe"
) else (
    where python >nul 2>nul
    if errorlevel 1 (
        echo [错误] 未检测到 Python
        pause & exit /b 1
    )
    set "PYEXE=python"
)

echo [1/4] 检查依赖...
%PYEXE% -c "import flask, gevent, geventwebsocket, webview, pyinstaller" >nul 2>nul
if errorlevel 1 (
    echo [2/4] 安装缺失依赖...
    %PYEXE% -m pip install -r requirements.txt
    if errorlevel 1 (
        echo [错误] 依赖安装失败
        pause & exit /b 1
    )
    %PYEXE% -m pip install pyinstaller
    if errorlevel 1 (
        echo [错误] PyInstaller 安装失败
        pause & exit /b 1
    )
) else (
    echo [2/4] 依赖已安装，跳过
)

REM 清理旧 build
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
if exist MyApp.spec del MyApp.spec >nul 2>nul

echo [3/4] PyInstaller 打包中（首次会慢，2-5 分钟）...
%PYEXE% -m PyInstaller build.spec
if errorlevel 1 (
    echo [错误] PyInstaller 打包失败
    pause & exit /b 1
)

echo.
echo [4/4] 完成！
echo.
echo 输出文件: dist\MyApp.exe
echo 启动 GUI:  直接双击 dist\MyApp.exe
echo 仅后端:    dist\MyApp.exe --backend
echo.
echo 把 dist\MyApp.exe 复制到任何 Windows 机器就能运行（需要装 WebView2 Runtime，Win11 自带）。
echo.

pause
