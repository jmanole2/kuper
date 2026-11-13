import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'as-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123' });
const db = await import('../src/db.js');
const as = await import('../src/asistente.js');
const { hashPassword } = await import('../src/crypto.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');
const c = db.createClient({ slug: 'a', nombre: 'Marca A', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] }, config: { plan: { servicios: { chat: true } } }, credentials: {} });
const otra = db.createClient({ slug: 'b', nombre: 'Marca B', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] }, config: { plan: { servicios: { chat: true } } }, credentials: {} });
db.createUser({ email: 'ana@a.mx', nombre: 'Ana', rol: 'cliente', client_id: c.id, password_hash: hashPassword('ClaveAna2030') });
const l1 = db.upsertLead(c.id, { nombre: 'Juan', telefono: '+573001112233', origen: 'whatsapp' });
db.addLeadMessage(c.id, { telefono: '+573001112233' }, { rol: 'lead', texto: '¿precio?' });
db.upsertLead(otra.id, { nombre: 'Secreto', telefono: '5599999999', origen: 'whatsapp' });
let visto = '';
as.hooks.ia = async ({ system, messages }) => { visto = system; return { data: { respuesta: `Hay 1 lead de Colombia esperando respuesta (pregunta: ${messages.at(-1).content}).`, leads: [l1.id, 999999] } }; };

test('el contexto solo trae datos de la marca, con país y si espera respuesta', () => {
  const ctx = as.contexto(db.getClient(c.id));
  assert.equal(ctx.total_leads, 1);
  assert.equal(ctx.leads[0].pais, 'Colombia');
  assert.equal(ctx.leads[0].espera_respuesta, true);
  assert.doesNotMatch(JSON.stringify(ctx), /Secreto/);
});

test('pregunta desde el panel: responde con links solo a leads de la marca', async () => {
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: base }, body: new URLSearchParams({ email: 'ana@a.mx', password: 'ClaveAna2030' }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.match(await (await fetch(`${base}/app/asistente`, { headers: { Cookie: cookie } })).text(), /Pregúntale a tu panel/);
    const r = await (await fetch(`${base}/app/asistente/preguntar`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ pregunta: '¿Quién espera?' }) })).json();
    assert.match(r.respuesta, /Colombia/);
    assert.deepEqual(r.leads.map((l) => l.url), [`/app/leads/${l1.id}/chat`]); // el id inventado se descarta
    assert.match(visto, /Juan/);
    assert.doesNotMatch(visto, /Secreto/);
  } finally { server.close(); }
});
