/*
 * 道玄文集 · 划词查字典（dict.js）
 * -------------------------------------------------------------
 * 功能：在文章/搜索页选中 1~4 个汉字、词语或成语时，
 *       自动向 Cloudflare Pages Function 查询拼音与释义，并弹出解释框。
 * 同时支持桌面端（鼠标）与移动端（触摸 / 长按选区）。
 *
 * 依赖：Pages 项目同目录下部署了 functions/api/dict.js（KV 绑定为 DICT_KV）。
 *       查询接口：GET <WORKER_URL>?word=<编码后的词>
 *       返回格式：{ "data": { "word","pinyin","explanation","derivation" } }
 *                或 { "data": null, "message": "未找到…" }
 *
 * ⚠️ WORKER_URL 已配置为 pages.dev 域名，无需修改。
 * -------------------------------------------------------------
 */
(function () {
    'use strict';

    // ====== 配置区 ======
    // Pages Functions 与静态站点共享 pages.dev 域名，国内访问友好；不再使用 workers.dev 子域。
    var WORKER_URL = 'https://daoxuanwenji.pages.dev/api/dict';
    var MAX_LEN = 4;          // 最多查 4 个字（成语正好 4 字）
    var POPUP_ID = 'dx-dict-popup';
    // ====================================

    // 是否处于输入框 / 可编辑区域（这些地方选字不应触发查字典）
    function inEditable(node) {
        if (!node) return false;
        var el = node.nodeType === 1 ? node : node.parentElement;
        while (el) {
            var tag = el.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable) return true;
            el = el.parentElement;
        }
        return false;
    }

    function getSelectedText() {
        var sel = window.getSelection();
        if (!sel || sel.isCollapsed) return '';
        var text = sel.toString().trim();
        // 去掉可能夹带的换行/全角空格
        text = text.replace(/[\s ]+/g, '');
        return text;
    }

    function lookup(word, x, y) {
        if (!word || word.length === 0 || word.length > MAX_LEN) return;
        if (inEditable(window.getSelection().anchorNode)) return;

        var url = WORKER_URL + '?word=' + encodeURIComponent(word);
        fetch(url, { mode: 'cors' })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data && data.data) {
                    var info = data.data;
                    var html = '<div class="dx-dict-word">' +
                        escapeHtml(word) +
                        (info.pinyin ? ' <span class="dx-dict-py">' + escapeHtml(info.pinyin) + '</span>' : '') +
                        '</div>';
                    if (info.explanation) html += '<div class="dx-dict-exp">' + escapeHtml(info.explanation) + '</div>';
                    if (info.derivation) html += '<div class="dx-dict-der">出处：' + escapeHtml(info.derivation) + '</div>';
                    if (info.radicals) html += '<div class="dx-dict-der">部首：' + escapeHtml(info.radicals) + '</div>';
                    if (info.strokes) html += '<div class="dx-dict-der">笔画：' + escapeHtml(info.strokes) + '</div>';
                    showPopup(html, x, y);
                } else {
                    showPopup('<div class="dx-dict-word">' + escapeHtml(word) + '</div>' +
                        '<div class="dx-dict-exp dx-dict-miss">未找到释义</div>', x, y);
                }
            })
            .catch(function () {
                // 网络/Worker 不可达：静默失败，不打扰阅读
                console.warn('[划词查字典] 查询失败：', word);
            });
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function ensurePopup() {
        var popup = document.getElementById(POPUP_ID);
        if (popup) return popup;
        popup = document.createElement('div');
        popup.id = POPUP_ID;
        popup.setAttribute('role', 'tooltip');
        // 右上角关闭按钮（独立 DOM，固定位置，不受内容转义影响）
        var closeBtn = document.createElement('button');
        closeBtn.className = 'dx-dict-close';
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', '关闭');
        closeBtn.title = '关闭';
        closeBtn.textContent = '\u00d7'; // ×
        closeBtn.addEventListener('click', function (ev) {
            ev.stopPropagation();
            hidePopup();
        });
        closeBtn.addEventListener('mousedown', function (ev) {
            // 阻止 onOutside 误触发
            ev.stopPropagation();
        });
        closeBtn.addEventListener('touchstart', function (ev) {
            ev.stopPropagation();
        });
        popup.appendChild(closeBtn);
        document.body.appendChild(popup);
        return popup;
    }

    function showPopup(html, x, y) {
        var popup = ensurePopup();
        // 第一次创建时已 appendChild 了关闭按钮；之后只替换内容区
        // 用 .dx-dict-body 包裹便于管理（保留按钮 DOM）
        var body = popup.querySelector('.dx-dict-body');
        if (!body) {
            body = document.createElement('div');
            body.className = 'dx-dict-body';
            popup.appendChild(body);
        }
        body.innerHTML = html;
        popup.style.display = 'block';

        // 先显示再测尺寸，才能正确夹取
        var rect = popup.getBoundingClientRect();
        var w = rect.width || 300;
        var h = rect.height || 160;
        var vw = window.innerWidth;
        var vh = window.innerHeight;

        var left = x + 12;
        var top = y + 12;
        if (left + w > vw - 8) left = x - w - 12;     // 右溢出则翻到左边
        if (left < 8) left = 8;
        if (top + h > vh - 8) top = y - h - 12;       // 下溢出则翻到上方
        if (top < 8) top = 8;

        popup.style.left = left + 'px';
        popup.style.top = top + 'px';
    }

    function hidePopup() {
        var popup = document.getElementById(POPUP_ID);
        if (popup) popup.style.display = 'none';
    }

    // 桌面端：鼠标松开时触发
    document.addEventListener('mouseup', function (e) {
        // 延迟一帧，等浏览器完成选区计算
        setTimeout(function () {
            var text = getSelectedText();
            if (text.length > 0 && text.length <= MAX_LEN) {
                lookup(text, e.clientX, e.clientY);
            }
        }, 0);
    });

    // 移动端：手指抬起时触发
    document.addEventListener('touchend', function (e) {
        var t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        setTimeout(function () {
            var text = getSelectedText();
            if (text.length > 0 && text.length <= MAX_LEN) {
                lookup(text, t.clientX, t.clientY);
            }
        }, 120);
    });

    // 移动端备用：长按选区变化触发（取选区包围盒上方居中位置）
    var lastText = '';
    document.addEventListener('selectionchange', function () {
        var text = getSelectedText();
        if (text.length > 0 && text.length <= MAX_LEN && text !== lastText) {
            var sel = window.getSelection();
            try {
                var range = sel.getRangeAt(0);
                var r = range.getBoundingClientRect();
                if (r && (r.width || r.height)) {
                    lookup(text, r.left + r.width / 2, r.top - 8);
                }
            } catch (err) { /* 忽略 */ }
        }
        lastText = text;
    });

    // 点击 / 触摸弹窗以外区域时隐藏
    function onOutside(e) {
        var popup = document.getElementById(POPUP_ID);
        if (popup && popup.style.display === 'block' && !popup.contains(e.target)) {
            popup.style.display = 'none';
        }
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);

    // 弹窗基础样式（动态注入，避免改动 style.css）
    var styleId = 'dx-dict-style';
    if (!document.getElementById(styleId)) {
        var st = document.createElement('style');
        st.id = styleId;
        st.textContent =
            '#' + POPUP_ID + '{' +
            'display:none;position:fixed;z-index:2147483000;' +
            'max-width:320px;min-width:120px;box-sizing:border-box;' +
            'background:#fffdf8;border:1px solid #d8c4a6;border-radius:10px;' +
            'box-shadow:0 6px 24px rgba(90,57,33,.22);' +
            'padding:14px 16px 12px 14px;font-size:15px;line-height:1.7;color:#3a2a18;' +
            'word-break:break-word;pointer-events:auto;' +
            'font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;}' +
            '#' + POPUP_ID + ' .dx-dict-body{}' +
            '#' + POPUP_ID + ' .dx-dict-close{' +
            'position:absolute;top:4px;right:6px;width:22px;height:22px;' +
            'border:none;background:transparent;color:#a08a72;' +
            'font-size:18px;line-height:1;cursor:pointer;padding:0;' +
            'border-radius:50%;transition:background .15s,color .15s;}' +
            '#' + POPUP_ID + ' .dx-dict-close:hover{' +
            'background:#f0e6d4;color:#5a3921;}' +
            '#' + POPUP_ID + ' .dx-dict-word{font-size:17px;font-weight:700;color:#5a3921;margin-bottom:4px;}' +
            '#' + POPUP_ID + ' .dx-dict-py{font-size:13px;font-weight:400;color:#8a6d4b;margin-left:6px;}' +
            '#' + POPUP_ID + ' .dx-dict-exp{margin-top:2px;}' +
            '#' + POPUP_ID + ' .dx-dict-der{margin-top:6px;font-size:13px;color:#7a6450;}' +
            '#' + POPUP_ID + ' .dx-dict-miss{color:#a08a72;}';
        document.head.appendChild(st);
    }
})();
