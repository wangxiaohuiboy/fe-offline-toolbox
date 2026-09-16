# -*- coding: utf-8 -*-
"""离线生成拼音数据表 (GB2312 一二级汉字 6763 字)。
输出 js/lib/pinyin.data.js —— 纯静态数据, 运行时零依赖。"""
import os, json
from pypinyin import pinyin, Style

CHARS = []
for hi in range(0xB0, 0xF8):
    for lo in range(0xA1, 0xFF):
        try:
            ch = bytes([hi, lo]).decode('gb2312')
        except Exception:
            continue
        if '\u4e00' <= ch <= '\u9fff':
            CHARS.append(ch)

seen = set()
chars = []
for c in CHARS:
    if c not in seen:
        seen.add(c)
        chars.append(c)

py = []
for c in chars:
    try:
        r = pinyin(c, style=Style.NORMAL, errors='ignore')
        py.append(r[0][0] if r and r[0] else '')
    except Exception:
        py.append('')

out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'js', 'lib')
out = os.path.abspath(os.path.join(out_dir, 'pinyin.data.js'))

with open(out, 'w', encoding='utf-8') as f:
    f.write('/* 自动生成: GB2312 一二级汉字拼音表 (无音调)。离线纯数据, 请勿手工编辑。 */\n')
    f.write('window.DK_PINYIN_CHARS = %s;\n' % json.dumps(''.join(chars), ensure_ascii=False))
    f.write('window.DK_PINYIN_DATA = %s;\n' % json.dumps(','.join(py), ensure_ascii=False))

print('chars=%d  file=%s  size=%.1fKB' % (len(chars), out, os.path.getsize(out) / 1024.0))
