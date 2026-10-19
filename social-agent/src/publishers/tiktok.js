// TikTok: Content Posting API oficial (Direct Post de videos).
// La agencia registra UNA app en developers.tiktok.com (TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET en el .env)
// y cada cliente la autoriza desde el panel con "Conectar TikTok" (OAuth). Credenciales por cliente:
//   { tiktok: { access_token, refresh_token, expires_at, refresh_expires_at, open_id } }
// El access token dura 24 h y se renueva solo con el refresh token (dura 1 año).
// Ojo: hasta que TikTok audite la app, todo lo que se publica queda en privado (solo el dueño lo ve).
import fs from 'node:fs';
import { config } from '../config.js';

const API = 'https://open.tiktokapis.com/v2';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const TIKTOK_SCOPES = 'user.info.basic,video.publish';
export const tiktokRedirectUri = () => `${config.publicBaseUrl}/admin/tiktok/callback`;
export const tiktokConfigured = () => !!(config.tiktok.clientKey && config.tiktok.clientSecret);

export function tiktokAuthUrl(state) {
  const u = new URL('https://www.tiktok.com/v2/auth/authorize/');
  u.searchParams.set('client_key', config.tiktok.clientKey);
  u.searchParams.set('scope', TIKTOK_SCOPES);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('redirect_uri', tiktokRedirectUri());
  u.searchParams.set('state', state);
  return u.toString();
}

async function tokenRequest(params) {
  const res = await fetch(`${API}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: config.tiktok.clientKey, client_secret: config.tiktok.clientSecret, ...params }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`TikTok OAuth: ${j.error_description || j.error || res.status}`);
  const now = Date.now();
  return {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    open_id: j.open_id,
    expires_at: new Date(now + (j.expires_in || 86400) * 1000).toISOString(),
    refresh_expires_at: new Date(now + (j.refresh_expires_in || 31536000) * 1000).toISOString(),
  };
}

export const exchangeTikTokCode = (code) =>
  tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: tiktokRedirectUri() });

/** Devuelve credenciales con un access token vigente; si se renovó, llama a save(nuevas). */
export async function freshTikTokCreds(tk, save) {
  if (!tk?.access_token) throw new Error('TikTok no está conectado: usa "Conectar TikTok" en el panel del cliente.');
  if (new Date(tk.expires_at).getTime() - Date.now() > 10 * 60_000) return tk;
  if (!tk.refresh_token || new Date(tk.refresh_expires_at) < new Date()) {
    throw new Error('La conexión con TikTok venció: vuelve a usar "Conectar TikTok" en el panel.');
  }
  const nuevo = { ...tk, ...(await tokenRequest({ grant_type: 'refresh_token', refresh_token: tk.refresh_token })) };
  await save?.(nuevo);
  return nuevo;
}

async function tt(path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(body ?? {}),
  });
  const j = await res.json().catch(() => ({}));
  const code = j.error?.code;
  if (!res.ok || (code && code !== 'ok')) {
    const hint = /unaudited/i.test(`${code} ${j.error?.message}`)
      ? ' (la app de TikTok aún no está auditada: mientras tanto la cuenta debe ser privada o el post sale como "solo yo")'
      : '';
    throw new Error(`TikTok ${res.status}: ${j.error?.message || code || 'error desconocido'}${hint}`);
  }
  return j.data || {};
}

export const tiktokCreatorInfo = (token) => tt('/post/publish/creator_info/query/', token);

/** Publica un video. post: { caption, videoFile, opciones: { privacy, allow_comment, allow_duet, allow_stitch, disclose, brand_organic, brand_content } } */
export async function publishTikTok(tk, post, { pollMs = 5000, timeoutMs = 10 * 60_000 } = {}) {
  if (!post.videoFile) throw new Error('TikTok solo publica los videos (los carruseles se quedan en Instagram y Facebook).');
  const token = tk.access_token;
  const info = await tiktokCreatorInfo(token);
  const o = post.opciones || {};
  const privacy = o.privacy || post.privacy;
  if (!(info.privacy_level_options || []).includes(privacy)) {
    throw new Error(`TikTok: la privacidad "${privacy}" ya no está disponible en la cuenta; vuelve a aprobar el video eligiendo otra.`);
  }
  const size = fs.statSync(post.videoFile).size;
  if (size > 64 * 1024 * 1024) throw new Error('El video pesa más de 64 MB; TikTok lo pediría en partes.');

  const init = await tt('/post/publish/video/init/', token, {
    post_info: {
      title: post.caption.slice(0, 2200),
      privacy_level: privacy,
      disable_comment: !!info.comment_disabled || !o.allow_comment,
      disable_duet: !!info.duet_disabled || !o.allow_duet,
      disable_stitch: !!info.stitch_disabled || !o.allow_stitch,
      brand_organic_toggle: !!(o.disclose && o.brand_organic),
      brand_content_toggle: !!(o.disclose && o.brand_content),
      video_cover_timestamp_ms: 1000,
      is_aigc: true, // la animación la hizo una IA: TikTok pide etiquetarlo
    },
    source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: size, total_chunk_count: 1 },
  });
  const up = await fetch(init.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(size), 'Content-Range': `bytes 0-${size - 1}/${size}` },
    body: fs.readFileSync(post.videoFile),
  });
  if (!up.ok) throw new Error(`TikTok subida ${up.status}: ${(await up.text()).slice(0, 200)}`);

  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const st = await tt('/post/publish/status/fetch/', token, { publish_id: init.publish_id });
    if (st.status === 'PUBLISH_COMPLETE') {
      const vid = st.publicaly_available_post_id?.[0];
      const url = vid && info.creator_username ? `https://www.tiktok.com/@${info.creator_username}/video/${vid}` : null;
      return { id: String(vid || init.publish_id), url, privacy };
    }
    if (st.status === 'FAILED') throw new Error(`TikTok rechazó el video: ${st.fail_reason || 'sin motivo'}`);
    await sleep(pollMs);
  }
  throw new Error('TikTok tardó más de 10 minutos en procesar el video; revisa la cuenta antes de reintentar.');
}
