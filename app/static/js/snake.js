/* ===========================================
   贪吃蛇联机 - 客户端
   - 连接到 ws://<host>:5000/snake_ws
   - 接收服务端 state 快照并渲染
   - 键盘 / 触屏输入方向
   =========================================== */

(function () {
    'use strict';

    const canvas = document.getElementById('snakeCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const CELL = 20;
    const joinBtn = document.getElementById('joinBtn');
    const connEl = document.getElementById('connStatus');
    const roomEl = document.getElementById('roomName');

    let ws = null;
    let state = null;
    let myName = prompt('请输入昵称', '玩家' + Math.floor(Math.random() * 1000)) || ('玩家' + Math.floor(Math.random() * 1000));

    function setConn(status) {
        connEl.textContent = status;
        connEl.className = status === '已连接' ? 'conn-connected' : 'conn-disconnected';
    }

    function buildWsUrl() {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${proto}//${location.host}/snake_ws`;
    }

    function connect() {
        if (ws && ws.readyState === WebSocket.OPEN) return;
        setConn('连接中...');
        ws = new WebSocket(buildWsUrl());

        ws.onopen = () => {
            setConn('已连接');
            // 发送 join
            const room = roomEl.textContent.trim() || 'default';
            ws.send(JSON.stringify({ type: 'join', room, name: myName }));
        };

        ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                if (msg.type === 'state') {
                    state = msg;
                    render();
                } else if (msg.type === 'welcome') {
                    myName = msg.name || myName;
                } else if (msg.type === 'gameover') {
                    setConn(`已连接 - 胜者: ${msg.winner}`);
                } else if (msg.type === 'error') {
                    console.warn('server error:', msg.msg);
                }
            } catch (err) {
                console.error('parse error', err);
            }
        };

        ws.onclose = () => {
            setConn('已断开 - 5秒后重连');
            ws = null;
            setTimeout(connect, 5000);
        };

        ws.onerror = () => setConn('错误');
    }

    function disconnect() {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'leave' }));
        }
        if (ws) ws.close();
        ws = null;
    }

    if (joinBtn) {
        joinBtn.addEventListener('click', () => {
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                connect();
                joinBtn.textContent = '断开';
            } else {
                disconnect();
                joinBtn.textContent = '加入房间';
                state = null;
                render();
            }
        });
    }

    // ---------- 键盘输入 ----------
    const DIR_MAP = {
        ArrowUp:    [0, -1], w: [0, -1], W: [0, -1],
        ArrowDown:  [0,  1], s: [0,  1], S: [0,  1],
        ArrowLeft:  [-1, 0], a: [-1, 0], A: [-1, 0],
        ArrowRight: [1,  0], d: [1,  0], D: [1,  0],
    };
    window.addEventListener('keydown', (e) => {
        const d = DIR_MAP[e.key];
        if (!d) return;
        e.preventDefault();
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', dir: d }));
        }
    });

    // ---------- 触屏滑动 ----------
    let touchStart = null;
    canvas.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        touchStart = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    canvas.addEventListener('touchend', (e) => {
        if (!touchStart) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStart.x;
        const dy = t.clientY - touchStart.y;
        let d = null;
        if (Math.abs(dx) > Math.abs(dy)) {
            d = dx > 20 ? [1, 0] : (dx < -20 ? [-1, 0] : null);
        } else {
            d = dy > 20 ? [0, 1] : (dy < -20 ? [0, -1] : null);
        }
        if (d && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', dir: d }));
        }
        touchStart = null;
    });

    // ---------- 渲染 ----------
    function render() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (!state) {
            ctx.fillStyle = '#66fcf1';
            ctx.font = '20px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('点击「加入房间」开始游戏', canvas.width / 2, canvas.height / 2);
            return;
        }

        // 网格
        ctx.strokeStyle = 'rgba(102, 252, 241, 0.08)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= state.w; x++) {
            ctx.beginPath();
            ctx.moveTo(x * CELL, 0);
            ctx.lineTo(x * CELL, state.h * CELL);
            ctx.stroke();
        }
        for (let y = 0; y <= state.h; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * CELL);
            ctx.lineTo(state.w * CELL, y * CELL);
            ctx.stroke();
        }

        // 食物
        ctx.fillStyle = '#ff6b6b';
        for (const [fx, fy] of state.foods) {
            ctx.beginPath();
            ctx.arc(fx * CELL + CELL / 2, fy * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // 玩家
        for (const p of state.players) {
            for (let i = 0; i < p.snake.length; i++) {
                const [sx, sy] = p.snake[i];
                ctx.fillStyle = i === 0 ? p.color : p.color + 'cc';
                if (!p.alive) ctx.globalAlpha = 0.3;
                ctx.fillRect(sx * CELL + 1, sy * CELL + 1, CELL - 2, CELL - 2);
                ctx.globalAlpha = 1;
            }
            // 名字 + 分数
            const [hx, hy] = p.snake[0];
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${p.name} (${p.score})`, hx * CELL + CELL / 2, hy * CELL - 4);
        }
    }

    // 自动开始连接（可选）
    // connect();
})();