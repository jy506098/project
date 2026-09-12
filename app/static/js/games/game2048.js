/* ===========================================
   2048 游戏
   =========================================== */

(function () {
    'use strict';
    window.Games = window.Games || {};
    const Games = window.Games;

    Games['2048'] = function (canvas) {
        const parent = canvas.parentElement;
        const SIZE = 4;
        const { w, h } = Games.fitCanvas(canvas, 1);
        const TILE = Math.floor(Math.min(w, h) / (SIZE + 0.5));
        const offX = (w - TILE * SIZE) / 2;
        const offY = (h - TILE * SIZE) / 2;
        const ctx = canvas.getContext('2d');

        const COLORS = {
            0: '#1a1a2e', 2: '#fef3c7', 4: '#fde68a', 8: '#fbbf24',
            16: '#f59e0b', 32: '#ef4444', 64: '#dc2626', 128: '#facc15',
            256: '#84cc16', 512: '#22c55e', 1024: '#06b6d4', 2048: '#8b5cf6',
        };
        const FG = { 2: '#7c2d12', 4: '#7c2d12', 8: '#fff', 16: '#fff', 32: '#fff',
                     64: '#fff', 128: '#fff', 256: '#fff', 512: '#fff', 1024: '#fff', 2048: '#fff' };

        let grid, score, best, over;
        best = +(localStorage.getItem('2048_best') || 0);

        function newTile() {
            const empties = [];
            for (let r = 0; r < SIZE; r++)
                for (let c = 0; c < SIZE; c++)
                    if (!grid[r][c]) empties.push([r, c]);
            if (!empties.length) return;
            const [r, c] = empties[Math.floor(Math.random() * empties.length)];
            grid[r][c] = Math.random() < 0.9 ? 2 : 4;
        }

        function init() {
            grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
            score = 0; over = false;
            newTile(); newTile();
            hud.setScore(score);
            hud.setStatus(`最佳: ${best}`);
        }

        function rotate(g) {
            const n = g.length, r = Array.from({ length: n }, () => Array(n).fill(0));
            for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) r[j][n - 1 - i] = g[i][j];
            return r;
        }

        function move(dir) {
            if (over) return false;
            let rotated = grid;
            for (let i = 0; i < dir; i++) rotated = rotate(rotated);
            let changed = false, gained = 0;
            const merged = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));

            for (let r = 0; r < SIZE; r++) {
                let row = rotated[r].filter(v => v !== 0);
                for (let i = 0; i < row.length - 1; i++) {
                    if (row[i] === row[i + 1]) {
                        row[i] *= 2;
                        gained += row[i];
                        if (row[i] === 2048) hud.setStatus('🎉 达成 2048！');
                        row.splice(i + 1, 1);
                    }
                }
                while (row.length < SIZE) row.push(0);
                for (let c = 0; c < SIZE; c++) {
                    if (rotated[r][c] !== row[c]) changed = true;
                    rotated[r][c] = row[c];
                }
            }
            for (let i = 0; i < (4 - dir) % 4; i++) rotated = rotate(rotated);
            grid = rotated;

            if (changed) {
                newTile();
                score += gained;
                hud.setScore(score);
                if (score > best) {
                    best = score;
                    localStorage.setItem('2048_best', best);
                    hud.setStatus(`最佳: ${best}`);
                }
                if (isOver()) {
                    over = true;
                    setTimeout(() => hud.setStatus('💀 游戏结束 - 点击重开'), 200);
                }
            }
            return changed;
        }

        function isOver() {
            for (let r = 0; r < SIZE; r++)
                for (let c = 0; c < SIZE; c++) {
                    if (!grid[r][c]) return false;
                    if (r < SIZE - 1 && grid[r][c] === grid[r + 1][c]) return false;
                    if (c < SIZE - 1 && grid[r][c] === grid[r][1][c + 1]) return false;
                }
            return true;
        }

        function render() {
            ctx.fillStyle = '#0a0e27';
            ctx.fillRect(0, 0, w, h);
            for (let r = 0; r < SIZE; r++) {
                for (let c = 0; c < SIZE; c++) {
                    const v = grid[r][c];
                    const x = offX + c * TILE, y = offY + r * TILE;
                    ctx.fillStyle = COLORS[v] || '#8b5cf6';
                    const m = TILE * 0.05;
                    roundRect(ctx, x + m, y + m, TILE - m * 2, TILE - m * 2, 8);
                    ctx.fill();
                    if (v) {
                        ctx.fillStyle = FG[v] || '#fff';
                        ctx.font = `bold ${v >= 1000 ? TILE * 0.25 : TILE * 0.35}px sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(v, x + TILE / 2, y + TILE / 2);
                    }
                }
            }
            requestAnimationFrame(render);
        }

        function roundRect(ctx, x, y, w, h, r) {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
        }

        const hud = Games.HUD(parent);
        hud.on('restart', init);
        hud.on('pause', () => {});
        Games.keys.on('2048', (k, down) => {
            if (!down || Games.pauseToggle.get()) return;
            const map = { ArrowLeft: 3, ArrowRight: 1, ArrowUp: 0, ArrowDown: 2 };
            if (map[k] !== undefined) move(map[k]);
        });
        Games.touchArrows(canvas, (dir) => {
            const map = { left: 3, right: 1, up: 0, down: 2 };
            if (map[dir] !== undefined) move(map[dir]);
        });

        init();
        render();
    };
})();