// Datos públicos de cuentas de la competencia con Instagram Business Discovery (API oficial).
// Solo funciona con cuentas de Instagram Business o Creator. Usa las credenciales Meta del cliente.
import { graphCall } from '../publishers/meta.js';

const FIELDS = 'username,name,biography,followers_count,media_count,' +
  'media.limit(25){caption,like_count,comments_count,timestamp,media_type,media_product_type,permalink}';

export async function fetchCompetitor(meta, handle) {
  if (!meta?.ig_user_id || !meta?.page_token) throw new Error('Faltan credenciales de Meta (ig_user_id, page_token)');
  const res = await graphCall('GET', meta.ig_user_id, { fields: `business_discovery.username(${handle}){${FIELDS}}` }, meta.page_token);
  const bd = res.business_discovery;
  const followers = bd.followers_count || 0;
  const media = (bd.media?.data || []).map((m) => ({
    tipo: m.media_product_type === 'REELS' ? 'REEL' : m.media_type,
    fecha: m.timestamp,
    likes: m.like_count ?? null,
    comentarios: m.comments_count ?? null,
    engagement: followers && m.like_count != null ? +(((m.like_count + (m.comments_count || 0)) / followers) * 100).toFixed(2) + '%' : null,
    caption: (m.caption || '').slice(0, 600),
    permalink: m.permalink,
  }));
  return { cuenta: bd.username, nombre: bd.name, bio: bd.biography, seguidores: followers, total_posts: bd.media_count, posts_recientes: media };
}

export async function fetchCompetitors(meta, competitors) {
  const cuentas = [];
  const errores = [];
  for (const c of competitors.filter((x) => x.plataforma === 'instagram')) {
    try {
      cuentas.push({ ...(await fetchCompetitor(meta, c.handle)), notas: c.notas || undefined });
    } catch (e) {
      errores.push(`@${c.handle}: ${e.message}`);
    }
  }
  return { cuentas, errores };
}
