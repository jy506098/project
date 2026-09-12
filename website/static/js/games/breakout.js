/* ===========================================
   打砖块 (Breakout)
   =========================================== */

(function () {
    'use strict';
    window.Games = window.Games || {};
    const Games = window.Games;

    Games['打砖块'] = function (canvas) {
        const parent = canvas.parentElement;
        const { w, h } = Games.fitCanvas(canvas, 4 / 3);
        const ctx = canvas.getContext('2d');

        const COLS = 8, ROWS = 6;
        const PADDLE_W = 90, PADDLE_H = 12;
        const BALL_R = 8;

        let paddle, balls, bricks, score, lives, over;

        function init() {
            paddle = { x: w / 2 - PADDLE_W / 2, y: h - 30, w: PADDLE_W, h: PADDLE_H };
            balls = [{ x: w / 2, y: paddle.y - BALL_R, vx: 3, vy: -4 }];
            bricks = [];
            score = 0; lives = 3; over = false;

            const bw = w / COLS, bh = 24;
            const colors = ['#ef4444', '#f97316', '#fbbf24', '#22c55e', '#06b6d4', '#8b5cf6'];
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    bricks.push({ x: c * bw + 2, y: 40 + r * bh, w: bw - 4, h: bh - 2, color: colors[r], alive: true });
                }
            }
            hud.setScore(score);
            hud.setStatus(`生命: ${'❤'.repeat(lives)}`);
        }

        function update() {
            if (over || Games.pauseToggle.get()) return;

            // 挡板跟随鼠标 / 键盘
            const mouse = mouseX;
            if (mouse !== null) {
                paddle.x = Math.max(0, Math.min(w - paddle.w, mouse - paddle.w / 2));
            }
            paddle.x += (paddleVX || 0);
            paddle.x = Math.max(0, Math.min(w - paddle.w, paddle.x));

            for (const ball of balls) {
                ball.x += ball.vx;
                ball.y += ball.vy;
                if (ball.x < BALL_R || ball.x > w - BALL_R) ball.vx *= -1;
                if (ball.y < BALL_R) ball.vy *= -1;
                if (ball.y > h) {
                    ball.dead = true;
                    continue;
                }
                // 挡板
                if (ball.x > paddle.x && ball.x < paddle.x + paddle.w &&
                    ball.y + BALL_R > paddle.y && ball.y - BALL_R < paddle.y + paddle.h) {
                    ball.vy = -Math.abs(ball.vy);
                    // 角度变化
                    const hit = (ball.x - paddle.x) / paddle.w;
                    ball.vx = (hit - 0.5) * 8;
                }
                // 砖块
                for (const b of bricks) {
                    if (!b.alive) continue;
                    if (ball.x > b.x && ball.x < b.x + b.w && ball.y > b.y && ball.y < b.y + b.h) {
                        b.alive = false;
                        ball.vy *= -1;
                        score += 10;
                        hud.setScore(score);
                        break;
                    }
                }
            }
            balls = balls.filter(b => !b.dead);
            if (balls.length === 0) {
                lives--;
                if (lives <= 0) {
                    over = true;
                    hud.setStatus('💀 游戏结束');
                } else {
                    balls.push({ x: w / 2, y: paddle.y - BALL_R, vx: 3, vy: -4 });
                    hud.setStatus(`生命: ${'❤'.repeat(lives)}`);
                }
            }
            if (bricks.every(b => !b.alive)) {
                over = true;
                hud.setStatus(`🎉 通关！得分 ${score}`);
            }
        }

        function render() {
            ctx.fillStyle = '#0a0e27';
            ctx.fillRect(0, 0, w, h);
            // 砖块
            for (const b of bricks) {
                if (!b.alive) continue;
                ctx.fillStyle = b.color;
                ctx.fillRect(b.x, b.y, b.w, b.h);
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fillRect(b.x, b.y, b.w, 4);
            }
            // 挡板
            const pg = ctx.createLinearGradient(0, paddle.y, 0, paddle.y + paddle.h);
            pg.addColorStop(0, '#66fcf1');
            pg.addColorStop(1, '#06b6d4');
            ctx.fillStyle = pg;
            ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
            // 球
            for (const ball of balls) {
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fbbf24';
                ctx.beginPath();
                ctx.arc(ball.x, ball.y, BALL_R - 3, 0, Math.PI * 2);
                ctx.fill();
            }
            requestAnimationFrame(render);
        }

        let mouseX = null, paddleVX = 0;
        canvas.addEventListener('mousemove', (e) => {
            const r = canvas.getBoundingClientRect();
            mouseX = (e.clientX - r.left) * (canvas.width / r.width);
        });
        canvas.addEventListener('mouseleave', () => { mouseX = null; paddleVX = 0; });
        canvas.addEventListener('touchmove', (e) => {
            const r = canvas.getBoundingClientRect();
            mouseX = (e.touches[0].clientX - r.left) * (canvas.width / r.width);
            e.preventDefault();
        }, { passive: false });

        const hud = Games.HUD(parent);
        hud.on('restart', init);
        hud.on('pause', () => Games.pauseToggle.toggle());
        Games.keys.on('breakout', (k, down) => {
            if (down) {
                if (k === 'ArrowLeft') paddleVX = -6;
                else if (k === 'ArrowRight') paddleVX = 6;
            } else if (k === 'ArrowLeft' || k === 'ArrowRight') paddleVX = 0;
        });

        function loop() { update(); requestAnimationFrame(loop); }
        init(); render(); loop();
    };
})();