import rightScene from '../assets/hero/hero-right.webp';
import { BIRDS, CANOPY, CROWN, LIGHTS, REF_H, REF_W, RIGHT_X0, RING_BOX, RING_CENTRE_X, RISERS } from './heroScene';
import type { Side } from './heroScene';

/*
 * The living light over the hero scenery, drawn on a canvas above the art:
 *   - motes of light that drift up from the spires, towers and floating islands
 *   - golden leaves that fall from the tree, and sparkles that twinkle through its crown
 *   - warm lights flickering in the fortress arches
 *   - the birds from the reference, circling the ruins, and a small flock now and then crossing the sky
 * Motion is in screen pixels but the scene is laid out in reference pixels (see heroScene.ts), so it
 * follows the banner at any size. Nothing runs while the banner is off screen or the tab is hidden, and
 * nothing is drawn if the visitor asked for reduced motion.
 */

const GOLDS = ['#d99a1e', '#e8b93c', '#f0cc66', '#c78f18'];
const LIMES = ['#b3c91c', '#8fa81a'];
const SPARKS = ['#fff2b0', '#f6dc78', '#e8b93c'];
const INK = '#23261a';
const MAX_PARTICLES = 150;
const MIN_SCENE_WIDTH = 900; // below this the CSS hides the scenery, so there is nothing to light

type Kind = 'mote' | 'leaf' | 'spark';

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  size: number;
  colour: string;
  alpha: number;
  phase: number;
  sway: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// the birds' wing beats, as pixels around the body
const BIRD_FRAMES: [number, number][][] = [
  [[-3, -2], [-2, -1], [-1, 0], [0, 1], [1, 0], [2, -1], [3, -2]],
  [[-3, 0], [-2, 0], [-1, 0], [0, 1], [1, 0], [2, 0], [3, 0]],
  [[-3, 1], [-2, 0], [-1, -1], [0, -1], [1, -1], [2, 0], [3, 1]],
  [[-3, 0], [-2, 0], [-1, 0], [0, 1], [1, 0], [2, 0], [3, 0]],
];

const makeGlow = () => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 232, 140, 0.95)');
    grad.addColorStop(0.3, 'rgba(240, 196, 84, 0.45)');
    grad.addColorStop(1, 'rgba(232, 192, 96, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  return c;
};

