// Ajustes pedidos por clientes: foto y giro del contacto, sin clasificación por lada, filtros (no contestados, fechas,
// etapa, palabra exacta en los chats), números en cifras en las llamadas, embudos y etapas que se reordenan,
// etiquetas para elegir, sin "Estatus" en la ficha y pregunta de cierre del agente.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'ajl-')), SECRET_KEY: 'x', TIMEZONE: 'America/Mexico_City', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123', SCHEDULER: '0' });
const db = await import('../src/db.js');
const E = await import('../src/embudo.js');
const paises = await import('../src/paises.js');
const { numerosEnCifras } = await import('../src/numeros.js');
const { hashPassword } = await import('../src/crypto.js');
const { createApp } = await import('../src/server.js');
db.openDb(':memory:');
const perfil = { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] };
const embudos = [
  { id: 'ventas', nombre: 'Ventas', etapas: [{ id: 'nuevo', nombre: 'Nuevo', tipo: 'nuevo' }, { id: 'cotizado', nombre: 'Cotizado', tipo: 'conversacion' }, { id: 'cliente', nombre: 'Cliente', tipo: 'cliente' }] },
  { id: 'soporte', nombre: 'Soporte', etapas: [{ id: 'abierto', nombre: 'Abierto', tipo: 'nuevo' }, { id: 'cerrado', nombre: 'Cerrado', tipo: 'archivo' }] },
];
const c0 = db.createClient({ slug: 'inh', nombre: 'Inhouse', perfil, config: { plan: { servicios: { chat: true } }, embudos, paises: { activo: true, asesores: {} } }, credentials: { api_key: 'llave-inh' } });
db.createUser({ email: 'ana@inh.mx', nombre: 'Ana', rol: 'cliente', client_id: c0.id, password_hash: hashPassword('clave-larga-123') });
const cl = () => db.getClient(c0.id);

const srv = createApp().listen(0); const base = `http://127.0.0.1:${srv.address().port}`;
test.after(() => srv.close());
let cookie = '';
const entrar = async () => { if (cookie) return cookie; const r = await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: base }, body: new URLSearchParams({ email: 'ana@inh.mx', password: 'clave-larga-123' }) }); cookie = r.headers.get('set-cookie').split(';')[0]; return cookie; };
const get = async (u) => (await fetch(`${base}${u}`, { headers: { Cookie: await entrar() } })).text();
const post = async (u, datos) => fetch(`${base}${u}`, { method: 'POST', redirect: 'manual', headers: { Cookie: await entrar(), Origin: base, ...(datos instanceof FormData ? {} : { 'Content-Type': 'application/x-www-form-urlencoded' }) }, body: datos instanceof FormData ? datos : new URLSearchParams(datos) });

test('números con palabras pasan a cifras (teléfonos, precios), sin tocar artículos', () => {
  assert.equal(numerosEnCifras('Al cincuenta y cinco, cuarenta y nueve, cincuenta y tres, cincuenta, quince'), 'Al 55, 49, 53, 50, 15');
  assert.equal(numerosEnCifras('Cuesta mil quinientos cuarenta y cinco pesos'), 'Cuesta 1545 pesos');
  assert.equal(numerosEnCifras('Desde once mil cuatrocientos treinta y seis dólares'), 'Desde 11,436 dólares');
  assert.equal(numerosEnCifras('Quiero una cita, somos tres'), 'Quiero una cita, somos 3');
  assert.equal(numerosEnCifras('cero cuatro, veintidós'), '04, 22');
  assert.equal(numerosEnCifras('cien por ciento res'), '100 por ciento res');
});

test('llamadas: la transcripción y el resumen quedan con cifras; las notas de voz también', async () => {
  const r = await fetch(`${base}/api/inh/llamadas`, { method: 'POST', headers: { Authorization: 'Bearer llave-inh', 'Content-Type': 'application/json' },
    body: JSON.stringify({ call_id: 'c1', tipo: 'entrante', inicio: new Date().toISOString(), duracion_s: 60, telefono: '5511112222', resumen: 'Pidió cotización por dos mil pesos',
      transcripcion: [{ rol: 'agente', texto: 'Su teléfono es cincuenta y cinco, once, once, veintidós, veintidós' }, { rol: 'lead', texto: 'Sí, correcto' }] }) });
  assert.equal(r.status, 200);
  const lead = db.listLeads(c0.id).find((l) => l.telefono?.endsWith('5511112222'));
  const msgs = db.leadMessages(lead.id).map((m) => m.texto);
  assert.ok(msgs.includes('Su teléfono es 55, 11, 11, 22, 22'), msgs.join(' | '));
  await fetch(`${base}/api/inh/mensajes`, { method: 'POST', headers: { Authorization: 'Bearer llave-inh', 'Content-Type': 'application/json' },
    body: JSON.stringify({ telefono: '5511112222', rol: 'lead', texto: '[Nota de voz] Quiero tres oficinas para veinte personas' }) });
  assert.ok(db.leadMessages(lead.id).some((m) => m.texto === '[Nota de voz] Quiero 3 oficinas para 20 personas'));
});

