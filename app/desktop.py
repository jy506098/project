# -*- coding: utf-8 -*-
"""
桌面壳启动器：用 subprocess 跑现有 app.py（它自带 gevent + WebSocket 处理），
pywebview 父进程只负责开原生窗口加载 http://127.0.0.1:<port>/。

为什么用子进程而不是同进程 + 线程：
gevent.monkey.patch_all() 会接管主线程 hub；当 pywebview 的 webview.start()
阻塞主线程跑 Win32 消息循环时，gevent hub 无法在子线程里独立调度，导致
HTTP/WebSocket 请求挂死。把后端放进独立子进程，让 gevent 自己跑自己的主线程，
父进程专做 GUI，两边互不干扰。

启动方式：
    python desktop.py
或者：
    desktop_launcher.bat   (Windows)
    ./desktop_launcher.sh  (Unix)
"""

import os
import sys
import time
import socket
import signal
import logging
import subprocess
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [desktop] %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger('desktop')

_HERE = Path(__file__).resolve().parent
APP_PY = _HERE / 'app.py'

# 默认端口：app.py 硬编码 5000。如果被占用就递增尝试。
DEFAULT_PORT = 5000


def _require_webview():
    """友好地导入 pywebview，缺包时给出可执行的修复提示。"""
    try:
        import webview  # noqa: F401
        return webview
    except ImportError:
        sys.exit(
            "[desktop] 缺少 pywebview，无法启动桌面壳。\n"
            "        请运行：pip install -r requirements.txt"
        )


def _port_is_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(('127.0.0.1', port))
            return True
        except OSError:
            return False


def _pick_port() -> int:
    """优先用 5000；被占用就从 5000 起递增找一个空位（最多 20 个）。"""
    for offset in range(20):
        p = DEFAULT_PORT + offset
        if _port_is_free(p):
            return p
    sys.exit(f"[desktop] 在 {DEFAULT_PORT}-{DEFAULT_PORT + 19} 范围内找不到空闲端口")


def _wait_for_server(port: int, timeout: float = 15.0) -> bool:
    """轮询直到端口接受 TCP 连接或超时。"""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(('127.0.0.1', port), timeout=0.5):
                return True
        except OSError:
            time.sleep(0.2)
    return False


def _start_backend(port: int) -> subprocess.Popen:
    """用 subprocess 跑 app.py，通过命令行参数让它监听指定端口。

    注意：app.py 当前硬编码 5000，所以这里我们不传 port——而是 _pick_port
    确保拿到 5000。如果未来 app.py 支持端口参数，只需在这里传进去。
    """
    python = sys.executable
    log.info(f"启动后端: {python} {APP_PY} (port={port})")
    # CREATE_NEW_PROCESS_GROUP 让父进程能用 terminate() 干净杀掉
    creationflags = 0
    if os.name == 'nt':
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP

    proc = subprocess.Popen(
        [python, str(APP_PY)],
        cwd=str(_HERE),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=1,
        text=True,
        creationflags=creationflags,
    )
    return proc


def _stop_backend(proc: subprocess.Popen):
    """优先优雅结束，超时再强杀。"""
    if proc.poll() is not None:
        return
    log.info("停止后端进程...")
    try:
        if os.name == 'nt':
            proc.send_signal(signal.CTRL_BREAK_EVENT)
        else:
            proc.terminate()
        try:
            proc.wait(timeout=5)
            log.info("后端已退出")
            return
        except subprocess.TimeoutExpired:
            log.warning("后端 5s 内未退出，强杀")
    except Exception as e:
        log.warning(f"优雅结束失败: {e}")
    try:
        proc.kill()
        proc.wait(timeout=3)
        log.info("后端已被强杀")
    except Exception as e:
        log.warning(f"强杀失败: {e}")


def _on_window_closing(proc: subprocess.Popen):
    """pywebview 关闭事件：关掉后端子进程。"""
    _stop_backend(proc)
    return True  # 允许窗口关闭


def main():
    webview = _require_webview()

    port = _pick_port()
    proc = _start_backend(port)

    try:
        if not _wait_for_server(port, timeout=15):
            log.error(f"后端在 15s 内未开始监听端口 {port}")
            # 打印后端输出帮助诊断
            try:
                out, _ = proc.communicate(timeout=2)
                if out:
                    log.error(f"后端输出:\n{out}")
            except Exception:
                pass
            _stop_backend(proc)
            sys.exit(1)

        # 再等一下确保 Flask 路由全部注册
        time.sleep(0.5)

        url = f"http://127.0.0.1:{port}/"
        log.info(f"打开窗口: {url}")

        window = webview.create_window(
            title="留言板 + 贪吃蛇联机",
            url=url,
            width=1280,
            height=820,
            min_size=(900, 600),
            resizable=True,
            text_select=True,
            confirm_close=False,
        )
        # 用闭包把 proc 传进去
        window.events.closing += lambda: _on_window_closing(proc)

        webview.start()
    finally:
        # 双保险：窗口退出后确保后端也被关掉
        _stop_backend(proc)


if __name__ == "__main__":
    main()
