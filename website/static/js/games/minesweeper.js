/* ===========================================
   扫雷 (Minesweeper)
   =========================================== */

(function () {
    'use strict';
    window.Games = window.Games || {};
    const Games = window.Games;

    Games['扫雷'] = function (canvas) {
        const parent = canvas.parentElement;
        const COLS = 10, ROWS = 10, MINES = 15;
        const CELL = Math.floor(Math.min(640, parent.clientWidth - 40) / COLS);
        canvas.style.width = (COLS * CELL) + 'px';
        canvas.style.height = (ROWS * CELL) + 'px';
        canvas.width = COLS * CELL;
        canvas.height = ROWS * CELL;
        const w = canvas.width, h = canvas.height;
        const ctx = canvas.getContext('2d');

        let grid, opened, flagged, over, won, firstClick;

        function init() {
            grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
            opened = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
            flagged = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
            over = false; won = false; firstClick = true;
            hud.setScore(0);
            hud.setStatus('左键翻开 · 右键标雷');
        }

        function placeMines(sx, sy) {
            let placed = 0;
            while (placed < MINES) {
                const r = Math.floor(Math.random() * ROWS);
                const c = Math.floor(Math.random() * COLS);
                if (grid[r][c] === -1) continue;
                if (Math.abs(r - sy) <= 1 && Math.abs(c - sx) <= 1) continue;
                grid[r][c] = -1;
                placed++;
            }
            for (let r = 0; r < ROWS; r++)
                for (let c = 0; c < COLS; c++) {
                    if (grid[r][c] === -1) continue;
                    let n = 0;
                    for (let dr = -1; dr <= 1; dr++)
                        for (let dc = -1; dc <= 1; dc++) {
                            const nr = r + dr, nc = c + dc;
                            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc] === -1) n++;
                        }
                    grid[r][c] = n;
                }
        }

        function open(r, c) {
            if (over || won || opened[r][c] || flagged[r][c]) return;
            if (firstClick) {
                firstClick = false;
                placeMines(c, r);
            }
            opened[r][c] = true;
            if (grid[r][c] === -1) {
                over = true;
                hud.setStatus('💥 踩雷了！点击重开');
                return;
            }
            if (grid[r][c] === 0) {
                for (let dr = -1; dr <= 1; dr++)
                    for (let dc = -1; dc <= 1; dc++) {
                        const nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) open(nr, nc);
                    }
            }
            checkWin();
        }

        function toggleFlag(r, c) {
            if (over || won || opened[r][c]) return;
            flagged[r][c] = !flagged[r][c];
        }

        function checkWin() {
            for (let r = 0; r < ROWS; r++)
                for (let c = 0; c < COLS; c++)
                    if (grid[r][c] !== -1 && !opened[r][c]) return;
            won = true;
            hud.setStatus('🎉 胜利！点击重开');
        }

        function render() {
            ctx.fillStyle = '#0a0e27';
            ctx.fillRect(0, 0, w, h);
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    const x = c * CELL, y = r * CELL;
                    if (opened[r][c]) {
                        ctx.fillStyle = '#1a1a2e';
                        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
                        if (grid[r][c] === -1) {
                            ctx.fillStyle = '#ef4444';
                            ctx.beginPath();
                            ctx.arc(x + CELL / 2, y + CELL / 2, CELL * 0.3, 0, Math.PI * 2);
                            ctx.fill();
                        } else if (grid[r][c] > 0) {
                            const COL_N = ['#000', '#3b82f6', '#22c55e', '#ef4444', '#7c3aed', '#7c2d12', '#06b6d4', '#000', '#737373'];
                            ctx.fillStyle = COL_N[grid[r][c]];
                            ctx.font = `bold ${CELL * 0.6}px sans-serif`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(grid[r][c], x + CELL / 2, y + CELL / 2);
                        }
                    } else {
                        ctx.fillStyle = '#475569';
                        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
                        ctx.fillStyle = '#64748b';
                        ctx.fillRect(x + 1, y + 1, CELL - 2, 3);
                        if (flagged[r][c]) {
                            ctx.fillStyle = '#fbbf24';
                            ctx.font = `${CELL * 0.6}px sans-serif`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText('🚩', x + CELL / 2, y + CELL / 2);
                        }
                    }
                    ctx.strokeStyle = '#1e293b';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
                }
            }
        }

        canvas.addEventListener('click', (e) => {
            const r = canvas.getBoundingClientRect();
            const c = Math.floor((e.clientX - r.left) / CELL * (canvas.width / r.width));
            const row = Math.floor((e.clientY - r.top) / CELL * (canvas.height / r.height));
            if (row >= 0 && row < ROWS && c >= 0 && c < COLS) open(row, c);
            render();
        });
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const r = canvas.getBoundingClientRect();
            const c = Math.floor((e.clientX - r.left) / CELL * (canvas.width / r.width));
            const row = Math.floor((e.clientY - r.top) / CELL * (canvas.height / r.height));
            if (row >= 0 && row < ROWS && c >= 0 && c < COLS) toggleFlag(row, c);
            render();
        });
        // 触屏长按 = 标雷
        let pressTimer = null;
        canvas.addEventListener('touchstart', (e) => {
            const t = e.touches[0];
            const r = canvas.getBoundingClientRect();
            const c = Math.floor((t.clientX - r.left) / CELL * (canvas.width / r.width));
            const row = Math.floor((t.clientY - r.top) / CELL * (canvas.height / r.height));
            pressTimer = setTimeout(() => { toggleFlag(row, c); render(); pressTimer = null; }, 400);
        });
        canvas.addEventListener('touchend', (e) => {
            if (pressTimer) {
                clearTimeout(pressTimer); pressTimer = null;
                const t = e.changedTouches[0];
                const r = canvas.getBoundingClientRect();
                const c = Math.floor((t.clientX - r.left) / CELL * (canvas.width / r.width));
                const row = Math.floor((t.clientY - r.top) / CELL * (canvas.height / r.height));
                open(row, c);
                render();
            }
            e.preventDefault();
        });

        const hud = Games.HUD(parent);
        hud.on('restart', () => { init(); render(); });

        init();
        render();
    };
})();