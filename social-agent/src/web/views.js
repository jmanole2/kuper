// Vistas: tarjeta de post (compartida), portal del cliente y panel de admin.
import path from 'node:path';
import { html, raw, esc, page } from './html.js';
import { STATUS, PLATFORMS, LEAD_ESTADOS } from '../db.js';
import { localDate, localTime } from '../schedule.js';
import { config } from '../config.js';
import { FONTS } from '../animator/render.js';

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
  const body = html`
  <div class="row" style="gap:14px;margin-top:6px"><div class="avatar">${client.logo_path ? html`<img src="${mediaSrc(client.logo_path)}" alt="">` : client.nombre.slice(0, 1)}</div><h1 style="margin:0">Hola, ${client.nombre}</h1></div>
  ${kpis([[pend.length, 'Por revisar', '#fbbf24', pend.length > 0], [prog.length, 'Programadas', '#4ade80'], [pub.length, 'Publicadas', '#c6ff3d']])}
  <p class="muted">Revisa y aprueba tus próximas publicaciones. Nada se publica sin tu visto bueno${PLATFORMS.some((pl) => client.config[pl]?.activo && client.config[pl]?.modo_publicacion === 'auto') ? ' (salvo en las redes que configuraste en automático)' : ''}.</p>
  <nav class="tabs">${T.map(([k, l, list]) => html`<a class="${k === sel[0] ? 'on' : ''}" href="/p/${token}?t=${k}">${l} (${list.length})</a>`)}</nav>
  ${sel[2].length ? html`<div class="grid" style="margin-top:14px">${sel[2].map((p) => postCard(p, { base: base(p) }))}</div>` : html`<div class="card muted" style="margin-top:14px">${sel[3]}</div>`}
  ${pend.some((p) => ['generando', 'cambios_solicitados'].includes(p.status)) ? raw('<script>setTimeout(()=>location.reload(),15000)</script>') : ''}`;
  return page({ title: `Publicaciones · ${client.nombre}`, body });
}

// ------------------------------------------------------------ admin
const side = (on) => [
  { href: '/admin', icon: 'home', label: 'Clientes', on: on === 'clientes' },
  { href: '/admin/clientes/nuevo', icon: 'plus', label: 'Nuevo cliente', on: on === 'nuevo' },
  { href: '/admin/salir', icon: 'out', label: 'Salir', bottom: true },
];
const kpis = (items) => html`<div class="kpis">${items.map(([n, label, color, hot]) => html`<div class="kpi${hot ? ' hot' : ''}"><b>${n}</b><small><i style="background:${color}"></i>${label}</small></div>`)}</div>`;
const PCOL = { instagram: '#e1306c', facebook: '#4f7cff', linkedin: '#3d8bd9', tiktok: '#f2f4f8' };

export function loginPage(error) {
  return page({ title: 'Entrar', body: html`<div style="min-height:80vh;display:grid;place-items:center"><div class="card" style="width:min(400px,100%);padding:32px">
    <div class="avatar" style="background:var(--accent);color:var(--accent-ink);margin-bottom:18px">K</div>
    <h1 style="font-size:32px">Panel de agencia</h1><p class="muted" style="margin-top:0">Agente social de Kuper Media</p>${error ? html`<div class="err">${error}</div>` : ''}
    <form method="post" action="/admin/entrar"><label>Contraseña</label><input type="password" name="password" autofocus required>
    <p style="margin-top:20px"><button class="btn-accent" style="width:100%;justify-content:center">Entrar</button></p></form></div></div>` });
}

