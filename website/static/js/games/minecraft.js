/* ===========================================
   我的世界 - 2D 体素沙盒
   - 点击放置/挖掘方块
   - 1-5 切换方块类型
   - WASD 移动角色（视觉）
   =========================================== */

(function () {
    'use strict';
    window.Games = window.Games || {};
    const Games = window.Games;

    const BLOCK_TYPES = [
        { name: '草', color: '#65a30d', top: '#84cc16' },
        { name: '土', color: '#92400e', top: '#a16207' },
        { name: '石', color: '#6b7280', top: '#9ca3af' },
        { name: '木', color: '#854d0e', top: '#a16207' },
        { name: '水', color: '#0369a1', top: '#0ea5e9' },
    ];

    Games['我的世界'] = function (canvas) {
        const parent = canvas.parentElement;
        const { w, h } = Games.fitCanvas(canvas, 16 / 9);
        const ctx = canvas.getContext('2d');

        const TILE = 32;
        const COLS = Math.floor(w / TILE) + 2;
        const ROWS = Math.floor(h / TILE) + 2;

        let world, char, currentType, message;
        // 世界坐标偏移
        const cam = { x: 0, y: 0 };

        function init() {
            world = {};
            // 生成地形
            for (let c = 0; c < 30; c++) {
                const ground = 5 + Math.floor(Math.sin(c * 0.5) * 2 + Math.random() * 2);
                for (let r = 0; r < ROWS; r++) {
                    if (r > ground) world[`${c},${r}`] = r === ground + 1 ? 0 : (r < ground + 3 ? 1 : 2);
                    if (r === ground + 2 && Math.random() < 0.05) world[`${c},${r}`] = 3; // 树
                }
            }
            char = { x: 5, y: 0 };
            currentType = 0;
            message = '左键挖方块 · 右键放置 · 1-5 选择方块';
            hud.setScore(0);
            hud.setStatus(message);
        }

        function getBlock(c, r) {
            return world[`${c},${r}`] ?? -1;
        }
        function setBlock(c, r, v) {
            if (v < 0) delete world[`${c},${r}`];
            else world[`${c},${r}`] = v;
        }

        function worldToScreen(c, r) {
            return {
                x: c * TILE - cam.x,
                y: r * TILE - cam.y,
            };
        }

        function render() {
            // 天空
            const sky = ctx.createLinearGradient(0, 0, 0, h);
            sky.addColorStop(0, '#0ea5e9');
            sky.addColorStop(1, '#fef3c7');
            ctx.fillStyle = sky;
            ctx.fillRect(0, 0, w, h);

            // 太阳
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(w - 60, 60, 28, 0, Math.PI * 2);
            ctx.fill();

            // 计算可见范围
            const startC = Math.floor(cam.x / TILE);
            const endC = startC + COLS;
            const startR = Math.floor(cam.y / TILE);
            const endR = startR + ROWS;

            // 绘制方块
            for (let c = startC; c <= endC; c++) {
                for (let r = startR; r <= endR; r++) {
                    const b = getBlock(c, r);
                    if (b < 0) continue;
                    const pos = worldToScreen(c, r);
                    if (pos.x > w || pos.x < -TILE || pos.y > h || pos.y < -TILE) continue;
                    const bt = BLOCK_TYPES[b];
                    ctx.fillStyle = bt.color;
                    ctx.fillRect(pos.x, pos.y, TILE, TILE);
                    ctx.fillStyle = bt.top;
                    ctx.fillRect(pos.x, pos.y, TILE, 4);
                    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(pos.x + 0.5, pos.y + 0.5, TILE - 1, TILE - 1);
                }
            }

            // 角色（简单的史蒂夫）
            const chx = char.x * TILE - cam.x;
            const chy = char.y * TILE - cam.y;
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(chx + 8, chy, 16, 16); // 头
            ctx.fillStyle = '#f97316';
            ctx.fillRect(chx + 4, chy + 16, 24, 24); // 身体
            ctx.fillStyle = '#fff';
            ctx.fillRect(chx + 11, chy + 5, 4, 4); // 左眼
            ctx.fillRect(chx + 17, chy + 5, 4, 4); // 右眼
            ctx.fillStyle = '#000';
            ctx.fillRect(chx + 12, chy + 6, 2, 2);
            ctx.fillRect(chx + 18, chy + 6, 2, 2);

            // HUD
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(10, 10, 180, 36);
            ctx.fillStyle = '#fff';
            ctx.font = '14px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`方块: ${BLOCK_TYPES[currentType].name}`, 20, 28);
            ctx.fillText(`位置: (${char.x}, ${char.y})`, 20, 44);

            // 物品栏
            for (let i = 0; i < BLOCK_TYPES.length; i++) {
                const bx = 10 + i * 36, by = h - 50;
                ctx.fillStyle = i === currentType ? '#fbbf24' : 'rgba(255,255,255,0.1)';
                ctx.fillRect(bx, by, 32, 32);
                ctx.fillStyle = BLOCK_TYPES[i].color;
                ctx.fillRect(bx + 4, by + 4, 24, 24);
                ctx.fillStyle = '#000';
                ctx.font = 'bold 12px monospace';
                ctx.fillText(i + 1, bx + 2, by + 12);
            }

            // 提示
            ctx.fillStyle = '#fff';
            ctx.font = '12px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(message, w - 10, 20);

            requestAnimationFrame(render);
        }

        function screenToWorld(mx, my) {
            return {
                c: Math.floor((mx + cam.x) / TILE),
                r: Math.floor((my + cam.y) / TILE),
            };
        }

        canvas.addEventListener('click', (e) => {
            const r = canvas.getBoundingClientRect();
            const mx = (e.clientX - r.left) * (canvas.width / r.width);
            const my = (e.clientY - r.top) * (canvas.height / r.height);
            const { c, r: row } = screenToWorld(mx, my);
            // 左键挖
            const b = getBlock(c, row);
            if (b >= 0) {
                setBlock(c, row, -1);
                message = `挖掉 (${c}, ${row})`;
                hud.setScore(score());
            }
        });
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const r = canvas.getBoundingClientRect();
            const mx = (e.clientX - r.left) * (canvas.width / r.width);
            const my = (e.clientY - r.top) * (canvas.height / r.height);
            const { c, r: row } = screenToWorld(mx, my);
            if (getBlock(c, row) < 0) {
                setBlock(c, row, currentType);
                message = `放置 ${BLOCK_TYPES[currentType].name} @ (${c}, ${row})`;
                hud.setScore(score());
            }
        });

        function score() {
            return Object.keys(world).length;
        }

        const hud = Games.HUD(parent, { scoreLabel: '方块' });
        hud.on('restart', init);
        hud.on('pause', () => Games.pauseToggle.toggle());

        Games.keys.on('mc', (k, down) => {
            if (!down) return;
            if (k >= '1' && k <= '5') {
                currentType = parseInt(k) - 1;
                hud.setStatus(`选择: ${BLOCK_TYPES[currentType].name}`);
            }
            else if (k === 'w' || k === 'W' || k === 'ArrowUp') { char.y--; clampChar(); }
            else if (k === 's' || k === 'S' || k === 'ArrowDown') { char.y++; clampChar(); }
            else if (k === 'a' || k === 'A' || k === 'ArrowLeft') { char.x--; cam.x -= TILE; }
            else if (k === 'd' || k === 'D' || k === 'ArrowRight') { char.x++; cam.x += TILE; }
            else if (k === ' ') {
                // 跳跃 - 简单实现
                char.y--;
                setTimeout(() => { if (getBlock(char.x, char.y + 1) < 0) char.y++; }, 200);
                clampChar();
            }
            // 摄像机跟随
            cam.x = char.x * TILE - w / 2 + TILE / 2;
            cam.y = char.y * TILE - h / 2 + TILE / 2;
        });

        function clampChar() {
            char.x = Math.max(0, char.x);
            char.y = Math.max(0, char.y);
        }

        init();
        cam.x = char.x * TILE - w / 2 + TILE / 2;
        cam.y = char.y * TILE - h / 2 + TILE / 2;
        render();
    };
})();