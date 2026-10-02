// wx/functions/api/articles.js
// 道玄文集 · 文章读写接口（Cloudflare Pages Functions + D1）
//
//   GET  /api/articles           → 目录（不含正文），给列表/搜索用
//   GET  /api/articles?full=1    → 全量（含正文），与旧 articles.js 同构，供阅读器一次性加载
//   GET  /api/articles?id=12     → 单篇（按展示编号 seq）
//   GET  /api/articles?all=1     → 含草稿（需登录）
//   POST /api/articles           → 新建（需登录）
//
// 返回字段：id = 展示编号（连续），aid = 数据库主键（写操作定位用）

import { guardWrite, isAdmin, json } from '../_lib/auth.js';

const MAX_TITLE = 200;
const MAX_DATE = 80;
const MAX_CATEGORY = 30;
const MAX_BODY = 400 * 1024;   // 400 KB 单篇上限

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, error: '数据库未绑定（请在 Pages 项目里绑定 D1，变量名 DB）' }, 500);

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const aid = url.searchParams.get('aid');
  const full = url.searchParams.get('full') === '1';
  const wantAll = url.searchParams.get('all') === '1';

  // 注意：单篇查询（aid / id）同样要认管理员身份，否则登录后也取不到自己的草稿
  const admin = (wantAll || aid || id) ? await isAdmin(request, env) : false;
  const where = admin ? '' : "WHERE status = 'published'";

  try {
    if (aid || id) {
      const col = aid ? 'aid' : 'seq';
      const val = parseInt(aid || id, 10);
      if (!val || val < 1) return json({ ok: false, error: '编号无效' }, 400);
      const row = await env.DB
        .prepare(`SELECT aid, seq AS id, title, category, date, body, status, updated_at FROM articles WHERE ${col} = ?` +
                 (admin ? '' : " AND status = 'published'"))
        .bind(val).first();
      if (!row) return json({ ok: false, error: '文章不存在' }, 404);
      return json({ ok: true, article: row });
    }

    const sql = full
      ? `SELECT aid, seq AS id, title, category, date, body, status, updated_at FROM articles ${where} ORDER BY seq ASC`
      : `SELECT aid, seq AS id, title, category, date, status, updated_at FROM articles ${where} ORDER BY seq ASC`;

    const res = await env.DB.prepare(sql).all();
    const list = (res && res.results) || [];

    return json({
      version: 2,
      generated: new Date().toISOString().slice(0, 16).replace('T', ' '),
      count: list.length,
      articles: list
    }, 200, { 'Cache-Control': 'no-store' });

  } catch (e) {
    return json({ ok: false, error: '查询失败：' + (e && e.message ? e.message : e) }, 500);
  }
}

export async function onRequestPost(context) {
  const denied = await guardWrite(context);
  if (denied) return denied;

  const { request, env } = context;
  if (!env.DB) return json({ ok: false, error: '数据库未绑定' }, 500);

  let p;
  try { p = await request.json(); } catch (e) { return json({ ok: false, error: '请求体不是合法 JSON' }, 400); }

  const title = String(p.title || '').trim();
  const body = String(p.body || '');
  const category = String(p.category || '').trim() || '其它';
  const date = String(p.date || '').trim();
  const status = p.status === 'draft' ? 'draft' : 'published';

  if (!title) return json({ ok: false, error: '标题不能为空' }, 400);
  if (title.length > MAX_TITLE) return json({ ok: false, error: '标题过长' }, 400);
  if (category.length > MAX_CATEGORY) return json({ ok: false, error: '分类过长' }, 400);
  if (date.length > MAX_DATE) return json({ ok: false, error: '日期过长' }, 400);
  if (body.length > MAX_BODY) return json({ ok: false, error: '正文超过 400 KB 上限' }, 400);

  try {
    const r = await env.DB.prepare(
      `INSERT INTO articles (seq, title, category, date, body, status, created_at, updated_at)
       VALUES ((SELECT COALESCE(MAX(seq), 0) + 1 FROM articles), ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(title, category, date, body, status).run();

    const aid = r && r.meta ? r.meta.last_row_id : null;
    const row = aid
      ? await env.DB.prepare('SELECT aid, seq AS id, title, category, date, status FROM articles WHERE aid = ?').bind(aid).first()
      : null;
    return json({ ok: true, article: row });
  } catch (e) {
    return json({ ok: false, error: '写入失败：' + (e && e.message ? e.message : e) }, 500);
  }
}