export function dashboardPage(clients, counts, events) {
  const sum = (st) => clients.reduce((n, c) => n + (counts[c.id]?.[st] || 0), 0);
  const body = html`<h1>Clientes</h1><p class="muted" style="margin:0">Lo que el agente tiene en marcha para cada marca.</p>
  ${kpis([[sum('pendiente') + sum('necesita_asset'), 'Por revisar', '#fbbf24', true], [sum('aprobado'), 'Programados', '#4ade80'], [sum('publicado'), 'Publicados', '#c6ff3d'], [sum('error') + sum('error_generacion'), 'Con error', '#f87171']])}
  <h2>Marcas</h2>
  <div class="grid">${clients.map((c) => html`<a class="card" href="/admin/clientes/${c.id}" style="text-decoration:none">
    <div class="row spread"><div class="row"><div class="avatar">${c.logo_path ? html`<img src="${mediaSrc(c.logo_path)}" alt="">` : c.nombre.slice(0, 1)}</div>
      <div><strong style="font-size:17px">${c.nombre}</strong><div class="muted small">${c.activo ? 'Activo' : 'En pausa'}</div></div></div>${c.activo ? '' : badge('rechazado')}</div>
    <div class="row" style="margin:16px 0 12px">${PLATFORMS.filter((p) => c.config[p]?.activo).map((p) => html`<span class="badge" style="color:${PCOL[p]}">${PLAT[p]}</span>`)}</div>
    <div class="row">${Object.entries(counts[c.id] || {}).map(([st, n]) => html`<span class="small muted">${badge(st)} ${n}</span>`)}</div></a>`)}
  </div>
  ${clients.length ? '' : html`<p class="muted">Todavía no hay clientes. <a href="/admin/clientes/nuevo">Crea el primero</a>.</p>`}
  <h2>Actividad reciente</h2>
  <div class="card" style="padding:8px 14px"><table>${events.map((e) => html`<tr><td class="muted small" style="white-space:nowrap">${fmtDate(e.created_at.replace(' ', 'T') + 'Z')}</td><td class="small">${e.cliente || ''}</td><td><span class="badge">${e.tipo}</span></td><td class="small">${e.detalle}</td></tr>`)}</table></div>`;
  return page({ title: 'Agente Social · Admin', side: side('clientes'), body });
}

