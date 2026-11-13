// Correo como canal: lee el buzón, crea el lead, la IA contesta (borrador o automático) en el mismo hilo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'mail-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', ADMIN_PASSWORD: 'maestra-123', SCHEDULER: '0' });
const db = await import('../src/db.js');
const C = await import('../src/correo.js');
const K = await import('../src/conocimiento.js');
db.openDb(':memory:');
const c = db.createClient({ slug: 'amb', nombre: 'Grupo Ambrosía', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] },
  config: { plan: { servicios: { chat: true } }, correo: { activo: true, modo: 'borrador', firma: 'Equipo Ambrosía' } },
  credentials: { correo: { imap_host: 'imap.gmail.com', imap_port: 993, smtp_host: 'smtp.gmail.com', smtp_port: 465, usuario: 'hola@ambrosia.test', password: 'app-pass' } } });
K.guardar(c.id, { texto: 'Banquetes para bodas desde 100 invitados. Horario de 9 a 18.' }, 'Ana');
const cli = () => db.getClient(c.id);

const correoCrudo = ({ id, de = 'Ana López <ana@cliente.test>', asunto = 'Cotización boda', cuerpo = 'Hola, ¿hacen banquetes para 150 personas?', extra = '' }) => Buffer.from(
  `From: ${de}\r\nTo: hola@ambrosia.test\r\nSubject: ${asunto}\r\nMessage-ID: <${id}@cliente.test>\r\nDate: Fri, 13 Nov 2026 10:00:00 -0600\r\n${extra}Content-Type: text/plain; charset=utf-8\r\n\r\n${cuerpo}\r\n`);
let buzon = [], uidNext = 1;
const usados = [];
C.hooks.lookup = async (h) => (h === 'interno.test' ? [{ address: '10.0.0.5' }] : [{ address: '142.250.1.1' }]);
C.hooks.imap = (o) => { usados.push(o); return {
  connect: async () => {}, logout: async () => {}, mailbox: { get uidNext() { return uidNext; } },
  getMailboxLock: async () => ({ release() {} }),
  async *fetch(rango) { const desde = Number(String(rango).split(':')[0]); for (const m of buzon) if (m.uid >= desde) yield m; },
}; };
const enviados = [];
C.hooks.smtp = () => ({ sendMail: async (m) => { enviados.push(m); return { messageId: `<out-${enviados.length}@ambrosia.test>` }; }, verify: async () => true });
let respuestaIA = { respuesta: 'Claro, hacemos banquetes desde 100 invitados. ¿Qué fecha tienes en mente?', pasar_a_persona: false, motivo: '' };
let vistoIA = '';
C.hooks.ia = async ({ system }) => { vistoIA = system; return { data: respuestaIA }; };
C.hooks.avisar = async () => {};
const llega = (m) => { buzon.push({ uid: uidNext, source: correoCrudo(m) }); uidNext++; };

test('la primera revisión solo marca el punto de partida (no contesta correos viejos)', async () => {
  llega({ id: 'viejo' });
  const r = await C.revisar(cli());
  assert.equal(r.inicio, true); assert.equal(C.listar(c.id).length, 0);
  assert.equal(usados[0].host, 'imap.gmail.com'); assert.equal(usados[0].secure, true);
});

test('correo nuevo: lead, conversación y borrador de la IA con lo que sabe el agente', async () => {
  llega({ id: 'a1' });
  llega({ id: 'spam', de: 'Boletín <news@tienda.test>', extra: 'List-Unsubscribe: <mailto:x@y.test>\r\n' });
  llega({ id: 'nr', de: 'no-reply@banco.test' });
  const r = await C.revisar(cli());
  assert.equal(r.nuevos, 1, 'ignora boletines y no-reply');
  const [x] = C.listar(c.id);
  assert.equal(x.estado, 'borrador'); assert.match(x.borrador, /desde 100 invitados/);
  assert.match(vistoIA, /Banquetes para bodas/);
  const lead = db.getLead(c.id, x.lead_id);
  assert.equal(lead.email, 'ana@cliente.test'); assert.equal(lead.nombre, 'Ana López'); assert.equal(lead.origen, 'correo');
  assert.equal(enviados.length, 0, 'en modo borrador no manda nada solo');
  assert.equal((await C.revisar(cli())).nuevos, 0, 'no repite');
});

