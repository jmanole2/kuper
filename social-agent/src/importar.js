// Importa contactos de un CSV (Leadsales u otro CRM) a los leads del panel, con sus embudos y etapas.
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

const CANAL = { WHATSAPP_WEB: ['whatsapp', 'wa'], WHATSAPP: ['whatsapp', 'wa'], INSTAGRAM: ['instagram', 'ig'], MESSENGER: ['facebook', 'fb'], FACEBOOK: ['facebook', 'fb'] };
const PRIORIDAD = { PENDING: 'pendiente', STUCK: 'atorado', IMPORTANT: 'importante', URGENT: 'urgente', PENDIENTE: 'pendiente', ATORADO: 'atorado', IMPORTANTE: 'importante', URGENTE: 'urgente' };
// Fechas: "2026-11-05 04:31:53", "2026-11-05T04:31:53Z" o "05/11/2026 04:31" → "YYYY-MM-DD HH:MM:SS"
function fecha(s) {
  const t = String(s || '').trim();
  let m = /^(\d{4})-(\d\d)-(\d\d)(?:[ T](\d\d):(\d\d)(?::(\d\d))?)?/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]} ${m[4] || '12'}:${m[5] || '00'}:${m[6] || '00'}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d\d))?/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')} ${(m[4] || '12').padStart(2, '0')}:${m[5] || '00'}:00`;
  return null;
}

// Nombres de columna que se reconocen (Leadsales, HubSpot, Kommo, Excel en español…).
const COLUMNAS = {
  id: ['lead'], tel: ['telefono', 'phone', 'phone number', 'celular', 'movil', 'mobile', 'whatsapp', 'numero', 'tel'],
  nombre: ['name', 'nombre', 'full name', 'nombre completo', 'contacto', 'first name'], apellido: ['last name', 'apellido', 'apellidos'],
  email: ['email', 'correo', 'e-mail', 'correo electronico', 'mail'], empresa: ['company', 'empresa', 'compania', 'organizacion', 'organization', 'negocio'],
  tags: ['tags', 'etiquetas', 'labels', 'etiqueta'], embudo: ['funnel name', 'embudo', 'pipeline', 'funnel'], etapa: ['stage name', 'etapa', 'stage', 'fase', 'deal stage'],
  canal: ['channel', 'canal', 'source', 'origen', 'fuente'], valor: ['value', 'valor', 'monto', 'amount', 'revenue', 'importe'],
  creado: ['created at', 'creado', 'fecha', 'created', 'fecha de creacion', 'create date'], accion: ['last action at', 'ultima actividad', 'updated at', 'last activity date', 'actualizado'],
  primero: ['first message', 'primer mensaje'], ultimo: ['last message', 'ultimo mensaje'], nota: ['notes', 'notas', 'nota', 'comentarios', 'descripcion'],
  prioridad: ['status', 'prioridad', 'estatus'],
};
const norm = (k) => String(k).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[_]+/g, ' ').trim();
function columnas(cab) {
  const m = {};
  for (const [k, alias] of Object.entries(COLUMNAS)) { const c = cab.find((h) => alias.includes(norm(h))); if (c) m[k] = c; }
  return m;
}

/** Lee el CSV (Leadsales u otro CRM) y devuelve los contactos, los embudos y un resumen para la vista previa.
 *  Si el archivo trae embudo y etapa (como Leadsales), se crean esos embudos; si no, los contactos entran a los embudos del cliente. */
