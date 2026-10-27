// Utilidades de HTML del lado del servidor (sin frameworks).
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Etiqueta de plantilla que escapa los valores interpolados salvo los marcados con raw().
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(s);
export function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => {
    const val = Array.isArray(v) ? v.map((x) => (x instanceof Raw ? x.s : esc(x))).join('') : v instanceof Raw ? v.s : esc(v);
    out += val + strings[i + 1];
  });
  return raw(out);
}

const CSS = `
@font-face{font-family:"Inter Tight";font-weight:400;font-display:swap;src:url(/fonts/inter-tight-latin-400-normal.woff2) format("woff2")}
@font-face{font-family:"Inter Tight";font-weight:500;font-display:swap;src:url(/fonts/inter-tight-latin-500-normal.woff2) format("woff2")}
@font-face{font-family:"Inter Tight";font-weight:600;font-display:swap;src:url(/fonts/inter-tight-latin-600-normal.woff2) format("woff2")}
@font-face{font-family:"Inter Tight";font-weight:300;font-display:swap;src:url(/fonts/inter-tight-latin-300-normal.woff2) format("woff2")}
:root{--bg:#121110;--card:rgba(255,246,232,.045);--card2:rgba(255,246,232,.08);--ink:#f4f0e8;--muted:#a39d93;--line:rgba(255,240,220,.09);
--accent:#d7ff3f;--accent-ink:#0b0d06;--blue:#2f6bff;--ok:#4ade80;--warn:#fbbf24;--bad:#f87171;--radius:24px;color-scheme:dark}
*{box-sizing:border-box}html{background:var(--bg)}
body{margin:0;min-height:100vh;color:var(--ink);font:15px/1.5 "Inter Tight",system-ui,-apple-system,"Segoe UI",sans-serif;
background:radial-gradient(1000px 700px at 0% -10%,rgba(246,238,222,.09),transparent 60%),radial-gradient(900px 700px at 100% 110%,rgba(222,170,60,.10),transparent 60%),var(--bg);background-attachment:fixed}
a{color:inherit}
.layout{display:grid;grid-template-columns:84px 1fr;min-height:100vh}
.side{position:sticky;top:0;height:100vh;padding:18px 0;display:flex;flex-direction:column;align-items:center;gap:10px;border-right:1px solid var(--line);background:rgba(0,0,0,.25);backdrop-filter:blur(14px)}
.side .logo{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;font-weight:700;font-size:20px;color:var(--accent-ink);background:var(--accent);margin-bottom:14px;text-decoration:none;box-shadow:0 0 30px rgba(198,255,61,.25)}
.side a.nav{width:52px;height:52px;border-radius:16px;display:grid;place-items:center;color:var(--muted);text-decoration:none;position:relative}
.side a.nav:hover,.side a.nav.on{background:var(--card2);color:var(--ink)}
.side a.nav.on::before{content:"";position:absolute;left:-16px;width:4px;height:22px;border-radius:4px;background:var(--accent)}
.side a.nav span{position:absolute;left:62px;white-space:nowrap;background:#24211e;padding:4px 10px;border-radius:8px;font-size:12px;opacity:0;pointer-events:none;transition:.15s}
.side a.nav:hover span{opacity:1}.side .bottom{margin-top:auto}
.side svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.top{display:flex;align-items:center;gap:14px;padding:22px 32px 0}.top .brand{font-weight:600;font-size:15px;color:var(--muted)}
main{max-width:1380px;padding:18px 32px 90px}
.solo main{margin:0 auto}
h1{font-size:42px;font-weight:300;margin:0 0 6px;letter-spacing:-.035em;line-height:1.05}
h2{font:500 11px/1.4 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.2em;text-transform:uppercase;color:#cfc9bf;margin:34px 0 14px}
.muted{color:var(--muted)}.small{font-size:13px}
.grid{display:grid;gap:18px;grid-template-columns:repeat(auto-fill,minmax(330px,1fr))}
.card{background:linear-gradient(160deg,rgba(255,250,240,.09),rgba(255,250,240,.03));border:1px solid rgba(255,240,220,.1);border-radius:var(--radius);padding:20px;backdrop-filter:blur(18px);box-shadow:0 24px 60px rgba(0,0,0,.3)}
.mono{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:10.5px;letter-spacing:.2em;text-transform:uppercase}
a.card{display:block;transition:.15s}a.card:hover{background:var(--card2);transform:translateY(-2px)}
.kpis{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin:22px 0 6px}
.kpi{background:linear-gradient(160deg,#f6f3ed,#ebe7df);color:#1d1b18;border-radius:22px;padding:16px 18px;position:relative;overflow:hidden;box-shadow:0 14px 34px rgba(0,0,0,.25)}
.kpi b{display:block;font-size:38px;font-weight:300;letter-spacing:-.04em;line-height:1.05}
.kpi small{color:#6f6a62;font-size:12.5px;display:flex;align-items:center;gap:8px}.kpi small i{width:8px;height:8px;border-radius:50%;display:inline-block}
.kpi.hot{outline:1.5px solid #c9f53a;box-shadow:0 0 0 5px rgba(201,245,58,.16),0 14px 34px rgba(0,0,0,.25)}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.spread{justify-content:space-between}
.badge{display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:99px;font-size:12px;font-weight:600;background:var(--card2);color:var(--ink);white-space:nowrap}
.badge::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor;opacity:.9}
.b-pendiente,.b-necesita_asset{background:rgba(251,191,36,.14);color:#fcd34d}.b-aprobado{background:rgba(74,222,128,.13);color:#86efac}
.b-publicado{background:rgba(198,255,61,.16);color:var(--accent)}.b-error,.b-error_generacion,.b-rechazado{background:rgba(248,113,113,.14);color:#fca5a5}
.b-generando,.b-cambios_solicitados,.b-publicando{background:rgba(47,107,255,.18);color:#93b4ff}
.chip{display:inline-flex;align-items:center;gap:7px;font:500 10.5px ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.16em;text-transform:uppercase;color:#cfc9bf}.chip i{width:9px;height:9px;border-radius:50%}
.carousel{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;border-radius:16px}.carousel img{flex:0 0 88%;width:88%;scroll-snap-align:start;border-radius:16px;display:block}
.media{width:100%;border-radius:18px;background:#000;display:block;max-height:540px;object-fit:contain}
textarea,input,select{width:100%;font:inherit;padding:11px 14px;border:1px solid rgba(255,240,220,.12);border-radius:14px;background:rgba(0,0,0,.3);color:var(--ink);outline:none}
textarea:focus,input:focus,select:focus{border-color:rgba(215,255,63,.6);box-shadow:0 0 0 3px rgba(215,255,63,.12)}
input[type=file]::file-selector-button{border:0;border-radius:99px;padding:7px 14px;margin-right:10px;background:var(--card2);color:var(--ink);font:inherit;font-weight:600;cursor:pointer}
textarea{min-height:130px}textarea.code{font:13px/1.5 ui-monospace,Menlo,monospace;min-height:260px}
label{display:block;font-size:13px;font-weight:500;margin:14px 0 6px;color:#d6d0c6}
button,.btn{display:inline-flex;align-items:center;gap:8px;border:0;border-radius:99px;padding:10px 20px;font:inherit;font-weight:600;cursor:pointer;background:#f4f1eb;color:#1d1b18;text-decoration:none;transition:.15s}
button:hover,.btn:hover{filter:brightness(1.08);transform:translateY(-1px)}
.btn-ok,.btn-accent{background:var(--accent);color:var(--accent-ink);box-shadow:0 8px 24px rgba(198,255,61,.18)}
.btn-warn{background:rgba(255,255,255,.07);color:var(--ink);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(10px)}.btn-bad{background:transparent;color:var(--bad);border:1px solid rgba(248,113,113,.5)}
form.inline{display:inline}
.variant{border:1px solid var(--line);border-radius:16px;padding:12px 14px;margin:8px 0;cursor:pointer;background:rgba(0,0,0,.2)}
.variant:has(input:checked){border-color:var(--accent);box-shadow:0 0 0 3px rgba(198,255,61,.12)}.variant input{width:auto;margin-right:6px;accent-color:#c6ff3d}
input[type=checkbox],input[type=radio]{accent-color:#c6ff3d}
.warn{background:rgba(251,191,36,.1);color:#fcd34d;border-radius:14px;padding:10px 14px;font-size:13px;margin:10px 0}
.okmsg{background:rgba(74,222,128,.1);color:#86efac;border-radius:14px;padding:10px 14px;font-size:13px;margin:10px 0;word-break:break-word}
.err{background:rgba(248,113,113,.1);color:#fca5a5;border-radius:14px;padding:10px 14px;font-size:13px;margin:10px 0;word-break:break-word}
details summary{cursor:pointer;font-weight:500;color:#d6d0c6}details[open] summary{margin-bottom:6px}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{text-align:left;padding:11px 10px;border-bottom:1px solid rgba(255,240,220,.08);vertical-align:top}th{font:500 10px ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.18em;text-transform:uppercase;color:#a39d93}tr:last-child td{border-bottom:0}
.tabs{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 8px}
.tabs a{padding:8px 16px;border-radius:99px;text-decoration:none;color:#d9d4cb;font-size:14px;white-space:nowrap;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08)}.tabs a:hover{background:rgba(255,255,255,.12)}
.tabs a.on{background:#f4f1eb;color:#1d1b18;font-weight:600}
.pills{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:16px 0}
.pills a{display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:99px;text-decoration:none;color:#d9d4cb;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);font-size:13.5px;font-weight:500}
.pills a.on{color:#1d1b18;background:#f4f1eb;border-color:#f4f1eb}.pills a.on em{background:rgba(0,0,0,.08)}.pills a em{font-style:normal;background:rgba(255,255,255,.08);border-radius:99px;padding:0 8px;font-size:12px}
.tags{color:#93b4ff;font-size:13px}.split{display:grid;gap:18px;grid-template-columns:1fr 1fr}
.avatar{width:46px;height:46px;border-radius:14px;background:var(--card2);display:grid;place-items:center;overflow:hidden;font-weight:700}.avatar img{width:100%;height:100%;object-fit:contain;background:#000}
@media (max-width:760px){.layout{grid-template-columns:1fr;align-content:start}.side{position:sticky;height:auto;flex-direction:row;justify-content:center;padding:10px;border-right:0;border-bottom:1px solid var(--line);z-index:5}
.side .logo{margin:0 10px 0 0}.side .bottom{margin:0}.side a.nav span,.side a.nav.on::before{display:none}main{padding:14px 16px 80px}.top{padding:16px 16px 0}h1{font-size:30px}.split{grid-template-columns:1fr}.kpis{grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:10px}.kpi{padding:14px;border-radius:18px}.kpi b{font-size:30px}.grid{grid-template-columns:1fr}}
`;

