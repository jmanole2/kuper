// Prospección: empresas a las que el agente de ventas llama para ofrecer los servicios de la agencia.
// Se buscan por giro y ciudad en Google Places, se revisan contra el REPEP de PROFECO y el agente de llamadas
// pide la siguiente con GET /api/:slug/prospectos/siguiente y reporta el resultado al terminar.
import { config } from './config.js';
import * as db from './db.js';
import * as llamadas from './llamadas.js';

const getDb = () => db.getDb();
export const hooks = {}; // pruebas: hooks.fetch

export const ESTADOS = {
  pendiente: ['Por llamar', '#93b4ff'],
  llamando: ['Llamando', '#fbbf24'],
  sin_respuesta: ['No contestó', '#a39d93'],
  interesado: ['Interesado', '#c9f53a'],
  cita: ['Con cita', '#4ade80'],
  no_interesa: ['No le interesa', '#f87171'],
  no_llamar: ['No llamar', '#f87171'],
};
// Reglas: solo de lunes a viernes en horario de oficina (hora de México), máximo 3 intentos, al menos 20 h entre intentos,
// una llamada a la vez y solo empresas revisadas en el REPEP.
export const REGLAS = { franjas: [['10:00', '13:30'], ['16:00', '18:30']], dias: [1, 2, 3, 4, 5], maxIntentos: 3, horasEntreIntentos: 20 };

export function ensureTables() {
  getDb().exec(`CREATE TABLE IF NOT EXISTS prospectos (
    id INTEGER PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    place_id TEXT, empresa TEXT NOT NULL, telefono TEXT NOT NULL, giro TEXT, ciudad TEXT, direccion TEXT, web TEXT,
    rating REAL, resenas INTEGER,
    estado TEXT NOT NULL DEFAULT 'pendiente', repep_revisado INTEGER NOT NULL DEFAULT 0,
    intentos INTEGER NOT NULL DEFAULT 0, ultimo_intento TEXT, call_id TEXT,
    contacto TEXT, email TEXT, resumen TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (client_id, telefono))`);
}

/** Teléfono de México a +52 + 10 dígitos (como los leads). */
export function normTel(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.length === 10) d = `52${d}`;
  if (d.length === 13 && d.startsWith('521')) d = `52${d.slice(3)}`;
  return d.length >= 11 && d.length <= 13 ? `+${d}` : null;
}

