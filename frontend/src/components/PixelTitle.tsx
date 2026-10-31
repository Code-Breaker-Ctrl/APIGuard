import React from 'react';

/*
 * The APIGuard wordmark, drawn as an SVG of square "art pixels": chunky black letters with a
 * faint cell grid, a lime drop shadow, and (in the hero) moss, hanging vines and small flowers
 * growing over the letters. The letters are built from the glyph bitmaps below; the growth is
 * drawn at half a letter-cell, so it reads as fine detail next to the big letter blocks. A fixed
 * seed makes the result identical on every render, and it stays crisp at any zoom. The vines
 * sway one half-cell at a time (see .vine in index.css).
 */

const INK = '#181a14';
const LIME = '#d8e820';
const GRID = '#434a30';
const MOSS_D = '#34400f';
const MOSS = '#5d7a14';
const MOSS_L = '#93a42c';
const GOLD = '#e8c060';
const GOLD_L = '#f6dc88';

const GLYPHS: Record<string, string[]> = {
  A: [
    '..#######..', '.#########.', '####...####', '####...####', '####...####', '####...####', '###########',
    '###########', '###########', '####...####', '####...####', '####...####', '####...####', '####...####',
  ],
  P: [
    '##########.', '###########', '####...####', '####...####', '####...####', '####...####', '###########',
    '##########.', '####.......', '####.......', '####.......', '####.......', '####.......', '####.......',
  ],
  I: [
    '########', '########', '..####..', '..####..', '..####..', '..####..', '..####..',
    '..####..', '..####..', '..####..', '..####..', '..####..', '########', '########',
  ],
  G: [
    '.#########.', '###########', '####...####', '####.......', '####.......', '####.......', '####..#####',
    '####..#####', '####...####', '####...####', '####...####', '####...####', '###########', '.#########.',
  ],
  U: [
    '####...####', '####...####', '####...####', '####...####', '####...####', '####...####', '####...####',
    '####...####', '####...####', '####...####', '####...####', '####...####', '###########', '.#########.',
  ],
  R: [
    '##########.', '###########', '####...####', '####...####', '####...####', '####...####', '###########',
    '##########.', '####..####.', '####...####', '####...####', '####...####', '####...####', '####...####',
  ],
  D: [
    '##########.', '###########', '####...####', '####...####', '####...####', '####...####', '####...####',
    '####...####', '####...####', '####...####', '####...####', '####...####', '###########', '##########.',
  ],
};

const WORD = 'APIGUARD';
const LETTER_GAP = 2;
const PAD_X = 2;
const VINE_GROUPS = 3;

const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const cell = (x: number, y: number) => `M${x} ${y}h1v1h-1z`;
/** a half-cell square at fine coordinates (two per cell) */
const half = (fx: number, fy: number) => `M${fx / 2} ${fy / 2}h.5v.5h-.5z`;

interface Growth {
  /** -1 stays still; 0..2 sway out of step with each other */
  group: number;
  paths: [colour: string, d: string][];
}

interface Built {
  width: number;
  height: number;
  letters: string;
  grid: string;
  growth: Growth[];
}

