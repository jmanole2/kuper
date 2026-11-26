// Aplica a las marcas de AMG lo que contestaron en "Pendientes AMG" (tono, nombre de cada agente, qué se contesta en
// público, quejas y a quién se pasan): indicaciones del agente de comentarios y el nombre del asistente y el contacto
// de quejas en "Lo que sabe tu agente". Prende el agente de comentarios EN REVISIÓN solo en las marcas que ya tienen
// Meta conectado y su menú cargado (con --sin-revision no toca la revisión que ya tengan). Se puede correr varias veces.
//
//   sudo -u agente /opt/agente-social/node/bin/node --env-file=.env scripts/ajustes-amg.js [--sin-activar]
import { readFileSync } from 'node:fs';
import * as db from '../src/db.js';
import * as conocimiento from '../src/conocimiento.js';
import * as comentarios from '../src/engage/comentarios.js';

const datos = JSON.parse(readFileSync(new URL('./datos/amg.json', import.meta.url), 'utf8'));
const sinActivar = process.argv.includes('--sin-activar');
const conservarRevision = process.argv.includes('--sin-revision');
db.openDb();

export const indicaciones = (m, tono, quejas) => [
  m.agente ? `Firma como ${m.agente}, de ${m.nombre}, cuando se presente.` : '',
  tono,
  'Contesta TODO en público: dudas, menú, pedidos, facturas y precios, con lo que está en Lo que sabe tu agente. No mandes a mensaje directo por dudas de menú o precio.',
  m.pedidos ? `Si preguntan un precio que no está en Lo que sabe tu agente: en público describe el producto (qué lleva) e invita a ver el precio de su sucursal y pedir en ${m.pedidos}. No mandes mensaje directo por eso ni prometas pasar precios.` : 'Si preguntan un precio que no está en Lo que sabe tu agente, dilo con naturalidad e invita a escribir por mensaje directo.',
  m.pedidos ? `Para pedir: ${m.pedidos}.` : '',
  'Mensaje directo solo para quejas y temas que no son pedidos ni la experiencia de la marca; nunca prometas en el mensaje directo información que no tengas.',
  'Quejas: primero muestra interés y cuidado de verdad, pregunta qué pasó y da una respuesta empática en público; luego invita a seguir por mensaje directo para resolverlo (ahí se ven reposición o cupón; nunca los ofrezcas en público).',
  'Groserías o comentarios negativos sin queja concreta: no se contestan.',
  'Empleo, proveedores, colaboraciones, prensa y todo lo que no sea pedidos o la experiencia de la marca: saluda, da una respuesta corta acorde al tema e invita a escribir por mensaje directo.',
  `Si el caso necesita a una persona: ${quejas}.`,
  'No prometas promociones, cupones ni tiempos de entrega que no estén en Lo que sabe tu agente.',
].filter(Boolean).join('\n');

for (const m of datos.marcas) {
  const c = db.listClients().find((x) => x.slug === m.slug);
  if (!c) { console.log(`✖ ${m.nombre.padEnd(16)} no existe (corre primero scripts/marcas-amg.js)`); continue; }
  // Lo que sabe tu agente: nombre del asistente y contacto de quejas, sin tocar lo demás que hayan escrito.
  const k = conocimiento.actual(c.id);
  if (k) {
    let t = k.texto;
    if (m.agente) t = /- Asistente: [^\n]*/.test(t) ? t.replace(/- Asistente: [^\n]*/, `- Asistente: ${m.agente}.`) : t.replace(/(## Quiénes somos\n)/, `$1- Asistente: ${m.agente}.\n`);
    if (!t.includes('## Quejas y casos para el equipo')) t = t.replace(/\n## Reglas/, `\n## Quejas y casos para el equipo\n- ${datos.quejas}. Reposición o cupón solo por mensaje directo.\n\n## Reglas`);
    conocimiento.guardar(c.id, { texto: t, datos: k.datos }, 'Kuper');
  }
  // Agente de comentarios.
  const meta = db.clientCredentials(c).meta || {};
  const conectada = Boolean(meta.page_token && (meta.page_id || meta.ig_user_id));
  const conMenu = !/\(Pendiente: menú/.test(conocimiento.actual(c.id)?.texto || '');
  const aj = comentarios.ajustes(c);
  const activo = aj.activo || (!sinActivar && conectada && conMenu);
  db.updateClient(c.id, { config: { ...c.config, comentarios: { ...aj, activo, revision: conservarRevision ? aj.revision : true, instrucciones: indicaciones(m, datos.tono, datos.quejas).slice(0, 2000) } } });
  console.log(`${activo ? '✔' : '·'} ${m.nombre.padEnd(16)} ${m.agente ? `agente ${m.agente}` : 'sin nombre de agente'} · comentarios ${activo ? 'ACTIVOS en revisión' : `apagados (${!conectada ? 'falta conectar Meta' : 'falta su menú'})`}`);
}
console.log('\nEn revisión nada se publica hasta que alguien lo aprueba en Comentarios → Por aprobar.');
