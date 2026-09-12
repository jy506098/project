/* ===========================================
   音乐播放器 UI 逻辑
   - 渲染播放列表
   - 控制播放 / 暂停 / 切换 / 音量
   - 简单的可视化
   =========================================== */

(function () {
    'use strict';

    if (!window.Music) return;

    const playlistEl = document.getElementById('playlistEl');
    const playBtn = document.getElementById('playBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const volSlider = document.getElementById('volumeSlider');
    const volValue = document.getElementById('volumeValue');
    const trackTitle = document.getElementById('trackTitle');
    const trackGenre = document.getElementById('trackGenre');
    const trackDesc = document.getElementById('trackDesc');
    const albumArt = document.getElementById('albumArt');
    const visualizer = document.getElementById('visualizer');

    let currentIdx = -1;
    let playing = false;

    // 渲染播放列表
    function render() {
        playlistEl.innerHTML = '';
        Music.tracks.forEach((t, i) => {
            const li = document.createElement('li');
            li.className = 'playlist-item' + (i === currentIdx ? ' active' : '');
            li.innerHTML = `
                <span class="name">${t.name}</span>
                <span class="genre">${t.genre}</span>
                <span class="desc">${t.desc}</span>
            `;
            li.addEventListener('click', () => play(i));
            playlistEl.appendChild(li);
        });
    }
    render();

    function play(idx) {
        if (currentIdx === idx && playing) {
            // 已在播放 → 暂停
            Music.stop();
            playing = false;
            playBtn.textContent = '▶ 播放';
            albumArt.classList.remove('playing');
            render();
            return;
        }
        Music.stop();
        const t = Music.tracks[idx];
        if (!t) return;
        currentIdx = idx;
        try {
            Music.play(t.id, volSlider.value / 100);
            playing = true;
            playBtn.textContent = '⏸ 暂停';
            albumArt.classList.add('playing');
            trackTitle.textContent = t.name;
            trackGenre.textContent = t.genre;
            trackDesc.textContent = t.desc;
            albumArt.textContent = t.name.split(' ')[0]; // emoji
            render();
        } catch (err) {
            console.error('播放失败:', err);
            alert('播放失败：' + err.message + '\n（部分浏览器要求用户先与页面交互）');
        }
    }

    playBtn.addEventListener('click', () => {
        if (currentIdx < 0) currentIdx = 0;
        play(currentIdx);
    });
    prevBtn.addEventListener('click', () => {
        const next = (currentIdx - 1 + Music.tracks.length) % Music.tracks.length;
        play(next);
    });
    nextBtn.addEventListener('click', () => {
        const next = (currentIdx + 1) % Music.tracks.length;
        play(next);
    });

    volSlider.addEventListener('input', () => {
        const v = parseInt(volSlider.value, 10);
        volValue.textContent = v + '%';
        Music.setVolume(v / 100);
    });

    // 简易可视化（伪）
    function animateVisualizer() {
        if (!visualizer) return;
        const bars = visualizer.querySelectorAll('.bar');
        if (!bars.length) {
            for (let i = 0; i < 32; i++) {
                const b = document.createElement('div');
                b.className = 'bar';
                b.style.height = '4px';
                visualizer.appendChild(b);
            }
        }
        const all = visualizer.querySelectorAll('.bar');
        all.forEach((b, i) => {
            const h = playing
                ? 4 + Math.abs(Math.sin(Date.now() / 100 + i * 0.4)) * 50 +
                  Math.random() * 6
                : 4;
            b.style.height = h + 'px';
        });
        requestAnimationFrame(animateVisualizer);
    }
    animateVisualizer();
})();