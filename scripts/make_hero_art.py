"""
Generates the pixel-art scenery for the dashboard's hero banner.

Output (native resolution; the UI scales it up 4x with `image-rendering: pixelated`):
    frontend/src/assets/hero/hero-left.png    misty ruins, floating islands, a seated knight and a planted sword
    frontend/src/assets/hero/hero-right.png   a golden tree over a ruined fortress, water and rocks
    frontend/src/assets/hero/emblem.png       a thin golden ring sigil

Everything is drawn procedurally with a fixed seed, so re-running gives identical files.

Usage (from the repo root):
    pip install -r scripts/requirements.txt          # Pillow and numpy, only needed to regenerate the art
    python scripts/make_hero_art.py                  # write the assets
    python scripts/make_hero_art.py --preview DIR    # also write 4x previews on the cream paper colour
"""
import argparse
import math
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'frontend' / 'src' / 'assets' / 'hero'

# ---------------------------------------------------------------- palette
PAPER = (255, 252, 241)
INK = (24, 26, 20)
INK2 = (46, 50, 38)
STONE_XL = (198, 196, 174)
STONE_L = (162, 160, 140)
STONE_M = (120, 120, 104)
STONE_D = (86, 88, 74)
MIST = (232, 224, 190)
MOSS_D = (52, 58, 18)
MOSS = (98, 112, 34)
MOSS_L = (146, 164, 44)
LIME = (216, 232, 32)
GOLD_D = (176, 140, 56)
GOLD = (232, 192, 96)
GOLD_L = (244, 218, 132)
GOLD_XL = (252, 240, 186)
CAPE = (158, 120, 38)
CAPE_D = (100, 74, 26)
STEEL = (214, 216, 200)
STEEL_D = (136, 140, 124)


def bayer(n):
    m = np.array([[0]])
    while m.shape[0] < n:
        m = np.block([[4 * m, 4 * m + 2], [4 * m + 3, 4 * m + 1]])
    return (m + 0.5) / (n * n)


B8 = bayer(8)
STIPPLE = np.random.default_rng(99).random((64, 64))


def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