// ------------------------------------------------------------ búsqueda en Google Places
/** Busca empresas por giro y ciudad. Guarda las que tienen teléfono y no estaban ya. Devuelve { encontradas, nuevas }. */
export async function buscar(client, { giro, ciudad, cuantas = 20 }) {
  ensureTables();
  giro = String(giro || '').trim().slice(0, 80); ciudad = String(ciudad || '').trim().slice(0, 80);
  if (!giro || !ciudad) throw new Error('Escribe el giro y la ciudad.');
  if (!config.googlePlacesKey) throw new Error('Falta GOOGLE_PLACES_API_KEY en el .env del panel.');
  const f = hooks.fetch || fetch;
  const lugares = [];
  let pageToken;
  for (let i = 0; i < Math.min(3, Math.ceil(cuantas / 20)); i++) {
    const r = await f('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': config.googlePlacesKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.nationalPhoneNumber,places.internationalPhoneNumber,places.formattedAddress,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus,nextPageToken' },
      body: JSON.stringify({ textQuery: `${giro} en ${ciudad}`, languageCode: 'es', regionCode: 'MX', pageSize: 20, ...(pageToken ? { pageToken } : {}) }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Google Places: ${d.error?.message || r.status}`);
    lugares.push(...(d.places || []));
    pageToken = d.nextPageToken;
    if (!pageToken) break;
  }
  // Teléfonos que ya son leads o clientes: no se les ofrece de nuevo.
  const conocidos = new Set(getDb().prepare('SELECT telefono FROM leads WHERE client_id = ? AND telefono IS NOT NULL').all(client.id).map((x) => x.telefono));
  const ins = getDb().prepare(`INSERT OR IGNORE INTO prospectos (client_id, place_id, empresa, telefono, giro, ciudad, direccion, web, rating, resenas)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  let nuevas = 0;
  for (const p of lugares) {
    if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') continue;
    const tel = normTel(p.internationalPhoneNumber || p.nationalPhoneNumber);
    if (!tel || conocidos.has(tel)) continue;
    nuevas += ins.run(client.id, p.id || null, String(p.displayName?.text || 'Sin nombre').slice(0, 120), tel, giro, ciudad,
      p.formattedAddress || null, p.websiteUri || null, p.rating ?? null, p.userRatingCount ?? null).changes;
  }
  db.logEvent({ clientId: client.id, tipo: 'prospectos_buscados', detalle: `${giro} en ${ciudad}: ${nuevas} nuevas de ${lugares.length}` });
  return { encontradas: lugares.length, nuevas };
}

// ------------------------------------------------------------ lista y REPEP
export function listar(clientId, { estado } = {}) {
  ensureTables();
  return getDb().prepare(`SELECT * FROM prospectos WHERE client_id = ? ${estado ? 'AND estado = ?' : ''} ORDER BY
    CASE estado WHEN 'cita' THEN 0 WHEN 'interesado' THEN 1 WHEN 'llamando' THEN 2 WHEN 'pendiente' THEN 3 WHEN 'sin_respuesta' THEN 4 ELSE 5 END, updated_at DESC LIMIT 1000`)
    .all(...[clientId, ...(estado ? [estado] : [])]);
}
export function conteo(clientId) {
  ensureTables();
  return Object.fromEntries(getDb().prepare('SELECT estado, COUNT(*) n FROM prospectos WHERE client_id = ? GROUP BY estado').all(clientId).map((r) => [r.estado, r.n]));
}
/**
 * Revisión contra el REPEP: los números pegados (los que salieron registrados) pasan a "No llamar";
 * el resto de los que están por llamar quedan marcados como revisados y ya se pueden llamar.
 */
export function aplicarRepep(clientId, textoNumeros) {
  ensureTables();
  const enRepep = new Set(String(textoNumeros || '').split(/[\n,;]+/).map(normTel).filter(Boolean));
  const d = getDb();
  let bloqueados = 0;
  for (const tel of enRepep) bloqueados += d.prepare("UPDATE prospectos SET estado = 'no_llamar', repep_revisado = 1, resumen = 'Registrado en REPEP', updated_at = datetime('now') WHERE client_id = ? AND telefono = ?").run(clientId, tel).changes;
  const revisados = d.prepare("UPDATE prospectos SET repep_revisado = 1, updated_at = datetime('now') WHERE client_id = ? AND repep_revisado = 0 AND estado IN ('pendiente','sin_respuesta')").run(clientId).changes;
  return { bloqueados, revisados };
}
export function marcar(clientId, id, estado) {
  if (!ESTADOS[estado]) throw new Error('Estado no válido');
  ensureTables();
  getDb().prepare("UPDATE prospectos SET estado = ?, updated_at = datetime('now') WHERE id = ? AND client_id = ?").run(estado, id, clientId);
}
export const borrar = (clientId, id) => { ensureTables(); getDb().prepare('DELETE FROM prospectos WHERE id = ? AND client_id = ?').run(id, clientId); };

// ------------------------------------------------------------ llamadas automáticas
export const activo = (clientId) => db.kvGet(`ventas_activo_${clientId}`) === '1';
export const setActivo = (clientId, on) => db.kvSet(`ventas_activo_${clientId}`, on ? '1' : '0');

const horaLocal = (now) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: config.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((x) => [x.type, x.value]));
  return { dia: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), hm: `${p.hour}:${p.minute}` };
};
export function enHorario(now = new Date()) {
  const { dia, hm } = horaLocal(now);
  return REGLAS.dias.includes(dia) && REGLAS.franjas.some(([a, b]) => hm >= a && hm < b);
}
const sqlFecha = (d) => d.toISOString().replace('T', ' ').slice(0, 19);

