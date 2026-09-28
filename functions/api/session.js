// wx/functions/api/session.js
// 道玄文集 · 会话状态查询与登出
//
//   GET  /api/session → { ok:true, admin:true|false }
//   POST /api/session → 登出（清除 Cookie）

import { clearCookieHeader, isAdmin, json } from '../_lib/auth.js';

export async function onRequestGet(context) {
  const admin = await isAdmin(context.request, context.env);
  return json({ ok: true, admin });
}

export async function onRequestPost() {
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookieHeader() });
}
