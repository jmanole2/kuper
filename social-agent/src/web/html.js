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
:root{--bg:#f6f4ef;--card:#fff;--ink:#1d1d1f;--muted:#6b6b70;--line:#e6e2d8;--accent:#ff5a36;--ok:#1f9d55;--warn:#c27c0e;--bad:#d64545;--radius:14px}
@media (prefers-color-scheme:dark){:root{--bg:#141416;--card:#1d1d20;--ink:#f2f2f2;--muted:#a0a0a8;--line:#2e2e33}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:inherit}header{display:flex;align-items:center;gap:16px;padding:14px 20px;border-bottom:1px solid var(--line);background:var(--card);position:sticky;top:0;z-index:2}
header .brand{font-weight:700;letter-spacing:-.01em}header nav{display:flex;gap:14px;margin-left:auto;font-size:14px}
main{max-width:1100px;margin:0 auto;padding:24px 16px 80px}h1{font-size:26px;margin:0 0 6px;letter-spacing:-.02em}h2{font-size:19px;margin:32px 0 12px}
.muted{color:var(--muted)}.small{font-size:13px}.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:16px}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.spread{justify-content:space-between}
.badge{display:inline-block;padding:2px 9px;border-radius:99px;font-size:12px;font-weight:600;background:var(--line)}
.b-pendiente,.b-necesita_asset{background:#fff1d6;color:#8a5a00}.b-aprobado{background:#dff3e7;color:#146c3b}.b-publicado{background:#1f9d55;color:#fff}
.b-error,.b-error_generacion,.b-rechazado{background:#fde2e2;color:#a12a2a}.b-generando,.b-cambios_solicitados,.b-publicando{background:#e3ecff;color:#2446a6}
.carousel{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;border-radius:10px}.carousel img{flex:0 0 88%;width:88%;scroll-snap-align:start;border-radius:10px;display:block}
.media{width:100%;border-radius:10px;background:#0002;display:block;max-height:520px;object-fit:contain}
textarea,input,select{width:100%;font:inherit;padding:9px 11px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink)}
textarea{min-height:130px}textarea.code{font:13px/1.45 ui-monospace,Menlo,monospace;min-height:260px}
label{display:block;font-size:13px;font-weight:600;margin:12px 0 4px}
button,.btn{display:inline-block;border:0;border-radius:10px;padding:9px 15px;font:inherit;font-weight:600;cursor:pointer;background:var(--ink);color:var(--bg);text-decoration:none}
.btn-ok{background:var(--ok);color:#fff}.btn-warn{background:transparent;color:var(--ink);border:1px solid var(--line)}.btn-bad{background:transparent;color:var(--bad);border:1px solid var(--bad)}
.btn-accent{background:var(--accent);color:#fff}form.inline{display:inline}
.variant{border:1px solid var(--line);border-radius:10px;padding:10px;margin:8px 0;cursor:pointer}.variant:has(input:checked){border-color:var(--accent);box-shadow:0 0 0 2px #ff5a3630}
.variant input{width:auto;margin-right:6px}.warn{background:#fff6e0;color:#6b4a00;border-radius:10px;padding:8px 12px;font-size:13px;margin:8px 0}
.okmsg{background:#dff5e3;color:#14532d;border-radius:10px;padding:8px 12px;font-size:13px;margin:8px 0;word-break:break-word}
.err{background:#fde2e2;color:#7a1d1d;border-radius:10px;padding:8px 12px;font-size:13px;margin:8px 0;word-break:break-word}
details summary{cursor:pointer;font-weight:600}table{width:100%;border-collapse:collapse;font-size:14px}td,th{text-align:left;padding:8px;border-bottom:1px solid var(--line);vertical-align:top}
.tags{color:#2446a6;font-size:13px}.kpi{font-size:26px;font-weight:700}.split{display:grid;gap:16px;grid-template-columns:1fr 1fr}
@media (max-width:760px){.split{grid-template-columns:1fr}}
`;

export function page({ title, body, nav = '', brand = 'Agente Social' }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${CSS}</style></head><body>
<header><span class="brand">${esc(brand)}</span><nav>${nav}</nav></header><main>${body}</main></body></html>`;
}
