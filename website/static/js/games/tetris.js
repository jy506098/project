/* ===========================================
   俄罗斯方块
   =========================================== */

(function () {
    'use strict';
    window.Games = window.Games || {};
    const Games = window.Games;

    const COLS = 10, ROWS = 20, CELL = 28;
    const SHAPES = {
        I: [[0,0],[1,0],[2,0],[3,0]],
        O: [[0,0],[1,0],[0,1],[1,1]],
        T: [[0,0],[1,0],[2,0],[1,1]],
        S: [[1,0],[2,0],[0,1],[1,1]],
        Z: [[0,0],[1,0],[1,1],[2,1]],
        J: [[0,0],[0,1],[1,1],[2,1]],
        L: [[2,0],[0,1],[1,1],[2,1]],
    };
    const COLORS = {
        I: '#06b6d4', O: '#fbbf24', T: '#a855f7',
        S: '#22c55e', Z: '#ef4444', J: '#3b82f6', L: '#f97316',
    };
    const KEYS = Object.keys(SHAPES);

    Games['俄罗斯方块'] = function (canvas) {
        const parent = canvas.parentElement;
        canvas.style.width = (COLS * CELL + 6) + 'px';
        canvas.style.height = (ROWS * CELL + 6) + 'px';
        canvas.width = COLS * CELL + 6;
        canvas.height = ROWS * CELL + 6;
        const w = canvas.width, h = canvas.height;
        const ctx = canvas.getContext('2d');

        let board, piece, dropTimer, score, lines, over;

        function newBoard() {
            return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
        }

        function newPiece() {
            const k = KEYS[Math.floor(Math.random() * KEYS.length)];
            return { type: k, shape: SHAPES[k], color: COLORS[k], x: 3, y: 0 };
        }

        function rotate(p) {
            const s = p.shape;
            const n = s.length;
            const r = [];
            for (let i = 0; i < n; i++) {
                r.push([]);
                for (let j = 0; j < n; j++) r[i].push(s[n - 1 - j][i]);
            }
            // 仅保留非零
            const minR = Math.min(...r.map((row, i) => row.some(c => c[0] !== undefined) ? i : n));
            const minC = Math.min(...r[0].map((_, j) => r.some(row => row[j][0] !== undefined) ? j : n));
            const trimmed = [];
            for (let i = minR; i < n; i++) {
                const row = [];
                for (let j = minC; j < n; j++) row.push(r[i][j]);
                trimmed.push(row);
            }
            // 修正相对位置
            return { ...p, shape: trimmed };
        }

        function collides(p, dx = 0, dy = 0, shape = null) {
            const s = shape || p.shape;
            for (const [r, c] of s) {
                const nx = p.x + c + dx, ny = p.y + r + dy;
                if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
                if (ny >= 0 && board[ny][nx]) return true;
            }
            return false;
        }

        function merge() {
            for (const [r, c] of piece.shape) {
                const ny = piece.y + r, nx = piece.x + c;
                if (ny >= 0) board[ny][nx] = piece.color;
            }
            // 消行
            let cleared = 0;
            for (let r = ROWS - 1; r >= 0; r--) {
                if (board[r].every(v => v)) {
                    board.splice(r, 1);
                    board.unshift(Array(COLS).fill(null));
                    cleared++;
                    r++;
                }
            }
            if (cleared) {
                lines += cleared;
                score += [0, 100, 300, 500, 800][cleared] || 1000;
                hud.setScore(score);
                hud.setStatus(`消行: ${lines}`);
            }
        }

        function spawn() {
            piece = newPiece();
            if (collides(piece, 0, 0)) {
                over = true;
                hud.setStatus('💀 游戏结束');
            }
        }

        function drop() {
            if (over) return;
            if (!collides(piece, 0, 1)) {
                piece.y++;
            } else {
                merge();
                spawn();
            }
        }

        function hardDrop() {
            if (over) return;
            while (!collides(piece, 0, 1)) piece.y++;
            drop();
        }

        function tryRotate() {
            const r = rotate(piece);
            // 简单 wall kick
            for (const dx of [0, -1, 1, -2, 2]) {
                if (!collides(r, dx, 0)) {
                    piece.shape = r.shape;
                    piece.x += dx;
                    return;
                }
            }
        }

        function render() {
            ctx.fillStyle = '#0a0e27';
            ctx.fillRect(0, 0, w, h);
            // 网格
            ctx.strokeStyle = 'rgba(102,252,241,0.08)';
            for (let r = 0; r < ROWS; r++)
                for (let c = 0; c < COLS; c++) {
                    ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
                }
            // 已落方块
            for (let r = 0; r < ROWS; r++)
                for (let c = 0; c < COLS; c++)
                    if (board[r][c]) drawCell(ctx, c, r, board[r][c]);
            // 当前方块
            if (piece && !over) {
                for (const [r, c] of piece.shape)
                    drawCell(ctx, piece.x + c, piece.y + r, piece.color);
                // 投影
                let dy = 0;
                while (!collides(piece, 0, dy + 1)) dy++;
                ctx.fillStyle = piece.color + '44';
                for (const [r, c] of piece.shape)
                    ctx.fillRect((piece.x + c) * CELL, (piece.y + r + dy) * CELL, CELL, CELL);
            }
            requestAnimationFrame(render);
        }

        function drawCell(ctx, c, r, color) {
            const x = c * CELL, y = r * CELL, m = 2;
            ctx.fillStyle = color;
            ctx.fillRect(x + m, y + m, CELL - m * 2, CELL - m * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(x + m, y + m, CELL - m * 2, 3);
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(x + m, y + CELL - m - 3, CELL - m * 2, 3);
        }

        function init() {
            board = newBoard();
            score = 0; lines = 0; over = false; dropTimer = 0;
            spawn();
            hud.setScore(score);
            hud.setStatus('消行: 0');
        }

        const hud = Games.HUD(parent);
        hud.on('restart', init);
        hud.on('pause', () => Games.pauseToggle.toggle());

        Games.keys.on('tetris', (k, down) => {
            if (!down || Games.pauseToggle.get() || over) return;
            if (k === 'ArrowLeft' && !collides(piece, -1, 0)) piece.x--;
            else if (k === 'ArrowRight' && !collides(piece, 1, 0)) piece.x++;
            else if (k === 'ArrowDown') drop();
            else if (k === 'ArrowUp') tryRotate();
            else if (k === ' ') hardDrop();
        });

        // 速度递增
        let last = performance.now();
        function loop(t) {
            const dt = t - last;
            if (!over && !Games.pauseToggle.get()) {
                dropTimer += dt;
                const speed = Math.max(150, 600 - lines * 30);
                if (dropTimer > speed) { dropTimer = 0; drop(); }
            }
            last = t;
            requestAnimationFrame(loop);
        }
        init();
        render();
        requestAnimationFrame(loop);
    };
})();