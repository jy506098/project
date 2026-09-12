/* ===========================================
   游戏中心：购买游戏
   =========================================== */

(function () {
    'use strict';

    document.querySelectorAll('.buy-game-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const game = btn.dataset.game;
            if (!confirm(`确认解锁「${game}」？`)) return;

            btn.disabled = true;
            const oldText = btn.textContent;
            btn.textContent = '解锁中...';

            try {
                const r = await fetch('/buy_game', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ game }),
                });
                const data = await r.json();
                if (data.success) {
                    showFlash('success', data.msg);
                    const pointsEl = document.querySelector('.nav-points');
                    if (pointsEl && data.new_points !== undefined) {
                        pointsEl.textContent = `💰 ${data.new_points}`;
                    }
                    setTimeout(() => location.reload(), 800);
                } else {
                    showFlash('error', data.msg || '解锁失败');
                    btn.disabled = false;
                    btn.textContent = oldText;
                }
            } catch (err) {
                showFlash('error', '网络错误：' + err.message);
                btn.disabled = false;
                btn.textContent = oldText;
            }
        });
    });

    function showFlash(type, msg) {
        const area = document.querySelector('.flash-area') || createFlashArea();
        const div = document.createElement('div');
        div.className = `flash flash-${type}`;
        div.textContent = msg;
        area.appendChild(div);
        setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 500); }, 3000);
    }
    function createFlashArea() {
        const main = document.querySelector('main.container');
        const area = document.createElement('div');
        area.className = 'flash-area';
        main.prepend(area);
        return area;
    }
})();