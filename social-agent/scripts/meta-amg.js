// Conecta Facebook e Instagram de las marcas de AMG Hospitality en el panel con UN token de usuario del sistema de Kuper
// (Business → Usuarios del sistema → Generar token, con las páginas e Instagram de AMG asignados a ese usuario).
// Para cada marca busca su página por nombre, saca el token de esa página y el ID de su Instagram, prueba que se
// puedan leer comentarios y lo guarda en las credenciales de la marca. Nunca imprime tokens.
//
//   read -rsp "Token: " T; echo; printf %s "$T" | sudo -u agente /opt/agente-social/node/bin/node --env-file=.env scripts/meta-amg.js; unset T
//
// Opcional: --solo amg-chubbies (una sola marca) · --probar (solo revisa, no guarda nada)
import { readFileSync } from 'node:fs';
import * as db from '../src/db.js';
import { graphCall } from '../src/publishers/meta.js';

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : ''; };
const soloProbar = process.argv.includes('--probar');
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ''); // sin espacios: "FatBastard" = "Fat Bastard"
const corto = (e) => String(e?.message || e).replace(/access_token=[^&\s]+/g, 'access_token=…').slice(0, 220);

const token = (readFileSync(0, 'utf8') || '').replace(/["'\s]/g, '');
if (token.length < 30) { console.error('No llegó el token. Corre el comando completo con read -rsp ... | ...'); process.exit(1); }

const datos = JSON.parse(readFileSync(new URL('./datos/amg.json', import.meta.url), 'utf8'));
db.openDb();

// 1) Permisos del token.
const necesarios = ['pages_show_list', 'pages_read_engagement', 'pages_manage_engagement', 'pages_manage_metadata', 'pages_messaging',
  'instagram_basic', 'instagram_manage_comments', 'instagram_manage_messages', 'business_management'];
let otorgados = [];
try { otorgados = (await graphCall('GET', 'me/permissions', {}, token)).data.filter((p) => p.status === 'granted').map((p) => p.permission); }
catch (e) { console.error(`El token no sirve: ${corto(e)}`); process.exit(1); }
const faltan = necesarios.filter((p) => !otorgados.includes(p));
console.log(faltan.length ? `⚠ Al token le faltan permisos: ${faltan.join(', ')}` : '✔ El token tiene todos los permisos.');

// 2) Páginas a las que llega el token.
let paginas = [];
try {
  let r = await graphCall('GET', 'me/accounts', { fields: 'id,name,access_token,instagram_business_account{id,username}', limit: '100' }, token);
  paginas = r.data || [];
  while (r.paging?.next && paginas.length < 500) { r = await (await fetch(r.paging.next)).json(); paginas.push(...(r.data || [])); }
} catch (e) { console.error(`No pude leer las páginas: ${corto(e)}`); process.exit(1); }
console.log(`El token ve ${paginas.length} página(s).\n`);

// 3) Una página por marca (por nombre).
const usadas = new Set();
for (const m of datos.marcas) {
  if (arg('solo') && m.slug !== arg('solo')) continue;
  const client = db.listClients().find((c) => c.slug === m.slug);
  const nombre = m.nombre.padEnd(16);
  if (!client) { console.log(`✖ ${nombre} no existe en el panel (corre primero scripts/marcas-amg.js)`); continue; }
  const buscados = [m.nombre, ...(m.paginas || [])].map(norm);
  const p = paginas.find((x) => buscados.includes(norm(x.name))) || paginas.find((x) => buscados.some((b) => norm(x.name).startsWith(b)));
  if (!p) { console.log(`· ${nombre} sin página asignada al usuario del sistema`); continue; }
  usadas.add(p.id);
  const ig = p.instagram_business_account;
  // Prueba: leer publicaciones de Facebook y de Instagram con el token de la página.
  const pruebas = [];
  try { await graphCall('GET', `${p.id}/published_posts`, { fields: 'id', limit: '1' }, p.access_token); pruebas.push('FB ok'); } catch (e) { pruebas.push(`FB error: ${corto(e)}`); }
  if (ig) { try { await graphCall('GET', `${ig.id}/media`, { fields: 'id', limit: '1' }, p.access_token); pruebas.push('IG ok'); } catch (e) { pruebas.push(`IG error: ${corto(e)}`); } }
  else pruebas.push('sin Instagram ligado a la página');
  if (!soloProbar) {
    const creds = db.clientCredentials(client);
    db.updateClient(client.id, { credentials: { ...creds, meta: { ...(creds.meta || {}), page_id: p.id, page_token: p.access_token, ...(ig ? { ig_user_id: ig.id } : {}) } } });
    db.logEvent({ clientId: client.id, tipo: 'meta_conectado', detalle: `${p.name}${ig ? ` + @${ig.username}` : ''}` });
  }
  console.log(`${pruebas.some((x) => /error/.test(x)) ? '⚠' : '✔'} ${nombre} → ${p.name} (${p.id})${ig ? ` + @${ig.username}` : ''} · ${pruebas.join(' · ')}${soloProbar ? ' · (no se guardó)' : ' · guardado'}`);
}
const sobran = paginas.filter((x) => !usadas.has(x.id));
if (sobran.length && !arg('solo')) console.log(`\nOtras páginas que ve el token (no se tocaron): ${sobran.map((x) => x.name).join(', ')}`);
console.log('\nSiguiente: en cada marca, Comentarios → activar con "Revisión" prendida.');
