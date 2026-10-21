// Centro de control (inicio del panel): columna clara con números del día y lado oscuro con la
// esfera de partículas animada, accesos en anillo, "En vivo", citas, WhatsApp y actividad.
import { html, raw } from './html.js';
import { config } from '../config.js';

const MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,monospace';
const ICO = {
  chat: '<path d="M4 5h16v11H8l-4 4z"/>', cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  post: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="M20 15l-5-5-9 9"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 4.5a3 3 0 0 1 0 6M21 20c0-2.6-1.5-4.5-3.8-5.2"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.1"/>', arrow: '<path d="M7 17L17 7M9 7h8v8"/>',
};
const svgI = (k, s = 16) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICO[k] || ''}</svg>`;

const CSS = `
.cc{display:grid;grid-template-columns:minmax(300px,.85fr) 1.7fr;border-radius:32px;overflow:hidden;border:1px solid rgba(255,240,220,.08);box-shadow:0 40px 120px rgba(0,0,0,.55);margin:6px 0 34px;min-height:780px}
.cc-light{background:linear-gradient(160deg,#f3f0ea,#e7e3db);color:#1d1b18;padding:30px 28px;display:flex;flex-direction:column;gap:16px}
.cc-brand{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;color:#3b3833}.cc-brand i{width:26px;height:26px;border-radius:8px;background:#1d1b18;color:#d7ff3f;display:grid;place-items:center;font-style:normal;font-weight:700;font-size:13px}
.cc-h{font:300 46px/1.02 "Inter Tight",system-ui,sans-serif;letter-spacing:-.035em;text-transform:none;margin:8px 0 0;color:#1d1b18}
.cc-sub{margin:0;color:#7b766d;font-size:13px}
.mono{font-family:${MONO};font-size:10.5px;letter-spacing:.2em;text-transform:uppercase}
.cc-card{background:#fbfaf7;border-radius:24px;padding:18px 18px 14px;box-shadow:0 1px 0 rgba(255,255,255,.8) inset,0 14px 34px rgba(60,50,30,.08)}
.cc-card .mono{color:#57534c}.cc-card .when{color:#9a958c;font-size:11px;margin-left:8px;letter-spacing:.04em;text-transform:none;font-family:inherit}
.cc-big{display:flex;align-items:baseline;gap:8px;margin:10px 0 2px}.cc-big b{font-size:52px;font-weight:300;letter-spacing:-.04em;line-height:1}.cc-big small{color:#8b867d;font-size:14px}
.cc-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#c9f53a;margin-right:6px;vertical-align:1px}
.cc-delta{font-size:12px;color:#57534c}.cc-pillok{font-size:11px;color:#57534c;display:flex;align-items:center}
.cc-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.cc-two .cc-card{padding:16px}
.cc-two a{color:#57534c}
.cc-dark{position:relative;padding:22px 24px 24px;color:#efebe4;background:radial-gradient(70% 55% at 42% 40%,#57514a 0%,#2d2a26 45%,#191715 100%);display:flex;flex-direction:column;gap:18px;overflow:hidden}
.cc-dark::after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(40% 30% at 85% 0%,rgba(255,250,240,.08),transparent 70%)}
.cc-tabs{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;position:relative;z-index:2}
.cc-tabs a{padding:8px 16px;border-radius:99px;font-size:13px;text-decoration:none;color:#d9d4cb;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(10px);transition:.2s}
.cc-tabs a:hover{background:rgba(255,255,255,.12)}.cc-tabs a.on{background:#f4f1eb;color:#1d1b18;font-weight:600;box-shadow:0 6px 20px rgba(255,255,255,.12)}
.cc-stage{position:relative;display:grid;grid-template-columns:1fr 250px;align-items:center;gap:8px;min-height:430px;z-index:1}
.cc-orbwrap{position:relative;width:min(100%,470px);aspect-ratio:1;margin:0 auto}
.cc-orbwrap svg.ring{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.cc-seg>path{fill:rgba(255,255,255,.055);stroke:rgba(255,255,255,.13);stroke-width:1;transition:fill .25s,transform .25s;transform-box:fill-box}
.cc-seg:hover>path{fill:rgba(255,255,255,.13)}.cc-seg text{fill:#ddd7cd;font-size:12.5px;font-family:inherit}.cc-seg g.ic{color:#ddd7cd}
.cc-seg:hover{filter:drop-shadow(0 0 10px rgba(255,255,255,.12))}
.cc-orb{position:absolute;left:21%;top:21%;width:58%;height:58%;border-radius:50%;background:radial-gradient(circle at 50% 45%,#141210,#060505 70%);box-shadow:0 0 0 1px rgba(255,255,255,.08),0 0 0 10px rgba(0,0,0,.25),0 30px 80px rgba(0,0,0,.6),inset 0 0 40px rgba(0,0,0,.9);overflow:hidden}
.cc-orb canvas{width:100%;height:100%;display:block}
.cc-orbwrap .halo{position:absolute;left:17%;top:17%;width:66%;height:66%;border-radius:50%;border:1px dashed rgba(255,255,255,.12);animation:ccspin 60s linear infinite}
.cc-orbwrap .pulse{position:absolute;left:21%;top:21%;width:58%;height:58%;border-radius:50%;border:1px solid rgba(215,255,63,.35);animation:ccpulse 3.2s ease-out infinite;pointer-events:none}
@keyframes ccspin{to{transform:rotate(360deg)}}@keyframes ccpulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.22);opacity:0}}
.cc-glass{background:linear-gradient(160deg,rgba(255,255,255,.13),rgba(255,255,255,.04));border:1px solid rgba(255,255,255,.12);border-radius:24px;backdrop-filter:blur(18px);box-shadow:0 24px 60px rgba(0,0,0,.35)}
.cc-live{padding:18px;position:relative}.cc-live .mono{color:#cfc9bf}.cc-live h3{font-size:24px;font-weight:400;margin:10px 0 0;letter-spacing:-.02em}.cc-live .sub{color:#a9a399;font-size:13px}
.cc-live canvas{width:100%;height:58px;display:block;margin:14px 0}.cc-live q{display:block;font-size:13.5px;line-height:1.45;color:#e9e4db;quotes:"“" "”"}
.cc-livedot{position:absolute;right:16px;top:16px;width:22px;height:12px;border-radius:99px;background:rgba(215,255,63,.18);display:grid;place-items:center}.cc-livedot::after{content:"";width:6px;height:6px;border-radius:50%;background:#d7ff3f;box-shadow:0 0 10px #d7ff3f;animation:ccblink 1.6s infinite}
.cc-live.idle .cc-livedot{background:rgba(255,255,255,.08)}.cc-live.idle .cc-livedot::after{background:#8a857c;box-shadow:none;animation:none}
@keyframes ccblink{50%{opacity:.25}}
.cc-row{display:grid;grid-template-columns:1.15fr .85fr 1.2fr;gap:14px;position:relative;z-index:1;align-items:start}.cc-row>.cc-d{min-height:250px}
.cc-d{padding:18px;min-height:190px;position:relative;overflow:hidden}.cc-d .mono{color:#cfc9bf}.cc-d .num{font-size:46px;font-weight:300;letter-spacing:-.04em;line-height:1;margin:12px 0 2px}.cc-d .num small{font-size:13px;color:#a9a399;letter-spacing:0;margin-left:6px}
.cc-d .pill{font-size:11px;padding:4px 10px;border-radius:99px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.12);color:#e9e4db;display:flex;align-items:center}
.cc-gold{background:radial-gradient(120% 90% at 60% 130%,rgba(232,183,58,.55),transparent 60%),linear-gradient(160deg,rgba(255,236,190,.12),rgba(255,255,255,.03))!important;border-color:rgba(255,220,140,.25)!important}
.cc-gold::before{content:"";position:absolute;inset:-40% -60%;background:linear-gradient(100deg,transparent 40%,rgba(255,225,150,.22) 50%,transparent 60%);animation:ccsweep 6s ease-in-out infinite}
@keyframes ccsweep{0%{transform:translateX(-40%)}60%,100%{transform:translateX(40%)}}
.cc-up{color:#d7ff3f;font-size:11px}
.cc-feed{padding:16px 14px}.cc-feed ul{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:6px}
.cc-feed li{display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;padding:8px 10px;border-radius:14px;background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.06);animation:ccin .5s ease both}
.cc-feed li i{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:rgba(255,255,255,.08);color:#e9e4db}.cc-feed li.err i{color:#fca5a5;background:rgba(248,113,113,.12)}
.cc-feed li b{font-size:12.5px;font-weight:500;display:block}.cc-feed li span{font-size:11px;color:#a29c92;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px}.cc-feed li time{font-size:10px;color:#8b867d;font-family:${MONO}}
@keyframes ccin{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
@media (max-width:1100px){.cc{grid-template-columns:1fr}.cc-row{grid-template-columns:1fr 1fr}.cc-feed{grid-column:1/-1}}
@media (max-width:700px){.cc{border-radius:24px;min-height:0}.cc-light,.cc-dark{padding:20px 16px}.cc-h{font-size:36px}.cc-stage{grid-template-columns:1fr}.cc-row{grid-template-columns:1fr}.cc-tabs{justify-content:flex-start}.cc-feed li span{max-width:180px}}
@media (prefers-reduced-motion:reduce){.cc-orbwrap .halo,.cc-orbwrap .pulse,.cc-gold::before,.cc-livedot::after{animation:none}}
`;

// ---------------------------------------------------------------- gráficas (SVG del lado del servidor)
function lollipopHoras(horas) {
  const W = 300, H = 120, x0 = 10, x1 = 272, max = Math.max(4, ...horas.map((h) => h.eventos + h.mensajes));
  const y = (v) => H - 22 - (v / max) * (H - 36);
  const step = (x1 - x0) / (horas.length - 1);
  const items = horas.map((h, i) => {
    const x = x0 + i * step, tot = h.eventos + h.mensajes;
    return `<line x1="${x}" x2="${x}" y1="${y(max)}" y2="${H - 22}" stroke="#d9d5cd" stroke-width="1"/>
 <circle cx="${x}" cy="${y(tot)}" r="${tot ? 3.2 : 1.8}" fill="${tot ? '#1d1b18' : '#bdb8ae'}"/>
      ${h.mensajes ? `<circle cx="${x}" cy="${Math.min(H - 26, y(tot) + 11)}" r="2.6" fill="#c9f53a"/>` : ''}`;
  }).join('');
  const lab = [[0, '12 AM'], [6, '6 AM'], [12, '12 PM'], [18, '6 PM'], [23, '11 PM']].map(([h, t]) => `<text x="${x0 + h * step}" y="${H - 4}" font-size="10" fill="#8b867d" text-anchor="middle">${t}</text>`).join('');
  const ax = [max, Math.round(max / 2), 0].map((v) => `<text x="${W - 2}" y="${y(v) + 3}" font-size="10" fill="#8b867d" text-anchor="end">${v}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;margin-top:10px">${items}${lab}${ax}</svg>`;
}
function anilloAprobacion(pct) {
  const n = 44, r = 40, on = Math.round(((pct ?? 0) / 100) * n);
  const dots = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return `<circle cx="${50 + r * Math.cos(a)}" cy="${50 + r * Math.sin(a)}" r="${i < on ? 2.3 : 1.6}" fill="${i < on ? (i === on - 1 ? '#c9f53a' : '#1d1b18') : '#cfcac1'}"/>`;
  }).join('');
  return `<svg viewBox="0 0 100 100" width="100%" style="max-width:120px;display:block;margin:8px auto 0">${dots}<text x="50" y="54" text-anchor="middle" font-size="15" fill="#1d1b18" font-weight="300">${pct == null ? '—' : pct + '%'}</text></svg>`;
}
function capsHoras(vals) {
  const W = 120, H = 70, max = Math.max(1, ...vals);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;margin-top:14px">${vals.map((v, i) => {
    const x = 8 + i * ((W - 16) / (vals.length - 1)), y = H - 8 - (v / max) * (H - 20);
    return `<line x1="${x}" x2="${x}" y1="${H - 8}" y2="${y}" stroke="#1d1b18" stroke-width="1.2"/><line x1="${x - 4}" x2="${x + 4}" y1="${y}" y2="${y}" stroke="#1d1b18" stroke-width="1.4"/><circle cx="${x}" cy="${H - 8}" r="2" fill="#1d1b18"/>`;
  }).join('')}</svg>`;
}
function puntosCitas(porDia) {
  const W = 300, H = 104, cols = porDia.length, horas = [9, 11, 13, 15, 17];
  const fx = (i) => 18 + i * ((W - 36) / Math.max(1, cols - 1)), fy = (h) => 10 + ((Math.min(18, Math.max(8, h)) - 8) / 10) * (H - 34);
  const DIA = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  let s = '';
  porDia.forEach((d, i) => {
    for (const h of horas) s += `<circle cx="${fx(i)}" cy="${fy(h)}" r="1.4" fill="rgba(255,255,255,.18)"/>`;
    for (const e of d.eventos) s += `<circle cx="${fx(i)}" cy="${fy(e.hora)}" r="${e.kuper ? 4 : 3}" fill="${e.kuper ? '#d7ff3f' : '#f4efe6'}"${e.kuper ? ' style="filter:drop-shadow(0 0 6px rgba(215,255,63,.8))"' : ''}/>`;
    s += `<text x="${fx(i)}" y="${H - 4}" font-size="10" fill="#b8b1a5" text-anchor="middle">${DIA[new Date(d.dia + 'T12:00:00Z').getUTCDay()]}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;margin-top:12px;position:relative">${s}</svg>`;
}
function chispas(serie) {
  const W = 220, H = 56, max = Math.max(1, ...serie);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;margin-top:14px">${serie.map((v, i) => {
    const x = 6 + i * ((W - 12) / (serie.length - 1)), y = H - 6 - (v / max) * (H - 14);
    return `<line x1="${x}" x2="${x}" y1="${H - 6}" y2="${y}" stroke="rgba(255,255,255,.18)"/><circle cx="${x}" cy="${y}" r="${i === serie.length - 1 ? 3.4 : 2.2}" fill="${i === serie.length - 1 ? '#d7ff3f' : '#efe9df'}"/>`;
  }).join('')}</svg>`;
}

// Anillo de accesos alrededor de la esfera (deja libre el lado derecho, donde va "En vivo").
function anillo(links) {
  const R1 = 160, R2 = 222, C = 235, gap = 2.2, ini = 38, fin = 322, n = links.length, paso = (fin - ini) / n;
  const pt = (r, a) => [C + r * Math.cos((a * Math.PI) / 180), C + r * Math.sin((a * Math.PI) / 180)];
  return `<svg class="ring" viewBox="0 0 ${C * 2} ${C * 2}">${links.map((l, i) => {
    const a0 = ini + i * paso + gap, a1 = ini + (i + 1) * paso - gap, am = (a0 + a1) / 2;
    const [x1, y1] = pt(R2, a0), [x2, y2] = pt(R2, a1), [x3, y3] = pt(R1, a1), [x4, y4] = pt(R1, a0);
    const d = `M${x1},${y1} A${R2},${R2} 0 0 1 ${x2},${y2} L${x3},${y3} A${R1},${R1} 0 0 0 ${x4},${y4} Z`;
    const [tx, ty] = pt((R1 + R2) / 2, am);
    const rot = am < 180 ? am - 90 : am + 90; // texto siguiendo el anillo, nunca de cabeza
    return `<a class="cc-seg" href="${l.href}"><path d="${d}"/><g transform="translate(${tx},${ty}) rotate(${rot})"><g class="ic" transform="translate(-9,-22)" style="color:#e6e0d6">${svgI(l.icon, 18)}</g><text x="0" y="14" text-anchor="middle">${l.label}</text></g></a>`;
  }).join('')}</svg>`;
}

const hora = (iso) => new Intl.DateTimeFormat('es-MX', { timeZone: config.timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
const feedItem = (f) => `<li class="${f.error ? 'err' : ''}"><i>${svgI(f.icono, 15)}</i><div><b>${esc(f.titulo)}</b><span>${esc(f.detalle)}</span></div><time>${hora(f.t)}</time></li>`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// opts.cliente: vista de un cliente (links a /app, sin Competencia, su nombre arriba).
export function controlCenter(p, clients, { cliente = null } = {}) {
  const c0 = clients.find((c) => c.activo) || clients[0];
  const tab = (t) => (cliente ? `/app/${t === 'competencia' ? '' : t}` : c0 ? `/admin/clientes/${c0.id}?tab=${t}` : '/admin/clientes/nuevo');
  const inicio = cliente ? '/app' : '/admin';
  const links = [
    { label: 'Citas', icon: 'cal', href: tab('citas') }, { label: 'Leads', icon: 'users', href: tab('leads') },
    { label: 'WhatsApp', icon: 'chat', href: tab('leads') }, { label: 'Posts', icon: 'post', href: tab('posts') },
    cliente ? { label: 'Mi cuenta', icon: 'check', href: '/app/cuenta' } : { label: 'Competencia', icon: 'eye', href: tab('competencia') },
  ];
  const delta = p.tareasHoy - p.tareasAyer;
  const errores = p.feed.filter((f) => f.error).length;
  const ci = p.citas;
  const v = p.vivo;
  const data = JSON.stringify({ tz: config.timezone, activo: !!v?.activo, url: cliente ? '/app/pulso.json' : '/admin/pulso.json' }).replace(/</g, '\\u003c');
  return html`<style>${raw(CSS)}</style>
<section class="cc" id="cc">
  <div class="cc-light">
    <div class="cc-brand"><i>${cliente ? cliente.nombre.slice(0, 1) : 'K'}</i>${cliente ? cliente.nombre : 'Kuper · Agentes'}</div>
    <h2 class="cc-h">Tus agentes<br>de IA</h2>
    <p class="cc-sub">${cliente ? 'Trabajando para tu marca' : `${p.marcas} ${p.marcas === 1 ? 'marca activa' : 'marcas activas'}`} · actualizado <span id="cc-ago">hace 0 s</span></p>
    <div class="cc-card">
      <div class="row spread"><span class="mono">Tareas hoy<span class="when" id="cc-clock"></span></span><span class="cc-pillok"><span class="cc-dot" style="${errores ? 'background:#f87171' : ''}"></span>${errores ? `${errores} con error` : 'Sin errores'}</span></div>
      <div class="cc-big"><b data-count="${p.tareasHoy}" id="cc-tareas">${p.tareasHoy}</b><small>tareas</small></div>
      <div class="cc-delta"><span class="cc-dot"></span>${delta >= 0 ? `${delta} más que ayer` : `${-delta} menos que ayer`} · ${p.mensajesHoy} respuestas de WhatsApp</div>
      ${raw(lollipopHoras(p.horas))}
    </div>
    <div class="cc-two">
      <a class="cc-card" href="${tab('posts')}" style="text-decoration:none;color:inherit"><div class="row spread"><span class="mono">Aprobación</span>${raw(svgI('arrow', 14))}</div>${raw(anilloAprobacion(p.aprobacion))}</a>
      <div class="cc-card"><span class="mono">Horas ahorradas</span>
        <div class="cc-big" style="margin-top:8px"><b style="font-size:34px">${p.horasSemana}</b><small>h · 7 días</small></div>${raw(capsHoras(p.horasAhorradas))}</div>
    </div>
    <div class="cc-two">
      <div class="cc-card"><span class="mono">Por revisar</span><div class="cc-big"><b style="font-size:34px">${p.posts.revisar}</b><small>posts</small></div></div>
      <div class="cc-card"><span class="mono">Programados</span><div class="cc-big"><b style="font-size:34px">${p.posts.programados}</b><small>posts</small></div></div>
    </div>
  </div>
  <div class="cc-dark">
    <nav class="cc-tabs"><a class="on" href="${inicio}">Resumen</a><a href="${tab('posts')}">Posts</a><a href="${tab('leads')}">Leads</a><a href="${tab('citas')}">Citas</a>${cliente ? '' : html`<a href="${tab('competencia')}">Competencia</a>`}</nav>
    <div class="cc-stage">
      <div class="cc-orbwrap"><div class="halo"></div>${raw(anillo(links))}<div class="cc-orb"><canvas id="cc-orb" class="k-orb" aria-label="Agente en actividad"></canvas></div><div class="pulse"></div></div>
      <div class="cc-live cc-glass${v?.activo ? '' : ' idle'}" id="cc-live">
        <span class="mono">${v?.activo ? 'En vivo' : 'Último'}</span><span class="cc-livedot"></span>
        <h3 id="cc-live-n">${v?.nombre || 'Todo tranquilo'}</h3><div class="sub" id="cc-live-c">${v ? `${v.canal} · ${hora(v.t)}` : 'Sin actividad reciente'}</div>
        <canvas id="cc-wave"></canvas>
        <q id="cc-live-q">${v?.texto || 'Cuando el agente conteste o publique algo, lo verás aquí.'}</q>
      </div>
    </div>
    <div class="cc-row">
      <a class="cc-d cc-glass cc-gold" href="${tab('citas')}" style="text-decoration:none;color:inherit">
        <div class="row spread" style="gap:6px"><span class="mono">Citas · 7 días</span>
        <span class="pill"><span class="cc-dot" style="${ci?.libres === 0 ? 'background:#f87171' : ''}"></span>${ci == null ? 'Sin calendario' : ci.libres === 0 ? 'Agenda llena' : `${ci.libres ?? 0} libres`}</span></div>
        <div class="num">${ci?.semana ?? 0}<small>agendadas</small></div>
        <div class="cc-up">▲ ${ci?.hoy ?? 0} hoy</div>
        ${ci ? raw(puntosCitas(ci.porDia)) : ''}
      </a>
      <a class="cc-d cc-glass" href="${tab('leads')}" style="text-decoration:none;color:inherit">
        <span class="mono">WhatsApp</span>
        <div class="num">${p.leads.total}<small>leads</small></div>
        <div class="cc-up">▲ ${p.leads.hoy} hoy · ${p.leads.porEstado.cita || 0} con cita</div>
        ${raw(chispas(p.serie.map((s) => s.mensajes + s.leads)))}
      </a>
      <div class="cc-feed cc-glass"><span class="mono" style="color:#cfc9bf">Actividad</span>
        <ul id="cc-feed">${raw(p.feed.map(feedItem).join('') || '<li><i>' + svgI('spark', 15) + '</i><div><b>Sin actividad todavía</b><span>Aquí aparece cada cosa que hacen tus agentes.</span></div><time></time></li>')}</ul>
      </div>
    </div>
  </div>
</section>
${orbTag()}<script>(${raw(clientScript.toString())})(${raw(data)});</script>`;
}

// ---------------------------------------------------------------- animación (corre en el navegador)
function clientScript(cfg) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let activo = cfg.activo;
  const fit = (cv) => { const r = cv.getBoundingClientRect(); cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr); };

  // Onda de audio de "En vivo".
  const wave = document.getElementById('cc-wave'), wx = wave.getContext('2d');
  function drawWave(t) {
    const W = wave.width, H = wave.height, bars = 56, bw = W / bars;
    wx.clearRect(0, 0, W, H);
    for (let i = 0; i < bars; i++) {
      const e = Math.sin((i / bars) * Math.PI);
      const v = activo ? (0.35 + 0.65 * Math.abs(Math.sin(i * 0.55 + t * 0.006) * Math.cos(i * 0.21 - t * 0.0041))) * e : 0.08 + 0.06 * Math.abs(Math.sin(i * 0.4 + t * 0.002));
      const h = Math.max(2 * dpr, v * H * 0.92);
      wx.fillStyle = `rgba(244,239,230,${0.35 + 0.65 * e})`;
      wx.fillRect(i * bw + bw * 0.3, (H - h) / 2, Math.max(1, bw * 0.38), h);
    }
  }

  const resize = () => fit(wave);
  resize(); addEventListener('resize', resize);
  const loop = (t) => { window.__korbActivo = activo; drawWave(t); if (!reduce) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);

  // Contadores que suben, reloj y "actualizado hace…".
  for (const el of document.querySelectorAll('[data-count]')) {
    const to = Number(el.dataset.count) || 0, t0 = performance.now();
    if (reduce || !to) continue;
    const step = (t) => { const k = Math.min(1, (t - t0) / 1200); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  const clock = document.getElementById('cc-clock'), ago = document.getElementById('cc-ago');
  let last = Date.now();
  const tick = () => {
    clock.textContent = '· ' + new Intl.DateTimeFormat('es-MX', { timeZone: cfg.tz, hour: 'numeric', minute: '2-digit' }).format(new Date());
    const s = Math.round((Date.now() - last) / 1000); ago.textContent = s < 60 ? `hace ${s} s` : `hace ${Math.round(s / 60)} min`;
  };
  tick(); setInterval(tick, 1000);

  // Cada 15 s trae lo nuevo (tareas, en vivo y actividad) sin recargar.
  const hora = (iso) => new Intl.DateTimeFormat('es-MX', { timeZone: cfg.tz, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  async function refresh() {
    try {
      const r = await fetch(cfg.url, { headers: { accept: 'application/json' } });
      if (!r.ok) return;
      const p = await r.json(); last = Date.now();
      document.getElementById('cc-tareas').textContent = p.tareasHoy;
      const v = p.vivo, live = document.getElementById('cc-live');
      activo = !!v?.activo; live.classList.toggle('idle', !activo);
      live.querySelector('.mono').textContent = activo ? 'En vivo' : 'Último';
      if (v) {
        document.getElementById('cc-live-n').textContent = v.nombre;
        document.getElementById('cc-live-c').textContent = `${v.canal} · ${hora(v.t)}`;
        document.getElementById('cc-live-q').textContent = v.texto;
      }
      if (p.feedHtml) document.getElementById('cc-feed').innerHTML = p.feedHtml;
    } catch { /* sin conexión: se intenta otra vez */ }
  }
  setInterval(refresh, 15000);
}

export const feedHtml = (feed) => feed.map(feedItem).join('');

// ---------------------------------------------------------------- esfera reutilizable (todas las páginas)
// Anima cada <canvas class="k-orb">. data-puntos ajusta la densidad (las esferas chicas usan menos).
function korb() {
  if (window.__korb) return; window.__korb = true;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, dpr = Math.min(2, window.devicePixelRatio || 1);
  const make = (cv) => {
    const N = Number(cv.dataset.puntos) || 3600, pts = [];
    for (let i = 0; i < N; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), j = 1 + (Math.random() - 0.5) * 0.09;
      pts.push([Math.cos(th) * r * j, u * j, Math.sin(th) * r * j, Math.random() < 0.025, 1]);
    }
    for (let i = 0; i < N * 0.45; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, rr = Math.cbrt(Math.random()) * 0.92, r = Math.sqrt(1 - u * u) * rr;
      pts.push([Math.cos(th) * r, u * rr, Math.sin(th) * r, false, 0.45]);
    }
    return { cv, ctx: cv.getContext('2d'), pts, seed: Math.random() * 1e4 };
  };
  const orbs = [...document.querySelectorAll('canvas.k-orb')].map(make);
  const fit = () => orbs.forEach(({ cv }) => { const r = cv.getBoundingClientRect(); cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr); });
  fit(); addEventListener('resize', fit);
  function draw(o, t) {
    const { cv, ctx, pts } = o, W = cv.width, H = cv.height, R = Math.min(W, H) * 0.34, cx = W / 2, cy = H / 2;
    t += o.seed;
    ctx.clearRect(0, 0, W, H);
    const ry = t * 0.00016, rx = 0.35 + Math.sin(t * 0.00009) * 0.25, amp = window.__korbActivo ? 0.11 : 0.065;
    const cyr = Math.cos(ry), syr = Math.sin(ry), cxr = Math.cos(rx), sxr = Math.sin(rx), dot = W < 300 ? 1.25 : 0.95;
    for (const [x, y, z, hot, w] of pts) {
      const n = Math.sin(x * 3.1 + t * 0.0011) * Math.cos(y * 2.7 - t * 0.0009) + Math.sin(z * 4.2 + t * 0.0007) * 0.6 + Math.sin((x + y) * 7 + t * 0.002) * 0.15;
      const k = 1 + amp * n, X = x * k, Y = y * k, Z = z * k;
      const X1 = X * cyr - Z * syr, Z1 = X * syr + Z * cyr, Y2 = Y * cxr - Z1 * sxr, Z2 = Y * sxr + Z1 * cxr;
      const p = 2.6 / (2.6 + Z2), a = Math.max(0.04, Math.min(0.95, (0.5 - Z2 * 0.55) * w));
      ctx.fillStyle = hot ? `rgba(215,255,63,${a})` : `rgba(246,240,230,${a})`;
      const sz = (hot ? 1.6 : dot) * dpr * p;
      ctx.fillRect(cx + X1 * R * p, cy + Y2 * R * p, sz, sz);
    }
  }
  const loop = (t) => { orbs.forEach((o) => draw(o, t)); if (!reduce) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
export const orbTag = () => raw(`<script>(${korb.toString()})();</script>`);

// ---------------------------------------------------------------- encabezado con la misma línea gráfica
// Izquierda clara (marca, título, números) y derecha oscura con la esfera y las pestañas.
const HERO_CSS = `
.kh{display:grid;grid-template-columns:1.25fr 1fr;border-radius:30px;overflow:hidden;border:1px solid rgba(255,240,220,.08);box-shadow:0 30px 90px rgba(0,0,0,.45);margin:4px 0 26px}
.kh-l{background:linear-gradient(160deg,#f3f0ea,#e7e3db);color:#1d1b18;padding:26px 28px;display:flex;flex-direction:column;gap:12px;min-width:0}
.kh-l .who{display:flex;align-items:center;gap:12px}.kh-l .who .av{width:44px;height:44px;border-radius:14px;background:#1d1b18;color:#d7ff3f;display:grid;place-items:center;font-weight:700;overflow:hidden}.kh-l .who .av img{width:100%;height:100%;object-fit:contain;background:#000}
.kh-l .mono{color:#57534c}.kh-l h1{font-size:44px;font-weight:300;letter-spacing:-.035em;line-height:1.02;margin:4px 0 0;color:#1d1b18}
.kh-l .sub{color:#7b766d;font-size:13px;margin:0}
.kh-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-top:6px}
.kh-stats a,.kh-stats div{background:#fbfaf7;border-radius:18px;padding:12px 14px;text-decoration:none;color:#1d1b18;box-shadow:0 10px 26px rgba(60,50,30,.07);transition:.2s}.kh-stats a:hover{transform:translateY(-2px)}
.kh-stats b{display:block;font-size:30px;font-weight:300;letter-spacing:-.03em;line-height:1.05}.kh-stats small{font-size:11.5px;color:#6f6a62;display:flex;align-items:center;gap:6px}.kh-stats small i{width:7px;height:7px;border-radius:50%;display:inline-block}
.kh-stats .hot{outline:1.5px solid #c9f53a;box-shadow:0 0 0 4px rgba(201,245,58,.18),0 10px 26px rgba(60,50,30,.07)}
.kh-r{position:relative;padding:18px 20px;color:#efebe4;background:radial-gradient(70% 70% at 50% 60%,#57514a 0%,#2d2a26 50%,#191715 100%);display:flex;flex-direction:column;justify-content:space-between;gap:12px;min-height:250px;overflow:hidden}
.kh-r .kh-tabs{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;position:relative;z-index:2}
.kh-tabs a{padding:7px 14px;border-radius:99px;font-size:13px;text-decoration:none;color:#d9d4cb;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(10px);transition:.2s;white-space:nowrap}
.kh-tabs a:hover{background:rgba(255,255,255,.12)}.kh-tabs a.on{background:#f4f1eb;color:#1d1b18;font-weight:600}
.kh-orb{position:absolute;right:28px;bottom:-90px;width:290px;height:290px;border-radius:50%;background:radial-gradient(circle at 50% 45%,#141210,#060505 70%);box-shadow:0 0 0 1px rgba(255,255,255,.08),0 0 0 14px rgba(255,255,255,.03),0 0 0 15px rgba(255,255,255,.07),0 30px 80px rgba(0,0,0,.6);overflow:hidden}
.kh-orb canvas{width:100%;height:100%;display:block}
.kh-orb::after{content:"";position:absolute;inset:0;border-radius:50%;border:1px solid rgba(215,255,63,.35);animation:ccpulse 3.2s ease-out infinite}
.kh-note{position:relative;z-index:1;text-shadow:0 2px 12px rgba(0,0,0,.8);max-width:46%;font-size:13px;color:#cfc9bf}.kh-note b{display:block;color:#f4efe6;font-weight:400;font-size:17px;margin-top:6px}
@keyframes ccpulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.22);opacity:0}}
@media (max-width:900px){.kh{grid-template-columns:1fr}.kh-r{min-height:220px}.kh-r .kh-tabs{justify-content:flex-start}.kh-note{max-width:55%}}
@media (max-width:600px){.kh{border-radius:24px}.kh-l{padding:20px 16px}.kh-l h1{font-size:34px}.kh-orb{width:210px;height:210px;right:-40px;bottom:-50px}.kh-note{max-width:50%}}
`;
export function hero({ kicker = '', title, sub = '', avatar = null, letra = null, stats = [], tabs = [], note = null }) {
  return html`<style>${raw(HERO_CSS)}</style>
<section class="kh">
  <div class="kh-l">
    <div class="who"><span class="av">${avatar ? raw(avatar) : (letra || String(title || 'K')).slice(0, 1)}</span><span class="mono">${kicker}</span></div>
    <h1>${title}</h1>${sub ? html`<p class="sub">${sub}</p>` : ''}
    ${stats.length ? html`<div class="kh-stats">${stats.map(([n, label, color, href, hot]) => href
      ? html`<a href="${href}" class="${hot ? 'hot' : ''}"><b>${n}</b><small><i style="background:${color}"></i>${label}</small></a>`
      : html`<div class="${hot ? 'hot' : ''}"><b>${n}</b><small><i style="background:${color}"></i>${label}</small></div>`)}</div>` : ''}
  </div>
  <div class="kh-r">
    ${tabs.length ? html`<nav class="kh-tabs">${tabs.map(([href, label, on]) => html`<a class="${on ? 'on' : ''}" href="${href}">${label}</a>`)}</nav>
    ${note ? html`<div class="kh-note"><span class="mono">${note[0]}</span><b>${note[1]}</b></div>` : ''}` : html`${note ? html`<div class="kh-note"><span class="mono">${note[0]}</span><b>${note[1]}</b></div>` : ''}<span></span>`}
    <div class="kh-orb"><canvas class="k-orb" data-puntos="1500" aria-hidden="true"></canvas></div>
  </div>
</section>${orbTag()}`;
}

export const heroCss = () => raw(`<style>${HERO_CSS}</style>`);
