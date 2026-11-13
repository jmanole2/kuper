// Vistas: tarjeta de post (compartida), portal del cliente y panel de admin.
import path from 'node:path';
import { html, raw, esc, page } from './html.js';
import { STATUS, PLATFORMS, LEAD_ESTADOS, ultimaHistoria, clientCredentials } from '../db.js';
import { etiquetaCampana } from '../campanas.js';
import * as CAMP from '../campanas.js';
import { localDate, localTime } from '../schedule.js';
import { config } from '../config.js';
import { FONTS } from '../animator/render.js';
import { controlCenter, hero, heroCss, orbTag } from './control.js';
import { embudoSection, analiticaSection, FICHA_CSS } from './embudo.js';
import { horarioIA, MODOS_IA } from '../embudo.js';
import * as AT from '../airtable.js';
import * as CONOC from '../conocimiento.js';
import { ESTADOS as PROS_ESTADOS, REGLAS as PROS_REGLAS } from '../prospeccion.js';
import { SERVICIOS, COBROS, planDe, tiene, tabActiva, mxn, conceptosTexto, mensualidad, modoCobro, IVAS, ivaDe, desglose, mensualidadTotal, etiquetaIva, fiscalDe, REGIMENES, USOS_CFDI } from '../plan.js';
// Precio con IVA según cómo se le cobra a ese cliente (para mostrar lo que de verdad paga).
const conIva = (client, monto) => desglose(monto, ivaDe(client)).total;

