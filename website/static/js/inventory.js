/* ===========================================
   背包页：使用 / 出售物品
   =========================================== */

(function () {
    'use strict';

    document.querySelectorAll('.use-btn, .sell-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const item = btn.dataset.item;
            const action = btn.dataset.action;
            const verb = action === 'use' ? '使用' : '出售';

            if (action === 'sell' && !confirm(`确认出售「${item}」？`)) return;

            btn.disabled = true;
            const oldText = btn.textContent;
            btn.textContent = `${verb}中...`;

            try {
                const r = await fetch('/use_item', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ item, action }),
                });
                const data = await r.json();
                if (data.success) {
                    showFlash('success', data.msg);
                    // 更新积分
                    const pointsEl = document.querySelector('.nav-points');
                    if (pointsEl && data.new_points !== undefined) {
                        pointsEl.textContent = `💰 ${data.new_points}`;
                    }
                    if (data.redirect_url) {
                        setTimeout(() => location.href = data.redirect_url, 800);
                    } else {
                        setTimeout(() => location.reload(), 800);
                    }
                } else {
                    showFlash('error', data.msg || `${verb}失败`);
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