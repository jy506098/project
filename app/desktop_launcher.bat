@echo off
chcp 65001 > nul
REM Windows 桌面壳一键启动脚本
cd /d "%~dp0"

echo ==============================================
echo   留言板 + 贪吃蛇联机  桌面版启动器
echo ==============================================
echo.

REM 检查 Python
where python >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Python，请先安装 Python 3.8+
    pause
    exit /b 1
)

REM 检查依赖（flask/gevent/geventwebsocket 用于后端，pywebview 用于窗口壳）
echo [1/3] 检查依赖...
python -c "import flask, gevent, geventwebsocket, webview" >nul 2>nul
if errorlevel 1 (
    echo [2/3] 安装依赖...
    python -m pip install -r requirements.txt
    if errorlevel 1 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo [2/3] 依赖已安装，跳过
)

echo [3/3] 启动桌面窗口...
echo.
echo 提示：
echo   - 关闭窗口即可同时退出后端进程
echo   - 如不想显示控制台，可改用 pythonw.exe
echo   - 共享数据：app/ 与 website/ 共享同一份 users.json / messages.json
echo.

REM 如果 users.json / messages.json 还没建立硬链接，先建上
if not exist "users.json" if exist "..\website\users.json" (
    mklink /H "users.json" "..\website\users.json" >nul 2>nul
)
if not exist "messages.json" if exist "..\website\messages.json" (
    mklink /H "messages.json" "..\website\messages.json" >nul 2>nul
)

python desktop.py

pause
