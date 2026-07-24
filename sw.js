/*
 * 道玄文集 · Service Worker（sw.js）
 * 作用：离线缓存与访问加速。
 *   - 首次成功打开后，页面骨架与文章数据全部存入本地缓存；
 *   - 页面与文章数据：网络优先 + 3 秒超时竞速——刷新即见新内容，
 *     网络卡顿/断网时 3 秒内回退缓存，保证永远可打开；
 *   - 样式/脚本/图片：缓存优先 + 后台静默更新，秒开省流量；
 *   - 后台检测到内容更新时，通知页面提示读者刷新。
 * 兼容性：不支持 Service Worker 的浏览器自动静默跳过，不影响正常访问。
 */
var CACHE = 'dxwj-v4';   // ← 版本升至 v4，替换旧缓存（迁移到 Cloudflare Pages 后清掉旧 github.io 缓存）
var RACE_TIMEOUT = 3000;

/* 预缓存清单：网站骨架与文章数据 */
var CORE = [
    './',
    './index.html',
    './index1.html',
    './search.html',
    './jianjie.html',
    './build.html',
    './style.css',
    './cover.css',
    './render.js',
    './build-core.js',
    './articles.js',
    './wsf.jpg',
    './wsf.webp'
];

self.addEventListener('install', function (e) {
    e.waitUntil(
        caches.open(CACHE).then(function (cache) {
            // 加 ?v=4 时间戳参数，绕过 CDN 边缘缓存、强制重新拉取
            var bust = cache.addAll(CORE.map(function (u) { return u + '?v=4'; }));
            return bust;
        })
    );
});

self.addEventListener('activate', function (e) {
    // 接管时清掉所有旧版本缓存（dxwj-v1/v2/v3 等）
    e.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (k) {
                if (k.indexOf('dxwj-') === 0 && k !== CACHE) {
                    return caches.delete(k);
                }
            }));
        }).then(function () { return self.clients.claim(); })
    );
});

/* 页面与文章数据：网络优先 + 3s 超时回退缓存 */
self.addEventListener('fetch', function (e) {
    var req = e.request;
    if (req.method !== 'GET') return;

    var url = new URL(req.url);

    // 只处理同源请求；跨域（如 og:image 反代之类）一律放行，不缓存
    if (url.origin !== self.location.origin) return;

    var accept = req.headers.get('accept') || '';
    var isHTML = req.mode === 'navigate' || accept.indexOf('text/html') !== -1;
    var isArticleData = url.pathname.indexOf('/articles.js') !== -1;

    if (isHTML || isArticleData) {
        // 网络优先 + 3 秒竞速
        e.respondWith(
            Promise.race([
                fetch(req).then(function (resp) {
                    var copy = resp.clone();
                    caches.open(CACHE).then(function (c) { c.put(req, copy); });
                    return resp;
                }),
                new Promise(function (resolve) {
                    setTimeout(function () {
                        caches.match(req).then(function (cached) {
                            if (cached) resolve(cached);
                            else resolve(new Response('离线且无缓存', { status: 503 }));
                        });
                    }, RACE_TIMEOUT);
                })
            ]).catch(function () {
                return caches.match(req);
            })
        );
        return;
    }

    // 静态资源（CSS / JS / 图片）：缓存优先，后台静默更新
    e.respondWith(
        caches.match(req).then(function (cached) {
            var fetchPromise = fetch(req).then(function (resp) {
                if (resp && resp.ok) {
                    var copy = resp.clone();
                    caches.open(CACHE).then(function (c) { c.put(req, copy); });
                }
                return resp;
            }).catch(function () { return cached; });

            return cached || fetchPromise;
        })
    );
});