// Campañas de WhatsApp con segmentos y aprobación (difusión).
// 1. Segmento: los contactos del embudo que cumplen filtros (etapas, etiquetas, origen, resultado, días sin actividad).
//    Siempre se excluye a quien pidió no recibir mensajes (etiqueta "baja") y a quien ya recibió una campaña
//    en los últimos días (frecuencia), para no saturar ni arriesgar el número.
// 2. Plantilla: cuando el negocio escribe primero, Meta exige una plantilla aprobada. Se leen de la cuenta de
//    WhatsApp del cliente (si se conectó desde el panel) o se escribe el nombre a mano. Las variables {{1}}, {{2}}…
//    se llenan con datos del contacto (nombre, empresa, etapa) o con un texto fijo.
// 3. Aprobación: la campaña se crea como borrador y alguien del equipo la aprueba. Nada sale antes.
// 4. Envío escalonado: unos cuantos por minuto, solo en horario (9 a 20 h) y con tope diario (Meta empieza en 250
//    contactos al día por número). Va directo a la API de WhatsApp con el token del panel o, si no, por el agente.
import { config } from './config.js';
import * as db from './db.js';
import * as embudo from './embudo.js';
import { llamarAgente, agenteConfigurado } from './agente.js';

export const hooks = { fetch: (...a) => fetch(...a), agente: (...a) => llamarAgente(...a), ahora: () => new Date() }; // pruebas

export const ESTADOS = {
  borrador: ['Por aprobar', '#fbbf24'],
  enviando: ['Enviando', '#4ade80'],
  pausada: ['En pausa', '#a39d93'],
  terminada: ['Terminada', '#c9f53a'],
  cancelada: ['Cancelada', '#f87171'],
};
export const FUENTES = { nombre: 'Nombre del contacto', empresa: 'Empresa', etapa: 'Etapa del embudo', texto: 'Texto fijo' };
const POR_VUELTA = 15;          // mensajes por minuto
const HORAS = [9, 20];          // horario de envío (hora del cliente)
export const FRECUENCIA_DIAS = 7;
const BAJA = /^(baja|no contactar|no molestar)$/i;

let tablas = false;
const d = () => { if (!tablas) ensureTables(); return db.getDb(); };
export function ensureTables() {
  tablas = true;
  db.getDb().exec(`CREATE TABLE IF NOT EXISTS difusiones (
    id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL, filtros_json TEXT NOT NULL, plantilla TEXT NOT NULL, idioma TEXT NOT NULL DEFAULT 'es_MX',
    cuerpo TEXT, variables_json TEXT NOT NULL DEFAULT '[]', tope_diario INTEGER NOT NULL DEFAULT 250,
    estado TEXT NOT NULL DEFAULT 'borrador', creada_por TEXT, aprobada_por TEXT, aprobada_at TEXT, error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS difusion_envios (
    difusion_id INTEGER NOT NULL REFERENCES difusiones(id) ON DELETE CASCADE, lead_id INTEGER NOT NULL,
    telefono TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pendiente', error TEXT, enviado_at TEXT,
    PRIMARY KEY (difusion_id, lead_id));
  CREATE INDEX IF NOT EXISTS difusion_envios_lead ON difusion_envios(lead_id, enviado_at);`);
}

// ------------------------------------------------------------ segmentos
const dias = (t, ahora) => (t ? (ahora - new Date(String(t).replace(' ', 'T') + (String(t).includes('Z') ? '' : 'Z'))) / 86400000 : Infinity);
export function limpiarFiltros(f = {}) {
  const lista = (x) => (Array.isArray(x) ? x : String(x || '').split(',')).map((s) => String(s).trim()).filter(Boolean).slice(0, 30);
  const num = (x) => (x === '' || x === undefined || x === null || !Number.isFinite(Number(x)) ? null : Math.max(0, Math.round(Number(x))));
  return { embudo: String(f.embudo || '').slice(0, 60), etapas: lista(f.etapas), tags: lista(f.tags).map((t) => t.toLowerCase()), origen: String(f.origen || '').slice(0, 30),
    resultado: String(f.resultado || '').slice(0, 20), sin_actividad: num(f.sin_actividad), max_dias: num(f.max_dias) };
}

