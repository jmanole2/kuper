// Disponibilidad de oficinas desde Airtable: lee la vista, arma el texto y lo agrega a lo que sabe el agente.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'airtable-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', TIMEZONE: 'America/Mexico_City' });
const db = await import('../src/db.js');
const AT = await import('../src/airtable.js');
db.openDb(':memory:');

const regs = [
  { fields: { 'ID Unico Oficina': 'La Roma Oficina Privada INT 3', 'Ubicación': 'La Roma', 'Nombre de Oficina': 'EL NIDO', 'No Oficina': 'INT 3', 'Tipo de Espacio': 'Oficina Privada', 'Metro Cuadrados': 2, 'Capacidad Pax': 1, '⭐ Ideal estrategia': 7000, 'Ocupación real': 'DISPONIBLE' } },
  { fields: { 'Ubicación': 'Del Valle', 'Nombre de Oficina': 'MENTA', 'No Oficina': 'INT 2', 'Tipo de Espacio': 'Oficina Privada', 'Capacidad Pax': 4, '⭐ Ideal estrategia': '$12,500', 'Ocupación real': 'OCUPADA', '📅 Se libera el': '2026-12-15' } },
  { fields: { 'Ubicación': 'Coyoacán', 'Nombre de Oficina': 'SANDIA', 'No Oficina': 'INT 1', 'Capacidad Pax': 10, 'Ocupación real': 'OCUPADA' } },
];

test('link de Airtable → base, tabla y vista', () => {
  assert.deepEqual(AT.leerLink('https://airtable.com/appHoGG9LpHgG3WUa/tblGCmTx96WptEpqK/viwSUMS36BzmcsgBm?blocks=hide'), { base: 'appHoGG9LpHgG3WUa', tabla: 'tblGCmTx96WptEpqK', vista: 'viwSUMS36BzmcsgBm' });
  assert.throws(() => AT.leerLink('https://airtable.com/'), /app/);
});

test('texto: solo disponibles o que se liberan, por sede y con precio', () => {
  const t = AT.aTexto(regs, new Date('2026-11-06T18:00:00Z'));
  assert.match(t, /### Roma Norte\n- EL NIDO \(INT 3\), oficina privada, para 1 persona, 2 m², \$7,000 al mes \+ IVA: disponible ya/);
  assert.match(t, /MENTA \(INT 2\).*\$12,500 al mes \+ IVA: se libera el 15 de diciembre de 2026/);
  assert.doesNotMatch(t, /SANDIA/);
  assert.match(AT.aTexto([regs[2]]), /no hay oficinas/);
});

test('sincroniza con paginación y va al final de lo que sabe el agente', async () => {
  const pedidos = [];
  AT.hooks.fetch = async (url, opt) => {
    pedidos.push({ url: String(url), auth: opt.headers.Authorization });
    const segunda = String(url).includes('offset=p2');
    return new Response(JSON.stringify(segunda ? { records: regs.slice(1) } : { records: regs.slice(0, 1), offset: 'p2' }), { status: 200 });
  };
  const c = db.createClient({ slug: 'ih', nombre: 'Inhouse', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] }, config: {}, credentials: { airtable: { token: 'pat123', base: 'appHoGG9LpHgG3WUa', tabla: 'tblGCmTx96WptEpqK', vista: 'viwSUMS36BzmcsgBm' } } });
  const st = await AT.sincronizar(c);
  assert.equal(st.n, 2); assert.equal(st.total, 3);
  assert.match(pedidos[0].url, /api\.airtable\.com\/v0\/appHoGG9LpHgG3WUa\/tblGCmTx96WptEpqK\?.*view=viwSUMS36BzmcsgBm/);
  assert.equal(pedidos[0].auth, 'Bearer pat123');
  assert.match(AT.bloque(c), /EL NIDO/);
  // Si Airtable falla, se conserva lo último bueno
  AT.hooks.fetch = async () => new Response('{}', { status: 401 });
  const st2 = await AT.sincronizar(c);
  assert.match(st2.error, /token/); assert.match(st2.texto, /EL NIDO/);
});

test('consulta en el momento: por sede, personas y tipo; si no hay, lo dice y da alternativas', async () => {
  AT.hooks.fetch = async () => new Response(JSON.stringify({ records: regs }), { status: 200 });
  const c = db.createClient({ slug: 'ih2', nombre: 'Inhouse 2', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] }, config: {}, credentials: { airtable: { token: 't', base: 'appHoGG9LpHgG3WUa', tabla: 'tblGCmTx96WptEpqK' } } });
  await AT.sincronizar(c);
  const coy = AT.consultar(c, { sede: 'Coyoacán', personas: 5 });
  assert.match(coy.resultado, /^NO hay disponibilidad en Coyoacán para 5 personas/);
  assert.doesNotMatch(coy.resultado, /SANDIA/);
  const roma = AT.consultar(c, { sede: 'roma' });
  assert.match(roma.resultado, /Roma Norte: EL NIDO/);
  assert.equal(AT.consultar(db.createClient({ slug: 'x3', nombre: 'X', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] }, config: {}, credentials: {} }), {}).conectado, false);
});
