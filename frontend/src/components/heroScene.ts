import meta from '../assets/hero/hero-meta.json';

/*
 * Where things sit in the hero art. Every coordinate is in pixels of the reference banner the art was
 * cut from (1600 x 533, see scripts/make_hero_art.py), so the banner can be drawn at any height: one
 * reference pixel is `height / 533` screen pixels.
 */

export const REF_W = meta.ref.w;
export const REF_H = meta.ref.h;
export const LEFT_X0 = meta.left.x0;
export const LEFT_W = meta.left.w;
export const RIGHT_X0 = meta.right.x0;
export const RIGHT_W = meta.right.w;
export const RING_CENTRE_X = meta.emblem.x + meta.emblem.w / 2;
export const ISLANDS = meta.islands as { id: string; scene: 'left' | 'right'; x: number; y: number; w: number; h: number }[];

export type Side = 'left' | 'right' | 'ring';

export interface Riser {
  side: Side;
  x: number;
  y: number;
  /** motes per second at rest */
  rate: number;
}

/** Spire tips, tower tops and island tips that let motes of light drift up. */
export const RISERS: Riser[] = [
  { side: 'left', x: 159, y: 104, rate: 0.7 },
  { side: 'left', x: 139, y: 144, rate: 0.5 },
  { side: 'left', x: 204, y: 182, rate: 0.5 },
  { side: 'left', x: 231, y: 192, rate: 0.4 },
  { side: 'left', x: 277, y: 250, rate: 0.35 },
  { side: 'left', x: 315, y: 274, rate: 0.35 },
  { side: 'left', x: 72, y: 168, rate: 0.3 },
  { side: 'left', x: 32, y: 224, rate: 0.25 },
  { side: 'left', x: 58, y: 262, rate: 0.25 },
  { side: 'right', x: 1425, y: 228, rate: 0.7 },
  { side: 'right', x: 1522, y: 232, rate: 0.6 },
  { side: 'right', x: 1406, y: 264, rate: 0.4 },
  { side: 'right', x: 1272, y: 325, rate: 0.4 },
  { side: 'right', x: 1188, y: 372, rate: 0.3 },
  { side: 'right', x: 1150, y: 354, rate: 0.3 },
  { side: 'right', x: 1572, y: 286, rate: 0.3 },
];

export interface Light {
  side: Side;
  x: number;
  y: number;
  /** windows glow steadily and now and then go dark; arch lights flicker like fire */
  kind: 'window' | 'arch';
}

/** Warm lights in the tower windows and the fortress arches (placed on stone in the art). */
export const LIGHTS: Light[] = [
  { side: 'left', x: 158, y: 126, kind: 'window' },
  { side: 'left', x: 134, y: 176, kind: 'window' },
  { side: 'left', x: 149, y: 182, kind: 'window' },
  { side: 'left', x: 140, y: 206, kind: 'window' },
  { side: 'left', x: 150, y: 226, kind: 'window' },
  { side: 'left', x: 198, y: 202, kind: 'window' },
  { side: 'left', x: 202, y: 228, kind: 'window' },
  { side: 'left', x: 228, y: 218, kind: 'window' },
  { side: 'left', x: 229, y: 238, kind: 'window' },
  { side: 'left', x: 274, y: 258, kind: 'window' },
  { side: 'right', x: 1423, y: 262, kind: 'window' },
  { side: 'right', x: 1423, y: 290, kind: 'window' },
  { side: 'right', x: 1522, y: 266, kind: 'window' },
  { side: 'right', x: 1522, y: 296, kind: 'window' },
  { side: 'right', x: 1401, y: 290, kind: 'window' },
  { side: 'right', x: 1397, y: 345, kind: 'arch' },
  { side: 'right', x: 1462, y: 340, kind: 'arch' },
  { side: 'right', x: 1476, y: 346, kind: 'arch' },
  { side: 'right', x: 1497, y: 350, kind: 'arch' },
  { side: 'right', x: 1518, y: 350, kind: 'arch' },
];

/** The golden tree: leaves drift down from the underside, sparkles twinkle through the crown. */
export const CANOPY = { x0: 1215, x1: 1590, y0: 70, y1: 165 };
export const CROWN = { x0: 1180, x1: 1600, y0: 6, y1: 150 };

/** The ring above the title twinkles. */
export const RING_BOX = { x0: 722, x1: 886, y0: 34, y1: 190 };

/** Birds that circle the ruins (the reference's three birds, redrawn so they can fly). */
export const BIRDS = [
  { x: 251, y: 175, rx: 30, ry: 8, speed: 0.55, phase: 0.0 },
  { x: 340, y: 174, rx: 24, ry: 7, speed: 0.42, phase: 2.1 },
  { x: 299, y: 195, rx: 34, ry: 9, speed: 0.5, phase: 4.2 },
];
