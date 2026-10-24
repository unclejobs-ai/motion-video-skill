// Sheet styles for the one-word cut, written for the design viewport (--vw = 1 % of its width, --vh = 1 % of its
// height). Fonts: Pretendard (src/fonts.ts), Nanum Myeongjo and JetBrains Mono (./fonts.ts), all SIL OFL 1.1 npm packages.
export const CSS = `
.wc{--paper:#F6F3EC;--ink:#1A1916;--ink-2:#56534B;--ink-3:#8C887D;--line:#DDD7CA;--night:#121314;--night-ink:#E9E7E1;
  --hl:rgba(222,232,92,.72);--cta:#1E1D1A;
  --sans:Pretendard,sans-serif;--serif:'Nanum Myeongjo',Pretendard,serif;--mono:'JetBrains Mono',Pretendard,monospace;
  font-family:var(--sans);color:var(--ink);-webkit-font-smoothing:antialiased;word-break:keep-all;overflow-wrap:break-word}
.wc *{box-sizing:border-box}
.wc .sheet{position:absolute;left:0;top:0}
.wc .sheet mark.w{background:none;color:inherit;font:inherit;padding:0 .08em}
/* the slot word is the sheet itself drawn a second time at rest with everything but its word hidden */
.wc .word-only .sheet{visibility:hidden}.wc .word-only mark.w{visibility:visible;background:none!important}
.wc.diag-slot .word-only mark.w{color:#ff00ff!important;text-shadow:none!important}.wc.diag-slot .sheet mark.w{background:none!important}
.wc .slot{position:absolute;white-space:nowrap;padding:0 .12em;border-radius:2px;line-height:normal}
.wc .s-doc{width:min(calc(118 * var(--vw)),640px);padding:28px 26px;background:#fff;color:var(--ink)}
.wc .s-doc p{margin:0 0 12px;font-size:16px;line-height:1.75}
.wc .post{background:var(--night);color:var(--night-ink);text-shadow:0 0 6px rgba(233,231,225,.35)}
.wc .post .meta{font-size:12px;color:#8d8b85;margin-bottom:14px}
.wc .post h4{margin:0 0 14px;font-size:21px;font-weight:700}
.wc .post .tags{font-size:13px;color:#7fb0ff}
.wc .receipt{width:min(calc(92 * var(--vw)),420px);background:#fbfaf6;font-family:var(--mono);font-size:14px;line-height:1.9;padding:26px 22px;box-shadow:0 0 0 1px #e6e1d5}
.wc .receipt .c{text-align:center}.wc .receipt .row{display:flex;justify-content:space-between;gap:12px}
.wc .receipt hr{border:0;border-top:1px dashed #b9b3a5;margin:8px 0}
.wc .receipt .title{font-family:var(--sans);font-size:22px;font-weight:800;letter-spacing:.3em}
.wc .qa .q{font-size:20px;font-weight:700;line-height:1.5;margin-bottom:12px}
.wc .qa .chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.wc .qa .chips span{font-size:12px;color:#3c6fd8;background:#eef3ff;border-radius:999px;padding:4px 10px}
.wc .news{width:min(calc(130 * var(--vw)),760px);background:#f3efe4;font-family:var(--serif);columns:2;column-gap:28px;padding:30px}
.wc .news h3{column-span:all;margin:0 0 16px;font-size:24px;line-height:1.35;font-weight:700}
.wc .news p{font-size:15px;line-height:1.8;text-align:justify;margin:0 0 12px}
.wc .chat{width:min(calc(100 * var(--vw)),520px);background:#e9ecef;padding:24px 16px}
.wc .chat .b{max-width:78%;margin:0 0 10px;padding:10px 14px;border-radius:16px;font-size:16px;line-height:1.55;background:#fff}
.wc .chat .b.me{margin-left:auto;background:#d8dde3}
.wc .subtitle{width:min(calc(118 * var(--vw)),700px);background:#1b1d20;color:#e8e8e6;padding:22px}
.wc .subtitle .tc{font-family:var(--mono);font-size:12px;color:#8e949b;margin-top:14px}
.wc .subtitle .ln{font-size:19px;font-weight:700;line-height:1.6}
.wc .subtitle .wave{height:56px;margin-top:16px;background:repeating-linear-gradient(90deg,#4fd1c5 0 2px,transparent 2px 5px);-webkit-mask:linear-gradient(transparent,#000 30%,#000 70%,transparent);opacity:.65}
.wc .memo{width:min(calc(110 * var(--vw)),560px);background:#fffdf7;padding:24px 26px}
.wc .memo .top{display:flex;justify-content:space-between;font-size:13px;color:#c78a00;font-weight:600;margin-bottom:16px}
.wc .memo h4{margin:0 0 16px;font-size:22px;font-weight:800}
.wc .memo .it{display:flex;gap:12px;align-items:center;font-size:17px;line-height:1.6;padding:9px 0;border-bottom:1px solid #eee6d3}
.wc .memo .it i{flex:none;width:18px;height:18px;border-radius:9px;border:1.5px solid #c78a00}
.wc .memo .it.done{color:#a9a395;text-decoration:line-through}.wc .memo .it.done i{background:#c78a00}
.wc .search{width:min(calc(110 * var(--vw)),560px);background:#fff;padding:26px 20px}
.wc .search .box{display:flex;align-items:center;gap:12px;border:2px solid #3c6fd8;border-radius:999px;padding:10px 18px;font-size:20px;font-weight:600}
.wc .search .box svg{flex:none;width:20px;height:20px}
.wc .search .caret{display:inline-block;width:2px;height:1.1em;background:#3c6fd8;vertical-align:-.15em;margin-left:2px}
.wc .search .opt{display:flex;gap:14px;align-items:center;padding:12px 18px;font-size:16px;color:#3b3a36}
.wc .search .opt svg{flex:none;width:15px;height:15px;opacity:.45}
.wc .search .opt b{font-weight:700}
.wc .diary{width:min(calc(112 * var(--vw)),600px);padding:26px 30px 30px;font-family:var(--serif);color:#2c2a25;
  background:#fbf8f1 repeating-linear-gradient(transparent 0 33px,#d9d2c1 33px 34px);background-position:0 18px}
.wc .diary .date{font-family:var(--sans);font-size:13px;color:#9a9384;margin-bottom:8px;line-height:34px}
.wc .diary p{margin:0;font-size:18px;line-height:34px}
.wc .notice{width:min(calc(100 * var(--vw)),460px);padding:28px 18px;color:#fff;background:#22262c}
.wc .notice .clock{text-align:center;font-size:64px;font-weight:300;letter-spacing:-.02em;line-height:1}
.wc .notice .day{text-align:center;font-size:15px;opacity:.8;margin:8px 0 26px}
.wc .notice .card{background:rgba(245,245,247,.92);color:#1d1d1f;border-radius:20px;padding:14px 16px}
.wc .notice .card .hd{display:flex;justify-content:space-between;font-size:12px;color:#6e6e73;margin-bottom:4px}
.wc .notice .card b{display:block;font-size:15px;margin-bottom:2px}
.wc .notice .card p{margin:0;font-size:15px;line-height:1.45}
.wc .notice .card.dim{opacity:.7;margin-top:8px}
.wc .textbook{width:min(calc(150 * var(--vw)),680px);background:#faf7ef;font-family:var(--serif);padding:34px 30px}
.wc .textbook h5{font-family:var(--sans);font-size:13px;color:var(--ink-3);margin:0 0 10px;letter-spacing:.06em;font-weight:600}
.wc .textbook p{font-size:17px;line-height:1.95;margin:0 0 14px}
.wc .textbook .ch{display:inline-block;white-space:pre}
.wc .dict{width:calc(100 * var(--vw));height:calc(100 * var(--vh));font-family:var(--serif)}
.wc .dict .head{position:absolute;font-weight:700;white-space:nowrap}
.wc .dict .defs{position:absolute;left:0;width:100%;padding:0 28px;display:flex;flex-direction:column;gap:10px}
.wc .dict .def{text-align:center;font-size:1em;line-height:1.6;color:var(--ink-2);text-wrap:balance}
.wc .dict .def small{font-family:var(--sans);font-size:.7em;color:var(--ink-3);letter-spacing:.08em;margin-right:6px}
`;
