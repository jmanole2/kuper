// Reporte mensual del cliente: lo que hicieron sus agentes y cómo se movieron sus redes.
// Se ve en el panel y se imprime/guarda como PDF desde el navegador.
import { html, raw, page } from './html.js';
import { hero } from './control.js';

const n = (v) => (v == null ? '—' : new Intl.NumberFormat('es-MX').format(v));
const signo = (v) => (v == null ? '' : v > 0 ? `+${n(v)}` : n(v));
const ORIGEN = { whatsapp: 'WhatsApp', instagram: 'Instagram', facebook: 'Facebook', web: 'Página de citas', llamada: 'Llamadas', otro: 'Otro' };
const RED = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', tiktok: 'TikTok' };

const CSS = `
.rp-kpis{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-bottom:18px}
.rp-k{background:linear-gradient(160deg,#f6f3ed,#ebe7df);color:#1d1b18;border-radius:22px;padding:16px 18px}
.rp-k b{display:block;font-size:40px;font-weight:300;letter-spacing:-.04em;line-height:1.05}.rp-k small{color:#6f6a62;font-size:12.5px}
.rp-k em{font-style:normal;font-size:12px;color:#3f6212;background:#ecfccb;border-radius:99px;padding:2px 8px;margin-left:6px}
.rp-grid{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));align-items:start}
.rp-top{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
.rp-top a{display:block;text-decoration:none;color:inherit;border-radius:18px;overflow:hidden;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}
.rp-top img{width:100%;aspect-ratio:4/5;object-fit:cover;display:block;background:#000}.rp-top div{padding:10px 12px;font-size:13px}
.rp-bar{display:flex;align-items:center;gap:10px;margin:8px 0;font-size:14px}.rp-bar i{display:block;height:8px;border-radius:99px;background:#c9f53a}
.rp-acciones{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 18px}
@media print{
  body{background:#fff!important;color:#1d1b18!important}.side,.rp-acciones,.kh-r,.kh-tabs{display:none!important}.layout{display:block!important}main{padding:0!important;max-width:none!important}
  .kh{box-shadow:none!important;border:1px solid #ddd!important;grid-template-columns:1fr!important}.card{background:#fff!important;color:#1d1b18!important;border:1px solid #ddd!important;box-shadow:none!important;break-inside:avoid}
  .card .muted,.muted{color:#6f6a62!important}h2{color:#57534c!important}.rp-top a{border:1px solid #ddd}.rp-k{border:1px solid #e5e1d8}
}`;

export function reportePage(client, r, { base, meses = [], side = null, publico = false }) {
  const kpis = [
    r.servicios.redes ? [r.publicaciones, 'Publicaciones', null] : null,
    r.servicios.chat ? [r.respuestas, 'Respuestas de tus agentes', null] : null,
    r.servicios.llamadas ? [r.llamadas?.llamadas ?? 0, 'Llamadas atendidas', null] : null,
    [r.leads, 'Leads nuevos', null],
    [r.citas, 'Citas', null],
    r.instagram ? [r.instagram.seguidores, 'Seguidores en Instagram', r.instagram.crecimiento] : null,
    [r.horasAhorradas, 'Horas ahorradas (aprox.)', null],
  ].filter(Boolean);
  const maxOrigen = Math.max(1, ...Object.values(r.porOrigen));
  const body = html`<style>${raw(CSS)}</style>
  ${hero({ kicker: `Reporte · ${r.nombreMes}`, title: client.nombre, letra: client.nombre, sub: 'Lo que hicieron tus agentes este mes y cómo se movieron tus redes.',
    tabs: meses.slice(0, 6).map((m) => [`${base}?mes=${m.mes}`, m.nombre, m.mes === r.mes]), note: ['Resumen', `${n(r.leads)} ${r.leads === 1 ? 'lead' : 'leads'} · ${n(r.citas)} ${r.citas === 1 ? 'cita' : 'citas'}`] })}
  <div class="rp-acciones"><button class="btn-accent" onclick="window.print()">Descargar PDF</button>${publico ? '' : html`<span class="muted small" style="align-self:center">En la ventana de imprimir elige "Guardar como PDF".</span>`}</div>
  <div class="rp-kpis">${kpis.map(([v, l, c]) => html`<div class="rp-k"><b>${n(v)}</b><small>${l}${c != null ? raw(` <em>${signo(c)} este mes</em>`) : ''}</small></div>`)}</div>
  <div class="rp-grid">
    ${r.servicios.redes ? html`<div class="card"><span class="mono">Publicaciones por red</span>
      ${Object.keys(r.porRed).length ? Object.entries(r.porRed).map(([red, v]) => html`<div class="rp-bar"><span style="width:90px">${RED[red] || red}</span><i style="width:${Math.max(6, (v / Math.max(...Object.values(r.porRed))) * 180)}px"></i><b>${v}</b></div>`) : html`<p class="muted">Sin publicaciones este mes.</p>`}
      ${r.instagram ? html`<p class="muted small" style="margin-top:12px">Instagram${r.instagram.usuario ? ` @${r.instagram.usuario}` : ''}: ${n(r.instagram.interacciones)} interacciones${r.instagram.alcance ? ` · ${n(r.instagram.alcance)} de alcance` : ''}.</p>` : ''}
      ${r.facebook ? html`<p class="muted small" style="margin:4px 0 0">Facebook: ${n(r.facebook.seguidores)} seguidores${r.facebook.crecimiento != null ? ` (${signo(r.facebook.crecimiento)})` : ''}.</p>` : ''}</div>` : ''}
    <div class="card"><span class="mono">De dónde llegaron tus leads</span>
      ${Object.keys(r.porOrigen).length ? Object.entries(r.porOrigen).sort((a, b) => b[1] - a[1]).map(([o, v]) => html`<div class="rp-bar"><span style="width:120px">${ORIGEN[o] || o}</span><i style="width:${Math.max(6, (v / maxOrigen) * 160)}px"></i><b>${v}</b></div>`) : html`<p class="muted">Todavía no hay leads este mes.</p>`}
      <p class="muted small" style="margin-top:12px">${n(r.mensajesRecibidos)} mensajes recibidos · ${n(r.respuestas)} respuestas · ${n(r.citas)} citas${r.clientes ? ` · ${n(r.clientes)} cerrados` : ''}.</p></div>
  </div>
  ${r.top.length ? html`<h2>Tus mejores publicaciones</h2><div class="rp-top">${r.top.map((p) => html`<a href="${p.link || '#'}" target="_blank" rel="noopener">${p.imagen ? html`<img src="${p.imagen}" alt="" loading="lazy">` : ''}<div><b>${n(p.interacciones)}</b> interacciones${p.alcance ? html` · ${n(p.alcance)} alcance` : ''}<br><span class="muted small">${p.texto}</span></div></a>`)}</div>` : ''}
  <p class="muted small" style="margin-top:22px">Reporte generado por los agentes de Kuper Media. Las horas ahorradas son una estimación del tiempo que tomaría hacer este trabajo a mano.</p>`;
  return page({ title: `Reporte ${r.nombreMes} · ${client.nombre}`, side, body });
}