/** La siguiente empresa a la que toca llamar, o { motivo } si ahorita no se debe llamar. La marca como "llamando". */
export function siguiente(client, now = new Date()) {
  ensureTables();
  const d = getDb();
  // Una llamada que se quedó en "llamando" más de 30 min (se cayó el agente): cuenta como no contestó.
  d.prepare("UPDATE prospectos SET estado = 'sin_respuesta', updated_at = datetime('now') WHERE client_id = ? AND estado = 'llamando' AND ultimo_intento < ?")
    .run(client.id, sqlFecha(new Date(now - 30 * 60_000)));
  if (!activo(client.id)) return { motivo: 'pausado' };
  if (!enHorario(now)) return { motivo: 'fuera_de_horario' };
  if (d.prepare("SELECT 1 FROM prospectos WHERE client_id = ? AND estado = 'llamando'").get(client.id)) return { motivo: 'ocupado' };
  const p = d.prepare(`SELECT * FROM prospectos WHERE client_id = ? AND estado IN ('pendiente','sin_respuesta') AND repep_revisado = 1
    AND intentos < ? AND (ultimo_intento IS NULL OR ultimo_intento < ?) ORDER BY intentos, id LIMIT 1`)
    .get(client.id, REGLAS.maxIntentos, sqlFecha(new Date(now - REGLAS.horasEntreIntentos * 3600_000)));
  if (!p) return { motivo: 'sin_pendientes' };
  d.prepare("UPDATE prospectos SET estado = 'llamando', intentos = intentos + 1, ultimo_intento = ?, updated_at = datetime('now') WHERE id = ?").run(sqlFecha(now), p.id);
  return { prospecto: { id: p.id, empresa: p.empresa, telefono: p.telefono, giro: p.giro, ciudad: p.ciudad, intento: p.intentos + 1 } };
}

const RESULTADOS = ['no_contesto', 'no_interesa', 'interesado', 'cita', 'no_llamar'];
/**
 * Resultado de una llamada. body: { resultado, call_id, resumen, contacto, email, duracion_s, inicio, transcripcion }.
 * Si quedó interesado o con cita, la llamada también se guarda en Llamadas y la empresa entra a Leads.
 */
export function resultado(client, id, body = {}) {
  ensureTables();
  const p = getDb().prepare('SELECT * FROM prospectos WHERE id = ? AND client_id = ?').get(id, client.id);
  if (!p) throw new Error('Prospecto no encontrado');
  const r = RESULTADOS.includes(body.resultado) ? body.resultado : 'no_contesto';
  const estado = r === 'no_contesto' ? 'sin_respuesta' : r;
  const txt = (v, n) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, n));
  getDb().prepare(`UPDATE prospectos SET estado = ?, call_id = COALESCE(?, call_id), resumen = COALESCE(?, resumen), contacto = COALESCE(?, contacto),
    email = COALESCE(?, email), updated_at = datetime('now') WHERE id = ?`).run(estado, txt(body.call_id, 120), txt(body.resumen, 1500), txt(body.contacto, 80), txt(body.email, 120), p.id);
  if (body.call_id && r !== 'no_contesto') {
    const conLead = r === 'interesado' || r === 'cita';
    llamadas.registrar(client, { ...body, tipo: 'saliente', telefono: p.telefono, nombre: txt(body.contacto, 80) ? `${txt(body.contacto, 60)} (${p.empresa})` : p.empresa, cita: r === 'cita' }, { sinLead: !conLead });
  }
  db.logEvent({ clientId: client.id, tipo: 'prospecto_llamado', detalle: `${p.empresa}: ${ESTADOS[estado][0]}` });
  return getDb().prepare('SELECT * FROM prospectos WHERE id = ?').get(p.id);
}
