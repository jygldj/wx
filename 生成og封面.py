# -*- coding: utf-8 -*-
"""
道选文集 · og-cover.jpg 生成脚本
运行：python 生成og封面.py
输出：og-cover.jpg (1200×630, ~50KB)
设计：墨黑底 + 米白楷体「道 选 文 集」+ 右下角域名；无副标题、无二维码
"""

from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1200, 630
BG_COLOR = (26, 26, 26)        # 墨黑 #1a1a1a
TEXT_COLOR = (245, 240, 232)   # 米白 #f5f0e8
FOOTER_COLOR = (136, 136, 136)  # 淡灰
TITLE = "道 选 文 集"
FOOTER = "dxwj.pages.dev"

FONT_PATHS = [
    r"C:\Windows\Fonts\simkai.ttf",   # 楷体
    r"C:\Windows\Fonts\STKAITI.TTF",  # 华文楷体
    r"C:\Windows\Fonts\Deng.ttf",     # 等线（兜底）
]
FONT_PATH = next((p for p in FONT_PATHS if os.path.exists(p)), None)
if FONT_PATH is None:
    raise RuntimeError("找不到楷体字体，请检查 C:\\Windows\\Fonts\\")

img = Image.new("RGB", (W, H), BG_COLOR)
draw = ImageDraw.Draw(img)

# 主标题：大字、宽字距、水平垂直居中
title_font = ImageFont.truetype(FONT_PATH, 210)
tw = draw.textlength(TITLE, font=title_font)
tx = (W - tw) / 2
ty = (H - 210) / 2 - 25
draw.text((tx, ty), TITLE, font=title_font, fill=TEXT_COLOR)

# 右下角域名
footer_font = ImageFont.truetype(FONT_PATH, 30)
fw = draw.textlength(FOOTER, font=footer_font)
draw.text((W - fw - 45, H - 30 - 45), FOOTER, font=footer_font, fill=FOOTER_COLOR)

out = os.path.join(os.path.dirname(__file__), "og-cover.jpg")
img.save(out, "JPEG", quality=90, optimize=True)
print(f"已生成：{out}")
print(f"尺寸：{W}x{H}  大小：{os.path.getsize(out)/1024:.1f} KB")
