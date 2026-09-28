// wx/functions/api/articles/[aid].js
// 道玄文集 · 单篇读写（按数据库主键 aid 定位）
//
//   GET    /api/articles/12 → 单篇（含正文；草稿仅登录可见）
//   PUT    /api/articles/12 → 修改（需登录）
//   DELETE /api/articles/12 → 删除（需登录，删后自动重排展示编号 seq）

import { guardWrite, isAdmin, json } from '../../_lib/auth.js';

const MAX_TITLE = 200;
const MAX_DATE = 80;
const MAX_CATEGORY = 30;
const MAX_BODY = 400 * 1024;

async function exists(env, aid) {
  const row = await env.DB.prepare('SELECT aid FROM articles WHERE aid = ?').bind(aid).first();
  return !!row;
}

/** 删除或改动后，把展示编号 seq 重排为 1..N，保证前端编号连续 */
async function resequence(env) {
  await env.DB.prepare(
    `UPDATE articles SET seq = (SELECT COUNT(*) FROM articles AS a WHERE a.aid <= articles.aid)`
  ).run();
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  if (!env.DB) return json({ ok: false, error: '数据库未绑定' }, 500);
  const aid = parseInt(params.aid, 10);
  if (!aid) return json({ ok: false, error: '编号无效' }, 400);

  const admin = await isAdmin(request, env);
  const row = await env.DB
    .prepare(`SELECT aid, seq AS id, title, category, date, body, status, created_at, updated_at
              FROM articles WHERE aid = ?` + (admin ? '' : " AND status = 'published'"))
    .bind(aid).first();
  if (!row) return json({ ok: false, error: '文章不存在' }, 404);
  return json({ ok: true, article: row });
}

export async function onRequestPut(context) {
  const denied = await guardWrite(context);
  if (denied) return denied;

  const { request, env, params } = context;
  if (!env.DB) return json({ ok: false, error: '数据库未绑定' }, 500);
  const aid = parseInt(params.aid, 10);
  if (!aid || !(await exists(env, aid))) return json({ ok: false, error: '文章不存在' }, 404);

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
    await env.DB.prepare(
      `UPDATE articles SET title = ?, category = ?, date = ?, body = ?, status = ?, updated_at = datetime('now')
       WHERE aid = ?`
    ).bind(title, category, date, body, status, aid).run();

    const row = await env.DB
      .prepare('SELECT aid, seq AS id, title, category, date, status, updated_at FROM articles WHERE aid = ?')
      .bind(aid).first();
    return json({ ok: true, article: row });
  } catch (e) {
    return json({ ok: false, error: '保存失败：' + (e && e.message ? e.message : e) }, 500);
  }
}

export async function onRequestDelete(context) {
  const denied = await guardWrite(context);
  if (denied) return denied;

  const { env, params } = context;
  if (!env.DB) return json({ ok: false, error: '数据库未绑定' }, 500);
  const aid = parseInt(params.aid, 10);
  if (!aid || !(await exists(env, aid))) return json({ ok: false, error: '文章不存在' }, 404);

  try {
    await env.DB.prepare('DELETE FROM articles WHERE aid = ?').bind(aid).run();
    await resequence(env);
    const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM articles').first();
    return json({ ok: true, deleted: aid, remaining: c ? c.n : null });
  } catch (e) {
    return json({ ok: false, error: '删除失败：' + (e && e.message ? e.message : e) }, 500);
  }
}
