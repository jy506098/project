/* ===========================================
   全局脚本：时钟、鼠标拖尾、导航栏交互
   =========================================== */

(function () {
    'use strict';

    // ---------- 时钟 ----------
    function updateClock() {
        const el = document.getElementById('navClock');
        if (!el) return;
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        el.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    }
    updateClock();
    setInterval(updateClock, 1000);

    // ---------- 鼠标拖尾 ----------
    const canvas = document.getElementById('mouseTrailCanvas');
    if (canvas && !canvas.classList.contains('hidden')) {
        initMouseTrail(canvas);
    }

    function initMouseTrail(canvas) {
        const ctx = canvas.getContext('2d');
        let config = { enabled: true, color_mode: 'rainbow', shape: 'circle' };

        // 加载用户配置
        fetch('/get_mouse_config')
            .then(r => r.ok ? r.json() : null)
            .then(c => { if (c && typeof c === 'object' && !c.error) config = { ...config, ...c }; })
            .catch(() => {});

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resize();
        window.addEventListener('resize', resize);

        const particles = [];
        const MAX = 60;
        let hue = 0;

        function rand(min, max) { return Math.random() * (max - min) + min; }

        function pickColor() {
            if (config.color_mode === 'cyan') return `rgba(102, 252, 241, ${rand(0.4, 0.9)})`;
            if (config.color_mode === 'random') return `hsl(${rand(0, 360)}, 80%, 60%)`;
            return `hsl(${hue}, 90%, 60%)`;
        }

        function drawShape(x, y, size, color) {
            ctx.fillStyle = color;
            if (config.shape === 'square') {
                ctx.fillRect(x - size / 2, y - size / 2, size, size);
            } else if (config.shape === 'star') {
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const a = (i * 2 * Math.PI / 5) - Math.PI / 2;
                    const r = i % 2 === 0 ? size : size / 2;
                    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
                }
                ctx.closePath();
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.arc(x, y, size / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        window.addEventListener('mousemove', (e) => {
            if (!config.enabled) return;
            particles.push({
                x: e.clientX,
                y: e.clientY,
                size: rand(8, 18),
                life: 1,
                color: pickColor(),
            });
            if (particles.length > MAX) particles.shift();
        });

        function render() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            hue = (hue + 2) % 360;
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.life -= 0.03;
                if (p.life <= 0) { particles.splice(i, 1); continue; }
                ctx.globalAlpha = p.life;
                drawShape(p.x, p.y, p.size * p.life, p.color);
            }
            ctx.globalAlpha = 1;
            requestAnimationFrame(render);
        }
        render();

        // 暴露给其他页面调用以更新配置
        window.updateMouseConfig = (newCfg) => {
            config = { ...config, ...newCfg };
        };
    }

    // ---------- Flash 自动消失 ----------
    document.querySelectorAll('.flash').forEach(el => {
        setTimeout(() => {
            el.style.transition = 'opacity .5s';
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 500);
        }, 4000);
    });
})();