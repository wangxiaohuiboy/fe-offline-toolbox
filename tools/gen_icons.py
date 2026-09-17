# -*- coding: utf-8 -*-
"""离线生成插件图标 (纯 Python, 不依赖 PIL)。绘制 </> 标记。"""
import os, zlib, struct, math

OUT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons'))
os.makedirs(OUT, exist_ok=True)


def png_write(path, w, h, px):
    raw = b''.join(b'\x00' + bytes(px[y * w * 4:(y + 1) * w * 4]) for y in range(h))

    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)

    hdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', hdr) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def seg_dist(px, py, x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    L2 = dx * dx + dy * dy
    if L2 == 0:
        return math.hypot(px - x1, py - y1)
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / L2))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def render(n):
    S = 3  # 超采样
    W = n * S
    buf = [[(0, 0, 0, 0) for _ in range(W)] for _ in range(W)]
    r = W * 0.22
    for y in range(W):
        for x in range(W):
            # 圆角矩形 SDF
            cx = min(max(x + 0.5, r), W - r)
            cy = min(max(y + 0.5, r), W - r)
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            inside = 1.0 if (x + 0.5 >= r and x + 0.5 <= W - r) or (y + 0.5 >= r and y + 0.5 <= W - r) else 0.0
            if not inside:
                inside = 1.0 if d <= r else max(0.0, 1.0 - (d - r))
            inside = 1.0 if d <= r or (x + 0.5 >= r and x + 0.5 <= W - r) or (y + 0.5 >= r and y + 0.5 <= W - r) else 0.0
            if inside <= 0:
                continue
            # 渐变底: 靛蓝 -> 青
            t = (x + y) / (2.0 * W)
            R = int(37 + t * (14 - 37))
            G = int(99 + t * (165 - 99))
            B = int(235 + t * (233 - 235))
            th = W * 0.075
            # </> 三条线
            m = 1e9
            m = min(m, seg_dist(x + .5, y + .5, W * .40, W * .28, W * .20, W * .50))
            m = min(m, seg_dist(x + .5, y + .5, W * .20, W * .50, W * .40, W * .72))
            m = min(m, seg_dist(x + .5, y + .5, W * .60, W * .28, W * .80, W * .50))
            m = min(m, seg_dist(x + .5, y + .5, W * .80, W * .50, W * .60, W * .72))
            m = min(m, seg_dist(x + .5, y + .5, W * .585, W * .24, W * .415, W * .76))
            mark = 1.0 if m <= th else max(0.0, 1.0 - (m - th) / (W * 0.02))
            if mark > 0:
                R = int(R + (255 - R) * mark)
                G = int(G + (255 - G) * mark)
                B = int(B + (255 - B) * mark)
            buf[y][x] = (R, G, B, 255)

    out = bytearray(n * n * 4)
    for y in range(n):
        for x in range(n):
            ar = ag = ab = aa = 0
            for dy in range(S):
                for dx in range(S):
                    p = buf[y * S + dy][x * S + dx]
                    ar += p[0] * p[3]; ag += p[1] * p[3]; ab += p[2] * p[3]; aa += p[3]
            k = S * S
            if aa:
                out[(y * n + x) * 4 + 0] = ar // aa
                out[(y * n + x) * 4 + 1] = ag // aa
                out[(y * n + x) * 4 + 2] = ab // aa
            out[(y * n + x) * 4 + 3] = aa // k
    return out


for size in (16, 32, 48, 128):
    png_write(os.path.join(OUT, 'icon%d.png' % size), size, size, render(size))
    print('icon%d.png' % size)