test('aprobar: se manda en el mismo hilo, con firma, y queda en la conversación', async () => {
  const [x] = C.listar(c.id);
  await C.enviar(cli(), x.id, 'Claro, ¿para qué fecha?', { autor: 'Ana' });
  const m = enviados.at(-1);
  assert.equal(m.to, 'ana@cliente.test'); assert.equal(m.subject, 'Re: Cotización boda');
  assert.equal(m.inReplyTo, '<a1@cliente.test>'); assert.match(m.text, /¿para qué fecha\?\n\nEquipo Ambrosía$/);
  assert.equal(m.from.address, 'hola@ambrosia.test');
  assert.equal(C.obtener(c.id, x.id).estado, 'respondido');
  const msgs = db.leadMessages(x.lead_id);
  assert.equal(msgs.at(-1).rol, 'humano'); assert.match(msgs[0].texto, /150 personas/);
  await assert.rejects(C.enviar(cli(), x.id, 'otra'), /ya se contestó/);
});

test('modo automático: contesta solo, pero lo delicado lo deja para una persona', async () => {
  db.updateClient(c.id, { config: { ...cli().config, correo: { ...cli().config.correo, modo: 'automatico' } } });
  llega({ id: 'b1', de: 'luis@cliente.test', asunto: 'Horario', cuerpo: '¿A qué hora abren?\n\nEl jue, 12 nov 2026 escribió:\n> hola' });
  await C.revisar(cli());
  assert.equal(enviados.length, 2); assert.doesNotMatch(enviados.at(-1).text, /> hola/);
  respuestaIA = { respuesta: 'Lamentamos lo ocurrido…', pasar_a_persona: true, motivo: 'Es una queja' };
  llega({ id: 'q1', de: 'enojado@cliente.test', asunto: 'Queja', cuerpo: 'La comida llegó fría' });
  await C.revisar(cli());
  assert.equal(enviados.length, 2, 'la queja no se manda sola');
  const q = C.listar(c.id, { estado: 'borrador' })[0];
  assert.equal(q.motivo, 'Es una queja');
});

test('responder desde la conversación del lead manda correo', async () => {
  const lead = db.listLeads(c.id).find((l) => l.email === 'enojado@cliente.test');
  assert.equal(C.esCorreo(lead), true);
  await C.responderLead(cli(), lead, 'Hola, una disculpa. Te llamamos hoy.', 'Ana');
  assert.equal(enviados.at(-1).to, 'enojado@cliente.test'); assert.equal(enviados.at(-1).subject, 'Re: Queja');
});

test('buzón vacío al conectar: el primer correo que llegue sí se contesta', async () => {
  const c2 = db.createClient({ slug: 'vacio', nombre: 'Vacío', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] }, config: { correo: { activo: true } },
    credentials: { correo: { imap_host: 'imap.gmail.com', smtp_host: 'smtp.gmail.com', usuario: 'a@vacio.test', password: 'p' } } });
  const antes = [buzon, uidNext]; buzon = []; uidNext = 1;
  assert.equal((await C.revisar(db.getClient(c2.id))).inicio, true);
  llega({ id: 'primero', de: 'x@cliente.test' });
  assert.equal((await C.revisar(db.getClient(c2.id))).nuevos, 1);
  [buzon, uidNext] = antes;
});

test('no se conecta a servidores internos', async () => {
  await assert.rejects(C.hostSeguro('interno.test'), /no es válido/);
  await assert.rejects(C.hostSeguro('localhost'), /no es un servidor/);
  await assert.rejects(C.hostSeguro('10.0.0.1'), /no es un servidor/);
  assert.equal(await C.hostSeguro('imap.gmail.com'), 'imap.gmail.com');
});

test('pantalla de correo', async () => {
  const V = await import('../src/web/views.js');
  const h = V.correoPage(cli(), { aj: C.ajustes(cli()), cuenta: C.cuenta(cli()), lista: C.listar(c.id), resumen: C.resumen(c.id), PROVEEDORES: C.PROVEEDORES, MODOS: C.MODOS, base: '/app', app: true });
  assert.match(h, /Es una queja|Contestado/); assert.doesNotMatch(h, /app-pass/, 'nunca muestra la contraseña');
});
