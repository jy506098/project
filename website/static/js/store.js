/* ===========================================
   商店页：购买商品
   =========================================== */

(function () {
    'use strict';

    document.querySelectorAll('.buy-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const item = btn.dataset.item;
            if (!confirm(`确认购买「${item}」？`)) return;

            btn.disabled = true;
            const oldText = btn.textContent;
            btn.textContent = '购买中...';

            try {
                const r = await fetch('/buy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ item }),
                });
                const data = await r.json();
                if (data.success) {
                    showFlash('success', data.msg);
                    // 更新顶部积分
                    const pointsEl = document.querySelector('.nav-points');
                    if (pointsEl && data.new_points !== undefined) {
                        pointsEl.textContent = `💰 ${data.new_points}`;
                    }
                    // 刷新页面以同步按钮状态（更简单可靠）
                    setTimeout(() => location.reload(), 800);
                } else {
                    showFlash('error', data.msg || '购买失败');
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