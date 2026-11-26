// Repartidor de mensajes directos de Meta (Messenger e Instagram) para la app de Kuper.
// Meta manda TODOS los mensajes de la app a una sola URL; aquí se ve a qué página o Instagram le escribieron
// y se reenvía al agente de esa marca. Lo que no es de una marca con reenvío activo se manda tal cual al
// agente de siempre (META_WEBHOOK_DEFAULT, p. ej. https://agente.kuper.media/webhook), así nada se rompe.
//
// Una marca recibe sus mensajes aquí si tiene: config.mensajes_directos.reenviar = true, credentials.agente_url
// y su meta.page_id (Messenger) o meta.ig_user_id (Instagram). WhatsApp no pasa por aquí.
import crypto from 'node:crypto';
import * as db from './db.js';

export const hooks = { fetch: (...a) => fetch(...a) }; // pruebas

export const firmar = (raw, secreto) => `sha256=${crypto.createHmac('sha256', secreto).update(raw).digest('hex')}`;
export function firmaValida(raw, header, secreto) {
  if (!secreto) return false;
  const a = Buffer.from(firmar(raw, secreto)), b = Buffer.from(String(header || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Marca (cliente) que atiende un id de página o de Instagram, si tiene el reenvío activo. */
export function destinoDe(objeto, id) {
  for (const c of db.listClients()) {
    if (!c.activo || c.config?.mensajes_directos?.reenviar !== true) continue;
    const cr = db.clientCredentials(c);
    if (!cr.agente_url) continue;
    const m = cr.meta || {};
    if ((objeto === 'page' && String(m.page_id) === String(id)) || (objeto === 'instagram' && String(m.ig_user_id) === String(id))) return { client: c, url: `${cr.agente_url.replace(/\/+$/, '')}/webhook` };
  }
  return null;
}

/**
 * Reparte un webhook ya verificado. Devuelve [{ url, cuerpo, firma, marca }] (lo que se manda).
 * Si nada es de una marca con reenvío, el cuerpo original va completo (con su firma original) al agente de siempre.
 */
export function repartir(raw, firmaOriginal, { secreto, porDefecto }) {
  let body; try { body = JSON.parse(raw.toString('utf8')); } catch { return []; }
  const objeto = body?.object;
  if (!['page', 'instagram'].includes(objeto) || !Array.isArray(body.entry)) return porDefecto ? [{ url: porDefecto, cuerpo: raw, firma: firmaOriginal, marca: null }] : [];
  const grupos = new Map(); const sobran = [];
  for (const e of body.entry) {
    const d = destinoDe(objeto, e?.id);
    if (!d) { sobran.push(e); continue; }
    if (!grupos.has(d.url)) grupos.set(d.url, { marca: d.client.slug, entry: [] });
    grupos.get(d.url).entry.push(e);
  }
  if (!grupos.size) return porDefecto ? [{ url: porDefecto, cuerpo: raw, firma: firmaOriginal, marca: null }] : [];
  const envios = [...grupos].map(([url, g]) => { const cuerpo = Buffer.from(JSON.stringify({ object: objeto, entry: g.entry })); return { url, cuerpo, firma: firmar(cuerpo, secreto), marca: g.marca }; });
  if (sobran.length && porDefecto) { const cuerpo = Buffer.from(JSON.stringify({ object: objeto, entry: sobran })); envios.push({ url: porDefecto, cuerpo, firma: firmar(cuerpo, secreto), marca: null }); }
  return envios;
}

export async function reenviar(envios) {
  await Promise.all(envios.map(async (x) => {
    try {
      const r = await hooks.fetch(x.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': x.firma }, body: x.cuerpo, signal: AbortSignal.timeout(10000) });
      if (!r.ok) console.error(`[meta router] ${x.marca || 'por defecto'} respondió ${r.status}`);
    } catch (e) { console.error(`[meta router] ${x.marca || 'por defecto'}: ${e.message}`); }
  }));
}
