import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'mr-')), SECRET_KEY: 'k' });
const db = await import('../src/db.js');
const mr = await import('../src/metaRouter.js');
db.openDb(':memory:');
const mk = (slug, meta, reenviar = true, agente_url = `http://127.0.0.1:3400/${slug}`) => db.createClient({ slug, nombre: slug, perfil: { cliente: slug, pilares_de_contenido: [{ nombre: 'x' }] },
  config: { mensajes_directos: { reenviar } }, credentials: { meta, agente_url } });
mk('chubbies', { page_id: 'P1', ig_user_id: 'IG1' });
mk('fat', { page_id: 'P2', ig_user_id: 'IG2' });
mk('apagada', { page_id: 'P3' }, false);
const S = 'secreto', DEF = 'https://agente.kuper.media/webhook';
const raw = (o) => Buffer.from(JSON.stringify(o));

test('firma', () => {
  const b = raw({ a: 1 });
  assert.ok(mr.firmaValida(b, mr.firmar(b, S), S));
  assert.ok(!mr.firmaValida(b, mr.firmar(b, 'otro'), S));
  assert.ok(!mr.firmaValida(b, '', S));
});

test('cada entrada va al agente de su marca, re-firmada; lo demás al agente de siempre', () => {
  const b = raw({ object: 'instagram', entry: [{ id: 'IG1', messaging: [1] }, { id: 'IG2', messaging: [2] }, { id: 'OTRA', messaging: [3] }] });
  const e = mr.repartir(b, 'sha256=orig', { secreto: S, porDefecto: DEF });
  assert.equal(e.length, 3);
  const de = (u) => e.find((x) => x.url === u);
  assert.deepEqual(JSON.parse(de('http://127.0.0.1:3400/chubbies/webhook').cuerpo).entry.map((x) => x.id), ['IG1']);
  assert.deepEqual(JSON.parse(de('http://127.0.0.1:3400/fat/webhook').cuerpo).entry.map((x) => x.id), ['IG2']);
  assert.deepEqual(JSON.parse(de(DEF).cuerpo).entry.map((x) => x.id), ['OTRA']);
  for (const x of e) assert.ok(mr.firmaValida(x.cuerpo, x.firma, S));
});

test('si nada es de una marca (o tiene el reenvío apagado), el cuerpo original y su firma van intactos', () => {
  const b = raw({ object: 'page', entry: [{ id: 'P3' }, { id: 'P9' }] });
  const e = mr.repartir(b, 'sha256=orig', { secreto: S, porDefecto: DEF });
  assert.deepEqual(e, [{ url: DEF, cuerpo: b, firma: 'sha256=orig', marca: null }]);
});

test('Messenger usa el id de página y no se cruza con Instagram', () => {
  assert.equal(mr.destinoDe('page', 'P1').client.slug, 'chubbies');
  assert.equal(mr.destinoDe('instagram', 'P1'), null);
  assert.equal(mr.destinoDe('page', 'IG1'), null);
});

test('acepta mensajes de otra app de Kuper (la de mensajes directos)', () => {
  const b = raw({ object: 'page', entry: [{ id: 'P1' }] });
  assert.equal(mr.secretoQueFirmo(b, mr.firmar(b, 'nueva'), [S, 'nueva']), 'nueva');
  assert.equal(mr.secretoQueFirmo(b, mr.firmar(b, 'otra'), [S, 'nueva']), null);
});
