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
var CACHE = 'dxwj-v3';   // ← 版本升至 v3，替换旧缓存
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
        caches.open(CACHE).then(function (c) {
            return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () {}); }));
        }).then(function () { return self.skipWaiting(); })
    );
});

self.addEventListener('activate', function (e) {
    e.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (k) {
                if (k !== CACHE) return caches.delete(k);
            }));
        }).then(function () { return self.clients.claim(); })
    );
});

/* 内容有更新时，通知所有打开的页面 */
function notifyUpdate(req) {
    var p = new URL(req.url).pathname;
    if (!/articles\.js$|index1?\.html$|search\.html$/.test(p)) return;
    self.clients.matchAll().then(function (cs) {
        cs.forEach(function (c) { c.postMessage({ type: 'dx-update-available' }); });
    });
}

/* 网络优先 + 超时竞速 */
function raceNetworkFirst(req) {
    var net = fetch(new Request(req.url, { cache: 'no-cache' })).then(function (res) {
        if (res && res.status === 200) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
    }).catch(function () { return null; });

    var cache = new Promise(function (resolve) {
        setTimeout(function () {
            caches.match(req).then(function (hit) { resolve(hit || null); });
        }, RACE_TIMEOUT);
    });

    return Promise.race([net, cache]).then(function (winner) {
        if (winner) return winner;
        return net.then(function (res) {
            if (res) return res;
            return caches.match(req);
        });
    });
}

/* 缓存优先 + 后台更新 */
function cacheFirstSWR(req) {
    return caches.match(req).then(function (hit) {
        var fetched = fetch(req).then(function (res) {
            if (!res || res.status !== 200 || res.type === 'opaque') return res;
            var copy = res.clone();
            var done = hit
                ? Promise.all([hit.text(), copy.text()]).then(function (r) {
                    if (r[0] !== r[1]) {
                        return caches.open(CACHE).then(function (c) {
                            return c.put(req, new Response(r[1], {
                                headers: copy.headers, status: copy.status, statusText: copy.statusText
                            })).then(function () { notifyUpdate(req); });
                        });
                    }
                })
                : caches.open(CACHE).then(function (c) { return c.put(req, copy); });
            done.catch(function () {});
            return res;
        }).catch(function () {
            return hit;
        });
        return hit || fetched;
    });
}

self.addEventListener('fetch', function (e) {
    var req = e.request;
    if (req.method !== 'GET') return;
    if (!req.url.startsWith(self.location.origin)) return;

    var p = new URL(req.url).pathname;
    var isPage = /\/$/.test(p) || /\.html$/.test(p);
    var isData = /articles\.js$/.test(p);

    if (isPage || isData) {
        e.respondWith(raceNetworkFirst(req));
    } else {
        e.respondWith(cacheFirstSWR(req));
    }
});
