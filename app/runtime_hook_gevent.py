# -*- coding: utf-8 -*-
"""
PyInstaller runtime hook：在任何用户代码导入前先打 gevent monkey patch。

PyInstaller 通过 spec 文件的 `runtime_hooks` 字段加载此文件，
它在 bootloader 之后、用户脚本之前执行。
"""

import os

# 避免 gevent 在冻结环境下卡 DNS 解析
os.environ.setdefault('GEVENT_NOWAITDN', '1')
# 让 stdout 在冻结的窗口模式下也能立即 flush
os.environ.setdefault('PYTHONUNBUFFERED', '1')

from gevent import monkey
# subprocess=False 是关键：让 native subprocess 正常工作，
# 否则 gevent 的 libev child watcher 会在冻结 exe 下卡死
monkey.patch_all(thread=False, subprocess=False)
