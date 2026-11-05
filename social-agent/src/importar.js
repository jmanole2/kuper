// Importa contactos exportados de Leadsales (CSV) a los leads del panel, con sus embudos y etapas.
// Columnas: Lead, Name, Value, Email, Tags, Company, Funnel Name, Stage Name, Created At, First Message,
// Last Message, Active, Is In Inbox, Status, Revenue, Last Action At, Channel, User Assigned.
// Las fechas de Leadsales vienen en UTC (cuadra con su reporte: ~36 % de leads fuera de horario).
import * as db from './db.js';
import { embudos, TIPOS } from './embudo.js';

/** CSV con comillas y saltos de línea dentro de los campos (RFC 4180). */
export function parseCSV(texto) {
  const t = String(texto).replace(/^\uFEFF/, '');
  const filas = []; let fila = [], campo = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else q = false; }
      else campo += c;
    } else if (c === '"') q = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  const [cab, ...resto] = filas.filter((f) => f.some((x) => x.trim()));
  if (!cab) return [];
  return resto.map((f) => Object.fromEntries(cab.map((k, i) => [k.trim(), (f[i] ?? '').trim()])));
}

const slug = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
// "PRINCIPAL - IH" → "Principal"; "CRM - BASE DATOS" → "CRM - Base datos"
const bonito = (s) => { const x = String(s).replace(/\s*-\s*IH\s*$/i, '').trim().toLowerCase(); return (x.charAt(0).toUpperCase() + x.slice(1)).replace(/\bcrm\b/gi, 'CRM'); };

function tipoDe(embudo, etapa) {
  const E = etapa.toUpperCase();
  if (/PROVEEDOR/i.test(embudo) || /^EX[- ]/.test(E)) return 'archivo';
  if (/^NUEVO/.test(E)) return 'nuevo';
  if (/^CRM/.test(E)) return 'archivo';
  if (/CLIENTE/.test(E)) return 'cliente';
  if (/VISITA/.test(E)) return 'cita';
  if (/PERDID/.test(E)) return 'perdido';
  return 'conversacion';
}
// Orden de las columnas en el tablero (Leadsales no lo exporta).
const RANGO = [[/^NUEVO/, 0], [/CONTESTADO/, 1], [/INTERESAD/, 2], [/VISITA/, 3], [/SEGUIMIENTO/, 4], [/CIERRE/, 5], [/LISTA/, 6], [/^CLIENTE/, 7], [/PERDID/, 8]];
const rango = (nombre, tipo) => (tipo === 'archivo' ? 9 : RANGO.find(([r]) => r.test(nombre.toUpperCase()))?.[1] ?? 6.5);

const CANAL = { WHATSAPP_WEB: ['whatsapp', 'wa'], WHATSAPP: ['whatsapp', 'wa'], INSTAGRAM: ['instagram', 'ig'], MESSENGER: ['facebook', 'fb'] };
const fechaOk = (s) => /^\d{4}-\d\d-\d\d \d\d:\d\d(:\d\d)?$/.test(s);