/** Contactos con WhatsApp que cumplen los filtros (y no están excluidos). */
export function segmento(client, filtros, { ahora = hooks.ahora() } = {}) {
  const f = limpiarFiltros(filtros);
  const recientes = new Set(d().prepare(`SELECT DISTINCT e.lead_id FROM difusion_envios e JOIN difusiones x ON x.id = e.difusion_id
    WHERE x.client_id = ? AND e.status = 'enviado' AND datetime(e.enviado_at) >= datetime('now', ?)`).all(client.id, `-${FRECUENCIA_DIAS} days`).map((r) => r.lead_id));
  const out = { leads: [], excluidos: { sin_whatsapp: 0, baja: 0, recientes: 0 } };
  for (const l of db.listLeads(client.id, { limit: 100000 })) {
    if (f.embudo && (embudo.embudoDe(client, l)?.id !== f.embudo)) continue;
    if (f.etapas.length && !f.etapas.includes(embudo.etapaDe(client, l)?.id)) continue;
    const tags = embudo.tagsDe(l).map((t) => String(t).toLowerCase());
    if (f.tags.length && !f.tags.some((t) => tags.includes(t))) continue;
    if (f.origen && l.origen !== f.origen) continue;
    if (f.resultado && (l.resultado || 'abierto') !== f.resultado) continue;
    if (f.sin_actividad !== null && dias(l.updated_at, ahora) < f.sin_actividad) continue;
    if (f.max_dias !== null && dias(l.created_at, ahora) > f.max_dias) continue;
    if (!l.telefono || String(l.telefono).replace(/\D/g, '').length < 10) { out.excluidos.sin_whatsapp++; continue; }
    if (tags.some((t) => BAJA.test(t))) { out.excluidos.baja++; continue; }
    if (recientes.has(l.id)) { out.excluidos.recientes++; continue; }
    out.leads.push(l);
  }
  return out;
}

// ------------------------------------------------------------ plantillas
const wa = (client) => db.clientCredentials(client).whatsapp || {};
export const directo = (client) => Boolean(wa(client).token && wa(client).phone_id);
const graph = () => `https://graph.facebook.com/${config.whatsappApp?.graph || 'v23.0'}`;

/** Plantillas aprobadas de la cuenta de WhatsApp del cliente (si se conectó desde el panel). */
export async function plantillas(client) {
  const w = wa(client);
  if (!w.token || !w.waba_id) return null;
  const r = await hooks.fetch(`${graph()}/${w.waba_id}/message_templates?fields=name,language,status,category,components&limit=100`, { headers: { Authorization: `Bearer ${w.token}` }, signal: AbortSignal.timeout(15000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error?.message || `Meta respondió ${r.status}`);
  return (j.data || []).filter((t) => t.status === 'APPROVED').map((t) => ({ nombre: t.name, idioma: t.language, categoria: t.category,
    cuerpo: (t.components || []).find((c) => c.type === 'BODY')?.text || '' }));
}
export const cuantasVariables = (cuerpo) => Math.max(0, ...[...String(cuerpo || '').matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])));

const primerNombre = (n) => String(n || '').trim().split(/\s+/)[0] || '';
/** Valores de las variables para un contacto. variables: [{ fuente, texto }] */
export function valores(client, lead, variables) {
  return (variables || []).map((v) => {
    const x = v.fuente === 'nombre' ? primerNombre(lead.nombre) : v.fuente === 'empresa' ? lead.empresa : v.fuente === 'etapa' ? embudo.etapaDe(client, lead)?.nombre : v.texto;
    return String(x || v.respaldo || (v.fuente === 'nombre' ? 'hola' : '')).slice(0, 60);
  });
}
export const render = (cuerpo, vals) => String(cuerpo || '').replace(/\{\{(\d+)\}\}/g, (_, n) => vals[Number(n) - 1] ?? `{{${n}}}`);

