# -*- coding: utf-8 -*-
"""
道玄文集 · 静态文章 → Cloudflare D1 迁移脚本

用途：把本地 articles.js（历史快照）解析成可直接喂给 D1 HTTP API 的 SQL 文件。
      wx 与 ckn 两站通用：改 SITE 常量即可。

用法：
    python migrate-to-d1.py                 # 生成 SQL 批文件（默认输出到 tools/sql/）
    python migrate-to-d1.py --check         # 只做解析校验，不写文件

产物：tools/sql/00-schema.sql         建表 + 索引
      tools/sql/batch-XX.sql          每批 20 条 INSERT
"""

import argparse
import json
import os
import re
import sys

SITE = 'wx'                                   # wx | ckn
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ARTICLES_JS = os.path.join(ROOT, 'articles.js')
OUT_DIR = os.path.join(os.path.dirname(__file__), 'sql')
BATCH = 20

SCHEMA = """\
CREATE TABLE IF NOT EXISTS articles (
  aid        INTEGER PRIMARY KEY AUTOINCREMENT,
  seq        INTEGER NOT NULL DEFAULT 0,
  title      TEXT    NOT NULL,
  category   TEXT    NOT NULL DEFAULT '其它',
  date       TEXT    NOT NULL DEFAULT '',
  body       TEXT    NOT NULL DEFAULT '',
  status     TEXT    NOT NULL DEFAULT 'published',
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_articles_seq    ON articles(seq);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status, seq);
"""


def load_articles(path):
    """从 articles.js 里抠出 articlesData（兼容 BOM 与任意变量名后的 JSON 主体）。"""
    with open(path, 'r', encoding='utf-8-sig') as f:
        text = f.read()

    m = re.search(r'const\s+articlesData\s*=\s*', text)
    if not m:
        raise SystemExit('未在 %s 中找到 articlesData' % path)

    obj, _end = json.JSONDecoder().raw_decode(text, m.end())
    arts = obj.get('articles') or []
    if not arts:
        raise SystemExit('articlesData.articles 为空')
    return obj, arts


def sql_str(value):
    return "'" + str(value if value is not None else '').replace("'", "''") + "'"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true', help='只校验解析结果，不写文件')
    args = ap.parse_args()

    meta, arts = load_articles(ARTICLES_JS)

    ids = [a.get('id') for a in arts]
    titles = [a.get('title') for a in arts]
    cats = {}
    for a in arts:
        cats[a.get('category')] = cats.get(a.get('category'), 0) + 1

    print('源文件      :', ARTICLES_JS)
    print('声明篇数    :', meta.get('count'), ' 实际解析:', len(arts))
    print('编号连续    :', ids == list(range(1, len(arts) + 1)))
    print('分类分布    :', cats)
    print('首篇        :', titles[0] if titles else '—')
    print('末篇        :', titles[-1] if titles else '—')

    dup = len(titles) - len(set(titles))
    if dup:
        print('⚠️ 重名标题  : %d 个（不阻断迁移，但请留意）' % dup)

    if args.check:
        return

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, '00-schema.sql'), 'w', encoding='utf-8') as f:
        f.write(SCHEMA)

    total_batches = 0
    for start in range(0, len(arts), BATCH):
        chunk = arts[start:start + BATCH]
        rows = []
        for offset, a in enumerate(chunk):
            seq = start + offset + 1
            rows.append('(%d, %s, %s, %s, %s, %s, datetime(\'now\'), datetime(\'now\'))' % (
                seq,
                sql_str(a.get('title')),
                sql_str(a.get('category') or '其它'),
                sql_str(a.get('date')),
                sql_str(a.get('body')),
                sql_str('published'),
            ))
        sql = ('INSERT INTO articles (seq, title, category, date, body, status, created_at, updated_at) VALUES\n'
               + ',\n'.join(rows) + ';\n')
        total_batches += 1
        path = os.path.join(OUT_DIR, 'batch-%02d.sql' % total_batches)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(sql)

    size = sum(os.path.getsize(os.path.join(OUT_DIR, f)) for f in os.listdir(OUT_DIR))
    print()
    print('已生成      : %s' % OUT_DIR)
    print('建表脚本    : 00-schema.sql')
    print('批次文件    : %d 个 batch-XX.sql（每批 %d 条）' % (total_batches, BATCH))
    print('总体积      : %.1f KB' % (size / 1024))


if __name__ == '__main__':
    sys.exit(main())
