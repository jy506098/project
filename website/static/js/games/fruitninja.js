/* ===========================================
   水果忍者 (Fruit Ninja) - 简化版
   =========================================== */

(function () {
    'use strict';
    window.Games = window.Games || {};
    const Games = window.Games;

    const FRUITS = ['🍎', '🍊', '🍋', '🍉', '🍇', '🍓', '🍑', '🍌', '🥝', '🍍'];
    const COLORS = ['#ef4444', '#f97316', '#fbbf24', '#22c55e', '#a855f7', '#ec4899', '#fb7185', '#facc15', '#84cc16', '#f59e0b'];

    Games['水果忍者'] = function (canvas) {
        const parent = canvas.parentElement;
        const { w, h } = Games.fitCanvas(canvas, 9 / 16);
        const ctx = canvas.getContext('2d');

        let fruits, slices, score, lives, over, spawnTimer;

        function init() {
            fruits = []; slices = []; score = 0; lives = 3; over = false; spawnTimer = 0;
            hud.setScore(0);
            hud.setStatus(`生命: ${'❤'.repeat(lives)}`);
        }

        function spawn() {
            const x = 80 + Math.random() * (w - 160);
            const fruit = {
                x, y: h + 30,
                vx: (w / 2 - x) * 0.012,
                vy: -12 - Math.random() * 3,
                r: 28,
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                emoji: FRUITS[Math.floor(Math.random() * FRUITS.length)],
                rot: 0, rotSpd: (Math.random() - 0.5) * 0.15,
                sliced: false,
            };
            fruits.push(fruit);
            // 有概率同时抛炸弹
            if (Math.random() < 0.15) {
                fruits.push({
                    x: 80 + Math.random() * (w - 160),
                    y: h + 30,
                    vx: (w / 2 - x) * 0.012,
                    vy: -12 - Math.random() * 3,
                    r: 26,
                    color: '#000',
                    emoji: '💣',
                    rot: 0, rotSpd: 0,
                    sliced: false, bomb: true,
                });
            }
        }

        function sliceAt(x, y) {
            for (const f of fruits) {
                if (f.sliced) continue;
                const dx = f.x - x, dy = f.y - y;
                if (Math.sqrt(dx * dx + dy * dy) < f.r) {
                    f.sliced = true;
                    if (f.bomb) {
                        over = true;
                        hud.setStatus('💥 切到炸弹！');
                        return;
                    }
                    score += 10;
                    hud.setScore(score);
                    // 切成两半
                    slices.push({ x: f.x, y: f.y, vx: f.vx - 2, vy: f.vy - 2, color: f.color, life: 1 });
                    slices.push({ x: f.x, y: f.y, vx: f.vx + 2, vy: f.vy - 2, color: f.color, life: 1 });
                }
            }
        }

        function update(dt) {
            if (over) return;
            spawnTimer += dt;
            const interval = Math.max(450, 1200 - score * 5);
            if (spawnTimer > interval) { spawnTimer = 0; spawn(); }

            for (const f of fruits) {
                f.x += f.vx;
                f.y += f.vy;
                f.vy += 0.4; // 重力
                f.rot += f.rotSpd;
                if (f.y > h + 50 && !f.sliced && !f.bomb) {
                    f.sliced = true; // 标记移除
                    lives--;
                    if (lives <= 0) {
                        over = true;
                        hud.setStatus('💀 游戏结束');
                    } else hud.setStatus(`生命: ${'❤'.repeat(lives)}`);
                }
            }
            fruits = fruits.filter(f => f.y < h + 100);
            for (const s of slices) {
                s.x += s.vx; s.y += s.vy; s.vy += 0.4; s.life -= 0.02;
            }
            slices = slices.filter(s => s.life > 0);
        }

        function render() {
            // 背景
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#fef3c7');
            g.addColorStop(1, '#fed7aa');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);

            // 木桌纹理
            ctx.strokeStyle = 'rgba(139, 69, 19, 0.15)';
            for (let i = 0; i < h; i += 30) {
                ctx.beginPath();
                ctx.moveTo(0, i);
                ctx.lineTo(w, i + (Math.sin(i) * 10));
                ctx.stroke();
            }

            // 水果
            ctx.font = `${56}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (const f of fruits) {
                ctx.save();
                ctx.translate(f.x, f.y);
                ctx.rotate(f.rot);
                // 阴影
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.beginPath();
                ctx.ellipse(0, f.r * 0.7, f.r * 0.7, 6, 0, 0, Math.PI * 2);
                ctx.fill();
                // 水果
                ctx.fillText(f.emoji, 0, 0);
                ctx.restore();
            }

            // 切片
            for (const s of slices) {
                ctx.globalAlpha = s.life;
                ctx.fillStyle = s.color;
                ctx.beginPath();
                ctx.arc(s.x, s.y, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 16px serif';
                ctx.fillText('汁', s.x, s.y);
            }
            ctx.globalAlpha = 1;
            requestAnimationFrame(render);
        }

        // 鼠标轨迹 = 刀光
        let lastX = null, lastY = null;
        function drawTrail(x, y) {
            if (lastX === null) { lastX = x; lastY = y; return; }
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();
            lastX = x; lastY = y;
            setTimeout(() => { lastX = null; lastY = null; }, 80);
        }

        function onMove(x, y) {
            drawTrail(x, y);
            sliceAt(x, y);
        }

        canvas.addEventListener('mousemove', (e) => {
            const r = canvas.getBoundingClientRect();
            onMove((e.clientX - r.left) * (canvas.width / r.width),
                   (e.clientY - r.top) * (canvas.height / r.height));
        });
        canvas.addEventListener('touchmove', (e) => {
            const r = canvas.getBoundingClientRect();
            const t = e.touches[0];
            onMove((t.clientX - r.left) * (canvas.width / r.width),
                   (t.clientY - r.top) * (canvas.height / r.height));
            e.preventDefault();
        }, { passive: false });

        const hud = Games.HUD(parent);
        hud.on('restart', init);
        hud.on('pause', () => Games.pauseToggle.toggle());

        let last = performance.now();
        function loop(t) {
            const dt = t - last;
            last = t;
            if (!Games.pauseToggle.get()) update(dt);
            requestAnimationFrame(loop);
        }

        init();
        render();
        requestAnimationFrame(loop);
    };
})();