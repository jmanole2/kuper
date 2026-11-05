// Importar contactos de Leadsales (CSV) con sus embudos y etapas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'importar-')), SECRET_KEY: 'x', LOG_EVENTOS: '0' });
const db = await import('../src/db.js');
const I = await import('../src/importar.js');
const E = await import('../src/embudo.js');
db.openDb(':memory:');

const CSV = '﻿Lead,Name,Value,Email,Tags,Company,Funnel Name,Stage Name,Created At,First Message,Last Message,Active,Is In Inbox,Status,Revenue,Last Action At,Channel,User Assigned\n'
  + '5215511112222,Laura,0,laura@x.mx,"1-5,POL",Acme,PRINCIPAL - IH,NUEVOS,2026-11-04 22:00:00,"Hola, quisiera info",,TRUE,,NEUTRAL,0,2026-11-04 22:05:00,WHATSAPP_WEB,\n'
  + '5215511113333,Beto,26000,,,,PRINCIPAL - IH,CRM - BASE DATOS,2026-01-10 10:00:00,"Precio de oficina\ncon salto de línea",Gracias,TRUE,,NEUTRAL,26000,2026-02-01 10:00:00,WHATSAPP_WEB,Inhouse Work\n'
  + '1872947203860789,Ana IG,0,,,,SALAS DE JUNTAS - IH,INTERESADOS SALAS,2026-10-01 10:00:00,,,TRUE,,NEUTRAL,0,2026-10-01 10:00:00,INSTAGRAM,\n'
  + '5215511114444,Cliente,0,,,,SALAS DE JUNTAS - IH,CLIENTES,2026-09-01 10:00:00,,,TRUE,,NEUTRAL,0,2026-09-01 10:00:00,WHATSAPP_WEB,\n';

test('lee el CSV con comillas y saltos de línea, y arma los embudos', () => {
  const l = I.leerLeadsales(CSV);
  assert.equal(l.contactos.length, 4);
  assert.deepEqual(l.embudos.map((e) => e.nombre), ['Principal', 'Salas de juntas']);
  assert.deepEqual(l.embudos[0].etapas.map((e) => [e.nombre, e.tipo]), [['Nuevos', 'nuevo'], ['CRM - base datos', 'archivo']]);
  assert.equal(l.contactos[1].nota.includes('con salto de línea'), true);
  assert.throws(() => I.leerLeadsales('a,b\n1,2'), /teléfono o correo/);
});

test('importa sin duplicar y respeta etapa, valor, etiquetas y fechas', () => {
  let c = db.createClient({ slug: 'ih', nombre: 'Inhouse', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] }, config: { embudo: E.ETAPAS_BASE }, credentials: {} });
  db.upsertLead(c.id, { telefono: '+525511112222', nombre: 'Laura previa', origen: 'whatsapp' });
  const r = I.importar(c, I.leerLeadsales(CSV));
  assert.deepEqual([r.nuevos, r.actualizados], [3, 1]);
  c = db.getClient(c.id);
  assert.equal(E.embudos(c).length, 2);
  const leads = db.listLeads(c.id);
  const beto = leads.find((x) => x.nombre === 'Beto');
  assert.equal(beto.valor, 26000); assert.equal(E.etapaDe(c, beto).nombre, 'CRM - base datos'); assert.equal(beto.created_at, '2026-01-10 10:00:00');
  const laura = leads.find((x) => x.telefono === '+525511112222');
  assert.deepEqual(E.tagsDe(laura), ['1-5', 'POL']); assert.equal(laura.empresa, 'Acme');
  const ig = leads.find((x) => x.usuario === 'ig:1872947203860789');
  assert.equal(E.embudoDe(c, ig).id, 'salas-de-juntas');
  assert.equal(leads.find((x) => x.nombre === 'Cliente').resultado, 'vendido');
  // Si un lead de la base de datos vuelve a escribir, el agente lo saca de ahí
  assert.equal(E.avanzarPorAgente(c, beto, 'nuevo').etapa, 'nuevos');
});

test('varios embudos en el texto de ajustes', () => {
  const l = E.parseEmbudos('# Principal\nNuevos = nuevo\nVisita = cita\n\n# Salas\nInteresados = conversacion\nClientes = cliente');
  assert.deepEqual(l.map((e) => [e.id, e.etapas.length]), [['principal', 2], ['salas', 2]]);
  assert.throws(() => E.parseEmbudos('# Solo\nUna = nuevo'), /Solo: Pon al menos dos/);
});
