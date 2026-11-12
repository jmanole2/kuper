// Cuenta de demostración para New Ventures (convocatoria Emprende en TikTok): una marca con aplicantes de ejemplo
// en 4 países, conversaciones, embudo de postulación, una persona del equipo por país y una campaña por aprobar.
// Sirve para enseñar cómo trabajan varias personas en el mismo panel. Se puede correr varias veces: borra y
// vuelve a crear los datos de ejemplo de esa marca y les da contraseñas nuevas.
//
//   npm run demo-newventures
//
// Imprime los accesos (correo y contraseña) en la terminal del servidor.
import * as db from '../src/db.js';
import { hashPassword, tempPassword } from '../src/crypto.js';
import * as difusion from '../src/difusion.js';
import * as docs from '../src/documentos.js';

db.openDb();
const SLUG = 'demo-new-ventures';
const NOMBRE = 'Demo · Emprende en TikTok';
const embudos = [{ id: 'postulacion', nombre: 'Postulaciones', etapas: [
  { id: 'registrado', nombre: 'Registrado', tipo: 'nuevo' },
  { id: 'pendientes', nombre: 'Documentos pendientes', tipo: 'conversacion' },
  { id: 'completos', nombre: 'Documentos completos', tipo: 'cita' },
  { id: 'seleccionado', nombre: 'Seleccionado', tipo: 'cliente' },
  { id: 'descartado', nombre: 'Descartado', tipo: 'perdido' },
] }];
const hasta = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date(Date.now() + 10 * 86400000));
const config = {
  plan: { servicios: { redes: false, chat: true, agenda: false, comentarios: false, llamadas: false, blog: false, videollamadas: false }, cobro: 'cortesia' },
  embudos,
  avisos_temporales: [{ id: 'demo1', texto: 'La fecha límite para completar documentos es el 20 de marzo. Después ya no se reciben.', hasta, autor: 'Equipo' }],
};

let client = db.listClients().find((c) => c.slug === SLUG);
if (client) db.updateClient(client.id, { nombre: NOMBRE, config: { ...client.config, ...config } });
else client = db.createClient({ slug: SLUG, nombre: NOMBRE, perfil: { cliente: NOMBRE, pilares_de_contenido: [{ nombre: 'Convocatoria' }] }, config, credentials: {} });
client = db.getClient(client.id);
const D = db.getDb();
D.prepare('DELETE FROM leads WHERE client_id = ?').run(client.id);
try { D.prepare('DELETE FROM difusiones WHERE client_id = ?').run(client.id); } catch { /* aún no existe la tabla */ }

// Una persona del equipo por país (acceso solo a esta marca de demostración).
const equipo = [['Ale', 'México'], ['Cata', 'Colombia'], ['Equipo Perú', 'Perú'], ['Equipo Argentina', 'Argentina']];
const accesos = [];
const usuarios = {};
for (const [nombre, pais] of equipo) {
  const email = `${pais.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@demo-newventures.kuper.media`;
  const clave = tempPassword();
  const previo = D.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (previo) D.prepare('UPDATE users SET nombre = ?, client_id = ?, password_hash = ?, activo = 1 WHERE id = ?').run(nombre, client.id, hashPassword(clave), previo.id);
  else db.createUser({ email, nombre, rol: 'cliente', client_id: client.id, password_hash: hashPassword(clave) });
  usuarios[pais] = D.prepare('SELECT id FROM users WHERE email = ?').get(email).id;
  accesos.push([nombre, pais, email, clave]);
}

