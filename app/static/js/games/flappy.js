/* ===========================================
   飞扬的小鸟 (Flappy Bird)
   =========================================== */

(function () {
    'use strict';
    window.Games = window.Games || {};
    const Games = window.Games;

    Games['飞扬的小鸟'] = function (canvas) {
        const parent = canvas.parentElement;
        const { w, h } = Games.fitCanvas(canvas, 9 / 16);
        const ctx = canvas.getContext('2d');

        const GROUND = 60;
        const GRAVITY = 0.4;
        const JUMP = -7;
        const PIPE_W = 60;
        const PIPE_GAP = 160;
        const PIPE_SPEED = 2.4;

        let bird, pipes, score, over, started;

        function init() {
            bird = { x: w * 0.25, y: h / 2, vy: 0, r: 14 };
            pipes = [];
            score = 0; over = false; started = false;
            hud.setScore(0);
            hud.setStatus('按 空格 / 点击 开始');
            spawnPipe();
        }

        function spawnPipe() {
            const topH = 50 + Math.random() * (h - GROUND - PIPE_GAP - 100);
            pipes.push({ x: w, topH, scored: false });
        }

        function flap() {
            if (over) { init(); return; }
            started = true;
            bird.vy = JUMP;
        }

        function update() {
            if (over || !started) return;
            bird.vy += GRAVITY;
            bird.y += bird.vy;

            for (const p of pipes) p.x -= PIPE_SPEED;
            if (pipes.length && pipes[0].x + PIPE_W < 0) pipes.shift();
            if (pipes.length < 4 || pipes[pipes.length - 1].x < w - 220) spawnPipe();

            for (const p of pipes) {
                if (!p.scored && p.x + PIPE_W < bird.x) {
                    p.scored = true;
                    score++;
                    hud.setScore(score);
                }
                // 碰撞
                if (bird.x + bird.r > p.x && bird.x - bird.r < p.x + PIPE_W) {
                    if (bird.y - bird.r < p.topH || bird.y + bird.r > p.topH + PIPE_GAP) {
                        over = true;
                        hud.setStatus('💥 撞了！按 空格 重开');
                    }
                }
            }
            if (bird.y + bird.r > h - GROUND || bird.y - bird.r < 0) {
                over = true;
                hud.setStatus('💥 撞了！按 空格 重开');
            }
        }

        function render() {
            // 天空
            const sky = ctx.createLinearGradient(0, 0, 0, h);
            sky.addColorStop(0, '#4dd0e1');
            sky.addColorStop(1, '#80deea');
            ctx.fillStyle = sky;
            ctx.fillRect(0, 0, w, h);

            // 云
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            for (let i = 0; i < 3; i++) {
                const t = (Date.now() / 50 + i * 200) % (w + 100);
                ctx.beginPath();
                ctx.arc(t, 60 + i * 20, 18, 0, Math.PI * 2);
                ctx.arc(t + 20, 60 + i * 20, 24, 0, Math.PI * 2);
                ctx.arc(t + 40, 60 + i * 20, 18, 0, Math.PI * 2);
                ctx.fill();
            }

            // 管道
            for (const p of pipes) {
                ctx.fillStyle = '#22c55e';
                ctx.fillRect(p.x, 0, PIPE_W, p.topH);
                ctx.fillRect(p.x - 3, p.topH - 20, PIPE_W + 6, 20);
                ctx.fillRect(p.x, p.topH + PIPE_GAP, PIPE_W, h - GROUND - p.topH - PIPE_GAP);
                ctx.fillRect(p.x - 3, p.topH + PIPE_GAP, PIPE_W + 6, 20);
                // 边框
                ctx.strokeStyle = '#15803d';
                ctx.lineWidth = 2;
                ctx.strokeRect(p.x, 0, PIPE_W, p.topH);
                ctx.strokeRect(p.x, p.topH + PIPE_GAP, PIPE_W, h - GROUND - p.topH - PIPE_GAP);
            }

            // 地面
            ctx.fillStyle = '#84cc16';
            ctx.fillRect(0, h - GROUND, w, GROUND);
            ctx.fillStyle = '#65a30d';
            for (let x = 0; x < w; x += 20) ctx.fillRect(x, h - GROUND, 10, 5);

            // 小鸟
            ctx.save();
            ctx.translate(bird.x, bird.y);
            ctx.rotate(Math.max(-0.4, Math.min(0.6, bird.vy / 10)));
            // 身体
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(0, 0, bird.r, 0, Math.PI * 2);
            ctx.fill();
            // 翅膀
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.ellipse(-4, 4, 8, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            // 眼睛
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(5, -3, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(6, -3, 2, 0, Math.PI * 2);
            ctx.fill();
            // 嘴
            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.moveTo(bird.r - 2, -2);
            ctx.lineTo(bird.r + 6, 0);
            ctx.lineTo(bird.r - 2, 3);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            requestAnimationFrame(render);
        }

        function loop() {
            update();
            requestAnimationFrame(loop);
        }

        const hud = Games.HUD(parent);
        hud.on('restart', init);
        hud.on('pause', () => Games.pauseToggle.toggle());

        Games.keys.on('flappy', (k, down) => {
            if (down && (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W')) flap();
        });
        canvas.addEventListener('click', flap);
        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); flap(); });

        init();
        render();
        loop();
    };
})();