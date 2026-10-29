// Hand-drawn layer for the README diagrams, after the Uncle Jobs sketch rules:
// rough.js 4.6.6, roughness 1.3, bowing 1.2, hachure gap 11, fill weight 2, fixed seeds,
// one accent shape per diagram, text stays in Pretendard (HTML), only the lines wobble.
// Layout is plain HTML/CSS; this draws boxes, arrows and curves around the laid-out elements.
(function () {
  const LANG = new URLSearchParams(location.search).get('lang') || 'en';
  document.documentElement.lang = LANG;

  function strings(T) {
    const t = T[LANG] || T.en;
    document.querySelectorAll('[data-t]').forEach((el) => {
      const v = t[el.dataset.t] ?? T.en[el.dataset.t];
      if (v == null) throw new Error(`missing string ${el.dataset.t}`);
      el.innerHTML = v;
    });
  }

  function layer(draw) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'uj-sketch');
    svg.setAttribute('aria-hidden', 'true');
    document.body.appendChild(svg);
    const rc = rough.svg(svg);
    const cs = getComputedStyle(document.body);
    const c = (n) => cs.getPropertyValue('--' + n).trim() || n;
    let seed = 11;
    const opts = (o = {}) => {
      const x = { roughness: 1.3, bowing: 1.2, strokeWidth: 3, stroke: c('fg'), seed: seed++,
        hachureGap: 11, fillWeight: 2, fillStyle: 'hachure' };
      if (o.accent) x.stroke = c('accent');
      if (o.stroke) x.stroke = c(o.stroke);
      if (o.fill) x.fill = c(o.fill);
      if (o.dash) x.strokeLineDash = [14, 12];
      if (o.width) x.strokeWidth = o.width;
      if (o.rough != null) x.roughness = o.rough;
      if (o.gap) x.hachureGap = o.gap;
      return x;
    };
    const add = (n) => svg.appendChild(n);
    const body = document.body.getBoundingClientRect();
    const rect = (sel) => {
      const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
      if (!el) throw new Error(`no element ${sel}`);
      const r = el.getBoundingClientRect();
      return { x: r.left - body.left, y: r.top - body.top, w: r.width, h: r.height,
        cx: r.left - body.left + r.width / 2, cy: r.top - body.top + r.height / 2 };
    };
    const head = (x, y, ang, op, size = 20) => {
      const o = { ...op, strokeLineDash: undefined };
      for (const s of [-0.45, 0.45]) add(rc.line(x, y, x - size * Math.cos(ang + s), y - size * Math.sin(ang + s), o));
    };
    const api = {
      rect, c,
      box(sel, o = {}) {
        const r = rect(sel), p = o.pad ?? 0;
        add(rc.rectangle(r.x - p, r.y - p, r.w + 2 * p, r.h + 2 * p, opts(o)));
      },
      rectAt(x, y, w, h, o = {}) { add(rc.rectangle(x, y, w, h, opts(o))); },
      ellipse(cx, cy, w, h, o = {}) { add(rc.ellipse(cx, cy, w, h, opts(o))); },
      line(x1, y1, x2, y2, o = {}) { add(rc.line(x1, y1, x2, y2, opts(o))); },
      arrow(x1, y1, x2, y2, o = {}) {
        const op = opts(o);
        add(rc.line(x1, y1, x2, y2, op));
        head(x2, y2, Math.atan2(y2 - y1, x2 - x1), op, o.head);
      },
      curve(pts, o = {}) {
        const op = opts(o);
        add(rc.curve(pts, op));
        if (o.arrow) {
          const [a, b] = pts.slice(-2);
          head(b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0]), op, o.head);
        }
      },
      // arrow between two elements, edge to edge: 'h' (left to right) or 'v' (top to bottom)
      link(a, b, o = {}) {
        const A = rect(a), B = rect(b), g = o.gap ?? 14;
        if ((o.dir ?? 'h') === 'h') {
          const ltr = B.x >= A.x;
          const y = o.y ?? (A.cy + B.cy) / 2;
          api.arrow(ltr ? A.x + A.w + g : A.x - g, y, ltr ? B.x - g : B.x + B.w + g, y, o);
        } else {
          const ttb = B.y >= A.y;
          const x = o.x ?? (A.cx + B.cx) / 2;
          api.arrow(x, ttb ? A.y + A.h + g : A.y - g, x, ttb ? B.y - g : B.y + B.h + g, o);
        }
      },
      underline(sel, o = {}) {
        const r = rect(sel);
        add(rc.line(r.x, r.y + r.h + (o.dy ?? 4), r.x + r.w, r.y + r.h + (o.dy ?? 4), opts(o)));
      },
    };
    draw(api);
  }

  // Fill strings, wait for fonts and images, draw, then mark the page done for the renderer.
  window.UJ = {
    LANG,
    ready(T, draw) {
      strings(T);
      const imgs = [...document.images].map((i) => i.decode().catch(() => { throw new Error(`image ${i.src}`); }));
      Promise.all([document.fonts.ready, ...imgs]).then(() => {
        layer(draw);
        const h = +document.querySelector('meta[name=size]').content.split('x')[1];
        const over = document.body.scrollHeight > h;
        document.title = over ? `OVERFLOW ${document.body.scrollHeight}` : 'done';
        if (over) document.body.style.outline = '12px solid red';
      });
    },
  };
})();