const hace = (h) => new Date(Date.now() - h * 3600000).toISOString().replace('T', ' ').slice(0, 19);
const aplicantes = [
  // nombre, negocio, país, tel, etapa, pendientes, horas desde el último mensaje, control, conversación
  ['Ana Torres', 'Café Origen', 'México', '5512340001', 'pendientes', 'video pitch, comprobante de ventas', 3, 'bot', [
    ['agente', '¡Hola, Ana! Soy Lucía, de Emprende en TikTok. Para que la postulación de Café Origen siga en la convocatoria, te falta: el video pitch y el comprobante de ventas del último año.'],
    ['lead', 'Ya grabé el video pero dura 1:20, ¿sirve?'],
    ['agente', 'Te recomiendo dejarlo en un minuto para que el comité lo vea completo. ¿Lo puedes recortar y mandármelo por aquí?']]],
  ['Mariana López', 'Velas Luna', 'México', '5512340002', 'completos', '', 20, 'bot', [
    ['lead', 'Listo, ya mandé mi RFC'], ['agente', '¡Gracias, Mariana! Con eso tu postulación de Velas Luna quedó completa. Te avisamos en cuanto haya resultados.']]],
  ['Jorge Ramírez', 'Tacos El Güero', 'México', '5512340003', 'pendientes', 'RFC del negocio', 52, 'humano', [
    ['lead', 'No tengo RFC a nombre del negocio, está a mi nombre, ¿sirve?'], ['agente', 'Lo reviso con alguien del equipo y te confirmo hoy mismo.'],
    ['humano', 'Hola Jorge, soy Ale del equipo de México. Sí sirve tu RFC como persona física, mándalo por aquí. 🙌']]],
  ['Juan Pablo Ríos', 'Arepas Doña Rosa', 'Colombia', '573001110004', 'pendientes', 'RUT del negocio', 30, 'bot', [
    ['agente', '¡Hola, Juan! ¿Cómo vas? Para que la postulación de Arepas Doña Rosa siga en proceso, nos hace falta el RUT del negocio.'],
    ['lead', '¿Dónde consigo el RUT? Lo tiene mi contador'], ['agente', 'Lo puedes descargar de la página de la DIAN o pedírselo a tu contador en PDF. ¿Crees tenerlo esta semana?']]],
  ['Valentina Herrera', 'Dulce Cacao', 'Colombia', '573001110005', 'registrado', 'comprobante de ventas, video pitch', 70, 'bot', [
    ['agente', '¡Hola, Valentina! ¿Cómo vas? Para que la postulación de Dulce Cacao siga en proceso, nos hace falta el comprobante de ventas y el video pitch.']]],
  ['Camilo Suárez', 'Café de la Sierra', 'Colombia', '573001110006', 'seleccionado', '', 100, 'bot', [
    ['agente', '¡Felicidades, Camilo! Café de la Sierra pasó a la fase de talleres.'], ['lead', '¡Qué alegría! Gracias 🙏']]],
  ['Diego Quispe', 'Alpaca Andina', 'Perú', '51900110007', 'pendientes', 'identificación del representante', 2, 'bot', [
    ['agente', '¡Hola, Diego! ¿Qué tal? Para que la postulación de Alpaca Andina continúe, nos falta la identificación de quien representa al negocio.'],
    ['lead', '¿Puede ser mi DNI escaneado por los dos lados?'], ['agente', 'Sí, perfecto: el DNI por ambos lados en foto o PDF. Mándalo por aquí nomás.']]],
  ['Rosa Mamani', 'Tejidos Inti', 'Perú', '51900110008', 'completos', '', 26, 'bot', [
    ['lead', 'Ya envié todo'], ['agente', '¡Gracias, Rosa! Tu postulación de Tejidos Inti quedó completa.']]],
  ['Lucas Fernández', 'Mate y Yerba', 'Argentina', '5491100110009', 'pendientes', 'CUIT, link al perfil de TikTok', 8, 'bot', [
    ['agente', '¡Hola, Lucas! ¿Cómo andás? Para que la postulación de Mate y Yerba siga en carrera, te falta el CUIT y el link al perfil de TikTok.'],
    ['lead', 'Recién arrancamos con TikTok, ¿igual sirve?'], ['agente', '¡Sí, sirve! No importa cuántos seguidores tengas, solo que el perfil sea del negocio. Pasame el link cuando puedas.']]],
  ['Martina Gómez', 'Huerta Viva', 'Argentina', '5491100110010', 'descartado', '', 200, 'bot', [
    ['lead', 'Al final no vamos a participar, gracias'], ['agente', '¡Gracias por avisar, Martina! Te escribimos en la próxima convocatoria.']]],
];
const ins = D.prepare(`INSERT INTO leads (client_id, nombre, telefono, origen, estado, nota, embudo, etapa, empresa, tags_json, asignado_id, resumen, control, created_at, updated_at)
  VALUES (?, ?, ?, 'whatsapp', ?, ?, 'postulacion', ?, ?, ?, ?, ?, ?, ?, ?)`);