// ------------------------------------------------------------ correo del reporte (día 1 de cada mes)
const escE = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function reporteCorreo(client, r, url) {
  const cel = (v, l, c) => `<td width="50%" style="padding:6px"><div style="background:#f6f3ed;border-radius:16px;padding:14px 16px"><div style="font-size:30px;font-weight:300;color:#1d1b18;letter-spacing:-.03em">${escE(n(v))}</div><div style="font-size:12.5px;color:#6f6a62">${escE(l)}${c != null ? ` <b style="color:#3f6212">${escE(signo(c))}</b>` : ''}</div></div></td>`;
  const items = [
    r.servicios.redes ? [r.publicaciones, 'publicaciones'] : null, r.servicios.chat ? [r.respuestas, 'respuestas de tus agentes'] : null,
    r.servicios.llamadas ? [r.llamadas?.llamadas ?? 0, 'llamadas atendidas'] : null,
    [r.leads, 'leads nuevos'], [r.citas, 'citas'], r.instagram ? [r.instagram.seguidores, 'seguidores en Instagram', r.instagram.crecimiento] : null, [r.horasAhorradas, 'horas ahorradas (aprox.)'],
  ].filter(Boolean);
  const filas = [];
  for (let i = 0; i < items.length; i += 2) filas.push(`<tr>${cel(...items[i])}${items[i + 1] ? cel(...items[i + 1]) : '<td></td>'}</tr>`);
  const subject = `Tu reporte de ${r.nombreMes} · ${client.nombre}`;
  const html2 = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#121110"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#121110"><tr><td align="center" style="padding:26px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<tr><td style="background:#efece6;border-radius:24px 24px 0 0;padding:26px 24px 10px"><div style="font:600 11px ui-monospace,Menlo,monospace;letter-spacing:.2em;color:#57534c;text-transform:uppercase">Reporte · ${escE(r.nombreMes)}</div>
<div style="font-size:34px;font-weight:300;letter-spacing:-.03em;color:#1d1b18;margin:8px 0 4px">${escE(client.nombre)}</div><div style="font-size:14px;color:#6f6a62">Esto hicieron tus agentes este mes.</div></td></tr>
<tr><td style="background:#efece6;padding:6px 18px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas.join('')}</table></td></tr>
<tr><td style="background:#1d1b18;border-radius:0 0 24px 24px;padding:22px 24px" align="center"><a href="${escE(url)}" style="display:inline-block;background:#d7ff3f;color:#1d1b18;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:99px;font-size:15px">Ver reporte completo</a>
<div style="color:#a39d93;font-size:12px;margin-top:14px">Kuper Media · agentes de IA para tu negocio</div></td></tr>
</table></td></tr></table></body></html>`;
  const text = `${subject}\n\n${items.map(([v, l, c]) => `${n(v)} ${l}${c != null ? ` (${signo(c)})` : ''}`).join('\n')}\n\nVer reporte completo: ${url}`;
  return { subject, html: html2, text };
}
