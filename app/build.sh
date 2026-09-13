#!/usr/bin/env bash
# Unix 一键打包脚本：生成 dist/MyApp/ 目录
set -e
cd "$(dirname "$0")"

echo "=============================================="
echo "  MyApp 桌面壳打包 (PyInstaller --onedir)"
echo "=============================================="
echo

# 选 Python
if [ -x ../.venv/bin/python ]; then
    PYEXE="../.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
    PYEXE=python3
else
    echo "[错误] 未检测到 Python"
    exit 1
fi

echo "[1/4] 检查依赖..."
if ! $PYEXE -c "import flask, gevent, geventwebsocket, webview, PyInstaller" >/dev/null 2>&1; then
    echo "[2/4] 安装缺失依赖..."
    $PYEXE -m pip install -r requirements.txt
    $PYEXE -m pip install pyinstaller
fi

rm -rf build dist MyApp.spec

echo "[3/4] PyInstaller 打包中..."
$PYEXE -m PyInstaller build.spec

echo
echo "[4/4] 完成！"
echo
echo "输出文件: dist/MyApp.exe"
echo "启动 GUI:  dist/MyApp.exe"
echo "仅后端:    dist/MyApp.exe --backend"
