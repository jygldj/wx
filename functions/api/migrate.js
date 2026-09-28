// wx/functions/api/migrate.js
// 道玄文集 · 一次性灌库接口（把站内 articles.js 的快照灌进 D1）
//
// 用法（需携带密钥；密钥为空时本接口自动关闭）：
//   GET /api/migrate?key=XXXX               → 建表 + 灌库（表非空则跳过）
//   GET /api/migrate?key=XXXX&force=1       → 清空后重灌
//   GET /api/migrate?key=XXXX&schema=1      → 只建表（IF NOT EXISTS）
//
// 设计要点：
//   1) 数据源为本站静态资源 /articles.js，不依赖任何外部网络；
//   2) 只读取、解析、写入，不改动静态文件，随时可重跑；
//   3) 表非空默认不覆盖，需显式 force=1，避免误操作毁库。

import { json } from '../_lib/auth.js';

// 注意：D1 的 exec() 按「换行」切句，多行 DDL 会被切碎报 incomplete input，
// 故这里逐句 prepare().run()，每句自带 IF NOT EXISTS，可反复执行。
const DDL_LIST = [
  "CREATE TABLE IF NOT EXISTS articles (" +
  " aid INTEGER PRIMARY KEY AUTOINCREMENT," +
  " seq INTEGER NOT NULL DEFAULT 0," +
  " title TEXT NOT NULL," +
  " category TEXT NOT NULL DEFAULT '其它'," +
  " date TEXT NOT NULL DEFAULT ''," +
  " body TEXT NOT NULL DEFAULT ''," +
  " status TEXT NOT NULL DEFAULT 'published'," +
  " created_at TEXT NOT NULL DEFAULT (datetime('now'))," +
  " updated_at TEXT NOT NULL DEFAULT (datetime('now'))" +
  ")",
  "CREATE INDEX IF NOT EXISTS idx_articles_seq ON articles(seq)",
  "CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status, seq)"
];

async function ensureSchema(db) {
  for (const stmt of DDL_LIST) await db.prepare(stmt).run();
}

// 从 JS 文本里取出 articlesData 对象并解析（括号配对，跳过字符串内的花括号）
function parseArticlesData(text) {
  let s = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const m = s.match(/const\s+articlesData\s*=\s*/);
  if (!m) throw new Error('未在 articles.js 中找到 articlesData');
  let i = m.index + m[0].length;
  while (i < s.length && s[i] !== '{') i++;
  if (i >= s.length) throw new Error('JSON 起点缺失');

  const start = i;
  let depth = 0, inStr = false, esc = false;
  for (; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return JSON.parse(s.slice(start, i));
}

async function run(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 令牌未配置 → 本接口视为关闭
  if (!env.MIGRATE_KEY) return json({ ok: false, error: '迁移接口未启用（未配置 MIGRATE_KEY）' }, 403);
  if (url.searchParams.get('key') !== env.MIGRATE_KEY) return json({ ok: false, error: '密钥不符' }, 403);
  if (!env.DB) return json({ ok: false, error: '数据库未绑定（变量名 DB）' }, 500);

  const schemaOnly = url.searchParams.get('schema') === '1';
  const force = url.searchParams.get('force') === '1';

  try {
    await ensureSchema(env.DB);
    if (schemaOnly) return json({ ok: true, step: 'schema', note: '建表完成' });

    const cur = await env.DB.prepare('SELECT COUNT(*) AS n FROM articles').first();
    const before = (cur && cur.n) || 0;
    if (before > 0 && !force) {
      return json({ ok: true, step: 'skip', rows: before, note: '表中已有数据，未改动；如需重灌请加 force=1' });
    }

    // 取站内快照
    const origin = url.origin;
    const res = await fetch(origin + '/articles.js', { cf: { cacheTtl: 0 } });
    if (!res.ok) return json({ ok: false, error: '读取 articles.js 失败：HTTP ' + res.status }, 502);
    const text = await res.text();
    const data = parseArticlesData(text);
    const list = (data && data.articles) || [];
    if (!list.length) return json({ ok: false, error: '快照中文章列表为空' }, 422);

    if (before > 0) {
      await env.DB.prepare('DELETE FROM articles').run();
      await env.DB.prepare("DELETE FROM sqlite_sequence WHERE name = 'articles'").run();
    }

    const CHUNK = 20;
    let written = 0;
    for (let i = 0; i < list.length; i += CHUNK) {
      const stmts = list.slice(i, i + CHUNK).map((a, k) => env.DB.prepare(
        `INSERT INTO articles (seq, title, category, date, body, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'published', datetime('now'), datetime('now'))`
      ).bind(
        Number(a && a.id) || (i + k + 1),
        String((a && a.title) || ''),
        String((a && a.category) || '') || '其它',
        String((a && a.date) || ''),
        String((a && a.body) || '')
      ));
      const r = await env.DB.batch(stmts);
      written += Array.isArray(r) ? r.length : 0;
    }

    const after = await env.DB.prepare('SELECT COUNT(*) AS n, MIN(seq) AS lo, MAX(seq) AS hi FROM articles').first();
    const cats = await env.DB.prepare('SELECT category, COUNT(*) AS n FROM articles GROUP BY category ORDER BY n DESC').all();
    const first = await env.DB.prepare('SELECT seq, title, length(body) AS len FROM articles ORDER BY seq ASC LIMIT 1').first();
    const last = await env.DB.prepare('SELECT seq, title, length(body) AS len FROM articles ORDER BY seq DESC LIMIT 1').first();

    return json({
      ok: true,
      step: 'migrated',
      source: { version: data && data.version, generated: data && data.generated, count: list.length, bytes: text.length },
      cleared: before,
      written,
      table: after,
      categories: (cats && cats.results) || [],
      first, last
    });
  } catch (e) {
    return json({ ok: false, error: '迁移失败：' + (e && e.message ? e.message : e) }, 500);
  }
}

export const onRequestGet = run;
export const onRequestPost = run;
