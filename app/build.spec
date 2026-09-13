# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for the desktop app.
# Build:  pyinstaller build.spec
#
# Output: dist/MyApp/MyApp.exe + sibling files (--onedir)
# Usage:  double-click dist/MyApp/MyApp.exe  → opens the GUI window
#         dist/MyApp/MyApp.exe --backend     → starts only the Flask backend
#         (the GUI binary spawns --backend internally)

import sys
from pathlib import Path

# Ensure PyInstaller can find packages
sys.path.insert(0, '.')

from PyInstaller.utils.hooks import collect_all

APP_DIR = Path('.').resolve()  # C:\Users\aa\Desktop\jyProject\project\app
PROJECT_DIR = APP_DIR.parent   # C:\Users\aa\Desktop\jyProject\project

block_cipher = None

# --- 收集所有 gevent / pywebview / pythonnet 的数据 + 二进制 + 隐藏 import ---
gevent_d, gevent_b, gevent_h = collect_all('gevent')
greenlet_d, greenlet_b, greenlet_h = collect_all('greenlet')
webview_d, webview_b, webview_h = collect_all('webview')
pynet_d, pynet_b, pynet_h = collect_all('pythonnet')
clrl_d, clrl_b, clrl_h = collect_all('clr_loader')

# --- 把 app/ 下的源码 + 资源也带进 dist ---
# 注意：app.py / snake_server.py 不要放 datas，PyInstaller 会自动分析入口的依赖。
# 只需要把 templates/、static/ 这类纯资源带进去；JSON 也带上作为初始数据。
app_datas = [
    (str(APP_DIR / 'requirements.txt'), '.'),
    (str(APP_DIR / 'users.json'), '.'),
    (str(APP_DIR / 'messages.json'), '.'),
    (str(APP_DIR / 'templates'), 'templates'),
    (str(APP_DIR / 'static'), 'static'),
]

a = Analysis(
    ['main.py'],
    pathex=[str(APP_DIR), str(PROJECT_DIR)],
    binaries=gevent_b + greenlet_b + webview_b + pynet_b + clrl_b,
    datas=gevent_d + greenlet_d + webview_d + pynet_d + clrl_d + app_datas,
    hiddenimports=(
        gevent_h + greenlet_h + webview_h + pynet_h + clrl_h
        # geventwebsocket 没有自带 hook，必须手动加
        + [
            'geventwebsocket',
            'geventwebsocket.handler',
            'geventwebsocket.websocket',
            'geventwebsocket.resource',
            'geventwebsocket.logging',
            # pywebview 跨平台 backend（即使只用 edgechromium 也要显式列）
            'webview.platforms.winforms',
            'webview.platforms.edgechromium',
            # app.py 的顶层 import
            'snake_server',
            # pythonnet / clr_loader
            'clr_loader',
            'pythonnet',
        ]
    ),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=['runtime_hook_gevent.py'],
    excludes=[
        'PyQt5', 'PyQt6', 'PySide2', 'PySide6',
        'gtk', 'gi', 'cairo', 'gobject',
        'cefpython3',
        'webview.platforms.cocoa', 'webview.platforms.gtk', 'webview.platforms.qt',
        'gevent.testing', 'gevent.tests',
        'tkinter', 'unittest', 'pytest',
        'IPython', 'jupyter', 'notebook',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='MyApp',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,                    # UPX 几乎必然触发 AV 误报
    console=True,                 # 保留 console 输出（调试方便）；正式发布可改 False
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)

# --onefile 模式：不要 COLLECT
# coll = COLLECT(...)
