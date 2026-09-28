// wx/functions/api/login.js
// 道玄文集 · 后台登录（POST 密码 → 下发签名会话 Cookie）
//
// 环境变量（Pages 项目 → 设置 → 环境变量，生产环境）：
//   ADMIN_PASSWORD_HASH = 管理密码的 SHA-256 十六进制摘要（64 位小写）
//   SESSION_SECRET      = 会话签名密钥（随机 32 字节 hex 即可）
//
// 机器上生成摘要：  printf '%s' '你的密码' | sha256sum
// 机器上生成密钥：  head -c 32 /dev/urandom | xxd -p -c 64

import {
  json, loginFailed, loginSucceeded, loginThrottle,
  makeSessionToken, sessionCookieHeader, verifyPassword
} from '../_lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  const wait = loginThrottle(request);
  if (wait > 0) {
    return json({ ok: false, error: `尝试过于频繁，请 ${Math.ceil(wait / 60)} 分钟后再试` }, 429);
  }

  if (!env.ADMIN_PASSWORD_HASH || !env.SESSION_SECRET) {
    return json({ ok: false, error: '服务端未配置 ADMIN_PASSWORD_HASH / SESSION_SECRET' }, 500);
  }

  let p;
  try { p = await request.json(); } catch (e) { return json({ ok: false, error: '请求体不是合法 JSON' }, 400); }

  const password = String(p.password || '');
  await new Promise(r => setTimeout(r, 400));   // 固定延迟，抬高暴力破解成本

  if (!password || !(await verifyPassword(env, password))) {
    loginFailed(request);
    return json({ ok: false, error: '密码错误' }, 401);
  }

  loginSucceeded(request);
  const token = await makeSessionToken(env);
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookieHeader(token) });
}