export function leerContactos(texto, client = null) {
  const filas = parseCSV(texto);
  if (!filas.length) throw new Error('El archivo está vacío o no es un CSV.');
  const C = columnas(Object.keys(filas[0]));
  if (!C.id && !C.tel && !C.email) throw new Error('No encontré columnas de teléfono o correo. El archivo debe traer al menos una columna "Teléfono" (o "Phone") o "Correo" (o "Email").');
  const v = (f, k) => (C[k] ? String(f[C[k]] ?? '').trim() : '');
  const conEmbudos = !!(C.embudo && C.etapa);
  const propios = client ? embudos(client) : [];
  const raros = [], contactos = [];
  const mapa = new Map(); // embudo -> Map(etapa -> n)
  let sinEtapa = 0;
  for (const f of filas) {
    const canal = CANAL[v(f, 'canal').toUpperCase().replace(/\s+/g, '_')] || null;
    const bruto = v(f, 'id') || v(f, 'tel');
    const digitos = bruto.replace(/[^\d]/g, '');
    const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v(f, 'email')) ? v(f, 'email').toLowerCase() : null;
    const esTel = (!canal || canal[1] === 'wa') && digitos.length >= 8 && digitos.length <= 15;
    const ident = esTel ? { telefono: `+${digitos.length === 10 ? `52${digitos}` : digitos}` } : canal && bruto ? { usuario: `${canal[1]}:${bruto}` } : email ? { email } : null;
    if (!ident) { raros.push(bruto || v(f, 'nombre') || '(sin datos)'); continue; }
    let embudo, etapa;
    if (conEmbudos) {
      embudo = v(f, 'embudo') || 'Importados'; etapa = v(f, 'etapa') || 'Nuevos';
      if (!mapa.has(embudo)) mapa.set(embudo, new Map());
      const m = mapa.get(embudo); m.set(etapa, (m.get(etapa) || 0) + 1);
    } else {
      const emb = propios[0] || { id: 'principal', etapas: [] };
      const buscada = slug(v(f, 'etapa'));
      const et = (buscada && emb.etapas.find((x) => x.id === buscada || slug(x.nombre) === buscada)) || emb.etapas[0];
      if (v(f, 'etapa') && et !== emb.etapas.find((x) => slug(x.nombre) === buscada)) sinEtapa++;
      embudo = emb.id; etapa = et?.id;
    }
    const creado = fecha(v(f, 'creado'));
    const nombre = [v(f, 'nombre'), v(f, 'apellido')].filter(Boolean).join(' ') || null;
    contactos.push({
      ident, origen: canal ? canal[0] : esTel ? 'whatsapp' : 'otro', nombre, email,
      empresa: v(f, 'empresa') || null, valor: Number(v(f, 'valor').replace(/[$,\s]/g, '')) || null,
      tags: v(f, 'tags').split(/[,;|]/).map((t) => t.trim()).filter(Boolean).slice(0, 12),
      prioridad: PRIORIDAD[v(f, 'prioridad').toUpperCase()] || null,
      embudo, etapa, creado, accion: fecha(v(f, 'accion')) || creado,
      nota: [v(f, 'primero') && `Primer mensaje: «${v(f, 'primero').slice(0, 200)}»`, v(f, 'ultimo') && `Último: «${v(f, 'ultimo').slice(0, 200)}»`, v(f, 'nota').slice(0, 400)].filter(Boolean).join(' · ') || null,
    });
  }
  let lista;
  if (conEmbudos) {
    // Embudos como vienen: Principal primero, Proveedores al final, el resto por tamaño.
    const orden = [...mapa.entries()].sort((a, b) => (/PRINCIPAL/i.test(b[0]) - /PRINCIPAL/i.test(a[0])) || (/PROVEEDOR/i.test(a[0]) - /PROVEEDOR/i.test(b[0]))
      || [...b[1].values()].reduce((x, y) => x + y, 0) - [...a[1].values()].reduce((x, y) => x + y, 0));
    lista = orden.map(([nombre, etapas]) => ({
      id: slug(bonito(nombre)) || 'embudo', nombre: bonito(nombre), origen: nombre,
      etapas: [...etapas.keys()].map((e) => ({ id: slug(bonito(e)), nombre: bonito(e).slice(0, 40), tipo: tipoDe(nombre, e), origen: e, n: etapas.get(e) }))
        .sort((a, b) => rango(a.origen, a.tipo) - rango(b.origen, b.tipo) || a.nombre.localeCompare(b.nombre)),
    }));
    // Un embudo de una sola etapa no se puede mostrar como tablero: se le agrega "Clientes".
    for (const e of lista) if (e.etapas.length < 2) e.etapas.push({ id: 'clientes', nombre: 'Clientes', tipo: 'cliente', origen: '', n: 0 });
  } else {
    lista = propios.map((e) => ({ ...e, origen: e.id, etapas: e.etapas.map((x) => ({ ...x, origen: x.id, n: contactos.filter((c) => c.embudo === e.id && c.etapa === x.id).length })) }));
  }
  const canales = {};
  for (const c of contactos) canales[c.origen] = (canales[c.origen] || 0) + 1;
  return { contactos, embudos: lista, reemplaza: conEmbudos, raros, canales, total: filas.length, sinEtapa, columnas: C };
}
export const leerLeadsales = leerContactos;

/** Carga los contactos al cliente. Los que ya existían (mismo teléfono o usuario) se actualizan sin duplicar. */
export function importar(client, leido) {
  const d = db.getDb();
  if (leido.reemplaza) {
    const config = { ...client.config, embudos: leido.embudos.map((e) => ({ id: e.id, nombre: e.nombre, etapas: e.etapas.map(({ id, nombre, tipo }) => ({ id, nombre, tipo })) })) };
    delete config.embudo;
    db.updateClient(client.id, { config });
  }
  const idEmbudo = Object.fromEntries(leido.embudos.map((e) => [e.origen, e]));
  let nuevos = 0, actualizados = 0;
  d.exec('BEGIN');
  try {
    for (const c of leido.contactos) {
      const antes = d.prepare('SELECT id FROM leads WHERE client_id = ? AND ((telefono IS NOT NULL AND telefono = ?) OR (usuario IS NOT NULL AND usuario = ?) OR (email IS NOT NULL AND email = ?))')
        .get(client.id, c.ident.telefono ? c.ident.telefono.replace(/^\+521(\d{10})$/, '+52$1') : null, c.ident.usuario || null, c.ident.email || null);
      const lead = db.upsertLead(client.id, { ...c.ident, nombre: c.nombre || undefined, email: c.email || undefined, origen: c.origen });
      antes ? actualizados++ : nuevos++;
      const emb = idEmbudo[c.embudo], et = emb.etapas.find((x) => x.origen === c.etapa) || emb.etapas[0];
      const tags = [...new Set([...(JSON.parse(lead.tags_json || '[]')), ...c.tags])].slice(0, 12);
      d.prepare(`UPDATE leads SET embudo = ?, etapa = ?, estado = ?, empresa = COALESCE(empresa, ?), valor = COALESCE(?, valor), tags_json = ?,
        nota = COALESCE(nota, ?), resultado = CASE WHEN ? = 'cliente' THEN 'vendido' ELSE resultado END, prioridad = COALESCE(?, prioridad),
        created_at = COALESCE(?, created_at), updated_at = COALESCE(?, updated_at) WHERE id = ?`)
        .run(emb.id, et.id, et.tipo === 'archivo' ? 'conversacion' : et.tipo, c.empresa, c.valor, JSON.stringify(tags), c.nota, et.tipo, c.prioridad, c.creado, c.accion, lead.id);
    }
    d.exec('COMMIT');
  } catch (e) { d.exec('ROLLBACK'); throw e; }
  db.logEvent({ clientId: client.id, tipo: 'importacion_contactos', detalle: `${nuevos} nuevos, ${actualizados} actualizados` });
  return { nuevos, actualizados, embudos: embudos(db.getClient(client.id)).length, tipos: TIPOS };
}
