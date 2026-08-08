// wx/functions/api/ai.js
// 增删卜易 · AI 释卦代理（Cloudflare Pages Functions）
// 作用：前端把 { modelKey, systemPrompt, userPrompt } POST 到 /api/ai，
//       由本函数用服务端环境变量中的密钥调用阿里云百炼，返回解读文本。
//       密钥只存于 Cloudflare 环境变量，永不进入前端代码 / 浏览器。
//
// 部署：此文件位于 wx/functions/api/ai.js，由 Cloudflare Pages 自动构建，无需额外配置。
// 路径：POST https://dxwj.pages.dev/api/ai
// 请求体：{ "modelKey": "qwen" | "qwen2", "systemPrompt": "...", "userPrompt": "..." }
// 返回：{ "content": "AI 解读文本" } 或 { "error": "错误说明" }
//
// ⚠️ 环境变量（必须在 Cloudflare 控制台配置，配置后需重新部署一次生效）：
//     Pages 项目 dxwj → Settings → Environment variables → Add variable：
//       QWEN_API_KEY   = 主力千问（qwen3.7-flash-2026-07-15）的 apiKey
//       QWEN2_API_KEY  = 备选千问（qwen3.7-flash）的 apiKey
//     GET /api/ai 可作健康检查。

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

// 模型名映射（只改这里即可切换模型，前端无需变动）
const MODELS = {
  qwen: 'qwen3.7-flash-2026-07-15',
  qwen2: 'qwen3.7-flash',
};

function json(body, status, extra) {
  const headers = Object.assign(
    { 'Content-Type': 'application/json; charset=utf-8' },
    CORS,
    extra || {}
  );
  return new Response(JSON.stringify(body), { status: status || 200, headers });
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet() {
  return json({ ok: true, service: 'daoxuan-ai', ts: Date.now() });
}

export async function onRequestPost(context) {
  return handle(context.request, context.env);
}

async function handle(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: '请求体不是合法 JSON' }, 400);
  }

  const modelKey = body.modelKey === 'qwen2' ? 'qwen2' : 'qwen';
  const systemPrompt = (body.systemPrompt || '').trim();
  const userPrompt = (body.userPrompt || '').trim();
  if (!systemPrompt || !userPrompt) {
    return json({ error: '缺少 systemPrompt 或 userPrompt' }, 400);
  }

  const apiKey = modelKey === 'qwen2' ? env.QWEN2_API_KEY : env.QWEN_API_KEY;
  if (!apiKey) {
    return json({ error: '服务端未配置 ' + (modelKey === 'qwen2' ? 'QWEN2_API_KEY' : 'QWEN_API_KEY') + ' 环境变量' }, 500);
  }

  const model = MODELS[modelKey];

  try {
    const upstream = await fetch(BASE_URL + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
        max_tokens: 2048
      })
    });

    if (!upstream.ok) {
      let message = '上游 HTTP ' + upstream.status;
      try {
        const err = await upstream.json();
        if (err && err.error && err.error.message) message = err.error.message;
      } catch (e) { /* 忽略非 JSON 响应 */ }
      return json({ error: message }, 502);
    }

    const data = await upstream.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '';
    if (!content) {
      return json({ error: '上游返回为空' }, 502);
    }
    return json({ content: content });

  } catch (e) {
    return json({ error: '释卦服务异常：' + e.message }, 500);
  }
}
