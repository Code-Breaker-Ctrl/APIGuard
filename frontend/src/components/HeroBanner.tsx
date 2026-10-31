import React, { useEffect, useRef } from 'react';
import { PixelTitle } from './PixelTitle';
import { startHeroLights } from './heroLights';
import { ISLANDS, LEFT_W, LEFT_X0, REF_H, RIGHT_W, RIGHT_X0 } from './heroScene';
import leftScene from '../assets/hero/hero-left.webp';
import rightScene from '../assets/hero/hero-right.webp';
import emblem from '../assets/hero/emblem.webp';
import water from '../assets/hero/hero-water.webp';
import fog from '../assets/hero/hero-fog.webp';
import islandA from '../assets/hero/island-a.webp';
import islandB from '../assets/hero/island-b.webp';
import islandC from '../assets/hero/island-c.webp';
import islandD from '../assets/hero/island-d.webp';

/* A 5x5 pixel diamond, used as a separator between the subtitle words. */
const Diamond: React.FC = () => (
  <svg width="10" height="10" viewBox="0 0 5 5" shapeRendering="crispEdges" aria-hidden="true">
    <path d="M2 0h1v1H2zM1 1h3v1H1zM0 2h5v1H0zM1 3h3v1H1zM2 4h1v1H2z" fill="#e8c060" />
  </svg>
);

const Ornament: React.FC = () => (
  <span className="orn" aria-hidden="true">
    <i />
    <Diamond />
    <i />
  </span>
);

const ISLAND_ART: Record<string, string> = {
  'island-a': islandA,
  'island-b': islandB,
  'island-c': islandC,
  'island-d': islandD,
};
// each island floats on its own rhythm
const BOB: Record<string, { s: number; d: number }> = {
  'island-a': { s: 7.2, d: -1 },
  'island-b': { s: 8.6, d: -4 },
  'island-c': { s: 6.4, d: -2.5 },
  'island-d': { s: 9, d: -5 },
};

const pct = (n: number, of: number) => `${(n / of) * 100}%`;

const Island: React.FC<{ id: string; x: number; y: number; w: number; h: number; x0: number; sceneW: number }> = ({ id, x, y, w, h, x0, sceneW }) => (
  <span
    className="hero-island"
    style={{
      left: pct(x - x0, sceneW),
      top: pct(y, REF_H),
      width: pct(w, sceneW),
      height: pct(h, REF_H),
      ['--bob' as string]: `${BOB[id].s}s`,
      ['--delay' as string]: `${BOB[id].d}s`,
    }}
  >
    <img src={ISLAND_ART[id]} alt="" draggable={false} />
  </span>
);

/** Light over the scenery: drifting motes, falling leaves, flickering arches and birds (see heroLights.ts). */
const HeroLights: React.FC<{ active: boolean }> = ({ active }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const boost = useRef(1);
  useEffect(() => {
    boost.current = active ? 2.4 : 1;
  }, [active]);
  useEffect(() => (canvas.current ? startHeroLights(canvas.current, () => boost.current) : undefined), []);
  return <canvas ref={canvas} className="hero-lights" aria-hidden="true" />;
};

interface HeroBannerProps {
  /** True while an audit is running: the light brightens and the ring quickens. */
  active?: boolean;
}

/**
 * The page's masthead. Scenery cut from fine pixel art (ruins and a resting knight on the left, a golden tree
 * over a fortress on the right), with a thin golden ring and the wordmark over the middle. It is alive: mist
 * drifts, the floating islands bob, light rises from the spires, leaves fall from the tree and birds circle
 * the ruins. The scenery never sits behind anything you need to read.
 *
 * Scrolling down dissolves the scenery and the wordmark flies into the toolbar as its logo (BrandDock.tsx drives
 * that through the --p variable on this element: 0 at the top of the page, 1 once the toolbar is pinned).
 */
export const HeroBanner: React.FC<HeroBannerProps> = ({ active = false }) => (
  <section className={`hero${active ? ' hero--active' : ''}`} aria-label="APIGuard">
    <div className="hero-layers" aria-hidden="true">
      <div className="hero-water">
        <i style={{ backgroundImage: `url(${water})` }} />
      </div>
      <div className="hero-fog hero-fog--far">
        <i style={{ backgroundImage: `url(${fog})` }} />
      </div>

      <div className="hero-scene hero-scene--left">
        <img className="hero-art" src={leftScene} alt="" draggable={false} />
        {ISLANDS.filter((i) => i.scene === 'left').map((i) => (
          <Island key={i.id} {...i} x0={LEFT_X0} sceneW={LEFT_W} />
        ))}
      </div>
      <div className="hero-scene hero-scene--right">
        <img className="hero-art" src={rightScene} alt="" draggable={false} />
        {ISLANDS.filter((i) => i.scene === 'right').map((i) => (
          <Island key={i.id} {...i} x0={RIGHT_X0} sceneW={RIGHT_W} />
        ))}
      </div>

      <div className="hero-fog hero-fog--near">
        <i style={{ backgroundImage: `url(${fog})` }} />
      </div>
      <HeroLights active={active} />

      <div className="hero-ring">
        <img src={emblem} alt="" draggable={false} />
      </div>
    </div>

    <div className="hero-stack">
      <h1 className="sr-only">APIGuard</h1>
      <PixelTitle className="hero-title" />
      <div className="hero-sub">
        <Ornament />
        <span>API</span>
        <Diamond />
        <span>AUTHORIZATION</span>
        <Diamond />
        <span>AUDIT</span>
        <Ornament />
      </div>
      <div className="hero-tag">OPENAPI · RESOURCE GRAPH · DIFFERENTIAL TESTING · REMEDIATION</div>
    </div>
  </section>
);

/** The plain wordmark shown in the toolbar when the banner is collapsed. */
export const MiniBrand: React.FC = () => (
  <h1 className="flex items-center">
    <span className="sr-only">APIGuard</span>
    <PixelTitle variant="mini" style={{ height: 30, width: 'auto' }} />
  </h1>
);
