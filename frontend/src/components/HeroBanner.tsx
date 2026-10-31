import React from 'react';
import { PixelTitle } from './PixelTitle';
import leftScene from '../assets/hero/hero-left.png';
import rightScene from '../assets/hero/hero-right.png';
import emblem from '../assets/hero/emblem.png';

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

/**
 * The page's masthead: the wordmark with a lime shadow, a thin golden ring above it, and pixel scenery
 * (ruins and a resting knight on the left, a golden tree over a fortress on the right) at the edges.
 * The scenery never sits behind anything you need to read.
 */
export const HeroBanner: React.FC = () => (
  <section className="hero" aria-label="APIGuard">
    <div className="hero-scene hero-scene--left" aria-hidden="true">
      <img src={leftScene} alt="" draggable={false} />
    </div>
    <div className="hero-scene hero-scene--right" aria-hidden="true">
      <img src={rightScene} alt="" draggable={false} />
    </div>
    <img className="hero-emblem" src={emblem} alt="" draggable={false} />
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
