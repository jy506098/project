/* ===========================================
   游戏通用框架
   - 共享画布初始化、键盘、触摸、UI 控件
   - 每个游戏通过 window.Games.<name>(canvas, opts) 暴露入口
   =========================================== */

(function () {
    'use strict';

    const Games = window.Games = window.Games || {};

    // 工具：根据父容器尺寸自适应 canvas
    Games.fitCanvas = function (canvas, aspect) {
        aspect = aspect || 4 / 3;
        const parent = canvas.parentElement;
        const maxW = Math.min(parent.clientWidth - 40, 800);
        let cw = maxW;
        let ch = Math.round(cw / aspect);
        const maxH = Math.min(window.innerHeight - 280, 600);
        if (ch > maxH) {
            ch = maxH;
            cw = Math.round(ch * aspect);
        }
        canvas.style.width = cw + 'px';
        canvas.style.height = ch + 'px';
        canvas.width = cw;
        canvas.height = ch;
        return { w: cw, h: ch };
    };

    // 创建统一 HUD（分数、提示、按钮）
    Games.HUD = function (parent, opts) {
        opts = opts || {};
        const bar = document.createElement('div');
        bar.className = 'game-hud';
        bar.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:.5rem;padding:.5rem 1rem;background:rgba(0,0,0,.7);color:#fff;border-radius:6px;margin-bottom:.5rem;font-family:monospace;flex-wrap:wrap;';
        bar.innerHTML = `
            <span class="hud-score" style="color:#66fcf1;font-weight:bold;">${opts.scoreLabel || '得分'}: 0</span>
            <span class="hud-status" style="color:#fbbf24;"></span>
            <div class="hud-actions" style="display:flex;gap:.25rem;">
                <button class="hud-btn" data-act="pause" style="padding:.3rem .7rem;border-radius:4px;border:1px solid #66fcf1;background:transparent;color:#66fcf1;cursor:pointer;">暂停</button>
                <button class="hud-btn" data-act="restart" style="padding:.3rem .7rem;border-radius:4px;border:1px solid #f72585;background:transparent;color:#f72585;cursor:pointer;">重开</button>
            </div>
        `;
        parent.insertBefore(bar, parent.firstChild);
        return {
            el: bar,
            setScore(v) { bar.querySelector('.hud-score').textContent = (opts.scoreLabel || '得分') + ': ' + v; },
            setStatus(html) { bar.querySelector('.hud-status').innerHTML = html; },
            on(name, cb) { bar.querySelector(`[data-act="${name}"]`).addEventListener('click', cb); },
        };
    };

    // 通用按键监听（避免重复监听）
    Games.keys = (() => {
        const map = new Map();   // gameName -> handler
        const state = {};
        window.addEventListener('keydown', (e) => {
            state[e.key] = true;
            for (const h of map.values()) h(e.key, true);
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
        });
        window.addEventListener('keyup', (e) => {
            state[e.key] = false;
            for (const h of map.values()) h(e.key, false);
        });
        return {
            is: (k) => !!state[k],
            on: (name, fn) => { map.set(name, fn); },
            off: (name) => { map.delete(name); },
        };
    })();

    // 触屏滑动 → 方向键
    Games.touchArrows = function (canvas, callback) {
        let sx = null, sy = null;
        canvas.addEventListener('touchstart', (e) => {
            const t = e.touches[0];
            sx = t.clientX; sy = t.clientY;
        }, { passive: true });
        canvas.addEventListener('touchend', (e) => {
            if (sx === null) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - sx, dy = t.clientY - sy;
            const T = 25;
            if (Math.abs(dx) > Math.abs(dy)) {
                if (dx > T) callback('right');
                else if (dx < -T) callback('left');
            } else {
                if (dy > T) callback('down');
                else if (dy < -T) callback('up');
            }
            sx = sy = null;
        });
    };

    // 暂停/继续
    Games.pauseToggle = (function () {
        let paused = false;
        return {
            get: () => paused,
            toggle: () => { paused = !paused; return paused; },
        };
    })();

    console.log('[Games] framework loaded');
})();