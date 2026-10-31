import React from 'react';

export type GraceMood = 'idle' | 'scanning' | 'leak';

interface GraceBackdropProps {
  mood: GraceMood;
}

/* ------------------------------------------------------------------
   Pixel art is generated once, as <path> data grouped by colour, so the
   Erdtree (~1,500 pixels) costs a handful of DOM nodes.
   ------------------------------------------------------------------ */

const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const px = (x: number, y: number) => `M${x} ${y}h1v1h-1z`;

// ---------- Erdtree ----------
const TREE_W = 48;
const TREE_H = 58;

const buildTree = () => {
  const rand = mulberry32(1337);
  const byColour: Record<string, string> = {};
  const twinkles: { x: number; y: number; delay: number }[] = [];
  const taken = new Map<string, string>();
  const put = (x: number, y: number, colour: string) => {
    if (x < 0 || y < 0 || x >= TREE_W || y >= TREE_H) return;
    taken.set(`${x},${y}`, colour);
  };

  // Canopy: a dithered golden crown, brighter at the centre-top
  for (let y = 0; y < 40; y++) {
    for (let x = 0; x < TREE_W; x++) {
      const dx = (x - 23.5) / 22.5;
      const dy = (y - 19) / 18.5;
      const d = dx * dx + dy * dy + (rand() - 0.5) * 0.22;
      if (d >= 1) continue;
      const edgeFade = 1 - Math.max(0, d - 0.55) * 1.7;
      if (rand() > edgeFade || rand() < 0.05) continue;
      const tone = 1 - d + (rand() - 0.5) * 0.5 - (y > 24 ? (y - 24) * 0.01 : 0);
      const colour = tone > 0.72 ? '#f0d98a' : tone > 0.46 ? '#d4a843' : tone > 0.2 ? '#b88a2e' : '#8a6420';
      put(x, y, colour);
      if (tone > 0.55 && rand() < 0.045) twinkles.push({ x, y, delay: Math.round(rand() * 40) / 10 });
    }
  }

  // Branches running from the trunk up into the crown
  for (const side of [-1, 1]) {
    for (let t = 0; t < 15; t++) {
      put(24 + side * (1 + t), 36 - Math.round(t * 0.85), '#6b4f22');
      if (t % 3 === 0) put(24 + side * (1 + t), 35 - Math.round(t * 0.85), '#4a3517');
    }
    for (let t = 0; t < 9; t++) {
      put(24 + side * (1 + t * 0.55), 34 - t * 2, '#6b4f22');
    }
  }

  // Trunk, flaring into roots
  for (let y = 36; y < 52; y++) {
    const half = y < 48 ? 2 + (y - 36) * 0.12 : 3.5 + (y - 48) * 1.1;
    for (let x = Math.floor(24 - half); x <= Math.ceil(24 + half - 1); x++) {
      put(x, y, x >= 24 + half - 2 ? '#4a3517' : '#6b4f22');
    }
  }
  for (const side of [-1, 1]) {
    for (let t = 0; t < 16; t++) {
      const x = 24 + side * (4 + t);
      const y = 52 + Math.round(t * 0.28 + Math.sin(t * 0.7) * 0.9);
      put(x, y, '#4a3517');
      if (t < 10) put(x, y + 1, '#33250f');
    }
  }

  taken.forEach((colour, key) => {
    const [x, y] = key.split(',').map(Number);
    byColour[colour] = (byColour[colour] || '') + px(x, y);
  });
  return { paths: Object.entries(byColour), twinkles };
};

// ---------- Sword in the ground ----------
const SWORD_VB_W = 31;
const SWORD_VB_H = 52;
const SWORD_X = 9; // sword is 13 wide, centred in the 31-wide mound

const SWORD_COLOURS: Record<string, string> = {
  G: '#d4a843', // gold fittings
  g: '#8a6420', // shaded gold
  W: '#e9e2cf', // blade edge (catches light)
  w: '#b9b09a', // blade
  D: '#6e6858', // blade shadow
};

