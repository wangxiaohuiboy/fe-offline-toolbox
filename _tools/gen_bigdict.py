# -*- coding: utf-8 -*-
"""从 ECDICT (MIT, skywind3000/ECDICT) 离线构建精简版中英词典。
输出 js/lib/dict.big.js —— 纯静态数据，运行时零依赖。

策略：
 1. 只保留高频英文词（tag 命中考试词表 或 frq/bnc 排名靠前）
 2. 从中文释义中抽出关键词，**按义项位置 + 英文词词频**联合打分
    （义项越靠前说明是该英文词的本义，避免高词频词的冷义项抢走常用词，如 user 的「用户」）
 3. 每个中文词最多保留 3 个英文说法，行按综合分排序
    （最先出现的行是「最常用英文词的本义」，因此英文→中文反查也准确）
"""
import csv, re, os, sys

SRC = '/tmp/ecdict.csv'
OUT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'js', 'lib', 'dict.big.js'))
MAX_LINES = int(sys.argv[1]) if len(sys.argv) > 1 else 25000
RANK_MAX = int(sys.argv[2]) if len(sys.argv) > 2 else 25000   # 英文词词频排名上限（越小越常用）
MAX_EN_PER_ZH = 3
POS_WEIGHT = 2000      # 选词打分：每往后一个义项，等价于词频排名 +2000
MAX_SENSE_IDX = 6      # 只看前 7 个义项，后面的多为专业/冷门义
MIN_WORDS_OR_GOOD = 60000  # 单英文词条目：义项靠前(前2义)或词频排名足够好才保留

POS = r'^(?:n|v|vt|vi|adj|adv|prep|conj|pron|num|art|int|interj|aux|abbr|pl|ad|a|s|r|t|u|c|det|part|modal)\.\s*'
LABEL = re.compile(r'\[[^\]]{0,12}\]')
BAD_SEG = re.compile(r'[()（）\[\]{}<>《》"\'`~^*+=|\\/]')
SKIP_ZH = {'的', '地', '得', '了', '着', '过', '们', '之', '乎', '者', '而', '且', '乃', '焉', '某', '该', '等'}
GOOD_TAGS = {'zk', 'gk', 'cet4', 'cet6', 'ky', 'toefl', 'ielts', 'gre'}


def zh_keywords(translation):
    """返回 [(关键词, 义项序号)]，义项序号越小越接近本义。
    注意：ECDICT 的释义里换行是**字面量 '\\n' 两字符**，需一并作为分隔符。"""
    out = []
    t = translation.replace('\r', '')
    parts = re.split(r'[；;，,、/｜|·]|\\n|[\r\n]', t)
    for idx, p in enumerate(parts):
        if idx > MAX_SENSE_IDX:
            break
        p = LABEL.sub(' ', p)
        p = re.sub(POS, '', p.strip(), flags=re.I).strip()
        p = p.strip('。.·:： ')
        p = re.sub(r'^(?:的|地)', '', p)
        if not p or BAD_SEG.search(p):
            continue
        if re.match(r'^[\u4e00-\u9fff]{1,6}$', p) and p not in SKIP_ZH:
            out.append((p, idx))
    return out


def main():
    # zh -> {英文词: (义项序号, 词频排名)}
    zh_map = {}
    total = kept = 0
    with open(SRC, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            total += 1
            w = (row.get('word') or '').strip()
            tr = row.get('translation') or ''
            if not tr or not re.match(r'^[a-zA-Z]{2,20}$', w):
                continue
            tags = set((row.get('tag') or '').split())
            ranks = [int(x) for x in (row.get('frq') or '0', row.get('bnc') or '0') if x and x.isdigit() and int(x) > 0]
            rank = min(ranks) if ranks else 0
            if not tags & GOOD_TAGS and not (rank and rank <= RANK_MAX):
                continue
            if not rank:
                rank = 30000
            kept += 1
            for zh, idx in zh_keywords(tr):
                d = zh_map.setdefault(zh, {})
                prev = d.get(w)
                if prev is None or (idx * POS_WEIGHT + rank) < (prev[0] * POS_WEIGHT + prev[1]):
                    d[w] = (idx, rank)

    rows = []
    for zh, d in zh_map.items():
        # 选词：义项位置优先（乘权重），再比词频 → 保证取到最贴切的英文说法
        picks = sorted(d.items(), key=lambda kv: kv[1][0] * POS_WEIGHT + kv[1][1])
        idx0, rank0 = picks[0][1]
        # 噪声过滤：只被 1 个英文词收录、且该词不够常用或义项偏后的，多为词典里的机翻/冷僻片段
        if len(picks) < 2 and (idx0 * POS_WEIGHT + rank0) > MIN_WORDS_OR_GOOD:
            continue
        top = picks[:MAX_EN_PER_ZH]
        # 行序：按选中英文词的词频排（常用词的中文释义在前）
        rows.append((rank0, idx0, zh, ','.join(en for en, _ in top)))
    rows.sort(key=lambda r: (r[0], r[1], r[2]))

    lines = ['%s=%s' % (zh, ens) for _, _, zh, ens in rows[:MAX_LINES]]
    body = '\n'.join(lines)

    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('/* 自动生成，请勿手工编辑：精简版中英词典\n')
        f.write(' * 数据来源：ECDICT (MIT License, https://github.com/skywind3000/ECDICT)\n')
        f.write(' * 生成脚本：_tools/gen_bigdict.py  共 %d 条\n */\n' % len(lines))
        f.write('window.DK_DICT_BIG = `\n%s\n`;\n' % body)

    print('扫描 %d 行 / 采用 %d 词 → 中文词条 %d 个，输出 %d 行，文件 %.1f KB'
          % (total, kept, len(zh_map), len(lines), os.path.getsize(OUT) / 1024.0))


if __name__ == '__main__':
    main()
