import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'kw-')), SECRET_KEY: 'k', DRY_RUN: '0', MOCK_LLM: '1' });
const db = await import('../src/db.js');
const { processKeywordComments, matchesKeyword } = await import('../src/engage/keyword.js');
db.openDb(':memory:');

const client = db.createClient({
  slug: 'k', nombre: 'K', perfil: { cliente: 'K', pilares_de_contenido: [{ nombre: 'x' }] },
  config: { respuesta_palabra_clave: { activo: true, palabra: 'AGENTE', mensaje: 'Hola @{usuario}, aquí está: https://wa.me/52', respuesta_publica: 'Listo @{usuario}, te lo mandé por DM.' } },
  credentials: { meta: { page_id: 'P', ig_user_id: 'IG', page_token: 'T' } },
});

let comments = [];
const sent = [];
const orig = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  const body = opts.body ? Object.fromEntries(new URLSearchParams(opts.body)) : null;
  if (opts.method === 'POST') { sent.push({ u, body }); return new Response(JSON.stringify({ id: 'ok' })); }
  if (u.includes('/IG/media')) return new Response(JSON.stringify({ data: [{ id: 'M1', timestamp: new Date().toISOString(), comments: { data: comments } }] }));
  if (u.includes('/IG?')) return new Response(JSON.stringify({ username: 'kuper_media' }));
  return new Response('{}', { status: 404 });
};
test.after(() => { globalThis.fetch = orig; });

const c = (id, text, username = 'cliente1') => ({ id, text, username, timestamp: new Date().toISOString() });

test('reconoce la palabra clave como palabra suelta', () => {
  assert.ok(matchesKeyword('AGENTE', 'AGENTE'));
  assert.ok(matchesKeyword('quiero mi agente!! 🙌', 'AGENTE'));
  assert.ok(!matchesKeyword('mis agentes', 'AGENTE'));
});

test('la primera vez no le escribe a comentarios viejos', async () => {
  comments = [c('C1', 'agente')];
  const r = await processKeywordComments(db.getClient(client.id));
  assert.equal(r.enviados, 0);
  assert.equal(sent.length, 0);
});

test('comentarios nuevos con AGENTE reciben DM y respuesta pública; el resto se ignora', async () => {
  comments = [c('C1', 'agente'), c('C2', 'Agente!', 'maria'), c('C3', 'qué bonito'), c('C4', 'AGENTE', 'kuper_media')];
  const r = await processKeywordComments(db.getClient(client.id));
  assert.equal(r.enviados, 1);
  const dm = sent.find((s) => s.u.includes('/P/messages'));
  assert.deepEqual(JSON.parse(dm.body.recipient), { comment_id: 'C2' });
  assert.match(JSON.parse(dm.body.message).text, /Hola @maria/);
  assert.ok(sent.find((s) => s.u.includes('/C2/replies') && /@maria/.test(s.body.message)));
  // no se repite
  const again = await processKeywordComments(db.getClient(client.id));
  assert.equal(again.enviados, 0);
  assert.equal(db.keywordReplies(client.id).find((x) => x.comment_id === 'C2').status, 'enviado');
});
