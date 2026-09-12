#!/usr/bin/env bash
# Linux/macOS 桌面壳一键启动脚本
set -e
cd "$(dirname "$0")"

echo "=============================================="
echo "  留言板 + 贪吃蛇联机  桌面版启动器 (Unix)"
echo "=============================================="
echo

# 检查 Python
if ! command -v python3 >/dev/null 2>&1; then
    echo "[错误] 未检测到 python3，请先安装 Python 3.8+"
    exit 1
fi

echo "[1/3] 检查依赖..."
if ! python3 -c "import flask, gevent, geventwebsocket, webview" >/dev/null 2>&1; then
    echo "[2/3] 安装依赖..."
    python3 -m pip install -r requirements.txt
else
    echo "[2/3] 依赖已安装，跳过"
fi

echo "[3/3] 启动桌面窗口..."
echo
echo "提示：关闭窗口即可同时退出后端进程"
echo

python3 desktop.py
