/*
 * 道玄文集 · 前端渲染器与阅读工具（render.js）
 * DXRender：把文章正文纯文本渲染为 HTML（段落、诗词、注释、标题、粗体、插图）
 * DXTheme ：夜间模式 / 字号调节 / 分享按钮，localStorage 记忆，全站生效
 * 本文件同时被 index1.html（阅读页）与 search.html（搜索页）引用。
 */
(function (root) {
    'use strict';

    // ============================================================
    // 一、正文渲染器 DXRender
    // ============================================================

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // 行内格式：**粗体**
    function inline(s) {
        return s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    }

    var NOTE_RE = /^(注|注释|附|附记|附注)[：:]/;
    var IMG_RE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;
    var H2_RE = /^##\s+(.+)$/;
    var H3_RE = /^###\s+(.+)$/;
    var POEM_TITLE_RE = /^《(.+)》$/;

    /*
     * 渲染正文。
     * body：纯文本（行以 \n 分隔）
     * category：诗 / 词 / 散文 / 其它（诗词类不做段落缩进）
     * 返回 HTML 字符串。
     */
    function renderBody(body, category) {
        var lines = String(body || '').split('\n');
        var contentLines = [];
        var noteLines = [];
        var noteType = '';
        var inNotes = false;
        var i, raw, s;

        // 0) 保护正文中直接书写的 <img> 标签（旧版文章的插图写法）：
        //    先做占位，全部渲染完成后原样还原，避免被文本转义成可见代码
        var imgTags = [];
        var bodyText = String(body || '').replace(/<img\b[^>]*>/gi, function (tag) {
            imgTags.push(tag);
            return '%%DXIMG' + (imgTags.length - 1) + '%%';
        });
        lines = bodyText.split('\n');

        // 1) 分离正文与注释（保持旧版行为：首个「注：」等标记起至文末视为注释）
        for (i = 0; i < lines.length; i++) {
            raw = lines[i];
            s = raw.trim();
            if (!inNotes) {
                var m = s.match(NOTE_RE);
                if (m) {
                    inNotes = true;
                    noteType = m[1];
                    var rest = s.replace(NOTE_RE, '').trim();
                    if (rest) noteLines.push(rest);
                    continue;
                }
                contentLines.push(raw);
            } else {
                if (s) noteLines.push(s);
            }
        }

        // 2) 正文渲染：h2/h3/图片/诗题行自成元素，其余连续行按空行分段成 <p>
        var isPoem = (category === '诗' || category === '词');
        var html = '';
        var paraLines = [];

        function makeImg(m) {
            var alt = escapeHtml(m[1]);
            var src = escapeHtml(m[2]);
            return '<div class="image-container"><img class="dx-image" src="' + src + '" alt="' + alt + '" loading="lazy">' +
                (alt ? '<div class="dx-caption">' + alt + '</div>' : '') + '</div>';
        }
        function flushPara() {
            if (!paraLines.length) return;
            var cls = isPoem ? '' : ' class="paragraph-indent"';
            html += '<p' + cls + '>' + paraLines.join('<br>') + '</p>';
            paraLines = [];
        }

        for (i = 0; i < contentLines.length; i++) {
            s = contentLines[i].trim();
            if (!s) { flushPara(); continue; }

            var h3 = s.match(H3_RE);
            if (h3) { flushPara(); html += '<h3>' + inline(escapeHtml(h3[1])) + '</h3>'; continue; }
            var h2 = s.match(H2_RE);
            if (h2) { flushPara(); html += '<h2>' + inline(escapeHtml(h2[1])) + '</h2>'; continue; }
            var img = s.match(IMG_RE);
            if (img) { flushPara(); html += makeImg(img); continue; }
            var pt = s.match(POEM_TITLE_RE);
            if (pt) { flushPara(); html += '<p class="poem-title">《' + inline(escapeHtml(pt[1])) + '》</p>'; continue; }

            paraLines.push(inline(escapeHtml(s)));
        }
        flushPara();

        // 3) 注释
        if (noteLines.length > 0) {
            html += '<div class="annotation"><p>' + escapeHtml(noteType) + '：</p><p>' +
                    inline(escapeHtml(noteLines.join(' '))) + '</p></div>';
        }

        // 4) 还原被保护的 <img> 标签（见步骤 0）
        html = html.replace(/%%DXIMG(\d+)%%/g, function (_, idx) {
            return imgTags[parseInt(idx, 10)];
        });

        return html || '<p>（本文暂无正文）</p>';
    }

    // ============================================================
    // 二、阅读工具 DXTheme（夜间模式 / 字号 / 分享）
    // ============================================================

    var FONT_KEY = 'dx-fontsize';
    var DARK_KEY = 'dx-dark';
    var FONT_SIZES = [16, 18, 20, 22];
    var DEFAULT_SIZE = 18;

    function getSize() {
        var v = parseInt(localStorage.getItem(FONT_KEY), 10);
        return FONT_SIZES.indexOf(v) >= 0 ? v : DEFAULT_SIZE;
    }

    function applySize(px) {
        document.documentElement.style.setProperty('--reader-fs', px + 'px');
        localStorage.setItem(FONT_KEY, String(px));
    }

    function isDark() {
        return localStorage.getItem(DARK_KEY) === '1';
    }

    function applyDark(on) {
        document.documentElement.classList.toggle('dark', on);
        localStorage.setItem(DARK_KEY, on ? '1' : '0');
        var btn = document.getElementById('dxBtnDark');
        if (btn) btn.textContent = on ? '☀️' : '🌙';
        if (btn) btn.title = on ? '切换到日间模式' : '切换到夜间模式';
    }

    // 尽早应用主题，避免页面闪烁（render.js 在 <head> 引入时即可执行）
    if (isDark()) {
        document.documentElement.classList.add('dark');
    }
    applySize(getSize());

    /*
     * 注入右上角工具条。
     * options.share: 可选，点击分享按钮时调用的函数（返回要复制的文本或 null）
     */
    function initTools(options) {
        options = options || {};
        var bar = document.createElement('div');
        bar.className = 'dx-tools';

        var btnDark = document.createElement('button');
        btnDark.id = 'dxBtnDark';
        btnDark.textContent = isDark() ? '☀️' : '🌙';
        btnDark.title = isDark() ? '切换到日间模式' : '切换到夜间模式';
        btnDark.onclick = function () { applyDark(!isDark()); };
        bar.appendChild(btnDark);

        var btnMinus = document.createElement('button');
        btnMinus.textContent = 'A-';
        btnMinus.title = '字号减小';
        btnMinus.onclick = function () {
            var idx = FONT_SIZES.indexOf(getSize());
            if (idx > 0) applySize(FONT_SIZES[idx - 1]);
        };
        bar.appendChild(btnMinus);

        var btnPlus = document.createElement('button');
        btnPlus.textContent = 'A+';
        btnPlus.title = '字号增大';
        btnPlus.onclick = function () {
            var idx = FONT_SIZES.indexOf(getSize());
            if (idx < FONT_SIZES.length - 1) applySize(FONT_SIZES[idx + 1]);
        };
        bar.appendChild(btnPlus);

        if (typeof options.share === 'function') {
            var btnShare = document.createElement('button');
            btnShare.textContent = '🔗';
            btnShare.title = '复制本文链接，可分享给朋友';
            btnShare.onclick = function () {
                var text = options.share();
                if (!text) return;
                copyText(text, function (ok) {
                    toast(ok ? '✅ 本文链接已复制，可直接粘贴分享' : '⚠️ 复制失败，请手动复制地址栏网址');
                });
            };
            bar.appendChild(btnShare);
        }

        document.body.appendChild(bar);
    }

    function copyText(text, cb) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(function () { cb(true); }, function () { cb(false); });
            return;
        }
        // 降级方案（兼容 file:// 与旧浏览器）
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
        document.body.removeChild(ta);
        cb(ok);
    }

    var toastTimer = null;
    function toast(msg) {
        var el = document.getElementById('dxToast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'dxToast';
            el.className = 'dx-toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
    }

    root.DXRender = { renderBody: renderBody, escapeHtml: escapeHtml };
    root.DXTheme = { initTools: initTools, toast: toast, isDark: isDark };
})(window);
