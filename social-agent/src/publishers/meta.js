// Publicación en Instagram y Facebook con la Meta Graph API oficial.
// Credenciales por cliente: { meta: { page_id, page_token, ig_user_id } }
//   - page_token: token de página de larga duración (no caduca si sale de un token de usuario de larga duración)
//   - permisos: pages_manage_posts, pages_read_engagement, instagram_basic, instagram_content_publish, business_management
import { config } from '../config.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const graph = (p) => `https://graph.facebook.com/${config.metaGraphVersion}/${p}`;

export async function graphCall(method, p, params, token) {
  const url = new URL(graph(p));
  const opts = { method };
  const all = { ...params, access_token: token };
  if (method === 'GET') Object.entries(all).forEach(([k, v]) => url.searchParams.set(k, v));
  else opts.body = new URLSearchParams(Object.entries(all).filter(([, v]) => v !== undefined && v !== null));
  const res = await fetch(url, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const e = body.error || {};
    throw new Error(`Meta ${res.status}: ${e.message || 'error desconocido'}${e.error_user_msg ? ` — ${e.error_user_msg}` : ''} (code ${e.code ?? '?'})`);
  }
  return body;
}

function needCreds(meta, keys) {
  const missing = keys.filter((k) => !meta?.[k]);
  if (missing.length) throw new Error(`Faltan credenciales de Meta: ${missing.join(', ')}`);
}

// Los contenedores de video se procesan de forma asíncrona: hay que esperar a FINISHED.
async function waitContainer(id, token, { timeoutMs = 10 * 60_000, pollMs = 5000 } = {}) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const { status_code, status } = await graphCall('GET', id, { fields: 'status_code,status' }, token);
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`Instagram no pudo procesar el video: ${status || status_code}`);
    await sleep(pollMs);
  }
  throw new Error('Instagram tardó demasiado en procesar el video');
}

/**
 * post: { caption, imageUrl?, imageUrls? (carrusel, 2-10), videoUrl?, coverUrl?, altText? }
 * Las URLs deben ser públicas: Instagram las descarga desde sus servidores.
 */
export async function publishInstagram(meta, post, opts = {}) {
  needCreds(meta, ['ig_user_id', 'page_token']);
  const token = meta.page_token;
  let params;
  if (post.imageUrls?.length > 1) {
    // Carrusel: un contenedor por imagen y luego el contenedor CAROUSEL que los agrupa.
    const children = [];
    for (const url of post.imageUrls.slice(0, 10)) {
      children.push((await graphCall('POST', `${meta.ig_user_id}/media`, { image_url: url, is_carousel_item: 'true' }, token)).id);
    }
    params = { media_type: 'CAROUSEL', children: children.join(','), caption: post.caption };
  } else if (post.videoUrl) {
    params = { media_type: 'REELS', video_url: post.videoUrl, caption: post.caption, share_to_feed: 'true' };
    if (post.coverUrl) params.cover_url = post.coverUrl;
  } else if (post.imageUrl) {
    params = { image_url: post.imageUrl, caption: post.caption };
    if (post.altText) params.alt_text = post.altText;
  } else {
    throw new Error('Instagram requiere imagen o video');
  }
  const container = await graphCall('POST', `${meta.ig_user_id}/media`, params, token);
  if (post.videoUrl) await waitContainer(container.id, token, opts);
  const published = await graphCall('POST', `${meta.ig_user_id}/media_publish`, { creation_id: container.id }, token);
  let url = null;
  try { url = (await graphCall('GET', published.id, { fields: 'permalink' }, token)).permalink; } catch { /* opcional */ }
  return { id: published.id, url };
}

export async function publishFacebook(meta, post) {
  needCreds(meta, ['page_id', 'page_token']);
  const token = meta.page_token;
  let res;
  if (post.imageUrls?.length > 1) {
    // Varias fotos: se suben sin publicar y luego se adjuntan a una sola publicación.
    const params = { message: post.caption };
    for (const [i, url] of post.imageUrls.entries()) {
      const ph = await graphCall('POST', `${meta.page_id}/photos`, { url, published: 'false' }, token);
      params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: ph.id });
    }
    res = await graphCall('POST', `${meta.page_id}/feed`, params, token);
  } else if (post.videoUrl) {
    res = await graphCall('POST', `${meta.page_id}/videos`, { file_url: post.videoUrl, description: post.caption }, token);
  } else if (post.imageUrl) {
    res = await graphCall('POST', `${meta.page_id}/photos`, { url: post.imageUrl, message: post.caption, alt_text_custom: post.altText }, token);
  } else {
    res = await graphCall('POST', `${meta.page_id}/feed`, { message: post.caption }, token);
  }
  const id = res.post_id || res.id;
  const url = post.videoUrl ? `https://www.facebook.com/${meta.page_id}/videos/${res.id}` : `https://www.facebook.com/${id}`;
  return { id, url };
}
