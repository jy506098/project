# -*- coding: utf-8 -*-
"""
PyInstaller 入口：根据 sys.argv 决定启动 GUI 还是后端。

- 无 --backend: 启动桌面窗口（来自 desktop.main）
- 有 --backend: 启动 Flask + gevent WSGI 服务器（来自 app.py）

这样同一个 exe 既是 GUI 又是后端，desktop.py 用
`subprocess.Popen([sys.executable, '--backend'])` 启动后端，
规避 PyInstaller bootloader 忽略脚本路径的限制。
"""

import os
import sys


def _base_dir() -> str:
    """冻结后 _MEIPASS，开发模式 __file__ 所在目录。"""
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS  # type: ignore[attr-defined]
    return os.path.dirname(os.path.abspath(__file__))


def _run_backend():
    """后端模式：直接复用 app 模块的 Flask 实例和 snake_server，启动 gevent WSGI。

    不通过 runpy 跑 app.py 的 __main__ 块，因为：
    - 冻结后 app.py 不在文件系统，runpy 找不到
    - runpy 执行会再次 import 整个 app 模块，触发重复 monkey patch

    改为：复用已经在内存中的 app 模块（PyInstaller 入口加载时已 import），
    镜像 app.py 的 __main__ 块逻辑。
    """
    # gevent monkey patch：冻结时 runtime_hook 已打过；开发模式补一次
    if not getattr(sys, 'frozen', False):
        from gevent import monkey
        monkey.patch_all(thread=False, subprocess=False)

    # 复用已加载的 app 模块
    import app as _app_mod  # noqa: F401  (PyInstaller 已把它分析进来)

    if _app_mod.GEVENT_AVAILABLE:
        from gevent import pywsgi
        try:
            from geventwebsocket.handler import WebSocketHandler
        except ImportError:
            WebSocketHandler = None
            print("⚠️  未安装 gevent-websocket，贪吃蛇联机不可用 (仅 HTTP)")
        try:
            import snake_server as _snake_mod
        except Exception as e:
            _snake_mod = None
            print(f"⚠️  加载 snake_server 失败: {e} (贪吃蛇联机不可用)")

        handler_class = WebSocketHandler if (WebSocketHandler and _snake_mod) else None
        http_server = pywsgi.WSGIServer(
            ('0.0.0.0', 5000), _app_mod.app, log=None, error_log=None,
            handler_class=handler_class,
        )
        if _snake_mod and handler_class:
            try:
                _snake_mod.mount_into_wsgi_server(http_server, path='/snake_ws')
            except Exception as e:
                print(f"⚠️  挂载 snake_ws 失败: {e}")
        print("=" * 50)
        print("[首页  ]       http://127.0.0.1:5000/")
        print("[贪吃蛇联机]   ws://127.0.0.1:5000/snake_ws")
        print("=" * 50)
        http_server.serve_forever()
    else:
        print("[警告] gevent 未安装，仅启动 Flask (贪吃蛇联机不可用)")
        _app_mod.app.run(debug=True, host='0.0.0.0', port=5000)


def _run_gui():
    """GUI 模式：直接复用 desktop.main。"""
    sys.path.insert(0, _base_dir())
    from desktop import main
    main()


def main():
    # 把我们的 --backend flag 剥掉，避免 Flask/其它库看到
    if '--backend' in sys.argv:
        sys.argv = [sys.argv[0]] + [a for a in sys.argv[1:] if a != '--backend']
        _run_backend()
    else:
        _run_gui()


if __name__ == "__main__":
    main()
