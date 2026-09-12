/* ===========================================
   雷电战机 - 竖版射击游戏
   =========================================== */

(function () {
    'use strict';
    window.Games = window.Games || {};
    const Games = window.Games;

    Games['雷电战机'] = function (canvas) {
        const parent = canvas.parentElement;
        const { w, h } = Games.fitCanvas(canvas, 9 / 16);
        const ctx = canvas.getContext('2d');

        let player, bullets, enemies, particles, score, lives, over, spawnT, level;

        function init() {
            player = { x: w / 2, y: h - 60, w: 30, h: 30, shootCD: 0 };
            bullets = []; enemies = []; particles = [];
            score = 0; lives = 3; over = false; spawnT = 0; level = 1;
            hud.setScore(0);
            hud.setStatus(`生命: ${'❤'.repeat(lives)}`);
        }

        function spawn() {
            const x = 30 + Math.random() * (w - 60);
            const type = Math.random() < 0.2 ? 'big' : 'small';
            enemies.push({
                x, y: -30, w: type === 'big' ? 40 : 24, h: type === 'big' ? 40 : 24,
                hp: type === 'big' ? 3 : 1, color: type === 'big' ? '#a855f7' : '#ef4444',
                vy: type === 'big' ? 1 : 2 + level * 0.2,
                vx: (Math.random() - 0.5) * 1.5,
                type,
            });
        }

        function update(dt) {
            if (over || Games.pauseToggle.get()) return;
            spawnT += dt;
            const interval = Math.max(400, 1000 - level * 50);
            if (spawnT > interval) { spawnT = 0; spawn(); }
            if (score > level * 200) level++;

            // 玩家射击
            player.shootCD -= dt;
            if (player.shootCD <= 0 && Games.keys.is(' ') || Games.keys.is('ArrowUp')) {
                bullets.push({ x: player.x, y: player.y - 15, vy: -8, w: 4, h: 12 });
                player.shootCD = 180;
            }

            // 移动
            if (Games.keys.is('ArrowLeft')) player.x -= 5;
            if (Games.keys.is('ArrowRight')) player.x += 5;
            player.x = Math.max(player.w / 2, Math.min(w - player.w / 2, player.x));

            // 子弹
            for (const b of bullets) b.y += b.vy;
            bullets = bullets.filter(b => b.y > -20);

            // 敌人
            for (const e of enemies) {
                e.x += e.vx;
                e.y += e.vy;
                if (e.x < e.w / 2 || e.x > w - e.w / 2) e.vx *= -1;
            }
            enemies = enemies.filter(e => e.y < h + 50);

            // 碰撞
            for (const b of bullets) {
                for (const e of enemies) {
                    if (Math.abs(b.x - e.x) < (e.w + b.w) / 2 && Math.abs(b.y - e.y) < (e.h + b.h) / 2) {
                        e.hp--; b.dead = true;
                        explode(e.x, e.y, e.color);
                        if (e.hp <= 0) {
                            e.dead = true;
                            score += e.type === 'big' ? 50 : 10;
                            hud.setScore(score);
                        }
                        break;
                    }
                }
            }
            bullets = bullets.filter(b => !b.dead);
            enemies = enemies.filter(e => !e.dead);

            // 玩家撞敌人
            for (const e of enemies) {
                if (Math.abs(player.x - e.x) < (player.w + e.w) / 2 && Math.abs(player.y - e.y) < (player.h + e.h) / 2) {
                    e.dead = true;
                    explode(e.x, e.y, '#fbbf24');
                    explode(player.x, player.y, '#66fcf1');
                    lives--;
                    if (lives <= 0) {
                        over = true;
                        hud.setStatus('💥 击毁');
                    } else {
                        hud.setStatus(`生命: ${'❤'.repeat(lives)}`);
                        player.x = w / 2; player.y = h - 60;
                    }
                }
            }
            enemies = enemies.filter(e => !e.dead);

            // 粒子
            for (const p of particles) { p.x += p.vx; p.y += p.vy; p.life -= 0.02; }
            particles = particles.filter(p => p.life > 0);
        }

        function explode(x, y, color) {
            for (let i = 0; i < 12; i++) {
                const a = Math.random() * Math.PI * 2;
                particles.push({
                    x, y, vx: Math.cos(a) * (1 + Math.random() * 3),
                    vy: Math.sin(a) * (1 + Math.random() * 3),
                    life: 1, color, r: 2 + Math.random() * 3,
                });
            }
        }

        function render() {
            // 星空
            ctx.fillStyle = '#0a0e27';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#fff';
            for (let i = 0; i < 50; i++) {
                const x = (i * 73 + Date.now() / 30) % w;
                const y = (i * 47) % h;
                ctx.fillRect(x, y, 1.5, 1.5);
            }

            // 玩家战机
            if (!over) {
                ctx.fillStyle = '#66fcf1';
                ctx.beginPath();
                ctx.moveTo(player.x, player.y - 15);
                ctx.lineTo(player.x - 15, player.y + 15);
                ctx.lineTo(player.x + 15, player.y + 15);
                ctx.closePath();
                ctx.fill();
                // 火焰
                ctx.fillStyle = '#f97316';
                const flame = Math.sin(Date.now() / 50) * 3 + 8;
                ctx.beginPath();
                ctx.moveTo(player.x - 5, player.y + 12);
                ctx.lineTo(player.x, player.y + 12 + flame);
                ctx.lineTo(player.x + 5, player.y + 12);
                ctx.fill();
            }

            // 子弹
            for (const b of bullets) {
                ctx.fillStyle = '#fbbf24';
                ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
                ctx.fillStyle = '#fff';
                ctx.fillRect(b.x - 1, b.y - b.h / 2, 2, b.h);
            }

            // 敌人
            for (const e of enemies) {
                ctx.fillStyle = e.color;
                ctx.beginPath();
                ctx.moveTo(e.x, e.y + e.h / 2);
                ctx.lineTo(e.x - e.w / 2, e.y - e.h / 2);
                ctx.lineTo(e.x + e.w / 2, e.y - e.h / 2);
                ctx.closePath();
                ctx.fill();
            }

            // 粒子
            for (const p of particles) {
                ctx.globalAlpha = p.life;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            requestAnimationFrame(render);
        }

        const hud = Games.HUD(parent);
        hud.on('restart', init);
        hud.on('pause', () => Games.pauseToggle.toggle());

        let lastT = performance.now();
        function loop(t) {
            const dt = t - lastT;
            lastT = t;
            update(dt);
            requestAnimationFrame(loop);
        }
        init(); render(); requestAnimationFrame(loop);
    };
})();