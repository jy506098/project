# -*- coding: utf-8 -*-
"""
贪吃蛇大作战 WebSocket 联机服务器
- 提供 mount_into_wsgi_server(server, path) 函数，由 app.py 在同一端口挂载
- 房间管理 + 玩家状态同步 + 食物生成 + 碰撞检测
"""
import json
import random
import time
from collections import defaultdict

try:
    from geventwebsocket.handler import WebSocketHandler
    from geventwebsocket.websocket import WebSocket
    GEVENT_WS_AVAILABLE = True
except ImportError:
    GEVENT_WS_AVAILABLE = False
    WebSocket = None
    WebSocketHandler = None

# ---------------- 房间配置 ----------------
ROOM_W = 40
ROOM_H = 30
TICK_MS = 80        # 每帧逻辑 tick (毫秒)
FOOD_COUNT = 30     # 每房间目标食物数

# 颜色池（玩家蛇身颜色循环使用）
COLOR_POOL = [
    "#ff4d6d", "#ff8c42", "#ffd166", "#06d6a0", "#118ab2",
    "#8338ec", "#3a86ff", "#ef476f", "#f72585", "#4cc9f0"
]

# ---------------- 全局状态 ----------------
class Room:
    """一个游戏房间"""
    def __init__(self, room_id):
        self.id = room_id
        self.players = {}        # ws -> {name, snake, dir, color, score, alive, last_tick}
        self.foods = []          # [(x, y)]
        self.created_at = time.time()

    def add_player(self, ws, name):
        color = COLOR_POOL[len(self.players) % len(COLOR_POOL)]
        spawn_x = random.randint(5, ROOM_W - 6)
        spawn_y = random.randint(5, ROOM_H - 6)
        self.players[ws] = {
            "name": name or f"玩家{len(self.players)+1}",
            "snake": [(spawn_x, spawn_y), (spawn_x - 1, spawn_y), (spawn_x - 2, spawn_y)],
            "dir": (1, 0),
            "next_dir": (1, 0),
            "color": color,
            "score": 0,
            "alive": True,
            "last_input_ts": time.time(),
        }
        self.refill_food()

    def remove_player(self, ws):
        if ws in self.players:
            del self.players[ws]

    def refill_food(self):
        while len(self.foods) < FOOD_COUNT:
            x = random.randint(0, ROOM_W - 1)
            y = random.randint(0, ROOM_H - 1)
            if (x, y) not in self.foods:
                self.foods.append((x, y))

    def tick(self):
        """推进一帧逻辑"""
        for ws, p in list(self.players.items()):
            if not p["alive"]:
                continue
            # 应用待生效的方向（禁止 180° 反向）
            nd = p["next_dir"]
            cd = p["dir"]
            if (nd[0] + cd[0], nd[1] + cd[1]) != (0, 0):
                p["dir"] = nd

            head_x, head_y = p["snake"][0]
            dx, dy = p["dir"]
            new_head = (head_x + dx, head_y + dy)

            # 撞墙
            if not (0 <= new_head[0] < ROOM_W and 0 <= new_head[1] < ROOM_H):
                p["alive"] = False
                continue

            # 撞自己
            if new_head in p["snake"][:-1]:
                p["alive"] = False
                continue

            # 撞其他玩家蛇身
            for other_ws, other in self.players.items():
                if other_ws == ws:
                    continue
                if new_head in other["snake"]:
                    p["alive"] = False
                    break
            if not p["alive"]:
                continue

            p["snake"].insert(0, new_head)

            # 吃食物
            if new_head in self.foods:
                self.foods.remove(new_head)
                p["score"] += 10
                self.refill_food()
            else:
                p["snake"].pop()

    def snapshot(self):
        """生成下发到客户端的状态快照"""
        return {
            "type": "state",
            "room": self.id,
            "w": ROOM_W,
            "h": ROOM_H,
            "foods": [list(f) for f in self.foods],
            "players": [
                {
                    "name": p["name"],
                    "color": p["color"],
                    "score": p["score"],
                    "alive": p["alive"],
                    "snake": [list(s) for s in p["snake"]],
                }
                for p in self.players.values()
            ],
            "ts": int(time.time() * 1000),
        }


# ---------------- 全局房间池 ----------------
ROOMS = {}     # room_id(str) -> Room
# ws -> (room_id, player_name) 反向索引，方便断连清理
WS_INDEX = {}

def _get_or_create_room(room_id):
    if room_id not in ROOMS:
        ROOMS[room_id] = Room(room_id)
    return ROOMS[room_id]

def _garbage_collect_rooms():
    """定期清理空房间"""
    now = time.time()
    for rid in list(ROOMS.keys()):
        if not ROOMS[rid].players and now - ROOMS[rid].created_at > 30:
            del ROOMS[rid]

# ---------------- 消息协议 ----------------
# 客户端 -> 服务端:
#   {"type": "join",   "room": "default", "name": "Alice"}
#   {"type": "input",  "dir": [dx, dy]}    # 方向: [1,0]=右 [-1,0]=左 [0,1]=下 [0,-1]=上
#   {"type": "leave"}
# 服务端 -> 客户端:
#   {"type": "welcome", "you": <player_idx>, "room": "default"}
#   {"type": "state",   ...}    # 见 Room.snapshot
#   {"type": "gameover", "winner": "..."}
#   {"type": "error",   "msg": "..."}

def _send(ws, data):
    try:
        ws.send(json.dumps(data, ensure_ascii=False))
    except Exception:
        pass