export function clientFormPage(client, { error, notice, tab = 'posts', filtro = '', red = '', leads = [], chats = {}, citas = null, citasError = '', agendaCfg = null, saEmail = null, competitors = [], report, posts = [], creds = {}, keywordReplies = [] } = {}) {
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
  const TABS = [['posts', 'Posts'], ['leads', 'Leads'], ['citas', 'Citas'], ['competencia', 'Competencia'], ['palabra', `Palabra clave`], ['config', 'Configuración']];
  const t = isNew ? 'config' : tab;
  const body = html`
  <h1>${isNew ? 'Nuevo cliente' : client.nombre}</h1>
  ${error ? html`<div class="err">${error}</div>` : ''}
  ${notice ? html`<div class="okmsg">${notice}</div>` : ''}
  ${!isNew ? html`<nav class="tabs">${TABS.map(([k, l]) => html`<a class="${k === t ? 'on' : ''}" href="/admin/clientes/${client.id}?tab=${k}">${l}</a>`)}</nav>` : ''}

  ${!isNew && t === 'posts' ? html`
  <h2 style="margin-top:24px">Generar ahora</h2>
  <div class="row">${PLATFORMS.filter((p) => client.config[p]?.activo && !reusa(client, p)).map((p) => html`<form method="post" action="/admin/clientes/${client.id}/generar" class="inline"><input type="hidden" name="plataforma" value="${p}"><button class="btn-accent">Post para ${PLAT[p]}</button></form>`)}</div>
  <div class="pills">${FILTROS.map(([k, l, sts]) => html`<a class="${k === fSel[0] ? 'on' : ''}" href="${url({ f: k })}">${l} <em>${count(sts)}</em></a>`)}
    <span style="flex:1"></span>
    <a class="${!red ? 'on' : ''}" href="${url({ red: '' })}">Todas</a>${PLATFORMS.filter((p) => client.config[p]?.activo).map((p) => html`<a class="${red === p ? 'on' : ''}" href="${url({ red: p })}"><i style="width:8px;height:8px;border-radius:50%;background:${PCOL[p]}"></i>${PLAT[p]}</a>`)}</div>
  ${fSel[0] === 'descartados' && shown.length ? html`<form method="post" action="/admin/clientes/${client.id}/limpiar" onsubmit="return confirm('¿Eliminar todos los posts con error o rechazados? No se puede deshacer.')" style="margin-bottom:14px"><button class="btn-bad">Eliminar todos (${shown.length})</button></form>` : ''}
  ${shown.length ? html`<div class="grid">${shown.map((p) => postCard(p, { base: `/admin/posts/${p.id}`, admin: true }))}</div>` : html`<div class="card muted">No hay posts en "${fSel[1]}".</div>`}
  ` : ''}

  ${!isNew && t === 'leads' ? html`<div style="margin-top:24px"></div>
  ${kpis(Object.entries(LEAD_ESTADOS).map(([k, l], i) => [leads.filter((x) => x.estado === k).length, l, ['#93b4ff', '#fbbf24', '#c6ff3d', '#4ade80', '#f87171'][i], k === 'nuevo' && leads.some((x) => x.estado === 'nuevo')]))}
  ${leads.length ? html`<div class="card" style="padding:8px 14px;overflow-x:auto"><table>
    <tr><th class="small muted">Contacto</th><th class="small muted">Origen</th><th class="small muted">Nota</th><th class="small muted">Cita</th><th class="small muted">Actualizado</th><th class="small muted">Estado</th></tr>
    ${leads.map((l) => html`<tr><td><strong>${l.nombre || (l.usuario ? '@' + l.usuario : l.telefono)}</strong><div class="muted small">${[l.telefono, l.usuario && l.nombre ? '@' + l.usuario : ''].filter(Boolean).join(' · ')}</div>${chats[l.id] ? html`<a class="small" href="/admin/clientes/${client.id}/leads/${l.id}/chat" style="color:var(--accent)">Ver chat (${chats[l.id]})</a>` : ''}</td>
      <td><span class="badge" style="color:${l.origen === 'instagram' ? '#e1306c' : l.origen === 'whatsapp' ? '#25d366' : '#93b4ff'}">${l.origen}</span></td>
      <td class="small">${l.nota || ''}</td><td class="small">${l.cita_inicio ? fmtDate(l.cita_inicio) : '—'}</td><td class="small muted">${fmtDate(l.updated_at.replace(' ', 'T') + 'Z')}</td>
      <td><form method="post" action="/admin/clientes/${client.id}/leads/${l.id}"><select name="estado" onchange="this.form.submit()" style="padding:6px 10px;width:auto">${Object.entries(LEAD_ESTADOS).map(([k, lab]) => html`<option value="${k}" ${raw(k === l.estado ? 'selected' : '')}>${lab}</option>`)}</select></form></td></tr>`)}
  </table></div>` : html`<div class="card muted">Todavía no hay leads. Llegan solos cuando alguien comenta la palabra clave en Instagram o le escribe a tu agente de WhatsApp.</div>`}
  ` : ''}

  ${!isNew && t === 'citas' ? html`<div style="margin-top:24px"></div>
  ${citasError ? html`<div class="err">${citasError}</div>` : ''}
  ${agendaCfg && !agendaCfg.calendar_id ? html`<div class="card"><strong>Conecta Google Calendar</strong><p class="muted small">1. Crea una cuenta de servicio en Google Cloud (Calendar API activada) y guarda su JSON en el servidor.<br>2. En Google Calendar, comparte tu calendario con ${saEmail ? html`<strong>${saEmail}</strong>` : 'el correo de la cuenta de servicio'} con permiso "Hacer cambios en eventos".<br>3. En Configuración agrega <code>"agenda": { "calendar_id": "tu-correo@gmail.com" }</code>.</p></div>` : ''}
  ${citas ? html`<p class="muted small">Reglas: citas de ${agendaCfg.duracion_min} min, ${agendaCfg.margen_min} min de margen, con ${agendaCfg.anticipacion_horas} h de anticipación · ${Object.entries(agendaCfg.horario).map(([d, h]) => `${d} ${h[0]}–${h[1]}`).join(', ')}${agendaCfg.ultima_cita ? ` · última cita a las ${agendaCfg.ultima_cita}` : ''}.</p>
    ${citas.length ? html`<div class="grid">${citas.map((e) => html`<div class="card"><div class="row spread"><strong>${e.summary || 'Cita'}</strong>${e.extendedProperties?.private?.kuper ? html`<span class="badge" style="color:#25d366">Agente</span>` : html`<span class="badge">Manual</span>`}</div>
      <p style="font-size:20px;margin:10px 0 4px">${fmtDate(e.start?.dateTime || e.start?.date)}</p>${e.repeticiones?.length ? html`<p class="muted small" style="margin:0 0 6px">Se repite · ${e.repeticiones.length} más: ${e.repeticiones.slice(0, 3).map((d) => fmtDate(d)).join(', ')}${e.repeticiones.length > 3 ? '…' : ''}</p>` : ''}<p class="muted small" style="white-space:pre-wrap;margin:0">${e.description || ''}</p></div>`)}</div>` : html`<div class="card muted">No hay citas próximas.</div>`}` : ''}
  ` : ''}

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
  <div class="card"><div class="row spread"><div><strong>Portal de aprobación del cliente</strong><br><a class="small" href="${portal}" target="_blank">${portal}</a></div>
    <form method="post" action="/admin/clientes/${client.id}/rotar-token" onsubmit="return confirm('El enlace anterior dejará de funcionar. ¿Continuar?')"><button class="btn-warn">Nuevo enlace</button></form></div>
    <p class="muted small">Aviso de posts por revisar: ${client.config.notificaciones?.email ? `correo a ${client.config.notificaciones.email}, uno al día como máximo` : 'sin correo (pon "notificaciones": { "email": "…" } en la configuración)'}${client.config.notificaciones?.whatsapp ? ' · pidió WhatsApp (aún no conectado)' : ''}.</p>
    <form method="post" action="/admin/clientes/${client.id}/aviso-prueba" class="row" style="margin-top:6px"><input name="to" type="email" placeholder="${client.config.notificaciones?.email || 'correo para la prueba'}" style="max-width:320px"><button class="btn-warn">Mandar correo de prueba</button></form></div>
  <div class="card" style="margin-top:18px"><strong>Conexión con tu agente de WhatsApp</strong>
    <p class="muted small">Tu agente de WhatsApp usa esta llave para consultar horarios libres, agendar citas en Google Calendar y registrar leads en este panel.</p>
    <p class="small">Llave: ${creds.api_key ? html`<details style="display:inline-block"><summary class="small">Mostrar</summary><code style="user-select:all">${creds.api_key}</code></details>` : html`<span class="muted">sin generar</span>`}<br>
    API: <code>${config.publicBaseUrl}/api/${client.slug}/disponibilidad</code> · <code>/citas</code> · <code>/leads</code></p>
    <form method="post" action="/admin/clientes/${client.id}/llave-api" onsubmit="return ${creds.api_key ? "confirm('La llave anterior dejará de funcionar. ¿Continuar?')" : 'true'}"><button class="btn-warn">${creds.api_key ? 'Generar llave nueva' : 'Generar llave'}</button></form></div>
  <h2>Logo</h2>
  <form method="post" action="/admin/clientes/${client.id}/logo" enctype="multipart/form-data" class="card row">
    ${client.logo_path ? html`<img src="/media/${path.basename(client.logo_path)}" style="height:48px">` : ''}
    <input type="file" name="archivo" accept="image/png,image/jpeg" required style="width:auto"><button class="btn-warn">Subir logo</button>
    <span class="muted small">PNG con fondo transparente. Lo usa el animador en cierres y esquinas.</span></form>
` : ''}
  <h2>Configuración</h2>
  <form method="post" action="${action}" class="card">
    ${isNew ? html`<label>Identificador (sin espacios)</label><input name="slug" pattern="[a-z0-9-]+" required placeholder="kuper-media">` : ''}
    <label>Nombre</label><input name="nombre" value="${client?.nombre || ''}" required>
    <label>Perfil de marca (JSON — sección 2 del prompt maestro). tipografia: ${Object.keys(FONTS).join(' o ')}</label>
    <textarea class="code" name="perfil">${JSON.stringify(client?.perfil || DEFAULT_PERFIL, null, 2)}</textarea>
    <label>Redes y frecuencia (JSON). modo_publicacion: auto | aprobacion · frecuencia: diario, 3_por_semana, 2_por_semana, semanal, quincenal, mensual</label>
    <textarea class="code" name="config" style="min-height:180px">${JSON.stringify(client?.config || DEFAULT_CONFIG, null, 2)}</textarea>
    <h2>Credenciales</h2><p class="muted small">Se guardan cifradas. Deja un campo vacío para conservar el valor actual.</p>
    <div class="split"><div>
      <strong>Meta (Instagram + Facebook)</strong>
      <label>ID de la Página de Facebook</label><input name="meta_page_id" value="${meta.page_id || ''}">
      <label>ID de la cuenta de Instagram Business</label><input name="meta_ig_user_id" value="${meta.ig_user_id || ''}">
      <label>Token de acceso de la Página</label><input name="meta_page_token" type="text" placeholder="${set(meta.page_token)}" autocomplete="off" spellcheck="false" data-lpignore="true">
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