const msg = D.prepare('INSERT INTO lead_mensajes (lead_id, rol, texto, autor, created_at) VALUES (?, ?, ?, ?, ?)');
const tipo = Object.fromEntries(embudos[0].etapas.map((e) => [e.id, e.tipo]));
for (const [nombre, negocio, pais, tel, etapa, pend, h, control, conv] of aplicantes) {
  const r = ins.run(client.id, nombre, `+${tel.length === 10 ? `52${tel}` : tel}`, tipo[etapa], pend ? `Falta: ${pend}` : null, etapa, negocio,
    JSON.stringify([pais, ...(pend ? ['documentos pendientes'] : [])]), usuarios[pais], pend ? `Le falta: ${pend}.` : 'Postulación completa.', control, hace(h + 48), hace(h));
  conv.forEach(([rol, texto], i) => msg.run(Number(r.lastInsertRowid), rol, texto, rol === 'humano' ? (equipo.find((x) => x[1] === pais)?.[0] || 'Equipo') : null, hace(h + (conv.length - i) * 0.2)));
}

// Países por lada (con la persona de cada país) y documentos que se piden por WhatsApp.
const requeridos = ['Constancia fiscal', 'Identificación', 'Comprobante de ventas', 'Video pitch', 'Perfil de TikTok'];
db.updateClient(client.id, { config: { ...db.getClient(client.id).config, paises: { activo: true, asesores: usuarios },
  documentos: { activo: true, requeridos, drive_carpeta: '', etapa_completos: 'completos' } } });
client = db.getClient(client.id);
// Documentos de ejemplo: Mariana ya entregó todo; Diego mandó su identificación.
const pdf = (t) => Buffer.from(`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 120]/Contents 4 0 R/Resources<<>>>>endobj 4 0 obj<</Length 60>>stream\nBT /F1 14 Tf 20 60 Td (${t} - documento de ejemplo) Tj ET\nendstream endobj\ntrailer<</Root 1 0 R>>`);
const entregar = async (tel, lista) => { for (const [nombre, tipo] of lista) { await docs.guardar(client, { telefono: tel, nombre, mime: 'application/pdf', buf: pdf(tipo) }); docs.registrarTipo(client, { telefono: tel, tipo }); } };
await entregar('+525512340002', requeridos.map((r) => [`${r} - Velas Luna.pdf`, r]));
await entregar('+51900110007', [['DNI Diego Quispe.pdf', 'Identificación']]);

// Una campaña por aprobar: recordatorio a quienes tienen documentos pendientes.
try {
  difusion.crear(client, { nombre: 'Recordatorio de documentos (fecha límite)', plantilla: 'recordatorio_documentos', cuerpo: 'Hola {{1}}, te recordamos que para tu postulación a Emprende en TikTok faltan algunos documentos. La fecha límite es el 20 de marzo. Responde este mensaje y te decimos cuáles.',
    variables: [{ fuente: 'nombre' }], filtros: { etapas: ['pendientes', 'registrado'] }, tope_diario: 250 }, 'Ale');
} catch (e) { console.error('Campaña de ejemplo:', e.message); }

console.log(`\nMarca de demostración lista: ${NOMBRE} (${SLUG}), ${aplicantes.length} aplicantes en 4 países.`);
console.log('Accesos (entrar en /entrar). Compártelos solo con New Ventures:\n');
for (const [nombre, pais, email, clave] of accesos) console.log(`  ${pais.padEnd(10)} ${nombre.padEnd(18)} ${email}   ${clave}`);
console.log('\nPara quitar la demo: borra la marca desde el admin (también se borran sus usuarios).');