const build = (overgrowth: boolean): Built => {
  const padTop = overgrowth ? 7 : 1;
  const padBottom = overgrowth ? 4 : 2;
  const filled = new Set<string>();
  const centres: number[] = [];
  let x0 = PAD_X;
  for (const ch of WORD) {
    const rows = GLYPHS[ch];
    rows.forEach((row, y) => {
      [...row].forEach((v, x) => {
        if (v === '#') filled.add(`${x0 + x},${padTop + y}`);
      });
    });
    centres.push(x0 + Math.floor(rows[0].length / 2));
    x0 += rows[0].length + LETTER_GAP;
  }
  const width = x0 - LETTER_GAP + PAD_X;
  const height = padTop + GLYPHS.A.length + padBottom;
  const has = (x: number, y: number) => filled.has(`${x},${y}`);

  let letters = '';
  let grid = '';
  filled.forEach((key) => {
    const [x, y] = key.split(',').map(Number);
    letters += cell(x, y);
    if (has(x + 1, y)) grid += `M${x + 1} ${y}v1`;
    if (has(x, y + 1)) grid += `M${x} ${y + 1}h1`;
  });

  // fine-grained growth: key "fx,fy" -> colour, per sway group
  const groups = new Map<number, Map<string, string>>();
  if (overgrowth) {
    const rand = mulberry32(2025);
    const put = (group: number, fx: number, fy: number, colour: string) => {
      if (has(Math.floor(fx / 2), Math.floor(fy / 2))) return;
      let g = groups.get(group);
      if (!g) groups.set(group, (g = new Map()));
      g.set(`${fx},${fy}`, colour);
    };
    const side = () => (rand() < 0.5 ? -1 : 1);

    [...filled]
      .map((k) => k.split(',').map(Number))
      .sort((a, b) => a[1] - b[1] || a[0] - b[0])
      .forEach(([cx, cy]) => {
        for (let s = 0; s < 2; s++) {
          const fx = cx * 2 + s;
          const group = (cx + s) % VINE_GROUPS;

          if (!has(cx, cy - 1)) {
            const r = rand();
            if (r < 0.3) {
              // a vine climbing up from the top edge
              const len = 2 + Math.floor(rand() * 6);
              let x = fx;
              const y0 = cy * 2 - 1;
              for (let i = 0; i < len; i++) {
                put(group, x, y0 - i, i === 0 ? MOSS_D : i === len - 1 ? MOSS_L : MOSS);
                if (rand() < 0.28) x += side();
              }
              if (len > 3 && rand() < 0.6) put(group, x + side(), y0 - Math.floor(len / 2), MOSS_L);
            } else if (r < 0.66) {
              // moss capping the edge
              put(-1, fx, cy * 2 - 1, MOSS_D);
              if (rand() < 0.4) put(-1, fx, cy * 2 - 2, MOSS);
            }
          }

          if (!has(cx, cy + 1) && rand() < 0.13) {
            // a vine hanging from the bottom edge
            const len = 2 + Math.floor(rand() * 7);
            let x = fx;
            const y0 = cy * 2 + 2;
            for (let i = 0; i < len; i++) {
              put(group, x, y0 + i, i === 0 ? MOSS_D : i === len - 1 ? MOSS_L : MOSS);
              if (rand() < 0.25) x += side();
            }
            if (len > 3 && rand() < 0.5) put(group, x + side(), y0 + Math.floor(len / 2), MOSS_L);
          }
        }
        if (!has(cx - 1, cy) && rand() < 0.05) put(-1, cx * 2 - 1, cy * 2 + (rand() < 0.5 ? 0 : 1), MOSS);
        if (!has(cx + 1, cy) && rand() < 0.05) put(-1, cx * 2 + 2, cy * 2 + (rand() < 0.5 ? 0 : 1), MOSS);
      });

    // small flowers standing on the A, I, second A and D
    [0, 2, 5, 7].forEach((letter, n) => {
      const cx = centres[letter];
      let top = padTop;
      while (!has(cx, top)) top++;
      const group = n % VINE_GROUPS;
      const fx = cx * 2;
      const base = top * 2 - 1;
      for (let i = 0; i < 6; i++) put(group, fx, base - i, i % 2 ? MOSS : MOSS_D);
      put(group, fx - 1, base - 3, MOSS_L);
      put(group, fx + 1, base - 4, MOSS_L);
      const fy = base - 7;
      [[0, -1], [-1, 0], [1, 0], [0, 1]].forEach(([dx, dy]) => put(group, fx + dx, fy + dy, GOLD));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy]) => put(group, fx + dx, fy + dy, GOLD_L));
      put(group, fx, fy, INK);
    });
  }

  const growth: Growth[] = [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([group, cellsByKey]) => {
      const byColour: Record<string, string> = {};
      cellsByKey.forEach((colour, key) => {
        const [fx, fy] = key.split(',').map(Number);
        byColour[colour] = (byColour[colour] || '') + half(fx, fy);
      });
      return { group, paths: Object.entries(byColour) };
    });

  return { width, height, letters, grid, growth };
};

const HERO = build(true);
const MINI = build(false);

interface PixelTitleProps {
  /** "hero" adds moss, vines and flowers; "mini" is the plain wordmark used in the collapsed toolbar. */
  variant?: 'hero' | 'mini';
  className?: string;
  style?: React.CSSProperties;
}

export const PixelTitle: React.FC<PixelTitleProps> = ({ variant = 'hero', className, style }) => {
  const t = variant === 'hero' ? HERO : MINI;
  return (
    <svg
      className={className}
      style={style}
      viewBox={`0 0 ${t.width} ${t.height}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <g fill={LIME}>
        <path d={t.letters} transform="translate(1 1)" />
        <path d={t.letters} transform="translate(1 0)" />
        <path d={t.letters} transform="translate(0 1)" />
      </g>
      <path d={t.letters} fill={INK} />
      <path d={t.grid} fill="none" stroke={GRID} strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {t.growth.map((g) => (
        <g key={g.group} className={g.group >= 0 ? `vine vine-${g.group}` : undefined}>
          {g.paths.map(([colour, d]) => (
            <path key={colour} d={d} fill={colour} />
          ))}
        </g>
      ))}
    </svg>
  );
};
