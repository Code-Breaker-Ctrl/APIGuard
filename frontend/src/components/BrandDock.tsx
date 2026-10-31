import React, { useLayoutEffect, useRef } from 'react';
import { PixelTitle } from './PixelTitle';
import { TITLE_METRICS } from './pixelTitleData';

/*
 * The logo in the toolbar, and the way the big pixel title turns into it as the page scrolls.
 *
 * The logo is the hero wordmark, drawn inside the toolbar's first slot. At the top of the page it is
 * stretched and moved so that it sits exactly on the hero's own (hidden) wordmark. As the page scrolls
 * down to the point where the toolbar pins to the top, it shrinks and glides into its slot while the
 * scenery fades, the moss and flowers fall away and the toolbar's buttons slide over to make room.
 * Scrolling back up reverses all of it.
 *
 * Progress `p` is 0 at the top of the page and 1 once the toolbar is pinned. It is written to CSS
 * variables (index.css fades the scenery from it); nothing re-renders while scrolling, and the
 * geometry is measured only when the layout changes, never per scroll event.
 */

/** The logo's height in the toolbar, the same as the plain wordmark shown when the banner is collapsed. */
const LOGO_H = 30;
const LOGO_W = (LOGO_H * TITLE_METRICS.width) / TITLE_METRICS.miniHeight;
/** The hero wordmark has more empty rows above its letters; lifting it by that much puts the letters on the slot. */
const LIFT = ((TITLE_METRICS.heroPadTop - TITLE_METRICS.miniPadTop) * LOGO_W) / TITLE_METRICS.width;

/** How far through the scroll (0..1) the logo has shrunk and slid across to its place in the toolbar. */
const ARRIVES_ACROSS = 0.8;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const BrandDockBase: React.FC = () => {
  const slotRef = useRef<HTMLSpanElement>(null);
  const logoRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const slot = slotRef.current;
    const logo = logoRef.current;
    const toolbar = slot?.closest<HTMLElement>('.toolbar');
    const hero = document.querySelector<HTMLElement>('.hero');
    const title = hero?.querySelector<SVGElement>('.hero-title');
    if (!slot || !logo || !toolbar || !hero || !title) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let dockAt = 1; // how far the page scrolls before the toolbar pins to the top
    let flyX = 0; // from the logo's resting place to the hero wordmark, in the unscrolled page
    let flyY = 0;
    let heroW = LOGO_W; // the hero wordmark's width

    const measure = () => {
      const sx = window.scrollX;
      const sy = window.scrollY;
      const t = title.getBoundingClientRect();
      const h = hero.getBoundingClientRect();
      const tb = toolbar.getBoundingClientRect();
      const sl = slot.getBoundingClientRect();
      dockAt = Math.max(1, h.bottom + sy); // the toolbar sits right under the hero until it pins
      const restLeft = sl.left + sx;
      const restTop = dockAt + (sl.top - tb.top) - LIFT;
      flyX = t.left + sx - restLeft;
      flyY = t.top + sy - restTop;
      heroW = t.width;
    };

    const apply = () => {
      const p = clamp01(window.scrollY / dockAt);
      const pv = p.toFixed(4);
      hero.style.setProperty('--p', pv);
      logo.style.setProperty('--p', pv);
      if (reduced.matches) {
        // no travelling for people who asked for less motion: the logo just fades in where it belongs
        toolbar.style.setProperty('--dock', '1');
        logo.style.width = `${LOGO_W}px`;
        logo.style.transform = 'none';
        logo.style.opacity = clamp01((p - 0.55) / 0.45).toFixed(3);
        hero.style.removeProperty('--title-o');
      } else {
        // The logo reaches its final size and its place along the toolbar a little before the toolbar pins,
        // so on the last stretch it only settles downwards and never crosses the buttons beside it.
        const across = clamp01(p / ARRIVES_ACROSS);
        toolbar.style.setProperty('--dock', across.toFixed(4));
        logo.style.width = `${(Math.pow(heroW, 1 - across) * Math.pow(LOGO_W, across)).toFixed(2)}px`;
        logo.style.transform = `translate(${Math.round(flyX * (1 - across))}px, ${Math.round(flyY * (1 - p))}px)`;
        logo.style.opacity = '1';
        hero.style.setProperty('--title-o', '0');
      }
      const home = p > 0.995;
      logo.classList.toggle('is-docked', home);
      logo.style.pointerEvents = home ? 'auto' : 'none';
      logo.tabIndex = home ? 0 : -1;
    };

    const remeasure = () => {
      measure();
      apply();
    };

    toolbar.style.setProperty('--logo-w', `${LOGO_W}px`);
    remeasure();
    const ro = new ResizeObserver(remeasure);
    ro.observe(hero);
    ro.observe(toolbar);
    window.addEventListener('scroll', apply, { passive: true });
    reduced.addEventListener('change', apply);
    let gone = false;
    document.fonts?.ready.then(() => {
      if (!gone) remeasure();
    });

    return () => {
      gone = true;
      ro.disconnect();
      window.removeEventListener('scroll', apply);
      reduced.removeEventListener('change', apply);
      hero.style.removeProperty('--p');
      hero.style.removeProperty('--title-o');
      toolbar.style.removeProperty('--dock');
      toolbar.style.removeProperty('--logo-w');
    };
  }, []);

  const toTop = () => {
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
  };

  return (
    <span ref={slotRef} className="brand-slot" style={{ width: LOGO_W, height: LOGO_H }}>
      <button
        ref={logoRef}
        type="button"
        className="brand-dock"
        style={{ top: -LIFT, width: LOGO_W }}
        aria-label="APIGuard, back to the top"
        title="Back to the top"
        onClick={toTop}
      >
        <PixelTitle />
      </button>
    </span>
  );
};

/** Memoised so a re-render of the page never touches the styles written while scrolling. */
export const BrandDock = React.memo(BrandDockBase);