export function postAdminPage(post, client, events) {
  const body = html`<p><a href="/admin/clientes/${client.id}">← ${client.nombre}</a></p>
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
  <div style="max-width:640px;margin:0 auto">
  <div class="row" style="gap:14px;margin-top:6px"><div class="avatar">${client.logo_path ? html`<img src="${mediaSrc(client.logo_path)}" alt="">` : client.nombre.slice(0, 1)}</div>
  <div><h1 style="margin:0">Agenda tu llamada</h1><p class="muted" style="margin:4px 0 0">${client.nombre} · ${duracion} min · hora del centro de México</p></div></div>
  ${error ? html`<div class="err">${error}</div>` : ''}
  ${slots.length ? html`<form method="post" class="card" style="margin-top:18px">
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
export function leadChatPage(client, lead, mensajes) {
  const tel = lead.telefono ? lead.telefono.replace(/\D/g, '') : null;
  const body = html`<style>${raw(`.chat{display:flex;flex-direction:column;gap:8px;max-width:720px}.burb{max-width:80%;padding:10px 14px;border-radius:18px;white-space:pre-wrap;line-height:1.45;font-size:15px}
.burb.lead{align-self:flex-start;background:var(--card2);border-bottom-left-radius:4px}.burb.agente{align-self:flex-end;background:rgba(198,255,61,.12);color:#e6ffd0;border-bottom-right-radius:4px}
.burb time{display:block;font-size:11px;color:var(--muted);margin-top:4px}`)}</style>
  <p><a class="muted small" href="/admin/clientes/${client.id}?tab=leads">← Leads</a></p>
  <div class="row spread" style="max-width:720px"><div><h1 style="margin:0">${lead.nombre || lead.usuario || lead.telefono}</h1>
  <p class="muted" style="margin:4px 0 0">${[lead.telefono, lead.usuario, lead.origen].filter(Boolean).join(' · ')}${lead.cita_inicio ? ` · cita ${fmtDate(lead.cita_inicio)}` : ''}</p></div>
  ${tel ? html`<a class="btn btn-accent" href="https://wa.me/${tel}" target="_blank" rel="noopener">Escribirle por WhatsApp</a>` : ''}</div>
  <div class="card chat" style="margin-top:18px">${mensajes.length ? mensajes.map((m) => html`<div class="burb ${m.rol}">${m.texto}<time>${m.rol === 'lead' ? 'Lead' : 'Agente'} · ${fmtChat(m.created_at)}</time></div>`) : html`<p class="muted">Sin mensajes todavía.</p>`}</div>`;
  return page({ title: `Chat · ${lead.nombre || lead.telefono || ''}`, body, side: side('clientes') });
}
