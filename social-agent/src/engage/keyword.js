// Respuesta automática a la palabra clave: cuando alguien comenta la palabra (p. ej. AGENTE)
// en un post de Instagram, se le manda un DM (respuesta privada al comentario) con lo prometido
// y, opcionalmente, una respuesta pública corta. Sigue la regla de /ig-dm: lo prometido va
// primero, sin pedir datos antes, y una pregunta corta al final.
//
// Configuración por cliente (client.config.respuesta_palabra_clave):
//   { activo, palabra, mensaje, respuesta_publica, dias }
//   mensaje admite {usuario}. Permisos del token: instagram_manage_comments, instagram_manage_messages.
import { graphCall } from '../publishers/meta.js';
import { config } from '../config.js';
import * as db from '../db.js';

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/** ¿El comentario contiene la palabra clave como palabra suelta? ("agente!", "AGENTE 🙌" sí; "agentes" no). */
export function matchesKeyword(text, palabra) {
  if (!palabra) return false;
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${norm(palabra).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}\\p{N}]|$)`, 'u');
  return re.test(norm(text));
}

export const fillTemplate = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

async function recentComments(meta, { mediaLimit = 12, perMedia = 50 } = {}) {
  const res = await graphCall('GET', `${meta.ig_user_id}/media`, {
    fields: `id,timestamp,comments.limit(${perMedia}){id,text,timestamp,username,from}`,
    limit: String(mediaLimit),
  }, meta.page_token);
  const out = [];
  for (const m of res.data || []) {
    for (const c of m.comments?.data || []) out.push({ ...c, media_id: m.id, username: c.username || c.from?.username });
  }
  return out;
}

async function sendPrivateReply(meta, commentId, text) {
  // Respuesta privada a un comentario de Instagram (Messenger Platform): llega como DM a quien comentó.
  return graphCall('POST', `${meta.page_id}/messages`, {
    recipient: JSON.stringify({ comment_id: commentId }),
    message: JSON.stringify({ text }),
  }, meta.page_token);
}

async function sendPublicReply(meta, commentId, text) {
  return graphCall('POST', `${commentId}/replies`, { message: text }, meta.page_token);
}

/**
 * Revisa comentarios y responde. La primera vez que corre para un cliente solo registra
 * los comentarios existentes (no les escribe a comentarios viejos).
 */
export async function processKeywordComments(client, { now = new Date() } = {}) {
  const cfg = client.config?.respuesta_palabra_clave;
  if (!cfg?.activo || !cfg.palabra || !cfg.mensaje) return { revisados: 0, enviados: 0 };
  const creds = db.clientCredentials(client);
  const meta = creds.meta;
  if (!meta?.ig_user_id || !meta?.page_token || !meta?.page_id) return { revisados: 0, enviados: 0, error: 'faltan credenciales de Meta' };

  const firstRun = !db.hasKeywordBaseline(client.id);
  const own = (await graphCall('GET', meta.ig_user_id, { fields: 'username' }, meta.page_token)).username;
  const comments = await recentComments(meta);
  const maxAge = (cfg.dias ?? 7) * 86400000; // Instagram solo permite la respuesta privada dentro de 7 días
  let enviados = 0;
  for (const c of comments) {
    if (db.keywordReplySeen(c.id)) continue;
    if (own && norm(c.username) === norm(own)) { db.recordKeywordReply({ clientId: client.id, comment: c, status: 'propio' }); continue; }
    if (!matchesKeyword(c.text, cfg.palabra)) continue;
    if (firstRun) { db.recordKeywordReply({ clientId: client.id, comment: c, status: 'omitido_inicial' }); continue; }
    if (now - new Date(c.timestamp) > maxAge) { db.recordKeywordReply({ clientId: client.id, comment: c, status: 'muy_viejo' }); continue; }

    const text = fillTemplate(cfg.mensaje, { usuario: c.username || '' });
    if (config.dryRun || creds.dry_run) {
      db.recordKeywordReply({ clientId: client.id, comment: c, status: 'simulado' });
      db.logEvent({ clientId: client.id, tipo: 'palabra_clave', detalle: `(simulado) DM a @${c.username}` });
      continue;
    }
    try {
      await sendPrivateReply(meta, c.id, text);
      if (cfg.respuesta_publica) {
        try { await sendPublicReply(meta, c.id, fillTemplate(cfg.respuesta_publica, { usuario: c.username || '' })); } catch { /* el DM ya salió */ }
      }
      db.recordKeywordReply({ clientId: client.id, comment: c, status: 'enviado' });
      try { db.upsertLead(client.id, { usuario: c.username, origen: 'instagram', nota: `Comentó ${cfg.palabra}` }); } catch { /* sin usuario */ }
      db.logEvent({ clientId: client.id, tipo: 'palabra_clave', detalle: `DM enviado a @${c.username}` });
      enviados++;
    } catch (e) {
      db.recordKeywordReply({ clientId: client.id, comment: c, status: 'error', error: e.message });
      db.logEvent({ clientId: client.id, tipo: 'palabra_clave_error', detalle: `@${c.username}: ${e.message}` });
    }
  }
  if (firstRun) db.setKeywordBaseline(client.id);
  return { revisados: comments.length, enviados };
}
