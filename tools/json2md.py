#!/usr/bin/env python3
# -*- coding: utf-8 -*-
#
# 道玄文集 · JSON → Markdown 本地转换工具
# ------------------------------------------------------------
# 用途：把「D1 数据库导出的 JSON」(functions/api/export.js 产出，
#       或 backup/articles.json 每日备份) 还原为单篇 .md 合集，
#       格式与 build-core.js 约定的源文件完全一致，将来可被
#       「更新网站.bat」重新拼回 articles.js，形成闭环。
#
# 用法：
#   python tools/json2md.py                      # 取 backup/dxwj-export-*.json 最新一份 → articles/
#   python tools/json2md.py 路径.json            # 指定 JSON 文件
#   python tools/json2md.py -o 输出目录          # 指定输出目录（默认 articles）
#   python tools/json2md.py --dry                # 只打印清单，不写盘
#   python tools/json2md.py --force              # 覆盖已存在的同名文件
#   python tools/json2md.py --published-only     # 仅已发布，跳过草稿
#
# 安全策略：
#   - 默认跳过已存在的同名文件，绝不删除、绝不覆盖（除非 --force）
#   - 草稿默认也还原，文件名尾部加「（草稿）」标记，便于一眼识别，
#     且不影响 build-core.js 解析（编号提取只看文件名开头数字）
#
import sys
import os
import re
import json
import glob
import argparse

# Windows / 各平台文件名非法字符
_ILLEGAL = re.compile(r'[\\/:*?"<>|\r\n\t]')


def safe_name(title, maxlen=40):
    """把标题清洗为合法文件名片段（不含路径分隔与尖括号等）。"""
    t = (title or '').strip()
    t = _ILLEGAL.sub('', t)
    t = t.strip('. ')
    if not t:
        t = '未命名'
    if len(t) > maxlen:
        t = t[:maxlen]
    return t


def load_articles(path):
    """读取 JSON，兼容两种来源，统一返回文章列表。"""
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    arts = data.get('articles')
    if arts is None:
        # 兜底：个别结构可能直接是列表或用 'article'
        arts = data.get('article') or []
    if isinstance(arts, dict):
        arts = [arts]
    return arts


def render_md(a):
    """把单篇文章渲染成 build-core.js 可解析的 .md 文本。"""
    title = (a.get('title') or '未命名').strip()
    cat = (a.get('category') or '未分类').strip()
    date = (a.get('date') or '未标注日期').strip()
    body = a.get('body') or ''
    body = body.replace('\r\n', '\n').replace('\r', '\n').rstrip('\n')
    # 标题行 → 空行 → 元数据行 → 空行 → 正文
    return '# ' + title + '\n\n> ' + cat + ' | ' + date + '\n\n' + body + '\n'


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    ap = argparse.ArgumentParser(description='D1 导出 JSON → 单篇 .md 合集')
    ap.add_argument('json', nargs='?', help='D1 导出 JSON 路径；缺省取 backup/dxwj-export-*.json 最新')
    ap.add_argument('-o', '--out', default='articles', help='输出目录（默认 articles）')
    ap.add_argument('--force', action='store_true', help='覆盖已存在的同名文件')
    ap.add_argument('--published-only', action='store_true', help='仅导出已发布，跳过草稿')
    ap.add_argument('--dry', action='store_true', help='只打印将要生成的清单，不写盘')
    args = ap.parse_args()

    # 1. 定位 JSON 文件
    path = args.json
    if not path:
        cands = sorted(glob.glob('backup/dxwj-export-*.json'))
        if not cands:
            # 也兼容每日备份文件
            if os.path.exists('backup/articles.json'):
                cands = ['backup/articles.json']
        if not cands:
            sys.stderr.write('未找到 D1 导出文件（默认搜索 backup/dxwj-export-*.json，或用参数指定路径）\n')
            sys.exit(1)
        path = cands[-1]
    if not os.path.exists(path):
        sys.stderr.write('文件不存在：' + path + '\n')
        sys.exit(1)

    arts = load_articles(path)
    arts.sort(key=lambda a: (a.get('id') or 0))

    os.makedirs(args.out, exist_ok=True)

    total = len(arts)
    added = 0
    skipped = 0
    drafts = 0

    print('源文件 : ' + path)
    print('输出目录: ' + os.path.abspath(args.out) + ('  (仅预览，不写盘)' if args.dry else ''))
    print('=' * 56)

    for a in arts:
        status = (a.get('status') or 'published').lower()
        is_draft = (status != 'published')
        if is_draft:
            drafts += 1
            if args.published_only:
                continue

        nid = a.get('id') or 0
        nnn = str(nid).zfill(3) if nid < 1000 else str(nid)
        name = nnn + '-' + safe_name(a.get('title'))
        if is_draft:
            name += '（草稿）'
        name += '.md'

        outp = os.path.join(args.out, name)
        if os.path.exists(outp) and not args.force:
            skipped += 1
            print('  跳过(已存在): ' + name)
            continue

        if args.dry:
            added += 1
            print('  将生成: ' + name + '  [' + status + ']')
            continue

        with open(outp, 'w', encoding='utf-8') as w:
            w.write(render_md(a))
        added += 1
        print('  生成: ' + name + '  [' + status + ']')

    print('=' * 56)
    print('完成：共 %d 篇，新增/将新增 %d，跳过 %d（其中草稿 %d）' % (total, added, skipped, drafts))
    if is_draft and args.published_only:
        pass
    if drafts and args.published_only:
        print('提示：草稿 %d 篇被 --published-only 跳过，如需还原草稿请去掉该参数。' % drafts)


if __name__ == '__main__':
    main()
