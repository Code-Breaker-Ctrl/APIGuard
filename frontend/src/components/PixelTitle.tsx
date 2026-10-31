import React from 'react';
import { GRID, HERO, INK, LIME, MINI } from './pixelTitleData';

/*
 * The APIGuard wordmark as an SVG. The letters, the moss, vines and flowers, and their sizes are built in
 * pixelTitleData.ts; this draws them: a lime drop shadow, black letters with a faint cell grid, and (in the
 * hero) the growth, whose vines sway one half-cell at a time (see .vine in index.css).
 */

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
      <g className="growth">
        {t.growth.map((g) => (
          <g key={g.group} className={g.group >= 0 ? `vine vine-${g.group}` : undefined}>
            {g.paths.map(([colour, d]) => (
              <path key={colour} d={d} fill={colour} />
            ))}
          </g>
        ))}
      </g>
    </svg>
  );
};
