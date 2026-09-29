#!/usr/bin/env python3
# -*- coding: utf-8 -*-
#
# 道玄文集 · JSON → Markdown 本地转换工具
# ------------------------------------------------------------
# 用途：把「D1 数据库导出的 JSON」(functions/api/export.js 产出，
#       或 backup/articles.json 每日备份) 还原为单篇 .md 合集，
#       格式与 articles/ 源文件约定完全一致（首行 # 标题、次行 > 分类 | 日期），
#       作为 D1 数据的本地标准源，供备份与核对使用。
#
# 用法：
#   python tools/json2md.py                      # 取 backup/dxwj-export-*.json 最新一份 → articles/
#   python tools/json2md.py 路径.json            # 指定 JSON 文件
#   python tools/json2md.py -o 输出目录          # 指定输出目录（默认 articles）
#   python tools/json2md.py --dry                # 只打印清单，不写盘
#   python tools/json2md.py --force              # 覆盖已存在的同名文件
#   python tools/json2md.py --published-only     # 仅已发布，跳过草稿
#   双击本脚本亦可运行（自动定位仓库根，结束暂停不闪退）
#
# 安全策略：
#   - 默认跳过已存在的同名文件，绝不删除、绝不覆盖（除非 --force）
#   - 草稿默认也还原，文件名尾部加「（草稿）」标记，便于一眼识别，
#     且不影响 articles/ 解析（编号提取只看文件名开头数字）
#
import sys
import os
import re
import json
import glob
import argparse

# Windows / 各平台文件名非法字符
_ILLEGAL = re.compile(r'[\\/:*?"<>|\r\n\t]')
# 书名号及其邻近空格（与 articles/ 命名规范保持一致，去掉《》）
_BOOK = re.compile(r'\s*[《》]\s*')
# 零宽 / 不可见字符（多因从微信/网页复制粘贴引入）
_ZERO = re.compile(r'[\u200b\u200c\u200d\u2060\ufeff]')


def safe_name(title, maxlen=40):
    """把标题清洗为合法文件名片段，规则与 articles/ 命名规范一致：
    去书名号《》、去零宽不可见字符、去路径非法字符。"""
    t = (title or '').strip()
    t = _ZERO.sub('', t)
    t = _BOOK.sub('', t)
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
    """把单篇文章渲染成 articles/ 源文件约定的 .md 文本。"""
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

    # 自动把工作目录切到仓库根（tools/ 的父目录），
    # 这样双击 .py 时，backup/ 与 articles/ 相对路径才能正确解析。
    _ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if os.path.isdir(os.path.join(_ROOT, 'articles')) or os.path.isdir(os.path.join(_ROOT, 'backup')):
        if os.getcwd() != _ROOT:
            print('提示：已将工作目录切换为仓库根 ' + _ROOT)
        os.chdir(_ROOT)

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


def _pause():
    """双击运行时避免窗口一闪而过；命令行/管道调用不阻塞。"""
    if os.name == 'nt' and sys.stdin.isatty():
        try:
            input('\n按回车键退出...')
        except EOFError:
            pass


if __name__ == '__main__':
    code = 0
    try:
        main()
    except SystemExit as e:
        code = e.code if isinstance(e.code, int) else (1 if e.code else 0)
    except Exception:
        import traceback
        traceback.print_exc()
        code = 1
    _pause()
    sys.exit(code)
