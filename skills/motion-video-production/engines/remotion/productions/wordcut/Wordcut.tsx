// Thin Remotion host for the one-word cut. scene.ts decides every timed value; this file lays the sheets out once,
// measures where each sheet's own word sits (static layout, no transforms), and from then on places every sheet so
// that word lies exactly under the slot. The sharp slot word is that same sheet drawn a second time at rest (no whip
// offset, no blur) with everything but its word hidden, so it is the document's own word, pixel for pixel; the
// highlighter behind it is a whole-px box placed by transform. `aspect` picks the 9:16 or 16:9 framing. For the pixel
// drift check (drift.mjs) `diag` drops the lens layers and paints one thing magenta: 'sheet' the moving sheet's word
// (slot hidden), 'slot' the slot word, 'slotbox' the highlighter box.
import React, { useEffect, useRef, useState } from 'react';
import { AbsoluteFill, Img, continueRender, delayRender, random, staticFile, useCurrentFrame } from 'remotion';
import { DATA, type Aspect } from './data.ts';
import { SHEET_REFS, SheetBody } from './Sheets.tsx';
import { CSS } from './sheets.css.ts';
import { fontsReady } from './fonts.ts';
import { LOOK, type Look } from './look.ts';
import { VIEW, cam, closingOpacity, dictHeadPx, slotOf, textbookScatter } from './scene.ts';
import { WORDCUT as T, kindOf, type SheetRef } from './timing.ts';

export type WordcutProps = { aspect: Aspect; diag?: false | 'sheet' | 'slot' | 'slotbox'; look?: Partial<Look> };
type Anchor = { x: number; y: number; w: number; h: number; size: number };
const DIAG_CSS = '.wc.diag .sheet mark.w{background:none!important;color:#ff00ff!important;text-shadow:none!important}';
const key = (k: SheetRef) => String(k);

/** The highlighter box behind the slot word: a whole number of its own px wide and tall, placed by transform only,
 *  so layout snapping cannot move its centre off the slot. */
const Highlight: React.FC<{ a: Anchor; at: { x: number; y: number }; scale: number; style: React.CSSProperties }> = ({ a, at, scale, style }) => {
  const w = Math.ceil(a.w + 0.08 * a.size), h = Math.ceil(a.h);
  return <span className="slot" style={{ left: 0, top: 0, width: w, height: h, padding: 0, transform: `translate(${at.x - w / 2}px,${at.y - h / 2}px) scale(${scale})`, transformOrigin: `${w / 2}px ${h / 2}px`, ...style }} />;
};

