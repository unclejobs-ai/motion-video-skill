// The source sheets, rendered from data.ts. Every sheet holds exactly one <mark class="w"> (the {w} in its text).
import React from 'react';
import { DATA, type Sheet } from './data.ts';
import type { SheetRef } from './timing.ts';
import { dictDef, letterOffset, textbookScatter } from './scene.ts';

const W = () => <mark className="w">{DATA.word}</mark>;
/** text with its {w} replaced by the marked word */
const T = ({ s }: { s: string }) => {
  const at = s.indexOf('{w}');
  return at < 0 ? <>{s}</> : <>{s.slice(0, at)}<W />{s.slice(at + 3)}</>;
};
const Glass = ({ c = '#3c6fd8' }: { c?: string }) => (
  <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke={c} strokeWidth="2.2" /><path d="M13 13l5 5" stroke={c} strokeWidth="2.2" strokeLinecap="round" /></svg>
);

function Doc({ s }: { s: Sheet }) {
  switch (s.kind) {
    case 'post': return (
      <article className="sheet s-doc post">
        <div className="meta">{s.meta}</div>
        <h4><T s={s.title} /></h4>
        {s.body.map((p, n) => <p key={n}><T s={p} /></p>)}
        <p className="tags">{s.tags}</p>
      </article>
    );
    case 'receipt': return (
      <article className="sheet receipt">
        <div className="c title">{s.title}</div>
        <div className="c">{s.sub}</div>
        <hr />
        {s.rows.map(([a, b], n) => <div key={n} className="row"><span><T s={a} /></span><span>{b}</span></div>)}
        <hr />
        <div className="row"><b>{s.total[0]}</b><b>{s.total[1]}</b></div>
      </article>
    );
    case 'qa': return (
      <article className="sheet s-doc qa">
        <div className="chips">{s.chips.map((c) => <span key={c}>{c}</span>)}</div>
        <div className="q"><T s={s.q} /></div>
        {s.body.map((p, n) => <p key={n}><T s={p} /></p>)}
      </article>
    );
    case 'news': return (
      <article className="sheet news">
        <h3><T s={s.headline} /></h3>
        {s.body.map((p, n) => <p key={n}><T s={p} /></p>)}
      </article>
    );
    case 'chat': return (
      <article className="sheet chat">
        {s.bubbles.map((b, n) => <div key={n} className={b.me ? 'b me' : 'b'}><T s={b.text} /></div>)}
      </article>
    );
    case 'subtitle': return (
      <article className="sheet subtitle">
        {s.lines.map((l, n) => <React.Fragment key={n}><div className="tc">{l.tc}</div><div className="ln"><T s={l.text} /></div></React.Fragment>)}
        <div className="wave" />
      </article>
    );
    case 'memo': return (
      <article className="sheet memo">
        <div className="top"><span>{s.top[0]}</span><span>{s.top[1]}</span></div>
        <h4>{s.title}</h4>
        {s.items.map((it, n) => <div key={n} className={it.done ? 'it done' : 'it'}><i /><T s={it.text} /></div>)}
      </article>
    );
    case 'search': return (
      <article className="sheet search">
        <div className="box"><Glass /><span><T s={s.query} /><span className="caret" /></span></div>
        {s.suggestions.map((o) => <div key={o} className="opt"><Glass c="#555" /><span>{DATA.word} <b>{o}</b></span></div>)}
      </article>
    );
    case 'diary': return (
      <article className="sheet diary">
        <div className="date">{s.date}</div>
        {s.lines.map((p, n) => <p key={n}><T s={p} /></p>)}
      </article>
    );
    case 'notice': return (
      <article className="sheet notice">
        <div className="clock">{s.clock}</div>
        <div className="day">{s.day}</div>
        {s.cards.map((c, n) => <div key={n} className={n ? 'card dim' : 'card'}><div className="hd"><span>{c.app}</span><span>{c.when}</span></div><b>{c.title}</b><p><T s={c.text} /></p></div>)}
      </article>
    );
  }
}

/** Static markup; `f` drives only the beat-local motion inside the textbook and dictionary. */
export const SheetBody: React.FC<{ k: SheetRef; f: number; dictPx: number; slot: { x: number; y: number } }> = ({ k, f, dictPx, slot }) => {
  if (typeof k === 'number') return <Doc s={DATA.sheets[k]} />;
  if (k === 'textbook') {
    const { p, q } = textbookScatter(f), tb = DATA.textbook;
    let n = 0;
    const letters = (s: string) => [...s].map((ch) => {
      const o = letterOffset(n++, p);
      return <span key={n} className="ch" style={{ transform: `translate(${o.x}px,${o.y}px)`, opacity: o.o }}>{ch}</span>;
    });
    return (
      <article className="sheet textbook" style={{ background: q > 0 ? `color-mix(in srgb, ${DATA.bg.textbook} ${100 - q * 100}%, ${DATA.bg.dict})` : undefined }}>
        <h5 style={{ opacity: 1 - q }}>{tb.chapter}</h5>
        {tb.before.map((s, i) => <p key={`b${i}`} style={{ opacity: 1 - q }}>{s}</p>)}
        <p>{letters(tb.line[0])}<W />{letters(tb.line[1])}</p>
        {tb.after.map((s, i) => <p key={`a${i}`} style={{ opacity: 1 - q }}>{s}</p>)}
      </article>
    );
  }
  return (
    <article className="sheet dict">
      <div className="head" style={{ fontSize: dictPx, left: slot.x, top: slot.y, transform: 'translate(-50%,-50%)' }}><W /></div>
      <div className="defs" style={{ top: slot.y + dictPx * 0.85, fontSize: dictPx * 0.57 }}>
        {DATA.dict.map((d, n) => { const s = dictDef(f, n); return <div key={n} className="def" style={{ opacity: s.o, transform: `translate(${s.x}px,${s.y}px)` }}>{'tag' in d && d.tag ? <small>{d.tag}</small> : null}{d.text}</div>; })}
      </div>
    </article>
  );
};

/** every page the film can show, in measuring order */
export const SHEET_REFS: SheetRef[] = [...DATA.sheets.map((_, i) => i), 'textbook', 'dict'];