def _handle_message(ws, raw):
    try:
        msg = json.loads(raw)
    except Exception:
        _send(ws, {"type": "error", "msg": "invalid json"})
        return

    entry = WS_INDEX.get(ws)
    if not entry:
        # 第一条消息必须是 join
        if msg.get("type") != "join":
            _send(ws, {"type": "error", "msg": "must join first"})
            return
        room_id = str(msg.get("room", "default"))[:32] or "default"
        name = str(msg.get("name", ""))[:16]
        room = _get_or_create_room(room_id)
        room.add_player(ws, name)
        WS_INDEX[ws] = (room_id, name)
        _send(ws, {"type": "welcome", "room": room_id, "name": name})
        return

    room_id, _ = entry
    room = ROOMS.get(room_id)
    if not room:
        return

    p = room.players.get(ws)
    if not p:
        return

    mtype = msg.get("type")
    if mtype == "input":
        d = msg.get("dir")
        if isinstance(d, list) and len(d) == 2:
            dx, dy = int(d[0]), int(d[1])
            if (dx, dy) in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                # 不允许 180° 反向
                if (dx + p["dir"][0], dy + p["dir"][1]) != (0, 0):
                    p["next_dir"] = (dx, dy)
                    p["last_input_ts"] = time.time()
    elif mtype == "leave":
        room.remove_player(ws)
        WS_INDEX.pop(ws, None)


def _game_loop():
    """房间逻辑主循环 - 必须在外部启动为后台 greenlet"""
    while True:
        _garbage_collect_rooms()
        for room in list(ROOMS.values()):
            if not room.players:
                continue
            room.tick()
            snap = room.snapshot()
            for ws in list(room.players.keys()):
                _send(ws, snap)
            # 检测是否全员死亡
            if room.players and all(not p["alive"] for p in room.players.values()):
                # 选分最高者为胜
                winner = max(room.players.values(), key=lambda p: p["score"])["name"]
                for ws in list(room.players.keys()):
                    _send(ws, {"type": "gameover", "winner": winner})
                # 重置所有玩家位置
                for ws, p in room.players.items():
                    p["alive"] = True
                    spawn_x = random.randint(5, ROOM_W - 6)
                    spawn_y = random.randint(5, ROOM_H - 6)
                    p["snake"] = [(spawn_x, spawn_y), (spawn_x - 1, spawn_y), (spawn_x - 2, spawn_y)]
                    p["dir"] = (1, 0)
                    p["next_dir"] = (1, 0)
                    p["score"] = 0
                room.refill_food()
        time.sleep(TICK_MS / 1000.0)


def _ws_handler(ws):
    """单个 WebSocket 连接的处理入口"""
    try:
        while True:
            msg = ws.receive()
            if msg is None:
                break
            _handle_message(ws, msg)
    finally:
        entry = WS_INDEX.pop(ws, None)
        if entry:
            room_id, _ = entry
            room = ROOMS.get(room_id)
            if room:
                room.remove_player(ws)


# ---------------- 挂载到 WSGI Server ----------------
_LOOP_STARTED = False

def mount_into_wsgi_server(server, path='/snake_ws'):
    """
    把贪吃蛇 WebSocket 处理挂载到 gevent pywsgi.WSGIServer。
    由 app.py 在启动时调用。
    """
    global _LOOP_STARTED
    if not GEVENT_WS_AVAILABLE:
        print("[snake_server] gevent-websocket 未安装，跳过挂载")
        return False

    import gevent

    def _router(environ, start_response):
        """WSGI 路由：匹配 path 的请求升级为 WebSocket"""
        if environ.get('PATH_INFO') == path:
            ws = environ.get('wsgi.websocket')
            if ws is None:
                start_response("400 Bad Request", [])
                return [b"WebSocket required"]
            _ws_handler(ws)
            return []
        # 非贪吃蛇路径交给上层（app.py）
        return None

    # 通过 middleware 接管指定路径
    server.application = _SnakeMiddleware(server.application, _router)

    if not _LOOP_STARTED:
        _LOOP_STARTED = True
        gevent.spawn(_game_loop)
        print(f"[snake_server] 已挂载到 {path}，房间逻辑循环已启动")
    return True


class _SnakeMiddleware:
    """简单 WSGI 中间件：先把请求交给 snake 路由器，未匹配再走原始 app"""
    def __init__(self, inner, snake_app):
        self.inner = inner
        self.snake_app = snake_app

    def __call__(self, environ, start_response):
        # 仅处理 WebSocket 握手请求
        if environ.get('wsgi.websocket') is not None and environ.get('PATH_INFO') == '/snake_ws':
            return self.snake_app(environ, start_response)
        return self.inner(environ, start_response)


# ---------------- 独立启动（备用）----------------
def run_standalone(host='0.0.0.0', port=8080):
    """不与 Flask 共用端口时的独立启动方式（备用）"""
    if not GEVENT_WS_AVAILABLE:
        print("[snake_server] 需要 gevent-websocket")
        return
    from gevent import pywsgi
    print(f"[snake_server] 独立模式启动 -> ws://{host}:{port}/")
    server = pywsgi.WSGIServer(
        (host, port),
        _standalone_app,
        handler_class=WebSocketHandler,
    )
    import gevent
    gevent.spawn(_game_loop)
    server.serve_forever()


def _standalone_app(environ, start_response):
    if environ.get('PATH_INFO') != '/':
        start_response("404 Not Found", [])
        return [b"Not Found"]
    ws = environ.get('wsgi.websocket')
    if ws is None:
        start_response("200 OK", [("Content-Type", "text/plain")])
        return [b"Greedy Snake WS server. Connect via WebSocket."]
    _ws_handler(ws)
    return []


if __name__ == "__main__":
    run_standalone()