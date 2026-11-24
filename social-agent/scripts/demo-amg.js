// Cuenta de demostración para AMG Hospitality (Chubbies Burger y sus marcas): una marca con conversaciones de ejemplo
// de WhatsApp, Instagram y Messenger de las 7 marcas, embudo de atención, etiquetas por marca y un acceso para el cliente.
// Sirve para enseñar el panel antes de tener sus números y cuentas conectadas. Se puede correr varias veces: borra y
// vuelve a crear los datos de ejemplo de esa marca y da una contraseña nueva.
//
//   npm run demo-amg
//
// Imprime el acceso (correo y contraseña) en la terminal del servidor.
import * as db from '../src/db.js';
import { hashPassword, tempPassword } from '../src/crypto.js';

db.openDb();
const SLUG = 'demo-amg';
const NOMBRE = 'Demo · AMG Hospitality (Chubbies)';
const MARCAS = ['Chubbies Burger', 'Muy Gallito', 'Fat Bastard', 'Bass Monkey', 'Tiin Thai', 'Palermo', 'Kab Khao'];
const embudos = [{ id: 'atencion', nombre: 'Atención a clientes', etapas: [
  { id: 'nuevo', nombre: 'Nuevo mensaje', tipo: 'nuevo' },
  { id: 'resuelto', nombre: 'Duda resuelta', tipo: 'conversacion' },
  { id: 'pedido', nombre: 'Mandado a pedir', tipo: 'cita' },
  { id: 'factura', nombre: 'Facturación', tipo: 'conversacion' },
  { id: 'queja', nombre: 'Queja o caso para el equipo', tipo: 'conversacion' },
  { id: 'cerrado', nombre: 'Cerrado', tipo: 'cliente' },
] }];
const config = {
  plan: { servicios: { redes: false, chat: true, agenda: false, comentarios: true, llamadas: false, blog: false, videollamadas: false }, cobro: 'cortesia' },
  embudos,
  etiquetas: [...MARCAS, 'Pedido', 'Factura', 'Queja', 'Sucursal', 'Evento'],
};

let client = db.listClients().find((c) => c.slug === SLUG);
if (client) db.updateClient(client.id, { nombre: NOMBRE, config: { ...client.config, ...config } });
else client = db.createClient({ slug: SLUG, nombre: NOMBRE, perfil: { cliente: NOMBRE, pilares_de_contenido: [{ nombre: 'Menú' }] }, config, credentials: {} });
client = db.getClient(client.id);
const D = db.getDb();
D.prepare('DELETE FROM leads WHERE client_id = ?').run(client.id);

// Un acceso para AMG (solo ve esta marca de demostración).
const email = 'equipo@demo-amg.kuper.media';
const clave = tempPassword();
const previo = D.prepare('SELECT * FROM users WHERE email = ?').get(email);
if (previo) D.prepare('UPDATE users SET nombre = ?, client_id = ?, password_hash = ?, activo = 1 WHERE id = ?').run('Equipo AMG', client.id, hashPassword(clave), previo.id);
else db.createUser({ email, nombre: 'Equipo AMG', rol: 'cliente', client_id: client.id, password_hash: hashPassword(clave) });
const equipoId = D.prepare('SELECT id FROM users WHERE email = ?').get(email).id;

