/* ===========================================
   成语接龙
   - 给定首字，玩家接一个以该字结尾开头的成语
   - 答对继续，答错或超时扣分
   =========================================== */

(function () {
    'use strict';
    window.Games = window.Games || {};
    const Games = window.Games;

    // 简易成语库 - 几百个常用成语
    const IDIOMS = [
        '一心一意', '意气风发', '发扬光大', '大张旗鼓', '鼓足干劲', '劲头十足',
        '足智多谋', '谋财害命', '命途多舛', '舛讹百出', '出奇制胜', '胜券在握',
        '握手言和', '和颜悦色', '色厉内荏', '荏苒光阴', '阴差阳错', '错综复杂',
        '杂乱无章', '章句之徒', '徒有其名', '名不虚传', '传宗接代', '代代相传',
        '传为佳话', '话不投机', '机不可失', '失之交不臂', '臂有四肘', '肘腋之患',
        '患难之交', '交头接耳', '耳濡目染', '染苍染黄', '黄粱一梦', '梦寐以求',
        '求之之非', '非同小可', '可有可无', '无懈可击', '击中要害', '害群之马',
        '马到成功', '功成名就', '就事论事', '事半功倍', '倍道兼行', '行云流水',
        '水落石出', '出类拔萃', '萃萃学子', '子虚乌有', '有的放矢', '矢志不渝',
        '渝盟背约', '约定俗成', '成竹在胸', '胸有成竹', '竹报平安', '安然无恙',
        '恙虫叮咬', '咬文嚼字', '字斟句酌', '酌情处理', '理直气壮', '壮志凌云',
        '云开雾散', '散兵游勇', '勇往直前', '前仆后继', '继往开来', '来者不善',
        '善罢甘休', '休养生息', '息事宁人', '人杰地灵', '灵机一动', '动辄得咎',
        '咎由自取', '取长补短', '短兵相接', '接二连三', '三心二意', '意想不到',
        '外圆内方', '方寸已乱', '乱七八糟', '糟糠之妻', '妻离子散', '散沙一盘',
        '盘根错节', '节外生枝', '枝繁叶茂', '茂林修竹', '竹马之友', '友好友善',
        '善始善终', '终南捷径', '径情直遂', '遂心如意', '意气用事', '事与愿违',
        '违法乱纪', '纪纲人论', '论功行赏', '赏心悦目', '目不暇接', '接天连地',
        '地久天长', '长驱直入', '入木三分', '分秒必争', '争先恐后', '后会有期',
        '期期艾艾', '艾艾不已', '已成定局', '局促不安', '安居乐业', '业精于勤',
        '勤勤恳恳', '恳切真挚', '誓死不二', '二话不说', '说一不二', '二者必居其一',
        '其乐无穷', '穷山恶水', '水到渠成', '成千上万', '万众一心', '心安理得',
        '得过且过', '过五关斩六将', '将功补过', '过目不忘', '忘乎所以', '以身作则',
        '则安不则', '责无旁贷', '待人接物', '物极必反', '反客为主', '主观能动',
        '能工巧匠', '匠心独运', '运用自如', '如虎添翼', '翼翼小心', '心惊肉跳',
        '跳梁小丑', '丑态百出', '出生入死', '死灰复燃', '燃眉之急', '急中生智',
        '智者千虑', '虑周藻密', '密密层层', '层出不穷', '穷困潦倒', '倒行逆施',
        '施仁布恩', '恩重如山', '山明水秀', '秀外慧中', '中流砥柱', '柱石之坚',
        '坚韧不拔', '拔山扛鼎', '鼎足之势', '势如破竹', '竹报三多', '多姿多彩',
        '彩衣娱亲', '亲上加亲', '亲密无间', '间不容发', '发愤图强', '强弩之末',
        '末路穷途', '途途是道', '道听途说', '说三道四', '四海为家', '家徒四壁',
        '壁立千仞', '仞山尺树', '树大根深', '深谋远虑', '虑不及远', '远水解不了近渴',
    ];

    Games['成语接龙'] = function (canvas) {
        const parent = canvas.parentElement;
        const { w, h } = Games.fitCanvas(canvas, 4 / 3);
        const ctx = canvas.getContext('2d');

        let current, used, score, lives, input, message, messageColor, timer;

        function pickRandom() {
            return IDIOMS[Math.floor(Math.random() * IDIOMS.length)];
        }
        function startsWith(word, ch) {
            return word && word[0] === ch;
        }
        function endsWith(word, ch) {
            return word && word[word.length - 1] === ch;
        }

        function newRound(needed = null) {
            if (needed) {
                current = needed;
            } else {
                current = pickRandom();
            }
            used = new Set([current]);
            timer = 15;
            input = '';
            message = `请接一个以「${current[current.length - 1]}」字开头的成语`;
            messageColor = '#66fcf1';
        }

        function init() {
            score = 0; lives = 3; input = '';
            newRound();
            hud.setScore(score);
            hud.setStatus(`生命: ${'❤'.repeat(lives)}`);
        }

        function submit() {
            const w = input.trim();
            if (w.length !== 4) {
                fail('成语必须是 4 个字');
                return;
            }
            if (used.has(w)) {
                fail('这个成语已用过');
                return;
            }
            if (!startsWith(w, current[current.length - 1])) {
                fail(`需要以「${current[current.length - 1]}」字开头`);
                return;
            }
            if (!IDIOMS.includes(w)) {
                fail('成语不在词库中');
                return;
            }
            // 成功
            score += 10;
            hud.setScore(score);
            newRound(w);
        }

        function fail(msg) {
            message = '✗ ' + msg;
            messageColor = '#f72585';
            lives--;
            if (lives <= 0) {
                hud.setStatus('💀 游戏结束');
                timer = 0;
                return;
            }
            hud.setStatus(`生命: ${'❤'.repeat(lives)}`);
            input = '';
            setTimeout(() => {
                message = `请接一个以「${current[current.length - 1]}」字开头的成语`;
                messageColor = '#66fcf1';
                timer = 15;
            }, 1500);
            timer = 999;
        }

        function render() {
            ctx.fillStyle = '#0a0e27';
            ctx.fillRect(0, 0, w, h);

            // 当前成语大字
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.min(80, w / 6)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(current, w / 2, h * 0.32);

            // 提示
            ctx.fillStyle = messageColor;
            ctx.font = '20px sans-serif';
            ctx.fillText(message, w / 2, h * 0.55);

            // 输入
            ctx.fillStyle = 'rgba(102, 252, 241, 0.15)';
            ctx.fillRect(w * 0.2, h * 0.62, w * 0.6, 50);
            ctx.strokeStyle = '#66fcf1';
            ctx.lineWidth = 2;
            ctx.strokeRect(w * 0.2, h * 0.62, w * 0.6, 50);
            ctx.fillStyle = '#fff';
            ctx.font = '24px monospace';
            ctx.fillText(input + '_', w / 2, h * 0.62 + 25);

            // 倒计时
            ctx.fillStyle = timer < 5 ? '#ef4444' : '#fbbf24';
            ctx.font = '18px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`⏱ ${timer}s`, w - 20, 30);

            requestAnimationFrame(render);
        }

        // 文本输入（隐藏 input）
        const hidden = document.createElement('input');
        hidden.type = 'text';
        hidden.style.cssText = 'position:absolute;left:-9999px;';
        document.body.appendChild(hidden);
        hidden.addEventListener('input', () => { input = hidden.value; });
        hidden.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { submit(); hidden.value = ''; input = ''; }
            else if (e.key === 'Backspace') input = hidden.value.slice(0, -1);
        });
        canvas.addEventListener('click', () => hidden.focus());

        const hud = Games.HUD(parent, { scoreLabel: '得分' });
        hud.on('restart', () => { init(); hidden.value = ''; hidden.focus(); });
        hud.on('pause', () => Games.pauseToggle.toggle());

        // 倒计时
        setInterval(() => {
            if (!Games.pauseToggle.get() && timer > 0 && timer < 999) timer--;
            if (timer === 0 && lives > 0) fail('超时');
        }, 1000);

        init();
        render();
        setTimeout(() => hidden.focus(), 100);
    };
})();