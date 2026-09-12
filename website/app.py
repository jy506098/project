# -*- coding: utf-8 -*-
"""
留言板 Web 应用 (含贪吃蛇联机服务器)
Flask HTTP 应用 (端口 5000) + WebSocket 联机服务器 (端口 8080)
二者通过 gevent 在同一进程中并行运行。
"""
# gevent monkey 补丁必须在所有其他导入之前！
try:
    from gevent import monkey
    monkey.patch_all()
    GEVENT_AVAILABLE = True
except ImportError:
    GEVENT_AVAILABLE = False

from flask import Flask, render_template, request, redirect, session, url_for, jsonify, flash
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import random
import time
import re
import json
import os
import sys
import logging
import hashlib
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'  # 请修改为随机字符串

# 以本文文件所在目录为准，避免在不同 CWD 启动时找不到数据文件
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------- 头像上传配置 ----------
AVATAR_FOLDER = os.path.join(BASE_DIR, 'static', 'avatars')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
os.makedirs(AVATAR_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ---------- 数据持久化 ----------
MESSAGES_FILE = os.path.join(BASE_DIR, 'messages.json')
USERS_FILE = os.path.join(BASE_DIR, 'users.json')

def load_messages():
    if os.path.exists(MESSAGES_FILE):
        with open(MESSAGES_FILE, 'r', encoding='utf-8') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []
    return []

def save_messages(messages):
    with open(MESSAGES_FILE, 'w', encoding='utf-8') as f:
        json.dump(messages, f, ensure_ascii=False, indent=2)

messages = load_messages()

def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return {}
    return {}

def save_users(users):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

users = load_users()

# ---------- 数据迁移 ----------
need_save = False
for username, user_data in users.items():
    inventory = user_data.get('inventory', {})
    if '咖啡杯' in inventory:
        inventory['时钟'] = inventory.pop('咖啡杯')
        need_save = True
    unlocked = user_data.get('unlocked_content', [])
    if '咖啡杯' in unlocked:
        unlocked.remove('咖啡杯')
        if '时钟' not in unlocked:
            unlocked.append('时钟')
        need_save = True
if '顾璟瑶' in users:
    users['顾璟瑶']['is_admin'] = True
    need_save = True
if need_save:
    save_users(users)

# 初始化缺失字段（兼容旧用户）
for username, user_data in users.items():
    if 'tasks' not in user_data:
        user_data['tasks'] = {}
    if 'daily_tasks_completed' not in user_data:
        user_data['daily_tasks_completed'] = {}
    if 'daily_visit_count' not in user_data:
        user_data['daily_visit_count'] = 0
    if 'last_visit_date' not in user_data:
        user_data['last_visit_date'] = ''
    if 'last_post_date' not in user_data:
        user_data['last_post_date'] = ''
    if 'total_spent' not in user_data:
        user_data['total_spent'] = 0
    if 'unlocked_content' not in user_data:
        user_data['unlocked_content'] = []
    if 'effects' not in user_data:
        user_data['effects'] = {}
    if 'is_admin' not in user_data:
        user_data['is_admin'] = (username == "顾璟瑶")
    if 'admin_daily_points_date' not in user_data:
        user_data['admin_daily_points_date'] = ''
    if 'admin_daily_points_count' not in user_data:
        user_data['admin_daily_points_count'] = 0
    if 'mouse_effect_config' not in user_data:
        user_data['mouse_effect_config'] = {
            "enabled": True,
            "color_mode": "rainbow",
            "shape": "circle"
        }
    if 'avatar' not in user_data:
        user_data['avatar'] = "default:#3498db"
save_users(users)

sms_codes = {}

def is_valid_phone(phone):
    return bool(re.match(r'^1[3-9]\d{9}$', phone))

# ---------- 全局模板变量 ----------
@app.context_processor
def inject_common_vars():
    """为所有模板注入常用变量（如 has_cyber_tshirt）"""
    username = session.get('username')
    has_cyber_tshirt = False
    if username and username in users:
        has_cyber_tshirt = users[username].get('effects', {}).get('cyber_tshirt', False)
    return dict(has_cyber_tshirt=has_cyber_tshirt)

# ---------- 固定任务 ----------
FIXED_TASKS = [
    {"id": "post_message", "name": "首次留言", "desc": "在留言板发布消息", "reward": 20},
    {"id": "buy_item", "name": "首次购买", "desc": "在商店购买商品", "reward": 30},
    {"id": "use_item", "name": "首次使用物品", "desc": "在背包使用物品", "reward": 15},
    {"id": "spend_master", "name": "消费达人", "desc": "累计消费达到500积分", "reward": 50},
]

DAILY_TASK_POOL = [
    {"id": "daily_login", "name": "每日登录", "desc": "登录网站", "reward": 10},
    {"id": "daily_post", "name": "每日留言", "desc": "在留言板发布一条消息", "reward": 15},
    {"id": "daily_visit", "name": "每日浏览", "desc": "访问网站3个不同页面", "reward": 5},
    {"id": "daily_buy", "name": "每日购物", "desc": "在商店购买任意商品", "reward": 20},
    {"id": "daily_use", "name": "每日使用", "desc": "在背包使用任意物品", "reward": 18},
    {"id": "daily_share", "name": "每日分享", "desc": "分享网站链接（模拟）", "reward": 12},
]

def get_today_daily_tasks():
    today = datetime.now().strftime('%Y-%m-%d')
    random.seed(today)
    selected = random.sample(DAILY_TASK_POOL, 3)
    random.seed()
    return selected

def get_task_status(task_id, user, task_type='fixed'):
    today = datetime.now().strftime('%Y-%m-%d')
    if task_type == 'fixed':
        if task_id in user.get('tasks', {}) and user['tasks'][task_id].get('completed', False):
            return 'completed'
        else:
            return 'available'
    else:
        completed_dict = user.get('daily_tasks_completed', {})
        if completed_dict.get(task_id) == today:
            return 'completed'
        else:
            return 'available'

def auto_complete_task(username, task_id):
    if username not in users:
        return False
    user = users[username]

    fixed_task = next((t for t in FIXED_TASKS if t['id'] == task_id), None)
    if fixed_task:
        if get_task_status(task_id, user, 'fixed') == 'completed':
            return False
        user['tasks'][task_id] = {"completed": True, "last_date": datetime.now().strftime('%Y-%m-%d')}
        user['points'] = user.get('points', 0) + fixed_task['reward']
        save_users(users)
        return True

    daily_tasks = get_today_daily_tasks()
    daily_task = next((t for t in daily_tasks if t['id'] == task_id), None)
    if daily_task:
        if get_task_status(task_id, user, 'daily') == 'completed':
            return False
        if 'daily_tasks_completed' not in user:
            user['daily_tasks_completed'] = {}
        user['daily_tasks_completed'][task_id] = datetime.now().strftime('%Y-%m-%d')
        user['points'] = user.get('points', 0) + daily_task['reward']
        save_users(users)
        return True

    return False

# ---------- 管理员每日积分 ----------
def grant_admin_daily_points(username):
    if username not in users:
        return
    user = users[username]
    if not user.get('is_admin', False):
        return
    today = datetime.now().strftime('%Y-%m-%d')
    last_date = user.get('admin_daily_points_date', '')
    count = user.get('admin_daily_points_count', 0)

    if last_date != today:
        user['admin_daily_points_date'] = today
        user['admin_daily_points_count'] = 0
        count = 0
        save_users(users)

    if count < 2:
        user['points'] = user.get('points', 0) + 10000
        user['admin_daily_points_count'] = count + 1
        save_users(users)
        print(f"[管理员] {username} 获得每日 10000 积分奖励 (第{count+1}次)")

# ---------- 商品数据 ----------
ITEM_DATA = {
    "编程秘籍": {
        "price": 199,
        "base_use_reward": 50,
        "base_sell_reward": 99,
        "desc": "📖 学习编程秘籍，提升你的代码能力",
        "effect": "📖 解锁《编程思想》电子书，提升编程思维",
        "content_page": "programming_secrets.html"
    },
    "降噪耳机": {
        "price": 399,
        "base_use_reward": 100,
        "base_sell_reward": 199,
        "desc": "🎧 戴上降噪耳机，隔绝噪音，专注提升",
        "effect": "🎵 解锁降噪耳机，可播放白/粉红/棕噪声",
        "content_page": "headphones.html"
    },
    "C++ 入门": {
        "price": 599,
        "base_use_reward": 150,
        "base_sell_reward": 299,
        "desc": "⌨️ 从零开始学习 C++，掌握编程核心技能",
        "effect": "⚡ 解锁《C++ 入门》视频教程，共 314 集，循序渐进",
        "content_page": "cpp_tutorial.html"
    },
    "电竞鼠标": {
        "price": 149,
        "base_use_reward": 40,
        "base_sell_reward": 74,
        "desc": "🖱️ 掌控精准，反应迅速，电竞利器",
        "effect": "🎯 获得「精准瞄准」加持，游戏胜率提升",
        "content_page": None
    },
    "node.js 入门": {
        "price": 399,
        "base_use_reward": 100,
        "base_sell_reward": 199,
        "desc": "🚀 掌握 Node.js，轻松构建高性能后端服务",
        "effect": "📘 解锁《Node.js 入门》电子书，快速上手服务端开发",
        "content_page": "nodejs_tutorial.html"
    },
    "前端三剑客 入门": {
        "price": 499,
        "base_use_reward": 120,
        "base_sell_reward": 249,
        "desc": "🌐 HTML + CSS + JavaScript，零基础搭建现代化网页",
        "effect": "🎨 获得「前端开发」实战项目源码，从零到部署",
        "content_page": "frontend_tutorial.html"
    },
    "Python 入门": {
        "price": 99,
        "base_use_reward": 25,
        "base_sell_reward": 49,
        "desc": "🐍 打开Python大门，开启编程之旅",
        "effect": "🎬 观看《Python入门》视频教程，快速上手",
        "content_page": "python_tutorial.html"
    },
    "Python后端 入门": {
        "price": 399,
        "base_use_reward": 100,
        "base_sell_reward": 199,
        "desc": "🐍 掌握 Python 后端开发，构建高效 Web 服务",
        "effect": "📘 解锁《Python后端 入门》视频教程，共 29 集，从零到部署",
        "content_page": "backend_getting_started.html"
    },
    "赛博 T 恤": {
        "price": 199,
        "base_use_reward": 50,
        "base_sell_reward": 99,
        "desc": "👕 穿上赛博T恤，魅力值飙升，成为焦点",
        "effect": "👾 获得「赛博光环」，让代码自带RGB效果",
        "content_page": None
    },
    "游戏手柄": {
        "price": 299,
        "base_use_reward": 80,
        "base_sell_reward": 149,
        "desc": "🎮 握紧手柄，畅游游戏世界",
        "effect": "🎮 解锁游戏中心，畅玩《我的世界》等游戏！",
        "content_page": "game_center.html"
    },
    "音乐播放器": {
        "price": 2999,
        "base_use_reward": 800,
        "base_sell_reward": 1499,
        "desc": "🎵 顶级音乐播放器，无损音质，沉浸体验",
        "effect": "🎶 解锁音乐播放功能，随时享受旋律",
        "content_page": "music_player.html"
    },
    "影视播放器": {
        "price": 799,
        "base_use_reward": 200,
        "base_sell_reward": 399,
        "desc": "🎬 高清影视播放器，海量资源，畅享视听盛宴",
        "effect": "📺 解锁影视中心，观看最新电影和电视剧",
        "content_page": "video_player.html"
    },
}

# ---------- 游戏数据 ----------
GAME_LIST = {
    "我的世界": {"price": 0, "desc": "沙盒创造，无限创意", "icon": "⛏️"},
    "成语接龙": {"price": 5000, "desc": "考验你的成语储备", "icon": "📚"},
    "水果忍者": {"price": 1500, "desc": "切水果，解压神器", "icon": "🍉"},
    "抛硬币小游戏": {"price": 500, "desc": "抛硬币，运气大挑战", "icon": "🪙"},
    "打砖块": {"price": 800, "desc": "经典打砖块，挑战高分", "icon": "🧱"},
    "飞扬的小鸟": {"price": 600, "desc": "控制小鸟穿越管道", "icon": "🐦"},
    "2048": {"price": 1000, "desc": "合并数字，挑战2048", "icon": "🔢"},
    "扫雷": {"price": 800, "desc": "经典扫雷游戏", "icon": "💣"},
    "雷电战机": {"price": 1000, "desc": "飞行射击，躲避敌机", "icon": "✈️"},
    "杀戮尖塔": {"price": 1500, "desc": "卡牌策略，挑战高塔", "icon": "🏛️"},
    "贪吃蛇大作战": {"price": 900, "desc": "多人竞技贪吃蛇", "icon": "🐍"},
    "俄罗斯方块": {"price": 800, "desc": "经典俄罗斯方块", "icon": "🧩"},
}

def get_daily_multiplier(item_name):
    today = datetime.now().strftime('%Y-%m-%d')
    key = f"{today}_{item_name}"
    hash_val = int(hashlib.md5(key.encode()).hexdigest()[:8], 16)
    return 0.8 + (hash_val % 1000) / 1000 * 0.4

def get_daily_reward(item_name, reward_type='use'):
    item = ITEM_DATA.get(item_name)
    if not item:
        return 0
    base = item['base_use_reward'] if reward_type == 'use' else item['base_sell_reward']
    multiplier = get_daily_multiplier(item_name)
    return int(base * multiplier)

def get_item_effect(item_name):
    item = ITEM_DATA.get(item_name)
    return item['effect'] if item else ""

# ---------- 路由 ----------
@app.route("/")
def home():
    username = session.get('username')
    user_points = None
    unlocked_content = []
    mouse_effect_enabled = False
    avatar = None
    has_cyber_tshirt = False
    has_clock = False
    if username and username in users:
        user = users[username]
        grant_admin_daily_points(username)
        user_points = user.get('points', 0)
        unlocked_content = user.get('unlocked_content', [])
        mouse_effect_enabled = user.get('effects', {}).get('mouse_trail', False)
        avatar = user.get('avatar', 'default:#3498db')
        has_cyber_tshirt = user.get('effects', {}).get('cyber_tshirt', False)
        has_clock = '时钟' in unlocked_content
        today = datetime.now().strftime('%Y-%m-%d')
        if user.get('last_visit_date') != today:
            user['daily_visit_count'] = 1
            user['last_visit_date'] = today
        else:
            user['daily_visit_count'] = user.get('daily_visit_count', 0) + 1
        save_users(users)
        if user['daily_visit_count'] >= 3:
            auto_complete_task(username, 'daily_visit')
            user_points = users[username].get('points', 0)
    return render_template("board.html", messages=messages, username=username,
                           user_points=user_points, unlocked_content=unlocked_content,
                           mouse_effect_enabled=mouse_effect_enabled, avatar=avatar,
                           has_cyber_tshirt=has_cyber_tshirt, has_clock=has_clock)

@app.route("/message_board")
def message_board():
    username = session.get('username')
    user_points = None
    unlocked_content = []
    mouse_effect_enabled = False
    is_admin = False
    avatar = None
    has_clock = False
    if username and username in users:
        user = users[username]
        grant_admin_daily_points(username)
        user_points = user.get('points', 0)
        unlocked_content = user.get('unlocked_content', [])
        mouse_effect_enabled = user.get('effects', {}).get('mouse_trail', False)
        is_admin = user.get('is_admin', False)
        avatar = user.get('avatar', 'default:#3498db')
        has_clock = '时钟' in unlocked_content
    return render_template("message_board.html", messages=messages, username=username,
                           user_points=user_points, unlocked_content=unlocked_content,
                           mouse_effect_enabled=mouse_effect_enabled, is_admin=is_admin,
                           avatar=avatar, has_clock=has_clock)

@app.route("/content/<item_name>")
def content_page(item_name):
    if 'username' not in session:
        return redirect(url_for('login', next=request.url))
    username = session['username']
    user = users.get(username)
    if not user:
        return redirect(url_for('login'))

    item = ITEM_DATA.get(item_name)
    if not item or not item.get('content_page'):
        return "该商品无内容页", 404

    # 检查是否已解锁
    if item_name not in user.get('unlocked_content', []):
        flash(f'请先购买并使用「{item_name}」解锁内容', 'error')
        return redirect(url_for('store'))

    grant_admin_daily_points(username)
    unlocked_content = user.get('unlocked_content', [])
    mouse_effect_enabled = user.get('effects', {}).get('mouse_trail', False)
    avatar = user.get('avatar', 'default:#3498db')
    has_clock = '时钟' in unlocked_content
    return render_template(item['content_page'],
                           item_name=item_name,
                           username=username,
                           unlocked_content=unlocked_content,
                           mouse_effect_enabled=mouse_effect_enabled,
                           avatar=avatar,
                           has_clock=has_clock)

@app.route("/post", methods=["GET", "POST"])
def post():
    if request.method == "POST":
        if 'username' not in session:
            return redirect(url_for('login', next='/post'))
        msg = request.form.get("message")
        if not msg:
            return redirect("/post")
        name = session['username']
        messages.append({"name": name, "msg": msg})
        save_messages(messages)

        auto_complete_task(name, 'post_message')
        user = users.get(name)
        if user:
            today = datetime.now().strftime('%Y-%m-%d')
            if user.get('last_post_date') != today:
                auto_complete_task(name, 'daily_post')
                user['last_post_date'] = today
                save_users(users)

        return redirect("/post")
    else:
        username = session.get('username')
        user_points = users[username]['points'] if username and username in users else None
        mouse_effect_enabled = users[username].get('effects', {}).get('mouse_trail', False) if username and username in users else False
        avatar = users[username].get('avatar', 'default:#3498db') if username and username in users else None
        has_clock = '时钟' in users[username].get('unlocked_content', []) if username and username in users else False
        return render_template("board.html", messages=messages, username=username,
                               user_points=user_points, mouse_effect_enabled=mouse_effect_enabled,
                               avatar=avatar, has_clock=has_clock)

@app.route("/delete/<int:index>")
def delete(index):
    if 'username' not in session:
        return redirect(url_for('login', next='/post'))
    if 0 <= index < len(messages):
        msg = messages[index]
        if msg['name'] == session['username'] or users[session['username']].get('is_admin', False):
            messages.pop(index)
            save_messages(messages)
    return redirect("/post")

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password")

        if not username or not password:
            flash('用户名和密码都不能为空', 'error')
            return redirect(url_for('register'))
        if not (8 <= len(password) <= 16):
            flash('密码长度必须在8到16位之间', 'error')
            return redirect(url_for('register'))
        if username in users:
            flash('用户名已存在', 'error')
            return redirect(url_for('register'))

        password_hash = generate_password_hash(password)
        users[username] = {
            "password_hash": password_hash,
            "phone": "",
            "points": 100,
            "inventory": {},
            "tasks": {},
            "daily_tasks_completed": {},
            "daily_visit_count": 0,
            "last_visit_date": "",
            "last_post_date": "",
            "total_spent": 0,
            "unlocked_content": [],
            "effects": {},
            "is_admin": (username == "顾璟瑶"),
            "admin_daily_points_date": "",
            "admin_daily_points_count": 0,
            "mouse_effect_config": {
                "enabled": True,
                "color_mode": "rainbow",
                "shape": "circle"
            },
            "avatar": "default:#3498db"
        }
        save_users(users)
        flash('注册成功，请登录', 'success')
        return redirect(url_for('login', next='/'))
    return render_template("register.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username").strip()
        password = request.form.get("password")
        next_url = request.form.get("next", "/")
        if username in users and check_password_hash(users[username]['password_hash'], password):
            session['username'] = username
            grant_admin_daily_points(username)
            auto_complete_task(username, 'daily_login')
            return redirect(next_url)
        else:
            flash('用户名或密码错误', 'error')
            return redirect(url_for('login', next=next_url))
    next_url = request.args.get("next", "/")
    return render_template("login.html", next=next_url)

@app.route("/logout")
def logout():
    session.pop('username', None)
    return redirect("/")

@app.route("/settings", methods=["GET", "POST"])
def settings():
    if 'username' not in session:
        return redirect(url_for('login', next='/settings'))
    username = session['username']
    user = users.get(username)
    if not user:
        return "用户不存在", 404
    grant_admin_daily_points(username)

    avatar = user.get('avatar', 'default:#3498db')
    has_clock = '时钟' in user.get('unlocked_content', [])

    if request.method == "POST":
        old_pwd = request.form.get("old_password")
        new_pwd = request.form.get("new_password")
        confirm_pwd = request.form.get("confirm_password")
        if not old_pwd or not new_pwd or not confirm_pwd:
            flash('所有密码字段都必须填写', 'error')
            return redirect(url_for('settings'))
        if not check_password_hash(user['password_hash'], old_pwd):
            flash('原密码错误', 'error')
            return redirect(url_for('settings'))
        if new_pwd != confirm_pwd:
            flash('两次新密码不一致', 'error')
            return redirect(url_for('settings'))
        if not (8 <= len(new_pwd) <= 16):
            flash('新密码长度必须在8~16位之间', 'error')
            return redirect(url_for('settings'))
        user['password_hash'] = generate_password_hash(new_pwd)
        save_users(users)
        flash('密码更新成功', 'success')
        return redirect(url_for('settings'))

    unlocked_content = user.get('unlocked_content', [])
    mouse_effect_enabled = user.get('effects', {}).get('mouse_trail', False)
    return render_template("settings.html",
                           username=username,
                           phone=user['phone'],
                           points=user.get('points', 0),
                           avatar=avatar,
                           unlocked_content=unlocked_content,
                           mouse_effect_enabled=mouse_effect_enabled,
                           has_clock=has_clock)

@app.route("/settings/avatar", methods=["POST"])
def update_avatar():
    if 'username' not in session:
        return jsonify({"success": False, "msg": "请先登录"}), 401
    username = session['username']
    user = users.get(username)
    if not user:
        return jsonify({"success": False, "msg": "用户不存在"}), 404

    if request.is_json:
        data = request.get_json()
        color = data.get('default_color')
        if not color or not color.startswith('#'):
            return jsonify({"success": False, "msg": "无效颜色"}), 400
        user['avatar'] = f"default:{color}"
        save_users(users)
        return jsonify({"success": True, "msg": "默认头像已更新"})

    if 'avatar_file' not in request.files:
        return jsonify({"success": False, "msg": "未选择文件"}), 400
    file = request.files['avatar_file']
    if file.filename == '':
        return jsonify({"success": False, "msg": "文件名为空"}), 400
    if not allowed_file(file.filename):
        return jsonify({"success": False, "msg": "不支持的文件格式，请上传图片"}), 400

    original_name = secure_filename(file.filename)
    timestamp = int(time.time())
    ext = original_name.rsplit('.', 1)[1].lower()
    new_filename = f"{username}_{timestamp}.{ext}"
    save_path = os.path.join(AVATAR_FOLDER, new_filename)
    file.save(save_path)

    avatar_url = f"/static/avatars/{new_filename}"
    user['avatar'] = avatar_url
    save_users(users)

    return jsonify({"success": True, "msg": "头像上传成功", "avatar_url": avatar_url})

@app.route("/store")
def store():
    if 'username' not in session:
        return redirect(url_for('login', next='/store'))
    username = session['username']
    user = users[username]
    grant_admin_daily_points(username)
    points = user.get('points', 0)
    unlocked_content = user.get('unlocked_content', [])
    mouse_effect_enabled = user.get('effects', {}).get('mouse_trail', False)
    avatar = user.get('avatar', 'default:#3498db')
    has_clock = '时钟' in unlocked_content
    return render_template("store.html", username=username, points=points,
                           items=ITEM_DATA, unlocked_content=unlocked_content,
                           mouse_effect_enabled=mouse_effect_enabled, avatar=avatar,
                           has_clock=has_clock)

@app.route("/buy", methods=["POST"])
def buy():
    if 'username' not in session:
        return jsonify({"success": False, "msg": "请先登录"}), 401
    username = session['username']
    data = request.get_json()
    item = data.get('item')
    if not item or item not in ITEM_DATA:
        return jsonify({"success": False, "msg": "无效商品"}), 400

    price = ITEM_DATA[item]['price']
    user = users.get(username)
    if not user:
        return jsonify({"success": False, "msg": "用户不存在"}), 404

    current_points = user.get('points', 0)
    if current_points < price:
        return jsonify({"success": False, "msg": "积分不足"}), 400

    user['points'] = current_points - price
    inventory = user.get('inventory', {})
    inventory[item] = inventory.get(item, 0) + 1
    user['inventory'] = inventory

    user['total_spent'] = user.get('total_spent', 0) + price
    save_users(users)

    auto_complete_task(username, 'buy_item')
    if user['total_spent'] >= 500:
        auto_complete_task(username, 'spend_master')
    auto_complete_task(username, 'daily_buy')

    return jsonify({
        "success": True,
        "msg": f"成功购买 {item}",
        "new_points": user['points'],
        "inventory": inventory
    })

@app.route("/inventory")
def inventory():
    if 'username' not in session:
        return redirect(url_for('login', next='/inventory'))
    username = session['username']
    user = users.get(username)
    if not user:
        return "用户不存在", 404
    grant_admin_daily_points(username)
    inv = user.get('inventory', {})
    inv = {k: v for k, v in inv.items() if v > 0}
    unlocked_content = user.get('unlocked_content', [])
    mouse_effect_enabled = user.get('effects', {}).get('mouse_trail', False)
    avatar = user.get('avatar', 'default:#3498db')
    has_clock = '时钟' in unlocked_content
    return render_template("inventory.html", username=username, inventory=inv,
                           points=user.get('points', 0), item_data=ITEM_DATA,
                           unlocked_content=unlocked_content,
                           mouse_effect_enabled=mouse_effect_enabled,
                           avatar=avatar, has_clock=has_clock)

@app.route("/use_item", methods=["POST"])
def use_item():
    if 'username' not in session:
        return jsonify({"success": False, "msg": "请先登录"}), 401
    username = session['username']
    data = request.get_json()
    item = data.get('item')
    action = data.get('action')
    if not item or item not in ITEM_DATA or action not in ['use', 'sell']:
        return jsonify({"success": False, "msg": "无效操作"}), 400

    user = users.get(username)
    if not user:
        return jsonify({"success": False, "msg": "用户不存在"}), 404

    inv = user.get('inventory', {})
    if inv.get(item, 0) <= 0:
        return jsonify({"success": False, "msg": f"没有 {item}"}), 400

    if action == 'use':
        reward = get_daily_reward(item, 'use')
        effect = get_item_effect(item)

        inv[item] -= 1
        if inv[item] <= 0:
            del inv[item]
        user['inventory'] = inv

        user['points'] = user.get('points', 0) + reward
        save_users(users)

        auto_complete_task(username, 'use_item')
        auto_complete_task(username, 'daily_use')

        item_info = ITEM_DATA.get(item, {})
        content_page = item_info.get('content_page')
        redirect_url = None
        if content_page:
            if 'unlocked_content' not in user:
                user['unlocked_content'] = []
            if item not in user['unlocked_content']:
                user['unlocked_content'].append(item)
                save_users(users)
            redirect_url = url_for('content_page', item_name=item)

        if item == "影视播放器":
            redirect_url = url_for('video_player')

        if item == "时钟":
            if 'unlocked_content' not in user:
                user['unlocked_content'] = []
            if "时钟" not in user['unlocked_content']:
                user['unlocked_content'].append("时钟")
                save_users(users)

        if item == "降噪耳机":
            if 'unlocked_content' not in user:
                user['unlocked_content'] = []
            if "降噪耳机" not in user['unlocked_content']:
                user['unlocked_content'].append("降噪耳机")
                save_users(users)

        if item == "电竞鼠标":
            if 'effects' not in user:
                user['effects'] = {}
            user['effects']['mouse_trail'] = True
            save_users(users)

        if item == "赛博 T 恤":
            if 'effects' not in user:
                user['effects'] = {}
            user['effects']['cyber_tshirt'] = True
            save_users(users)

        return jsonify({
            "success": True,
            "msg": f"使用了 {item}，获得 {reward} 积分",
            "new_points": user['points'],
            "inventory": inv,
            "effect": effect,
            "redirect_url": redirect_url
        })

    elif action == 'sell':
        sell_reward = get_daily_reward(item, 'sell')
        inv[item] -= 1
        if inv[item] <= 0:
            del inv[item]
        user['inventory'] = inv
        user['points'] = user.get('points', 0) + sell_reward
        save_users(users)
        return jsonify({
            "success": True,
            "msg": f"出售 {item}，获得 {sell_reward} 积分",
            "new_points": user['points'],
            "inventory": inv
        })

@app.route("/tasks")
def tasks_page():
    if 'username' not in session:
        return redirect(url_for('login', next='/tasks'))
    username = session['username']
    user = users.get(username)
    if not user:
        return "用户不存在", 404
    grant_admin_daily_points(username)

    fixed_tasks_with_status = []
    for task in FIXED_TASKS:
        status = get_task_status(task['id'], user, 'fixed')
        fixed_tasks_with_status.append({
            **task,
            'status': status,
            'type': 'fixed'
        })

    daily_tasks = get_today_daily_tasks()
    daily_tasks_with_status = []
    for task in daily_tasks:
        status = get_task_status(task['id'], user, 'daily')
        daily_tasks_with_status.append({
            **task,
            'status': status,
            'type': 'daily'
        })

    unlocked_content = user.get('unlocked_content', [])
    mouse_effect_enabled = user.get('effects', {}).get('mouse_trail', False)
    avatar = user.get('avatar', 'default:#3498db')
    has_clock = '时钟' in unlocked_content
    return render_template("tasks.html", username=username,
                           fixed_tasks=fixed_tasks_with_status,
                           daily_tasks=daily_tasks_with_status,
                           points=user.get('points', 0),
                           unlocked_content=unlocked_content,
                           mouse_effect_enabled=mouse_effect_enabled,
                           avatar=avatar, has_clock=has_clock)

@app.route("/game_center")
def game_center():
    if 'username' not in session:
        return redirect(url_for('login', next='/game_center'))
    username = session['username']
    user = users.get(username)
    if not user:
        return "用户不存在", 404
    if "游戏手柄" not in user.get('unlocked_content', []):
        flash('请先购买并使用游戏手柄解锁游戏中心', 'error')
        return redirect(url_for('store'))
    unlocked_games = [g for g in GAME_LIST if g in user.get('unlocked_content', [])]
    unlocked_content = user.get('unlocked_content', [])
    mouse_effect_enabled = user.get('effects', {}).get('mouse_trail', False)
    avatar = user.get('avatar', 'default:#3498db')
    has_clock = '时钟' in unlocked_content
    return render_template("game_center.html",
                           username=username,
                           points=user.get('points', 0),
                           games=GAME_LIST,
                           unlocked_games=unlocked_games,
                           unlocked_content=unlocked_content,
                           mouse_effect_enabled=mouse_effect_enabled,
                           avatar=avatar, has_clock=has_clock)

@app.route("/buy_game", methods=["POST"])
def buy_game():
    if 'username' not in session:
        return jsonify({"success": False, "msg": "请先登录"}), 401
    data = request.get_json()
    game = data.get('game')
    if not game or game not in GAME_LIST:
        return jsonify({"success": False, "msg": "无效游戏"}), 400
    price = GAME_LIST[game]['price']
    if price == 0:
        return jsonify({"success": False, "msg": "该游戏免费，无需购买"}), 400
    username = session['username']
    user = users.get(username)
    if not user:
        return jsonify({"success": False, "msg": "用户不存在"}), 404
    if user.get('points', 0) < price:
        return jsonify({"success": False, "msg": "积分不足"}), 400
    user['points'] -= price
    if 'unlocked_content' not in user:
        user['unlocked_content'] = []
    if game not in user['unlocked_content']:
        user['unlocked_content'].append(game)
    save_users(users)
    return jsonify({"success": True, "msg": f"成功购买游戏 {game}", "new_points": user['points']})

@app.route("/play_game/<game_name>")
def play_game(game_name):
    if 'username' not in session:
        return redirect(url_for('login', next=request.url))
    username = session['username']
    user = users.get(username)
    if not user:
        return "用户不存在", 404
    if game_name == "我的世界":
        pass
    elif game_name not in user.get('unlocked_content', []):
        flash('请先购买该游戏', 'error')
        return redirect(url_for('game_center'))
    return render_template("play_game.html", game_name=game_name, username=username)

@app.route("/get_mouse_config")
def get_mouse_config():
    if 'username' not in session:
        return jsonify({"error": "未登录"}), 401
    username = session['username']
    user = users.get(username)
    if not user:
        return jsonify({"error": "用户不存在"}), 404
    config = user.get('mouse_effect_config', {})
    default = {"enabled": True, "color_mode": "rainbow", "shape": "circle"}
    for key in default:
        if key not in config:
            config[key] = default[key]
    return jsonify(config)

@app.route("/save_mouse_config", methods=["POST"])
def save_mouse_config():
    if 'username' not in session:
        return jsonify({"success": False, "msg": "未登录"}), 401
    username = session['username']
    user = users.get(username)
    if not user:
        return jsonify({"success": False, "msg": "用户不存在"}), 404
    data = request.get_json()
    enabled = data.get('enabled', True)
    color_mode = data.get('color_mode', 'rainbow')
    shape = data.get('shape', 'circle')
    if color_mode not in ['rainbow', 'cyan', 'random']:
        color_mode = 'rainbow'
    if shape not in ['circle', 'square', 'star']:
        shape = 'circle'
    user['mouse_effect_config'] = {
        "enabled": enabled,
        "color_mode": color_mode,
        "shape": shape
    }
    save_users(users)
    return jsonify({"success": True})

@app.route("/video_player")
def video_player():
    if 'username' not in session:
        return redirect(url_for('login', next='/video_player'))
    username = session['username']
    user = users.get(username)
    if not user:
        return "用户不存在", 404
    if "影视播放器" not in user.get('unlocked_content', []):
        flash('请先购买并使用影视播放器解锁', 'error')
        return redirect(url_for('store'))
    unlocked_content = user.get('unlocked_content', [])
    mouse_effect_enabled = user.get('effects', {}).get('mouse_trail', False)
    avatar = user.get('avatar', 'default:#3498db')
    has_cyber_tshirt = user.get('effects', {}).get('cyber_tshirt', False)
    has_clock = '时钟' in unlocked_content
    return render_template("video_player.html",
                           username=username,
                           unlocked_content=unlocked_content,
                           mouse_effect_enabled=mouse_effect_enabled,
                           avatar=avatar,
                           has_cyber_tshirt=has_cyber_tshirt,
                           has_clock=has_clock)

# =====================================================================
#  贪吃蛇大作战 联机服务器 (WebSocket)
#  说明：联机服务器实现位于 snake_server.py。
#        本项目采用"同端口多路复用"架构：Flask HTTP 和贪吃蛇 WebSocket
#        共用 5000 端口，WebSocket 路径为 /snake_ws。
#        访问地址：
#            - 留言板首页:  http://<ip>:5000/
#            - 贪吃蛇联机:  ws://<ip>:5000/snake_ws
# =====================================================================

if __name__ == "__main__":
    if GEVENT_AVAILABLE:
        # 同一端口 (5000) 同时提供 HTTP 和 WebSocket
        from gevent import pywsgi
        try:
            from geventwebsocket.handler import WebSocketHandler
        except ImportError:
            WebSocketHandler = None
            print("⚠️  未安装 gevent-websocket，贪吃蛇联机不可用 (仅 HTTP)")
        # 注册项目根目录到 sys.path 以复用 snake_server
        _base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if _base_dir not in sys.path:
            sys.path.insert(0, _base_dir)
        try:
            import snake_server as _snake_mod
        except Exception as e:
            _snake_mod = None
            print(f"⚠️  加载 snake_server 失败: {e} (贪吃蛇联机不可用)")

        handler_class = WebSocketHandler if (WebSocketHandler and _snake_mod) else None
        http_server = pywsgi.WSGIServer(('0.0.0.0', 5000), app, log=None, error_log=None,
                                        handler_class=handler_class)
        # 挂载贪吃蛇 WebSocket 到 /snake_ws 路径
        if _snake_mod and handler_class:
            try:
                _snake_mod.mount_into_wsgi_server(http_server, path='/snake_ws')
                print("=" * 50)
                print("[首页  ]       http://<ip>:5000/")
                print("[贪吃蛇联机]   ws://<ip>:5000/snake_ws")
                print("=" * 50)
            except Exception as e:
                print(f"⚠️  挂载贪吃蛇 WebSocket 失败: {e}")
        else:
            print("=" * 50)
            print("[首页  ]       http://<ip>:5000/")
            print("[贪吃蛇联机]   不可用")
            print("=" * 50)
        http_server.serve_forever()
    else:
        # 标准 Flask 模式 (不启用联机服务)
        print("[警告] gevent 未安装，仅启动 Flask (贪吃蛇联机不可用)")
        print("安装方法: pip install gevent gevent-websocket")
        app.run(debug=True, host='0.0.0.0', port=5000)