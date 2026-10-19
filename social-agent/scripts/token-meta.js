// Guarda el token de la Página de Meta de un cliente desde la terminal (sin pasar por el navegador)
// y lo prueba contra Facebook e Instagram antes de guardarlo.
//   printf %s "$TOKEN" | npm run token-meta -- kuper-media
import fs from 'node:fs';
import * as db from '../src/db.js';
import { graphCall } from '../src/publishers/meta.js';

const slug = process.argv[2] || 'kuper-media';
const client = db.listClients().find((c) => c.slug === slug);
if (!client) { console.error(`No existe el cliente "${slug}"`); process.exit(1); }

const token = fs.readFileSync(0, 'utf8').replace(/^\s*[A-Z_]+\s*=/, '').replace(/["'\s$]/g, '');
if (!/^EAA[A-Za-z0-9]+$/.test(token)) {
  console.error(`Eso no parece un token de Meta (debe empezar con EAA y tener solo letras y números). Recibí ${token.length} caracteres.`);
  process.exit(1);
}

const creds = db.clientCredentials(client);
const meta = { ...(creds.meta || {}), page_token: token };
try {
  const page = await graphCall('GET', meta.page_id || 'me', { fields: 'id,name,instagram_business_account{id,username}' }, token);
  meta.page_id ||= page.id;
  const ig = page.instagram_business_account;
  if (ig && !meta.ig_user_id) meta.ig_user_id = ig.id;
  console.log(`Facebook: página "${page.name}" (ID ${page.id})`);
  console.log(ig ? `Instagram: @${ig.username} (ID ${ig.id})` : 'Instagram: la página no tiene cuenta de Instagram vinculada');
} catch (e) {
  console.error(`Meta rechazó el token: ${e.message}. No se guardó nada.`);
  process.exit(1);
}
db.updateClient(client.id, { credentials: { ...creds, meta } });
console.log(`Token guardado para ${client.nombre} (${token.length} caracteres, termina en ...${token.slice(-4)}).`);
console.log('Reinicia el agente para que lo use de inmediato: systemctl restart agente-social');