const buildSword = () => {
  const rows: string[] = [
    '.....GGG.....',
    '....GGGGG....',
    '.....GgG.....',
    '......g......',
    '......D......',
    '......g......',
    '......D......',
    '.G.........G.',
    'GGG..GGG..GGG',
    'GGGGGGGGGGGGG',
    'gGggGGGGGggGg',
    '.gg.GgggG.gg.',
    '....GGGGG....',
  ];
  for (let i = 0; i < 24; i++) rows.push('.....WwD.....');
  rows.push('.....WwD.....', '.....wwD.....', '......wD.....', '......wD.....', '......w......', '......D......');

  const staticPaths: Record<string, string> = {};
  const sheenRows: { y: number; d: string }[] = [];
  rows.forEach((row, y) => {
    let sheen = '';
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      if (ch === 'W') {
        sheen += px(x + SWORD_X, y);
        return;
      }
      const colour = SWORD_COLOURS[ch];
      staticPaths[colour] = (staticPaths[colour] || '') + px(x + SWORD_X, y);
    });
    if (sheen) {
      staticPaths[SWORD_COLOURS.W] = (staticPaths[SWORD_COLOURS.W] || '') + sheen;
      sheenRows.push({ y, d: sheen });
    }
  });

  // Mound the blade is buried in
  const mound: Record<string, string> = {};
  const moundRand = mulberry32(99);
  const widths = [9, 15, 21, 27, 31, 31];
  widths.forEach((w, i) => {
    const y = 42 + i;
    const x0 = Math.round((SWORD_VB_W - w) / 2);
    for (let x = x0; x < x0 + w; x++) {
      const colour = i === 0 ? '#5a4a2a' : moundRand() < 0.18 ? '#3d3526' : '#2b2316';
      mound[colour] = (mound[colour] || '') + px(x, y);
    }
  });
  // Specks of grace in the grass
  const specks = [px(6, 46), px(24, 46), px(12, 44), px(19, 45), px(3, 49), px(27, 48)].join('');
  mound['#d4a843'] = (mound['#d4a843'] || '') + specks;

  return { staticPaths: Object.entries(staticPaths), sheenRows, mound: Object.entries(mound) };
};

const TREE = buildTree();
const SWORD = buildSword();

// ---------- Embers ----------
const EMBERS = (() => {
  const rand = mulberry32(2024);
  return Array.from({ length: 34 }, (_, i) => ({
    key: i,
    x: Math.round(rand() * 100),
    size: rand() < 0.3 ? 4 : 3,
    dur: 9 + rand() * 9,
    delay: -rand() * 18,
    sway: Math.round((rand() - 0.5) * 60),
  }));
})();

export const GraceBackdrop: React.FC<GraceBackdropProps> = ({ mood }) => (
  <div className="grace-backdrop" data-mood={mood} aria-hidden="true">
    <div className="grace-sky" />

    <svg
      className="erdtree"
      viewBox={`0 0 ${TREE_W} ${TREE_H}`}
      shapeRendering="crispEdges"
      preserveAspectRatio="xMidYMid meet"
    >
      {TREE.paths.map(([colour, d]) => (
        <path key={colour} d={d} fill={colour} />
      ))}
      {TREE.twinkles.map((t, i) => (
        <rect key={i} className="tw" x={t.x} y={t.y} width="1" height="1" fill="#fff6dc" style={{ animationDelay: `${t.delay}s` }} />
      ))}
    </svg>

    <div className="sword-wrap">
      <div className="sword-glow" />
      <svg
        className="sword"
        viewBox={`0 0 ${SWORD_VB_W} ${SWORD_VB_H}`}
        shapeRendering="crispEdges"
        preserveAspectRatio="xMidYMax meet"
      >
        {SWORD.staticPaths.map(([colour, d]) => (
          <path key={colour} d={d} fill={colour} />
        ))}
        {SWORD.sheenRows.map((r) => (
          <path key={r.y} className="sheen" d={r.d} fill="#ffffff" style={{ animationDelay: `${(r.y * 0.07).toFixed(2)}s` }} />
        ))}
        {SWORD.mound.map(([colour, d]) => (
          <path key={colour} d={d} fill={colour} />
        ))}
      </svg>
    </div>

    <div className="embers">
      {EMBERS.map((e) => (
        <span
          key={e.key}
          className="ember"
          style={
            {
              left: `${e.x}%`,
              width: e.size,
              height: e.size,
              '--d': e.dur,
              '--sway': `${e.sway}px`,
              animationDelay: `${e.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  </div>
);