const hace = (h) => new Date(Date.now() - h * 3600000).toISOString().replace('T', ' ').slice(0, 19);
const conversaciones = [
  // nombre, tel o usuario, origen, marca, etapa, etiquetas extra, horas, control, mensajes
  ['Daniela Ruiz', '5512340101', 'whatsapp', 'Chubbies Burger', 'pedido', ['Pedido'], 1, 'bot', [
    ['lead', 'Hola, ¿qué lleva la Especial?'],
    ['agente', '¡Hola, Daniela! Soy Sofía de Chubbies 🍔 La Especial lleva carne smash de 140 g, queso americano, aderezo de ajo y mermelada de tocino, y viene con original fries. ¿Te late?'],
    ['lead', 'Sí, quiero 2 para Roma'],
    ['agente', '¡Va! Aquí puedes pedirlas para la sucursal Roma y ver el tiempo de entrega: pide.chubbiesburger.mx 🙌']]],
  ['Rodrigo Pérez', '5512340102', 'whatsapp', 'Chubbies Burger', 'factura', ['Factura'], 5, 'bot', [
    ['lead', 'Necesito factura de mi pedido de ayer'],
    ['agente', 'Claro, Rodrigo. La factura se hace en factura.foodbot.ai con el número de tu ticket y tus datos fiscales. ¿Lo tienes a la mano?'],
    ['lead', 'Sí, gracias']]],
  ['@sofi.eats', '', 'instagram', 'Muy Gallito', 'resuelto', [], 3, 'bot', [
    ['lead', '¿Las Korean Spicy pican mucho?'],
    ['agente', '¡Hola! Soy Valeria de Muy Gallito 🐔 Pican medio: tienen salsa Korean spicy y ajonjolí negro. Si quieres algo suave, la Clásica o la Cheesy van perfecto.']]],
  ['Luis Hernández', '5512340104', 'whatsapp', 'Muy Gallito', 'queja', ['Queja'], 2, 'humano', [
    ['lead', 'Mi pedido llegó frío y faltaron las papas'],
    ['agente', 'Lamento mucho eso, Luis. Ya le pasé tu caso al equipo para que te resuelvan hoy mismo. ¿Me compartes tu número de pedido?'],
    ['lead', 'Es el 4821'],
    ['humano', 'Hola Luis, soy del equipo de Muy Gallito. Ya revisamos tu pedido 4821, te mandamos tus papas y un cupón para tu siguiente orden. Perdón por la molestia 🙏']]],
  ['@carlos_burgerlover', '', 'instagram', 'Fat Bastard', 'resuelto', [], 8, 'bot', [
    ['lead', '¿Cuál es la diferencia entre la doble y la triple?'],
    ['agente', '¡Qué onda! Soy Mariana de Fat Bastard 🍔 La doble lleva 120 g de short rib y la triple 180 g, las dos con queso americano, cebolla y aderezo Bastard en pan de papa.']]],
  ['Fernanda Ortiz', '', 'facebook', 'Fat Bastard', 'nuevo', [], 0.3, 'bot', [
    ['lead', '¿Tienen opción sin gluten?']]],
  ['Pablo Medina', '5512340107', 'whatsapp', 'Bass Monkey', 'pedido', ['Pedido', 'Evento'], 26, 'bot', [
    ['lead', 'Quiero pizzas para una fiesta de 20 personas el sábado'],
    ['agente', '¡Qué buen plan, Pablo! Soy Lucía de Bass Monkey 🍕 Para 20 personas te recomiendo 5 square pies. ¿Te paso con el equipo para cotizarlo y apartar la fecha?'],
    ['lead', 'Sí porfa'],
    ['humano', 'Hola Pablo, ya te mandé la cotización por aquí. ¿Te queda para recoger o a domicilio?']]],
  ['@mariajose.mx', '', 'instagram', 'Bass Monkey', 'resuelto', [], 30, 'bot', [
    ['lead', '¿Qué es la Slava?'],
    ['agente', 'Es una de nuestras favoritas: papada estilo eslovaco con marinara y aceituna negra 🤤']]],
  ['Ana Sofía Cruz', '5512340109', 'whatsapp', 'Kab Khao', 'resuelto', ['Sucursal'], 20, 'bot', [
    ['lead', '¿Abren el lunes?'],
    ['agente', '¡Hola! Kab Khao abre de martes a sábado de 1 a 10 pm y domingo de 12 a 7 pm; el lunes descansamos. Estamos en Liverpool 45, Juárez.']]],
  ['@thai.lover', '', 'instagram', 'Tiin Thai', 'nuevo', [], 1.5, 'bot', [
    ['lead', '¿Hacen envíos a Coyoacán?']]],
  ['Jimena Ríos', '5512340111', 'whatsapp', 'Palermo', 'nuevo', [], 4, 'bot', [
    ['lead', 'Hola, ¿hacen reservaciones?']]],
  ['Miguel Ángel Soto', '5512340112', 'whatsapp', 'Chubbies Burger', 'cerrado', ['Pedido'], 50, 'bot', [
    ['lead', '¡Estuvo increíble la Navideña!'],
    ['agente', '¡Qué gusto, Miguel! Gracias por contarnos 🙌 Está por temporada, aprovéchala.']]],
];
const ins = D.prepare(`INSERT INTO leads (client_id, nombre, telefono, usuario, origen, estado, nota, embudo, etapa, empresa, tags_json, asignado_id, resumen, control, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'atencion', ?, ?, ?, ?, ?, ?, ?, ?)`);
const msg = D.prepare('INSERT INTO lead_mensajes (lead_id, rol, texto, autor, created_at) VALUES (?, ?, ?, ?, ?)');
const tipo = Object.fromEntries(embudos[0].etapas.map((e) => [e.id, e.tipo]));
for (const [nombre, tel, origen, marca, etapa, extra, h, control, conv] of conversaciones) {
  const ultimo = conv[conv.length - 1][1];
  const r = ins.run(client.id, nombre, tel ? `+52${tel}` : null, tel ? null : nombre.replace(/^@/, ''), origen, tipo[etapa], null, etapa, marca,
    JSON.stringify([marca, ...extra]), control === 'humano' ? equipoId : null, `${marca}: ${ultimo.slice(0, 120)}`, control, hace(h + 1), hace(h));
  conv.forEach(([rol, texto], i) => msg.run(Number(r.lastInsertRowid), rol, texto, rol === 'humano' ? 'Equipo AMG' : null, hace(h + (conv.length - i) * 0.1)));
}

console.log(`\nMarca de demostración lista: ${NOMBRE} (${SLUG}), ${conversaciones.length} conversaciones de ${MARCAS.length} marcas.`);
console.log('Acceso (entrar en /entrar). Compártelo solo con AMG:\n');
console.log(`  ${email}   ${clave}`);
console.log('\nPara quitar la demo: borra la marca desde el admin (también se borra su usuario).');