// ------------------------------------------------------------ campañas
const fila = (r) => (r ? { ...r, filtros: JSON.parse(r.filtros_json || '{}'), variables: JSON.parse(r.variables_json || '[]') } : null);
export const obtener = (clientId, id) => fila(d().prepare('SELECT * FROM difusiones WHERE client_id = ? AND id = ?').get(clientId, Number(id)));
export function listar(clientId) {
  return d().prepare('SELECT * FROM difusiones WHERE client_id = ? ORDER BY id DESC LIMIT 50').all(clientId).map((r) => ({ ...fila(r), ...metricas(r.id) }));
}
export function metricas(id) {
  const c = Object.fromEntries(d().prepare('SELECT status, COUNT(*) n FROM difusion_envios WHERE difusion_id = ? GROUP BY status').all(id).map((r) => [r.status, r.n]));
  const respondieron = d().prepare(`SELECT COUNT(DISTINCT e.lead_id) n FROM difusion_envios e JOIN lead_mensajes m ON m.lead_id = e.lead_id
    WHERE e.difusion_id = ? AND e.status = 'enviado' AND m.rol = 'lead' AND datetime(m.created_at) >= datetime(e.enviado_at)`).get(id).n;
  const total = Object.values(c).reduce((a, n) => a + n, 0);
  return { total, pendientes: c.pendiente || 0, enviados: c.enviado || 0, errores: c.error || 0, respondieron };
}

export function crear(client, b, autor) {
  const nombre = String(b.nombre || '').trim().slice(0, 80);
  const plantilla = String(b.plantilla || '').trim().replace(/\s+/g, '_').toLowerCase().slice(0, 120);
  if (!nombre) throw new Error('Ponle nombre a la campaña.');
  if (!/^[a-z0-9_]+$/.test(plantilla)) throw new Error('Elige la plantilla aprobada de WhatsApp (nombre en minúsculas, sin espacios).');
  const filtros = limpiarFiltros(b.filtros || b);
  const seg = segmento(client, filtros);
  if (!seg.leads.length) throw new Error('El segmento no tiene contactos con WhatsApp. Ajusta los filtros.');
  const cuerpo = String(b.cuerpo || '').slice(0, 1024);
  const n = Math.max(cuantasVariables(cuerpo), (b.variables || []).length);
  const variables = Array.from({ length: n }, (_, i) => {
    const v = (b.variables || [])[i] || {};
    return { fuente: FUENTES[v.fuente] ? v.fuente : 'texto', texto: String(v.texto || '').slice(0, 60) };
  });
  const tope = Math.min(10000, Math.max(1, Number(b.tope_diario) || 250));
  const r = d().prepare(`INSERT INTO difusiones (client_id, nombre, filtros_json, plantilla, idioma, cuerpo, variables_json, tope_diario, creada_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(client.id, nombre, JSON.stringify(filtros), plantilla, String(b.idioma || 'es_MX').slice(0, 10), cuerpo, JSON.stringify(variables), tope, autor || null);
  const id = Number(r.lastInsertRowid);
  const ins = d().prepare('INSERT OR IGNORE INTO difusion_envios (difusion_id, lead_id, telefono) VALUES (?, ?, ?)');
  d().exec('BEGIN');
  try { for (const l of seg.leads) ins.run(id, l.id, String(l.telefono).replace(/\D/g, '')); d().exec('COMMIT'); } catch (e) { d().exec('ROLLBACK'); throw e; }
  db.logEvent({ clientId: client.id, tipo: 'difusion_creada', detalle: `${nombre}: ${seg.leads.length} contactos (por aprobar)` });
  return obtener(client.id, id);
}

export function cambiarEstado(client, id, accion, autor) {
  const c = obtener(client.id, id);
  if (!c) throw new Error('Campaña no encontrada.');
  const pasa = { aprobar: [['borrador'], 'enviando'], pausar: [['enviando'], 'pausada'], reanudar: [['pausada'], 'enviando'], cancelar: [['borrador', 'enviando', 'pausada'], 'cancelada'] }[accion];
  if (!pasa || !pasa[0].includes(c.estado)) throw new Error('Esa acción no aplica a esta campaña.');
  d().prepare(`UPDATE difusiones SET estado = ?, updated_at = datetime('now')${accion === 'aprobar' ? ", aprobada_por = ?, aprobada_at = datetime('now')" : ''} WHERE id = ?`)
    .run(...[pasa[1], ...(accion === 'aprobar' ? [autor || null] : []), c.id]);
  db.logEvent({ clientId: client.id, tipo: `difusion_${accion}`, detalle: `${c.nombre} · ${autor || ''}` });
  return obtener(client.id, id);
}

// ------------------------------------------------------------ envío
const horaLocal = (t) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: config.timezone || 'America/Mexico_City', hour: '2-digit', hour12: false }).format(t));
async function mandar(client, camp, lead, tel) {
  const vals = valores(client, lead, camp.variables);
  const components = vals.length ? [{ type: 'body', parameters: vals.map((t) => ({ type: 'text', text: t })) }] : [];
  const texto = camp.cuerpo ? render(camp.cuerpo, vals) : `[plantilla ${camp.plantilla}${vals.length ? `: ${vals.join(' | ')}` : ''}]`;
  if (directo(client)) {
    const w = wa(client);
    const r = await hooks.fetch(`${graph()}/${w.phone_id}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${w.token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ messaging_product: 'whatsapp', to: tel, type: 'template', template: { name: camp.plantilla, language: { code: camp.idioma }, components } }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error?.message || `Meta respondió ${r.status}`);
  } else if (agenteConfigurado(client)) {
    await hooks.agente(client, 'POST', '/plantilla', { telefono: tel, nombre: camp.plantilla, idioma: camp.idioma, parametros: vals, memo: texto });
  } else throw new Error('Esta marca no tiene WhatsApp conectado.');
  try { d().prepare("INSERT INTO lead_mensajes (lead_id, rol, texto, autor) VALUES (?, 'agente', ?, ?)").run(lead.id, texto.slice(0, 2000), `Campaña: ${camp.nombre}`.slice(0, 80)); } catch { /* historial opcional */ }
}