/** Starts the lights on `canvas` (which must sit inside the hero). Returns a function that stops them. */
export function startHeroLights(canvas: HTMLCanvasElement, getBoost: () => number): () => void {
  const host = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  if (!host || !ctx) return () => {};
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};

  const glow = makeGlow();
  const particles: Particle[] = [];
  let W = 0;
  let H = 0;
  let u = 1; // screen pixels per reference pixel
  let cs = 2; // one "art pixel" of the scenery on screen
  let t = 0;
  let level = 1;
  let nextFlock = 5 + rand(0, 4);
  let flock: { x: number; y: number; speed: number; birds: [number, number][] } | null = null;

  // where the tree is, so sparkles and leaves start on its gold rather than in empty air
  let mask: Uint8ClampedArray | null = null;
  let maskW = 0;
  let maskH = 0;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = maskW = img.naturalWidth;
    c.height = maskH = img.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!g) return;
    g.drawImage(img, 0, 0);
    mask = g.getImageData(0, 0, maskW, maskH).data;
  };
  img.src = rightScene;

  const onTree = (box: { x0: number; x1: number; y0: number; y1: number }): [number, number] | null => {
    for (let i = 0; i < 16; i++) {
      const x = rand(box.x0, box.x1);
      const y = rand(box.y0, box.y1);
      if (!mask) return [x, y];
      const ix = Math.round(x - RIGHT_X0);
      const iy = Math.round(y);
      if (ix >= 0 && ix < maskW && iy >= 0 && iy < maskH && mask[(iy * maskW + ix) * 4 + 3] > 140) return [x, y];
    }
    return null;
  };

  const map = (side: Side, x: number, y: number): [number, number] => {
    if (side === 'left') return [x * u, y * u];
    if (side === 'right') return [W - (REF_W - x) * u, y * u];
    return [W / 2 + (x - RING_CENTRE_X) * u, y * u];
  };

  const spawnMote = (side: Side, x: number, y: number) => {
    const [px, py] = map(side, x + rand(-3, 3), y);
    particles.push({
      kind: 'mote',
      x: px,
      y: py,
      vx: rand(-2, 6) * u,
      vy: -rand(9, 22) * u,
      life: rand(3.2, 6.2),
      age: 0,
      size: Math.round(cs * (Math.random() < 0.22 ? 1.6 : 1)),
      colour: Math.random() < 0.18 ? pick(LIMES) : pick(GOLDS),
      alpha: rand(0.72, 1),
      phase: rand(0, 6.28),
      sway: rand(3, 8) * u,
    });
  };

  const spawnLeaf = () => {
    const at = onTree(CANOPY);
    if (!at) return;
    const [px, py] = map('right', at[0], at[1]);
    particles.push({
      kind: 'leaf',
      x: px,
      y: py,
      vx: -rand(1, 6) * u,
      vy: rand(7, 16) * u,
      life: rand(5, 9),
      age: 0,
      size: cs,
      colour: pick(GOLDS),
      alpha: rand(0.7, 1),
      phase: rand(0, 6.28),
      sway: rand(5, 11) * u,
    });
  };

  const spawnSpark = (where: 'crown' | 'ring') => {
    let at: [number, number] | null;
    let side: Side = 'right';
    if (where === 'crown') {
      at = onTree(CROWN);
    } else {
      side = 'ring';
      at = [rand(RING_BOX.x0, RING_BOX.x1), rand(RING_BOX.y0, RING_BOX.y1)];
    }
    if (!at) return;
    const [px, py] = map(side, at[0], at[1]);
    particles.push({
      kind: 'spark',
      x: px,
      y: py,
      vx: 0,
      vy: -rand(0, 3) * u,
      life: rand(0.9, 1.8),
      age: 0,
      size: cs,
      colour: pick(SPARKS),
      alpha: rand(0.8, 1),
      phase: 0,
      sway: 0,
    });
  };

  // how lit each window is (0..1): they glow most of the time and now and then go dark for a few seconds
  const lit = LIGHTS.map(() => 1);

  const step = (dt: number) => {
    t += dt;
    level += (getBoost() - level) * Math.min(1, dt * 1.5);
    LIGHTS.forEach((l, i) => {
      const on = l.kind === 'arch' || (t / (11 + (i % 5) * 3.1) + i * 0.37) % 1 < 0.8 ? 1 : 0;
      lit[i] += (on - lit[i]) * Math.min(1, dt * 2.5);
    });

    if (W >= MIN_SCENE_WIDTH && particles.length < MAX_PARTICLES) {
      for (const r of RISERS) if (Math.random() < r.rate * level * dt) spawnMote(r.side, r.x, r.y);
      if (Math.random() < 1.6 * level * dt) spawnLeaf();
      if (Math.random() < 2.6 * level * dt) spawnSpark('crown');
      if (Math.random() < 1.0 * level * dt) spawnSpark('ring');
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        particles.splice(i, 1);
        continue;
      }
      p.x += (p.vx + Math.sin(p.phase + p.age * 1.7) * p.sway) * dt;
      p.y += p.vy * dt;
    }

    if (!flock && W >= MIN_SCENE_WIDTH && t >= nextFlock) {
      flock = { x: -20, y: H * rand(0.12, 0.2), speed: W / rand(24, 32), birds: [[0, 0], [-16 * u, 7 * u], [-30 * u, -4 * u]] };
    }
    if (flock) {
      flock.x += flock.speed * dt;
      if (flock.x - 40 * u > W) {
        flock = null;
        nextFlock = t + rand(22, 40);
      }
    }
  };

  const drawBird = (x: number, y: number, frame: number) => {
    const b = Math.max(1, Math.round(cs * 0.75));
    for (const [dx, dy] of BIRD_FRAMES[frame % 4]) {
      ctx.fillRect(Math.round(x + dx * b), Math.round(y + dy * b), b, b);
    }
  };

  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    if (W < MIN_SCENE_WIDTH) return;

    // lit windows and flickering arches
    LIGHTS.forEach((l, i) => {
      const [x, y] = map(l.side, l.x, l.y);
      const f = l.kind === 'arch'
        ? clamp01(0.55 + 0.25 * Math.sin(t * 3.1 + i * 1.7) + 0.2 * Math.sin(t * 7.3 + i * 4.1))
        : 0.85 + 0.15 * Math.sin(t * 1.9 + i * 2.3);
      const a = clamp01(f * lit[i] * (0.75 + 0.25 * level));
      if (a < 0.02) return;
      const g = (l.kind === 'arch' ? 20 : 11) * u * (0.9 + 0.25 * f);
      ctx.globalAlpha = (l.kind === 'arch' ? 0.55 : 0.7) * a;
      ctx.drawImage(glow, x - g, y - g, g * 2, g * 2);
      ctx.globalAlpha = a;
      ctx.fillStyle = l.kind === 'arch' ? '#fff1b0' : '#ffe08a';
      ctx.fillRect(Math.round(x - cs / 2), Math.round(y - cs), cs, Math.round(cs * (l.kind === 'arch' ? 2 : 1.6)));
    });

    for (const p of particles) {
      const k = Math.sin(Math.PI * clamp01(p.age / p.life));
      const a = Math.pow(Math.max(k, 0), 0.65) * p.alpha;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      if (p.kind === 'spark') {
        const arm = Math.max(2, Math.round(p.size * 1.8));
        const th = Math.max(1, Math.round(p.size / 2));
        const g = p.size * 7;
        ctx.globalAlpha = a * 0.4;
        ctx.drawImage(glow, x - g / 2, y - g / 2, g, g);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.colour;
        ctx.fillRect(x - arm, y, arm * 2 + th, th);
        ctx.fillRect(x, y - arm, th, arm * 2 + th);
      } else {
        const g = p.size * (p.kind === 'mote' ? 11 : 6);
        ctx.globalAlpha = a * (p.kind === 'mote' ? 0.55 : 0.4);
        ctx.drawImage(glow, x - g / 2, y - g / 2, g, g);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.colour;
        ctx.fillRect(Math.round(x - p.size / 2), Math.round(y - p.size / 2), p.size, p.kind === 'leaf' ? Math.max(1, p.size - 1) : p.size);
      }
    }

    // the birds
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = INK;
    BIRDS.forEach((b, i) => {
      const ang = b.phase + t * b.speed;
      const [x, y] = map('left', b.x + Math.cos(ang) * b.rx, b.y + Math.sin(ang * 2) * b.ry);
      drawBird(x, y, Math.floor(t * 6 + i));
    });
    if (flock) {
      const f = flock;
      f.birds.forEach(([dx, dy], i) => drawBird(f.x + dx, f.y + dy + Math.sin(t * 1.3 + i) * 3 * u, Math.floor(t * 6 + i * 2)));
    }
    ctx.globalAlpha = 1;
  };

  const prewarm = () => {
    particles.length = 0;
    for (let i = 0; i < 80; i++) step(0.05);
  };

  const resize = () => {
    W = host.clientWidth;
    H = host.clientHeight;
    u = H / REF_H;
    cs = Math.max(2, Math.round(4 * u));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    prewarm();
    draw();
  };

  let raf = 0;
  let last = 0;
  let running = false;
  let inView = true;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt);
    draw();
  };
  const start = () => {
    if (running || !inView || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const io = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) start();
    else stop();
  });
  io.observe(host);
  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVisibility);
  resize();
  start();

  return () => {
    stop();
    ro.disconnect();
    io.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    img.onload = null;
  };
}
