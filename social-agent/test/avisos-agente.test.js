// El agente de WhatsApp manda sus avisos al panel y el panel los manda por correo al cliente.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'avisos-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', SMTP_HOST: 'smtp.x', SMTP_USER: 'u', SMTP_PASS: 'p' });
const db = await import('../src/db.js');
const avisos = await import('../src/avisos-agente.js');
db.openDb(':memory:');
const enviados = [];
avisos.hooks.send = async (m) => { enviados.push(m); };
const conCorreo = db.createClient({ slug: 'redone', nombre: 'Red One', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] }, config: { notificaciones: { email: 'contacto@redone.agency' } } });
const sinCorreo = db.createClient({ slug: 'otro', nombre: 'Otro', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] }, config: {} });

test('aviso: marca el lead y manda correo al aviso del cliente', async () => {
  const r = await avisos.recibir(conCorreo, { telefono: '5215511118196', nombre: 'Javier (Nexus)', titulo: 'Sigue esperando respuesta', texto: 'Propuesta de alianza', urgente: true, correo: true, mensajes: [{ rol: 'lead', texto: 'Espero respuesta de tu agente' }] });
  assert.ok(r.ok && r.correo && r.lead_id);
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].to, 'contacto@redone.agency');
  assert.match(enviados[0].subject, /Sigue esperando respuesta: Javier/);
  assert.match(enviados[0].html, /wa\.me\/5215511118196/);
  assert.match(enviados[0].html, /Espero respuesta de tu agente/);
  assert.match(db.getLead(conCorreo.id, r.lead_id).nota, /Sigue esperando/);
});

test('sin correo de avisos: queda en el panel y lo dice', async () => {
  const r = await avisos.recibir(sinCorreo, { telefono: '5215500000000', titulo: 'Pide hablar con alguien', correo: true });
  assert.equal(r.correo, false); assert.equal(r.motivo, 'sin_correo_de_avisos');
  assert.equal(enviados.length, 1);
});
