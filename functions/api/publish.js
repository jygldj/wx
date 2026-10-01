// wx/functions/api/publish.js
// 道玄文集 · 合并发布端点（手机端专用）
//
// 设计目的：手机端 WorkBuddy 无需处理会话 Cookie 与 X-DX-Admin 头，
//           一次调用（密码 + 文章）即可完成"登录 + 写库"。
//           鉴权复用 ADMIN_PASSWORD_HASH，与 /api/login 同等级。
//
// POST /api/publish
//   请求体：{ password, title, body, category?, date?, status? }
//   成功：{ ok:true, article:{ aid, id, title, category, date, status } }
//   失败：{ ok:false, error }  （密码错 401 / 字段错 400 / 写入失败 500）

import { verifyPassword, json } from '../_lib/auth.js';

const MAX_TITLE = 200;
const MAX_DATE = 80;
const MAX_CATEGORY = 30;
const MAX_BODY = 400 * 1024;   // 400 KB 单篇上限

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.ADMIN_PASSWORD_HASH) {
    return json({ ok: false, error: '服务端未配置 ADMIN_PASSWORD_HASH' }, 500);
  }
  if (!env.DB) {
    return json({ ok: false, error: '数据库未绑定（请在 Pages 项目里绑定 D1，变量名 DB）' }, 500);
  }

  let p;
  try { p = await request.json(); } catch (e) { return json({ ok: false, error: '请求体不是合法 JSON' }, 400); }

  const password = String(p.password || '');
  if (!password || !(await verifyPassword(env, password))) {
    return json({ ok: false, error: '密码错误' }, 401);
  }

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
