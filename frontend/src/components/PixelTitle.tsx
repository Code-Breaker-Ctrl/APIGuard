import React from 'react';

/*
 * The APIGuard wordmark, drawn as an SVG of square "art pixels": chunky black letters with a
 * faint cell grid, a lime drop shadow, and (in the hero) moss and small flowers growing over
 * the letters. Everything is generated from the glyph bitmaps below with a fixed seed, so the
 * result is identical on every render and stays crisp at any zoom.
 */

const INK = '#181a14';
const LIME = '#d8e820';
const GRID = '#434a30';
const MOSS_D = '#34400f';
const MOSS = '#5d7a14';
const MOSS_L = '#93a42c';
const GOLD = '#e8c060';

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

const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const cell = (x: number, y: number) => `M${x} ${y}h1v1h-1z`;

interface Built {
  width: number;
  height: number;
  letters: string;
  grid: string;
  growth: [string, string][];
}

const build = (overgrowth: boolean): Built => {
  const padTop = overgrowth ? 7 : 1;
  const padBottom = overgrowth ? 3 : 2;
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

  const growth = new Map<string, string>();
  if (overgrowth) {
    const rand = mulberry32(2025);
    const put = (x: number, y: number, colour: string) => {
      if (!has(x, y)) growth.set(`${x},${y}`, colour);
    };
    [...filled]
      .map((k) => k.split(',').map(Number))
      .sort((a, b) => a[1] - b[1] || a[0] - b[0])
      .forEach(([x, y]) => {
        if (!has(x, y - 1)) {
          if (rand() < 0.2) {
            const h = 1 + Math.floor(rand() * 3);
            for (let i = 1; i <= h; i++) put(x, y - i, i === h && rand() < 0.5 ? MOSS_L : i === 1 ? MOSS_D : MOSS);
            if (rand() < 0.5) put(x + (rand() < 0.5 ? -1 : 1), y - h, MOSS);
          } else if (rand() < 0.1) {
            put(x, y - 1, MOSS_D);
          }
        }
        if (!has(x, y + 1) && rand() < 0.06) {
          put(x, y + 1, MOSS);
          if (rand() < 0.5) put(x, y + 2, MOSS_D);
        }
        if (!has(x - 1, y) && rand() < 0.05) put(x - 1, y, MOSS);
      });

    // small flowers standing on the A, I, second A and D
    [0, 2, 5, 7].forEach((letter) => {
      const cx = centres[letter];
      let top = padTop;
      while (!has(cx, top)) top++;
      for (let y = top - 3; y < top; y++) growth.set(`${cx},${y}`, MOSS_D);
      const fy = top - 4;
      [[0, -1], [-1, 0], [1, 0], [0, 1]].forEach(([dx, dy]) => growth.set(`${cx + dx},${fy + dy}`, GOLD));
      growth.set(`${cx},${fy}`, INK);
    });
  }

  const byColour: Record<string, string> = {};
  growth.forEach((colour, key) => {
    const [x, y] = key.split(',').map(Number);
    byColour[colour] = (byColour[colour] || '') + cell(x, y);
  });

  return { width, height, letters, grid, growth: Object.entries(byColour) };
};

const HERO = build(true);
const MINI = build(false);

interface PixelTitleProps {
  /** "hero" adds moss and flowers; "mini" is the plain wordmark used in the collapsed toolbar. */
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
      {t.growth.map(([colour, d]) => (
        <path key={colour} d={d} fill={colour} />
      ))}
    </svg>
  );
};
