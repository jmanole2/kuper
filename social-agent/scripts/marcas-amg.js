// Crea en el panel las 7 marcas de AMG Hospitality (Chubbies Burger, Muy Gallito, Fat Bastard, Bass Monkey, Kab Khao,
// Tiin Thai y Palermo) con "Lo que sabe tu agente" de cada una (scripts/datos/amg.json) y, si se pasa un correo,
// un acceso de grupo que ve las 7 marcas y cambia entre ellas.
//
//   node --env-file=.env scripts/marcas-amg.js [--correo persona@amghg.com --nombre "Víctor"]
//
// Se puede correr varias veces: no duplica marcas ni pisa lo que ya escribieron en "Lo que sabe tu agente".
// Los canales (WhatsApp, Instagram, Facebook) se conectan después, cuando AMG dé los accesos de Meta.
import { readFileSync } from 'node:fs';
import * as db from '../src/db.js';
import * as conocimiento from '../src/conocimiento.js';
import { hashPassword, tempPassword } from '../src/crypto.js';

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : ''; };
const datos = JSON.parse(readFileSync(new URL('./datos/amg.json', import.meta.url), 'utf8'));
db.openDb();

const embudos = [{ id: 'atencion', nombre: 'Atención a clientes', etapas: [
  { id: 'nuevo', nombre: 'Nuevo mensaje', tipo: 'nuevo' },
  { id: 'resuelto', nombre: 'Duda resuelta', tipo: 'conversacion' },
  { id: 'pedido', nombre: 'Mandado a pedir', tipo: 'cita' },
  { id: 'factura', nombre: 'Facturación', tipo: 'conversacion' },
  { id: 'queja', nombre: 'Queja o caso para el equipo', tipo: 'conversacion' },
  { id: 'cerrado', nombre: 'Cerrado', tipo: 'cliente' },
] }];
const plan = { servicios: { redes: false, chat: true, agenda: false, comentarios: true, llamadas: false, blog: false, videollamadas: false }, cobro: 'externo' };

const ids = [];
for (const m of datos.marcas) {
  let c = db.listClients().find((x) => x.slug === m.slug);
  const nueva = !c;
  if (nueva) c = db.createClient({ slug: m.slug, nombre: m.nombre, perfil: { cliente: m.nombre, pilares_de_contenido: [{ nombre: 'Menú' }] },
    config: { plan, embudos, etiquetas: ['Pedido', 'Factura', 'Queja', 'Sucursal', 'Evento'] }, credentials: {} });
  if (!nueva && c.nombre === 'Bass Monkey' && m.nombre === 'Brass Monkey') c = db.updateClient(c.id, { nombre: m.nombre }); // se llama Brass Monkey
  if (!conocimiento.actual(c.id)) conocimiento.guardar(c.id, { texto: m.conocimiento }, 'Kuper');
  ids.push(c.id);
  console.log(`${nueva ? 'Creada ' : 'Ya existía'}  ${m.nombre.padEnd(16)} /admin/clientes/${c.id}`);
}

const correo = arg('correo').trim().toLowerCase();
if (correo) {
  const D = db.getDb(), clave = tempPassword();
  const previo = D.prepare('SELECT * FROM users WHERE email = ?').get(correo);
  if (previo && previo.client_id && !ids.includes(previo.client_id)) throw new Error(`${correo} ya es usuario de otra marca; usa otro correo.`);
  if (previo) D.prepare('UPDATE users SET client_id = ?, password_hash = ?, activo = 1 WHERE id = ?').run(ids[0], hashPassword(clave), previo.id);
  else db.createUser({ email: correo, nombre: arg('nombre') || datos.grupo, rol: 'cliente', client_id: ids[0], password_hash: hashPassword(clave) });
  const u = D.prepare('SELECT id FROM users WHERE email = ?').get(correo);
  db.setMarcasExtra(u.id, ids.slice(1));
  console.log(`\nAcceso de grupo (ve las ${ids.length} marcas). Entrar en /entrar y cambiar la contraseña:\n  ${correo}   ${clave}`);
}
console.log('\nFalta: conectar WhatsApp, Instagram y Facebook de cada marca, y completar Tiin Thai, Palermo y Kab Khao.');
