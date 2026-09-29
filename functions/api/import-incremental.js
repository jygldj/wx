// wx/functions/api/import-incremental.js
// 道玄文集 · 增量批量导入（线上版，免令牌）
//
//   POST /api/import-incremental?dry=1   → 预览：返回将导入清单，不写库
//   POST /api/import-incremental         → 执行：只 INSERT 数据库中尚不存在的 seq
//
// 数据源：部署后的 /articles.js（静态数据文件，随 Pages 部署；含 106 篇全文，
//         字段 id/title/category/date/body，无 status 字段 = 全部已发布）。
//
// 安全模型（与甲案一致）：仅做加法——
//   比对 articles.js 的 id(=展示编号 seq) 与 D1 现有 seq，只插入缺失篇；
//   后台新建/修改的文章 seq 永远取 MAX+1，与 .md 编号区段天然错开，绝不被覆盖或重复。
//
// 鉴权：复用现有 guardWrite（要求 admin Cookie + X-DX-Admin 头），无需任何本机令牌。

import { guardWrite, json } from '../_lib/auth.js';

const CHUNK = 20;

export async function onRequestPost(context) {
  const denied = await guardWrite(context);
  if (denied) return denied;

  const { request, env } = context;
  if (!env.DB) return json({ ok: false, error: '数据库未绑定（请在 Pages 项目里绑定 D1，变量名 DB）' }, 500);

  const url = new URL(request.url);
  const dry = url.searchParams.get('dry') === '1';

  try {
    // 1) 拉取站内静态数据 articles.js（同源静态资源，服务端 fetch 直接取，不受浏览器 sw 影响）
    const srcUrl = new URL('/articles.js', url.origin).href;
    const res = await fetch(srcUrl);
    if (!res.ok) return json({ ok: false, error: '取静态数据失败：HTTP ' + res.status }, 502);
    const text = await res.text();

    const m = text.match(/articlesData\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
    if (!m) return json({ ok: false, error: 'articles.js 结构无法解析' }, 502);
    let data;
    try { data = JSON.parse(m[1]); } catch (e) {
      return json({ ok: false, error: 'articles.js JSON 解析失败' }, 502);
    }
    const arts = (data && data.articles) || [];
    if (!arts.length) return json({ ok: false, error: 'articles.js 无文章' }, 502);

    // 2) D1 现有 seq 集合
    const ex = await env.DB.prepare('SELECT seq FROM articles').all();
    const existing = new Set();
    (ex && ex.results || []).forEach(function (r) { if (r.seq != null) existing.add(r.seq); });

    // 3) 增量比对：只取 D1 中尚不存在的 id(=seq)
    const add = arts
      .filter(function (a) { return a.id != null && !existing.has(a.id); })
      .map(function (a) {
        return { id: a.id, title: a.title, category: a.category, date: a.date, body: a.body };
      });

    if (dry) {
      return json({
        ok: true,
        dry: true,
        sourceCount: arts.length,
        dbCount: existing.size,
        willAdd: add.map(function (a) { return { id: a.id, title: a.title, category: a.category }; })
      }, 200, { 'Cache-Control': 'no-store' });
    }

    // 4) 实写：分批 INSERT（仅新篇，status 固定 published）
    let inserted = 0;
    for (let i = 0; i < add.length; i += CHUNK) {
      const batch = add.slice(i, i + CHUNK);
      const vals = batch.map(function () {
        return '(?,?,?,?,?,?,datetime(\'now\'),datetime(\'now\'))';
      }).join(',');
      const params = [];
      batch.forEach(function (a) {
        params.push(a.id, a.title || '', a.category || '其它', a.date || '', a.body || '', 'published');
      });
      await env.DB.prepare(
        'INSERT INTO articles (seq,title,category,date,body,status,created_at,updated_at) VALUES ' + vals
      ).bind(...params).run();
      inserted += batch.length;
    }

    return json({
      ok: true,
      inserted: inserted,
      dbCountBefore: existing.size,
      dbCountAfter: existing.size + inserted
    }, 200, { 'Cache-Control': 'no-store' });

  } catch (e) {
    return json({ ok: false, error: '导入失败：' + (e && e.message ? e.message : e) }, 500);
  }
}
