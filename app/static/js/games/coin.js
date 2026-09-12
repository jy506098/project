/* ===========================================
   抛硬币小游戏
   =========================================== */

(function () {
    'use strict';

    window.Games = window.Games || {};
    const Games = window.Games;

    Games['抛硬币小游戏'] = function (canvas) {
        const parent = canvas.parentElement;
        const { w, h } = Games.fitCanvas(canvas, 1);

        const hud = Games.HUD(parent, { scoreLabel: '连对' });
        let streak = 0, bestStreak = 0, choice = '正', spinning = false;

        const ctx = canvas.getContext('2d');
        const cx = w / 2, cy = h / 2;
        const R = Math.min(w, h) * 0.32;

        let angle = 0, angV = 0, side = '正';
        let frame = 0;

        function render() {
            ctx.fillStyle = '#0a0e27';
            ctx.fillRect(0, 0, w, h);

            // 旋转硬币 - 视觉上压扁
            const flat = Math.abs(Math.cos(angle));
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(flat, 1);
            const grad = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
            grad.addColorStop(0, '#fef3c7');
            grad.addColorStop(1, '#f59e0b');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, R, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#92400e';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.fillStyle = '#92400e';
            ctx.font = `bold ${R * 0.7}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(side === '正' ? '正' : '反', 0, 0);
            ctx.restore();

            // 信息
            ctx.fillStyle = '#66fcf1';
            ctx.font = '14px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`连对: ${streak}    最佳: ${bestStreak}`, 10, h - 12);

            frame++;
            if (spinning) {
                angV *= 0.985;
                angle += angV;
                if (Math.abs(angV) < 0.05) {
                    spinning = false;
                    side = (angle % (Math.PI * 2)) > Math.PI ? '正' : '反';
                    hud.setStatus(side === choice ? `✓ 押中 (${side})` : `✗ 失败 (${side})`);
                    if (side === choice) {
                        streak++;
                        bestStreak = Math.max(bestStreak, streak);
                    } else {
                        streak = 0;
                    }
                    hud.setScore(streak);
                }
            }
            requestAnimationFrame(render);
        }

        // 选择区 + 投掷按钮
        const controls = document.createElement('div');
        controls.style.cssText = 'display:flex;gap:.5rem;justify-content:center;margin-top:.5rem;';
        controls.innerHTML = `
            <button data-c="正" class="pick" style="padding:.5rem 1.2rem;border:2px solid #fbbf24;background:#1a1a2e;color:#fbbf24;border-radius:6px;cursor:pointer;font-size:1rem;">押 正</button>
            <button data-c="反" class="pick" style="padding:.5rem 1.2rem;border:2px solid #66fcf1;background:#1a1a2e;color:#66fcf1;border-radius:6px;cursor:pointer;font-size:1rem;">押 反</button>
            <button id="flipBtn" style="padding:.5rem 1.2rem;border:none;background:linear-gradient(135deg,#f72585,#7209b7);color:white;border-radius:6px;cursor:pointer;font-size:1rem;font-weight:bold;">投掷！</button>
        `;
        parent.appendChild(controls);

        controls.querySelectorAll('.pick').forEach(b => {
            b.addEventListener('click', () => {
                if (spinning) return;
                choice = b.dataset.c;
                controls.querySelectorAll('.pick').forEach(x => x.style.opacity = '0.5');
                b.style.opacity = '1';
                hud.setStatus(`已押: ${choice}`);
            });
        });
        controls.querySelector('#flipBtn').addEventListener('click', () => {
            if (spinning) return;
            spinning = true;
            angV = 0.6 + Math.random() * 0.3;
            hud.setStatus('旋转中...');
        });
        hud.on('restart', () => { streak = 0; hud.setScore(0); hud.setStatus(''); });
        hud.on('pause', () => {});

        // 默认选中
        controls.querySelectorAll('.pick')[0].style.opacity = '1';
        controls.querySelectorAll('.pick')[1].style.opacity = '0.5';
        render();
    };
})();