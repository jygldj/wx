// wx/functions/api/publish.js
// 道玄文集 · 备忘录一键发布（合并端点）
// 仅凭密码发布，供手机端 WorkBuddy 自动发文使用。
//
// 注意：date 由作者写稿时自行提供（农历或公历均可），服务端不自动计算、
//       不做兜底；前端不传则留空。道玄裁定·2026-10-02（为手机端通路测试重建）。
// 重触发部署：修复 2026-10-02 瞬时 build 失败（代码本身无误）。

import { verifyPassword, json } from '../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  try {
    const p = await request.json();

    if (!(await verifyPassword(env, p.password))) {
      return json({ ok: false, error: '发布密码错误' }, 401);
    }

    const title = String(p.title || '').trim();
    const category = String(p.category || '随笔').trim() || '随笔';
    const date = String(p.date || '').trim();   // 由作者提供，不自动计算
    const body = String(p.body || '');
    const status = (p.status === 'draft') ? 'draft' : 'published';

    if (!title) {
      return json({ ok: false, error: '标题不能为空' }, 400);
    }

    const db = env.DB;
    const row = await db.prepare('SELECT COALESCE(MAX(seq),0) AS m FROM articles').first();
    const seq = (row && row.m ? row.m : 0) + 1;

    const info = await db.prepare(
      'INSERT INTO articles (seq, title, category, date, body, status, created_at, updated_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))'
    ).bind(seq, title, category, date, body, status).run();

    const aid = info.meta && info.meta.last_row_id;

    return json({
      ok: true,
      article: { id: seq, aid: aid, title, category, date, status }
    });
  } catch (e) {
    return json({ ok: false, error: '写入失败：' + (e && e.message ? e.message : e) }, 500);
  }
}
