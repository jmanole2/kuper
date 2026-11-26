// Conecta una marca del panel con un agente de mensajes directos que corre en ESTE servidor (http://127.0.0.1:<puerto>):
// genera la llave del panel si no tiene, guarda la URL del agente, prende el reenvío de Messenger/Instagram
// (src/metaRouter.js) y suscribe su página de Facebook a los mensajes de la app.
// Lo usa deploy/instalar-amg.sh del agente de AMG; imprime en JSON lo que el instalador escribe en el .env del
// agente (llaves incluidas), así que NO se corre a mano en una terminal que alguien esté viendo.
//
//   node --env-file=.env scripts/agente-local.js --slug amg-chubbies --puerto 3410 [--apagar]
import * as db from '../src/db.js';
import { config } from '../src/config.js';
import { graphCall } from '../src/publishers/meta.js';
import { randomToken } from '../src/crypto.js';

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : ''; };
const slug = arg('slug'), puerto = Number(arg('puerto'));
db.openDb();
const c = db.listClients().find((x) => x.slug === slug);
if (!c) { console.error(`No existe la marca ${slug} en el panel.`); process.exit(1); }

if (process.argv.includes('--apagar')) {
  db.updateClient(c.id, { config: { ...c.config, mensajes_directos: { ...(c.config.mensajes_directos || {}), reenviar: false } } });
  console.error(`${c.nombre}: reenvío de mensajes directos apagado.`);
  process.exit(0);
}
if (!Number.isInteger(puerto) || puerto < 1024 || puerto > 65535) { console.error('Falta --puerto.'); process.exit(1); }

const creds = db.clientCredentials(c);
const meta = creds.meta || {};
if (!meta.page_token || !meta.page_id) { console.error(`${c.nombre} no tiene su página de Facebook conectada (corre scripts/meta-amg.js).`); process.exit(1); }
const api_key = creds.api_key || randomToken(24);
db.updateClient(c.id, {
  credentials: { ...creds, api_key, agente_url: `http://127.0.0.1:${puerto}` },
  config: { ...c.config, mensajes_directos: { ...(c.config.mensajes_directos || {}), reenviar: true } },
});
db.logEvent({ clientId: c.id, tipo: 'agente_local', detalle: `agente de mensajes directos en el puerto ${puerto}` });

// Que la app reciba los mensajes de esta página (Messenger) y de su Instagram.
let suscrita = false, error = '';
try {
  await graphCall('POST', `${meta.page_id}/subscribed_apps`, { subscribed_fields: 'messages,messaging_postbacks,messaging_referrals' }, meta.page_token);
  suscrita = true;
} catch (e) { error = e.message.slice(0, 200); }

process.stdout.write(JSON.stringify({ nombre: c.nombre, panel_url: `${config.publicBaseUrl}/api/${c.slug}`, api_key, page_token: meta.page_token, ig: !!meta.ig_user_id, suscrita, error }));
