// Vistas: tarjeta de post (compartida), portal del cliente y panel de admin.
import path from 'node:path';
import { html, raw, esc, page } from './html.js';
import { STATUS, PLATFORMS } from '../db.js';
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

export function clientFormPage(client, { error, notice, competitors = [], report, posts = [], creds = {}, keywordReplies = [] } = {}) {
  const isNew = !client;
  const action = isNew ? '/admin/clientes/nuevo' : `/admin/clientes/${client.id}`;
  const portal = client ? `${config.publicBaseUrl}/p/${client.portal_token}` : '';
  const meta = creds.meta || {}, li = creds.linkedin || {};
  const set = (v) => (v ? `guardado: ${String(v).slice(0, 3)}…${String(v).slice(-4)} (${String(v).length} caracteres)` : '');
  const body = html`
  <h1>${isNew ? 'Nuevo cliente' : client.nombre}</h1>
  ${error ? html`<div class="err">${error}</div>` : ''}
  ${notice ? html`<div class="okmsg">${notice}</div>` : ''}
  ${!isNew ? html`<div class="card"><div class="row spread"><div><strong>Portal de aprobación del cliente</strong><br><a class="small" href="${portal}" target="_blank">${portal}</a></div>
    <form method="post" action="/admin/clientes/${client.id}/rotar-token" onsubmit="return confirm('El enlace anterior dejará de funcionar. ¿Continuar?')"><button class="btn-warn">Nuevo enlace</button></form></div>
    <p class="muted small">Aviso de posts por revisar: ${client.config.notificaciones?.email ? `correo a ${client.config.notificaciones.email}, uno al día como máximo` : 'sin correo (pon "notificaciones": { "email": "…" } en la configuración)'}${client.config.notificaciones?.whatsapp ? ' · pidió WhatsApp (aún no conectado)' : ''}.</p></div>
  <h2>Generar ahora</h2>
  <div class="row">${PLATFORMS.filter((p) => client.config[p]?.activo && !reusa(client, p)).map((p) => html`<form method="post" action="/admin/clientes/${client.id}/generar" class="inline"><input type="hidden" name="plataforma" value="${p}"><button class="btn-accent">Post para ${PLAT[p]}</button></form>`)}</div>
  <h2>Posts</h2>
  ${posts.length ? html`<div class="grid">${posts.map((p) => postCard(p, { base: `/admin/posts/${p.id}`, admin: true }))}</div>` : html`<p class="muted">Sin posts todavía.</p>`}
  ${client.config.respuesta_palabra_clave?.activo ? html`<h2>Palabra clave ${client.config.respuesta_palabra_clave.palabra}</h2>
  <div class="card"><p class="muted small">Quien comenta ${client.config.respuesta_palabra_clave.palabra} en Instagram recibe un DM automático. Se configura en "respuesta_palabra_clave" de la configuración.</p>
    <table>${keywordReplies.map((r) => html`<tr><td class="muted small">${fmtDate(r.created_at.replace(' ', 'T') + 'Z')}</td><td>@${r.username}</td><td class="small">${r.texto}</td><td>${{ enviado: 'DM enviado', simulado: 'Simulado', error: 'Error', omitido_inicial: 'Anterior a la activación', muy_viejo: 'Más de 7 días' }[r.status] || r.status}${r.error ? html`<br><span class="small" style="color:var(--bad)">${r.error}</span>` : ''}</td></tr>`)}</table>
    ${keywordReplies.length ? '' : html`<p class="muted small">Todavía nadie ha comentado la palabra.</p>`}</div>` : ''}
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
    <span class="muted small">PNG con fondo transparente. Lo usa el animador en cierres y esquinas.</span></form>` : ''}

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
  ${!isNew ? html`<form method="post" action="/admin/clientes/${client.id}/probar"><button class="btn-accent">Probar conexión con Meta y LinkedIn</button></form>` : ''}`;
  return page({ title: isNew ? 'Nuevo cliente' : client.nombre, nav: adminNav, body });
}

export function postAdminPage(post, client, events) {
  const body = html`<p><a href="/admin/clientes/${client.id}">← ${client.nombre}</a></p>
  <div class="split"><div>${postCard(post, { base: `/admin/posts/${post.id}`, admin: true })}</div>
  <div><div class="card"><strong>Bitácora</strong><table>${events.map((e) => html`<tr><td class="muted small">${fmtDate(e.created_at.replace(' ', 'T') + 'Z')}</td><td>${e.tipo}</td><td class="small">${e.detalle}</td></tr>`)}</table></div>
  ${post.salida?.visual?.codigo ? html`<details class="card" style="margin-top:16px"><summary>Animador: ${post.salida.visual.respaldo ? 'diseño de respaldo' : `${post.salida.visual.rondas} rondas`}</summary>
    <p><strong>Concepto:</strong> ${post.salida.visual.concepto}</p><pre class="small" style="white-space:pre-wrap;max-height:420px;overflow:auto">${post.salida.visual.codigo}</pre></details>` : ''}
  ${post.salida ? html`<details class="card" style="margin-top:16px"><summary>Salida completa del agente (JSON)</summary><pre class="small" style="white-space:pre-wrap">${JSON.stringify({ ...post.salida, visual: undefined }, null, 2)}</pre></details>` : ''}
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