/** Lee el CSV y devuelve los contactos listos, los embudos que salen de él y un resumen para la vista previa. */
export function leerLeadsales(texto) {
  const filas = parseCSV(texto);
  if (!filas.length || !('Lead' in filas[0]) || !('Stage Name' in filas[0])) throw new Error('No parece un CSV de Leadsales (faltan las columnas Lead y Stage Name).');
  const raros = [], contactos = [];
  const mapa = new Map(); // embudo -> Map(etapa -> n)
  for (const f of filas) {
    const canal = CANAL[String(f.Channel).toUpperCase()];
    if (!f.Lead || !f['Funnel Name'] || !f['Stage Name'] || !fechaOk(f['Created At']) || !canal) { raros.push(f.Lead || '(sin id)'); continue; }
    if (!mapa.has(f['Funnel Name'])) mapa.set(f['Funnel Name'], new Map());
    const m = mapa.get(f['Funnel Name']); m.set(f['Stage Name'], (m.get(f['Stage Name']) || 0) + 1);
    const tel = canal[1] === 'wa' && /^\d{8,15}$/.test(f.Lead);
    const valor = Math.max(Number(f.Value) || 0, Number(f.Revenue) || 0);
    contactos.push({
      ident: tel ? { telefono: `+${f.Lead}` } : { usuario: `${canal[1]}:${f.Lead}` },
      origen: canal[0], nombre: f.Name || null, email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.Email) ? f.Email.toLowerCase() : null,
      empresa: f.Company || null, valor: valor || null,
      tags: String(f.Tags || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 12),
      embudo: f['Funnel Name'], etapa: f['Stage Name'], creado: f['Created At'], accion: fechaOk(f['Last Action At']) ? f['Last Action At'] : f['Created At'],
      nota: [f['First Message'] && `Primer mensaje: «${f['First Message'].slice(0, 200)}»`, f['Last Message'] && `Último: «${f['Last Message'].slice(0, 200)}»`].filter(Boolean).join(' · ') || null,
    });
  }
  // Embudos como en Leadsales: Principal primero, Proveedores al final, el resto por tamaño.
  const orden = [...mapa.entries()].sort((a, b) => (/PRINCIPAL/i.test(b[0]) - /PRINCIPAL/i.test(a[0])) || (/PROVEEDOR/i.test(a[0]) - /PROVEEDOR/i.test(b[0]))
    || [...b[1].values()].reduce((x, y) => x + y, 0) - [...a[1].values()].reduce((x, y) => x + y, 0));
  const lista = orden.map(([nombre, etapas]) => ({
    id: slug(bonito(nombre)) || 'embudo', nombre: bonito(nombre), origen: nombre,
    etapas: [...etapas.keys()].map((e) => ({ id: slug(bonito(e)), nombre: bonito(e).slice(0, 40), tipo: tipoDe(nombre, e), origen: e, n: etapas.get(e) }))
      .sort((a, b) => rango(a.origen, a.tipo) - rango(b.origen, b.tipo) || a.nombre.localeCompare(b.nombre)),
  }));
  // Un embudo de una sola etapa no se puede mostrar como tablero: se le agrega "Clientes".
  for (const e of lista) if (e.etapas.length < 2) e.etapas.push({ id: 'clientes', nombre: 'Clientes', tipo: 'cliente', origen: '', n: 0 });
  const canales = {};
  for (const c of contactos) canales[c.origen] = (canales[c.origen] || 0) + 1;
  return { contactos, embudos: lista, raros, canales, total: filas.length };
}

/** Carga los contactos al cliente. Los que ya existían (mismo teléfono o usuario) se actualizan sin duplicar. */
export function importar(client, leido) {
  const d = db.getDb();
  const config = { ...client.config, embudos: leido.embudos.map((e) => ({ id: e.id, nombre: e.nombre, etapas: e.etapas.map(({ id, nombre, tipo }) => ({ id, nombre, tipo })) })) };
  delete config.embudo;
  db.updateClient(client.id, { config });
  const idEmbudo = Object.fromEntries(leido.embudos.map((e) => [e.origen, e]));
  let nuevos = 0, actualizados = 0;
  d.exec('BEGIN');
  try {
    for (const c of leido.contactos) {
      const antes = d.prepare('SELECT id FROM leads WHERE client_id = ? AND ((telefono IS NOT NULL AND telefono = ?) OR (usuario IS NOT NULL AND usuario = ?))')
        .get(client.id, c.ident.telefono ? c.ident.telefono.replace(/^\+521(\d{10})$/, '+52$1') : null, c.ident.usuario || null);
      const lead = db.upsertLead(client.id, { ...c.ident, nombre: c.nombre || undefined, email: c.email || undefined, origen: c.origen });
      antes ? actualizados++ : nuevos++;
      const emb = idEmbudo[c.embudo], et = emb.etapas.find((x) => x.origen === c.etapa) || emb.etapas[0];
      const tags = [...new Set([...(JSON.parse(lead.tags_json || '[]')), ...c.tags])].slice(0, 12);
      d.prepare(`UPDATE leads SET embudo = ?, etapa = ?, estado = ?, empresa = COALESCE(empresa, ?), valor = COALESCE(?, valor), tags_json = ?,
        nota = COALESCE(nota, ?), resultado = CASE WHEN ? = 'cliente' THEN 'vendido' ELSE resultado END,
        created_at = ?, updated_at = ? WHERE id = ?`)
        .run(emb.id, et.id, et.tipo === 'archivo' ? 'conversacion' : et.tipo, c.empresa, c.valor, JSON.stringify(tags), c.nota, et.tipo, c.creado, c.accion, lead.id);
    }
    d.exec('COMMIT');
  } catch (e) { d.exec('ROLLBACK'); throw e; }
  db.logEvent({ clientId: client.id, tipo: 'importacion_leadsales', detalle: `${nuevos} nuevos, ${actualizados} actualizados` });
  return { nuevos, actualizados, embudos: embudos(db.getClient(client.id)).length, tipos: TIPOS };
}
