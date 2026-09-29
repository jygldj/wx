// wx/functions/api/export.js
// 道玄文集 · 全量数据导出（管理员只读接口，B 案）
//
//   GET /api/export  → 把 D1 全量文章（含草稿）导出为 JSON 文件
//                      需登录；返回带 Content-Disposition 的 JSON，
//                      浏览器直接访问该 URL 即下载，后台「导出数据」按钮亦走此接口。
//
// 用途：随时随地把线上数据库下载到本机，作为离线副本 / 灾难恢复源。
//       与 backup.yml 每日自动备份互补——此接口由管理员主动触发，不依赖定时任务。

import { isAdmin, json } from '../_lib/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) {
    return json({ ok: false, error: '数据库未绑定（请在 Pages 项目绑定 D1，变量名 DB）' }, 500);
  }
  // 只读接口：仅需登录，不要求 X-DX-Admin 写校验头（GET 本就不带）
  if (!(await isAdmin(request, env))) {
    return json({ ok: false, error: '未登录或会话已过期，请重新登录' }, 401);
  }
  try {
    const res = await env.DB.prepare(
      `SELECT aid, seq AS id, title, category, date, body, status, updated_at
       FROM articles ORDER BY seq ASC`
    ).all();
    const list = (res && res.results) || [];
    const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const payload = {
      ok: true,
      version: 2,
      source: 'd1',
      generated: ts,
      exported_at: Date.now(),
      count: list.length,
      articles: list
    };
    const fname = 'dxwj-export-' + ts.replace(/[: ]/g, '-') + '.json';
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="' + fname + '"',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  } catch (e) {
    return json({ ok: false, error: '导出失败：' + (e && e.message ? e.message : e) }, 500);
  }
}
