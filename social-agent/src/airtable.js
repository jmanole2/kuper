// Disponibilidad de oficinas desde el Airtable del cliente (solo lectura). Se guarda en las credenciales del
// cliente (cifradas): { airtable: { token, base, tabla, vista } }. Cada 15 minutos se lee la vista (p. ej.
// "Disponibles") y el resultado se agrega a "Lo que sabe tu agente", que leen el agente de WhatsApp y el de llamadas.
import * as db from './db.js';
import { config } from './config.js';

export const hooks = { fetch: (...a) => fetch(...a) }; // pruebas
const CADA_MS = 15 * 60000;
const clave = (id) => `airtable:${id}`;

/** "https://airtable.com/appX/tblY/viwZ" (o con shr…) → { base, tabla, vista } */
export function leerLink(link) {
  const s = String(link || '');
  const base = /\b(app[A-Za-z0-9]{14})\b/.exec(s)?.[1], tabla = /\b(tbl[A-Za-z0-9]{14})\b/.exec(s)?.[1], vista = /\b(viw[A-Za-z0-9]{14})\b/.exec(s)?.[1];
  if (!base || !tabla) throw new Error('Pega el link de la tabla de Airtable (debe traer "app…" y "tbl…"; si quieres una vista, también "viw…").');
  return { base, tabla, vista: vista || null };
}

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N} ]/gu, '').toLowerCase().trim();
const campo = (f, ...nombres) => { const k = Object.keys(f).find((x) => nombres.some((n) => norm(x).includes(n))); return k ? f[k] : undefined; };
const texto = (v) => (Array.isArray(v) ? v.join(', ') : v == null ? '' : String(v)).trim();
const SEDES = { 'la roma': 'Roma Norte' };
const mxn = (n) => `$${Math.round(Number(n)).toLocaleString('es-MX')}`;
const fecha = (iso) => { const d = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`); return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(d); };

/** Lee todos los registros de la tabla (o de la vista). */
export async function leerRegistros({ token, base, tabla, vista }) {
  const out = [];
  let offset = '';
  for (let i = 0; i < 20; i++) {
    const qs = new URLSearchParams({ pageSize: '100', ...(vista ? { view: vista } : {}), ...(offset ? { offset } : {}) });
    const r = await hooks.fetch(`https://api.airtable.com/v0/${base}/${tabla}?${qs}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'Airtable no aceptó el token o no tiene acceso a esa base.' : r.status === 404 ? 'No encontré esa base, tabla o vista en Airtable.' : `Airtable respondió ${r.status}: ${j?.error?.message || j?.error?.type || ''}`.trim());
    out.push(...(j.records || []));
    if (!j.offset) break;
    offset = j.offset;
  }
  return out;
}

/** Registros → texto para el agente, agrupado por sede. Solo lo disponible (o que se libera). */
export function aTexto(registros, ahora = new Date()) {
  const filas = [];
  for (const r of registros) {
    const f = r.fields || {};
    const ocup = norm(texto(campo(f, 'ocupacion')));
    const libera = texto(campo(f, 'se libera'));
    if (ocup && ocup !== 'disponible' && !libera) continue; // ocupada y sin fecha de liberación
    const sedeTxt = texto(campo(f, 'ubicacion')) || 'Sin sede';
    const sede = SEDES[norm(sedeTxt)] || sedeTxt;
    const nombre = texto(campo(f, 'nombre de oficina')), num = texto(campo(f, 'no oficina'));
    const tipo = texto(campo(f, 'tipo de espacio')) || 'Oficina';
    const pax = Number(campo(f, 'capacidad')) || null, m2 = Number(campo(f, 'metro')) || null;
    const precio = Number(String(campo(f, 'ideal estrategia', 'precio') ?? '').replace(/[$,\s]/g, '')) || null;
    const cuando = ocup === 'disponible' ? 'disponible ya' : libera ? `se libera el ${fecha(libera)}` : 'disponible';
    filas.push({ sede, linea: `- ${[nombre && num ? `${nombre} (${num})` : nombre || num, tipo.toLowerCase()].filter(Boolean).join(', ')}${pax ? `, para ${pax} ${pax === 1 ? 'persona' : 'personas'}` : ''}${m2 ? `, ${m2} m²` : ''}${precio ? `, ${mxn(precio)} al mes + IVA` : ''}: ${cuando}` });
  }
  const sello = new Intl.DateTimeFormat('es-MX', { timeZone: config.timezone, dateStyle: 'medium', timeStyle: 'short' }).format(ahora);
  if (!filas.length) return `## Oficinas y puestos fijos disponibles ahora (actualizado ${sello})\nPor ahora no hay oficinas ni puestos fijos disponibles. Ofrece anotar a la persona con prioridad para cuando se libere uno de su tamaño y zona, y pásalo con un asesor.`;
  const porSede = {};
  for (const x of filas) (porSede[x.sede] ||= []).push(x.linea);
  return `## Oficinas y puestos fijos disponibles ahora (actualizado ${sello})
Esta es la ÚNICA lista de disponibilidad: solo ofrece oficinas y puestos fijos que estén aquí. La lista general de precios sirve de referencia, no dice qué está libre. Si no hay de su tamaño o zona, ofrece anotarlo con prioridad para cuando se libere y pásalo con un asesor. La visita y el apartado siempre los confirma un asesor.
${Object.entries(porSede).map(([s, l]) => `### ${s}\n${l.join('\n')}`).join('\n')}`;
}

/** Último resultado guardado: { texto, n, at, error } */
export function estado(client) {
  try { return JSON.parse(db.kvGet(clave(client.id)) || 'null'); } catch { return null; }
}
export const configurado = (client) => { try { const a = db.clientCredentials(client)?.airtable; return !!(a?.token && a?.base && a?.tabla); } catch { return false; } };

/** Lee Airtable ahora y guarda el texto. Devuelve el estado. */
export async function sincronizar(client) {
  const a = db.clientCredentials(client)?.airtable;
  if (!a?.token) return null;
  const prev = estado(client);
  try {
    const regs = await leerRegistros(a);
    const t = aTexto(regs);
    const st = { texto: t, n: (t.match(/^- /gm) || []).length, total: regs.length, at: new Date().toISOString(), error: null };
    db.kvSet(clave(client.id), JSON.stringify(st));
    return st;
  } catch (e) {
    // Si falla, se queda el último texto bueno (mejor algo de hace un rato que nada), y se anota el error.
    const st = { ...(prev || {}), error: e.message, at_error: new Date().toISOString() };
    db.kvSet(clave(client.id), JSON.stringify(st));
    return st;
  }
}

/** Texto para el agente; si ya pasaron 15 min, lo vuelve a leer en segundo plano. */
export function bloque(client) {
  if (!configurado(client)) return '';
  const st = estado(client);
  if (!st?.at || Date.now() - new Date(st.at_error || st.at).getTime() > CADA_MS) sincronizar(client).catch(() => {});
  return st?.texto || '';
}

/** Cada 15 minutos, todos los clientes con Airtable conectado. */
export function iniciar() {
  const correr = async () => { for (const c of db.listClients()) if (configurado(c)) await sincronizar(c).catch(() => {}); };
  setTimeout(correr, 30000).unref?.();
  return setInterval(correr, CADA_MS).unref?.();
}
