@echo off
chcp 65001 > nul
REM Windows 一键启动脚本
cd /d "%~dp0"

echo ==============================================
echo   留言板 + 贪吃蛇联机  启动脚本 (Windows)
echo ==============================================
echo.

REM 检查 Python
where python >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Python，请先安装 Python 3.8+
    pause
    exit /b 1
)

REM 检查依赖
echo [1/3] 检查依赖...
python -c "import flask, gevent, geventwebsocket" >nul 2>nul
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

echo [3/3] 启动服务...
echo.
echo 访问地址：
echo   留言板首页:  http://localhost:5000/
echo   贪吃蛇联机:  ws://localhost:5000/snake_ws
echo.
echo 按 Ctrl+C 停止服务
echo.

python app.py

pause