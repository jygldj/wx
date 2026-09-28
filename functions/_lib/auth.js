// wx/functions/_lib/auth.js
// 道玄文集 · 后台鉴权共用模块（Cloudflare Pages Functions）
//
// 机制：环境变量 ADMIN_PASSWORD_HASH 存密码的 SHA-256 十六进制摘要；
//       登录成功后下发 HMAC-SHA256 签名的 HttpOnly Cookie（默认 7 天）。
//       所有写接口都要过 requireAdmin()。
//
// 说明：本文件位于 functions/_lib/ 下，前缀 _ 不会被 Pages 当成路由，仅供 import。

const enc = new TextEncoder();

export const COOKIE_NAME = 'dxwj_admin';
export const SESSION_DAYS = 7;

/* ---------------- 基础工具 ---------------- */

function toHex(buf) {
  let s = '';
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
  return s;
}

function b64urlEncode(str) {
  const bytes = enc.encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** 定长比较，避免时序侧信道 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return toHex(digest);
}

async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return toHex(sig);
}

/* ---------------- 登录 / 会话 ---------------- */

/** 校验密码是否与 ADMIN_PASSWORD_HASH 匹配 */
export async function verifyPassword(env, password) {
  const expected = (env.ADMIN_PASSWORD_HASH || '').trim().toLowerCase();
  if (!expected) return false;
  const got = await sha256Hex(String(password || ''));
  return safeEqual(got, expected);
}

/** 生成签名会话 Cookie 的值 */
export async function makeSessionToken(env, days = SESSION_DAYS) {
  const payload = b64urlEncode(JSON.stringify({ exp: Date.now() + days * 86400 * 1000 }));
  const sig = await hmacHex(env.SESSION_SECRET || '', payload);
  return payload + '.' + sig;
}

/** 校验 Cookie 值是否有效（签名对 + 未过期） */
export async function verifySessionToken(env, token) {
  if (!token || token.indexOf('.') < 0) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expect = await hmacHex(env.SESSION_SECRET || '', payload);
  if (!safeEqual(sig, expect)) return false;
  try {
    const data = JSON.parse(b64urlDecode(payload));
    return typeof data.exp === 'number' && data.exp > Date.now();
  } catch (e) {
    return false;
  }
}

export function parseCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  const parts = raw.split(';');
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].trim();
    if (p.indexOf(name + '=') === 0) return p.slice(name.length + 1);
  }
  return '';
}

export function sessionCookieHeader(token, days = SESSION_DAYS) {
  return COOKIE_NAME + '=' + token +
    '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=' + (days * 86400);
}

export function clearCookieHeader() {
  return COOKIE_NAME + '=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
}

/** 当前请求是否已登录 */
export async function isAdmin(request, env) {
  const token = parseCookie(request, COOKIE_NAME);
  return verifySessionToken(env, token);
}

/* ---------------- 响应工具 ---------------- */

export function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    }, extra)
  });
}

const hits = new Map();   // ip -> { n, until }

/** 登录失败限流：同一 IP 连续失败 6 次锁 10 分钟 */
export function loginThrottle(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'x';
  const now = Date.now();
  const rec = hits.get(ip);
  if (rec && rec.until > now) return Math.ceil((rec.until - now) / 1000);
  return 0;
}

export function loginFailed(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'x';
  const now = Date.now();
  const rec = hits.get(ip) || { n: 0, until: 0 };
  rec.n += 1;
  if (rec.n >= 6) { rec.until = now + 10 * 60 * 1000; rec.n = 0; }
  hits.set(ip, rec);
}

export function loginSucceeded(request) {
  hits.delete(request.headers.get('CF-Connecting-IP') || 'x');
}

/** 写接口统一守卫：鉴权 + 防跨站（要求自定义头） */
export async function guardWrite(context) {
  const { request, env } = context;
  if (!(await isAdmin(request, env))) {
    return json({ ok: false, error: '未登录或会话已过期，请重新登录' }, 401);
  }
  if (request.headers.get('X-DX-Admin') !== '1') {
    return json({ ok: false, error: '缺少校验头，请求被拒绝' }, 403);
  }
  return null;
}
