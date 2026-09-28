# -*- coding: utf-8 -*-
"""
道玄文集 · 把 tools/sql/*.sql 灌入 Cloudflare D1，并做入库校验

前置：
    1) 先跑 migrate-to-d1.py 生成 tools/sql/
    2) 环境变量：
         CLOUDFLARE_API_TOKEN   具备 账户→D1→编辑 权限的令牌
         CLOUDFLARE_ACCOUNT_ID  账户 ID
         D1_DATABASE_ID         目标库 ID

用法：
    python load-d1.py --schema-only      # 只建表
    python load-d1.py                    # 建表 + 灌数据 + 校验
    python load-d1.py --verify           # 只查库中行数
"""

import argparse
import glob
import json
import os
import sys
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SQL_DIR = os.path.join(HERE, 'sql')

TOKEN = os.environ.get('CLOUDFLARE_API_TOKEN', '')
ACCOUNT = os.environ.get('CLOUDFLARE_ACCOUNT_ID', '')
DBID = os.environ.get('D1_DATABASE_ID', '')


def api(sql, params=None):
    url = 'https://api.cloudflare.com/client/v4/accounts/%s/d1/database/%s/query' % (ACCOUNT, DBID)
    body = json.dumps({'sql': sql, 'params': params or []}).encode('utf-8')
    req = urllib.request.Request(url, data=body, method='POST')
    req.add_header('Authorization', 'Bearer ' + TOKEN)
    req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode('utf-8'))
        except Exception:
            return {'success': False, 'errors': [{'message': 'HTTP %s' % e.code}]}


def run_file(path, label):
    sql = open(path, encoding='utf-8').read()
    res = api(sql)
    if not res.get('success'):
        print('  ✗ %s 失败: %s' % (label, res.get('errors')))
        return False
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--schema-only', action='store_true')
    ap.add_argument('--verify', action='store_true')
    args = ap.parse_args()

    missing = [k for k, v in
               (('CLOUDFLARE_API_TOKEN', TOKEN), ('CLOUDFLARE_ACCOUNT_ID', ACCOUNT), ('D1_DATABASE_ID', DBID))
               if not v]
    if missing:
        print('缺少环境变量:', ', '.join(missing))
        return 1

    if args.verify:
        r = api('SELECT COUNT(*) AS n, MIN(seq) AS lo, MAX(seq) AS hi FROM articles')
        print(json.dumps(r.get('result'), ensure_ascii=False))
        return 0

    print('① 建表与索引')
    if not run_file(os.path.join(SQL_DIR, '00-schema.sql'), '00-schema.sql'):
        return 1
    if args.schema_only:
        print('完成（仅建表）')
        return 0

    print('② 灌入文章数据')
    files = sorted(glob.glob(os.path.join(SQL_DIR, 'batch-*.sql')))
    for f in files:
        n_before = None
        if not run_file(f, os.path.basename(f)):
            return 1
        print('  ✓ %s (%d KB)' % (os.path.basename(f), os.path.getsize(f) // 1024))

    print('③ 校验')
    r = api('SELECT COUNT(*) AS n, MIN(seq) AS lo, MAX(seq) AS hi, '
            'SUM(CASE WHEN title = "" OR body = "" THEN 1 ELSE 0 END) AS bad FROM articles')
    rows = (r.get('result') or [{}])
    row = rows[0].get('results', [{}])[0] if isinstance(rows, list) else {}
    print('  库中行数 :', row.get('n'), ' seq:', row.get('lo'), '~', row.get('hi'), ' 空标题/正文:', row.get('bad'))

    r2 = api('SELECT seq, title, category, date, length(body) AS len FROM articles ORDER BY seq LIMIT 3')
    for item in ((r2.get('result') or [{}])[0].get('results') or []):
        print('  样本:', item)
    return 0


if __name__ == '__main__':
    sys.exit(main())