class Canvas:
    """An RGBA pixel canvas where every pixel is either fully opaque or fully transparent."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.a = np.zeros((h, w, 4), dtype=np.uint8)

    def inside(self, x, y):
        return 0 <= x < self.w and 0 <= y < self.h

    def px(self, x, y, c):
        x, y = int(x), int(y)
        if self.inside(x, y):
            self.a[y, x] = (*c, 255)

    def clear(self, x, y):
        x, y = int(x), int(y)
        if self.inside(x, y):
            self.a[y, x] = (0, 0, 0, 0)

    def opaque(self, x, y):
        return self.inside(x, y) and self.a[y, x, 3] > 0

    def rect(self, x0, y0, x1, y1, c):
        for y in range(int(y0), int(y1)):
            for x in range(int(x0), int(x1)):
                self.px(x, y, c)

    def line(self, x0, y0, x1, y1, c):
        x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.px(x0, y0, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def poly(self, pts, c):
        ys = [p[1] for p in pts]
        for y in range(int(math.floor(min(ys))), int(math.ceil(max(ys))) + 1):
            xs = []
            n = len(pts)
            for i in range(n):
                (xa, ya), (xb, yb) = pts[i], pts[(i + 1) % n]
                if ya == yb:
                    continue
                if min(ya, yb) <= y + 0.5 < max(ya, yb):
                    xs.append(xa + (y + 0.5 - ya) * (xb - xa) / (yb - ya))
            xs.sort()
            for i in range(0, len(xs) - 1, 2):
                for x in range(int(round(xs[i])), int(round(xs[i + 1]))):
                    self.px(x, y, c)

    def ellipse(self, cx, cy, rx, ry, c):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1:
                    self.px(x, y, c)

    def over(self, other, dx=0, dy=0):
        """Paint the opaque pixels of `other` on top of this canvas."""
        ys, xs = np.nonzero(other.a[:, :, 3])
        for y, x in zip(ys, xs):
            self.px(x + dx, y + dy, tuple(other.a[y, x, :3]))

    def mask_by(self, fn):
        """Remove pixels where fn(x, y) returns a removal probability above the dither threshold."""
        ys, xs = np.nonzero(self.a[:, :, 3])
        for y, x in zip(ys, xs):
            if 0.45 * B8[y % 8, x % 8] + 0.55 * STIPPLE[y % 64, x % 64] < fn(x, y):
                self.clear(x, y)

    def save(self, path, scale=1, bg=None):
        im = Image.fromarray(self.a, 'RGBA')
        if bg is not None:
            base = Image.new('RGBA', im.size, (*bg, 255))
            base.alpha_composite(im)
            im = base
        if scale != 1:
            im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
        im.save(path)


def circle_pts(cx, cy, r):
    pts = set()
    x, y, d = r, 0, 1 - r
    while x >= y:
        for sx, sy in ((x, y), (y, x), (-y, x), (-x, y), (-x, -y), (-y, -x), (y, -x), (x, -y)):
            pts.add((int(round(cx + sx)), int(round(cy + sy))))
        y += 1
        if d < 0:
            d += 2 * y + 1
        else:
            x -= 1
            d += 2 * (y - x) + 1
    return pts


def fbm(w, h, rng, cells=(12, 6, 3), weights=(0.5, 0.3, 0.2)):
    ys, xs = np.mgrid[0:h, 0:w]
    out = np.zeros((h, w))
    for cell, wt in zip(cells, weights):
        gw, gh = w // cell + 3, h // cell + 3
        g = rng.random((gh, gw))
        fx, fy = xs / cell, ys / cell
        x0, y0 = fx.astype(int), fy.astype(int)
        tx, ty = fx - x0, fy - y0
        tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
        n = (g[y0, x0] * (1 - tx) + g[y0, x0 + 1] * tx) * (1 - ty) + (g[y0 + 1, x0] * (1 - tx) + g[y0 + 1, x0 + 1] * tx) * ty
        out += n * wt
    return out


# ---------------------------------------------------------------- shared pieces
def spire_tower(c, x, base, w, h, roof, body, shade, rng, windows=True):
    """A tower with a pointed roof; `shade` darkens the right edge for a bit of volume."""
    c.rect(x, base - h, x + w, base, body)
    c.rect(x + w - 1, base - h, x + w, base, shade)
    cx = x + w / 2
    c.poly([(x - 1, base - h), (x + w + 1, base - h), (cx, base - h - roof)], body)
    c.line(cx, base - h - roof, x + w, base - h, shade)
    # ledge
    c.rect(x - 1, base - h, x + w + 1, base - h + 1, shade)
    if windows and h > 8:
        for wy in range(base - h + 3, base - 3, 5):
            c.px(x + w // 2, wy, shade)


def gothic_tower(c, x, base, w, h, spire, body, shade, rng, ruined=False, glow=None):
    """A slender tower: banded shaft, window slits and either a stepped spire or ragged battlements."""
    top = base - h
    c.rect(x, top, x + w, base, body)
    c.rect(x + w - 1, top, x + w, base, shade)
    c.rect(x, top + max(3, h // 3), x + w, top + max(3, h // 3) + 1, shade)
    if spire > 0:
        cx = x + w / 2.0
        for k in range(spire):
            half = (w / 2.0 + 0.7) * (1 - k / spire)
            c.rect(cx - half, top - 1 - k, cx + half, top - k, body)
            c.px(int(cx + half) - 1, top - 1 - k, shade)
    else:
        for bx in range(x, x + w, 2):
            if not ruined or rng.random() < 0.6:
                c.px(bx, top - 1, body)
        if ruined:
            for i in range(int(rng.integers(1, 3))):
                c.clear(x + w - 1 - i, top)
    for wy in (top + 3, top + h // 2 + 3):
        if wy < base - 2:
            lit = glow if (glow is not None and rng.random() < 0.7) else shade
            c.px(x + w // 2, wy, lit)
            c.px(x + w // 2, wy + 1, lit)


def castle(c, x0, base, specs, body, shade, rng, wall=7, glow=None):
    """A cluster of towers joined by a battlemented wall. specs = (dx, w, h, spire)."""
    xs = [x0 + dx for dx, _, _, _ in specs]
    xe = [x0 + dx + w for dx, w, _, _ in specs]
    c.rect(min(xs), base - wall, max(xe), base, body)
    for bx in range(min(xs), max(xe), 2):
        c.px(bx, base - wall - 1, body)
    for dx, w, h, spire in sorted(specs, key=lambda t: -t[2]):
        gothic_tower(c, x0 + dx, base, w, h, spire, body, shade, rng, ruined=(spire == 0), glow=glow)


def island(c, cx, top, width, depth, body, shade, rng, tower=True):
    """A floating rock: a stone ledge, a body that stays wide before tapering, spikes below and a ruined gate on top."""
    hw = width / 2
    c.rect(cx - hw, top, cx + hw, top + 2, shade)
    for k in range(2, depth + 3):
        t = (k - 2) / (depth + 1)
        half = hw * (1 - t ** 2.0) * 0.95 + rng.uniform(-0.6, 0.6)
        if half < 0.8:
            break
        c.rect(cx - half, top + k, cx + half, top + k + 1, body if k % 2 == 0 else shade)
    for _ in range(3):
        sx = cx + int(rng.integers(-int(hw / 2), int(hw / 2) + 1))
        c.line(sx, top + depth, sx, top + depth + int(rng.integers(2, 5)), shade)
    if tower:
        c.rect(cx - 2, top - 5, cx - 1, top, shade)
        c.rect(cx + 1, top - 3, cx + 2, top, shade)
        c.rect(cx - 2, top - 6, cx + 2, top - 5, shade)


def bird(c, x, y, col):
    c.px(x, y, col)
    c.px(x + 1, y + 1, col)
    c.px(x + 2, y, col)


def flecks(c, rng, n, color, region):
    x0, y0, x1, y1 = region
    for _ in range(n):
        x, y = int(rng.integers(x0, x1)), int(rng.integers(y0, y1))
        if not c.opaque(x, y):
            c.px(x, y, color)


def arches(c, x0, x1, top, bottom, step, body, shade, pier=2, glow=None):
    """A row of arches (an aqueduct / ruined walkway)."""
    c.rect(x0, top, x1, top + 2, shade)
    c.rect(x0, top + 2, x1, bottom, body)
    x = x0
    while x + step <= x1:
        ox0, ox1 = x + pier, x + step
        cx = (ox0 + ox1) / 2
        r = (ox1 - ox0) / 2
        arch_h = max(r + 2, int((bottom - top - 2) * 0.68))
        for xx in range(int(ox0), int(ox1)):
            top_y = (bottom - 1) - int(round(math.sqrt(max(0.0, r * r - (xx + 0.5 - cx) ** 2)) + (arch_h - r)))
            for yy in range(max(top + 2, top_y + 1), bottom):
                if glow is None:
                    c.clear(xx, yy)
                else:
                    c.px(xx, yy, glow if (xx + yy) % 3 else GOLD_L)
        x += step


# ---------------------------------------------------------------- left scene
def flower(c, x, y):
    """A tiny four-petal flower on a stem."""
    c.line(x, y + 1, x, y + 4, MOSS)
    for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
        c.px(x + dx, y + dy, GOLD)
    c.px(x, y, INK)


def left_scene():
    W, H = 120, 50
    rng = np.random.default_rng(7)
    far = Canvas(W, H)

    # floating islands, kept clear of the sword
    island(far, 12, 14, 12, 6, STONE_XL, STONE_L, rng)
    island(far, 26, 22, 10, 5, STONE_XL, STONE_L, rng)

    # ruined skyline: pale towers at the back, darker ones in front
    castle(far, 32, 42, [(0, 4, 17, 8), (6, 3, 12, 6), (11, 5, 23, 10), (18, 4, 14, 0), (24, 3, 19, 7)], STONE_L, STONE_M, rng, wall=8)
    castle(far, 44, 43, [(0, 4, 13, 6), (5, 7, 26, 11), (14, 4, 16, 7), (20, 5, 11, 0), (27, 3, 18, 8)], STONE_M, STONE_D, rng, wall=9)
    arches(far, 76, 120, 19, 34, 8, STONE_M, STONE_D, pier=3)

    # drifting fog swallows the bases of the ruins
    fog = fbm(W, H, rng, cells=(10, 5, 2), weights=(0.5, 0.3, 0.2))
    far.mask_by(lambda x, y: smoothstep((y - 30 + (fog[y, x] - 0.5) * 11) / 14) ** 0.9)

    c = Canvas(W, H)
    c.over(far)
    for _ in range(190):
        x, y = int(rng.integers(0, W)), int(rng.integers(26, 46))
        if not c.opaque(x, y) and rng.random() < smoothstep((y - 26) / 16):
            c.px(x, y, MIST)

    # foreground cliff
    prof = []
    for x in range(0, 80):
        base = 32 + max(0, x - 20) * 0.34
        prof.append(int(round(base + 1.6 * math.sin(x * 0.55) + rng.uniform(-0.8, 0.8))))
    for x, top in enumerate(prof):
        for y in range(top, H):
            c.px(x, y, INK if (x * 7 + y * 3) % 11 else INK2)
        c.px(x, top, MOSS_D)
        if rng.random() < 0.55:
            c.px(x, top, MOSS)
        if rng.random() < 0.10:
            c.px(x, top, LIME)
        if rng.random() < 0.35:
            c.px(x, top + 1, GOLD_D)
        if rng.random() < 0.22:
            c.px(x, top - 1, MOSS_D)
            if rng.random() < 0.5:
                c.px(x, top - 2, MOSS)
    for _ in range(26):
        x = int(rng.integers(2, 72))
        y = int(prof[min(x, len(prof) - 1)] + rng.integers(3, 12))
        for i in range(int(rng.integers(3, 8))):
            c.px(x + i, y, STONE_D if rng.random() < 0.7 else GOLD_D)
    for _ in range(40):
        x = int(rng.integers(0, 72))
        c.px(x, int(prof[min(x, len(prof) - 1)] + rng.integers(2, 14)), MOSS_D)

    # the knight: hooded, hunched, cloak pooled on the rock
    gy = prof[24]
    body = [(22, gy - 16), (26, gy - 15), (30, gy - 13), (33, gy - 10), (37, gy - 8), (41, gy - 5), (42, gy), (12, gy), (14, gy - 5), (17, gy - 10), (20, gy - 14)]
    c.poly(body, INK)
    c.ellipse(26.5, gy - 19, 3.8, 4.4, INK)
    c.line(23, gy - 22, 26, gy - 24, GOLD_D)          # rim light on the hood
    c.line(26, gy - 24, 29, gy - 22, GOLD)
    c.px(29, gy - 21, GOLD_D); c.px(30, gy - 20, GOLD_D)
    c.px(29, gy - 18, STONE_D); c.px(30, gy - 18, STONE_D)  # shadowed face
    c.px(21, gy - 15, GOLD_D); c.px(22, gy - 16, GOLD)       # shoulder highlight
    for i, (sx, ex) in enumerate([(25, 9), (26, 11), (27, 14), (28, 17), (29, 20), (30, 23)]):
        c.line(sx, gy - 14 + i, ex, gy - 1, CAPE if i % 2 == 0 else CAPE_D)
        if i % 2 == 0:
            c.line(sx + 1, gy - 14 + i, ex + 1, gy - 2, GOLD_D)
    c.ellipse(37, gy - 5, 4.5, 3.2, INK2)               # raised knee
    c.line(33, gy - 7, 40, gy - 8, GOLD_D)
    c.line(30, gy - 12, 34, gy - 8, GOLD_D)

    # sword planted in the rock beside him
    sx = 9
    c.line(sx, gy + 2, sx, gy - 16, STEEL_D)
    c.line(sx - 1, gy, sx - 1, gy - 14, STEEL)
    c.rect(sx - 4, gy - 14, sx + 5, gy - 13, INK2)
    c.px(sx - 4, gy - 14, GOLD); c.px(sx + 4, gy - 14, GOLD)
    c.rect(sx - 1, gy - 19, sx + 2, gy - 17, GOLD_D)
    c.px(sx, gy - 20, GOLD)

    for fx in (15, 37, 52, 66):
        flower(c, fx, prof[fx] - 5)

    for bx, by in [(58, 6), (64, 11), (52, 12), (74, 7)]:
        bird(c, bx, by, STONE_D)
    flecks(c, rng, 9, GOLD_L, (34, 2, 104, 26))
    flecks(c, rng, 6, LIME, (34, 2, 104, 24))

    c.mask_by(lambda x, y: smoothstep((x - 92) / 27) ** 1.2)
    return c


# ---------------------------------------------------------------- right scene
def grow(c, rng, x, y, ang, length, depth, thick, thin):
    if depth == 0 or length < 2:
        return
    x2, y2 = x + math.cos(ang) * length, y + math.sin(ang) * length
    col = thick if depth > 3 else thin
    c.line(x, y, x2, y2, col)
    if depth > 3:
        c.line(x + 1, y, x2 + 1, y2, col)
    for da in (-0.5, 0.45):
        grow(c, rng, x2, y2, ang + da + rng.uniform(-0.15, 0.15), length * rng.uniform(0.62, 0.78), depth - 1, thick, thin)


def right_scene():
    W, H = 130, 50
    rng = np.random.default_rng(11)
    c = Canvas(W, H)
    WATER = 43

    # far, pale ruins on the left
    far = Canvas(W, H)
    castle(far, 6, 41, [(0, 3, 12, 5), (5, 4, 19, 8), (11, 3, 10, 0), (16, 5, 23, 9), (24, 3, 14, 6)], STONE_XL, STONE_L, rng, wall=7)
    arches(far, 28, 58, 31, 41, 7, STONE_L, STONE_XL, pier=2)
    far.mask_by(lambda x, y: smoothstep((y - 28) / 13))
    c.over(far)

    # trunk, behind the fortress
    for y in range(19, 42):
        t = (y - 19) / 22
        half = 3 + 3.5 * t ** 1.8
        for x in range(int(97 - half), int(97 + half) + 1):
            col = GOLD_L if abs(x - 97) < half * 0.45 else GOLD
            if x > 97 + half * 0.55:
                col = GOLD_D
            c.px(x, y, col)

    # canopy: a rich golden mass, lit from above, cropped by the top and right edges
    noise = fbm(W, H, rng, cells=(14, 7, 3), weights=(0.45, 0.35, 0.2))
    lobes = [(100, 8, 44, 14), (66, 12, 20, 8), (84, 3, 26, 9)]
    canopy = Canvas(W, H)
    for y in range(0, 28):
        for x in range(36, W):
            d = min(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 for cx, cy, rx, ry in lobes)
            d += (noise[y, x] - 0.5) * 0.55
            if d > 1:
                continue
            if d > 0.78 and B8[y % 8, x % 8] < (d - 0.78) / 0.22 * 1.1:
                continue
            n = noise[y, x] * 0.7 + (1 - y / 28) * 0.35 - d * 0.2
            col = GOLD_L if n > 0.72 else GOLD if n > 0.44 else GOLD_D
            if rng.random() < 0.08:
                continue
            canopy.px(x, y, col)
    c.over(canopy)
    for ang, ln in [(-2.45, 17), (-2.05, 19), (-1.7, 20), (-1.35, 20), (-0.95, 19), (-0.55, 17), (-3.0, 12), (-0.15, 11)]:
        grow(c, rng, 97, 24, ang, ln, 5, (255, 248, 214), GOLD_XL)
    for _ in range(26):
        x, y = int(rng.integers(40, W)), int(rng.integers(0, 24))
        if c.opaque(x, y):
            c.px(x, y, GOLD_XL)
    for x in range(52, 126, 3):
        if rng.random() < 0.65:
            top = next((y for y in range(27, 0, -1) if canopy.opaque(x, y)), None)
            if top is None:
                continue
            ln = int(rng.integers(3, 15))
            for i in range(ln):
                if i < ln - 3 or i % 2 == 0:
                    c.px(x + (i // 6) * int(rng.integers(-1, 2)), top + 1 + i, GOLD if i % 3 else GOLD_L)

    # the ruined fortress, two clusters with a lit walkway between them
    fort = Canvas(W, H)
    castle(fort, 56, 42, [(0, 5, 12, 6), (4, 6, 19, 9), (11, 4, 10, 0), (15, 5, 15, 7), (21, 4, 9, 0), (25, 5, 13, 6)], STONE_D, INK2, rng, wall=7, glow=GOLD)
    castle(fort, 106, 42, [(0, 4, 11, 0), (3, 6, 17, 8), (10, 5, 21, 10), (16, 4, 12, 0), (19, 5, 15, 7)], STONE_D, INK2, rng, wall=7, glow=GOLD)
    arches(fort, 60, 130, 35, 42, 10, STONE_D, INK2, pier=3, glow=GOLD)
    fort.mask_by(lambda x, y: smoothstep((y - 33) / 10) * 0.8)
    c.over(fort)
    for x in range(58, W):
        top = 38 + int(2 * math.sin(x * 0.4) + rng.uniform(-1, 1))
        for y in range(top, WATER):
            c.px(x, y, INK if (x + y) % 5 else MOSS_D)
        c.px(x, top, MOSS)
        if rng.random() < 0.3:
            c.px(x, top - 1, MOSS_D)
    for cx, w in [(28, 14), (47, 10), (8, 8)]:
        for i in range(w):
            h = int(round(math.sin(math.pi * (i + 0.5) / w) * 4))
            for y in range(WATER - h, WATER):
                c.px(cx - w // 2 + i, y, INK if y > WATER - h else MOSS_D)
            c.px(cx - w // 2 + i, WATER - h, MOSS)
    c.poly([(116, WATER + 6), (119, 34), (124, 31), (130, 29), (130, WATER + 6)], INK)
    for i in range(14):
        c.px(119 + i // 2 + (i % 3), 33 - i // 5 + (i // 4), MOSS if i % 2 else MOSS_L)
    c.poly([(121, 36), (126, 33), (130, 33), (130, 37), (124, 39)], MOSS_D)

    for k in range(1, 7):
        sy, dy = WATER - k, WATER + k
        for x in range(W):
            if c.opaque(x, sy) and STIPPLE[dy % 64, x % 64] < 0.42 - k * 0.05 and not c.opaque(x, dy):
                col = tuple(int(0.55 * a + 0.45 * b) for a, b in zip(tuple(c.a[sy, x, :3]), PAPER))
                c.px(x, dy, col)
    for _ in range(26):
        x, y = int(rng.integers(20, W - 10)), int(rng.integers(WATER + 1, H))
        for i in range(int(rng.integers(3, 12))):
            if not c.opaque(x + i, y):
                c.px(x + i, y, STONE_XL if rng.random() < 0.7 else GOLD_L)

    for bx, by in [(34, 6), (28, 11), (20, 8)]:
        bird(c, bx, by, STONE_D)
    flecks(c, rng, 8, LIME, (14, 2, 70, 30))
    flecks(c, rng, 8, GOLD_L, (14, 2, 70, 30))

    c.mask_by(lambda x, y: (1 - smoothstep((x - 4) / 26)) ** 1.1)
    return c


# ---------------------------------------------------------------- ring emblem
def emblem():
    """A thin, delicate sigil: overlapping golden rings pierced by a blade."""
    W, H = 40, 30
    rng = np.random.default_rng(3)
    c = Canvas(W, H)
    for ox, oy, r, col in [(0, 0, 12, GOLD), (-6, 2, 8, GOLD_L), (6, -2, 7, GOLD), (1, 1, 4, GOLD_L)]:
        for x, y in circle_pts(20 + ox, 17 + oy, r):
            if rng.random() > 0.12:
                c.px(x, y, col)
    for y in range(0, H):
        c.px(20, y, GOLD if y % 2 == 0 else GOLD_L)
    c.rect(17, 3, 24, 4, GOLD)
    c.px(16, 3, GOLD_D); c.px(24, 3, GOLD_D)
    c.px(20, 0, GOLD_XL); c.px(20, 1, GOLD_XL)
    for _ in range(10):
        x, y = int(rng.integers(2, 38)), int(rng.integers(2, 28))
        if not c.opaque(x, y):
            c.px(x, y, GOLD_XL)
    return c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', help='also write 4x previews composited on the paper colour into this directory')
    ap.add_argument('--mock-width', type=int, default=360, help='width in art pixels of the mock hero strip written with --preview')
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    scenes = {'hero-left': left_scene(), 'hero-right': right_scene(), 'emblem': emblem()}
    for name, canvas in scenes.items():
        canvas.save(OUT / f'{name}.png')
        print(f'wrote {OUT / (name + ".png")} ({canvas.w}x{canvas.h})')
        if args.preview:
            d = Path(args.preview)
            d.mkdir(parents=True, exist_ok=True)
            canvas.save(d / f'{name}-preview.png', scale=4, bg=PAPER)
    if args.preview:
        mock = Canvas(args.mock_width, 50)
        mock.over(scenes['hero-left'])
        mock.over(scenes['hero-right'], args.mock_width - scenes['hero-right'].w)
        mock.over(scenes['emblem'], (args.mock_width - 40) // 2, 2)
        mock.save(Path(args.preview) / 'hero-mock.png', scale=4, bg=PAPER)


if __name__ == '__main__':
    main()
