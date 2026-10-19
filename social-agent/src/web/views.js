// Vistas: tarjeta de post (compartida), portal del cliente y panel de admin.
import path from 'node:path';
import { html, raw, esc, page } from './html.js';
import { STATUS, PLATFORMS } from '../db.js';
import { localDate, localTime } from '../schedule.js';
import { config } from '../config.js';

const PLAT = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn' };
const FORMATO = { imagen_estatica: 'Imagen', video_animado: 'Animación', solo_texto: 'Solo texto' };
const fmtDate = (iso) => (iso ? new Intl.DateTimeFormat('es-MX', { timeZone: config.timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—');
const mediaSrc = (p) => (p ? `/media/${encodeURIComponent(path.basename(p))}` : null);
export const badge = (s) => html`<span class="badge b-${s}">${STATUS[s] || s}</span>`;

function mediaBlock(p) {
  if (p.video_path) return html`<video class="media" src="${mediaSrc(p.video_path)}" ${raw(p.image_path ? `poster="${esc(mediaSrc(p.image_path))}"` : '')} controls playsinline preload="metadata"></video>`;
  if (p.image_path) return html`<img class="media" src="${mediaSrc(p.image_path)}" alt="${p.alt_text || ''}">`;
  return '';
}

/** base: URL base para las acciones del post (portal: /p/:token/posts/:id, admin: /admin/posts/:id) */
export function postCard(p, { base, admin = false }) {
  const s = p.salida;
  const editable = p.status === 'pendiente';
  const warns = (s?.advertencias || []).filter((w) => admin || !w.startsWith('Validación:'));
  return html`<article class="card" id="post-${p.id}">
  <div class="row spread"><strong>${PLAT[p.plataforma]} · ${FORMATO[p.formato] || 'Post'}</strong>${badge(p.status)}</div>
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
  ${admin && ['aprobado', 'error'].includes(p.status) ? html`<form method="post" action="${base}/publicar" class="inline"><p><button class="btn-accent">Publicar ahora</button></p></form>` : ''}
  ${admin && p.status === 'aprobado' ? html`<form method="post" action="${base}/rechazar" class="inline" onsubmit="return confirm('¿Cancelar?')"><button class="btn-bad">Cancelar</button></form>` : ''}
</article>`;
}

// ------------------------------------------------------------ portal del cliente
export function portalPage(client, posts, token) {
  const base = (p) => `/p/${token}/posts/${p.id}`;
  const by = (sts) => posts.filter((p) => sts.includes(p.status));
  const pend = by(['pendiente', 'necesita_asset', 'cambios_solicitados', 'generando']);
  const prog = by(['aprobado', 'publicando']).reverse();
  const pub = by(['publicado']).slice(0, 12);
  const body = html`
  <h1>Hola, ${client.nombre}</h1>
  <p class="muted">Revisa y aprueba tus próximas publicaciones. Nada se publica sin tu visto bueno${PLATFORMS.some((pl) => client.config[pl]?.activo && client.config[pl]?.modo_publicacion === 'auto') ? ' (salvo en las redes que configuraste en automático)' : ''}.</p>
  <h2>Por revisar (${pend.length})</h2>
  ${pend.length ? html`<div class="grid">${pend.map((p) => postCard(p, { base: base(p) }))}</div>` : html`<p class="muted">No tienes nada pendiente.</p>`}
  <h2>Programadas (${prog.length})</h2>
  ${prog.length ? html`<div class="grid">${prog.map((p) => postCard(p, { base: base(p) }))}</div>` : html`<p class="muted">Nada programado todavía.</p>`}
  <h2>Publicadas recientemente</h2>
  ${pub.length ? html`<div class="grid">${pub.map((p) => postCard(p, { base: base(p) }))}</div>` : html`<p class="muted">Aún no hay publicaciones.</p>`}
  ${pend.some((p) => ['generando', 'cambios_solicitados'].includes(p.status)) ? raw('<script>setTimeout(()=>location.reload(),15000)</script>') : ''}`;
  return page({ title: `Publicaciones · ${client.nombre}`, brand: client.nombre, body });
}

// ------------------------------------------------------------ admin
const adminNav = raw('<a href="/admin">Clientes</a><a href="/admin/clientes/nuevo">Nuevo cliente</a><a href="/admin/salir">Salir</a>');

export function loginPage(error) {
  return page({ title: 'Entrar', body: html`<div class="card" style="max-width:380px;margin:60px auto">
    <h1>Panel de agencia</h1>${error ? html`<div class="err">${error}</div>` : ''}
    <form method="post" action="/admin/entrar"><label>Contraseña</label><input type="password" name="password" autofocus required>
    <p><button>Entrar</button></p></form></div>` });
}

export function dashboardPage(clients, counts, events) {
  const body = html`<h1>Clientes</h1>
  <div class="grid">${clients.map((c) => html`<a class="card" href="/admin/clientes/${c.id}" style="text-decoration:none">
    <div class="row spread"><strong>${c.nombre}</strong>${c.activo ? '' : badge('rechazado')}</div>
    <p class="muted small">${PLATFORMS.filter((p) => c.config[p]?.activo).map((p) => `${PLAT[p]} (${c.config[p].modo_publicacion})`).join(' · ') || 'Sin redes activas'}</p>
    <div class="row">${Object.entries(counts[c.id] || {}).map(([s, n]) => html`<span>${badge(s)} ${n}</span>`)}</div></a>`)}
  </div>
  ${clients.length ? '' : html`<p class="muted">Todavía no hay clientes. <a href="/admin/clientes/nuevo">Crea el primero</a>.</p>`}
  <h2>Actividad reciente</h2>
  <div class="card"><table>${events.map((e) => html`<tr><td class="muted small">${fmtDate(e.created_at.replace(' ', 'T') + 'Z')}</td><td>${e.cliente || ''}</td><td>${e.tipo}</td><td class="small">${e.detalle}</td></tr>`)}</table></div>`;
  return page({ title: 'Agente Social · Admin', nav: adminNav, body });
}

export function clientFormPage(client, { error, competitors = [], report, posts = [], creds = {} } = {}) {
  const isNew = !client;
  const action = isNew ? '/admin/clientes/nuevo' : `/admin/clientes/${client.id}`;
  const portal = client ? `${config.publicBaseUrl}/p/${client.portal_token}` : '';
  const meta = creds.meta || {}, li = creds.linkedin || {};
  const set = (v) => (v ? '•••••• (guardado)' : '');
  const body = html`
  <h1>${isNew ? 'Nuevo cliente' : client.nombre}</h1>
  ${error ? html`<div class="err">${error}</div>` : ''}
  ${!isNew ? html`<div class="card"><div class="row spread"><div><strong>Portal de aprobación del cliente</strong><br><a class="small" href="${portal}" target="_blank">${portal}</a></div>
    <form method="post" action="/admin/clientes/${client.id}/rotar-token" onsubmit="return confirm('El enlace anterior dejará de funcionar. ¿Continuar?')"><button class="btn-warn">Nuevo enlace</button></form></div></div>
  <h2>Generar ahora</h2>
  <div class="row">${PLATFORMS.filter((p) => client.config[p]?.activo).map((p) => html`<form method="post" action="/admin/clientes/${client.id}/generar" class="inline"><input type="hidden" name="plataforma" value="${p}"><button class="btn-accent">Post para ${PLAT[p]}</button></form>`)}</div>
  <h2>Posts</h2>
  ${posts.length ? html`<div class="grid">${posts.map((p) => postCard(p, { base: `/admin/posts/${p.id}`, admin: true }))}</div>` : html`<p class="muted">Sin posts todavía.</p>`}
  <h2>Competencia</h2>
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
  <h2>Logo</h2>
  <form method="post" action="/admin/clientes/${client.id}/logo" enctype="multipart/form-data" class="card row">
    ${client.logo_path ? html`<img src="/media/${path.basename(client.logo_path)}" style="height:48px">` : ''}
    <input type="file" name="archivo" accept="image/png,image/jpeg" required style="width:auto"><button class="btn-warn">Subir logo</button>
    <span class="muted small">Se usa en el cierre de las animaciones.</span></form>` : ''}

  <h2>Configuración</h2>
  <form method="post" action="${action}" class="card">
    ${isNew ? html`<label>Identificador (sin espacios)</label><input name="slug" pattern="[a-z0-9-]+" required placeholder="kuper-media">` : ''}
    <label>Nombre</label><input name="nombre" value="${client?.nombre || ''}" required>
    <label>Perfil de marca (JSON — sección 2 del prompt maestro)</label>
    <textarea class="code" name="perfil">${JSON.stringify(client?.perfil || DEFAULT_PERFIL, null, 2)}</textarea>
    <label>Redes y frecuencia (JSON). modo_publicacion: auto | aprobacion · frecuencia: diario, 3_por_semana, 2_por_semana, semanal, quincenal, mensual</label>
    <textarea class="code" name="config" style="min-height:180px">${JSON.stringify(client?.config || DEFAULT_CONFIG, null, 2)}</textarea>
    <h2>Credenciales</h2><p class="muted small">Se guardan cifradas. Deja un campo vacío para conservar el valor actual.</p>
    <div class="split"><div>
      <strong>Meta (Instagram + Facebook)</strong>
      <label>ID de la Página de Facebook</label><input name="meta_page_id" value="${meta.page_id || ''}">
      <label>ID de la cuenta de Instagram Business</label><input name="meta_ig_user_id" value="${meta.ig_user_id || ''}">
      <label>Token de acceso de la Página</label><input name="meta_page_token" type="password" placeholder="${set(meta.page_token)}" autocomplete="off">
    </div><div>
      <strong>LinkedIn (Página de empresa)</strong>
      <label>ID de la organización</label><input name="li_org_id" value="${li.org_id || ''}" placeholder="12345678">
      <label>Access token (w_organization_social)</label><input name="li_access_token" type="password" placeholder="${set(li.access_token)}" autocomplete="off">
      <label style="font-weight:400"><input type="checkbox" name="dry_run" value="1" style="width:auto" ${raw(creds.dry_run ? 'checked' : '')}> Modo simulación (no publica de verdad)</label>
    </div></div>
    ${!isNew ? html`<label style="font-weight:400"><input type="checkbox" name="activo" value="1" style="width:auto" ${raw(client.activo ? 'checked' : '')}> Cliente activo (el agente genera y publica)</label>` : ''}
    <p><button>${isNew ? 'Crear cliente' : 'Guardar'}</button></p>
  </form>`;
  return page({ title: isNew ? 'Nuevo cliente' : client.nombre, nav: adminNav, body });
}

export function postAdminPage(post, client, events) {
  const body = html`<p><a href="/admin/clientes/${client.id}">← ${client.nombre}</a></p>
  <div class="split"><div>${postCard(post, { base: `/admin/posts/${post.id}`, admin: true })}</div>
  <div><div class="card"><strong>Bitácora</strong><table>${events.map((e) => html`<tr><td class="muted small">${fmtDate(e.created_at.replace(' ', 'T') + 'Z')}</td><td>${e.tipo}</td><td class="small">${e.detalle}</td></tr>`)}</table></div>
  ${post.salida ? html`<details class="card" style="margin-top:16px"><summary>Salida completa del agente (JSON)</summary><pre class="small" style="white-space:pre-wrap">${JSON.stringify(post.salida, null, 2)}</pre></details>` : ''}
  ${post.feedback ? html`<div class="card" style="margin-top:16px"><strong>Comentarios del cliente</strong><p>${post.feedback}</p></div>` : ''}</div></div>`;
  return page({ title: `Post ${post.id}`, nav: adminNav, body });
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
  ],
  colores_marca: ['#111111', '#FFFFFF', '#FF5A36'],
  permite_emojis: false,
  temas_prohibidos: ['política', 'religión'],
  cta_preferido: 'Escríbenos',
  ejemplos_de_posts_que_funcionaron: [],
};

export const DEFAULT_CONFIG = {
  instagram: { activo: true, frecuencia: 'semanal', modo_publicacion: 'aprobacion', hora: '10:00', formatos: ['imagen_estatica', 'video_animado'] },
  facebook: { activo: true, frecuencia: 'semanal', modo_publicacion: 'aprobacion', hora: '11:00' },
  linkedin: { activo: false, frecuencia: 'quincenal', modo_publicacion: 'aprobacion', hora: '09:00' },
};