/** Una vuelta del envío: pocas por minuto, en horario y sin pasar el tope del día. */
export async function enviarPendientes(client, { ahora = hooks.ahora() } = {}) {
  const h = horaLocal(ahora);
  if (h < HORAS[0] || h >= HORAS[1]) return { enviados: 0, fuera_de_horario: true };
  let enviados = 0;
  for (const camp of d().prepare("SELECT * FROM difusiones WHERE client_id = ? AND estado = 'enviando' ORDER BY id").all(client.id).map(fila)) {
    const hoy = d().prepare("SELECT COUNT(*) n FROM difusion_envios WHERE difusion_id = ? AND status = 'enviado' AND date(enviado_at) = date('now')").get(camp.id).n;
    const cupo = Math.min(POR_VUELTA - enviados, camp.tope_diario - hoy);
    if (cupo <= 0) continue;
    const pendientes = d().prepare("SELECT * FROM difusion_envios WHERE difusion_id = ? AND status = 'pendiente' LIMIT ?").all(camp.id, cupo);
    if (!pendientes.length) {
      d().prepare("UPDATE difusiones SET estado = 'terminada', updated_at = datetime('now') WHERE id = ?").run(camp.id);
      db.logEvent({ clientId: client.id, tipo: 'difusion_terminada', detalle: camp.nombre });
      continue;
    }
    let seguidos = 0;
    for (const e of pendientes) {
      const lead = db.getLead(client.id, e.lead_id);
      const marca = (status, error = null) => d().prepare("UPDATE difusion_envios SET status = ?, error = ?, enviado_at = datetime('now') WHERE difusion_id = ? AND lead_id = ?").run(status, error, camp.id, e.lead_id);
      if (!lead || embudo.tagsDe(lead).some((t) => BAJA.test(t))) { marca('omitido'); continue; }
      try { await mandar(client, camp, lead, e.telefono); marca('enviado'); enviados++; seguidos = 0; }
      catch (err) {
        marca('error', String(err.message).slice(0, 300));
        // Si fallan varios seguidos (plantilla inválida, token vencido…), se pausa para no quemar la lista.
        if (++seguidos >= 3) {
          d().prepare("UPDATE difusiones SET estado = 'pausada', error = ?, updated_at = datetime('now') WHERE id = ?").run(String(err.message).slice(0, 300), camp.id);
          db.logEvent({ clientId: client.id, tipo: 'difusion_error', detalle: `${camp.nombre}: en pausa por errores (${err.message})` });
          break;
        }
      }
    }
  }
  return { enviados };
}

/** Reintentar los que fallaron (después de corregir la plantilla o el token). */
export function reintentarErrores(client, id) {
  const c = obtener(client.id, id);
  if (!c) throw new Error('Campaña no encontrada.');
  const n = d().prepare("UPDATE difusion_envios SET status = 'pendiente', error = NULL WHERE difusion_id = ? AND status = 'error'").run(c.id).changes;
  d().prepare("UPDATE difusiones SET error = NULL WHERE id = ?").run(c.id);
  return n;
}