const PLAT = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', tiktok: 'TikTok' };
const reusa = (c, p) => p === 'tiktok' || !!c.config[p]?.reusar_instagram;
const FORMATO = { imagen_estatica: 'Imagen', video_animado: 'Animación', carrusel: 'Carrusel', solo_texto: 'Solo texto' };
const fmtDate = (iso) => (iso ? new Intl.DateTimeFormat('es-MX', { timeZone: config.timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—');
const mediaSrc = (p) => (p ? `/media/${encodeURIComponent(path.basename(p))}` : null);
export const badge = (s) => html`<span class="badge b-${s}">${STATUS[s] || s}</span>`;

function mediaBlock(p) {
  if (p.images?.length > 1) {
    return html`<div class="carousel">${p.images.map((f, i) => html`<img src="${mediaSrc(f)}" alt="${`Slide ${i + 1}: ${p.alt_text || ''}`}" loading="lazy">`)}</div>
      <p class="muted small" style="margin:4px 0 0">${p.images.length} slides · desliza para verlas</p>`;
  }
  if (p.video_path) return html`<video class="media" src="${mediaSrc(p.video_path)}" ${raw(p.image_path ? `poster="${esc(mediaSrc(p.image_path))}"` : '')} controls playsinline preload="metadata"></video>`;
  if (p.image_path) return html`<img class="media" src="${mediaSrc(p.image_path)}" alt="${p.alt_text || ''}">`;
  return '';
}

// Pantalla que exige TikTok para publicar directo (Content Sharing Guidelines): cuenta, privacidad sin valor
// por defecto, interacciones sin marcar, aviso de contenido comercial y consentimiento.
const TT_PRIV = { PUBLIC_TO_EVERYONE: 'Todos', MUTUAL_FOLLOW_FRIENDS: 'Amigos', FOLLOWER_OF_CREATOR: 'Seguidores', SELF_ONLY: 'Solo yo' };
function tiktokFields(p) {
  const i = p.tiktokInfo;
  if (!i || i.error) return html`<div class="warn">TikTok: ${i?.error || 'conecta la cuenta de TikTok en el panel para poder aprobar este video'}.</div>`;
  const dur = p.salida?.animacion?.duracion_seg;
  const box = (name, label, off) => html`<label style="font-weight:400"><input type="checkbox" name="${name}" value="1" style="width:auto" ${raw(off ? 'disabled' : '')}> ${label}${off ? ' (desactivado en la cuenta)' : ''}</label>`;
  return html`<div class="card" style="background:#fafafa;margin:10px 0">
    <p class="row" style="gap:8px;align-items:center">${i.creator_avatar_url ? html`<img src="${i.creator_avatar_url}" alt="" style="width:32px;height:32px;border-radius:50%">` : ''}
      <span>Se publicará en <strong>@${i.creator_username}</strong>${i.creator_nickname ? ` (${i.creator_nickname})` : ''}</span></p>
    ${dur && i.max_video_post_duration_sec && dur > i.max_video_post_duration_sec ? html`<div class="err">El video dura ${dur} s y esta cuenta permite máximo ${i.max_video_post_duration_sec} s.</div>` : ''}
    <label>¿Quién puede ver este video?</label>
    <select name="tt_privacy" required><option value="" disabled selected>Elige una opción</option>
      ${(i.privacy_level_options || []).map((o) => html`<option value="${o}">${TT_PRIV[o] || o}</option>`)}</select>
    <label>Permitir a los usuarios</label>
    ${box('tt_comment', 'Comentar', i.comment_disabled)} ${box('tt_duet', 'Duet', i.duet_disabled)} ${box('tt_stitch', 'Stitch', i.stitch_disabled)}
    <label style="font-weight:400;margin-top:8px"><input type="checkbox" name="tt_disclose" value="1" style="width:auto" onchange="this.closest('.card').querySelector('.tt-brand').hidden=!this.checked"> Revelar contenido comercial (este video promociona una marca, producto o servicio)</label>
    <div class="tt-brand" hidden style="padding-left:20px">
      <label style="font-weight:400"><input type="checkbox" name="tt_brand_organic" value="1" style="width:auto"> Tu marca: promocionas tu propio negocio. Se etiquetará como "Contenido promocional".</label>
      <label style="font-weight:400"><input type="checkbox" name="tt_brand_content" value="1" style="width:auto"> Contenido de marca: promocionas a un tercero. Se etiquetará como "Colaboración pagada" y no puede ser "Solo yo".</label>
    </div>
    <p class="muted small">Al publicar aceptas la <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noopener">Confirmación de uso de música</a> de TikTok y, si es contenido de marca, su <a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noopener">Política de contenido de marca</a>. El video se etiqueta como hecho con IA y puede tardar unos minutos en aparecer en el perfil.</p>
  </div>`;
}

/** base: URL base para las acciones del post (portal: /p/:token/posts/:id, admin: /admin/posts/:id) */
// En la tarjeta del admin: estado de la historia (Instagram) y arreglo de publicaciones interrumpidas.
function historiaEnTarjeta(p, base) {
  if (p.status === 'error' && /interrumpi/i.test(p.error || '')) {
    return html`<form method="post" action="${base}/marcar-publicado" class="inline"><p class="small muted" style="margin:8px 0 6px">Se cortó mientras publicaba. Si ya salió en la red, márcalo (no lo publiques otra vez):</p><button class="btn-accent">Ya salió: marcar como publicado</button></form>`;
  }
  if (p.plataforma !== 'instagram' || p.status !== 'publicado') return '';
  const h = ultimaHistoria(p.id);
  if (h?.tipo === 'historia_publicada') return html`<p class="small" style="color:#4ade80;margin:8px 0">✓ También en historias</p>`;
  const subiendo = h?.tipo === 'historia_subiendo' && Date.now() - new Date(h.created_at.replace(' ', 'T') + 'Z') < 10 * 60_000;
  if (subiendo) return html`<p class="small muted" style="margin:8px 0">Subiendo a historias…</p>`;
  return html`<form method="post" action="${base}/historia" class="inline"><p class="small muted" style="margin:8px 0 6px">${h?.tipo === 'historia_error' ? `No se pudo subir a historias: ${h.detalle}` : 'Todavía no está en historias.'}</p><button class="btn-accent">${h ? 'Reintentar historia' : 'Subir a historia'}</button></form>`;
}
export function postCard(p, { base, admin = false }) {
  const s = p.salida;
  const editable = p.status === 'pendiente';
  const warns = (s?.advertencias || []).filter((w) => admin || !w.startsWith('Validación:'));
  return html`<article class="card" id="post-${p.id}">
  <div class="row spread"><span class="chip"><i style="background:${PCOL[p.plataforma]}"></i>${PLAT[p.plataforma]} · ${FORMATO[p.formato] || 'Post'}</span>${badge(p.status)}</div>
  <p class="muted small" style="margin:4px 0 10px">${p.tema || 'Generando contenido…'}<br>Publicación: ${fmtDate(p.scheduled_at)}${p.pilar ? ` · ${p.pilar}` : ''}</p>
  ${mediaBlock(p)}
  ${p.status === 'necesita_asset' ? html`<div class="warn">Este post necesita una foto o video real${s?.alt_text ? html`: <em>${s.alt_text}</em>` : ''}.</div>
    <form method="post" action="${base}/asset" enctype="multipart/form-data">
      <label>Sube la foto (JPG/PNG) o video (MP4)</label><input type="file" name="archivo" accept="image/jpeg,image/png,video/mp4,video/quicktime" required>
      <p><button class="btn-accent">Subir</button></p></form>` : ''}
  ${editable && s ? html`<form method="post" action="${base}/aprobar">
      ${s.variantes_copy.length > 1 ? html`<label>Elige una versión del texto</label>` : ''}
      ${s.variantes_copy.map((v, i) => html`<label class="variant" style="font-weight:400">
        <input type="radio" name="variante" value="${i}" ${raw(i === p.variante ? 'checked' : '')} onchange="this.form.copy.value=this.dataset.copy;this.form.hashtags.value=this.dataset.tags" data-copy="${v.copy}" data-tags="${v.hashtags.join(' ')}">
        <strong>Opción ${i + 1}</strong><br><span style="white-space:pre-wrap">${v.copy}</span><br><span class="tags">${v.hashtags.join(' ')}</span></label>`)}
      ${p.plataforma === 'tiktok' ? tiktokFields(p) : ''}
      <details><summary>Editar texto, hashtags o fecha</summary>
        <label>Texto</label><textarea name="copy">${p.copy_final}</textarea>
        <label>Hashtags</label><input name="hashtags" value="${p.hashtags.join(' ')}">
        <div class="split"><div><label>Fecha</label><input type="date" name="fecha" value="${p.scheduled_at ? localDate(p.scheduled_at, config.timezone) : ''}"></div>
        <div><label>Hora</label><input type="time" name="hora" value="${p.scheduled_at ? localTime(p.scheduled_at, config.timezone) : '10:00'}"></div></div>
      </details>
      <p class="row"><button class="btn-ok">Aprobar y programar</button></p>
    </form>` : html`${p.copy_final ? html`<p style="white-space:pre-wrap">${p.copy_final}</p><p class="tags">${p.hashtags.join(' ')}</p>` : ''}`}
  ${warns.length ? html`<div class="warn">${warns.map((w) => html`<div>• ${w}</div>`)}</div>` : ''}
  ${p.error ? html`<div class="err">${p.error}</div>` : ''}
  ${p.external_url ? html`<p><a href="${p.external_url}" target="_blank" rel="noopener">Ver publicación ↗</a></p>` : ''}
  ${['pendiente', 'necesita_asset'].includes(p.status) ? html`<details style="margin-top:10px"><summary>Pedir cambios o rechazar</summary>
      <form method="post" action="${base}/cambios"><label>¿Qué quieres cambiar?</label>
        <textarea name="comentarios" placeholder="Ej.: más corto, enfocado en precios, otro tono…" required></textarea>
        <p class="row"><button class="btn-warn">Pedir cambios</button></p></form>
      <form method="post" action="${base}/rechazar" onsubmit="return confirm('¿Rechazar este post? No se publicará.')"><button class="btn-bad">Rechazar</button></form>
    </details>` : ''}
  ${p.status === 'error' ? html`<form method="post" action="${base}/revisar" class="inline"><p><button class="btn-warn">Regresar a aprobación</button></p></form>` : ''}
  ${admin ? historiaEnTarjeta(p, base) : ''}
  ${admin && ['aprobado', 'error'].includes(p.status) ? html`<form method="post" action="${base}/publicar" class="inline"><p><button class="btn-accent">Publicar ahora</button></p></form>` : ''}
  ${admin && p.status === 'aprobado' ? html`<form method="post" action="${base}/rechazar" class="inline" onsubmit="return confirm('¿Cancelar?')"><button class="btn-bad">Cancelar</button></form>` : ''}
  ${admin && ['error', 'error_generacion', 'rechazado'].includes(p.status) ? html`<form method="post" action="${base}/eliminar" class="inline" onsubmit="return confirm('¿Eliminar este post? No se puede deshacer.')"><p><button class="btn-bad">Eliminar</button></p></form>` : ''}
</article>`;
}

// ------------------------------------------------------------ portal del cliente
export function portalPage(client, posts, token, tab = '') {
  const base = (p) => `/p/${token}/posts/${p.id}`;
  const by = (sts) => posts.filter((p) => sts.includes(p.status));
  const pend = by(['pendiente', 'necesita_asset', 'cambios_solicitados', 'generando']);
  const prog = by(['aprobado', 'publicando']).reverse();
  const pub = by(['publicado']).slice(0, 30);
  const T = [['revisar', 'Por revisar', pend, 'No tienes nada pendiente.'], ['programadas', 'Programadas', prog, 'Nada programado todavía.'], ['publicadas', 'Publicadas', pub, 'Aún no hay publicaciones.']];
  const sel = T.find((x) => x[0] === tab) || T[0];
  const auto = PLATFORMS.some((pl) => client.config[pl]?.activo && client.config[pl]?.modo_publicacion === 'auto');
  const body = html`${hero({
    kicker: 'Portal de aprobación', title: `Hola, ${client.nombre}`, letra: client.nombre,
    sub: `Revisa y aprueba tus próximas publicaciones. Nada se publica sin tu visto bueno${auto ? ' (salvo en las redes que configuraste en automático)' : ''}.`,
    avatar: client.logo_path ? `<img src="${esc(mediaSrc(client.logo_path))}" alt="">` : null,
    stats: [[pend.length, 'Por revisar', '#fbbf24', `/p/${token}?t=revisar`, pend.length > 0], [prog.length, 'Programadas', '#4ade80', `/p/${token}?t=programadas`], [pub.length, 'Publicadas', '#c9f53a', `/p/${token}?t=publicadas`]],
    tabs: T.map(([k, l, list]) => [`/p/${token}?t=${k}`, `${l} (${list.length})`, k === sel[0]]),
    note: pend.length ? ['Pendiente', `${pend.length} ${pend.length === 1 ? 'publicación espera' : 'publicaciones esperan'} tu visto bueno`] : ['Al día', 'No tienes nada pendiente'],
  })}
  ${sel[2].length ? html`<div class="grid">${sel[2].map((p) => postCard(p, { base: base(p) }))}</div>` : html`<div class="card muted">${sel[3]}</div>`}
  ${pend.some((p) => ['generando', 'cambios_solicitados'].includes(p.status)) ? vigilar(firmaPosts(posts)) : ''}`;
  return page({ title: `Publicaciones · ${client.nombre}`, body });
}

// ------------------------------------------------------------ admin
const side = (on) => [
  { href: '/admin', icon: 'home', label: 'Inicio', on: on === 'clientes', logo: true },
  { href: '/admin/clientes/nuevo', icon: 'plus', label: 'Nuevo cliente', on: on === 'nuevo' },
  { href: '/admin/usuarios', icon: 'users', label: 'Usuarios', on: on === 'usuarios' },
  { href: '/admin/facturacion', icon: 'bill', label: 'Facturación', on: on === 'facturacion' },
  { href: '/app/cuenta', icon: 'key', label: 'Mi cuenta', on: on === 'cuenta', bottom: true },
  { href: '/admin/salir', icon: 'out', label: 'Salir', bottom: true },
];
// Barra lateral del cliente (solo su marca).
const AYUDA = 'https://wa.me/525552173832';
const sideApp = (on, client) => (client?._caja ? [
  { href: '/app/cupones', icon: 'ticket', label: 'Canjear cupones', on: true, logo: true },
  { href: '/app/cuenta', icon: 'key', label: 'Mi cuenta', on: on === 'cuenta' },
  { href: '/salir', icon: 'out', label: 'Salir', bottom: true },
] : [
  { href: '/app', icon: 'home', label: 'Inicio', on: on === 'inicio', logo: true },
  ...(tiene(client, 'redes') ? [{ href: '/app/posts', icon: 'post', label: 'Publicaciones', on: on === 'posts' }] : []),
  ...(tiene(client, 'chat') ? [{ href: '/app/leads', icon: 'users', label: 'Leads', on: on === 'leads' }, { href: '/app/embudo', icon: 'funnel', label: 'Embudo de ventas', on: on === 'embudo' }, { href: '/app/analitica', icon: 'bars', label: 'Analítica', on: on === 'analitica' }, { href: '/app/agente', icon: 'brain', label: 'Lo que sabe tu agente', on: on === 'agente' }] : []),
  ...(tiene(client, 'agenda') ? [{ href: '/app/citas', icon: 'cal', label: 'Citas', on: on === 'citas' }] : []),
  ...(tiene(client, 'comentarios') ? [{ href: '/app/comentarios', icon: 'coment', label: 'Comentarios', on: on === 'comentarios' }] : []),
  ...(tiene(client, 'chat') ? [{ href: '/app/difusion', icon: 'send', label: 'Campañas de WhatsApp', on: on === 'difusion' }] : []),
  ...(tiene(client, 'chat') ? [{ href: '/app/cupones', icon: 'ticket', label: 'Cupones', on: on === 'cupones' }] : []),
  ...(tiene(client, 'chat') ? [{ href: '/app/cobros', icon: 'card', label: 'Cobros por chat', on: on === 'cobros' }] : []),
  ...(tiene(client, 'chat') ? [{ href: '/app/correo', icon: 'mail', label: 'Correo', on: on === 'correo' }] : []),
  ...(tiene(client, 'chat') ? [{ href: '/app/equipo', icon: 'users', label: 'Equipo', on: on === 'equipo' }] : []),
  ...(tiene(client, 'chat') ? [{ href: '/app/asistente', icon: 'brain', label: 'Pregúntale a tu panel', on: on === 'asistente' }] : []),
  ...(tiene(client, 'llamadas') ? [{ href: '/app/llamadas', icon: 'phone', label: 'Llamadas', on: on === 'llamadas' }] : []),
  ...(tiene(client, 'videollamadas') ? [{ href: '/app/videollamadas', icon: 'video', label: 'Videollamadas', on: on === 'videollamadas' }] : []),
  ...(client?._marcas?.length > 1 ? [{ href: '/app/marcas', icon: 'grid', label: `${client.nombre} · cambiar de marca`, on: on === 'marcas' }] : []),
  { href: '/app/reporte', icon: 'chart', label: 'Reporte del mes', on: on === 'reporte' },
  { href: '/app/pagos', icon: 'card', label: 'Pagos', on: on === 'pagos' },
  { href: '/app/cuenta', icon: 'key', label: 'Mi cuenta', on: on === 'cuenta' },
  { href: `${AYUDA}?text=${encodeURIComponent(`Hola, soy de ${client?.nombre || 'un cliente'} y necesito ayuda con mi panel`)}`, icon: 'help', label: 'Ayuda por WhatsApp', bottom: true },
  { href: '/salir', icon: 'out', label: 'Salir', bottom: true },
]);
const kpis = (items) => html`<div class="kpis">${items.map(([n, label, color, hot]) => html`<div class="kpi${hot ? ' hot' : ''}"><b>${n}</b><small><i style="background:${color}"></i>${label}</small></div>`)}</div>`;
const PCOL = { instagram: '#e1306c', facebook: '#4f7cff', linkedin: '#3d8bd9', tiktok: '#f2f4f8' };

export function loginPage(error, email = '') {
  return page({ title: 'Entrar', body: html`<div style="min-height:86vh;display:grid;place-items:center">
  <div class="kh" style="width:min(860px,100%);margin:0">
    <div class="kh-l" style="justify-content:center;padding:34px 30px">
      <div class="who"><span class="av">K</span><span class="mono">Kuper · Agentes</span></div>
      <h1>Tus agentes<br>de IA</h1><p class="sub">Entra con el correo y la contraseña que te dio Kuper.</p>
      ${error ? html`<div class="err" style="background:#fde8e8;color:#9b1c1c">${error}</div>` : ''}
      <form method="post" action="/entrar" style="margin-top:8px">
        <label style="color:#57534c">Correo</label>
        <input type="email" name="email" autocomplete="username" autofocus value="${email || ''}" placeholder="tu@correo.com" style="background:#fbfaf7;color:#1d1b18;border-color:#d9d4cb">
        <label style="color:#57534c">Contraseña</label>
        <input type="password" name="password" autocomplete="current-password" required style="background:#fbfaf7;color:#1d1b18;border-color:#d9d4cb">
        <p style="margin-top:16px"><button class="btn-accent" style="width:100%;justify-content:center">Entrar</button></p></form>
    </div>
    <div class="kh-r" style="min-height:420px;justify-content:flex-end"><div class="kh-note"><span class="mono">En línea</span><b>Publica, responde y agenda por ti.</b></div>
      <div class="kh-orb" style="width:340px;height:340px;right:-50px;bottom:-70px"><canvas class="k-orb" data-puntos="2200" aria-hidden="true"></canvas></div></div>
  </div></div>${heroCss()}${orbTag()}` });
}

export function codigoPage(error = '') {
  return page({ title: 'Código de verificación', body: html`<div style="min-height:86vh;display:grid;place-items:center">
  <div class="kh" style="width:min(560px,100%);margin:0;grid-template-columns:1fr"><div class="kh-l" style="padding:34px 30px">
    <div class="who"><span class="av">K</span><span class="mono">Verificación en dos pasos</span></div>
    <h1 style="font-size:36px">Escribe tu código</h1><p class="sub">Abre tu app de autenticación (Google Authenticator, Authy…) y escribe el código de 6 dígitos de Kuper.</p>
    ${error ? html`<div class="err" style="background:#fde8e8;color:#9b1c1c">${error}</div>` : ''}
    <form method="post" action="/entrar/codigo"><input name="codigo" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,7}" maxlength="7" required autofocus placeholder="123 456" style="background:#fbfaf7;color:#1d1b18;border-color:#d9d4cb;font-size:26px;letter-spacing:.3em;text-align:center">
      <p style="margin-top:16px"><button class="btn-accent" style="width:100%;justify-content:center">Entrar</button></p></form>
    <p class="sub small"><a href="/entrar" style="color:#57534c">Volver</a></p>
  </div></div></div>${heroCss()}` });
}

export function dashboardPage(clients, counts, pulso, billings = {}) {
  const mrr = clients.filter((c) => c.activo && !['cortesia', 'prueba'].includes(modoCobro(c))).reduce((n, c) => n + mensualidadTotal(c), 0);
  const fallidos = clients.filter((c) => billings[c.id]?.estado === 'pago_fallido');
  const body = html`${controlCenter(pulso, clients)}
  ${fallidos.length ? html`<div class="err">Pago rechazado: ${fallidos.map((c) => c.nombre).join(', ')}.</div>` : ''}
  <div class="row spread"><div><h2 style="margin:0">Marcas</h2><p class="muted small" style="margin:6px 0 0">Ingreso mensual de los planes: <b style="color:var(--ink)">${mxn(mrr)}</b></p></div><div class="row"><a class="btn btn-warn" href="/admin/usuarios">Usuarios</a><a class="btn btn-warn" href="/admin/clientes/nuevo">+ Nueva marca</a></div></div>
  <div class="grid" style="margin-top:16px">${clients.map((c) => html`<a class="card" href="/admin/clientes/${c.id}" style="text-decoration:none">
    <div class="row spread"><div class="row"><div class="avatar">${c.logo_path ? html`<img src="${mediaSrc(c.logo_path)}" alt="">` : c.nombre.slice(0, 1)}</div>
      <div><strong style="font-size:17px">${c.nombre}</strong><div class="muted small">${c.activo ? 'Activo' : 'En pausa'}${mensualidad(c) ? ` · ${mxn(mensualidadTotal(c))}/mes` : ''}</div></div></div>${c.activo ? (planDe(c).conceptos.length || modoCobro(c) !== 'stripe' ? (([t, col]) => html`<span class="badge" style="color:${col}">${t}</span>`)(estadoCobro(c, billings[c.id])) : '') : badge('rechazado')}</div>
    <div class="muted small" style="margin-top:10px">${Object.entries(SERVICIOS).filter(([k]) => planDe(c).servicios[k]).map(([, v]) => v.nombre).join(' · ')}</div>
    <div class="row" style="margin:16px 0 12px">${PLATFORMS.filter((p) => c.config[p]?.activo).map((p) => html`<span class="badge" style="color:${PCOL[p]}">${PLAT[p]}</span>`)}</div>
    <div class="row">${Object.entries(counts[c.id] || {}).map(([st, n]) => html`<span class="small muted">${badge(st)} ${n}</span>`)}</div></a>`)}
  </div>
  ${clients.length ? '' : html`<p class="muted">Todavía no hay clientes. <a href="/admin/clientes/nuevo">Crea el primero</a>.</p>`}`;
  return page({ title: 'Kuper · Centro de control', side: side('clientes'), body });
}

function planCard(client, billing) {
  const plan = planDe(client), est = estadoCobro(client, billing);
  return html`<form class="card" method="post" action="/admin/clientes/${client.id}/plan" style="margin-bottom:18px">
    <div class="row spread"><div><strong>Plan contratado y cobro</strong><p class="muted small" style="margin:4px 0 0">El cliente solo ve las secciones de los servicios que contrató.</p></div>
      <span class="badge" style="color:${est[1]}">${est[0]}${billing?.tarjeta ? ` · ${billing.tarjeta}` : ''}</span></div>
    <div style="display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));margin:14px 0">${Object.entries(SERVICIOS).map(([k, v]) => html`<label class="variant" style="margin:0;font-weight:400">
      <input type="checkbox" name="servicio_${k}" value="1" ${raw(plan.servicios[k] ? 'checked' : '')}> <strong>${v.nombre}</strong>${v.proximamente ? html` <span class="badge" style="color:#93b4ff">pronto</span>` : ''}<br><span class="muted small">${v.desc}</span></label>`)}</div>
    <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
      <div><label>Publicaciones por semana</label><input type="number" name="posts_semana" min="0" max="50" value="${plan.posts_semana}"></div>
      <div><label>Extras gratis al mes</label><input type="number" name="extra_gratis_mes" min="0" max="20" value="${plan.extra_gratis_mes}"></div>
      <div><label>Precio por extra (MXN)</label><input type="number" name="precio_extra" min="0" step="1" value="${plan.precio_extra}"></div>
    </div>
    <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
      <div><label>Cómo paga</label><select name="cobro">${Object.entries(COBROS).map(([k, l]) => html`<option value="${k}" ${raw(plan.cobro === k ? 'selected' : '')}>${l}</option>`)}</select></div>
      <div><label>Prueba gratis hasta (opcional)</label><input type="date" name="prueba_hasta" value="${plan.prueba_hasta || ''}"></div>
      <div><label>IVA</label><select name="iva">${Object.entries(IVAS).map(([k, l]) => html`<option value="${k}" ${raw(ivaDe(client) === k ? 'selected' : '')}>${l}</option>`)}</select></div>
    </div>
    <p class="muted small" style="margin:6px 0 0">Cortesía: no se le cobra nada y sus extras son gratis. Paga por fuera: ve su plan, pero no se le pide tarjeta y sus extras quedan "por cobrar". Durante la prueba todo es gratis; si domicilia en ese tiempo, el primer cobro llega al terminar la prueba.</p>
    <label>Conceptos a cobrar (uno por línea: Nombre | monto | mensual o único)</label>
    <textarea name="conceptos" style="min-height:96px" placeholder="Agente de IA WhatsApp | 499 | mensual&#10;Configuración inicial | 5499 | único">${conceptosTexto(plan)}</textarea>
    <p class="muted small">Mensualidad: ${raw(resumenIva(client, mensualidad(client)))}. Al domiciliar su tarjeta, el cliente paga lo único en el primer cobro y la mensualidad cada mes. Si cambias los montos después, la suscripción ya creada no cambia (se ajusta en Stripe).</p>
    <button class="btn-accent">Guardar plan</button>
  </form>
  ${fiscalAdmin(client)}`;
}
// "$1,000 + IVA = $1,160" / "$1,160 con IVA incluido (IVA $160)" / "$500 sin IVA"
function resumenIva(client, monto) {
  const modo = ivaDe(client), d = desglose(monto, modo);
  if (!monto) return '<b>$0</b>';
  if (modo === 'mas') return `<b>${mxn(d.subtotal)} + IVA ${mxn(d.iva)} = ${mxn(d.total)}</b>`;
  if (modo === 'exento') return `<b>${mxn(d.total)}</b> sin IVA`;
  return `<b>${mxn(d.total)}</b> con IVA incluido (subtotal ${mxn(d.subtotal)} + IVA ${mxn(d.iva)})`;
}
// Datos fiscales que capturó el cliente, para pasárselos al contador.
function fiscalAdmin(client) {
  // ¿Se le factura? (algunos clientes no requieren factura: el panel ni lo intenta)
  const requiere = !client.config?.sin_factura;
  const toggle = html`<form method="post" action="/admin/clientes/${client.id}/requiere-factura" style="margin-top:14px"><input type="hidden" name="requiere" value="${requiere ? '0' : '1'}">
    <span class="small">${requiere ? 'Se le factura cada cobro (si la facturación automática está encendida).' : 'Marcado como "No requiere factura": sus cobros no se facturan.'}</span>
    <button class="btn-warn" style="margin-left:8px">${requiere ? 'No requiere factura' : 'Sí requiere factura'}</button></form>`;
  if (!requiere) return toggle;
  return html`${toggle}${fiscalAdminDatos(client)}`;
}
function fiscalAdminDatos(client) {
  const f = fiscalDe(client);
  const rfcForm = html`<form method="post" action="/admin/clientes/${client.id}/rfc" class="row" style="gap:8px;margin-top:8px"><input name="rfc" maxlength="13" placeholder="RFC" value="${f?.rfc || ''}" style="max-width:200px;text-transform:uppercase"><button class="btn-warn">Guardar RFC</button></form>
    <p class="muted small" style="margin:4px 0 0">Si ya lo tienes dado de alta en Factura.com, con el RFC basta: se usan sus datos de allá.</p>`;
  if (!f || !f.razon_social) return html`<div class="card" style="margin-top:14px;padding:14px 16px"><span class="mono">Datos para factura</span>${f?.rfc ? html`<p class="small" style="margin:8px 0 0">RFC <b>${f.rfc}</b> (datos de Factura.com)</p>` : html`<p class="muted small" style="margin:8px 0 0">El cliente todavía no captura sus datos (los llena en su panel, en Pagos).</p>`}${rfcForm}</div>`;
  return html`<div class="card" style="margin-top:14px;padding:14px 16px"><span class="mono">Datos para factura</span>
    <p class="small" style="margin:8px 0 0;line-height:1.7"><b>${f.razon_social}</b><br>RFC ${f.rfc} · CP ${f.cp}<br>Régimen ${f.regimen} ${REGIMENES[f.regimen] || ''}<br>Uso CFDI ${f.uso} ${USOS_CFDI[f.uso] || ''}${f.correo ? html`<br>Enviar a ${f.correo}` : ''}</p></div>`;
}

const ORIGEN_COL = { instagram: '#e1306c', whatsapp: '#25d366', llamada: '#c9f53a', web: '#93b4ff', chat_web: '#fbbf24', facebook: '#4f7cff' };
const ORIGEN_TXT = { instagram: 'Instagram', whatsapp: 'WhatsApp', llamada: 'Llamada', web: 'Página de citas', facebook: 'Facebook', chat_web: 'Chat web' };
// "No es nuestra": campañas de otra empresa que mandan gente al WhatsApp de la marca.
function ajenasUI(client, base, urlLeads, campanaSel, verAjenas) {
  const lista = Array.isArray(client.config?.campanas_ajenas) ? client.config.campanas_ajenas : [];
  const sep = urlLeads.includes('?') ? '&' : '?';
  if (verAjenas) return html`<div class="card" style="margin-bottom:14px"><span class="mono">Campañas que no son tuyas</span>
      <p class="muted small" style="margin:6px 0 10px">Estos leads llegaron por anuncios de otra empresa. No cuentan en tus reportes y el agente les contesta que se equivocaron de número.</p>
      ${lista.map((a) => html`<form method="post" action="${base}/campana-ajena/quitar" style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:6px 0"><input type="hidden" name="campana" value="${a.etiqueta}"><span><b>${a.etiqueta}</b> <span class="muted small">desde ${String(a.desde || '').slice(0, 10)}</span></span><button class="btn-warn" style="padding:6px 12px;font-size:13px">Sí es nuestra</button></form>`)}
      <p style="margin:8px 0 0"><a href="${urlLeads}">← Volver a los leads</a></p></div>`;
  const marcar = campanaSel && campanaSel !== 'Orgánico' ? html`<div class="card" style="margin-bottom:14px"><b>¿Esta campaña no es tuya?</b>
      <form method="post" action="${base}/campana-ajena" style="display:grid;gap:8px;margin-top:8px"><input type="hidden" name="campana" value="${campanaSel}">
        <p class="muted small" style="margin:0">Si “${campanaSel}” es un anuncio de otra empresa, sus leads dejan de contar en el embudo, la analítica y los reportes. A quien llegue de ese anuncio, el agente le contesta una sola vez con este mensaje y no sigue la conversación.</p>
        <textarea name="mensaje" style="min-height:70px" maxlength="600">${CAMP.MENSAJE_AJENA}</textarea>
        <div><button class="btn-warn" onclick="return confirm('¿Marcar esta campaña como que no es tuya?')">No es nuestra</button></div></form></div>`
    : html`<p class="muted small" style="margin:0 0 10px">¿Llegan leads de una campaña que no es tuya? Da clic en esa campaña aquí abajo y márcala como “No es nuestra”.</p>`;
  return html`${marcar}${lista.length ? html`<p class="small" style="margin:0 0 10px"><a href="${urlLeads}${sep}ajenas=1">Ver campañas que no son tuyas (${lista.length})</a></p>` : ''}`;
}
export function leadsSection(client, leads, chats, base, { campanaSel = '', urlLeads = `${base}/leads`, verAjenas = false, aviso = '' } = {}) {
  // Campañas de Meta de las que llegaron los leads (con cuántos cada una), para filtrar y descargar.
  const conteo = {};
  for (const l of leads) { const c = etiquetaCampana(l); conteo[c] = (conteo[c] || 0) + 1; }
  const campanas = Object.entries(conteo).sort((a, b) => (a[0] === 'Orgánico') - (b[0] === 'Orgánico') || b[1] - a[1]);
  const sep = urlLeads.includes('?') ? '&' : '?';
  if (campanaSel) leads = leads.filter((l) => etiquetaCampana(l) === campanaSel);
  return html`${aviso ? html`<div class="okmsg">${aviso}</div>` : ''}${ajenasUI(client, base, urlLeads, campanaSel, verAjenas)}<div class="row spread" style="flex-wrap:wrap;gap:10px;margin-bottom:12px">
    <div class="pills" style="margin:0">${campanas.length > 1 || campanaSel ? html`<a class="${campanaSel ? '' : 'on'}" href="${urlLeads}">Todas <em>${Object.values(conteo).reduce((a, b) => a + b, 0)}</em></a>${campanas.map(([c, n]) => html`<a class="${c === campanaSel ? 'on' : ''}" href="${urlLeads}${sep}campana=${encodeURIComponent(c)}">${c} <em>${n}</em></a>`)}` : ''}</div>
    ${leads.length ? html`<a class="btn btn-warn" href="${base}/leads.csv${campanaSel ? `?campana=${encodeURIComponent(campanaSel)}` : ''}">Descargar CSV</a>` : ''}
  </div>
  ${kpis(Object.entries(LEAD_ESTADOS).map(([k, l], i) => [leads.filter((x) => x.estado === k).length, l, ['#93b4ff', '#fbbf24', '#c6ff3d', '#4ade80', '#f87171'][i], k === 'nuevo' && leads.some((x) => x.estado === 'nuevo')]))}
  ${leads.length ? html`<div class="card" style="padding:8px 14px;overflow-x:auto"><table>
    <tr><th class="small muted">Contacto</th><th class="small muted">Origen</th><th class="small muted">Campaña</th><th class="small muted">Nota</th><th class="small muted">Cita</th><th class="small muted">Actualizado</th><th class="small muted">Estado</th></tr>
    ${leads.map((l) => html`<tr><td><strong>${l.nombre || (l.usuario ? '@' + l.usuario : l.telefono || l.email)}</strong><div class="muted small">${[l.telefono, l.usuario && l.nombre ? '@' + l.usuario : '', l.email].filter(Boolean).join(' · ')}</div>${chats[l.id] ? html`<a class="small" href="${base}/leads/${l.id}/chat" style="color:var(--accent)">Ver chat (${chats[l.id]})</a>` : ''}${l.control === 'humano' ? html` <span class="badge" style="color:#93b4ff">Atiende una persona</span>` : ''}</td>
      <td><span class="badge" style="color:${ORIGEN_COL[l.origen] || '#93b4ff'}">${ORIGEN_TXT[l.origen] || l.origen}</span></td>
      <td class="small">${etiquetaCampana(l) === 'Orgánico' ? html`<span class="muted">Orgánico</span>` : html`<b>${etiquetaCampana(l)}</b>${l.campana && l.anuncio ? html`<div class="muted">${l.conjunto ? `${l.conjunto} · ` : ''}${l.anuncio}</div>` : ''}`}</td>
      <td class="small">${l.nota || ''}</td><td class="small">${l.cita_inicio ? fmtDate(l.cita_inicio) : '—'}</td><td class="small muted">${fmtDate(l.updated_at.replace(' ', 'T') + 'Z')}</td>
      <td><form method="post" action="${base}/leads/${l.id}"><select name="estado" onchange="this.form.submit()" style="padding:6px 10px;width:auto">${Object.entries(LEAD_ESTADOS).map(([k, lab]) => html`<option value="${k}" ${raw(k === l.estado ? 'selected' : '')}>${lab}</option>`)}</select></form></td></tr>`)}
  </table></div>` : html`<div class="card muted">Todavía no hay leads. Llegan solos cuando alguien comenta la palabra clave en Instagram, le escribe al agente de WhatsApp o habla con el agente de llamadas.</div>`}`;
}

export function citasSection({ citas, citasError, agendaCfg, saEmail, admin = false, todo = false, url = '' }) {
  // Por defecto solo las citas del agente o de la página de citas; "Todo el calendario" muestra también los demás eventos.
  const delAgente = (citas || []).filter((e) => e.extendedProperties?.private?.kuper);
  const lista = todo ? citas : delAgente;
  const sep = url.includes('?') ? '&' : '?';
  return html`${citasError ? html`<div class="err">${citasError}</div>` : ''}
  ${agendaCfg && !agendaCfg.calendar_id ? (!admin ? html`<div class="card muted">La agenda todavía no está conectada. Kuper la activa por ti.</div>` : html`<div class="card"><strong>Conecta Google Calendar</strong><p class="muted small">1. Crea una cuenta de servicio en Google Cloud (Calendar API activada) y guarda su JSON en el servidor.<br>2. En Google Calendar, comparte tu calendario con ${saEmail ? html`<strong>${saEmail}</strong>` : 'el correo de la cuenta de servicio'} con permiso "Hacer cambios en eventos".<br>3. En Configuración agrega <code>"agenda": { "calendar_id": "tu-correo@gmail.com" }</code>.</p></div>`) : ''}
  ${citas ? html`<p class="muted small">Reglas: citas de ${agendaCfg.duracion_min} min, ${agendaCfg.margen_min} min de margen, con ${agendaCfg.anticipacion_horas} h de anticipación · ${Object.entries(agendaCfg.horario).map(([d, h]) => `${d} ${h[0]}–${h[1]}`).join(', ')}${agendaCfg.ultima_cita ? ` · última cita a las ${agendaCfg.ultima_cita}` : ''}.</p>
    ${url ? html`<div class="pills"><a class="${todo ? '' : 'on'}" href="${url}">Del agente <em>${delAgente.length}</em></a><a class="${todo ? 'on' : ''}" href="${url}${sep}todo=1">Todo el calendario <em>${citas.length}</em></a></div>` : ''}
    ${lista.length ? html`<div class="grid">${lista.map((e) => html`<div class="card"><div class="row spread"><strong>${e.summary || 'Cita'}</strong>${e.extendedProperties?.private?.kuper ? html`<span class="badge" style="color:#25d366">Agente</span>` : html`<span class="badge">Manual</span>`}</div>
      <p style="font-size:20px;margin:10px 0 4px">${fmtDate(e.start?.dateTime || e.start?.date)}</p>${e.repeticiones?.length ? html`<p class="muted small" style="margin:0 0 6px">Se repite · ${e.repeticiones.length} más: ${e.repeticiones.slice(0, 3).map((d) => fmtDate(d)).join(', ')}${e.repeticiones.length > 3 ? '…' : ''}</p>` : ''}<p class="muted small" style="white-space:pre-wrap;margin:0">${e.description || ''}</p></div>`)}</div>` : html`<div class="card muted">${todo ? 'No hay eventos próximos en el calendario.' : 'Todavía no hay citas agendadas por el agente. Las demás reuniones del calendario se respetan: el agente nunca ofrece esos horarios.'}</div>`}` : ''}`;
}

export function clientFormPage(client, { error, notice, tab = 'posts', filtro = '', red = '', leads = [], chats = {}, llamadas = [], llamadasMes = null, prospectos = [], ventasActivo = false, placesListo = false, leadsCount = 0, billing = null, citas = null, todo = false, citasError = '', agendaCfg = null, saEmail = null, competitors = [], report, posts = [], creds = {}, keywordReplies = [], blog = null, campanaSel = '', verAjenas = false, aviso = '' } = {}) {
  const isNew = !client;
  const action = isNew ? '/admin/clientes/nuevo' : `/admin/clientes/${client.id}`;
  const portal = client ? `${config.publicBaseUrl}/p/${client.portal_token}` : '';
  const meta = creds.meta || {}, li = creds.linkedin || {};
  const set = (v) => (v ? `guardado: ${String(v).slice(0, 3)}…${String(v).slice(-4)} (${String(v).length} caracteres)` : '');
  const FILTROS = [['revisar', 'Por revisar', ['pendiente', 'necesita_asset', 'cambios_solicitados', 'generando']], ['programados', 'Programados', ['aprobado', 'publicando']],
    ['publicados', 'Publicados', ['publicado']], ['descartados', 'Con error / descartados', ['error', 'error_generacion', 'rechazado']]];
  const deRed = red ? posts.filter((p) => p.plataforma === red) : posts;
  const count = (sts) => deRed.filter((p) => sts.includes(p.status)).length;
  const fSel = FILTROS.find((f) => f[0] === filtro) || FILTROS.find((f) => count(f[2])) || FILTROS[0];
  const shown = deRed.filter((p) => fSel[2].includes(p.status)).slice(0, 60);
  const url = (q) => `/admin/clientes/${client?.id}?${new URLSearchParams(Object.entries({ tab, f: fSel[0], red, ...q }).filter(([, v]) => v)).toString()}`;
  const TABS = [['posts', 'Posts'], ['leads', 'Leads'], ['embudo', 'Embudo'], ['analitica', 'Analítica'], ['agente', 'Agente'], ['citas', 'Citas'], ['llamadas', 'Llamadas'], ['ventas', 'Ventas'], ['blog', 'Blog'], ['competencia', 'Competencia'], ['palabra', `Palabra clave`], ['comentarios', 'Comentarios'], ['difusion', 'Campañas WA'], ['cupones', 'Cupones'], ['cobros', 'Cobros'], ['correo', 'Correo'], ['equipo', 'Equipo'], ['reporte', 'Reporte'], ['config', 'Configuración']].filter(([k]) => isNew || tabActiva(client, k) || (k === 'blog' && tab === 'blog'));
  const t = isNew ? 'config' : TABS.some(([k]) => k === tab) ? tab : TABS[0][0];
  const body = html`
  ${isNew ? hero({ kicker: 'Nueva marca', title: 'Nuevo cliente', sub: 'Pon el nombre y los servicios que contrató. Lo demás (precios, forma de pago, redes) se ajusta después.' }) : hero({
    kicker: client.activo ? 'Agente activo' : 'Agente en pausa', title: client.nombre,
    sub: `Publica en ${PLATFORMS.filter((p) => client.config[p]?.activo).map((p) => PLAT[p]).join(', ') || 'ninguna red todavía'}`,
    avatar: client.logo_path ? `<img src="${esc(mediaSrc(client.logo_path))}" alt="">` : null,
    stats: [
      [posts.filter((p) => ['pendiente', 'necesita_asset', 'cambios_solicitados'].includes(p.status)).length, 'Por revisar', '#fbbf24', `/admin/clientes/${client.id}?tab=posts&f=revisar`, posts.some((p) => ['pendiente', 'necesita_asset'].includes(p.status))],
      [posts.filter((p) => ['aprobado', 'publicando'].includes(p.status)).length, 'Programados', '#4ade80', `/admin/clientes/${client.id}?tab=posts&f=programados`],
      [posts.filter((p) => p.status === 'publicado').length, 'Publicados', '#c9f53a', `/admin/clientes/${client.id}?tab=posts&f=publicados`],
      [leadsCount, 'Leads', '#93b4ff', `/admin/clientes/${client.id}?tab=leads`],
    ],
    tabs: TABS.map(([k, l]) => [k === 'agente' || k === 'embudo' || k === 'analitica' || k === 'comentarios' || k === 'difusion' || k === 'cupones' || k === 'cobros' || k === 'correo' || k === 'equipo' ? `/admin/clientes/${client.id}/${k}` : k === 'blog' ? `/admin/clientes/${client.id}/blog` : `/admin/clientes/${client.id}?tab=${k}`, l, k === t]),
    note: (() => {
      const next = posts.filter((p) => ['aprobado', 'publicando'].includes(p.status) && p.scheduled_at).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
      return next ? ['Próxima publicación', `${PLAT[next.plataforma]} · ${fmtDate(next.scheduled_at)}`] : ['Próxima publicación', 'Nada programado todavía'];
    })(),
  })}
  ${error ? html`<div class="err">${error}</div>` : ''}
  ${notice ? html`<div class="okmsg">${notice}</div>` : ''}

  ${!isNew && t === 'posts' ? html`
  <h2 style="margin-top:24px">Generar ahora</h2>
  <form method="post" action="/admin/clientes/${client.id}/generar" class="row" style="align-items:flex-end;flex-wrap:wrap;gap:10px">
    <div style="flex:1;min-width:240px"><label>Tema (opcional)</label><input name="tema" maxlength="400" placeholder="Ej. promoción de diciembre, nuevo servicio…"></div>
    ${PLATFORMS.filter((p) => client.config[p]?.activo && !reusa(client, p)).map((p) => html`<button class="btn-accent" name="plataforma" value="${p}">Post para ${PLAT[p]}</button>`)}</form>
  ${temasCard(client, `/admin/clientes/${client.id}/temas`)}
  <div class="pills">${FILTROS.map(([k, l, sts]) => html`<a class="${k === fSel[0] ? 'on' : ''}" href="${url({ f: k })}">${l} <em>${count(sts)}</em></a>`)}
    <span style="flex:1"></span>
    <a class="${!red ? 'on' : ''}" href="${url({ red: '' })}">Todas</a>${PLATFORMS.filter((p) => client.config[p]?.activo).map((p) => html`<a class="${red === p ? 'on' : ''}" href="${url({ red: p })}"><i style="width:8px;height:8px;border-radius:50%;background:${PCOL[p]}"></i>${PLAT[p]}</a>`)}</div>
  ${fSel[0] === 'descartados' && shown.length ? html`<form method="post" action="/admin/clientes/${client.id}/limpiar" onsubmit="return confirm('¿Eliminar todos los posts con error o rechazados? No se puede deshacer.')" style="margin-bottom:14px"><button class="btn-bad">Eliminar todos (${shown.length})</button></form>` : ''}
  ${shown.length ? html`<div class="grid">${shown.map((p) => postCard(p, { base: `/admin/posts/${p.id}`, admin: true }))}</div>` : html`<div class="card muted">No hay posts en "${fSel[1]}".</div>`}
  ` : ''}

  ${!isNew && t === 'leads' ? leadsSection(client, leads, chats, `/admin/clientes/${client.id}`, { campanaSel, urlLeads: `/admin/clientes/${client.id}?tab=leads`, verAjenas, aviso }) : ''}

  ${!isNew && t === 'ventas' ? ventasSection(client, prospectos, { activo: ventasActivo, placesListo }) : ''}

  ${!isNew && t === 'llamadas' ? llamadasSection(llamadas, llamadasMes, { admin: true }) : ''}
  ${!isNew && t === 'blog' && blog ? blogSection(client, blog) : ''}

  ${!isNew && t === 'citas' ? citasSection({ citas, citasError, agendaCfg, saEmail, admin: true, todo, url: `/admin/clientes/${client.id}?tab=citas` }) : ''}

  ${!isNew && t === 'competencia' ? html`<div style="margin-top:24px"></div>
  <div class="split"><div class="card">
    <table>${competitors.map((c) => html`<tr><td>@${c.handle}<br><span class="muted small">${c.notas}</span></td><td style="text-align:right">
      <form method="post" action="/admin/clientes/${client.id}/competencia/${c.id}/borrar" class="inline"><button class="btn-bad">Quitar</button></form></td></tr>`)}</table>
    <form method="post" action="/admin/clientes/${client.id}/competencia"><label>Cuenta de Instagram (Business/Creator)</label><input name="handle" placeholder="@competidor" required>
      <label>Notas (opcional)</label><input name="notas" placeholder="Qué te interesa de esta cuenta"><p><button class="btn-warn">Agregar</button></p></form>
    ${competitors.length ? html`<form method="post" action="/admin/clientes/${client.id}/analizar"><button class="btn-accent">Analizar competencia ahora</button></form>` : ''}
  </div><div class="card">${report ? html`<strong>Último análisis</strong> <span class="muted small">${fmtDate(report.created_at.replace(' ', 'T') + 'Z')}</span>
    <p>${report.data.resumen}</p>
    ${[['Huecos de oportunidad', 'huecos_oportunidad'], ['Temas frecuentes', 'temas_frecuentes'], ['Formatos que funcionan', 'formatos_que_funcionan'], ['Ganchos efectivos', 'ganchos_efectivos']].map(([t, k]) => html`<p><strong>${t}</strong></p><ul>${(report.data[k] || []).map((x) => html`<li>${x}</li>`)}</ul>`)}
    <p><strong>Frecuencia:</strong> ${report.data.frecuencia_publicacion}</p>
    ${(report.data.posts_destacados || []).length ? html`<p><strong>Posts destacados</strong></p><ul>${report.data.posts_destacados.map((d) => html`<li><a href="${d.permalink}" target="_blank" rel="noopener">@${d.competidor}</a> (${d.engagement}): ${d.por_que_funciono}</li>`)}</ul>` : ''}
    ${(report.data.advertencias || []).length ? html`<div class="warn">${report.data.advertencias.map((w) => html`<div>• ${w}</div>`)}</div>` : ''}` : html`<p class="muted">Aún no hay análisis.</p>`}</div></div>
  ` : ''}

  ${!isNew && t === 'palabra' ? html`<div style="margin-top:24px"></div>
  ${client.config.respuesta_palabra_clave?.activo ? html`<h2>Palabra clave ${client.config.respuesta_palabra_clave.palabra}</h2>
  <div class="card"><p class="muted small">Quien comenta ${client.config.respuesta_palabra_clave.palabra} en Instagram recibe un DM automático. Se configura en "respuesta_palabra_clave" de la configuración.</p>
    <table>${keywordReplies.map((r) => html`<tr><td class="muted small">${fmtDate(r.created_at.replace(' ', 'T') + 'Z')}</td><td>@${r.username}</td><td class="small">${r.texto}</td><td>${{ enviado: 'DM enviado', simulado: 'Simulado', error: 'Error', omitido_inicial: 'Anterior a la activación', muy_viejo: 'Más de 7 días' }[r.status] || r.status}${r.error ? html`<br><span class="small" style="color:var(--bad)">${r.error}</span>` : ''}</td></tr>`)}</table>
    ${keywordReplies.length ? '' : html`<p class="muted small">Todavía nadie ha comentado la palabra.</p>`}</div>` : html`<div class="card muted">La respuesta automática a una palabra clave está apagada. Se activa con "respuesta_palabra_clave" en la configuración.</div>`}
  ` : ''}

  ${t === 'config' ? html`${!isNew ? html`<div style="margin-top:24px"></div>
  ${planCard(client, billing)}
  <div class="card" style="margin-bottom:18px"><div class="row spread"><div><strong>Acceso del cliente</strong><p class="muted small" style="margin:4px 0 0">Usuarios con su propio correo y contraseña: ven su resumen, aprueban publicaciones y ven sus leads y citas.</p></div>
    <div class="row"><a class="btn btn-warn" href="/app?c=${client.id}">Ver como el cliente</a><a class="btn btn-accent" href="/admin/usuarios?c=${client.id}">Usuarios de ${client.nombre}</a></div></div></div>
  <div class="card"><div class="row spread"><div><strong>Portal de aprobación del cliente</strong><br><a class="small" href="${portal}" target="_blank">${portal}</a></div>
    <form method="post" action="/admin/clientes/${client.id}/rotar-token" onsubmit="return confirm('El enlace anterior dejará de funcionar. ¿Continuar?')"><button class="btn-warn">Nuevo enlace</button></form></div>
    <p class="muted small">Aviso de posts por revisar: ${client.config.notificaciones?.email ? `correo a ${client.config.notificaciones.email}, uno al día como máximo` : 'sin correo (pon "notificaciones": { "email": "…" } en la configuración)'}${client.config.notificaciones?.whatsapp ? ' · pidió WhatsApp (aún no conectado)' : ''}.</p>
    <form method="post" action="/admin/clientes/${client.id}/aviso-prueba" class="row" style="margin-top:6px"><input name="to" type="email" placeholder="${client.config.notificaciones?.email || 'correo para la prueba'}" style="max-width:320px"><button class="btn-warn">Mandar correo de prueba</button></form></div>
  <div class="card" style="margin-top:18px"><strong>Conexión con tu agente de WhatsApp</strong>
    <p class="muted small">Tu agente de WhatsApp usa esta llave para consultar horarios libres, agendar citas en Google Calendar y registrar leads en este panel.</p>
    <p class="small">Llave: ${creds.api_key ? html`<details style="display:inline-block"><summary class="small">Mostrar</summary><code style="user-select:all">${creds.api_key}</code></details>` : html`<span class="muted">sin generar</span>`}<br>
    API: <code>${config.publicBaseUrl}/api/${client.slug}/disponibilidad</code> · <code>/citas</code> · <code>/leads</code></p>
    <form method="post" action="/admin/clientes/${client.id}/llave-api" onsubmit="return ${creds.api_key ? "confirm('La llave anterior dejará de funcionar. ¿Continuar?')" : 'true'}"><button class="btn-warn">${creds.api_key ? 'Generar llave nueva' : 'Generar llave'}</button></form>
    <form method="post" action="/admin/clientes/${client.id}/agente-url" style="margin-top:14px"><label>URL del agente (para responder y tomar el control desde el panel)</label>
      <div class="row"><input name="agente_url" type="url" value="${creds.agente_url || ''}" placeholder="https://agente.kuper.mx" style="max-width:420px"><button class="btn-warn">Guardar URL</button></div>
      <p class="muted small" style="margin:6px 0 0">${creds.agente_url ? 'Conectado: en Leads → Ver chat puedes responder a mano.' : 'Es el dominio donde corre el agente de WhatsApp de esta marca.'}</p></form></div>
  <h2>Logo</h2>
  <form method="post" action="/admin/clientes/${client.id}/logo" enctype="multipart/form-data" class="card row">
    ${client.logo_path ? html`<img src="/media/${path.basename(client.logo_path)}" style="height:48px">` : ''}
    <input type="file" name="archivo" accept="image/png,image/jpeg" required style="width:auto"><button class="btn-warn">Subir logo</button>
    <span class="muted small">PNG con fondo transparente. Lo usa el animador en cierres y esquinas.</span></form>
  <h2>Mascota</h2>
  <form method="post" action="/admin/clientes/${client.id}/mascota" enctype="multipart/form-data" class="card row">
    ${client.config?.mascota_path ? html`<img src="/media/${path.basename(client.config.mascota_path)}" style="height:64px">` : ''}
    <input type="file" name="archivo" accept="image/png,image/webp" required style="width:auto"><button class="btn-warn">Subir mascota</button>
    ${client.config?.mascota_path ? html`<button class="btn-warn" name="quitar" value="1" formnovalidate>Quitar</button>` : ''}
    <span class="muted small">PNG con fondo transparente. Sale como protagonista más o menos en 1 de cada 3 piezas.</span></form>
  <h2>Paletas de color</h2>
  <form method="post" action="/admin/clientes/${client.id}/paletas" class="card">
    <textarea name="paletas" rows="5" style="font-family:ui-monospace,monospace;font-size:13px" placeholder="azul: #03070D #0B1E46 #3F79E2 #6FA8FF #EAF2FF&#10;morado: #0D0718 #2A1450 #7C4DFF #9B6DFF #F1EBFF&#10;claro: fondo=#F5F1EA #1B1B1B #7C4DFF #B6DF4B">${(client.perfil?.paletas || []).map((p) => `${p.nombre}: ${p.fondo ? `fondo=${p.fondo} ` : ''}${(p.colores || []).join(' ')}`).join('\n')}</textarea>
    <p class="muted small">Una paleta por línea: <code>nombre: colores</code>. Cada pieza usa una distinta (rotan), para que el feed no sea de un solo color. <code>fondo=#…</code> fija el fondo (para piezas en claro). Vacío = solo los colores de la marca.</p>
    <button class="btn-warn">Guardar paletas</button></form>
  <h2>Temas vetados</h2>
  <form method="post" action="/admin/clientes/${client.id}/vetados" class="card">
    <textarea name="vetados" rows="4" placeholder="23:47&#10;contestar tarde&#10;mensaje de noche">${(client.perfil?.temas_vetados || []).join('\n')}</textarea>
    <p class="muted small">Uno por línea. Si un post trae esas palabras (en el tema, los textos o el caption), se rechaza y la IA escribe otro. Úsalo para cortar temas repetidos.</p>
    <button class="btn-warn">Guardar temas vetados</button></form>
` : ''}
  <h2>Configuración</h2>
  <form method="post" action="${action}" class="card">
    <label>Nombre</label><input name="nombre" value="${client?.nombre || ''}" required placeholder="Buen Sabor" ${raw(isNew ? `oninput="if(!this.form.slug.dataset.touched)this.form.slug.value=this.value.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')"` : '')}>
    ${isNew ? html`<label>Identificador (sin espacios, va en los links)</label><input name="slug" pattern="[a-z0-9-]+" required placeholder="buen-sabor" oninput="this.dataset.touched=1">
    <label>Servicios que contrató</label>
    <div style="display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">${Object.entries(SERVICIOS).map(([k, v]) => html`<label class="variant" style="margin:0;font-weight:400"><input type="checkbox" name="servicio_${k}" value="1" ${raw(k === 'chat' ? 'checked' : '')}> <strong>${v.nombre}</strong><br><span class="muted small">${v.desc}</span></label>`)}</div>
    <p class="muted small">Precios, forma de pago y prueba gratis se ajustan después en "Plan contratado y cobro".</p>
    <details style="margin-top:12px"><summary>Avanzado: perfil de marca y redes (solo si contrató redes sociales)</summary>` : ''}
    <label>Perfil de marca (JSON — sección 2 del prompt maestro). tipografia: ${Object.keys(FONTS).join(' o ')}</label>
    <textarea class="code" name="perfil">${JSON.stringify(client?.perfil || DEFAULT_PERFIL, null, 2)}</textarea>
    <label>Redes y frecuencia (JSON). modo_publicacion: auto | aprobacion · frecuencia: diario, 3_por_semana, 2_por_semana, semanal, quincenal, mensual</label>
    <textarea class="code" name="config" style="min-height:180px">${JSON.stringify(client?.config || DEFAULT_CONFIG, null, 2)}</textarea>
    ${isNew ? raw('</details>') : ''}
    <h2>Credenciales</h2><p class="muted small">Se guardan cifradas. Deja un campo vacío para conservar el valor actual.</p>
    <div class="split"><div>
      <strong>Meta (Instagram + Facebook)</strong>
      <label>ID de la Página de Facebook</label><input name="meta_page_id" value="${meta.page_id || ''}">
      <label>ID de la cuenta de Instagram Business</label><input name="meta_ig_user_id" value="${meta.ig_user_id || ''}">
      <label>Token de acceso de la Página</label><input name="meta_page_token" type="text" placeholder="${set(meta.page_token)}" autocomplete="off" spellcheck="false" data-lpignore="true">
      <label>Token de anuncios (opcional, permiso ads_read: para ver el nombre de la campaña en Leads)</label><input name="meta_ads_token" type="text" placeholder="${set(meta.ads_token)}" autocomplete="off" spellcheck="false" data-lpignore="true">
    </div><div>
      <strong>LinkedIn (Página de empresa)</strong>
      <label>ID de la organización</label><input name="li_org_id" value="${li.org_id || ''}" placeholder="12345678">
      <label>Access token (w_organization_social)</label><input name="li_access_token" type="text" placeholder="${set(li.access_token)}" autocomplete="off" spellcheck="false" data-lpignore="true">
      ${!isNew ? html`<p style="margin-top:16px"><strong>TikTok</strong><br><span class="muted small">${creds.tiktok?.access_token ? `Conectado (renovación automática hasta ${fmtDate(creds.tiktok.refresh_expires_at)})` : 'Sin conectar'}</span><br>
        ${creds.tiktok?.access_token
          ? html`<button class="btn-bad" formaction="/admin/clientes/${client.id}/tiktok/desconectar" formnovalidate onclick="return confirm('¿Desconectar TikTok?')">Desconectar TikTok</button>`
          : html`<a class="small" href="/admin/clientes/${client.id}/tiktok/conectar">Conectar TikTok</a>`}</p>` : ''}
      <label style="font-weight:400"><input type="checkbox" name="dry_run" value="1" style="width:auto" ${raw(creds.dry_run ? 'checked' : '')}> Modo simulación (no publica de verdad)</label>
    </div></div>
    ${!isNew ? html`<label style="font-weight:400"><input type="checkbox" name="activo" value="1" style="width:auto" ${raw(client.activo ? 'checked' : '')}> Cliente activo (el agente genera y publica)</label>` : ''}
    <p><button>${isNew ? 'Crear cliente' : 'Guardar'}</button></p>
  </form>
  ${!isNew ? html`<form method="post" action="/admin/clientes/${client.id}/probar"><button class="btn-accent">Probar conexión con Meta y LinkedIn</button></form>` : ''}
  ` : ''}`;
  return page({ title: isNew ? 'Nuevo cliente' : client.nombre, side: side(isNew ? 'nuevo' : 'clientes'), body });
}

// Actualiza la página solo cuando algo cambió (antes se recargaba entera cada pocos segundos y parpadeaba).
// Pide la misma página en segundo plano y compara una "firma" del estado.
const firmaPosts = (posts) => posts.map((p) => `${p.id}:${p.status}`).join(',');
function vigilar(firma) {
  const f = JSON.stringify(String(firma));
  return raw(`<span data-firma="${esc(String(firma))}" hidden></span><script>(()=>{const F=${f.replace(/</g, '\\u003c')};let n=0;const t=setInterval(async()=>{if(++n>120)return clearInterval(t);try{const r=await fetch(location.href,{credentials:'same-origin'});const m=(await r.text()).match(/data-firma="([^"]*)"/);const v=m?m[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'"):'';if(v!==F)location.reload()}catch(e){}},10000)})()</script>`);
}
// Estado de la historia de Instagram de un post publicado, con botón para subirla o reintentar.
function historiaCard(post, events) {
  if (post.status === 'error' && /interrumpi/i.test(post.error || '')) {
    return html`<div class="card" style="margin-bottom:14px"><strong>Se interrumpió mientras publicaba.</strong>
      <p class="muted small" style="margin:6px 0 10px">Revisa en ${post.plataforma === 'facebook' ? 'Facebook' : 'Instagram'} si ya salió. Si sí, márcalo como publicado (así no se duplica y puedes subir la historia). Si no salió, usa "Publicar".</p>
      <form method="post" action="/admin/posts/${post.id}/marcar-publicado" class="inline"><button class="btn-accent">Ya salió: marcar como publicado</button></form></div>`;
  }
  if (post.plataforma !== 'instagram' || post.status !== 'publicado') return '';
  const ult = events.find((e) => ['historia_publicada', 'historia_error', 'historia_subiendo'].includes(e.tipo));
  const subiendo = ult?.tipo === 'historia_subiendo' && Date.now() - new Date(ult.created_at.replace(' ', 'T') + 'Z') < 10 * 60_000;
  const texto = !ult ? 'Este post todavía no se subió a historias.' : ult.tipo === 'historia_publicada' ? 'Ya está en historias.'
    : subiendo ? 'Subiendo a historias… Instagram puede tardar unos minutos.' : ult.tipo === 'historia_error' ? `No se pudo subir a historias: ${ult.detalle}` : 'La subida a historias se interrumpió.';
  return html`<div class="card row spread" style="margin-bottom:14px"><span>${texto}</span>${subiendo ? vigilar(`${post.status}|${events[0]?.id}`)
    : ult?.tipo === 'historia_publicada' ? '' : html`<form method="post" action="/admin/posts/${post.id}/historia" class="inline"><button class="btn-accent">${ult ? 'Reintentar historia' : 'Subir a historia'}</button></form>`}</div>`;
}
export function postAdminPage(post, client, events) {
  const body = html`<p><a href="/admin/clientes/${client.id}">← ${client.nombre}</a></p>
  ${historiaCard(post, events)}
  ${post.status === 'publicando' ? html`<div class="okmsg">Publicando… Instagram puede tardar unos minutos en procesar el video. Esta página se actualiza sola.</div>${vigilar(`${post.status}|${events[0]?.id}`)}` : ''}
  <div class="split"><div>${postCard(post, { base: `/admin/posts/${post.id}`, admin: true })}</div>
  <div><div class="card"><strong>Bitácora</strong><table>${events.map((e) => html`<tr><td class="muted small">${fmtDate(e.created_at.replace(' ', 'T') + 'Z')}</td><td>${e.tipo}</td><td class="small">${e.detalle}</td></tr>`)}</table></div>
  ${post.salida?.visual?.codigo ? html`<details class="card" style="margin-top:16px"><summary>Animador: ${post.salida.visual.respaldo ? 'diseño de respaldo' : `${post.salida.visual.rondas} rondas`}</summary>
    <p><strong>Concepto:</strong> ${post.salida.visual.concepto}</p><pre class="small" style="white-space:pre-wrap;max-height:420px;overflow:auto">${post.salida.visual.codigo}</pre></details>` : ''}
  ${post.salida ? html`<details class="card" style="margin-top:16px"><summary>Salida completa del agente (JSON)</summary><pre class="small" style="white-space:pre-wrap">${JSON.stringify({ ...post.salida, visual: undefined }, null, 2)}</pre></details>` : ''}
  ${post.feedback ? html`<div class="card" style="margin-top:16px"><strong>Comentarios del cliente</strong><p>${post.feedback}</p></div>` : ''}</div></div>`;
  return page({ title: `Post ${post.id}`, side: side('clientes'), body });
}

export const DEFAULT_PERFIL = {
  cliente: 'Nombre del cliente',
  giro: '',
  idioma: 'es-MX',
  tono_de_voz: '',
  buyer_persona: '',
  pilares_de_contenido: [
    { nombre: 'tips del sector', requiere_imagen_real: false },
    { nombre: 'casos de éxito / portafolio', requiere_imagen_real: true },
    { nombre: 'blog del sitio web', requiere_imagen_real: false, requiere_fuente_real: true, activo: false },
  ],
  colores_marca: ['#02040A', '#0B1E46', '#1F6BFF', '#6FA8FF', '#EAF2FF'],
  voz: 'Pega aquí el perfil de voz (formato de .claude/instagram/voice.md): quién soy, cómo sueno, palabras que sí uso y que nunca diría, posturas, fuera de límites, pruebas que puedo usar, CTA.',
  tipografia: { titulos: 'Inter Tight', texto: 'Inter Tight' },
  estilo_visual: 'Describe el estilo: fondos, luz, efectos, formas, cómo se usa el logo…',
  palabra_clave_cta: 'INFO',
  terminos_busqueda: [],
  palabras_prohibidas: [],
  max_emojis: 1,
  imagenes_ia: false,
  blog_posts: [],
  permite_emojis: false,
  temas_prohibidos: ['política', 'religión'],
  cta_preferido: 'Escríbenos',
  ejemplos_de_posts_que_funcionaron: [],
};

export const DEFAULT_CONFIG = {
  instagram: { activo: true, frecuencia: 'semanal', modo_publicacion: 'aprobacion', hora: '10:00', formatos: ['video_animado', 'carrusel', 'imagen_estatica'] },
  facebook: { activo: true, frecuencia: 'semanal', modo_publicacion: 'aprobacion', hora: '11:00' },
  linkedin: { activo: false, frecuencia: 'quincenal', modo_publicacion: 'aprobacion', hora: '09:00' },
  // TikTok publica los mismos Reels de Instagram con su propio texto. Conéctalo con el botón "Conectar TikTok".
  tiktok: { activo: false, modo_publicacion: 'aprobacion', privacidad: 'PUBLIC_TO_EVERYONE' },
  // Aviso de posts por revisar: un correo al día con el link al portal. WhatsApp solo si el cliente lo pide.
  notificaciones: { email: '', whatsapp: false },
};

// ------------------------------------------------------------ página pública para agendar cita
const fmtDia = (iso) => new Intl.DateTimeFormat('es-MX', { timeZone: config.timezone, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso)).replace(/^./, (c) => c.toUpperCase());
const fmtHora = (iso) => new Intl.DateTimeFormat('es-MX', { timeZone: config.timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
const BOOK_CSS = `.dias{display:grid;gap:10px;margin:18px 0}.dia{border:1px solid var(--line);border-radius:16px;padding:12px 14px}
.dia summary{cursor:pointer;font-weight:600;list-style:none;display:flex;justify-content:space-between}.dia summary::-webkit-details-marker{display:none}
.dia summary em{font-style:normal;color:var(--muted);font-weight:500;font-size:13px}.dia[open] summary{margin-bottom:12px}
.horas{display:flex;flex-wrap:wrap;gap:8px}.horas label{position:relative}.horas input{position:absolute;opacity:0;pointer-events:none}
.horas span{display:inline-block;padding:9px 16px;border-radius:99px;border:1px solid var(--line);font-weight:600;cursor:pointer;font-size:14px}
.horas input:checked+span{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}.horas input:focus-visible+span{outline:2px solid var(--accent)}
.campos{display:grid;gap:12px;margin:18px 0}.campos label{display:grid;gap:6px;font-size:13px;color:var(--muted)}.hp{position:absolute;left:-5000px}`;

export function bookingPage(client, { slots = [], form = {}, error = '', duracion = 45 } = {}) {
  const dias = new Map();
  for (const s of slots) { const k = fmtDia(s.inicio); if (!dias.has(k)) dias.set(k, []); dias.get(k).push(s); }
  const body = html`<style>${raw(BOOK_CSS)}</style>
  <div style="max-width:760px;margin:0 auto">
  ${hero({ kicker: client.nombre, title: 'Agenda tu llamada', letra: client.nombre, sub: `${duracion} min · hora del centro de México`, avatar: client.logo_path ? `<img src="${esc(mediaSrc(client.logo_path))}" alt="">` : null, note: ['Paso 1 de 2', 'Elige el día y la hora'] })}
  ${error ? html`<div class="err">${error}</div>` : ''}
  ${slots.length ? html`<form method="post" class="card">
    <strong>1. Elige un horario</strong>
    <div class="dias">${[...dias].map(([dia, list], i) => html`<details class="dia" name="dia" ${i === 0 || list.some((s) => s.inicio === form.inicio) ? 'open' : ''}><summary>${dia}<em>${list.length} horarios</em></summary><div class="horas">${list.map((s) => html`<label><input type="radio" name="inicio" value="${s.inicio}" required ${form.inicio === s.inicio ? 'checked' : ''}><span>${fmtHora(s.inicio)}</span></label>`)}</div></details>`)}</div>
    <strong>2. Tus datos</strong>
    <div class="campos">
      <label>Nombre<input name="nombre" required maxlength="80" value="${form.nombre || ''}" autocomplete="name"></label>
      <label>WhatsApp<input name="telefono" required maxlength="20" inputmode="tel" value="${form.telefono || ''}" autocomplete="tel" placeholder="+52 55 1234 5678"></label>
      <label>¿De qué quieres hablar? (opcional)<input name="motivo" maxlength="200" value="${form.motivo || ''}"></label>
      <label class="hp" aria-hidden="true">No llenar<input name="sitio" tabindex="-1" autocomplete="off"></label>
    </div>
    <button class="btn-accent" type="submit">Confirmar cita</button>
  </form>` : html`<div class="card muted" style="margin-top:18px">No hay horarios libres en los próximos días. Escríbenos por WhatsApp y te buscamos un espacio.</div>`}
  </div>`;
  return page({ title: `Agenda tu llamada · ${client.nombre}`, body });
}

export function bookingDone(client, cita, link = '') {
  const body = html`<div style="max-width:560px;margin:40px auto 0;text-align:center" class="card">
    <div style="font-size:44px">✓</div><h1 style="margin:6px 0">¡Listo, quedó agendada!</h1>
    <p style="font-size:20px;margin:14px 0 4px">${fmtDia(cita.inicio)}</p>
    <p style="font-size:28px;font-weight:700;margin:0 0 14px">${fmtHora(cita.inicio)}</p>
    ${link ? html`<p><a class="btn btn-accent" href="${link}" target="_blank" rel="noopener">Link de la videollamada</a></p><p class="muted small" style="word-break:break-all">${link}</p>` : ''}
    <p class="muted">Te escribimos por WhatsApp antes de la llamada. Si necesitas cambiarla, contéstanos ahí mismo.</p>
    <p class="muted small">${client.nombre}</p></div>`;
  return page({ title: `Cita confirmada · ${client.nombre}`, body });
}

// ------------------------------------------------------------ conversación de un lead
const fmtChat = (iso) => new Intl.DateTimeFormat('es-MX', { timeZone: config.timezone, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso.replace(' ', 'T') + 'Z'));
const CHAT_CSS = `.chat{display:flex;flex-direction:column;gap:8px;max-width:760px;max-height:62vh;overflow-y:auto}.burb{max-width:80%;padding:10px 14px;border-radius:18px;white-space:pre-wrap;line-height:1.45;font-size:15px;word-break:break-word}
.burb.lead{align-self:flex-start;background:var(--card2);border-bottom-left-radius:4px}.burb.agente{align-self:flex-end;background:rgba(198,255,61,.12);color:#e6ffd0;border-bottom-right-radius:4px}
.burb.humano{align-self:flex-end;background:rgba(147,180,255,.16);color:#dbe6ff;border-bottom-right-radius:4px}
.burb time{display:block;font-size:11px;color:var(--muted);margin-top:4px}
.resp{max-width:760px;margin-top:14px}.resp textarea{min-height:76px}.ctl{display:flex;gap:10px;align-items:center;flex-wrap:wrap;max-width:760px;margin:0 0 12px}`;
export const chatBurbujas = (mensajes) => String(mensajes.length
  ? html`${mensajes.map((m) => html`<div class="burb ${m.rol}">${m.texto}<time>${m.rol === 'lead' ? 'Lead' : m.rol === 'humano' ? (m.autor || 'Equipo') : 'Agente'} · ${fmtChat(m.created_at)}</time></div>`)}`
  : html`<p class="muted">Sin mensajes todavía.</p>`);

export function leadChatPage(client, lead, mensajes, { back = null, sideBar = null, base = null, puedeResponder = false, estado = null, error = '', borrador = '', ficha = '', ok = '' } = {}) {
  const tel = lead.telefono ? lead.telefono.replace(/\D/g, '') : null;
  const humano = estado ? !!estado.humano : lead.control === 'humano';
  const body = html`<style>${raw(CHAT_CSS)}${raw(FICHA_CSS)}</style>
  ${hero({ kicker: `Conversación · ${lead.origen}`, title: lead.nombre || lead.usuario || lead.telefono || 'Lead', letra: lead.nombre || 'L',
    sub: [lead.telefono, lead.usuario, lead.cita_inicio ? `cita ${fmtDate(lead.cita_inicio)}` : ''].filter(Boolean).join(' · '),
    stats: [[mensajes.filter((m) => m.rol === 'lead').length, 'Mensajes del lead', '#93b4ff'], [mensajes.filter((m) => m.rol === 'agente').length, 'Respuestas del agente', '#c9f53a'], [mensajes.filter((m) => m.rol === 'humano').length, 'Respuestas del equipo', '#93b4ff']],
    tabs: [[back || `/admin/clientes/${client.id}?tab=leads`, '← Leads', false], ...(tel ? [[`https://wa.me/${tel}`, 'Abrir en WhatsApp', false]] : [])],
    note: puedeResponder ? (humano ? ['Control', 'Tú respondes · el bot está en pausa'] : ['Control', 'El agente responde solo']) : null })}
  ${error ? html`<div class="err" style="max-width:760px">${error}</div>` : ''}${ok ? html`<div class="okmsg" style="max-width:760px">${ok}</div>` : ''}
  <div class="chat-wrap"><div>
  ${puedeResponder && base ? html`<div class="ctl">
    <span class="badge" style="color:${humano ? '#93b4ff' : '#c9f53a'}">${humano ? 'Tú tienes el control' : 'Responde el agente'}</span>
    ${estado && estado.ventana_abierta === false ? html`<span class="badge" style="color:#fbbf24">Ventana de 24 h cerrada</span>` : ''}
    <form method="post" action="${base}/control" class="inline"><input type="hidden" name="humano" value="${humano ? '0' : '1'}"><button class="${humano ? 'btn-accent' : 'btn-warn'}">${humano ? 'Devolver al agente' : 'Tomar control'}</button></form>
  </div>` : ''}
  <div class="card chat" id="chat">${raw(chatBurbujas(mensajes))}</div>
  ${puedeResponder && base ? html`<form class="resp" method="post" action="${base}/responder">
    <textarea name="texto" maxlength="4000" placeholder="Escribe tu respuesta… (al enviar, el agente se pausa en esta conversación)" required>${borrador}</textarea>
    <p class="row"><button class="btn-accent">Enviar por WhatsApp</button><span class="muted small">Sale desde el número del agente. ${humano ? 'Cuando termines, toca "Devolver al agente".' : ''}</span></p></form>`
    : html`<p class="muted small" style="max-width:760px">Para responder desde aquí, Kuper tiene que conectar este panel con tu agente (URL del agente en Configuración).</p>`}
  </div>${raw(String(ficha || ''))}</div>
  ${raw(`<script>(()=>{const c=document.getElementById('chat');c.scrollTop=c.scrollHeight;const u=${JSON.stringify(base ? `${base}/chat.json` : '')};if(!u)return;let last=c.innerHTML;
  setInterval(async()=>{try{const r=await fetch(u,{headers:{accept:'application/json'}});if(!r.ok)return;const j=await r.json();if(j.html!==last){const abajo=c.scrollHeight-c.scrollTop-c.clientHeight<60;c.innerHTML=j.html;last=j.html;if(abajo)c.scrollTop=c.scrollHeight;}}catch{}},8000);})();</script>`)}`;
  return page({ title: `Chat · ${lead.nombre || lead.telefono || ''}`, body, side: sideBar || side('clientes') });
}

// ------------------------------------------------------------ usuarios (solo administradores)
const ACCION = { entrada: 'Entró', entrada_fallida: 'Contraseña incorrecta', codigo_fallido: 'Código incorrecto', usuario_creado: 'Creó usuario', usuario_eliminado: 'Eliminó usuario',
  usuario_bloqueado: 'Bloqueó usuario', usuario_activado: 'Activó usuario', clave_reiniciada: 'Nueva contraseña', clave_cambiada: 'Cambió su contraseña', '2fa_activado': 'Activó 2 pasos',
  '2fa_quitado': 'Quitó 2 pasos', '2fa_quitado_por_admin': 'Admin quitó 2 pasos', plan_actualizado: 'Cambió plan', llave_api_generada: 'Generó llave API', origen_rechazado: 'Bloqueado (otro sitio)' };
// Acceso de grupo: el usuario elige qué marca ver.
export function marcasPage(client, marcas) {
  const body = html`${hero({ kicker: 'Tu grupo', title: 'Cambiar de marca', letra: client.nombre, sub: 'Con tu misma cuenta entras a todas las marcas de tu grupo. Cada una tiene sus propios leads, agentes, publicaciones y pagos.' })}
  <div style="display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">
    ${marcas.map((m) => html`<a class="card" href="/app?marca=${m.id}" style="text-decoration:none;color:inherit;${m.id === client.id ? 'border-color:var(--accent)' : ''}">
      <span class="mono">${m.id === client.id ? 'Estás aquí' : 'Entrar'}</span>
      <p style="font-size:22px;margin:8px 0 0">${m.nombre}</p></a>`)}
  </div>`;
  return page({ title: `Marcas · ${client.nombre}`, side: sideApp('marcas', client), body });
}

export function usersPage(users, clients, { error = '', creado = null, filtro = null, bitacora = [] } = {}) {
  const ROL = { admin: 'Administrador', cliente: 'Cliente' };
  const lista = filtro ? users.filter((u) => u.client_id === filtro || u.extras?.includes(filtro)) : users;
  const body = html`${hero({ kicker: 'Equipo y clientes', title: 'Usuarios', sub: 'Los administradores (Kuper) ven y manejan todo. Cada cliente entra con su correo y solo ve su marca.',
    stats: [[users.filter((u) => u.rol === 'admin').length, 'Administradores', '#c9f53a'], [users.filter((u) => u.rol === 'cliente').length, 'Clientes', '#93b4ff']],
    tabs: [['/admin/usuarios', 'Todos', !filtro], ...clients.map((c) => [`/admin/usuarios?c=${c.id}`, c.nombre, filtro === c.id])] })}
  ${error ? html`<div class="err">${error}</div>` : ''}
  ${creado ? html`<div class="card" style="border-color:#c9f53a;margin-bottom:18px"><span class="mono" style="color:#c9f53a">Contraseña temporal · se muestra solo esta vez</span>
    <p style="margin:10px 0 4px">Mándale estos datos a <strong>${creado.nombre}</strong> (por WhatsApp o en persona):</p>
    <p style="font-size:18px;margin:6px 0">Entra a <strong>${config.publicBaseUrl}/entrar</strong><br>Correo: <strong>${creado.email}</strong><br>Contraseña: <strong style="font-family:ui-monospace,Menlo,monospace;color:#c9f53a">${creado.password}</strong></p>
    <p class="muted small">Al entrar puede cambiarla en "Mi cuenta".</p></div>` : ''}
  <div style="display:grid;gap:18px;grid-template-columns:minmax(0,1.6fr) minmax(280px,1fr);align-items:start" class="usr">
  <style>@media (max-width:900px){.usr{grid-template-columns:1fr!important}}</style>
  <div class="card" style="padding:8px 14px;overflow-x:auto"><table>
    <tr><th>Usuario</th><th>Rol</th><th>Último acceso</th><th>Acciones</th></tr>
    ${lista.map((u) => html`<tr><td><strong>${u.nombre}</strong><div class="muted small">${u.email}</div></td>
      <td><span class="badge" style="color:${u.rol === 'admin' ? '#c9f53a' : '#93b4ff'}">${ROL[u.rol]}${u.cliente ? ` · ${u.cliente}` : ''}</span>${u.extras?.length ? html` <span class="badge" style="color:#fbbf24" title="${clients.filter((c) => u.extras.includes(c.id)).map((c) => c.nombre).join(', ')}">+${u.extras.length} marca${u.extras.length > 1 ? 's' : ''} del grupo</span>` : ''}
        ${u.rol === 'cliente' ? html`<form class="inline" method="post" action="/admin/usuarios/${u.id}/caja" style="margin-top:6px"><button class="btn-warn" style="padding:4px 10px;font-size:12px">${u.permiso === 'caja' ? 'Solo caja · dar acceso completo' : 'Hacer solo caja'}</button></form>` : ''}
        ${u.rol === 'cliente' ? html`<details style="margin-top:6px"><summary class="muted small" style="cursor:pointer">Marcas del grupo</summary>
          <form method="post" action="/admin/usuarios/${u.id}/marcas" style="margin-top:6px">
            ${clients.filter((c) => c.id !== u.client_id).map((c) => html`<label class="small" style="display:block;margin:2px 0"><input type="checkbox" name="marcas" value="${c.id}" ${raw(u.extras?.includes(c.id) ? 'checked' : '')}> ${c.nombre}</label>`)}
            <button class="btn-warn" style="padding:6px 12px;font-size:13px;margin-top:6px">Guardar marcas</button></form></details>` : ''}${u.activo ? '' : html` <span class="badge" style="color:#f87171">Bloqueado</span>`}${u.totp_enc ? html` <span class="badge" style="color:#4ade80">2 pasos</span>` : ''}</td>
      <td class="small muted">${u.last_login ? fmtDate(u.last_login.replace(' ', 'T') + 'Z') : 'Nunca'}</td>
      <td><div class="row" style="gap:6px"><form class="inline" method="post" action="/admin/usuarios/${u.id}/clave"><button class="btn-warn" style="padding:6px 12px;font-size:13px">Nueva contraseña</button></form>
        <form class="inline" method="post" action="/admin/usuarios/${u.id}/activo"><button class="btn-warn" style="padding:6px 12px;font-size:13px">${u.activo ? 'Bloquear' : 'Activar'}</button></form>
        ${u.totp_enc ? html`<form class="inline" method="post" action="/admin/usuarios/${u.id}/quitar-2fa" onsubmit="return confirm('¿Quitar la verificación en dos pasos de ${u.nombre}? (por si perdió su teléfono)')"><button class="btn-warn" style="padding:6px 12px;font-size:13px">Quitar 2 pasos</button></form>` : ''}
        <form class="inline" method="post" action="/admin/usuarios/${u.id}/eliminar" onsubmit="return confirm('¿Eliminar a ${u.nombre}? Ya no podrá entrar.')"><button class="btn-bad" style="padding:6px 12px;font-size:13px">Eliminar</button></form></div></td></tr>`)}
    ${lista.length ? '' : html`<tr><td class="muted" colspan="4">Todavía no hay usuarios aquí.</td></tr>`}
  </table></div>
  <form class="card" method="post" action="/admin/usuarios">
    <span class="mono">Nuevo usuario</span>
    <label>Nombre</label><input name="nombre" required maxlength="80" placeholder="Ej. Laura de Buen Sabor">
    <label>Correo</label><input name="email" type="email" required placeholder="laura@buensabor.mx">
    <label>Rol</label><select name="rol" onchange="this.form.client_id.disabled=this.value!=='cliente'">
      <option value="cliente">Cliente (solo ve su marca)</option><option value="admin">Administrador (Kuper, ve todo)</option></select>
    <label class="small" style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" name="caja" value="1"> Solo caja (únicamente canjea cupones en sucursal)</label>
    <label>Marca</label><select name="client_id">${clients.map((c) => html`<option value="${c.id}" ${raw(filtro === c.id ? 'selected' : '')}>${c.nombre}</option>`)}</select>
    <details style="margin-top:10px"><summary class="muted small" style="cursor:pointer">¿Es de un grupo? Elige sus otras marcas</summary>
      ${clients.map((c) => html`<label class="small" style="display:block;margin:2px 0"><input type="checkbox" name="marcas" value="${c.id}"> ${c.nombre}</label>`)}
      <p class="muted small">Con un solo correo entrará a todas y cambiará de marca desde su panel.</p></details>
    <p class="muted small">Se genera una contraseña temporal y te la mostramos una sola vez para que se la mandes.</p>
    <button class="btn-accent">Crear usuario</button>
  </form></div>
  <h2>Actividad de seguridad</h2>
  <div class="card" style="padding:8px 14px;overflow-x:auto"><table><tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>IP</th></tr>
    ${bitacora.map((b) => html`<tr><td class="small muted" style="white-space:nowrap">${fmtDate(b.created_at.replace(' ', 'T') + 'Z')}</td><td class="small">${b.email || '—'}</td>
      <td class="small"><span class="badge" style="color:${/fallid|rechaz/.test(b.accion) ? '#f87171' : /entrada$/.test(b.accion) ? '#4ade80' : '#d9d4cb'}">${ACCION[b.accion] || b.accion}</span> ${b.detalle || ''}</td><td class="small muted">${b.ip || ''}</td></tr>`)}
    ${bitacora.length ? '' : html`<tr><td class="muted" colspan="4">Sin actividad todavía.</td></tr>`}</table></div>`;
  return page({ title: 'Usuarios', side: side('usuarios'), body });
}

// ------------------------------------------------------------ vista del cliente (/app)
export function appHomePage(client, pulso, billing = null) {
  const aviso = modoCobro(client) === 'stripe' && billing?.estado === 'pago_fallido' ? html`<a class="err" href="/app/pagos" style="display:block;text-decoration:none">Tu banco rechazó el último cobro. Toca aquí para actualizar tu tarjeta y no pausar tus servicios.</a>`
 : modoCobro(client) === 'stripe' && planDe(client).conceptos.length && billing?.estado === 'sin_tarjeta' ? html`<a class="warn" href="/app/pagos" style="display:block;text-decoration:none">Domicilia tu tarjeta para activar el cobro mensual de tu plan →</a>` : '';
  return page({ title: `${client.nombre} · Panel`, side: sideApp('inicio', client), body: html`${aviso}${controlCenter(pulso, [client], { cliente: client })}` });
}
const appHero = (client, t, posts = [], leadsN = 0, extra = {}) => hero({
  kicker: 'Tu panel', title: client.nombre, letra: client.nombre,
  avatar: client.logo_path ? `<img src="${esc(mediaSrc(client.logo_path))}" alt="">` : null,
  stats: [
    ...(tiene(client, 'redes') ? [[posts.filter((p) => ['pendiente', 'necesita_asset'].includes(p.status)).length, 'Por revisar', '#fbbf24', '/app/posts', posts.some((p) => ['pendiente', 'necesita_asset'].includes(p.status))],
      [posts.filter((p) => ['aprobado', 'publicando'].includes(p.status)).length, 'Programadas', '#4ade80', '/app/posts?t=programadas'],
      [posts.filter((p) => p.status === 'publicado').length, 'Publicadas', '#c9f53a', '/app/posts?t=publicadas']] : []),
    ...(tiene(client, 'chat') ? [[leadsN, 'Leads', '#93b4ff', '/app/leads']] : []),
  ],
  tabs: [['/app', 'Resumen', false], ...(tiene(client, 'redes') ? [['/app/posts', 'Publicaciones', t === 'posts']] : []), ...(tiene(client, 'chat') ? [['/app/leads', 'Leads', t === 'leads'], ['/app/embudo', 'Embudo', t === 'embudo'], ['/app/analitica', 'Analítica', t === 'analitica']] : []),
    ...(tiene(client, 'agenda') ? [['/app/citas', 'Citas', t === 'citas']] : []), ['/app/pagos', 'Pagos', t === 'pagos']],
  note: extra.note || null,
});
// Ideas de temas que dejó el cliente: la siguiente publicación automática usa la primera.
function temasCard(client, base) {
  const lista = Array.isArray(client.config?.temas_pendientes) ? client.config.temas_pendientes : [];
  if (!lista.length) return '';
  return html`<div class="card" style="margin:14px 0"><span class="mono">Ideas en espera (${lista.length})</span>
    <p class="muted small" style="margin:6px 0 10px">La próxima publicación automática usa la primera.</p>
    ${lista.map((t, i) => html`<div class="row spread" style="padding:8px 0;border-top:1px solid rgba(255,255,255,.06)"><span>${i + 1}. ${t.texto}</span>
      <form method="post" action="${base}/${i}/quitar" class="inline"><button class="btn-warn" style="padding:6px 12px">Quitar</button></form></div>`)}</div>`;
}
export function appPostsPage(client, posts, tab = '', leadsN = 0, cuota = null, aviso = '') {
  const by = (sts) => posts.filter((p) => sts.includes(p.status));
  const T = [['revisar', 'Por revisar', by(['pendiente', 'necesita_asset', 'cambios_solicitados', 'generando']), 'No tienes nada pendiente.'],
    ['programadas', 'Programadas', by(['aprobado', 'publicando']).reverse(), 'Nada programado todavía.'], ['publicadas', 'Publicadas', by(['publicado']).slice(0, 30), 'Aún no hay publicaciones.']];
  const sel = T.find((x) => x[0] === tab) || T[0];
  const plan = planDe(client);
  const redesExtra = PLATFORMS.filter((p) => client.config[p]?.activo && !reusa(client, p));
  const body = html`${appHero(client, 'posts', posts, leadsN)}
  ${aviso ? html`<div class="okmsg">${aviso}</div>` : ''}
  ${cuota ? html`<div class="card" style="margin-bottom:18px;display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));align-items:center">
    <div><span class="mono">Tu plan · esta semana</span>
      <div style="display:flex;align-items:baseline;gap:8px;margin-top:8px"><b style="font-size:40px;font-weight:300;letter-spacing:-.04em">${cuota.semana}</b><span class="muted">de ${plan.posts_semana} publicaciones</span></div>
      <div style="height:6px;border-radius:99px;background:rgba(255,255,255,.08);margin-top:10px;overflow:hidden"><div style="height:100%;width:${Math.min(100, Math.round((cuota.semana / Math.max(1, plan.posts_semana)) * 100))}%;background:#c9f53a;border-radius:99px"></div></div></div>
    <div><span class="mono">Publicaciones extra este mes</span>
      <p style="margin:8px 0 0">${['cortesia', 'prueba'].includes(cuota.costo.modo) ? raw('Tus publicaciones extra son <b>gratis</b>.') : cuota.costo.gratisRestantes ? raw(cuota.costo.gratisRestantes === 1 ? 'Te queda <b>1 gratis</b>.' : `Te quedan <b>${cuota.costo.gratisRestantes} gratis</b>.`) : html`Ya usaste tu extra gratis. Cada extra cuesta <b>${mxn(conIva(client, plan.precio_extra))}</b>.`}</p>
      <p class="muted small" style="margin:4px 0 0">${cuota.extras} ${cuota.extras === 1 ? 'extra pedida' : 'extras pedidas'} este mes.</p></div>
    <div><span class="mono">¿Quieres una más?</span><div class="row" style="margin-top:10px">${redesExtra.map((p) => html`<a class="btn btn-accent" href="/app/extra?red=${p}" style="padding:9px 16px">+ ${PLAT[p]}</a>`)}</div></div>
  </div>` : ''}
  <form class="card" method="post" action="/app/temas" style="margin-bottom:18px">
    <span class="mono">¿Quieres un post sobre algo?</span>
    <div class="row" style="margin-top:10px;align-items:flex-end;flex-wrap:wrap;gap:10px">
      <div style="flex:1;min-width:240px"><input name="tema" required maxlength="400" placeholder="Ej. nuestra promoción de diciembre, el nuevo horario, un cliente feliz…"></div>
      <button class="btn-accent" name="accion" value="cola">Usarlo en mi próxima publicación</button>
      ${redesExtra.length ? html`<button class="btn-warn" name="accion" value="extra">Lo quiero ya (publicación extra)</button>` : ''}
    </div>
    <p class="muted small" style="margin:8px 0 0">"Próxima publicación" no cuesta nada: entra en las de tu plan. "Lo quiero ya" crea una publicación extra en este momento.</p>
  </form>
  ${temasCard(client, '/app/temas')}
  <div class="pills">${T.map(([k, l, list]) => html`<a class="${k === sel[0] ? 'on' : ''}" href="/app/posts?t=${k}">${l} <em>${list.length}</em></a>`)}</div>
  ${sel[2].length ? html`<div class="grid">${sel[2].map((p) => postCard(p, { base: `/app/posts/${p.id}` }))}</div>` : html`<div class="card muted">${sel[3]}</div>`}
  ${sel[2].some((p) => ['generando', 'cambios_solicitados'].includes(p.status)) ? vigilar(firmaPosts(posts)) : ''}`;
  return page({ title: `Publicaciones · ${client.nombre}`, side: sideApp('posts', client), body });
}
export function appExtraPage(client, { red, costo, tarjeta, error = '', tema = '' }) {
  const plan = planDe(client);
  const body = html`${appHero(client, 'posts')}
  <div class="card" style="max-width:560px">
    <span class="mono">Publicación extra · ${PLAT[red]}</span>
    <h1 style="font-size:32px;margin:12px 0 6px">${costo.monto ? `Cuesta ${mxn(conIva(client, costo.monto))}` : 'Esta va gratis'}</h1>
    <p class="muted">${costo.monto ? html`Tu plan incluye ${plan.posts_semana} publicaciones por semana y ${plan.extra_gratis_mes} extra gratis al mes, que ya usaste. ${costo.modo === 'externo' ? 'Se suma a tu próximo pago con Kuper.' : tarjeta ? html`Se cobra a tu tarjeta <b>${tarjeta}</b>.` : ''}` : ['cortesia', 'prueba'].includes(costo.modo) ? 'Con tu plan actual, las publicaciones extra no tienen costo.' : html`Tu plan incluye ${plan.extra_gratis_mes} publicación extra gratis al mes. Después, cada una cuesta ${mxn(plan.precio_extra)}.`}</p>
    <p class="muted small">El agente la crea en unos minutos y te llega a "Por revisar" para que la apruebes antes de publicarse.</p>
    ${error ? html`<div class="err">${error}</div>` : ''}
    ${costo.monto && costo.modo === 'stripe' && !tarjeta ? html`<p><a class="btn btn-accent" href="/app/pagos">Primero domicilia tu tarjeta</a></p>` : html`<form method="post" action="/app/extra" style="margin-top:14px"><input type="hidden" name="red" value="${red}"><input type="hidden" name="monto" value="${costo.monto}">
      <label>¿Sobre qué quieres que trate? (opcional)</label><textarea name="tema" maxlength="400" style="min-height:70px" placeholder="Si lo dejas vacío, el agente elige el tema según tu estrategia.">${tema}</textarea><div class="row" style="margin-top:10px">
      <button class="btn-accent">${!costo.monto ? 'Crear publicación gratis' : costo.modo === 'externo' ? `Crear (se suma ${mxn(conIva(client, costo.monto))} a tu pago)` : `Pagar ${mxn(conIva(client, costo.monto))} y crear`}</button><a class="btn btn-warn" href="/app/posts">Cancelar</a></div></form>`}
  </div>`;
  return page({ title: `Publicación extra · ${client.nombre}`, side: sideApp('posts', client), body });
}

// Etiqueta de cobro que ve el admin y el cliente, según el modo (cortesía, prueba, externo) o el estado en Stripe.
function estadoCobro(client, billing) {
  const modo = modoCobro(client), p = planDe(client);
  if (modo === 'cortesia') return ['Cortesía (gratis)', '#93b4ff'];
  if (modo === 'prueba') return [`Prueba gratis hasta ${fmtDia(p.prueba_hasta + 'T18:00:00Z').toLowerCase()}`, '#93b4ff'];
  if (modo === 'externo') return ['Paga por fuera', '#a39d93'];
  return ESTADO_PAGO[billing?.estado] || ESTADO_PAGO.sin_tarjeta;
}
const ESTADO_PAGO = { al_corriente: ['Al corriente', '#4ade80'], sin_tarjeta: ['Sin tarjeta domiciliada', '#fbbf24'], pago_fallido: ['Pago rechazado', '#f87171'], cancelado: ['Suscripción cancelada', '#f87171'] };
// El cliente captura sus datos fiscales para que Kuper le haga su factura (CFDI).
function fiscalForm(client, error = '') {
  const f = fiscalDe(client) || {};
  const opt = (obj, sel) => Object.entries(obj).map(([k, l]) => html`<option value="${k}" ${raw(String(sel) === k ? 'selected' : '')}>${k} · ${l}</option>`);
  return html`<form class="card" method="post" action="/app/pagos/fiscal" style="margin-top:18px" id="factura">
    <div class="row spread"><span class="mono">Datos para tu factura</span>${f.rfc ? html`<span class="badge" style="color:#4ade80">Guardados</span>` : html`<span class="badge" style="color:#fbbf24">Faltan</span>`}</div>
    <p class="muted small" style="margin:6px 0 12px">Tal como aparecen en tu constancia de situación fiscal. Con esto te mandamos tu factura cada mes.</p>
    ${error ? html`<div class="err">${error}</div>` : ''}
    <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
      <div><label>RFC</label><input name="rfc" required maxlength="13" value="${f.rfc || ''}" style="text-transform:uppercase" autocomplete="off"></div>
      <div><label>Nombre o razón social</label><input name="razon_social" required maxlength="200" value="${f.razon_social || ''}"></div>
      <div><label>Código postal fiscal</label><input name="cp" required inputmode="numeric" maxlength="5" value="${f.cp || ''}"></div>
      <div><label>Régimen fiscal</label><select name="regimen" required><option value="">Elige…</option>${opt(REGIMENES, f.regimen)}</select></div>
      <div><label>Uso del CFDI</label><select name="uso">${opt(USOS_CFDI, f.uso || 'G03')}</select></div>
      <div><label>Correo para recibir la factura (opcional)</label><input type="email" name="correo" maxlength="120" value="${f.correo || ''}"></div>
    </div>
    <button class="btn-accent" style="margin-top:12px">Guardar datos de factura</button>
  </form>`;
}
export function appPagosPage(client, r, { error = '', ok = '', stripeOn = true, fiscalError = '', facturas = {} } = {}) {
  const plan = planDe(client), est = estadoCobro(client, r), mensual = mensualidad(client), modo = modoCobro(client), iva = ivaDe(client);
  const body = html`${appHero(client, 'pagos', [], 0, { note: ['Mensualidad', mensual ? `${mxn(mensualidadTotal(client))} al mes` : 'Sin mensualidad'] })}
  ${ok ? html`<div class="okmsg">${ok}</div>` : ''}${error ? html`<div class="err">${error}</div>` : ''}
  ${modo === 'cortesia' ? html`<div class="okmsg">Tu plan es cortesía de Kuper: no se te cobra nada.</div>` : ''}
  ${modo === 'prueba' ? html`<div class="okmsg">Estás en tu prueba gratis hasta el ${fmtDia(plan.prueba_hasta + 'T18:00:00Z').toLowerCase()}. Si domicilias tu tarjeta ahora, el primer cobro llega al terminar la prueba.</div>` : ''}
  ${modo === 'externo' ? html`<div class="card muted" style="margin-bottom:18px">Pagas tu plan directamente con Kuper (transferencia u otro medio). Aquí ves lo que incluye y tus facturas en línea, si las hay.</div>` : ''}
  ${modo === 'stripe' && r.estado === 'pago_fallido' ? html`<div class="err">Tu banco rechazó el último cobro. Actualiza tu tarjeta para no pausar tus servicios.</div>` : ''}
  <div style="display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));align-items:start">
    <div class="card"><div class="row spread"><span class="mono">Tu tarjeta</span><span class="badge" style="color:${est[1]}">${est[0]}</span></div>
      <p style="font-size:22px;font-weight:300;margin:14px 0 4px${r.tarjeta ? ';text-transform:capitalize' : ''}">${r.tarjeta || 'Ninguna todavía'}</p>
      ${r.proximo_cobro ? html`<p class="muted small">Próximo cobro: ${fmtDate(r.proximo_cobro)}</p>` : ''}
      ${['cortesia', 'externo'].includes(modo) ? '' : !stripeOn ? html`<p class="muted small">Los pagos en línea se activan pronto. Mientras, Kuper te contacta para tu forma de pago.</p>` : html`<div class="row" style="margin-top:14px">
        ${r.tarjeta ? html`<form method="post" action="/app/pagos/portal" class="inline"><button class="btn-warn">Cambiar tarjeta o ver facturas</button></form>`
          : html`<form method="post" action="/app/pagos/domiciliar" class="inline"><button class="btn-accent">Domiciliar mi tarjeta</button></form>`}</div>
      <p class="muted small" style="margin-top:12px">🔒 Tu tarjeta se guarda en Stripe, el procesador de pagos. Kuper nunca ve ni guarda sus números.</p>`}
    </div>
    <div class="card"><span class="mono">Tu plan</span>
      <table style="margin-top:8px">${plan.conceptos.map((c) => html`<tr><td>${c.nombre}</td><td class="muted small">${c.tipo === 'unico' ? 'pago único' : 'al mes'}</td><td style="text-align:right">${mxn(c.monto)} <span class="muted small">${etiquetaIva(iva)}</span></td></tr>`)}
      ${plan.conceptos.length ? '' : html`<tr><td class="muted">Kuper todavía no carga tu plan.</td></tr>`}</table>
      ${mensual ? html`<p class="small" style="margin-top:10px">Al mes: ${raw(resumenIva(client, mensual))}.</p>` : ''}
      <p class="muted small" style="margin-top:10px">Incluye: ${Object.entries(SERVICIOS).filter(([k]) => plan.servicios[k]).map(([, v]) => v.nombre).join(', ') || '—'}${plan.servicios.redes ? ` · ${plan.posts_semana} publicaciones por semana · ${plan.extra_gratis_mes} extra gratis al mes (después ${mxn(plan.precio_extra)} c/u)` : ''}.</p>
    </div>
  </div>
  ${client.config?.sin_factura ? '' : fiscalForm(client, fiscalError)}
  <h2>Facturas y cobros</h2>
  ${r.facturas?.length ? html`<div class="card" style="padding:8px 14px;overflow-x:auto"><table><tr><th>Fecha</th><th>Concepto</th><th>Estado</th><th style="text-align:right">Total</th><th>Factura</th><th></th></tr>
    ${r.facturas.map((f) => html`<tr><td class="small">${fmtDate(f.fecha)}</td><td class="small">${f.concepto || f.numero || ''}</td><td><span class="badge" style="color:${f.estado === 'paid' ? '#4ade80' : f.estado === 'open' ? '#fbbf24' : '#a39d93'}">${{ paid: 'Pagada', open: 'Pendiente', void: 'Anulada', draft: 'Borrador', uncollectible: 'No cobrada' }[f.estado] || f.estado}</span></td>
      <td style="text-align:right">${mxn(f.total)}</td><td class="small">${facturas[f.id]?.status === 'emitida' ? html`<a href="/app/pagos/factura/${f.id}/pdf">PDF</a> · <a href="/app/pagos/factura/${f.id}/xml">XML</a>` : facturas[f.id]?.status === 'pendiente' && !fiscalDe(client) ? html`<a href="#factura">Faltan tus datos</a>` : facturas[f.id] ? html`<span class="muted">En proceso</span>` : ''}</td><td>${f.url ? html`<a class="small" href="${f.url}" target="_blank" rel="noopener">Ver ↗</a>` : ''}</td></tr>`)}</table></div>`
    : html`<div class="card muted">Aún no hay cobros.</div>`}`;
  return page({ title: `Pagos · ${client.nombre}`, side: sideApp('pagos', client), body });
}

// ------------------------------------------------------------ llamadas del agente de voz
const LL_CSS = `.ll{display:grid;gap:12px}.ll details{background:var(--card,rgba(255,255,255,.04));border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:14px 18px}
.ll summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center}.ll summary::-webkit-details-marker{display:none}
.ll .ico{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:rgba(201,245,58,.12);color:#c9f53a;font-size:18px}
.ll .q{font-weight:600}.ll .r{margin:10px 0 0;line-height:1.5}.ll .der{text-align:right;white-space:nowrap}
.ll .chat{margin-top:12px;max-height:46vh}@media(max-width:640px){.ll summary{grid-template-columns:auto 1fr}.ll .der{grid-column:2;text-align:left}}`;
const dur = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`);
export function llamadasSection(llamadas, mes, { admin = false } = {}) {
  const m = mes || { llamadas: 0, minutos: 0, citas: 0 };
  return html`<style>${raw(CHAT_CSS + LL_CSS)}</style>
  ${kpis([[m.llamadas, 'Llamadas este mes', '#c9f53a', false], [m.minutos, 'Minutos hablados', '#93b4ff', false], [m.citas, 'Citas agendadas', '#4ade80', m.citas > 0], [llamadas.length, 'Llamadas en total', '#a39d93', false]])}
  ${llamadas.length ? html`<div class="ll">${llamadas.map((c) => html`<details>
    <summary><span class="ico">☎</span>
      <span><span class="q">${c.nombre || c.telefono || c.email || 'Sin datos de contacto'}</span>
        <span class="muted small"> · ${{ web: 'Prueba web', entrante: 'Entrante', saliente: 'Saliente' }[c.tipo] || c.tipo}</span>
        ${c.cita ? html` <span class="badge" style="color:#4ade80">Agendó cita</span>` : ''}
        <div class="muted small">${[c.telefono, c.email].filter(Boolean).join(' · ')}</div></span>
      <span class="der small muted">${fmtDate(c.inicio)}<br>${dur(c.duracion_s)}</span></summary>
    ${c.resumen ? html`<p class="r">${c.resumen}</p>` : html`<p class="r muted">Sin resumen.</p>`}
    ${c.transcripcion.length ? html`<div class="chat">${c.transcripcion.map((t) => html`<div class="burb ${t.rol}">${t.texto}<time>${t.rol === 'lead' ? 'Cliente' : 'Agente'}</time></div>`)}</div>` : ''}
  </details>`)}</div>`
    : html`<div class="card muted">Todavía no hay llamadas. ${admin ? 'Aparecen solas en cuanto el agente de llamadas tenga PANEL_URL, PANEL_SLUG y PANEL_API_KEY en su .env.' : 'Aquí verás cada llamada que atienda tu agente: quién era, de qué hablaron, el resumen y si agendó cita.'}</div>`}`;
}
// ------------------------------------------------------------ agente de ventas (solo Kuper)
export function ventasSection(client, prospectos, { activo, placesListo }) {
  const base = `/admin/clientes/${client.id}/ventas`;
  const n = (e) => prospectos.filter((p) => p.estado === e).length;
  const sinRevisar = prospectos.filter((p) => !p.repep_revisado && ['pendiente', 'sin_respuesta'].includes(p.estado)).length;
  const listos = prospectos.filter((p) => p.repep_revisado && ['pendiente', 'sin_respuesta'].includes(p.estado) && p.intentos < PROS_REGLAS.maxIntentos).length;
  return html`${kpis([[n('pendiente') + n('sin_respuesta'), 'Por llamar', '#93b4ff', false], [n('interesado'), 'Interesados', '#c9f53a', n('interesado') > 0], [n('cita'), 'Con cita', '#4ade80', n('cita') > 0], [n('no_interesa') + n('no_llamar'), 'Descartados', '#f87171', false]])}
  <div class="split">
    <div class="card"><span class="mono">1 · Agregar empresas</span>
      <form method="post" action="${base}/importar"><label>Pega la lista (una empresa por línea)</label>
        <textarea name="lista" rows="6" required placeholder="Empresa | teléfono | giro | ciudad | sitio web\nClínica Dental Sonrisa | 55 1234 5678 | dentista | CDMX | https://sonrisa.mx"></textarea>
        <p><button class="btn-accent">Agregar a la lista</button></p></form>
      <p class="muted small">Solo empresa y teléfono son obligatorios. También sirve copiar columnas de Excel. No se repiten números que ya estén en la lista o en Leads.</p>
      ${placesListo ? html`<details style="margin-top:8px"><summary class="small" style="cursor:pointer">O buscar en Google Maps</summary>
      <form method="post" action="${base}/buscar"><label>Giro</label><input name="giro" placeholder="dentistas, gimnasios, inmobiliarias…" required maxlength="80">
        <label>Ciudad</label><input name="ciudad" placeholder="Ciudad de México, Monterrey, Querétaro…" required maxlength="80">
        <label>Cuántas buscar</label><select name="cuantas"><option value="20">20</option><option value="40">40</option><option value="60">60</option></select>
        <p><button class="btn-warn">Buscar en Google Maps</button></p></form>
      <p class="muted small">Cada búsqueda de 20 cuesta unos 4 centavos de dólar en Google.</p></details>` : ''}</div>
    <div class="card"><span class="mono">2 · Revisar en el REPEP</span>
      <p class="small">La ley no permite llamar para ofrecer servicios a números registrados en el <a href="https://repep.profeco.gob.mx" target="_blank" rel="noopener">REPEP de PROFECO</a>. Antes de llamar, consulta los números ahí y pega abajo los que salgan registrados: pasan a "No llamar" y los demás quedan listos.</p>
      ${sinRevisar ? html`<p class="small" style="margin-bottom:4px"><strong>${sinRevisar}</strong> por revisar:</p><textarea readonly rows="3" onclick="this.select()">${prospectos.filter((p) => !p.repep_revisado && ['pendiente', 'sin_respuesta'].includes(p.estado)).map((p) => p.telefono.replace(/^[+]52/, '')).join(String.fromCharCode(10))}</textarea>` : html`<p class="muted small">Todo lo que está por llamar ya fue revisado.</p>`}
      <form method="post" action="${base}/repep"><label>Números que salieron en el REPEP (uno por línea; vacío si ninguno)</label><textarea name="numeros" rows="3" placeholder="5512345678"></textarea>
        <p><button class="btn-warn" ${raw(sinRevisar ? '' : 'disabled')}>Ya los revisé en el REPEP</button></p></form></div>
    <div class="card"><span class="mono">3 · Llamadas automáticas</span>
      <p style="font-size:20px;margin:10px 0 4px">${activo ? 'Activas' : 'En pausa'}</p>
      <p class="muted small">El agente llama de lunes a viernes de 10:00 a 13:30 y de 16:00 a 18:30, una empresa a la vez, máximo ${PROS_REGLAS.maxIntentos} intentos por empresa y con al menos un día entre intentos. Solo funciona cuando el agente de llamadas tenga número de teléfono. Listas para llamar: <strong>${listos}</strong>.</p>
      <form method="post" action="${base}/activo"><input type="hidden" name="on" value="${activo ? '0' : '1'}"><button class="${activo ? 'btn-warn' : 'btn-accent'}">${activo ? 'Pausar llamadas' : 'Activar llamadas'}</button></form></div>
  </div>
  ${prospectos.length ? html`<div class="card" style="padding:8px 14px;overflow-x:auto;margin-top:18px"><table>
    <tr><th class="small muted">Empresa</th><th class="small muted">Teléfono</th><th class="small muted">Estado</th><th class="small muted">Resultado</th><th class="small muted"></th></tr>
    ${prospectos.map((p) => html`<tr><td><strong>${p.empresa}</strong><div class="muted small">${[p.giro, p.ciudad].filter(Boolean).join(' · ')}${p.rating ? ` · ★ ${p.rating} (${p.resenas || 0})` : ''}</div>${p.web ? html`<a class="small" href="${p.web}" target="_blank" rel="noopener" style="color:var(--accent)">Sitio web ↗</a>` : ''}</td>
      <td class="small">${p.telefono}<div class="muted small">${p.repep_revisado ? 'REPEP revisado' : 'REPEP sin revisar'}</div></td>
      <td><span class="badge" style="color:${PROS_ESTADOS[p.estado]?.[1] || '#93b4ff'}">${PROS_ESTADOS[p.estado]?.[0] || p.estado}</span><div class="muted small">${p.intentos ? `${p.intentos} ${p.intentos === 1 ? 'intento' : 'intentos'}` : ''}</div></td>
      <td class="small" style="max-width:380px">${p.contacto ? html`<strong>${p.contacto}</strong>${p.email ? ` · ${p.email}` : ''}<br>` : ''}${p.resumen || ''}</td>
      <td style="white-space:nowrap">${p.estado !== 'no_llamar' ? html`<form method="post" action="${base}/${p.id}" class="inline"><input type="hidden" name="estado" value="no_llamar"><button class="btn-warn">No llamar</button></form>` : ''}
        <form method="post" action="${base}/${p.id}" class="inline" onsubmit="return confirm('¿Quitar ${esc(p.empresa).replace(/'/g, '')} de la lista?')"><input type="hidden" name="accion" value="borrar"><button class="btn-bad">Quitar</button></form></td></tr>`)}
  </table></div>` : html`<div class="card muted" style="margin-top:18px">Todavía no hay empresas. Pega una lista para empezar.</div>`}`;
}

export function appLlamadasPage(client, llamadas, mes) {
  const body = html`${hero({ kicker: 'Agente de llamadas', title: 'Llamadas', letra: client.nombre, sub: 'Cada llamada que atendió tu agente, con su resumen y lo que se dijo.',
    note: ['Este mes', `${mes.llamadas} ${mes.llamadas === 1 ? 'llamada' : 'llamadas'} · ${mes.citas} ${mes.citas === 1 ? 'cita' : 'citas'}`] })}
  ${llamadasSection(llamadas, mes)}`;
  return page({ title: `Llamadas · ${client.nombre}`, side: sideApp('llamadas', client), body });
}

export function appProximamentePage(client, servicio) {
  const s = SERVICIOS[servicio];
  const body = html`${hero({ kicker: 'Próximamente', title: s.nombre, letra: client.nombre, sub: s.desc, note: ['En preparación', 'Te avisamos en cuanto esté listo'] })}
  <div class="card muted">Estamos terminando este agente para tu marca. Cuando esté activo verás aquí cada ${servicio === 'llamadas' ? 'llamada' : 'videollamada'}: quién era, de qué hablaron, el resumen y si agendó cita.</div>`;
  return page({ title: `${s.nombre} · ${client.nombre}`, side: sideApp(servicio, client), body });
}

export function appLeadsPage(client, leads, chats, posts = [], campanaSel = '', { verAjenas = false, aviso = '' } = {}) {
  return page({ title: `Leads · ${client.nombre}`, side: sideApp('leads', client), body: html`${appHero(client, 'leads', posts, leads.length)}${leadsSection(client, leads, chats, '/app', { campanaSel, urlLeads: '/app/leads', verAjenas, aviso })}` });
}
export function appCitasPage(client, view, posts = [], leadsN = 0) {
  return page({ title: `Citas · ${client.nombre}`, side: sideApp('citas', client), body: html`${appHero(client, 'citas', posts, leadsN)}${citasSection({ ...view, admin: false, url: '/app/citas' })}` });
}
export function appEmbudoPage(client, leads, opts) {
  return page({ title: `Embudo · ${client.nombre}`, side: sideApp('embudo', client), body: html`${appHero(client, 'embudo', [], leads.length)}${embudoSection(client, leads, { base: '/app', ...opts })}` });
}
export function appAnaliticaPage(client, a) {
  return page({ title: `Analítica · ${client.nombre}`, side: sideApp('analitica', client), body: html`${appHero(client, 'analitica', [], a.totalLeads)}${analiticaSection(client, a, { base: '/app' })}` });
}
export function adminEmbudoPage(client, leads, opts) {
  const b = `/admin/clientes/${client.id}`;
  return page({ title: `Embudo · ${client.nombre}`, side: side('clientes'), body: html`${hero({ kicker: 'Embudo de ventas', title: client.nombre, letra: client.nombre, tabs: [[`${b}?tab=leads`, '← Leads', false], [`${b}/embudo`, 'Embudo', true], [`${b}/analitica`, 'Analítica', false]] })}${embudoSection(client, leads, { base: b, ...opts })}` });
}
export function importarPage(client, { leido = null, token = '', error = '' } = {}) {
  const b = `/admin/clientes/${client.id}`;
  const n = (x) => Number(x).toLocaleString('es-MX');
  const TIPO = { nuevo: 'Nuevo', conversacion: 'En conversación', cita: 'Cita o visita', cliente: 'Cliente', perdido: 'Perdido', archivo: 'Base de datos' };
  const body = html`${hero({ kicker: 'Importar contactos', title: client.nombre, letra: client.nombre, sub: 'Sube un CSV con tus contactos (de Leadsales, de otro CRM o de Excel). Primero ves cómo va a quedar y luego confirmas.',
    tabs: [[`${b}/embudo`, '← Embudo', false]] })}
  ${error ? html`<div class="err">${error}</div>` : ''}
  ${leido ? html`<div class="card"><span class="mono">Vista previa</span>
      <h3 style="margin:8px 0 4px">${n(leido.contactos.length)} contactos listos${leido.raros.length ? html` · <span style="color:#fbbf24">${n(leido.raros.length)} filas sin teléfono ni correo (no se importan)</span>` : ''}</h3>
      <p class="muted small">Columnas reconocidas: ${Object.entries(leido.columnas || {}).map(([k, c]) => `${c}`).join(', ')}.</p>
      <p class="muted small">${Object.entries(leido.canales).map(([k, v]) => `${({ whatsapp: 'WhatsApp', instagram: 'Instagram', facebook: 'Messenger' })[k] || k}: ${n(v)}`).join(' · ')}. Los que ya existan (mismo teléfono o usuario) se actualizan, no se duplican.</p>
      <p class="muted small">${leido.reemplaza ? 'El archivo trae embudos y etapas: se van a crear estos (reemplazan los que tenga ahora el cliente). Después puedes renombrar etapas o cambiar su tipo en "Ajustar embudos y etapas".' : `Los contactos entran a los embudos que ya tiene el cliente${leido.sinEtapa ? ` (${n(leido.sinEtapa)} traen una etapa que no existe aquí y entran a la primera)` : ''}.`}</p>
      <div class="an-g" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-top:10px">${leido.embudos.map((e) => html`<div class="card" style="margin:0"><b>${e.nombre}</b>
        <table style="margin-top:6px">${e.etapas.map((x) => html`<tr><td class="small">${x.nombre}</td><td class="small muted">${TIPO[x.tipo]}</td><td class="small" style="text-align:right">${n(x.n)}</td></tr>`)}</table></div>`)}</div>
      <form method="post" action="${b}/importar/confirmar" style="margin-top:16px"><input type="hidden" name="token" value="${token}"><button class="btn-accent">Importar ${n(leido.contactos.length)} contactos</button>
        <span class="muted small" style="margin-left:10px">Tarda unos segundos. El archivo se borra del servidor al terminar.</span></form></div>`
    : html`<form class="card" method="post" action="${b}/importar" enctype="multipart/form-data" style="max-width:620px"><span class="mono">Archivo CSV</span>
      <p class="muted small">Sube el archivo tal cual lo exporta el CRM (Leadsales, HubSpot, Kommo…) o un Excel guardado como CSV. Necesita al menos una columna de teléfono o de correo; también se leen nombre, empresa, etiquetas, valor, embudo, etapa y fechas si vienen.</p>
      <input type="file" name="archivo" accept=".csv,text/csv" required><p><button class="btn-accent">Ver vista previa</button></p></form>`}`;
  return page({ title: `Importar · ${client.nombre}`, side: side('clientes'), body });
}
export function adminAnaliticaPage(client, a) {
  const b = `/admin/clientes/${client.id}`;
  return page({ title: `Analítica · ${client.nombre}`, side: side('clientes'), body: html`${hero({ kicker: 'Analítica', title: client.nombre, letra: client.nombre, tabs: [[`${b}?tab=leads`, '← Leads', false], [`${b}/embudo`, 'Embudo', false], [`${b}/analitica`, 'Analítica', true]] })}${analiticaSection(client, a, { base: b })}` });
}
export function appChatPage(client, lead, mensajes, opts = {}) {
  return leadChatPage(client, lead, mensajes, { ...opts, back: '/app/leads', sideBar: sideApp('leads', client) });
}
function tiktokCard(client) {
  let tk = null; try { tk = clientCredentials(client)?.tiktok; } catch { /* sin credenciales */ }
  return html`<div class="card" style="max-width:520px;margin-top:18px"><span class="mono">TikTok</span>
    ${tk?.access_token
      ? html`<p><span class="badge" style="color:#4ade80">Conectado</span> Publicamos en tu perfil solo los videos que tú apruebes, con la privacidad que elijas.</p>
        <form method="post" action="/app/cuenta/tiktok/desconectar" onsubmit="return confirm('¿Desconectar TikTok? Borraremos el acceso.')"><button class="btn-warn">Desconectar TikTok</button></form>`
      : html`<p class="muted small">Inicia sesión en TikTok y autoriza a Kuper Social para publicar en tu perfil los videos que apruebes. Puedes desconectarlo cuando quieras.</p>
        <p><a class="btn-accent" href="/app/cuenta/tiktok/conectar" style="text-decoration:none;display:inline-block">Conectar TikTok</a></p>`}
    <p class="muted small">Más información en nuestro <a href="/privacidad" target="_blank">aviso de privacidad</a>.</p></div>`;
}

export function cuentaPage(user, { error = '', ok = '', client = null, dosPasos = null } = {}) {
  const body = html`${hero({ kicker: 'Mi cuenta', title: user.nombre, letra: user.nombre, sub: user.email })}
  ${error ? html`<div class="err">${error}</div>` : ''}${ok ? html`<div class="okmsg">${ok}</div>` : ''}
  <form class="card" method="post" action="/app/cuenta" style="max-width:520px">
    <span class="mono">Cambiar contraseña</span>
    <label>Contraseña actual</label><input type="password" name="actual" autocomplete="current-password" required>
    <label>Nueva contraseña (mínimo 10 caracteres)</label><input type="password" name="nueva" autocomplete="new-password" minlength="10" required>
    <label>Repite la nueva</label><input type="password" name="nueva2" autocomplete="new-password" minlength="10" required>
    <p><button class="btn-accent">Guardar</button></p></form>
  ${client && user.rol === 'cliente' && tiene(client, 'redes') ? tiktokCard(client) : ''}
  ${user.rol === 'cliente' ? html`<div class="card" style="max-width:520px;margin-top:18px"><span class="mono">Avisos en este celular o compu</span>
    <p class="muted small" style="margin:6px 0 10px">Te avisamos al momento de un lead nuevo o de un cliente que espera respuesta. En el celular, primero instala el panel: en el menú del navegador toca “Agregar a pantalla de inicio”.</p>
    <button class="btn-accent" type="button" id="btnAvisos">Activar avisos</button> <span class="small muted" id="estAvisos"></span>
    <script>(() => { const b = document.getElementById('btnAvisos'), e = document.getElementById('estAvisos');
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) { b.disabled = true; e.textContent = 'Este navegador no acepta avisos. En iPhone, instala el panel en la pantalla de inicio y ábrelo desde ahí.'; return; }
      const b64 = (s) => { const p = '='.repeat((4 - s.length % 4) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))); };
      navigator.serviceWorker.ready.then((reg) => reg.pushManager.getSubscription()).then((s) => { if (s) { b.textContent = 'Desactivar avisos'; e.textContent = 'Activos en este dispositivo.'; } });
      b.addEventListener('click', async () => {
        const reg = await navigator.serviceWorker.ready; const actual = await reg.pushManager.getSubscription();
        if (actual) { await fetch('/app/push/quitar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: actual.endpoint }) }); await actual.unsubscribe(); b.textContent = 'Activar avisos'; e.textContent = 'Desactivados.'; return; }
        if (await Notification.requestPermission() !== 'granted') { e.textContent = 'No diste permiso de notificaciones.'; return; }
        const { llave } = await (await fetch('/app/push/llave')).json();
        const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(llave) });
        const r = await fetch('/app/push/suscribir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
        e.textContent = r.ok ? 'Listo: te llegarán los avisos aquí.' : 'No se pudo activar.'; if (r.ok) b.textContent = 'Desactivar avisos'; }); })();</script></div>` : ''}
  <div class="card" style="max-width:520px;margin-top:18px"><span class="mono">Verificación en dos pasos</span>
    ${user.totp_enc ? html`<p><span class="badge" style="color:#4ade80">Activa</span> Al entrar te pedimos un código de tu app de autenticación.</p>
      <form method="post" action="/app/cuenta/2fa/quitar" class="row"><input name="codigo" inputmode="numeric" maxlength="7" required placeholder="Código actual" style="max-width:180px"><button class="btn-warn">Quitarla</button></form>`
    : dosPasos ? html`<p>1. Instala <b>Google Authenticator</b> o <b>Authy</b> en tu teléfono.<br>2. En la app toca <b>+</b> → "Ingresar clave de configuración" y pega esta clave (o <a href="${dosPasos.url}">ábrela en tu teléfono</a>):</p>
      <p><code style="user-select:all;font-size:16px;letter-spacing:.08em;word-break:break-all">${dosPasos.secreto.replace(/(.{4})/g, '$1 ').trim()}</code></p>
      <form method="post" action="/app/cuenta/2fa/activar"><input type="hidden" name="token" value="${dosPasos.token}"><label>3. Escribe el código de 6 dígitos que te muestra la app</label>
        <div class="row"><input name="codigo" inputmode="numeric" maxlength="7" required placeholder="123 456" style="max-width:180px"><button class="btn-accent">Activar</button></div></form>`
    : html`<p class="muted small">Además de tu contraseña, te pediremos un código de tu teléfono al entrar. Así, aunque alguien sepa tu contraseña, no puede entrar.</p>
      <form method="post" action="/app/cuenta/2fa/iniciar"><button class="btn-accent">Activar verificación en dos pasos</button></form>`}
  </div>`;
  return page({ title: 'Mi cuenta', side: user.rol === 'admin' ? side('cuenta') : sideApp('cuenta', client), body });
}

export const adminSide = () => side('clientes');
export const appSide = (on, client) => sideApp(on, client);

// ------------------------------------------------------------ conectar WhatsApp (Embedded Signup de Meta)
// Dos caminos: conservar la app de WhatsApp Business en el celular (coexistencia) o un número nuevo solo para el agente.
function conectarWhatsapp(wa, { base, app }) {
  if (!wa || (!wa.listo && app && !wa.estado?.conectado)) return '';
  const e = wa.estado || {};
  const titulo = html`<span class="mono">WhatsApp</span>`;
  if (!wa.listo) return html`<div class="card" style="margin-bottom:18px">${titulo}<p class="muted small" style="margin:6px 0 0">Para mostrar el botón "Conectar WhatsApp", pon en el .env del panel META_APP_ID, META_CONFIG_ID y META_APP_SECRET de la app de Kuper (Tech Provider).</p></div>`;
  const id = String(wa.appId).replace(/\D/g, ''), cfgId = String(wa.configId).replace(/\D/g, ''), ver = String(wa.graph).replace(/[^v0-9.]/g, '');
  const estado = e.conectado
    ? html`<p style="margin:6px 0 0;font-size:17px"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:8px;background:#4ade80"></span>Conectado: ${e.numero || e.phone_id}${e.nombre ? ` · ${e.nombre}` : ''}</p>
      <p class="muted small" style="margin:4px 0 0">${e.coexistencia ? 'Sigues usando tu app de WhatsApp Business en el celular; el agente contesta y tú ves todo en los dos lados.' : 'Número dedicado al agente: los mensajes se ven y se contestan aquí en el panel.'}</p>`
    : html`<p style="margin:6px 0 0;font-size:17px">Conecta tu WhatsApp para que tu agente conteste</p>
      <p class="muted small" style="margin:4px 0 0">Se abre una ventana de Meta: inicias sesión con la cuenta de Facebook de tu negocio y eliges tu número. Toma unos minutos.</p>`;
  if (!wa.agente) return html`<div class="card" style="margin-bottom:18px">${titulo}${estado}<p class="muted small" style="margin:8px 0 0">${app ? 'Kuper está terminando de preparar tu agente; en cuanto esté listo aparece aquí el botón.' : 'Falta la URL del agente de WhatsApp de esta marca (Configuración) para poder conectar.'}</p></div>`;
  return html`<div class="card" style="margin-bottom:18px">${titulo}${estado}
    <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:12px">
      <button type="button" class="btn-accent" onclick="waConectar(true)">${e.conectado ? 'Volver a conectar' : 'Conectar mi WhatsApp Business'}</button>
      <button type="button" class="btn-warn" onclick="waConectar(false)">Usar un número nuevo</button></div>
    <p class="muted small" style="margin:8px 0 0"><strong>Mi WhatsApp Business:</strong> conservas tu número y tu app en el celular (escanearás un código QR). <strong>Número nuevo:</strong> un número que no tenga WhatsApp; te llega un código por SMS.</p>
    <p class="muted small" id="wa-msg" style="margin:6px 0 0"></p>
    <form id="wa-form" method="post" action="${base}/agente/whatsapp" hidden><input name="code"><input name="waba_id"><input name="phone_number_id"><input name="evento"></form>
    <script async defer crossorigin="anonymous" src="https://connect.facebook.net/es_LA/sdk.js"></script>
    <script>${raw(`(function () {
      var sesion = null, msg = function (t) { document.getElementById('wa-msg').textContent = t; };
      window.fbAsyncInit = function () { FB.init({ appId: '${id}', autoLogAppEvents: true, xfbml: false, version: '${ver}' }); };
      window.addEventListener('message', function (ev) {
        try { if (!/(^|\.)facebook\.com$/.test(new URL(ev.origin).hostname)) return; } catch (e) { return; }
        var d; try { d = JSON.parse(ev.data); } catch (e) { return; }
        if (!d || d.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (/^FINISH/.test(d.event)) sesion = { waba_id: d.data && d.data.waba_id, phone_number_id: d.data && d.data.phone_number_id, evento: d.event };
        else if (d.event === 'CANCEL') msg('Se cerró la ventana antes de terminar' + (d.data && d.data.current_step ? ' (paso: ' + d.data.current_step + ')' : '') + '. Intenta otra vez.');
        else if (d.event === 'ERROR') msg('Meta marcó un error: ' + ((d.data && d.data.error_message) || 'intenta otra vez.'));
      });
      window.waConectar = function (coex) {
        if (!window.FB) return msg('La ventana de Meta todavía está cargando. Espera un segundo y vuelve a tocar el botón.');
        sesion = null; msg('Abriendo la ventana de Meta…');
        var extras = { setup: {}, sessionInfoVersion: '3' };
        if (coex) extras.featureType = 'whatsapp_business_app_onboarding';
        FB.login(function (r) {
          var code = r && r.authResponse && r.authResponse.code;
          if (!code) return msg('No se completó la conexión. Si cerraste la ventana, intenta otra vez.');
          var n = 0, esperar = setInterval(function () {
            if (sesion || ++n > 20) {
              clearInterval(esperar);
              if (!sesion || !sesion.phone_number_id) return msg('Meta no nos dijo qué número elegiste. Intenta otra vez y termina todos los pasos.');
              var f = document.getElementById('wa-form');
              f.code.value = code; f.waba_id.value = sesion.waba_id; f.phone_number_id.value = sesion.phone_number_id; f.evento.value = sesion.evento;
              msg('Conectando tu número…'); f.submit();
            }
          }, 250);
        }, { config_id: '${cfgId}', response_type: 'code', override_default_response_type: true, extras: extras });
      };
    })();`)}</script></div>`;
}

// ------------------------------------------------------------ lo que sabe el agente
export function conocimientoPage(client, k, versiones, { base, app = false, ok = '', error = '', borrador = null, wa = null, pd = null } = {}) {
  const texto = borrador?.texto ?? k?.texto ?? CONOC.PLANTILLA, datos = borrador?.datos ?? k?.datos ?? {};
  const body = html`${hero({ kicker: 'Agente de IA', title: 'Lo que sabe tu agente', letra: client.nombre,
    sub: 'Servicios, precios, preguntas frecuentes, horarios y dirección. Tu agente lo usa para contestar; lo que no esté aquí, no lo inventa.',
    tabs: app ? [] : [[`/admin/clientes/${client.id}?tab=leads`, '← ' + client.nombre, false]],
    note: k ? ['Última versión', `${k.autor || '—'} · ${fmtDate(k.actualizado.replace(' ', 'T') + 'Z')}`] : ['Sin información', 'Escribe lo básico y guarda'] })}
  ${ok ? html`<div class="okmsg">${ok}</div>` : ''}${error ? html`<div class="err">${error}</div>` : ''}
  ${conectarWhatsapp(wa, { base, app })}
  ${(() => { const p = client.config?.agente_pausado === true;
    return html`<form class="card" method="post" action="${base}/agente/pausa" style="display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:18px;${p ? 'border-color:rgba(251,191,36,.45);background:rgba(251,191,36,.06)' : ''}">
      <input type="hidden" name="pausado" value="${p ? '0' : '1'}">
      <div><span class="mono">Estado del agente</span>
        <p style="margin:6px 0 0;font-size:17px"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:8px;background:${p ? '#fbbf24' : '#4ade80'}"></span>${p ? 'En pausa: no contesta ni manda seguimientos' : 'Activo: contesta solo'}</p>
        <p class="muted small" style="margin:4px 0 0">${p ? 'Los mensajes siguen llegando a Leads para que tu equipo conteste. Al reanudar no responde lo que llegó en la pausa.' : 'Si lo pausas, deja de contestar al momento; los mensajes siguen llegando aquí y te avisamos por correo.'}</p></div>
      <button class="${p ? 'btn-accent' : 'btn-warn'}" onclick="return confirm('${p ? '¿Reanudar el agente?' : '¿Pausar el agente? Dejará de contestar a todos.'}')">${p ? 'Reanudar agente' : 'Pausar agente'}</button></form>`; })()}
  ${tiene(client, 'llamadas') ? (() => { const p = client.config?.llamadas_pausado === true; const fuera = horarioIA(client).modo === 'fuera_de_horario';
    return html`<form class="card" method="post" action="${base}/agente/pausa-llamadas" style="display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:18px;${p ? 'border-color:rgba(251,191,36,.45);background:rgba(251,191,36,.06)' : ''}">
      <input type="hidden" name="pausado" value="${p ? '0' : '1'}">
      <div><span class="mono">Llamadas</span>
        <p style="margin:6px 0 0;font-size:17px"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:8px;background:${p ? '#fbbf24' : '#4ade80'}"></span>${p ? 'En pausa: todas las llamadas pasan a tu equipo' : fuera ? 'Activas fuera de horario: en el horario del equipo la llamada pasa a un asesor' : 'Activas: la asistente contesta todas las llamadas'}</p>
        <p class="muted small" style="margin:4px 0 0">${p ? 'La asistente solo saluda y transfiere al número de tu equipo.' : 'Sigue el "Horario de la IA" de abajo. Si la pausas, desde la siguiente llamada todas pasan a tu equipo.'}</p></div>
      <button class="${p ? 'btn-accent' : 'btn-warn'}" onclick="return confirm('${p ? '¿Reanudar las llamadas?' : '¿Pausar las llamadas? Todas pasarán a tu equipo.'}')">${p ? 'Reanudar llamadas' : 'Pausar llamadas'}</button></form>`; })() : ''}
  <form method="post" action="${base}/agente" style="display:grid;gap:18px;grid-template-columns:minmax(0,1.6fr) minmax(260px,1fr);align-items:start" class="kn">
    <style>@media (max-width:900px){.kn{grid-template-columns:1fr!important}}</style>
    <div class="card"><span class="mono">Información para tu agente</span>
      <textarea name="texto" maxlength="${CONOC.MAX_TEXTO}" style="min-height:460px;margin-top:10px;font:14px/1.55 ui-monospace,Menlo,monospace">${texto}</textarea>
      <p class="muted small">Escribe frases cortas y claras. Puedes usar títulos con # y listas con -. Se actualiza en tu agente en unos minutos.</p>
      <button class="btn-accent">Guardar</button></div>
    <div style="display:grid;gap:18px">
      <div class="card"><span class="mono">Datos fijos</span>
        ${Object.entries(CONOC.CAMPOS).map(([key, label]) => html`<label>${label}</label><input name="dato_${key}" maxlength="300" value="${datos[key] || ''}">`)}
        <p class="muted small">Se usan tal cual en recordatorios y correos (por ejemplo, la dirección de la entrevista).</p></div>
      <div class="card"><span class="mono">Versiones anteriores</span>
        ${versiones.length ? html`<table style="margin-top:6px">${versiones.map((v, i) => html`<tr><td class="small">${fmtDate(v.created_at.replace(' ', 'T') + 'Z')}<div class="muted small">${v.autor || '—'}</div></td>
          <td style="text-align:right">${i === 0 ? html`<span class="badge" style="color:#c9f53a">Actual</span>` : html`<button class="btn-warn" style="padding:6px 12px;font-size:13px" formaction="${base}/agente/restaurar/${v.id}" formnovalidate onclick="return confirm('¿Volver a esta versión?')">Restaurar</button>`}</td></tr>`)}</table>` : html`<p class="muted small">Aún no hay versiones.</p>`}
      </div>
    </div>
  </form>
  ${pd ? (() => { const paises = [...new Set([...pd.presentes.map(([p]) => p), ...Object.keys(pd.paises.asesores || {}), ...(pd.presentes.length ? [] : ['México', 'Colombia', 'Perú', 'Argentina'])])];
    const chk = (name, on, label, ayuda) => html`<label style="display:flex;gap:10px;align-items:flex-start;margin:6px 0"><input type="checkbox" name="${name}" value="1" ${on ? 'checked' : ''} style="width:18px;height:18px;margin-top:2px"><span>${label}<br><span class="muted small">${ayuda}</span></span></label>`;
    return html`<form class="card" method="post" action="${base}/agente/paises-documentos" style="margin-top:18px;display:grid;gap:12px">
      <span class="mono">Países y documentos</span>
      ${chk('paises_activo', pd.paises.activo, 'Clasificar por país según la lada del WhatsApp', '+52 México, +57 Colombia, +51 Perú, +54 Argentina… Cada contacto queda con la etiqueta de su país para filtrar el embudo y las campañas.')}
      ${pd.asesores.length ? html`<div class="small"><span class="muted">Asignar automáticamente a la persona de cada país</span>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;margin-top:6px">${paises.map((p) => html`<label class="small muted">${p}<select name="asesor_${encodeURIComponent(p)}"><option value="">— nadie —</option>${pd.asesores.map((a) => html`<option value="${a.id}" ${Number(pd.paises.asesores?.[p]) === a.id ? 'selected' : ''}>${a.nombre}</option>`)}</select></label>`)}</div></div>` : ''}
      ${chk('docs_activo', pd.docs.activo, 'Recibir documentos por WhatsApp', 'Los PDF, fotos y videos que manden se guardan en la ficha de cada contacto y, si conectas una carpeta, en tu Google Drive.')}
      <label class="small muted">Documentos que se piden (uno por línea; el agente palomea los que van llegando)<textarea name="requeridos" style="min-height:96px" placeholder="Constancia fiscal&#10;Identificación&#10;Comprobante de ventas&#10;Video pitch&#10;Perfil de TikTok">${(pd.docs.requeridos || []).join('\n')}</textarea></label>
      <label class="small muted">Cuando estén todos, mover a la etapa<select name="etapa_completos"><option value="">— no mover —</option>${pd.etapas.map((e) => html`<option value="${e.id}" ${pd.docs.etapa_completos === e.id ? 'selected' : ''}>${e.nombre}</option>`)}</select></label>
      <label class="small muted">Carpeta de Google Drive (link o ID)<input name="drive_carpeta" value="${pd.docs.drive_carpeta || ''}" placeholder="https://drive.google.com/drive/folders/…"></label>
      <p class="muted small" style="margin:0">La carpeta debe estar en una <b>unidad compartida</b> de Google Drive, compartida como “Administrador de contenido” con ${pd.saEmail ? html`<b>${pd.saEmail}</b>` : 'la cuenta de servicio del panel'}. Se ordena sola: país / negocio - nombre / archivo.</p>
      <div><button class="btn-accent">Guardar</button></div></form>`; })() : ''}
  ${(() => { const lista = CONOC.avisos(client), vig = new Set(CONOC.avisosVigentes(client).map((a) => a.id));
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
    return html`<div class="card" style="margin-top:18px"><span class="mono">Avisos por tiempo limitado</span>
    <p class="muted small" style="margin:6px 0 10px">Promociones, cierres por día festivo o productos agotados. Tu agente los usa solo hasta la fecha que pongas y después los olvida solo.</p>
    ${lista.length ? html`<div style="display:grid;gap:8px;margin-bottom:12px">${lista.map((a) => html`<form method="post" action="${base}/agente/avisos/${a.id}/quitar" style="display:flex;gap:10px;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.04)">
      <div><div>${a.texto}</div><div class="muted small">${vig.has(a.id) ? `Vigente hasta el ${a.hasta}` : `Venció el ${a.hasta}`}</div></div><button class="btn-warn" style="padding:6px 12px;font-size:13px">Quitar</button></form>`)}</div>` : ''}
    <form method="post" action="${base}/agente/avisos" style="display:grid;grid-template-columns:minmax(0,1fr) 170px auto;gap:8px;align-items:end" class="av">
      <style>@media (max-width:700px){.av{grid-template-columns:1fr!important}}</style>
      <div><label>Aviso</label><input name="texto" maxlength="500" required placeholder="Ej.: Este fin de semana 2x1 en hamburguesas clásicas"></div>
      <div><label>Vale hasta</label><input name="hasta" type="date" min="${hoy}" required></div>
      <button class="btn-accent">Agregar</button></form></div>`; })()}
  ${(() => { const h = horarioIA(client); const DIAS = [[1, 'Lun'], [2, 'Mar'], [3, 'Mié'], [4, 'Jue'], [5, 'Vie'], [6, 'Sáb'], [0, 'Dom']];
    const hora = (n) => `${n}:00`;
    return html`<form class="card" method="post" action="${base}/agente/horario" style="margin-top:18px"><span class="mono">Horario de la IA</span>
    <p class="muted small" style="margin:6px 0 10px">Si eliges "solo fuera del horario del equipo", en ese horario la IA no contesta: los mensajes te llegan aquí al panel para que tu equipo responda. Si nadie contesta, la IA retoma al terminar el horario. Así está ahora: <b>${MODOS_IA[h.modo]}</b>.</p>
    <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));align-items:end">
      <div><label>La IA contesta</label><select name="ia_modo">${Object.entries(MODOS_IA).map(([k, t]) => html`<option value="${k}" ${raw(k === h.modo ? 'selected' : '')}>${t}</option>`)}</select></div>
      <div><label>Entra el equipo</label><select name="de">${Array.from({ length: 24 }, (_, i) => html`<option value="${i}" ${raw(i === h.de ? 'selected' : '')}>${hora(i)}</option>`)}</select></div>
      <div><label>Sale el equipo</label><select name="a">${Array.from({ length: 24 }, (_, i) => i + 1).map((i) => html`<option value="${i}" ${raw(i === h.a ? 'selected' : '')}>${hora(i)}</option>`)}</select></div>
    </div>
    <label>Días del equipo</label><div class="row" style="gap:12px;flex-wrap:wrap">${DIAS.map(([d, t]) => html`<label style="font-weight:400;margin:0"><input type="checkbox" name="dias" value="${d}" style="width:auto" ${raw(h.dias.includes(d) ? 'checked' : '')}> ${t}</label>`)}</div>
    <p><button class="btn-accent">Guardar horario</button></p></form>`; })()}
  ${(() => { const on = AT.configurado(client), st = on ? AT.estado(client) : null; let a = {}; try { a = clientCredentials(client)?.airtable || {}; } catch { /* sin credenciales */ }
    const fmt = (iso) => (iso ? new Intl.DateTimeFormat('es-MX', { timeZone: config.timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—');
    return html`<div class="card" style="margin-top:18px"><span class="mono">Disponibilidad desde Airtable</span>
    <p class="muted small" style="margin:6px 0 10px">Conecta la tabla (o la vista) donde llevan qué oficinas están libres. Cada 15 minutos se lee y tus agentes solo ofrecen lo que esté disponible. El token debe ser de <b>solo lectura</b>.</p>
    ${on ? html`<p style="margin:0 0 10px">${st?.error ? html`<span class="badge" style="color:#f87171">Error</span> ${st.error}` : html`<span class="badge" style="color:#4ade80">Conectado</span> ${st?.n ?? 0} disponibles de ${st?.total ?? '—'} registros`} <span class="muted small">· última lectura ${fmt(st?.at)}</span></p>` : ''}
    <form method="post" action="${base}/agente/airtable" style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));align-items:end">
      <div><label>Link de la tabla o vista</label><input name="link" required placeholder="https://airtable.com/app…/tbl…/viw…" value="${a.base ? `https://airtable.com/${a.base}/${a.tabla}${a.vista ? `/${a.vista}` : ''}` : ''}"></div>
      <div><label>Token de acceso${on ? ' (déjalo vacío para conservar el actual)' : ''}</label><input name="token" type="password" autocomplete="off" ${raw(on ? '' : 'required')} placeholder="${on ? '•••••••• guardado' : 'pat…'}"></div>
      <div class="row" style="gap:8px"><button class="btn-accent">${on ? 'Guardar y leer ahora' : 'Conectar'}</button></div>
    </form>
    ${on ? html`<form method="post" action="${base}/agente/airtable/quitar" style="margin-top:8px" onsubmit="return confirm('¿Desconectar Airtable?')"><button class="btn-warn" style="padding:6px 12px;font-size:13px">Desconectar</button></form>
      ${st?.texto ? html`<details style="margin-top:10px"><summary class="small">Ver lo que reciben los agentes</summary><pre style="white-space:pre-wrap;font-size:12.5px;color:#cfc9bf">${st.texto}</pre></details>` : ''}` : ''}
    </div>`; })()}
  <div class="card" style="margin-top:18px"><span class="mono">Archivos para compartir</span>
    <p class="muted small" style="margin:6px 0 12px">Brochure, catálogo, menú, lista de precios… Tu agente los manda por WhatsApp cuando alguien los pide. PDF, imagen o video (máx. 16 MB para documentos).</p>
    ${(client.config?.archivos_agente || []).length ? html`<table style="margin-bottom:14px">${(client.config.archivos_agente).map((a) => html`<tr>
      <td><b>${a.nombre}</b><div class="muted small">Lo manda cuando: ${a.cuando || '—'}</div></td>
      <td class="small"><a href="/media/${path.basename(a.archivo)}" target="_blank" style="color:var(--accent)">Ver</a></td>
      <td style="text-align:right"><form method="post" action="${base}/agente/archivos/${a.id}/borrar" class="inline" onsubmit="return confirm('¿Quitar este archivo?')"><button class="btn-warn" style="padding:6px 12px;font-size:13px">Quitar</button></form></td></tr>`)}</table>` : html`<p class="muted small">Todavía no hay archivos.</p>`}
    <form method="post" action="${base}/agente/archivos" enctype="multipart/form-data" style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));align-items:end">
      <div><label>Nombre</label><input name="nombre" required maxlength="60" placeholder="Brochure de Red One"></div>
      <div><label>Cuándo mandarlo</label><input name="cuando" required maxlength="160" placeholder="cuando pidan brochure, presentación o más información"></div>
      <div><label>Archivo</label><input type="file" name="archivo" accept="application/pdf,image/png,image/jpeg,video/mp4" required></div>
      <div><button class="btn-accent">Subir archivo</button></div>
    </form></div>`;
  return page({ title: `Agente · ${client.nombre}`, side: app ? sideApp('agente', client) : side('clientes'), body });
}

// Entró con la contraseña maestra: no tiene cuenta propia todavía.
export function cuentaMaestraPage() {
  const body = html`${hero({ kicker: 'Mi cuenta', title: 'Contraseña maestra', letra: 'K', sub: 'Entraste con la contraseña del servidor, que no tiene cuenta propia ni verificación en dos pasos.' })}
  <div class="card" style="max-width:620px"><span class="mono">Para tener tu cuenta segura</span>
    <p>1. Ve a <a href="/admin/usuarios" style="color:var(--accent)">Usuarios</a> y crea uno con tu correo y el rol <b>Administrador</b>. Copia la contraseña temporal.</p>
    <p>2. Sal (botón de abajo a la izquierda) y entra con tu correo y esa contraseña.</p>
    <p>3. Vuelve aquí, a <b>Mi cuenta</b>: cambia la contraseña y activa la <b>verificación en dos pasos</b>.</p>
    <p class="muted small">Cuando ya entres con tu usuario, puedes apagar la contraseña maestra con ADMIN_MASTER_LOGIN=0 en el .env del servidor.</p>
    <a class="btn btn-accent" href="/admin/usuarios">Ir a Usuarios</a></div>`;
  return page({ title: 'Mi cuenta', side: side('cuenta'), body });
}

// ------------------------------------------------------------ agente de blog
const BLOG_COL = { generando: '#93b4ff', borrador: '#fbbf24', publicado: '#4ade80', rechazado: '#a39d93', error: '#f87171' };
const BLOG_TXT = { generando: 'Escribiendo…', borrador: 'Por revisar', publicado: 'Publicado', rechazado: 'Rechazado', error: 'Error' };
const FREQ_TXT = { diario: 'Diario', '3_por_semana': '3 por semana', '2_por_semana': '2 por semana', semanal: '1 por semana', quincenal: 'Cada 15 días', mensual: '1 al mes' };
function sitioForm(client, s = null) {
  const c = s?.config || {};
  const opt = (obj, sel) => Object.entries(obj).map(([k, l]) => html`<option value="${k}" ${raw(sel === k ? 'selected' : '')}>${l}</option>`);
  return html`<form method="post" action="/admin/clientes/${client.id}/blog/sitios${s ? `/${s.id}` : ''}">
    <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
      <div><label>Nombre del sitio</label><input name="nombre" required value="${s?.nombre || ''}" placeholder="Blog de Kuper"></div>
      <div><label>Dominio</label><input name="dominio" value="${s?.dominio || ''}" placeholder="https://misitio.com"></div>
      <div><label>Identificador (va en la conexión PHP)</label><input name="slug" value="${s?.slug || ''}" placeholder="se crea solo"></div>
      <div><label>Frecuencia</label><select name="frecuencia">${opt(FREQ_TXT, c.frecuencia || '3_por_semana')}</select></div>
      <div><label>Al terminar un artículo</label><select name="modo">${opt({ auto: 'Se publica solo y me avisa por correo', aprobacion: 'Lo reviso antes de publicar' }, c.modo || 'auto')}</select></div>
      <div><label>Imagen</label><select name="imagen">${opt({ pexels: 'Foto de Pexels (gratis)', ia: 'Imagen con IA', ninguna: 'Sin imagen' }, c.imagen || 'pexels')}</select></div>
      <div><label>Noticias de</label><select name="pais">${opt({ MX: 'México', ES: 'España', US: 'Estados Unidos (español)', AR: 'Argentina', CO: 'Colombia', CL: 'Chile', PE: 'Perú' }, c.pais || 'MX')}</select></div>
      <div><label>Largo (palabras)</label><input type="number" name="palabras" min="500" max="2500" step="100" value="${c.palabras || 900}"></div>
      <div><label>Autor (opcional)</label><input name="autor" value="${c.autor || ''}" placeholder="Equipo Kuper"></div>
    </div>
    <label>De qué trata el sitio y para quién escribe</label>
    <textarea name="descripcion" rows="3" placeholder="Blog de una agencia de marketing para dueños de PyMEs en México: tecnología, IA y ventas en línea, explicado fácil.">${c.descripcion || ''}</textarea>
    <label>Categorías (una por línea: Nombre | qué buscar en noticias)</label>
    <textarea name="categorias" rows="4" required placeholder="Inteligencia artificial | inteligencia artificial negocios\nMarketing digital | marketing digital México\nRedes sociales | redes sociales Instagram TikTok">${(c.categorias || []).map((x) => `${x.nombre} | ${x.busqueda}`).join('\n')}</textarea>
    <label>Tono</label><input name="tono" value="${c.tono || 'cercano, claro y profesional'}">
    <label>Fuentes RSS extra (opcional, una por línea)</label>
    <textarea name="fuentes_rss" rows="2" placeholder="https://www.xataka.com.mx/feedburner.xml">${(c.fuentes_rss || []).join('\n')}</textarea>
    <label class="variant" style="margin-top:10px;font-weight:400"><input type="checkbox" name="activo" value="1" ${raw(!s || s.activo ? 'checked' : '')}> Activo (escribe solo según la frecuencia)</label>
    <p><button class="btn-accent">${s ? 'Guardar sitio' : 'Agregar sitio'}</button></p>
  </form>`;
}
export function blogSection(client, { sitios = [], sel = null, articulos = [], pexelsListo = false, iaLista = false, panelUrl = '' }) {
  const s = sitios.find((x) => x.id === sel) || sitios[0] || null;
  const base = `/admin/clientes/${client.id}/blog`;
  const n = (st) => articulos.filter((a) => a.status === st).length;
  return html`
  ${!pexelsListo ? html`<div class="err">Falta la clave gratis de Pexels para las fotos. Sácala en pexels.com/api y guárdala en el servidor con: <code>sudo bash /opt/agente-social/social-agent/deploy/clave.sh PEXELS_API_KEY</code></div>` : ''}
  ${!iaLista ? html`<div class="err">Falta la clave de Gemini (GEMINI_TEXT_API_KEY) para escribir los artículos.</div>` : ''}
  <div class="pills">${sitios.map((x) => html`<a class="${x.id === s?.id ? 'on' : ''}" href="${base}?sitio=${x.id}">${x.nombre}${x.activo ? '' : ' (pausado)'}</a>`)}<a class="${!s ? 'on' : ''}" href="${base}?sitio=nuevo">+ Nuevo sitio</a></div>
  ${!s || sel === -1 ? html`<div class="card"><span class="mono">Nuevo sitio</span>${sitioForm(client)}</div>` : html`
  ${kpis([[n('borrador'), 'Por revisar', '#fbbf24', n('borrador') > 0], [n('publicado'), 'Publicados', '#4ade80', false], [n('generando'), 'Escribiendo', '#93b4ff', false], [n('error'), 'Con error', '#f87171', false]])}
  <div class="split">
    <div class="card"><span class="mono">Escribir ahora</span>
      <form method="post" action="${base}/sitios/${s.id}/generar" style="margin-top:10px">
        <label>Tema (opcional)</label><input name="tema" maxlength="300" placeholder="Si lo dejas vacío, busca la noticia del momento">
        <label>Categoría</label><select name="categoria"><option value="">La que toque</option>${s.config.categorias.map((c) => html`<option value="${c.slug}">${c.nombre}</option>`)}</select>
        <p style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn-accent" name="accion" value="ya">Escribir ahora</button><button class="btn-warn" name="accion" value="cola">Dejarlo para el siguiente</button></p>
      </form>
      ${s.config.temas_pendientes.length ? html`<p class="small muted">Temas en espera: ${s.config.temas_pendientes.map((t) => t.texto).join(' · ')}</p>` : ''}
      <p class="small muted">Escribe solo ${FREQ_TXT[s.config.frecuencia].toLowerCase()}, de madrugada, y ${s.config.modo === 'auto' ? 'lo publica solo' : 'lo deja para que lo revises'}. Tarda de 1 a 3 minutos.</p>
      <p class="small muted">Aviso de cada artículo nuevo: ${client.config.notificaciones?.email ? `correo a ${client.config.notificaciones.email}` : 'sin correo (ponlo en Configuración → notificaciones)'}.</p>
    </div>
    <div class="card"><span class="mono">Conexión con tu sitio PHP</span>
      <p class="small" style="margin-top:8px">En <code>blog/config.php</code> de tu sitio pon:</p>
      <pre class="small" style="white-space:pre-wrap">$PANEL_URL = '${panelUrl}';\n$SITIO = '${s.slug}';</pre>
      <p class="small muted">Lo publicado se ve en <a href="${panelUrl}/blog/${s.slug}/articulos.json" target="_blank" rel="noopener">${panelUrl}/blog/${s.slug}/articulos.json</a></p>
    </div>
  </div>
  <details class="card" style="margin-top:18px"><summary style="cursor:pointer"><strong>Escribirlo yo (pegar un artículo)</strong></summary>
    <form method="post" action="${base}/sitios/${s.id}/manual" style="margin-top:10px">
      <label>Título</label><input name="titulo" required maxlength="140">
      <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
        <div><label>Categoría</label><select name="categoria">${s.config.categorias.map((c) => html`<option value="${c.slug}">${c.nombre}</option>`)}</select></div>
        <div><label>Etiquetas (separadas por coma)</label><input name="etiquetas"></div>
        <div><label>Foto: qué buscar en Pexels (en inglés)</label><input name="busqueda_imagen" placeholder="cyber security server"></div>
      </div>
      <label>Meta descripción (opcional, 120 a 155 caracteres)</label><input name="meta_description" maxlength="170">
      <label>Contenido</label>
      <textarea name="contenido" rows="14" required placeholder="Párrafos separados por una línea en blanco.

## Así se pone un subtítulo

- así una lista
- otro punto"></textarea>
      <label>Fuentes (opcional, una por línea: Nombre | https://…)</label><textarea name="fuentes" rows="3"></textarea>
      <label class="variant" style="margin-top:10px;font-weight:400"><input type="checkbox" name="publicar" value="1" checked> Publicarlo de una vez</label>
      <p><button class="btn-accent">Guardar artículo</button></p>
    </form></details>
  <h2>Artículos</h2>
  ${articulos.length ? html`<div class="card" style="padding:8px 14px;overflow-x:auto"><table><tr><th>Artículo</th><th>Categoría</th><th>Estado</th><th>Fecha</th></tr>
    ${articulos.map((a) => html`<tr><td><a href="/admin/blog/articulos/${a.id}">${a.titulo || (a.status === 'generando' ? 'Escribiendo…' : a.error || 'Sin título')}</a>${a.tema_pedido ? html`<div class="small muted">Pedido: ${a.tema_pedido}</div>` : ''}</td>
      <td class="small">${s.config.categorias.find((c) => c.slug === a.categoria)?.nombre || a.categoria || '—'}</td>
      <td><span class="badge" style="color:${BLOG_COL[a.status]}">${BLOG_TXT[a.status] || a.status}</span></td>
      <td class="small muted">${fmtDate(a.published_at || (a.created_at && a.created_at.replace(' ', 'T') + 'Z'))}</td></tr>`)}</table></div>
    ${articulos.some((a) => a.status === 'generando') ? vigilar(articulos.map((a) => `${a.id}:${a.status}`).join(',')) : ''}`
    : html`<div class="card muted">Todavía no hay artículos. Usa "Escribir ahora" o espera a la madrugada.</div>`}
  <details class="card" style="margin-top:18px"><summary style="cursor:pointer"><strong>Ajustes del sitio</strong></summary>${sitioForm(client, s)}
    <form method="post" action="${base}/sitios/${s.id}/borrar" onsubmit="return confirm('¿Borrar el sitio y TODOS sus artículos? No se puede deshacer.')"><p><button class="btn-bad">Borrar sitio</button></p></form></details>`}`;
}
export function blogArticuloPage(a, sitio, client, { panelUrl = '', ok = '' } = {}) {
  const base = `/admin/blog/articulos/${a.id}`;
  const cat = sitio.config.categorias.find((c) => c.slug === a.categoria);
  const img = a.imagen_path ? `/media/${path.basename(a.imagen_path)}` : null;
  const body = html`<p><a href="/admin/clientes/${client.id}/blog?sitio=${sitio.id}">← ${sitio.nombre}</a></p>
  ${ok ? html`<div class="${/^Error/.test(ok) ? 'err' : 'okmsg'}">${ok.replace(/^Error: /, '')}</div>` : ''}
  ${a.status === 'generando' ? html`<div class="okmsg">Escribiendo el artículo… esta página se actualiza sola.</div>${vigilar(a.status)}` : ''}
  ${a.status === 'error' ? html`<div class="err">${a.error}</div>` : ''}
  ${a.advertencias?.length ? html`<div class="card" style="border-color:#fbbf24;margin-bottom:14px"><strong>Revisa esto</strong><ul class="small">${a.advertencias.map((w) => html`<li>${w}</li>`)}</ul></div>` : ''}
  <div class="row" style="gap:10px;flex-wrap:wrap;margin-bottom:14px">
    <span class="badge" style="color:${BLOG_COL[a.status]}">${BLOG_TXT[a.status]}</span>
    ${['borrador', 'rechazado'].includes(a.status) ? html`<form method="post" action="${base}/publicar" class="inline"><button class="btn-accent">Publicar</button></form>` : ''}
    ${a.status === 'publicado' ? html`<form method="post" action="${base}/despublicar" class="inline"><button class="btn-warn">Quitar del sitio</button></form>
      ${sitio.dominio ? html`<a class="btn btn-warn" href="${sitio.dominio}/blog/${a.slug}" target="_blank" rel="noopener">Ver en el sitio ↗</a>` : ''}` : ''}
    ${a.status === 'borrador' ? html`<form method="post" action="${base}/rechazar" class="inline"><button class="btn-warn">Rechazar</button></form>` : ''}
    <form method="post" action="${base}/borrar" class="inline" onsubmit="return confirm('¿Borrar este artículo?')"><button class="btn-bad">Borrar</button></form>
  </div>
  ${a.titulo ? html`<div class="split">
    <article class="card">
      ${img ? html`<img src="${img}" alt="${a.imagen_alt || ''}" style="width:100%;border-radius:16px;aspect-ratio:1.91/1;object-fit:cover">` : ''}
      ${a.imagen_credito?.autor ? html`<p class="small muted">Foto de <a href="${a.imagen_credito.autor_url}" target="_blank" rel="noopener">${a.imagen_credito.autor}</a> en <a href="${a.imagen_credito.url}" target="_blank" rel="noopener">Pexels</a></p>` : ''}
      <details class="card" style="margin:10px 0 16px;padding:12px 14px"><summary style="cursor:pointer"><strong>Cambiar imagen</strong></summary>
        <form method="post" action="${base}/imagen" enctype="multipart/form-data" style="margin-top:10px"><label>Subir una tuya (JPG o PNG, horizontal)</label>
          <input type="file" name="archivo" accept="image/jpeg,image/png,image/webp" required><p><button class="btn-accent">Subir imagen</button></p></form>
        <form method="post" action="${base}/imagen"><label>O buscar otra foto en Pexels (en inglés funciona mejor)</label>
          <div class="row" style="gap:8px"><input name="busqueda" required placeholder="online store, textile factory…"><button class="btn-warn">Buscar otra</button></div></form>
        ${img ? html`<form method="post" action="${base}/imagen" style="margin-top:10px"><input type="hidden" name="accion" value="quitar"><button class="btn-bad">Quitar imagen</button></form>` : ''}
      </details>
      <span class="mono">${cat?.nombre || a.categoria}</span>
      <h1 style="font-size:30px;margin:8px 0">${a.titulo}</h1>
      <p class="muted">${a.extracto}</p>
      <style>.blog-cuerpo h2,.blog-cuerpo h3{font:600 22px/1.3 inherit;text-transform:none;letter-spacing:-.01em;margin:24px 0 8px;color:var(--ink)}.blog-cuerpo h3{font-size:18px}</style>
      <div class="blog-cuerpo" style="line-height:1.7">${raw(a.contenido_html || '')}</div>
      ${a.fuentes?.length ? html`<p class="small muted">Fuentes: ${a.fuentes.map((f, i) => html`${i ? ' · ' : ''}<a href="${f.url}" target="_blank" rel="noopener nofollow">${f.titulo}</a>`)}</p>` : ''}
    </article>
    <form class="card" method="post" action="${base}/editar"><span class="mono">SEO y edición</span>
      <div class="card" style="background:#fff;color:#202124;padding:12px 14px;margin:10px 0;border-radius:12px">
        <div style="font-size:12px;color:#4d5156">${sitio.dominio || 'tusitio.com'} › blog › ${a.slug}</div>
        <div style="font-size:18px;color:#1a0dab;margin:2px 0">${a.meta_title || a.titulo}</div>
        <div style="font-size:13px;color:#4d5156">${a.meta_description}</div></div>
      <p class="small muted">Así se vería en Google. Palabra clave: <b>${a.palabra_clave || '—'}</b></p>
      <label>Título</label><input name="titulo" value="${a.titulo}">
      <label>Meta título (máx. 60)</label><input name="meta_title" maxlength="70" value="${a.meta_title || ''}">
      <label>Meta descripción (120 a 155)</label><textarea name="meta_description" rows="3" maxlength="170">${a.meta_description || ''}</textarea>
      <label>URL (slug)</label><input name="slug" value="${a.slug || ''}">
      <label>Categoría</label><select name="categoria">${sitio.config.categorias.map((c) => html`<option value="${c.slug}" ${raw(c.slug === a.categoria ? 'selected' : '')}>${c.nombre}</option>`)}</select>
      <label>Etiquetas (separadas por coma)</label><input name="etiquetas" value="${(a.etiquetas || []).join(', ')}">
      <label>Extracto</label><textarea name="extracto" rows="2">${a.extracto || ''}</textarea>
      <label>Descripción de la imagen (para Google y personas que no la ven)</label><input name="imagen_alt" maxlength="200" value="${a.imagen_alt || ''}">
      <label>Contenido (HTML)</label><textarea name="contenido_html" rows="14" style="font-family:monospace;font-size:12px">${a.contenido_html || ''}</textarea>
      <p><button class="btn-accent">Guardar cambios</button></p>
    </form>
  </div>` : ''}`;
  return page({ title: `Blog · ${a.titulo || 'Artículo'}`, side: side('clientes'), body });
}

// ------------------------------------------------------------ facturación (Factura.com)
const FAC_COL = { emitida: '#4ade80', pendiente: '#fbbf24', error: '#f87171', omitida: '#a39d93' };
const FAC_TXT = { emitida: 'Emitida', pendiente: 'Pendiente', error: 'Error', omitida: 'Omitida' };
export function facturacionPage({ ajustes: a, conectado, sandbox, series = [], seriesError = '', facturas = [], ok = '', error = '' }) {
  const serieSel = `${a.serie_id}|${a.serie_nombre}`;
  const body = html`${hero({ kicker: 'Facturación', title: 'Facturas automáticas', sub: 'Cada cobro de Stripe se factura solo con Factura.com y le llega al cliente por correo.' })}
  ${ok ? html`<div class="okmsg">${ok}</div>` : ''}${error ? html`<div class="err">${error}</div>` : ''}
  ${!conectado ? html`<div class="err">Faltan las claves de Factura.com. En el servidor corre:<br><code>sudo bash /opt/agente-social/social-agent/deploy/clave.sh FACTURACOM_API_KEY</code><br><code>sudo bash /opt/agente-social/social-agent/deploy/clave.sh FACTURACOM_SECRET_KEY</code><br>(Las sacas en Factura.com → Desarrolladores → API → Datos de acceso.)</div>` : ''}
  ${sandbox ? html`<div class="okmsg">Modo de pruebas (sandbox): las facturas no tienen validez fiscal.</div>` : ''}
  ${seriesError ? html`<div class="err">Factura.com respondió: ${seriesError}</div>` : ''}
  <div class="split">
    <form class="card" method="post" action="/admin/facturacion"><span class="mono">Ajustes</span>
      <label>Serie de tus facturas</label>
      <select name="serie">${!series.length ? html`<option value="${serieSel}">${a.serie_nombre || (conectado ? 'No hay series (créalas en Factura.com → Configuración → Series)' : 'Conecta Factura.com para ver tus series')}</option>` : ''}
        ${series.map((s) => html`<option value="${s.id}|${s.nombre}" ${raw(s.id === a.serie_id ? 'selected' : '')}>${s.nombre}${s.descripcion ? ` · ${s.descripcion}` : ''}</option>`)}</select>
      <label>Clave de producto o servicio del SAT (te la da tu contador)</label><input name="clave_prod_serv" inputmode="numeric" maxlength="8" value="${a.clave_prod_serv}" placeholder="8 números, ej. 81112100">
      <div style="display:grid;gap:12px;grid-template-columns:1fr 2fr"><div><label>Clave de unidad</label><input name="clave_unidad" value="${a.clave_unidad}"></div><div><label>Unidad</label><input name="unidad" value="${a.unidad}"></div></div>
      <label class="variant" style="margin-top:10px;font-weight:400"><input type="checkbox" name="activo" value="1" ${raw(a.activo ? 'checked' : '')}> Facturar automáticamente cada cobro</label>
      <p><button class="btn-accent">Guardar</button></p>
      <p class="muted small">Se factura con método PUE y forma de pago 04 (tarjeta de crédito) o 28 (débito), según la tarjeta. Uso del CFDI, RFC, régimen y código postal salen de lo que el cliente capturó en su página de Pagos.</p>
    </form>
    <div class="card"><span class="mono">Cómo funciona</span>
      <ol class="small" style="line-height:1.7;margin:10px 0 0;padding-left:18px">
        <li>Stripe cobra la mensualidad o un extra.</li>
        <li>El panel da de alta al cliente en Factura.com (la primera vez) y timbra la factura con el IVA desglosado.</li>
        <li>Factura.com le manda el PDF y el XML por correo; el cliente también los ve en su página de Pagos.</li>
        <li>Si al cliente le faltan sus datos fiscales, queda "Pendiente" y se factura sola en cuanto los capture.</li>
      </ol>
      <form method="post" action="/admin/facturacion/reintentar" style="margin-top:14px"><button class="btn-warn">Reintentar pendientes y con error</button></form>
    </div>
  </div>
  <h2>Facturas</h2>
  ${facturas.length ? html`<div class="card" style="padding:8px 14px;overflow-x:auto"><table><tr><th>Fecha</th><th>Cliente</th><th>Folio</th><th style="text-align:right">Total</th><th>Estado</th><th></th></tr>
    ${facturas.map((f) => html`<tr><td class="small">${fmtDate(f.created_at.replace(' ', 'T') + 'Z')}</td><td>${f.cliente}</td><td class="small">${f.folio ? `${f.serie || ''}${f.folio}` : '—'}${f.uuid ? html`<div class="muted" style="font-size:11px">${f.uuid}</div>` : ''}</td>
      <td style="text-align:right">${mxn(f.total)}</td><td><span class="badge" style="color:${FAC_COL[f.status]}">${FAC_TXT[f.status] || f.status}</span>${f.error ? html`<div class="small" style="color:#fbbf24;max-width:320px">${f.error}</div>` : ''}</td>
      <td class="small">${f.status === 'emitida' ? html`<a href="/admin/facturacion/${f.id}/pdf">PDF</a> · <a href="/admin/facturacion/${f.id}/xml">XML</a>` : ''}</td></tr>`)}</table></div>`
    : html`<div class="card muted">Todavía no hay facturas. Aparecen aquí con cada cobro de Stripe.</div>`}`;
  return page({ title: 'Facturación', side: side('facturacion'), body });
}

// ------------------------------------------------------------ agente de comentarios
export function comentariosPage(client, { lista = [], resumen = {}, aj = {}, base, app = false, filtro = '', ok = '', error = '', credsOk = true, ESTADOS = {}, INTENCIONES = {} }) {
  const fecha = (t) => (t ? new Date(t).toLocaleString('es-MX', { timeZone: config.timezone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  const chk = (k, label, ayuda) => html`<label style="display:flex;gap:10px;align-items:flex-start;margin:8px 0"><input type="checkbox" name="${k}" value="1" ${aj[k] ? 'checked' : ''} style="width:18px;height:18px;margin-top:2px"><span>${label}<br><span class="muted small">${ayuda}</span></span></label>`;
  const filtros = [['', 'Todos'], ['por_aprobar', `Por aprobar${resumen.por_aprobar ? ` (${resumen.por_aprobar})` : ''}`], ['queja', 'Quejas'], ['compra', 'Quieren comprar'], ['oculto', 'Ocultos']];
  const p = aj.pausado;
  const estado = !aj.activo ? ['Apagado', '#a39d93', 'Actívalo abajo para que empiece a contestar.'] : p ? ['En pausa', '#fbbf24', 'No contesta nada; la configuración se queda igual.']
    : aj.revision ? ['Activo con revisión', '#93b4ff', 'Prepara las respuestas y tu equipo las aprueba antes de que salgan.'] : ['Activo', '#4ade80', 'Contesta solo cada pocos minutos.'];
  const tarjeta = (c) => {
    const [et, col] = ESTADOS[c.status] || [c.status, '#a39d93'];
    const edita = c.status === 'por_aprobar' || c.status === 'error';
    return html`<div class="card" style="margin-bottom:12px">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <span class="chip"><i style="background:${c.canal === 'instagram' ? '#e1306c' : '#4f7cff'}"></i>${c.canal === 'instagram' ? 'Instagram' : 'Facebook'}${c.anuncio ? ' · anuncio' : ''}</span>
          <b>${c.usuario || 'Alguien'}</b><span class="muted small">${fecha(c.comentado_at || c.created_at)}</span>
          ${c.intencion ? html`<span class="chip" style="color:${c.intencion === 'queja' ? '#f87171' : c.intencion === 'compra' ? '#c9f53a' : '#cfc9bf'}">${INTENCIONES[c.intencion] || c.intencion}</span>` : ''}
        </div>
        <span class="chip"><i style="background:${col}"></i>${et}</span>
      </div>
      <p style="margin:10px 0 4px;font-size:16px">“${c.texto || ''}”</p>
      ${c.post_link ? html`<p class="muted small" style="margin:0"><a href="${c.post_link}" target="_blank" rel="noopener">Ver publicación</a>${c.post_texto ? ` · ${String(c.post_texto).slice(0, 90)}${String(c.post_texto).length > 90 ? '…' : ''}` : ''}</p>` : ''}
      ${edita ? html`<form method="post" action="${base}/comentarios/${encodeURIComponent(c.comment_id)}/aprobar" style="margin-top:12px;display:grid;gap:8px">
          ${c.ocultar ? html`<p class="small" style="margin:0;color:#fbbf24">La IA propone ocultarlo (parece spam u ofensivo).</p>` : html`
          <label class="small muted">Respuesta pública<textarea name="publica" maxlength="1000" style="min-height:60px">${c.publica || ''}</textarea></label>
          <label class="small muted">Mensaje directo${c.canal === 'instagram' ? '' : ' (Messenger)'}<textarea name="dm" maxlength="1000" style="min-height:60px">${c.dm || ''}</textarea></label>`}
          ${c.error ? html`<p class="small" style="margin:0;color:#f87171">Error: ${c.error}</p>` : ''}
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-accent">${c.ocultar ? 'Ocultar' : 'Aprobar y enviar'}</button>
          <button class="btn-warn" formaction="${base}/comentarios/${encodeURIComponent(c.comment_id)}/descartar">Descartar</button></div></form>`
      : html`${c.publica ? html`<p class="small" style="margin:10px 0 0"><span class="muted">Respuesta pública:</span> ${c.publica}</p>` : ''}
        ${c.dm ? html`<p class="small" style="margin:6px 0 0"><span class="muted">Mensaje directo:</span> ${c.dm}</p>` : ''}
        ${c.autor && c.autor !== 'IA' ? html`<p class="muted small" style="margin:6px 0 0">Aprobó: ${c.autor}</p>` : ''}`}
    </div>`;
  };
  const body = html`${hero({ kicker: 'Agente de comentarios', title: 'Comentarios', letra: client.nombre,
      sub: 'La IA contesta los comentarios de tus publicaciones y anuncios con lo que sabe tu agente, lleva al mensaje directo a quien quiere comprar y oculta el spam.',
      note: ['Últimos 30 días', `${resumen.total || 0} comentarios · ${resumen.contestados || 0} contestados · ${resumen.compra || 0} quieren comprar`] })}
    ${ok ? html`<div class="okmsg">${ok}</div>` : ''}${error ? html`<div class="err">${error}</div>` : ''}
    ${!credsOk ? html`<div class="err">Falta conectar la página de Facebook e Instagram de esta marca (token de la página). Kuper lo configura.</div>` : ''}
    <div style="display:grid;gap:18px;grid-template-columns:minmax(0,1.6fr) minmax(280px,1fr);align-items:start" class="cm">
      <style>@media (max-width:900px){.cm{grid-template-columns:1fr!important}}</style>
      <div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${filtros.map(([k, t]) => html`<a class="${filtro === k ? 'btn-accent' : 'btn-warn'}" style="text-decoration:none;padding:8px 14px;border-radius:99px" href="${base}/comentarios${k ? `?f=${k}` : ''}">${t}</a>`)}</div>
        ${lista.length ? lista.map(tarjeta) : html`<div class="card muted">${aj.activo ? 'Todavía no hay comentarios nuevos. Los comentarios que ya existían antes de activarlo no se contestan.' : 'Cuando lo actives, aquí verás cada comentario y lo que contestó la IA.'}</div>`}
      </div>
      <div style="display:grid;gap:18px">
        ${aj.activo ? html`<form class="card" method="post" action="${base}/comentarios/pausa">
          <input type="hidden" name="pausado" value="${p ? '0' : '1'}">
          <span class="mono">Estado</span>
          <p style="margin:6px 0 0;font-size:17px"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:8px;background:${estado[1]}"></span>${estado[0]}</p>
          <p class="muted small" style="margin:4px 0 12px">${estado[2]}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="${p ? 'btn-accent' : 'btn-warn'}">${p ? 'Reanudar' : 'Pausar'}</button>
          ${!p ? html`<button class="btn-warn" formaction="${base}/comentarios/revisar">Revisar ahora</button>` : ''}</div></form>` : ''}
        <form class="card" method="post" action="${base}/comentarios/ajustes">
          <span class="mono">Ajustes</span>
          ${chk('activo', 'Activar el agente de comentarios', 'Empieza con los comentarios que lleguen desde ahora.')}
          ${chk('instagram', 'Instagram', 'Comentarios de tus publicaciones y reels.')}
          ${chk('facebook', 'Facebook', 'Comentarios de tu página.')}
          ${chk('anuncios', 'Anuncios de Facebook', 'También los comentarios de tus anuncios.')}
          ${chk('publico', 'Contestar en público', 'Una respuesta corta debajo del comentario.')}
          ${chk('dm', 'Mandar mensaje directo', 'A quien quiere comprar, cotizar o pregunta algo que no va en público.')}
          ${chk('ocultar', 'Ocultar spam y ofensas', 'Nunca oculta quejas reales.')}
          ${chk('revision', 'Revisar antes de enviar', 'Nada sale hasta que alguien de tu equipo lo aprueba aquí.')}
          <label class="small muted" style="display:block;margin-top:10px">Indicaciones para la IA (opcional)
            <textarea name="instrucciones" maxlength="2000" style="min-height:110px" placeholder="Ej.: No des precios en público, manda el menú por mensaje. A las quejas pide su número de pedido.">${aj.instrucciones || ''}</textarea></label>
          <p class="muted small">Contesta con lo que tienes en <a href="${base}/agente">Lo que sabe tu agente</a>.</p>
          <button class="btn-accent">Guardar</button>
        </form>
      </div>
    </div>`;
  return page({ title: `Comentarios · ${client.nombre}`, side: app ? sideApp('comentarios', client) : side('clientes'), body });
}

// ------------------------------------------------------------ campañas de WhatsApp (difusión)
export function difusionPage(client, { recordatorios: rec = {}, recRecientes = [], campanas = [], plantillas = null, errorPlantillas = '', directo = false, agente = false, embudos = [], base, app = false, form = {}, seg = null,
  ESTADOS = {}, FUENTES = {}, FRECUENCIA = 7, ok = '', error = '' }) {
  const f = form.filtros || {};
  const fecha = (t) => (t ? new Date(String(t).replace(' ', 'T') + 'Z').toLocaleString('es-MX', { timeZone: config.timezone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  const n = (x) => Number(x || 0).toLocaleString('es-MX');
  const etapasTodas = embudos.flatMap((e) => e.etapas.map((x) => ({ id: x.id, nombre: embudos.length > 1 ? `${e.nombre} · ${x.nombre}` : x.nombre })));
  const sel = (name, opciones, valor) => html`<select name="${name}">${opciones.map(([v, t]) => html`<option value="${v}" ${String(valor ?? '') === String(v) ? 'selected' : ''}>${t}</option>`)}</select>`;
  const resumenFiltros = (x = {}) => [x.etapas?.length ? `Etapas: ${x.etapas.map((id) => etapasTodas.find((e) => e.id === id)?.nombre || id).join(', ')}` : '', x.tags?.length ? `Etiquetas: ${x.tags.join(', ')}` : '',
    x.origen ? `Canal: ${x.origen}` : '', x.resultado ? `Resultado: ${x.resultado}` : '', x.sin_actividad !== null && x.sin_actividad !== undefined ? `${x.sin_actividad}+ días sin actividad` : '',
    x.max_dias !== null && x.max_dias !== undefined ? `Llegaron en los últimos ${x.max_dias} días` : ''].filter(Boolean).join(' · ') || 'Todos los contactos con WhatsApp';
  const camp = (c) => {
    const [et, col] = ESTADOS[c.estado] || [c.estado, '#a39d93'];
    const acc = (a, t, cls = 'btn-warn', conf = '') => html`<button class="${cls}" formaction="${base}/difusion/${c.id}/${a}" ${conf ? raw(`onclick="return confirm('${conf}')"`) : ''}>${t}</button>`;
    return html`<form method="post" class="card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><b style="font-size:18px">${c.nombre}${c.recurrente ? html` <span class="badge" style="color:#93b4ff">Automática</span>` : ''}</b><span class="chip"><i style="background:${col}"></i>${et}</span></div>
      <p class="muted small" style="margin:6px 0 0">Plantilla <b>${c.plantilla}</b> (${c.idioma}) · ${resumenFiltros(c.filtros)} · tope ${n(c.tope_diario)} al día</p>
      ${c.cuerpo ? html`<p class="small" style="margin:8px 0 0;padding:10px 12px;border-radius:12px;background:rgba(74,222,128,.08);white-space:pre-wrap">${c.cuerpo}</p>` : ''}
      <div class="kpis" style="margin-top:12px">${[[c.total, 'Contactos', '#93b4ff'], [c.enviados, 'Enviados', '#4ade80'], [c.pendientes, 'Pendientes', '#fbbf24'], [c.respondieron, 'Respondieron', '#c9f53a'], [c.errores, 'Errores', '#f87171']]
        .map(([v, t, k]) => html`<div class="kpi"><b>${n(v)}</b><small><i style="background:${k}"></i>${t}</small></div>`)}</div>
      ${c.error ? html`<p class="small" style="color:#f87171;margin:8px 0 0">Último error: ${c.error}</p>` : ''}
      <p class="muted small" style="margin:8px 0 0">Creó ${c.creada_por || '—'} el ${fecha(c.created_at)}${c.aprobada_por ? ` · aprobó ${c.aprobada_por} el ${fecha(c.aprobada_at)}` : ''}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        ${c.estado === 'borrador' ? acc('aprobar', `Aprobar y enviar a ${n(c.total)}`, 'btn-accent', `¿Aprobar? Se enviará a ${c.total} contactos en horario, máximo ${c.tope_diario} al día.`) : ''}
        ${c.estado === 'enviando' ? acc('pausar', 'Pausar') : ''}${c.estado === 'pausada' ? acc('reanudar', 'Reanudar', 'btn-accent') : ''}
        ${c.errores ? acc('reintentar', `Reintentar ${n(c.errores)} con error`) : ''}
        ${['borrador', 'enviando', 'pausada'].includes(c.estado) ? acc('cancelar', 'Cancelar', 'btn-bad', '¿Cancelar la campaña? Los pendientes ya no se envían.') : ''}
      </div></form>`;
  };
  const vars = Array.from({ length: 5 }, (_, i) => {
    const v = (form.variables || [])[i] || {};
    return html`<div style="display:grid;grid-template-columns:70px 1fr 1fr;gap:8px;align-items:center"><span class="mono">{{${i + 1}}}</span>
      ${sel(`var_fuente_${i + 1}`, [['', '— no se usa —'], ...Object.entries(FUENTES)], v.fuente)}<input name="var_texto_${i + 1}" value="${v.texto || ''}" placeholder="Texto fijo (si eliges texto)" maxlength="60"></div>`;
  });
  const body = html`${hero({ kicker: 'Campañas de WhatsApp', title: 'Campañas', letra: client.nombre,
      sub: 'Manda un mensaje a un grupo de tus contactos (por etapa, etiqueta o días sin actividad) con una plantilla aprobada por Meta. Nada sale hasta que alguien lo aprueba.',
      note: ['Cómo se cuida tu número', `En horario, escalonado, con tope diario, sin repetir a quien recibió otra en ${FRECUENCIA} días y sin escribir a quien pidió su baja`] })}
    ${ok ? html`<div class="okmsg">${ok}</div>` : ''}${error ? html`<div class="err">${error}</div>` : ''}
    ${!directo && !agente ? html`<div class="err">Esta marca todavía no tiene WhatsApp conectado. Conéctalo en <a href="${base}/agente">Lo que sabe tu agente</a>.</div>` : ''}
    <div style="display:grid;gap:18px;grid-template-columns:minmax(0,1.2fr) minmax(320px,1fr);align-items:start" class="df">
      <style>@media (max-width:980px){.df{grid-template-columns:1fr!important}} .df select,.df input:not([type=checkbox]){width:100%}</style>
      <div>${campanas.length ? campanas.map(camp) : html`<div class="card muted">Aún no hay campañas. Crea la primera con el formulario.</div>`}
        <form class="card" method="post" action="${base}/difusion/recordatorios" style="display:grid;gap:10px;margin-top:6px">
          <span class="mono">Automático · recordatorio de cita</span>
          <p class="muted small" style="margin:0">Antes de cada cita le llega al cliente un WhatsApp con su fecha y hora, para bajar las inasistencias. Si contesta (confirmo, quiero cambiarla), el agente lo atiende.</p>
          <label style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="activo" value="1" ${rec.activo ? 'checked' : ''} style="width:18px;height:18px">Mandar recordatorios</label>
          <div style="display:grid;grid-template-columns:1fr 110px 140px;gap:8px">
            <label class="small muted">Plantilla aprobada<input name="plantilla" value="${rec.plantilla || ''}" placeholder="recordatorio_cita"></label>
            <label class="small muted">Idioma<input name="idioma" value="${rec.idioma || 'es_MX'}"></label>
            <label class="small muted">Horas antes<input name="horas" value="${(rec.horas || [24, 2]).join(', ')}" placeholder="24, 2"></label>
          </div>
          <label class="small muted">Texto de la plantilla ({{1}} nombre, {{2}} fecha, {{3}} hora)<textarea name="cuerpo" style="min-height:70px" maxlength="1024" placeholder="Hola {{1}}, te recordamos tu cita el {{2}} a las {{3}}. ¿Nos confirmas?">${rec.cuerpo || ''}</textarea></label>
          <div><button class="btn-accent">Guardar</button></div>
          ${recRecientes.length ? html`<div class="small"><span class="muted">Últimos recordatorios</span>${recRecientes.map((r) => html`<div style="display:flex;justify-content:space-between;gap:8px;margin-top:6px"><span>${r.nombre || r.telefono} · ${r.horas} h antes</span><span style="color:${r.status === 'enviado' ? '#4ade80' : '#f87171'}">${r.status === 'enviado' ? 'Enviado' : `Error: ${r.error || ''}`}</span></div>`)}</div>` : ''}
        </form>
      </div>
      <form class="card" method="post" action="${base}/difusion/nueva" style="display:grid;gap:12px">
        <span class="mono">Nueva campaña</span>
        <label class="small muted">Nombre<input name="nombre" maxlength="80" required value="${form.nombre || ''}" placeholder="Ej.: Reactivar clientes de octubre"></label>
        <span class="mono" style="margin-top:6px">1 · A quién le llega</span>
        ${etapasTodas.length ? html`<div class="small"><span class="muted">Etapas (si no eliges, todas)</span>
          <div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:6px">${etapasTodas.map((e) => html`<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" name="etapas" value="${e.id}" ${(f.etapas || []).includes(e.id) ? 'checked' : ''}>${e.nombre}</label>`)}</div></div>` : ''}
        <label class="small muted">Con alguna de estas etiquetas (separadas por coma)<input name="tags" value="${(f.tags || []).join(', ')}" placeholder="Ej.: vip, interesado"></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <label class="small muted">Canal de origen${sel('origen', [['', 'Todos'], ['whatsapp', 'WhatsApp'], ['instagram', 'Instagram'], ['facebook', 'Messenger'], ['llamada', 'Llamada'], ['importado', 'Importados']], f.origen)}</label>
          <label class="small muted">Resultado${sel('resultado', [['', 'Todos'], ['abierto', 'Abiertos'], ['vendido', 'Vendidos'], ['perdido', 'Perdidos'], ['resuelto', 'Resueltos']], f.resultado)}</label>
          <label class="small muted">Sin actividad hace al menos (días)<input name="sin_actividad" type="number" min="0" value="${f.sin_actividad ?? ''}" placeholder="Ej.: 30"></label>
          <label class="small muted">Llegaron en los últimos (días)<input name="max_dias" type="number" min="0" value="${f.max_dias ?? ''}" placeholder="Ej.: 90"></label>
        </div>
        <span class="mono" style="margin-top:6px">2 · Plantilla aprobada por Meta</span>
        ${plantillas?.length ? html`<label class="small muted">Elige una de tus plantillas<select id="pl-sel"><option value="">—</option>${plantillas.map((t) => html`<option value="${t.nombre}" data-idioma="${t.idioma}" data-cuerpo="${t.cuerpo}" ${form.plantilla === t.nombre ? 'selected' : ''}>${t.nombre} · ${t.idioma} · ${t.categoria}</option>`)}</select></label>`
          : html`<p class="muted small" style="margin:0">${errorPlantillas ? `No pude leer tus plantillas (${errorPlantillas}). ` : ''}Escribe el nombre exacto de la plantilla aprobada en tu WhatsApp Manager.</p>`}
        <div style="display:grid;grid-template-columns:1fr 110px;gap:8px">
          <label class="small muted">Nombre de la plantilla<input name="plantilla" id="pl-nombre" required value="${form.plantilla || ''}" placeholder="recordatorio_pendientes"></label>
          <label class="small muted">Idioma<input name="idioma" id="pl-idioma" value="${form.idioma || 'es_MX'}"></label>
        </div>
        <label class="small muted">Texto de la plantilla (para ver cómo queda; usa {{1}}, {{2}}…)<textarea name="cuerpo" id="pl-cuerpo" style="min-height:90px" maxlength="1024">${form.cuerpo || ''}</textarea></label>
        <div class="small" style="display:grid;gap:6px"><span class="muted">Con qué se llena cada variable</span>${vars}</div>
        <label class="small muted">Máximo al día<input name="tope_diario" type="number" min="1" max="10000" value="${form.tope_diario || 250}"></label>
        <label style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" name="recurrente" value="1" ${form.recurrente === '1' ? 'checked' : ''} style="width:18px;height:18px;margin-top:2px"><span>Automática<br><span class="muted small">Cada día se manda a quien vaya entrando al segmento (por ejemplo, “30 días sin pedir”). Una vez por persona.</span></span></label>
        ${seg ? html`<div class="card" style="background:rgba(201,245,58,.06);border-color:rgba(201,245,58,.3)">
            <b style="font-size:18px">${n(seg.leads.length)} contactos recibirían la campaña</b>
            <p class="muted small" style="margin:4px 0 8px">Se excluyen ${n(seg.excluidos.sin_whatsapp)} sin WhatsApp, ${n(seg.excluidos.baja)} con baja y ${n(seg.excluidos.recientes)} que recibieron otra campaña en ${FRECUENCIA} días.</p>
            ${seg.ejemplos.map((e) => html`<div class="small" style="margin:8px 0"><b>${e.nombre}</b> <span class="muted">${e.telefono}</span>${e.texto ? html`<div style="margin-top:4px;padding:8px 10px;border-radius:10px;background:rgba(74,222,128,.08);white-space:pre-wrap">${e.texto}</div>` : ''}</div>`)}
          </div>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-warn" formaction="${base}/difusion/vista" formnovalidate>Ver a quién le llega</button><button class="btn-accent">Crear campaña</button></div>
        <p class="muted small" style="margin:0">Al crearla queda por aprobar: nada se envía hasta que alguien la aprueba. Si un contacto responde, el agente le contesta como siempre.</p>
      </form>
    </div>
    <script>(() => { const s = document.getElementById('pl-sel'); if (!s) return; s.addEventListener('change', () => { const o = s.selectedOptions[0]; if (!o || !o.value) return;
      document.getElementById('pl-nombre').value = o.value; document.getElementById('pl-idioma').value = o.dataset.idioma || 'es_MX'; document.getElementById('pl-cuerpo').value = o.dataset.cuerpo || ''; }); })();</script>`;
  return page({ title: `Campañas · ${client.nombre}`, side: app ? sideApp('difusion', client) : side('clientes'), body });
}

// ------------------------------------------------------------ cupones (canje en sucursal)
export function cuponesPage(client, { aj = {}, lista = [], resumen = {}, consulta = null, codigo = '', sucursal = '', base, app = false, ok = '', error = '', canjeado = false }) {
  const fecha = (t) => (t ? new Date(String(t).replace(' ', 'T') + 'Z').toLocaleString('es-MX', { timeZone: config.timezone, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
  const ESTADO = { valido: ['Válido', '#4ade80'], canjeado: ['Ya canjeado', '#fbbf24'], vencido: ['Vencido', '#f87171'], no_existe: ['No existe', '#f87171'] };
  const promos = [...(aj.promociones || []), {}, {}].slice(0, Math.max(3, (aj.promociones || []).length + 1));
  const res = consulta ? (() => { const [t, col] = ESTADO[consulta.estado]; const c = consulta.cupon;
    return html`<div class="card" style="margin-top:14px;border-color:${col}55;background:${col}12">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><b style="font-size:22px;letter-spacing:.06em">${c ? c.codigo : codigo.toUpperCase()}</b><span class="chip" style="font-size:13px"><i style="background:${col}"></i>${canjeado ? 'Canjeado ahora ✓' : t}</span></div>
      ${c ? html`<p style="font-size:18px;margin:10px 0 4px"><b>${c.beneficio}</b></p>
        <p class="muted small" style="margin:0">${c.promocion}${consulta.nombre ? ` · ${consulta.nombre}` : ''} · vence ${consulta.vence_texto}${c.canjeado_at ? ` · canjeado ${fecha(c.canjeado_at)}${c.sucursal ? ` en ${c.sucursal}` : ''}${c.canjeado_por ? ` por ${c.canjeado_por}` : ''}` : ''}</p>
        ${consulta.estado === 'valido' && !canjeado ? html`<form method="post" action="${base}/cupones/canjear" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><input type="hidden" name="codigo" value="${c.codigo}"><input type="hidden" name="sucursal" value="${sucursal}"><button class="btn-accent" style="font-size:17px;padding:14px 22px">Canjear ahora</button></form>` : ''}` : html`<p class="muted" style="margin:8px 0 0">Revisa que esté bien escrito.</p>`}
    </div>`; })() : '';
  const body = html`${hero({ kicker: 'Cupones', title: 'Cupones', letra: client.nombre, sub: 'Tu agente da cupones únicos con vigencia según la conversación; en sucursal se validan y canjean aquí.',
      note: ['Últimos 30 días', `${resumen.dados || 0} dados · ${resumen.canjeados || 0} canjeados (${resumen.tasa || 0} %)`] })}
    ${ok ? html`<div class="okmsg">${ok}</div>` : ''}${error ? html`<div class="err">${error}</div>` : ''}
    <div style="display:grid;gap:18px;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);align-items:start" class="cu">
      <style>@media (max-width:980px){.cu{grid-template-columns:1fr!important}} .cu input,.cu textarea{width:100%}</style>
      <div>
        <form class="card" method="get" action="${base}/cupones">
          <span class="mono">Canjear en sucursal</span>
          <div style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:10px"><input name="codigo" value="${codigo}" placeholder="Código del cupón" autocomplete="off" autocapitalize="characters" style="font-size:20px;letter-spacing:.06em;text-transform:uppercase" required><button class="btn-accent">Buscar</button></div>
          <label class="small muted" style="display:block;margin-top:8px">Sucursal (opcional)<input name="sucursal" value="${sucursal}" placeholder="Ej.: Polanco"></label>
        </form>
        ${res}
        <div class="card" style="margin-top:18px"><span class="mono">Últimos cupones</span>
          ${lista.length ? html`<table style="margin-top:8px;font-size:14px">${lista.slice(0, 30).map((c) => html`<tr><td><b>${c.codigo}</b><div class="muted small">${c.promocion} · ${fecha(c.created_at)}</div></td><td style="text-align:right" class="small">${c.canjeado_at ? html`<span style="color:#4ade80">Canjeado${c.sucursal ? ` · ${c.sucursal}` : ''}</span>` : html`<span class="muted">Vence ${fecha(c.vence_at)}</span>`}</td></tr>`)}</table>`
            : html`<p class="muted small">Aún no se ha dado ningún cupón.</p>`}
          ${(resumen.porPromocion || []).length ? html`<p class="muted small" style="margin-top:10px">${resumen.porPromocion.map((p) => `${p.promocion}: ${p.dados} dados, ${p.canjeados || 0} canjeados`).join(' · ')}</p>` : ''}
        </div>
      </div>
      ${client._caja ? '' : html`<form class="card" method="post" action="${base}/cupones/promociones" enctype="multipart/form-data" style="display:grid;gap:12px">
        <span class="mono">Promociones que puede dar tu agente</span>
        <label style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="activo" value="1" ${aj.activo ? 'checked' : ''} style="width:18px;height:18px">Activar cupones</label>
        <label class="small muted">Prefijo del código<input name="prefijo" value="${aj.prefijo || ''}" maxlength="8" placeholder="CHUB" style="text-transform:uppercase"></label>
        ${promos.map((p, i) => html`<div style="border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:12px;display:grid;gap:8px">
          <input type="hidden" name="id_${i + 1}" value="${p.id || ''}">
          <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center"><input name="nombre_${i + 1}" value="${p.nombre || ''}" placeholder="Nombre (ej.: Primera compra)">
            <label class="small" style="display:flex;gap:6px;align-items:center;white-space:nowrap"><input type="checkbox" name="activa_${i + 1}" value="1" ${p.activa !== false ? 'checked' : ''}>Activa</label></div>
          <input name="beneficio_${i + 1}" value="${p.beneficio || ''}" placeholder="Qué recibe (ej.: 10 % en la Hamburguesa Clásica)">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:center"><label class="small muted">Cómo se entrega<select name="modo_${i + 1}"><option value="codigo" ${p.modo !== 'imagen' ? 'selected' : ''}>Código único (se canjea aquí)</option><option value="imagen" ${p.modo === 'imagen' ? 'selected' : ''}>Imagen por WhatsApp (sencillo)</option></select></label>
            <label class="small muted">Imagen del cupón${p.imagen ? html` · <a href="${mediaSrc(p.imagen)}" target="_blank" rel="noopener">ver actual</a>` : ''}<input type="file" name="imagen_${i + 1}" accept="image/png,image/jpeg,image/webp"></label></div>
          <input type="hidden" name="imagen_actual_${i + 1}" value="${p.imagen || ''}">
          <textarea name="cuando_${i + 1}" style="min-height:52px" placeholder="Cuándo darlo (ej.: si pregunta el menú y no pide, o si comenta que se le antoja)">${p.cuando || ''}</textarea>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label class="small muted">Vigencia (horas)<input name="vigencia_${i + 1}" type="number" min="1" value="${p.vigencia_horas || 72}"></label>
            <label class="small muted">Máximo al día (0 = sin límite)<input name="max_${i + 1}" type="number" min="0" value="${p.max_dia || 0}"></label></div>
        </div>`)}
        <p class="muted small" style="margin:0">Deja vacío el beneficio para borrar una promoción. Cada persona recibe un solo cupón vigente por promoción y cada código se canjea una sola vez.</p>
        <div><button class="btn-accent">Guardar promociones</button></div>
      </form>`}
    </div>`;
  return page({ title: `Cupones · ${client.nombre}`, side: app ? sideApp('cupones', client) : side('clientes'), body });
}

// ------------------------------------------------------------ correo
export function correoPage(client, { aj = {}, cuenta = null, lista = [], resumen = {}, PROVEEDORES = {}, MODOS = {}, filtro = '', base, app = false, ok = '', error = '' }) {
  const fecha = (t) => (t ? new Date(String(t).replace(' ', 'T') + 'Z').toLocaleString('es-MX', { timeZone: config.timezone, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
  const COL = { recibido: ['Recibido', '#93b4ff'], borrador: ['Por aprobar', '#fbbf24'], respondido: ['Contestado', '#4ade80'], descartado: ['Descartado', '#a39d93'], error: ['Error', '#f87171'] };
  const prov = Object.entries(PROVEEDORES).find(([, p]) => p.imap_host === cuenta?.imap_host)?.[0] || (cuenta?.imap_host ? 'otro' : 'google');
  const body = html`${hero({ kicker: 'Correo', title: 'Correo', letra: client.nombre, sub: 'La IA contesta los correos de tu marca con lo que sabe tu agente. Cada correo queda como lead con su conversación; lo delicado se lo pasa a tu equipo.',
      note: ['Últimos 30 días', `${resumen.recibidos || 0} recibidos · ${resumen.respondidos || 0} contestados · ${resumen.por_aprobar || 0} por aprobar`] })}
    ${ok ? html`<div class="okmsg">${ok}</div>` : ''}${error ? html`<div class="err">${error}</div>` : ''}
    <div style="display:grid;gap:18px;grid-template-columns:minmax(0,1.5fr) minmax(300px,1fr);align-items:start" class="cr">
      <style>@media (max-width:980px){.cr{grid-template-columns:1fr!important}} .cr input,.cr select,.cr textarea{width:100%}</style>
      <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><span class="mono">Correos</span>
        <div class="pills" style="margin:0">${[['', 'Todos'], ['borrador', 'Por aprobar'], ['respondido', 'Contestados'], ['error', 'Con error']].map(([k, t]) => html`<a class="${filtro === k ? 'on' : ''}" href="${base}/correo${k ? `?f=${k}` : ''}">${t}</a>`)}</div></div>
        ${lista.length ? lista.map((c) => { const [t, col] = COL[c.estado] || [c.estado, '#a39d93'];
          return html`<div style="border-top:1px solid var(--line);padding:14px 0;display:grid;gap:8px">
            <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><b>${c.asunto}</b><div class="muted small">${c.lead_nombre || c.de} · ${c.de} · ${fecha(c.created_at)}${c.lead_id ? html` · <a href="${base}/leads/${c.lead_id}/chat">ver conversación</a>` : ''}</div></div>
              <span class="badge" style="color:${col}">${t}</span></div>
            <details><summary class="small muted" style="cursor:pointer">Lo que escribió</summary><p class="small" style="white-space:pre-wrap;margin:8px 0 0">${c.texto}</p></details>
            ${c.motivo && c.estado === 'borrador' ? html`<div class="small" style="color:#fbbf24">Revísalo: ${c.motivo}</div>` : ''}
            ${c.error ? html`<div class="small" style="color:#f87171">${c.error}</div>` : ''}
            ${['borrador', 'error', 'recibido'].includes(c.estado) ? html`<form method="post" action="${base}/correo/${c.id}/enviar" style="display:grid;gap:8px">
              <textarea name="texto" style="min-height:130px" placeholder="Escribe la respuesta…">${c.borrador || ''}</textarea>
              <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-accent" style="padding:8px 14px">Enviar respuesta</button>
                <button class="btn-warn" style="padding:8px 14px" formaction="${base}/correo/${c.id}/descartar" formnovalidate>Descartar</button></div></form>` : ''}
          </div>`; }) : html`<p class="muted small">${aj.activo ? 'Todavía no llegan correos nuevos. Se revisa el buzón cada 2 minutos.' : 'Conecta el correo de tu marca para empezar.'}</p>`}
      </div>
      <div style="display:grid;gap:18px">
        <form class="card" method="post" action="${base}/correo/ajustes" style="display:grid;gap:10px">
          <span class="mono">Cuenta de correo</span>
          <label style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="activo" value="1" ${aj.activo ? 'checked' : ''} style="width:18px;height:18px">Contestar correos con IA</label>
          <label class="small muted">Tu correo es de<select name="proveedor" onchange="document.getElementById('cr-otro').style.display=this.value==='otro'?'grid':'none'">${Object.entries(PROVEEDORES).map(([k, p]) => html`<option value="${k}" ${prov === k ? 'selected' : ''}>${p.nombre}</option>`)}<option value="otro" ${prov === 'otro' ? 'selected' : ''}>Otro (escribo los servidores)</option></select></label>
          <div id="cr-otro" style="display:${prov === 'otro' ? 'grid' : 'none'};gap:8px;grid-template-columns:1fr 90px">
            <input name="imap_host" placeholder="Servidor IMAP (ej. mail.tumarca.com)" value="${cuenta?.imap_host || ''}"><input name="imap_port" type="number" value="${cuenta?.imap_port || 993}" title="Puerto IMAP (993)">
            <input name="smtp_host" placeholder="Servidor SMTP" value="${cuenta?.smtp_host || ''}"><input name="smtp_port" type="number" value="${cuenta?.smtp_port || 465}" title="Puerto SMTP (465 o 587)"></div>
          <label class="small muted">Correo de la cuenta<input name="usuario" type="email" value="${cuenta?.usuario || ''}" placeholder="hola@tumarca.com" autocomplete="off"></label>
          <label class="small muted">Contraseña de aplicación ${cuenta?.password ? '(ya guardada; escribe solo para cambiarla)' : ''}<input name="password" type="password" autocomplete="new-password" placeholder="${cuenta?.password ? '••••••••' : 'Contraseña de aplicación'}"></label>
          <p class="muted small" style="margin:0">En Google y Outlook se genera en la seguridad de la cuenta ("Contraseñas de aplicación", requiere verificación en dos pasos). Se guarda cifrada y no se vuelve a mostrar.</p>
          <label class="small muted">Modo<select name="modo">${Object.entries(MODOS).map(([k, t]) => html`<option value="${k}" ${aj.modo === k ? 'selected' : ''}>${t}</option>`)}</select></label>
          <label class="small muted">Nombre con el que se envía<input name="nombre" value="${aj.nombre || ''}" placeholder="${client.nombre}"></label>
          <label class="small muted">Firma<textarea name="firma" style="min-height:70px" placeholder="Equipo ${client.nombre}&#10;55 1234 5678 · tumarca.com">${aj.firma || ''}</textarea></label>
          <div><button class="btn-accent">Guardar</button></div>
        </form>
        ${cuenta?.usuario ? html`<div class="card" style="display:flex;gap:8px;flex-wrap:wrap"><form method="post" action="${base}/correo/probar"><button class="btn-warn" style="padding:8px 14px">Probar conexión</button></form>
          <form method="post" action="${base}/correo/revisar"><button class="btn-warn" style="padding:8px 14px">Revisar buzón ahora</button></form>
          <p class="muted small" style="margin:0;width:100%">La primera revisión solo marca el punto de partida: los correos que ya tenías no se contestan.</p></div>` : ''}
      </div>
    </div>`;
  return page({ title: `Correo · ${client.nombre}`, side: app ? sideApp('correo', client) : side('clientes'), body });
}

// ------------------------------------------------------------ cobros por chat
export function cobrosPage(client, { aj = {}, conv = {}, hayToken = false, hayCapi = false, lista = [], resumen = {}, PROVEEDORES = {}, etapas = [], base, app = false, ok = '', error = '' }) {
  const fecha = (t) => (t ? new Date(String(t).replace(' ', 'T') + 'Z').toLocaleString('es-MX', { timeZone: config.timezone, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
  const mxn = (n) => `$${Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;
  const COL = { pendiente: ['Esperando pago', '#fbbf24'], pagado: ['Pagado', '#4ade80'], vencido: ['Vencido', '#a39d93'] };
  const body = html`${hero({ kicker: 'Cobros por chat', title: 'Cobros', letra: client.nombre, sub: 'Tu agente manda un link de pago en la conversación; el dinero llega directo a tu cuenta. Al pagar, el lead queda como vendido y la venta se le avisa a Meta para saber qué anuncio vende.',
      note: ['Últimos 30 días', `${resumen.links || 0} links · ${resumen.pagados || 0} pagados · ${mxn(resumen.total)}`] })}
    ${ok ? html`<div class="okmsg">${ok}</div>` : ''}${error ? html`<div class="err">${error}</div>` : ''}
    <div style="display:grid;gap:18px;grid-template-columns:minmax(0,1.3fr) minmax(300px,1fr);align-items:start" class="cb">
      <style>@media (max-width:980px){.cb{grid-template-columns:1fr!important}} .cb input,.cb select{width:100%}</style>
      <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="mono">Links de pago</span>
        ${hayToken ? html`<form method="post" action="${base}/cobros/revisar"><button class="btn-warn" style="padding:6px 12px;font-size:13px">Revisar pagos ahora</button></form>` : ''}</div>
        ${lista.length ? html`<table style="margin-top:8px;font-size:14px">${lista.map((c) => { const [t, col] = COL[c.status] || [c.status, '#a39d93'];
          return html`<tr><td><b>${c.concepto}</b><div class="muted small">${fecha(c.created_at)} · ${PROVEEDORES[c.proveedor] || c.proveedor}${c.error ? ` · ${c.error}` : ''}</div></td><td style="text-align:right;white-space:nowrap"><b>${mxn(c.monto)}</b><div class="small" style="color:${col}">${t}</div></td></tr>`; })}</table>`
          : html`<p class="muted small">Todavía no se ha mandado ningún link.</p>`}
      </div>
      <form class="card" method="post" action="${base}/cobros/ajustes" style="display:grid;gap:10px">
        <span class="mono">Ajustes</span>
        <label style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="activo" value="1" ${aj.activo ? 'checked' : ''} style="width:18px;height:18px">Mandar links de pago por chat</label>
        <label class="small muted">Proveedor<select name="proveedor">${Object.entries(PROVEEDORES).map(([k, t]) => html`<option value="${k}" ${aj.proveedor === k ? 'selected' : ''}>${t}</option>`)}</select></label>
        <label class="small muted">${aj.proveedor === 'stripe' ? 'Clave secreta de Stripe' : 'Access token de Mercado Pago'} ${hayToken ? '(ya guardado; escribe solo para cambiarlo)' : ''}<input name="token" type="password" autocomplete="off" placeholder="${hayToken ? '••••••••' : 'APP_USR-… o sk_live_…'}"></label>
        <label class="small muted">Monto máximo por link (MXN)<input name="monto_max" type="number" min="10" value="${aj.monto_max || 20000}"></label>
        <label class="small muted">Al pagar, mover a la etapa<select name="etapa_pagado"><option value="">— no mover —</option>${etapas.map((e) => html`<option value="${e.id}" ${aj.etapa_pagado === e.id ? 'selected' : ''}>${e.nombre}</option>`)}</select></label>
        <span class="mono" style="margin-top:8px">Ventas a Meta (qué anuncio vende)</span>
        <label style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="conv_activo" value="1" ${conv.activo ? 'checked' : ''} style="width:18px;height:18px">Avisar cada venta a Meta</label>
        <label class="small muted">ID del conjunto de datos (pixel)<input name="dataset_id" value="${conv.dataset_id || ''}" inputmode="numeric" placeholder="123456789012345"></label>
        <label class="small muted">Token de la API de conversiones ${hayCapi ? '(ya guardado)' : ''}<input name="capi_token" type="password" autocomplete="off" placeholder="${hayCapi ? '••••••••' : 'EAAG…'}"></label>
        <p class="muted small" style="margin:0">Se avisa cuando pagan un link o cuando marcas un lead como Vendido. Si llegó por un anuncio de clic a WhatsApp, Meta sabe exactamente qué anuncio vendió.</p>
        <div><button class="btn-accent">Guardar</button></div>
      </form>
    </div>`;
  return page({ title: `Cobros · ${client.nombre}`, side: app ? sideApp('cobros', client) : side('clientes'), body });
}

// ------------------------------------------------------------ equipo
export function equipoPage(client, { aj = {}, filas = [], esperando = [], csat = {}, REPARTOS = {}, yo = null, base, app = false, ok = '', error = '' }) {
  const min = (m) => (m === null || m === undefined ? '—' : m < 60 ? `${Math.round(m)} min` : `${(m / 60).toFixed(1)} h`);
  const body = html`${hero({ kicker: 'Equipo', title: 'Equipo', letra: client.nombre, sub: 'Quién atiende, qué tan rápido contesta y qué tan contentos quedan los clientes. Los leads nuevos se reparten solos entre quienes están disponibles.',
      note: ['Satisfacción (30 días)', csat.promedio ? `${csat.promedio} / 5 · ${csat.respondidas} respuestas` : 'Sin encuestas todavía'] })}
    ${ok ? html`<div class="okmsg">${ok}</div>` : ''}${error ? html`<div class="err">${error}</div>` : ''}
    ${esperando.length ? html`<div class="card" style="border-color:rgba(248,113,113,.45);background:rgba(248,113,113,.06);margin-bottom:16px"><span class="mono" style="color:#f87171">Esperando respuesta del equipo</span>
      ${esperando.map((l) => html`<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0"><a href="${base}/leads/${l.id}/chat"><b>${l.nombre || l.telefono}</b></a><span class="small muted">desde ${new Date(`${l.espera_desde.replace(' ', 'T')}Z`).toLocaleTimeString('es-MX', { timeZone: config.timezone, hour: 'numeric', minute: '2-digit' })}</span></div>`)}</div>` : ''}
    <div style="display:grid;gap:18px;grid-template-columns:minmax(0,1.6fr) minmax(280px,1fr);align-items:start" class="eq">
      <style>@media (max-width:980px){.eq{grid-template-columns:1fr!important}} .eq input,.eq select,.eq textarea{width:100%}</style>
      <div class="card" style="overflow-x:auto"><span class="mono">Rendimiento (30 días)</span>
        ${filas.length ? html`<table style="margin-top:8px;font-size:14px"><tr><th>Asesor</th><th>Abiertos</th><th>Esperando</th><th>Respuesta (mediana)</th><th>A tiempo</th><th>Vendidos</th><th>Satisfacción</th><th></th></tr>
          ${filas.map((f) => html`<tr><td><b>${f.nombre}</b>${f.disponible ? '' : html`<div class="small" style="color:#fbbf24">No disponible</div>`}</td><td>${f.abiertos}</td>
            <td style="color:${f.esperando ? '#f87171' : 'inherit'}">${f.esperando}</td><td>${min(f.mediana_min)}</td><td>${f.en_sla === null ? '—' : `${f.en_sla} %`}</td><td>${f.vendidos}</td><td>${f.csat ? `${f.csat} ⭐ (${f.csat_n})` : '—'}</td>
            <td>${yo && (yo.id === f.id || yo.rol === 'admin') ? html`<form method="post" action="${base}/equipo/${f.id}/disponible"><input type="hidden" name="disponible" value="${f.disponible ? '0' : '1'}"><button class="btn-warn" style="padding:4px 10px;font-size:12px">${f.disponible ? 'Pausar' : 'Disponible'}</button></form>` : ''}</td></tr>`)}</table>`
          : html`<p class="muted small">Aún no hay asesores. Kuper da de alta a tu equipo en Usuarios.</p>`}
        <p class="muted small" style="margin-top:10px">“A tiempo” = el cliente recibió respuesta del equipo en menos de ${aj.sla_min} min. Cuenta solo las conversaciones que atiende una persona (las de la IA se contestan al momento).</p>
      </div>
      <form class="card" method="post" action="${base}/equipo/ajustes" style="display:grid;gap:10px">
        <span class="mono">Ajustes</span>
        <label class="small muted">Reparto de leads nuevos<select name="reparto">${Object.entries(REPARTOS).map(([k, t]) => html`<option value="${k}" ${aj.reparto === k ? 'selected' : ''}>${t}</option>`)}</select></label>
        <label class="small muted">Tiempo meta de respuesta (minutos)<input name="sla_min" type="number" min="1" value="${aj.sla_min}"></label>
        <label style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="alertas" value="1" ${aj.alertas ? 'checked' : ''} style="width:18px;height:18px">Avisar por correo cuando alguien pase ese tiempo esperando</label>
        <span class="mono" style="margin-top:6px">Encuesta de satisfacción</span>
        <label style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="csat_activo" value="1" ${aj.csat.activo ? 'checked' : ''} style="width:18px;height:18px">Preguntar del 1 al 5 al marcar Vendido o Resuelto</label>
        <label class="small muted">Plantilla aprobada de WhatsApp<input name="csat_plantilla" value="${aj.csat.plantilla || ''}" placeholder="encuesta_atencion"></label>
        <label class="small muted">Texto (para el historial)<textarea name="csat_texto" style="min-height:60px">${aj.csat.texto || ''}</textarea></label>
        <input type="hidden" name="csat_idioma" value="${aj.csat.idioma || 'es_MX'}">
        <div><button class="btn-accent">Guardar</button></div>
      </form>
    </div>`;
  return page({ title: `Equipo · ${client.nombre}`, side: app ? sideApp('equipo', client) : side('clientes'), body });
}

// ------------------------------------------------------------ asistente del panel
export function asistentePage(client, { base, app = false }) {
  const ejemplos = ['¿Cuántos leads llegaron esta semana y de qué país?', '¿Quién está esperando respuesta ahorita?', '¿Cuáles son los 5 leads más cerca de comprar?', 'Asigna a Ana los leads nuevos sin asesor', 'Marca como urgentes los que llevan más de 2 días esperando'];
  const body = html`${hero({ kicker: 'Asistente', title: 'Pregúntale a tu panel', letra: client.nombre, sub: 'Pregunta en español sobre tus leads, conversaciones, asesores y anuncios, o pídele que haga algo (mover, asignar, etiquetar, preparar una campaña): siempre te pide confirmar antes. Contesta con tus datos y te deja los links para abrir cada conversación. Solo consulta: no cambia nada.' })}
  <div class="card" style="max-width:860px">
    <div id="as-msgs" style="display:flex;flex-direction:column;gap:10px;min-height:120px;max-height:56vh;overflow-y:auto;padding:4px"></div>
    <div id="as-ej" style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0">${ejemplos.map((e) => html`<button type="button" class="btn-warn" style="padding:7px 12px;font-size:13px" data-ej="${e}">${e}</button>`)}</div>
    <form id="as-form" style="display:flex;gap:8px" autocomplete="off"><input id="as-q" maxlength="600" placeholder="Escribe tu pregunta…" style="flex:1"><button class="btn-accent" id="as-btn">Preguntar</button></form>
  </div>
  <script>(() => {
    const msgs = document.getElementById('as-msgs'), form = document.getElementById('as-form'), q = document.getElementById('as-q'), btn = document.getElementById('as-btn');
    const historial = [];
    const burbuja = (quien, texto, leads = []) => { const d = document.createElement('div'); d.style.cssText = 'padding:10px 14px;border-radius:16px;max-width:92%;white-space:pre-wrap;' + (quien === 'yo' ? 'align-self:flex-end;background:rgba(255,255,255,.08)' : 'align-self:flex-start;background:rgba(201,245,58,.1)');
      d.textContent = texto;
      if (leads.length) { const ul = document.createElement('div'); ul.style.cssText = 'margin-top:8px;display:grid;gap:4px';
        for (const l of leads) { const a = document.createElement('a'); a.href = l.url; a.textContent = '→ ' + l.nombre + (l.etapa ? ' · ' + l.etapa : '') + (l.pais ? ' · ' + l.pais : ''); a.style.fontSize = '14px'; ul.append(a); } d.append(ul); }
      msgs.append(d); msgs.scrollTop = msgs.scrollHeight; return d; };
    // Lo que el asistente propone hacer: solo se hace si la persona lo confirma.
    const propuesta = (b, accion) => {
      const box = document.createElement('div'); box.style.cssText = 'margin-top:10px;padding:10px 12px;border:1px solid rgba(198,255,61,.35);border-radius:12px;display:grid;gap:8px';
      const t = document.createElement('b'); t.textContent = accion.resumen + (accion.leads && accion.leads.length && accion.tipo !== 'campana' ? ' (' + accion.leads.length + ' leads)' : ''); box.append(t);
      const fila = document.createElement('div'); fila.style.cssText = 'display:flex;gap:8px';
      const si = document.createElement('button'); si.type = 'button'; si.className = 'btn-accent'; si.textContent = 'Sí, hazlo'; si.style.cssText = 'padding:7px 14px;font-size:13px';
      const no = document.createElement('button'); no.type = 'button'; no.className = 'btn-warn'; no.textContent = 'Cancelar'; no.style.cssText = 'padding:7px 14px;font-size:13px';
      no.onclick = () => { box.textContent = 'Cancelado.'; };
      si.onclick = async () => { si.disabled = no.disabled = true; si.textContent = 'Haciéndolo…';
        try { const r = await fetch('${base}/asistente/accion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion }) });
          const j = await r.json(); if (!r.ok) throw new Error(j.error); box.textContent = j.mensaje + ' ';
          if (j.url) { const a = document.createElement('a'); a.href = j.url; a.textContent = 'Ver'; box.append(a); } }
        catch (e) { box.textContent = e.message || 'No se pudo.'; } };
      fila.append(si, no); box.append(fila); b.append(box); msgs.scrollTop = msgs.scrollHeight; };
    const preguntar = async (texto) => {
      if (!texto || btn.disabled) return; q.value = ''; burbuja('yo', texto); btn.disabled = true; const espera = burbuja('as', 'Revisando tus datos…');
      try { const r = await fetch('${base}/asistente/preguntar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pregunta: texto, historial }) });
        const j = await r.json(); espera.remove(); if (!r.ok) throw new Error(j.error); const b = burbuja('as', j.respuesta, j.leads || []); if (j.accion) propuesta(b, j.accion);
        historial.push({ rol: 'yo', texto }, { rol: 'asistente', texto: j.respuesta }); }
      catch (e) { espera.remove(); burbuja('as', e.message || 'No pude contestar.'); } finally { btn.disabled = false; q.focus(); } };
    form.addEventListener('submit', (e) => { e.preventDefault(); preguntar(q.value.trim()); });
    document.getElementById('as-ej').addEventListener('click', (e) => { const b = e.target.closest('[data-ej]'); if (b) preguntar(b.dataset.ej); });
  })();</script>`;
  return page({ title: `Asistente · ${client.nombre}`, side: app ? sideApp('asistente', client) : side('clientes'), body });
}