const ICON = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  out: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 4.5a3 3 0 0 1 0 6M21 20c0-2.6-1.5-4.5-3.8-5.2"/>',
  post: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="M20 15l-5-5-9 9"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
 brain: '<path d="M9 4a3 3 0 0 0-3 3v.5A3 3 0 0 0 4 10.3 3 3 0 0 0 5 15a3 3 0 0 0 4 4.2V4zM15 4a3 3 0 0 1 3 3v.5a3 3 0 0 1 2 2.8 3 3 0 0 1-1 4.7 3 3 0 0 1-4 4.2V4z"/>',
 chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  bill: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  help: '<path d="M4 5h16v11H8l-4 4z"/><path d="M10 9.5a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6.9V13M12 15.2v.1"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
};
export const icon = (k) => `<svg viewBox="0 0 24 24">${ICON[k] || ''}</svg>`;

/**
 * side: lista de enlaces de la barra lateral [{href, icon, label, on, bottom}] (panel de agencia).
 * Sin side: página simple (portal del cliente, login).
 */
export function page({ title, body, side = null, brand = '', mark = 'K' }) {
  const nav = side ? `<aside class="side"><a class="logo" href="${esc(side.find((l) => l.logo)?.href || '/admin')}" title="Inicio">${esc(mark)}</a>
${side.filter((l) => !l.bottom).map((l) => `<a class="nav${l.on ? ' on' : ''}" href="${esc(l.href)}">${icon(l.icon)}<span>${esc(l.label)}</span></a>`).join('')}
<div class="bottom">${side.filter((l) => l.bottom).map((l) => `<a class="nav" href="${esc(l.href)}"${l.href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${icon(l.icon)}<span>${esc(l.label)}</span></a>`).join('')}</div></aside>` : '';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#121110"><title>${esc(title)}</title><style>${CSS}</style></head><body>
<div class="${side ? 'layout' : 'solo'}">${nav}<div>${brand ? `<div class="top"><span class="brand">${esc(brand)}</span></div>` : ''}<main>${body}</main></div></div></body></html>`;
}