test('ficha: giro, foto, etiquetas para elegir y sin "Estatus"', async () => {
  const l = db.upsertLead(c0.id, { telefono: '5522223333', nombre: 'Lupita', origen: 'whatsapp' });
  db.getDb().prepare('UPDATE leads SET tags_json = ? WHERE id = ?').run(JSON.stringify(['Mayoreo']), db.upsertLead(c0.id, { telefono: '5599990000', origen: 'whatsapp' }).id);
  db.updateClient(c0.id, { config: { ...cl().config, etiquetas: ['Factura', 'Evento'] } });
  let h = await get(`/app/leads/${l.id}/chat`);
  assert.match(h, /name="giro"/); assert.doesNotMatch(h, /<label>Estatus<\/label>/);
  assert.match(h, /data-tag="Factura"/); assert.match(h, /data-tag="Mayoreo"/, 'también las que ya usa la marca');
  const muchas = Array.from({ length: 25 }, (_, i) => `t${i}`).join(', ');
  await post(`/app/leads/${l.id}/ficha`, { nombre: 'Lupita', empresa: 'Acme', giro: 'Constructora', tags: muchas, prioridad: undefined });
  const g = db.getLead(c0.id, l.id);
  assert.equal(g.giro, 'Constructora'); assert.equal(JSON.parse(g.tags_json).length, 25, 'más de 12 etiquetas');
  const fd = new FormData(); fd.append('foto', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], { type: 'image/jpeg' }), 'yo.jpg');
  const r = await post(`/app/leads/${l.id}/foto`, fd);
  assert.equal(r.status, 302);
  const foto = db.getLead(c0.id, l.id).foto; assert.match(foto, /^contacto-.*\.jpg$/);
  h = await get('/app/embudo');
  assert.match(h, new RegExp(`/media/${foto}`)); assert.match(h, /Constructora/);
  await post(`/app/leads/${l.id}/foto`, { quitar: '1' });
  assert.equal(db.getLead(c0.id, l.id).foto, null);
});

test('lista de leads: no contestados, fecha, etapa y palabra exacta en los chats', async () => {
  const a = db.upsertLead(c0.id, { telefono: '5533334444', nombre: 'Ana Espera', origen: 'whatsapp' });
  db.addLeadMessage(c0.id, { telefono: '5533334444' }, { rol: 'lead', texto: '¿Me pueden mandar la factura de octubre?' });
  const b = db.upsertLead(c0.id, { telefono: '5544445555', nombre: 'Beto Contestado', origen: 'whatsapp' });
  db.addLeadMessage(c0.id, { telefono: '5544445555' }, { rol: 'lead', texto: 'Hablemos de facturación' });
  db.addLeadMessage(c0.id, { telefono: '5544445555' }, { rol: 'agente', texto: 'Claro' });
  E.moverLead(cl(), b.id, 'cotizado', 'ventas');
  let h = await get('/app/leads?ver=no_contestados');
  assert.match(h, /Ana Espera/); assert.doesNotMatch(h, /Beto Contestado/);
  h = await get('/app/leads?t=factura');
  assert.match(h, /Ana Espera/); assert.doesNotMatch(h, /Beto Contestado/, '"facturación" no es la palabra exacta "factura"');
  h = await get(`/app/leads?etapa=${encodeURIComponent('ventas/cotizado')}`);
  assert.match(h, /Beto Contestado/); assert.doesNotMatch(h, /Ana Espera/); assert.match(h, /Cotizado/);
  h = await get('/app/leads?desde=2020-01-01&hasta=2020-01-31');
  assert.doesNotMatch(h, /Ana Espera/);
  h = await get('/app/embudo?t=factura');
  assert.match(h, /Ana Espera/); assert.doesNotMatch(h, /Beto Contestado/);
  assert.match(await get('/app'), /Buscar contactos/);
  void a;
});

test('embudos y etapas se cambian de lugar sin mover leads solos', async () => {
  const l = db.upsertLead(c0.id, { telefono: '5566667777', nombre: 'Sin embudo', origen: 'whatsapp' });
  assert.equal(E.embudoDe(cl(), l).id, 'ventas');
  const r = await post('/app/embudo/orden', { embudo: 'soporte', dir: '-1' });
  assert.equal(r.status, 302);
  assert.deepEqual(E.embudos(cl()).map((e) => e.id), ['soporte', 'ventas']);
  assert.equal(E.embudoDe(cl(), db.getLead(c0.id, l.id)).id, 'ventas', 'el lead se queda en su embudo');
  E.editarEtapa(cl(), 'ventas', 'cliente', 'izquierda');
  assert.deepEqual(E.embudos(cl()).find((e) => e.id === 'ventas').etapas.map((x) => x.id), ['nuevo', 'cliente', 'cotizado']);
  assert.throws(() => E.editarEtapa(cl(), 'ventas', 'nuevo', 'izquierda'), /primera/);
});

test('apagar la clasificación por lada quita las etiquetas de país y el filtro', async () => {
  const l = db.upsertLead(c0.id, { telefono: '+573001112233', nombre: 'Colombiano', origen: 'whatsapp' });
  paises.clasificar(cl(), l);
  assert.ok(JSON.parse(db.getLead(c0.id, l.id).tags_json).includes('Colombia'));
  await post('/app/agente/paises-documentos', { cierre_activo: '1', cierre_texto: '¿Quedó resuelta tu duda?', etiquetas: 'Factura\nEvento' });
  assert.equal(paises.ajustes(cl()).activo, false);
  assert.ok(!JSON.parse(db.getLead(c0.id, l.id).tags_json || '[]').includes('Colombia'));
  assert.doesNotMatch(await get('/app/embudo'), /<h4 style="margin-top:12px">País<\/h4>/);
  // Pregunta de cierre: va en lo que sabe el agente.
  const k = await (await fetch(`${base}/api/inh/conocimiento`, { headers: { Authorization: 'Bearer llave-inh' } })).json();
  assert.match(k.texto, /¿Quedó resuelta tu duda\?/);
  assert.deepEqual(cl().config.etiquetas, ['Factura', 'Evento']);
});
