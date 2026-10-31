"""
Builds the hero banner's art from a reference banner image.

The scenery (ruins, a resting knight, a golden tree over a fortress, the thin golden ring, the
water) is cut from the reference at its own resolution instead of being redrawn, so the banner keeps
the fine pixel grain of the original. The reference's title, subtitle and ornaments are erased (the
page draws its own), the paper colour is converted to transparency so the art sits on the page's
own background, and the small floating islands are cut into separate sprites so the page can make
them bob. The mist and the repeating water strip are generated.

Output (frontend/src/assets/hero/):
    hero-left.webp, hero-right.webp   the two scenes
    island-*.webp                    floating islands, animated by the page
    emblem.webp                      the golden ring
    hero-water.webp                  seamless horizontal water strip
    hero-fog.webp                    seamless horizontal mist strip
    hero-meta.json                  where everything sits in the reference's pixel coordinates

Usage (from the repo root):
    pip install -r scripts/requirements.txt          # Pillow and numpy, only needed to regenerate the art
    python scripts/make_hero_art.py --src path/to/reference-banner.webp
    python scripts/make_hero_art.py --src ... --preview DIR    # also write a preview on the paper colour

The reference is not stored in the repo; pass it with --src. Everything is deterministic.
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'frontend' / 'src' / 'assets' / 'hero'

PAPER = (255, 252, 241)          # the page background (--paper)
CLEAN = 0.035                    # darkness below this is the reference's faint grid dots, not art

# --- where things are in the reference (1600 x 533), in its pixels
LEFT = (0, 556)                  # x range of the left scene
RIGHT = (1048, 1600)             # x range of the right scene
LEFT_FADE = (470, 556)           # the scene thins out into the page towards the middle
RIGHT_FADE = (1048, 1112)
EMBLEM = (696, 12, 912, 206)     # x0, y0, x1, y1
EMBLEM_FADE_FROM = 182           # the ring melts away before it meets the title
WATER = (640, 428, 940, 533)

# parts of the reference's own title block, erased from the scenes: (x0, y0, x1, y1)
ERASE = [
    (402, 168, 560, 347),        # left: first letter, vines, flower
    (1048, 168, 1196, 347),      # right: last letter, vines, flower
    (495, 342, 560, 362),        # ornament lines under the title
    (1048, 342, 1118, 362),
]
# the three birds are redrawn by the page so they can fly
BIRDS = [(244, 168, 260, 181), (330, 168, 350, 181), (290, 188, 308, 202)]
# floating islands cut into sprites: (id, scene, x0, y0, x1, y1)
ISLANDS = [
    ('island-a', 'left', 52, 162, 96, 248),
    ('island-b', 'left', 15, 219, 49, 292),
    ('island-c', 'left', 38, 260, 78, 346),
    ('island-d', 'right', 1136, 350, 1165, 408),
]


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def paper_to_alpha(rgb, bg):
    """Colour-to-alpha: keeps the ink, makes the paper transparent (compositing back gives the original)."""
    p = rgb.astype(np.float32)
    b = np.array(bg, np.float32)
    a = np.clip((b - p) / b, 0.0, 1.0).max(axis=2)
    col = (p - b * (1 - a)[..., None]) / np.maximum(a, 1e-4)[..., None]
    col = np.clip(col, 0, 255)
    a = np.clip((a - CLEAN) / (1 - CLEAN), 0.0, 1.0)
    return np.dstack([col, a * 255.0])


def feather_box(alpha, x0, y0, x1, y1):
    alpha[max(y0, 0):y1, max(x0, 0):x1] = 0.0


def save(arr, name):
    img = Image.fromarray(np.clip(np.rint(arr), 0, 255).astype(np.uint8), 'RGBA')
    img.save(OUT / name, lossless=True, quality=100, method=6)
    return img


def periodic_noise(h, w, sx, sy, rng):
    """Gaussian-filtered noise that wraps in both directions (so strips tile)."""
    n = rng.standard_normal((h, w))
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    g = np.exp(-2 * np.pi ** 2 * ((sx * fx) ** 2 + (sy * fy) ** 2))
    out = np.fft.ifft2(np.fft.fft2(n) * g).real
    return (out - out.min()) / (out.max() - out.min())


BAYER4 = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) + 0.5) / 16.0


def make_fog(cells_w=256, cells_h=44, cell=4, seed=7):
    """Pixel-dithered mist that is thick near the bottom and wraps horizontally."""
    rng = np.random.default_rng(seed)
    broad = periodic_noise(cells_h, cells_w, 11.0, 3.0, rng)
    fine = periodic_noise(cells_h, cells_w, 4.0, 1.5, rng)
    v = 0.62 * broad + 0.38 * fine
    v = np.clip((v - 0.40) * 3.3, 0.0, 1.0)
    y = (np.arange(cells_h)[:, None] + 0.5) / cells_h
    v = v * smoothstep(0.0, 0.62, y) * (1.0 - 0.35 * smoothstep(0.86, 1.0, y))
    levels = np.array([0.0, 0.16, 0.30, 0.46])
    t = v * (len(levels) - 1)
    base = np.floor(t)
    thr = np.tile(BAYER4, (cells_h // 4 + 1, cells_w // 4 + 1))[:cells_h, :cells_w]
    idx = np.clip(base + ((t - base) > thr), 0, len(levels) - 1).astype(int)
    alpha = levels[idx]
    warm = periodic_noise(cells_h, cells_w, 6.0, 2.0, rng) > 0.62
    rgb = np.where(warm[..., None], np.array([233, 212, 150.0]), np.array([232, 226, 200.0]))
    cells = np.dstack([rgb, alpha * 255.0])
    return np.repeat(np.repeat(cells, cell, axis=0), cell, axis=1)


def make_water_tile(rgba, box, cross=70):
    """Cuts a strip and cross-fades it with itself shifted by half, so it repeats seamlessly."""
    x0, y0, x1, y1 = box
    strip = rgba[y0:y1, x0:x1].copy()
    strip[..., :3] *= (strip[..., 3:4] / 255.0)              # premultiply so the blend does not smear colour
    w = strip.shape[1]
    shifted = np.roll(strip, w // 2, axis=1)
    xs = np.arange(w)
    weight = np.clip(1.0 - np.abs(xs - w / 2) / (w / 2 - 1e-6), 0, 1) ** 0.8
    weight = np.clip(weight * 1.8, 0, 1)[None, :, None]
    tile = strip * weight + shifted * (1 - weight)
    a = np.maximum(tile[..., 3:4], 1e-3)
    out = np.dstack([np.clip(tile[..., :3] * 255.0 / a, 0, 255), tile[..., 3]])
    out[tile[..., 3] < 1.0, :3] = 0
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--src', required=True, help='reference banner image (1600 x 533)')
    ap.add_argument('--preview', help='write previews on the paper colour into this folder')
    args = ap.parse_args()

    ref = Image.open(args.src).convert('RGB')
    if ref.size != (1600, 533):
        raise SystemExit(f'expected a 1600x533 reference, got {ref.size}')
    OUT.mkdir(parents=True, exist_ok=True)

    rgba = paper_to_alpha(np.asarray(ref), PAPER)

    # erase the reference's own title block and the birds (the page redraws the birds)
    for box in ERASE + BIRDS:
        feather_box(rgba[..., 3], *box)

    # floating islands become sprites; their place in the scene is cleared
    meta_islands = []
    for name, scene, x0, y0, x1, y1 in ISLANDS:
        sprite = rgba[y0:y1, x0:x1].copy()
        if name == 'island-c':                               # its tail runs into the ground mist
            sprite[..., 3] *= (1.0 - smoothstep(0.80, 1.0, (np.arange(y1 - y0)[:, None] / (y1 - y0))))
        save(sprite, f'{name}.webp')
        feather_box(rgba[..., 3], x0, y0, x1, y1)
        meta_islands.append({'id': name, 'scene': scene, 'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0})

    def scene(xr, fade, name, fade_in):
        x0, x1 = xr
        part = rgba[:, x0:x1].copy()
        xs = np.arange(x0, x1)[None, :]
        k = smoothstep(fade[0], fade[1], xs)
        part[..., 3] *= (k if fade_in else (1.0 - k))
        save(part, name)

    scene(LEFT, LEFT_FADE, 'hero-left.webp', fade_in=False)
    scene(RIGHT, RIGHT_FADE, 'hero-right.webp', fade_in=True)

    ex0, ey0, ex1, ey1 = EMBLEM
    ring = rgba[ey0:ey1, ex0:ex1].copy()
    ring[..., 3] *= 1.0 - smoothstep(EMBLEM_FADE_FROM - ey0, ey1 - ey0, np.arange(ey1 - ey0)[:, None])
    save(ring, 'emblem.webp')

    # a stray gold glint sits in the reference's water
    water_src = rgba.copy()
    feather_box(water_src[..., 3], 698, 490, 716, 506)
    water = make_water_tile(water_src, WATER)
    save(water, 'hero-water.webp')

    fog = make_fog()
    save(fog, 'hero-fog.webp')

    meta = {
        'ref': {'w': 1600, 'h': 533},
        'left': {'x0': LEFT[0], 'w': LEFT[1] - LEFT[0]},
        'right': {'x0': RIGHT[0], 'w': RIGHT[1] - RIGHT[0]},
        'emblem': {'x': ex0, 'y': ey0, 'w': ex1 - ex0, 'h': ey1 - ey0},
        'water': {'y': WATER[1], 'h': WATER[3] - WATER[1], 'tileW': WATER[2] - WATER[0]},
        'fog': {'w': int(fog.shape[1]), 'h': int(fog.shape[0])},
        'islands': meta_islands,
    }
    (OUT / 'hero-meta.json').write_text(json.dumps(meta, indent=2) + '\n', encoding='utf-8')

    if args.preview:
        prev = Path(args.preview)
        prev.mkdir(parents=True, exist_ok=True)
        canvas = Image.new('RGBA', (1600, 533), PAPER + (255,))
        layout = [
            ('hero-water.webp', None),
            ('hero-left.webp', (LEFT[0], 0)),
            ('hero-right.webp', (RIGHT[0], 0)),
            ('emblem.webp', (ex0, ey0)),
        ]
        wt = Image.open(OUT / 'hero-water.webp')
        for x in range(0, 1600, wt.width):
            canvas.alpha_composite(wt, (x, WATER[1]))
        for name, pos in layout[1:]:
            canvas.alpha_composite(Image.open(OUT / name), pos)
        for isl in meta_islands:
            canvas.alpha_composite(Image.open(OUT / f"{isl['id']}.webp"), (isl['x'], isl['y']))
        canvas.convert('RGB').save(prev / 'hero-preview.png')
        fog_prev = Image.new('RGBA', (fog.shape[1], fog.shape[0]), PAPER + (255,))
        fog_prev.alpha_composite(Image.open(OUT / 'hero-fog.webp'))
        fog_prev.convert('RGB').save(prev / 'fog-preview.png')

    print('wrote', ', '.join(sorted(p.name for p in OUT.iterdir())))


if __name__ == '__main__':
    main()
