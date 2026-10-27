// Leads: de qué anuncio/campaña de Meta vienen y descarga en CSV.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'camp-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123', SCHEDULER: '0' });
const db = await import('../src/db.js');
const campanas = await import('../src/campanas.js');
db.openDb(':memory:');
const c = db.createClient({ slug: 'red-one', nombre: 'Red One', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] }, credentials: { meta: { page_token: 'EAA-pagina', ads_token: 'EAA-anuncios' } }, config: { plan: { servicios: { chat: true } } } });
const pedidos = [];
campanas.hooks.fetch = async (url) => { pedidos.push(url); return { ok: true, status: 200, json: async () => ({ id: '120211', name: 'Video diagnóstico', adset: { name: 'CDMX 25-45' }, campaign: { name: 'Diagnóstico gratis octubre' } }) }; };

test('guarda el primer anuncio del lead y no lo pisa', () => {
  const l = db.upsertLead(c.id, { telefono: '+525511112222', origen: 'whatsapp', campana: { anuncio_id: '120211', titulo: '¿Tu marca crece?', canal: 'whatsapp', ctwa_clid: 'abc' } });
  assert.equal(l.anuncio_id, '120211'); assert.equal(l.anuncio, '¿Tu marca crece?');
  const otra = db.upsertLead(c.id, { telefono: '+525511112222', campana: { anuncio_id: '999', titulo: 'Otro' } });
  assert.equal(otra.anuncio_id, '120211', 'se queda con el primero');
  assert.equal(campanas.etiquetaCampana(otra), '¿Tu marca crece?');
  assert.equal(campanas.etiquetaCampana(db.upsertLead(c.id, { telefono: '+525533334444' })), 'Orgánico');
});

test('pide a Meta el nombre de la campaña con el token de anuncios', async () => {
  const r = await campanas.nombresDeAnuncio(c, '120211');
  assert.equal(r.campana, 'Diagnóstico gratis octubre');
  assert.match(pedidos[0], /\/120211\?fields=name,adset\{name\},campaign\{name\}&access_token=EAA-anuncios$/);
  const l = db.listLeads(c.id).find((x) => x.anuncio_id === '120211');
  assert.equal(l.campana, 'Diagnóstico gratis octubre'); assert.equal(l.conjunto, 'CDMX 25-45'); assert.equal(l.anuncio, 'Video diagnóstico');
  await campanas.nombresDeAnuncio(c, '120211');
  assert.equal(pedidos.length, 1, 'se guarda: no vuelve a preguntar');
});

test('CSV: abre bien en Excel y no ejecuta fórmulas', () => {
  db.upsertLead(c.id, { telefono: '+525555556666', nombre: '=HYPERLINK("x")', nota: 'Dijo "hola", y se fue' });
  const csv = campanas.leadsCsv(db.listLeads(c.id), { estados: db.LEAD_ESTADOS });
  assert.ok(csv.startsWith('﻿Nombre,Teléfono,Usuario,Correo,Origen,Estado,Campaña,'));
  assert.match(csv, /'=HYPERLINK\(""x""\)/);
  assert.match(csv, /"Dijo ""hola"", y se fue"/);
  assert.match(csv, /Diagnóstico gratis octubre,CDMX 25-45,Video diagnóstico,120211/);
});

test('panel: columna Campaña, filtro y descarga (admin y cliente)', async () => {
  const { createApp } = await import('../src/server.js');
  const { hashPassword } = await import('../src/crypto.js');
  db.createUser({ email: 'luis@redone.mx', nombre: 'Luis', rol: 'cliente', client_id: c.id, password_hash: hashPassword('ClaveLuis2030!') });
  const server = createApp().listen(0), base = `http://127.0.0.1:${server.address().port}`;
  const login = async (email, password) => ((await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email, password }) })).headers.get('set-cookie') || '').split(';')[0];
  try {
    const admin = await login('', 'maestra-123');
    const pag = await (await fetch(`${base}/admin/clientes/${c.id}?tab=leads`, { headers: { cookie: admin } })).text();
    assert.match(pag, /Diagnóstico gratis octubre/); assert.match(pag, /Descargar CSV/);
    const filtrada = await (await fetch(`${base}/admin/clientes/${c.id}?tab=leads&campana=${encodeURIComponent('Diagnóstico gratis octubre')}`, { headers: { cookie: admin } })).text();
    assert.doesNotMatch(filtrada, /5533334444/, 'el filtro deja solo los de esa campaña');
    const r = await fetch(`${base}/admin/clientes/${c.id}/leads.csv?campana=Org%C3%A1nico`, { headers: { cookie: admin } });
    assert.match(r.headers.get('content-disposition'), /attachment; filename="leads-red-one-/);
    const csv = await r.text();
    assert.match(csv, /5533334444/); assert.doesNotMatch(csv, /5511112222/);
    const luis = await login('luis@redone.mx', 'ClaveLuis2030!');
    const r2 = await fetch(`${base}/app/leads.csv`, { headers: { cookie: luis } });
    assert.equal(r2.status, 200); assert.match(await r2.text(), /5511112222/);
    assert.equal((await fetch(`${base}/admin/clientes/${c.id}/leads.csv`, { headers: { cookie: luis }, redirect: 'manual' })).status !== 200, true, 'un cliente no baja leads por el admin');
  } finally { server.close(); }
});
