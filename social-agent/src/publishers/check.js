// "Probar conexión" del panel: confirma que los tokens guardados sirven, sin publicar nada.
import { graphCall } from './meta.js';
import { li } from './linkedin.js';
import { tiktokCreatorInfo } from './tiktok.js';

export async function checkConnections(creds = {}) {
  const out = [];
  const m = creds.meta || {};
  if (!m.page_token) out.push({ ok: false, texto: 'Meta: falta el token de la Página' });
  else {
    try {
      const page = await graphCall('GET', m.page_id || 'me', { fields: 'name' }, m.page_token);
      out.push({ ok: true, texto: `Facebook: conectado a la página "${page.name}"` });
    } catch (e) { out.push({ ok: false, texto: `Facebook: ${e.message}` }); }
    if (!m.ig_user_id) out.push({ ok: false, texto: 'Instagram: falta el ID de la cuenta' });
    else {
      try {
        const ig = await graphCall('GET', m.ig_user_id, { fields: 'username' }, m.page_token);
        out.push({ ok: true, texto: `Instagram: conectado a @${ig.username}` });
      } catch (e) { out.push({ ok: false, texto: `Instagram: ${e.message}` }); }
    }
  }
  const l = creds.linkedin || {};
  if (l.access_token || l.org_id) {
    if (!l.access_token || !l.org_id) out.push({ ok: false, texto: 'LinkedIn: falta el ID de la organización o el token' });
    else {
      try {
        const { json } = await li('GET', `/organizations/${l.org_id}`, l.access_token);
        out.push({ ok: true, texto: `LinkedIn: conectado a "${json.localizedName || l.org_id}"` });
      } catch (e) {
        // 401 = token inválido o vencido. 403 = el token sirve pero no puede leer datos de la página
        // (normal si solo tiene w_organization_social); publicar sí funciona.
        // 403: el token existe pero no puede leer la página. No confirma que pueda publicar como empresa.
        if (/LinkedIn 403/.test(e.message)) out.push({ ok: false, texto: 'LinkedIn: no se pudo confirmar el permiso sobre la página de empresa. Si publicar falla con "Organization permissions", genera el token con w_organization_social o usa "publicar_como": "perfil".' });
        else out.push({ ok: false, texto: e.message });
      }
    }
  }
  if (creds.tiktok?.access_token) {
    try {
      const info = await tiktokCreatorInfo(creds.tiktok.access_token);
      out.push({ ok: true, texto: `TikTok: conectado a @${info.creator_username}` });
    } catch (e) { out.push({ ok: false, texto: `${e.message}${/401|expired|invalid/i.test(e.message) ? ' (vuelve a dar "Conectar TikTok")' : ''}` }); }
  }
  return out;
}
