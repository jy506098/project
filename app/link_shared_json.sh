#!/usr/bin/env bash
# 在 app/ 下创建硬链接，让 app/users.json / app/messages.json 指向 website/ 的同一份文件
# 这样桌面壳和 website 后端共享一份用户和留言数据
#
# 如果以后想独立运行 app/（不共享 website 数据），删掉这两个链接即可：
#     rm app/users.json app/messages.json
# 之后 app/ 会从空 {} 开始自己的数据。
#
# Linux/macOS 上 ln 没有内建 NTFS 硬链接语义，跨平台请用此脚本的等价 ln 命令：
#     ln -f ../website/users.json users.json
#     ln -f ../website/messages.json messages.json

set -e
cd "$(dirname "$0")"

if [ ! -f ../website/users.json ]; then
    echo "[错误] ../website/users.json 不存在，请先跑过一次 website/app.py 让它自动生成"
    exit 1
fi

if [ -e users.json ] && [ ! -L users.json ]; then
    # 已存在且不是符号链接 —— 假定是硬链接或普通文件，跳过
    echo "[跳过] users.json 已存在"
else
    ln -f ../website/users.json users.json
    echo "[OK] 已创建 users.json -> ../website/users.json"
fi

if [ -e messages.json ] && [ ! -L messages.json ]; then
    echo "[跳过] messages.json 已存在"
else
    ln -f ../website/messages.json messages.json
    echo "[OK] 已创建 messages.json -> ../website/messages.json"
fi

echo
echo "完成。app/ 与 website/ 现在共享同一份 users.json / messages.json。"
