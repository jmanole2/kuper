import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'docs-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123' });
const db = await import('../src/db.js');
const paises = await import('../src/paises.js');
const docs = await import('../src/documentos.js');
const { hashPassword } = await import('../src/crypto.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');

const embudos = [{ id: 'p', nombre: 'Postulaciones', etapas: [{ id: 'pend', nombre: 'Pendientes', tipo: 'conversacion' }, { id: 'ok', nombre: 'Completos', tipo: 'cita' }] }];
const c = db.createClient({ slug: 'nv', nombre: 'NV', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] },
  config: { plan: { servicios: { chat: true } }, embudos }, credentials: { api_key: 'llave-nv' } });
const cata = db.createUser({ email: 'cata@nv.mx', nombre: 'Cata', rol: 'cliente', client_id: c.id, password_hash: hashPassword('ClaveCata2030') });
db.updateClient(c.id, { config: { ...db.getClient(c.id).config, paises: { activo: true, asesores: { Colombia: cata.id } },
  documentos: { activo: true, requeridos: ['RUT', 'Identificación'], drive_carpeta: 'RAIZ', etapa_completos: 'ok' } } });
const cl = () => db.getClient(c.id);

// Drive de prueba
const drive = [];
docs.hooks.token = async () => 'tok';
docs.hooks.fetch = async (url, o = {}) => {
  const u = String(url); drive.push({ u, metodo: o.method });
  if (u.includes('/files?q=') || u.includes('files?') && o.method === 'GET') return new Response(JSON.stringify({ files: [] }));
  if (u.includes('upload/drive')) return new Response(JSON.stringify({ id: 'F1', webViewLink: 'https://drive.google.com/file/d/F1' }));
  return new Response(JSON.stringify({ id: `carpeta${drive.length}` }));
};

const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

test('país por lada', () => {
  assert.equal(paises.paisDeTelefono('+573001112233'), 'Colombia');
  assert.equal(paises.paisDeTelefono('5512345678'), 'México');
  assert.equal(paises.paisDeTelefono('+5491122334455'), 'Argentina');
  assert.equal(paises.paisDeTelefono('+51900111222'), 'Perú');
  assert.equal(paises.paisDeTelefono('123'), null);
});

test('un lead de Colombia queda etiquetado y asignado a Cata', async () => {
  const r = await fetch(`${base}/api/nv/leads`, { method: 'POST', headers: { Authorization: 'Bearer llave-nv', 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: 'Juan', telefono: '+57 300 111 2233', empresa: 'Arepas' }) });
  const { lead } = await r.json();
  assert.deepEqual(JSON.parse(lead.tags_json), ['Colombia']);
  assert.equal(lead.asignado_id, cata.id);
});

test('documento por WhatsApp: se guarda, se sube a Drive, se palomea y mueve de etapa', async () => {
  const pdf = Buffer.from('%PDF-1.4 prueba');
  const r = await fetch(`${base}/api/nv/documentos`, { method: 'POST', headers: { Authorization: 'Bearer llave-nv', 'Content-Type': 'application/pdf', 'X-Telefono': '573001112233', 'X-Nombre': encodeURIComponent('RUT Arepas.pdf'), 'X-Caption': encodeURIComponent('mi rut') }, body: pdf });
  const j = await r.json();
  assert.equal(r.status, 200, JSON.stringify(j));
  assert.deepEqual(j.faltan, ['RUT', 'Identificación']);
  await new Promise((ok) => setTimeout(ok, 50)); // subida a Drive en segundo plano
  const lead = db.getLead(c.id, j.lead_id);
  const [d] = docs.listar(c.id, lead.id);
  assert.equal(d.nombre, 'RUT Arepas.pdf');
  assert.equal(fs.readFileSync(d.ruta, 'utf8'), '%PDF-1.4 prueba');
  assert.equal(d.drive_link, 'https://drive.google.com/file/d/F1');
  assert.ok(drive.some((x) => x.u.includes('upload/drive')));
  assert.match(db.leadMessages(lead.id).at(-1).texto, /📎 RUT Arepas.pdf · mi rut/);
  // el agente dice qué es
  let t = await (await fetch(`${base}/api/nv/documentos/tipo`, { method: 'POST', headers: { Authorization: 'Bearer llave-nv', 'Content-Type': 'application/json' }, body: JSON.stringify({ telefono: '573001112233', tipo: 'rut' }) })).json();
  assert.deepEqual(t.faltan, ['Identificación']);
  assert.equal(t.tipo, 'RUT');
  await fetch(`${base}/api/nv/documentos`, { method: 'POST', headers: { Authorization: 'Bearer llave-nv', 'Content-Type': 'image/jpeg', 'X-Telefono': '573001112233', 'X-Nombre': 'cedula.jpg' }, body: Buffer.from([0xff, 0xd8, 0xff]) });
  t = await (await fetch(`${base}/api/nv/documentos/tipo`, { method: 'POST', headers: { Authorization: 'Bearer llave-nv', 'Content-Type': 'application/json' }, body: JSON.stringify({ telefono: '573001112233', tipo: 'Identificación' }) })).json();
  assert.equal(t.completo, true);
  assert.equal(db.getLead(c.id, lead.id).etapa, 'ok');
});

test('rechaza tipos raros, sin llave o sin la función activa', async () => {
  const mal = await fetch(`${base}/api/nv/documentos`, { method: 'POST', headers: { Authorization: 'Bearer llave-nv', 'Content-Type': 'application/x-msdownload', 'X-Telefono': '573001112233', 'X-Nombre': 'virus.exe' }, body: Buffer.from('MZ') });
  assert.equal(mal.status, 400);
  assert.equal((await fetch(`${base}/api/nv/documentos`, { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: Buffer.from('x') })).status, 401);
});

test('el asesor ve y descarga el documento desde la ficha', async () => {
  const login = await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: base }, body: new URLSearchParams({ email: 'cata@nv.mx', password: 'ClaveCata2030' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const lead = db.listLeads(c.id)[0];
  const html = await (await fetch(`${base}/app/leads/${lead.id}/chat`, { headers: { Cookie: cookie } })).text();
  assert.match(html, /Documentos/);
  assert.match(html, /RUT Arepas\.pdf/);
  const d = docs.listar(c.id, lead.id)[0];
  const r = await fetch(`${base}/app/leads/${lead.id}/documentos/${d.id}`, { headers: { Cookie: cookie } });
  assert.equal(r.status, 200);
  assert.equal(await r.text(), '%PDF-1.4 prueba');
  assert.equal((await fetch(`${base}/app/leads/${lead.id}/documentos/${d.id}`, { redirect: 'manual' })).status, 302); // sin sesión, a entrar
});
