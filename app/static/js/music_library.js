/* ===========================================
   音乐库 - Web Audio API 程序化生成
   - 无需外部音频文件，纯合成
   - 提供多种风格：lofi / ambient / focus / nature / 降噪白噪
   - 自动循环，可调节音量、播放/暂停
   =========================================== */

(function () {
    'use strict';

    const Music = window.Music = {};

    let audioCtx = null;
    function getCtx() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }

    // ---------- 工具：MIDI 转频率 ----------
    const note = (n) => 440 * Math.pow(2, (n - 69) / 12);

    // ---------- 主合成器：Lo-Fi 钢琴 ----------
    Music.lofi = function (opts = {}) {
        const ctx = getCtx();
        const master = ctx.createGain();
        master.gain.value = opts.volume || 0.4;
        master.connect(ctx.destination);

        const stop = { v: false };
        const oscillators = [];

        // 节奏 70 BPM
        const BPM = 70;
        const beat = 60 / BPM;

        // 和弦进行 (Cmaj7 - Am7 - Dm7 - G7)
        const progressions = [
            [60, 64, 67, 71],   // Cmaj7
            [57, 60, 64, 67],   // Am7
            [62, 65, 69, 72],   // Dm7
            [55, 59, 62, 65],   // G7
        ];

        // 钢琴声 - 用正弦波 + 衰减包络模拟
        function playPiano(midi, when, duration) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 1200;

            osc.type = 'triangle';
            osc.frequency.value = note(midi);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(master);

            const t = when;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

            osc.start(t);
            osc.stop(t + duration);
            oscillators.push(osc);
        }

        // 低音 - 圆滑的正弦
        function playBass(midi, when, duration) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = note(midi - 12);
            osc.connect(gain);
            gain.connect(master);

            const t = when;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.25, t + 0.05);
            gain.gain.linearRampToValueAtTime(0.15, t + duration * 0.5);
            gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

            osc.start(t);
            osc.stop(t + duration);
            oscillators.push(osc);
        }

        // 鼓点 - 噪声爆发
        function playKick(when) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.setValueAtTime(120, when);
            osc.frequency.exponentialRampToValueAtTime(0.001, when + 0.15);
            osc.connect(gain);
            gain.connect(master);
            gain.gain.setValueAtTime(0.4, when);
            gain.gain.exponentialRampToValueAtTime(0.001, when + 0.15);
            osc.start(when);
            osc.stop(when + 0.15);
            oscillators.push(osc);
        }

        function playHat(when) {
            const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 7000;
            const gain = ctx.createGain();
            gain.gain.value = 0.08;
            src.connect(filter);
            filter.connect(gain);
            gain.connect(master);
            src.start(when);
        }

        let bar = 0;
        function tick() {
            if (stop.v) return;
            const t = ctx.currentTime + 0.05;
            const chord = progressions[bar % progressions.length];

            // 每拍一个和弦
            for (const n of chord) playPiano(n, t, beat * 1.5);

            // 根音
            playBass(chord[0], t, beat * 2);

            // 鼓点（每拍） - 简化版
            if (bar % 2 === 0) playKick(t);
            playHat(t + beat / 2);

            bar++;
            setTimeout(tick, beat * 1000);
        }
        tick();

        return {
            stop() { stop.v = true; oscillators.forEach(o => { try { o.stop(); } catch (e) {} }); master.disconnect(); },
            setVolume(v) { master.gain.value = v; },
        };
    };

    // ---------- Ambient Pad ----------
    Music.ambient = function (opts = {}) {
        const ctx = getCtx();
        const master = ctx.createGain();
        master.gain.value = opts.volume || 0.35;
        master.connect(ctx.destination);

        const stop = { v: false };
        const oscs = [];

        // 缓慢的和弦琶音
        const scale = [60, 62, 64, 67, 69, 72]; // C 大调 6 声音阶
        let idx = 0;

        function pad(midi, t, dur) {
            // 三种波形叠加做 pad
            const types = ['sine', 'triangle', 'sine'];
            const detunes = [0, 5, -7];
            types.forEach((tp, i) => {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 800;

                o.type = tp;
                o.frequency.value = note(midi);
                o.detune.value = detunes[i];
                o.connect(filter);
                filter.connect(g);
                g.connect(master);

                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(0.15, t + 1);
                g.gain.linearRampToValueAtTime(0.1, t + dur * 0.7);
                g.gain.exponentialRampToValueAtTime(0.001, t + dur);

                o.start(t);
                o.stop(t + dur);
                oscs.push(o);
            });
        }

        function tick() {
            if (stop.v) return;
            const t = ctx.currentTime + 0.05;
            const m1 = scale[idx % scale.length];
            const m2 = scale[(idx + 2) % scale.length] + 12;
            pad(m1, t, 8);
            pad(m2, t + 2, 6);
            idx++;
            setTimeout(tick, 6000);
        }
        tick();

        return {
            stop() { stop.v = true; oscs.forEach(o => { try { o.stop(); } catch (e) {} }); master.disconnect(); },
            setVolume(v) { master.gain.value = v; },
        };
    };

    // ---------- Focus: 双耳节拍（增强专注力）----------
    Music.focus = function (opts = {}) {
        const ctx = getCtx();
        const master = ctx.createGain();
        master.gain.value = opts.volume || 0.25;
        master.connect(ctx.destination);

        const stop = { v: false };

        // 双耳节拍: 左耳 200Hz, 右耳 207Hz (Beta波 14Hz, 提升专注)
        const lGain = ctx.createGain();
        const rGain = ctx.createGain();
        const merger = ctx.createChannelMerger(2);
        lGain.connect(merger, 0, 0);
        rGain.connect(merger, 0, 1);
        merger.connect(master);

        const lOsc = ctx.createOscillator();
        const rOsc = ctx.createOscillator();
        lOsc.type = 'sine';
        rOsc.type = 'sine';
        lOsc.frequency.value = 200;
        rOsc.frequency.value = 214; // 14Hz Beta wave
        lOsc.connect(lGain);
        rOsc.connect(rGain);

        lGain.gain.value = 0.3;
        rGain.gain.value = 0.3;

        lOsc.start();
        rOsc.start();

        // 加上柔和的粉红噪声作为背景
        const bufferSize = 2 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99765 * b0 + white * 0.0990460;
            b1 = 0.96300 * b1 + white * 0.2965164;
            b2 = 0.57000 * b2 + white * 1.0526913;
            data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.05;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;
        const noiseGain = ctx.createGain();
        noiseGain.gain.value = 0.1;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 600;
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(master);
        noise.start();

        return {
            stop() {
                stop.v = true;
                try { lOsc.stop(); rOsc.stop(); noise.stop(); } catch (e) {}
                master.disconnect();
            },
            setVolume(v) { master.gain.value = v; },
        };
    };

    // ---------- Nature: 雨声 + 风声合成 ----------
    Music.nature = function (opts = {}) {
        const ctx = getCtx();
        const master = ctx.createGain();
        master.gain.value = opts.volume || 0.4;
        master.connect(ctx.destination);

        const stop = { v: false };

        // 雨声：白噪声 + 高通
        const rainBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const rd = rainBuffer.getChannelData(0);
        for (let i = 0; i < rd.length; i++) rd[i] = Math.random() * 2 - 1;
        const rain = ctx.createBufferSource();
        rain.buffer = rainBuffer; rain.loop = true;
        const rainFilter = ctx.createBiquadFilter();
        rainFilter.type = 'bandpass';
        rainFilter.frequency.value = 3000;
        rainFilter.Q.value = 0.5;
        const rainGain = ctx.createGain();
        rainGain.gain.value = 0.4;
        rain.connect(rainFilter);
        rainFilter.connect(rainGain);
        rainGain.connect(master);
        rain.start();

        // 风声：粉红噪声 + 低频振荡
        const windBuffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
        const wd = windBuffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < wd.length; i++) {
            const white = Math.random() * 2 - 1;
            wd[i] = (last + white * 0.02) * 0.98;
            last = wd[i];
        }
        const wind = ctx.createBufferSource();
        wind.buffer = windBuffer; wind.loop = true;
        const windFilter = ctx.createBiquadFilter();
        windFilter.type = 'lowpass';
        windFilter.frequency.value = 400;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.15;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 150;
        lfo.connect(lfoGain);
        lfoGain.connect(windFilter.frequency);
        lfo.start();
        const windGain = ctx.createGain();
        windGain.gain.value = 0.5;
        wind.connect(windFilter);
        windFilter.connect(windGain);
        windGain.connect(master);
        wind.start();

        return {
            stop() {
                stop.v = true;
                try { rain.stop(); wind.stop(); lfo.stop(); } catch (e) {}
                master.disconnect();
            },
            setVolume(v) { master.gain.value = v; },
        };
    };

    // ---------- 降噪：白噪声 / 粉红噪声 / 棕噪声 ----------
    Music.noiseCancel = function (type = 'pink', opts = {}) {
        const ctx = getCtx();
        const master = ctx.createGain();
        master.gain.value = opts.volume || 0.5;
        master.connect(ctx.destination);

        const bufferSize = 4 * ctx.sampleRate;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        if (type === 'white') {
            // 白噪声 - 全频段均匀
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * 0.5;
            }
        } else if (type === 'pink') {
            // 粉红噪声 - 1/f 频谱，更柔和
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const w = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + w * 0.0555179;
                b1 = 0.99332 * b1 + w * 0.0750759;
                b2 = 0.96900 * b2 + w * 0.1538520;
                b3 = 0.86650 * b3 + w * 0.3104856;
                b4 = 0.55000 * b4 + w * 0.5329522;
                b5 = -0.7616 * b5 - w * 0.0168980;
                data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
                b6 = w * 0.115926;
            }
        } else { // brown
            // 棕噪声 - 1/f^2，模拟海浪 / 低沉嗡嗡声
            let last = 0;
            for (let i = 0; i < bufferSize; i++) {
                const w = Math.random() * 2 - 1;
                last = (last + 0.02 * w) / 1.02;
                data[i] = last * 3.5;
            }
        }

        const src = ctx.createBufferSource();
        src.buffer = buffer; src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = type === 'brown' ? 400 : 5000;
        src.connect(filter);
        filter.connect(master);
        src.start();

        return {
            stop() {
                try { src.stop(); } catch (e) {}
                master.disconnect();
            },
            setVolume(v) { master.gain.value = v; },
            setFilter(f) { filter.frequency.value = f; },
        };
    };

    // ---------- 元数据 ----------
    Music.tracks = [
        { id: 'lofi',    name: '🎹 Lo-Fi 钢琴',   genre: '放松学习', func: Music.lofi,    desc: '舒缓的钢琴 + 鼓点 + 低音，适合长时间专注' },
        { id: 'ambient', name: '🌌 氛围 Pad',    genre: '冥想入睡', func: Music.ambient, desc: '缓慢的合成器和弦，营造宁静氛围' },
        { id: 'focus',   name: '🧠 专注 Beta',   genre: '高效工作', func: Music.focus,   desc: '14Hz 双耳节拍 + 粉红背景，提升专注力' },
        { id: 'nature',  name: '🌧️ 雨声风声',   genre: '放松冥想', func: Music.nature,  desc: '程序化合成的雨天自然音' },
        { id: 'noise-white', name: '⚪ 白噪声', genre: '降噪专注', func: (o) => Music.noiseCancel('white', o), desc: '均匀全频噪声，适合隔绝环境音' },
        { id: 'noise-pink',  name: '🩷 粉红噪声', genre: '降噪专注', func: (o) => Music.noiseCancel('pink', o),  desc: '1/f 频谱，比白噪声更柔和' },
        { id: 'noise-brown', name: '🟫 棕噪声',   genre: '深度睡眠', func: (o) => Music.noiseCancel('brown', o), desc: '低沉持续，类似海浪声' },
    ];

    // 当前播放实例
    Music.current = null;

    Music.play = function (id, volume = 0.4) {
        Music.stop();
        const t = Music.tracks.find(x => x.id === id);
        if (!t) return;
        Music.current = t.func({ volume });
        Music.currentId = id;
        return Music.current;
    };

    Music.stop = function () {
        if (Music.current) {
            try { Music.current.stop(); } catch (e) {}
            Music.current = null;
        }
    };

    Music.setVolume = function (v) {
        if (Music.current) Music.current.setVolume(v);
    };

    console.log('[Music] library loaded -', Music.tracks.length, 'tracks');
})();