export const Wordcut: React.FC<WordcutProps> = ({ aspect, diag = false, look }) => {
  const L = { ...LOOK, ...look };
  const f = useCurrentFrame();
  const V = VIEW[aspect], S = slotOf(aspect), kOut = V.out[0] / V.w;
  const dictPx = dictHeadPx(aspect);
  const [handle] = useState(() => delayRender('wordcut: measure sheets'));
  const [anchors, setAnchors] = useState<Record<string, Anchor> | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // where each sheet's word centre is, in sheet px
  useEffect(() => {
    let live = true;
    fontsReady.then(() => {
      if (!live || !root.current) return;
      const out: Record<string, Anchor> = {};
      for (const k of SHEET_REFS) {
        const el = root.current.querySelector<HTMLElement>(`[data-k="${key(k)}"]`);
        const m = el?.querySelector<HTMLElement>('mark.w');
        if (!el || !m) throw new Error(`wordcut: sheet ${key(k)} has no marked word`);
        const a = el.getBoundingClientRect(), b = m.getBoundingClientRect();
        out[key(k)] = { x: (b.left - a.left + b.width / 2) / kOut, y: (b.top - a.top + b.height / 2) / kOut, w: b.width / kOut, h: b.height / kOut, size: parseFloat(getComputedStyle(m).fontSize) };
      }
      setAnchors(out);
      continueRender(handle);
    });
    return () => { live = false; };
  }, []);

  const measuring = !anchors;
  const c = cam(f, aspect);
  const cur = T.cuts[c.i].k, kind = kindOf(cur);
  const keys: SheetRef[] = measuring ? SHEET_REFS : [cur];
  const tbq = kind === 'textbook' ? textbookScatter(f).q : 0;
  const bg = kind === 'textbook' && tbq > 0 ? `color-mix(in srgb, ${DATA.bg.textbook} ${100 - tbq * 100}%, ${DATA.bg.dict})` : DATA.bg[kind];
  const a = anchors?.[key(cur)];
  const blurOn = !diag && (c.bx > 0.2 || c.by > 0.2);
  const body = <SheetBody k={cur} f={f} dictPx={dictPx} slot={S} />;
  const word = a && (
    <div className="word-only" style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${S.x - a.x}px,${S.y - a.y}px) scale(${c.scale})`, transformOrigin: `${a.x}px ${a.y}px` }}>{body}</div>
  );

  return (
    <AbsoluteFill style={{ background: DATA.bg.dict, overflow: 'hidden' }}>
      <style>{CSS + DIAG_CSS}</style>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <filter id="wc-whip" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={`${c.bx.toFixed(2)} ${c.by.toFixed(2)}`} /></filter>
        <filter id="wc-grade" colorInterpolationFilters="sRGB">
          <feComponentTransfer>{(['R', 'G', 'B'] as const).map((ch) => React.createElement(`feFunc${ch}`, { key: ch, type: 'gamma', exponent: L.gamma }))}</feComponentTransfer>
          <feComponentTransfer><feFuncB type="table" tableValues={`${L.shadowTint} 1`} /></feComponentTransfer>
        </filter>
        <filter id="wc-rgb" colorInterpolationFilters="sRGB">
          {(['1 0 0 0 0', '0 1 0 0 0', '0 0 1 0 0'] as const).map((row, n) => (
            <React.Fragment key={n}>
              <feColorMatrix in="SourceGraphic" type="matrix" values={[0, 1, 2].map((m) => (m === n ? row : '0 0 0 0 0')).join(' ') + ' 0 0 0 1 0'} result={`c${n}`} />
              <feOffset in={`c${n}`} dx={((1 - n) * -c.split).toFixed(2)} result={`o${n}`} />
            </React.Fragment>
          ))}
          <feBlend in="o0" in2="o1" mode="screen" result="rg" /><feBlend in="rg" in2="o2" mode="screen" />
        </filter>
        <filter id="wc-grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={1} seed={Math.floor(random(`grain-${f}`) * 1000)} /><feColorMatrix type="saturate" values="0" /></filter>
      </svg>
      <div ref={root} className={`wc${diag === 'sheet' ? ' diag' : diag === 'slot' ? ' diag-slot' : ''}`} style={{ position: 'absolute', left: 0, top: 0, width: V.w, height: V.h, transform: `scale(${kOut})`, transformOrigin: '0 0', overflow: 'hidden', filter: diag ? undefined : `${c.split > 0 ? 'url(#wc-rgb) ' : ''}${L.gamma !== 1 || L.shadowTint ? 'url(#wc-grade) ' : ''}contrast(${L.contrast}) saturate(${L.saturate}) brightness(${L.brightness})`, ['--vw' as string]: `${V.w / 100}px`, ['--vh' as string]: `${V.h / 100}px` }}>
        <div style={{ position: 'absolute', inset: 0, background: bg }} />
        {keys.map((k) => {
          const on = !measuring && k === cur, an = anchors?.[key(k)];
          const place = on && an
            ? { transform: `translate(${S.x - an.x + c.dx}px,${S.y - an.y + c.dy}px) scale(${c.scale})`, transformOrigin: `${an.x}px ${an.y}px`, filter: blurOn ? 'url(#wc-whip)' : undefined }
            : { visibility: 'hidden' as const };
          return <div key={key(k)} data-k={key(k)} style={{ position: 'absolute', left: 0, top: 0, ...place }}><SheetBody k={k} f={f} dictPx={dictPx} slot={S} /></div>;
        })}
        {DATA.closing && closingOpacity(f, true) > 0 && (
          <Img src={staticFile(DATA.closing)} style={{ position: 'absolute', inset: 0, width: V.w, height: V.h, objectFit: 'cover', opacity: closingOpacity(f, true) }} />
        )}
        {diag === 'slotbox' && a && <Highlight a={a} at={S} scale={c.scale} style={{ background: '#ff00ff' }} />}
        {diag === 'slot' && word}
        {!diag && !measuring && (
          <>
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {[0, 1].map((n) => (
                <i key={n} style={{ position: 'absolute', left: 0, right: 0, height: '34%', [n ? 'bottom' : 'top']: 0, backdropFilter: `blur(${(L.dof + Math.max(c.bx, c.by) * 0.6).toFixed(2)}px)`, WebkitMaskImage: n ? 'linear-gradient(transparent,#000 65%)' : 'linear-gradient(#000 35%,transparent)' }} />
              ))}
              {c.band > 0.05 && a && (() => {
                // the opener's focus band: the word's line and its neighbours stay readable, the blur is full from two
                // line pitches out and doubles from four (pitch ≈ 1.45 × the word's box height)
                const pitch = 1.45 * a.h * c.scale;
                const ring = (sharp: number, full: number, blur: number) => (
                  <i key={sharp} style={{ position: 'absolute', inset: 0, backdropFilter: `blur(${blur.toFixed(2)}px)`, WebkitMaskImage: `linear-gradient(#000 ${S.y - full}px,transparent ${S.y - sharp}px,transparent ${S.y + sharp}px,#000 ${S.y + full}px)` }} />
                );
                return [ring(0.5 * pitch, 2 * pitch, c.band), ring(2.5 * pitch, 4 * pitch, 2 * c.band)];
              })()}
            </div>
            {a && <Highlight a={a} at={S} scale={c.scale} style={{ background: `linear-gradient(90deg,var(--hl) ${c.hl * 100}%,transparent ${c.hl * 100}%) 0 50%/100% 76% no-repeat` }} />}
            {word}
            <div style={{ position: 'absolute', inset: '-20%', pointerEvents: 'none', mixBlendMode: 'soft-light', opacity: L.light, background: 'repeating-linear-gradient(115deg,rgba(255,250,235,0) 0 9%,rgba(255,250,235,.55) 13% 17%,rgba(255,250,235,0) 22% 30%)' }} />
            {L.shade > 0 && <div style={{ position: 'absolute', inset: '-20%', pointerEvents: 'none', mixBlendMode: 'multiply', opacity: L.shade, background: 'repeating-linear-gradient(115deg,rgba(60,48,34,0) 0 2%,rgba(60,48,34,.5) 6% 9%,rgba(60,48,34,0) 13% 30%)' }} />}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(120% 90% at 50% 45%,transparent 55%,rgba(44,28,10,${L.vignette}))` }} />
            <svg width={V.w} height={V.h} style={{ position: 'absolute', inset: 0, opacity: L.grain, mixBlendMode: 'multiply', pointerEvents: 'none' }}><rect width="100%" height="100%" filter="url(#wc-grain)" /></svg>
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};
