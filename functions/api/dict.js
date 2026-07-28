// wx/functions/api/dict.js
// 道玄文集 · 划词查字典后端（Cloudflare Pages Functions + Workers KV）
//
// 部署：此文件位于 wx/functions/api/dict.js，由 Cloudflare Pages 自动构建。
// 路径：https://dxwj.pages.dev/api/dict?word=<编码后的词>
// 返回：{ "data": { word, pinyin, explanation, derivation } } 或 { "data": null, "message": "..." }
//
// ⚠️ 重要：部署后在 Cloudflare 控制台给 dxwj 这个 Pages 项目绑定 KV 命名空间 DICT_KV
//    路径：Pages 项目 dxwj → Settings → Bindings → KV namespace bindings → Add binding
//    Variable name: DICT_KV
//    KV namespace: 选择已创建的 DICT_KV 命名空间（id: e9e3ca2874cd4affbc778f7b7e26f765）
//    绑定后需重新部署一次才会生效（Deployments → 最新部署 → Redeploy）。

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

// 字典数据不常变，让 CF 边缘节点缓存一天：既快又省 KV 读取额度
const CACHE = 'public, max-age=86400';

function json(body, status, extra) {
  const headers = Object.assign(
    { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': CACHE },
    CORS,
    extra || {}
  );
  return new Response(JSON.stringify(body), { status: status || 200, headers });
}

export async function onRequestGet(context) {
  return handle(context.request, context.env);
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

async function handle(request, env) {
  const url = new URL(request.url);

  // 取查询词；空词时才判断是不是健康检查。
  const word = (url.searchParams.get('word') || '').trim();
  if (!word) {
    if ((url.pathname === '/' || url.pathname === '/health') && request.method === 'GET') {
      return json({ ok: true, service: 'daoxuan-dict', ts: Date.now() });
    }
    return json({ data: null, message: '请提供要查询的字词（?word=...）' }, 400);
  }

  // 4) 直接键：单字 (word.json) 与 成语 (idiom.json)
  let raw = await env.DICT_KV.get(word);
  if (raw != null) {
    return json({ data: parseVal(raw, word) });
  }

  // 5) 词语 (ci.json)：按「首字分桶」存储，按首字取桶再桶内查
  if (word.length >= 2) {
    const bucketKey = '_ci:' + word[0];
    const braw = await env.DICT_KV.get(bucketKey);
    if (braw != null) {
      try {
        const bucket = JSON.parse(braw);
        if (bucket && bucket[word]) {
          return json({ data: bucket[word] });
        }
      } catch (e) { /* 桶数据损坏则忽略 */ }
    }
  }

  return json({ data: null, message: '未找到“' + word + '”的解释' });
}

function parseVal(raw, word) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    return { word: word, explanation: raw };
  }
}
