// Disponibilidad de oficinas desde el Airtable del cliente (solo lectura). Se guarda en las credenciales del
// cliente (cifradas): { airtable: { token, base, tabla, vista } }. Cada 15 minutos se lee la vista (p. ej.
// "Disponibles") y el resultado se agrega a "Lo que sabe tu agente", que leen el agente de WhatsApp y el de llamadas.
import * as db from './db.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config, mediaDir, mediaUrl } from './config.js';

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

// ------------------------------------------------------------ fotos
// Campos de "Adjunto" de Airtable con imágenes. Los de la sucursal (nombre con sucursal/sede/edificio/ubicación)
// son fotos de la sede; los demás, de la oficina. Los links de Airtable caducan en unas horas, así que se guarda
// una copia en /media (pública, con nombre imposible de adivinar) y eso es lo que manda el agente.
const ES_SEDE = /sucursal|sede|edificio|ubicacion|instalaciones|areas comunes/;
const adjuntos = (f, de) => Object.entries(f).filter(([k, v]) => Array.isArray(v) && v.some((a) => a?.url && /^image\//.test(a.type || '')) && (de === 'sede') === ES_SEDE.test(norm(k)))
  .flatMap(([, v]) => v.filter((a) => a?.url && /^image\/(jpeg|png|webp)$/.test(a.type || '')));
const nombreFoto = (a) => `of-${crypto.createHash('sha256').update(`${config.secretKey || ''}:${a.id || a.url}`).digest('hex').slice(0, 24)}.${a.type === 'image/png' ? 'png' : a.type === 'image/webp' ? 'webp' : 'jpg'}`;
function fotosDe(f, de) { return adjuntos(f, de).slice(0, 6).map((a) => ({ archivo: nombreFoto(a), url: a.url, nombre: a.filename || '' })); }
/** Baja las fotos que aún no tenemos (máx. 8 MB cada una). Las que fallen se omiten. */
export async function guardarFotos(lista) {
  fs.mkdirSync(mediaDir(), { recursive: true });
  for (const x of lista) {
    const destino = path.join(mediaDir(), x.archivo);
    if (fs.existsSync(destino)) continue;
    try {
      const r = await hooks.fetch(x.url, { signal: AbortSignal.timeout(20000) });
      const buf = Buffer.from(await r.arrayBuffer());
      if (r.ok && buf.length > 0 && buf.length <= 8 * 1024 * 1024) fs.writeFileSync(destino, buf);
    } catch { /* se intenta en la siguiente lectura */ }
  }
}
const publicas = (lista) => lista.filter((x) => fs.existsSync(path.join(mediaDir(), x.archivo))).map((x) => mediaUrl(x.archivo));

/** Registros → texto para el agente, agrupado por sede. Solo lo disponible (o que se libera). */
export function aTexto(registros, ahora = new Date(), { soloFilas = false } = {}) {
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
    const desc = texto(campo(f, 'descripcion')).replace(/\s+/g, ' ').slice(0, 300), caract = texto(campo(f, 'caracteristicas', 'amenidades')).replace(/\s+/g, ' ').slice(0, 300);
    filas.push({ id: r.id, sede, nombre: nombre || num, num, descripcion: desc, caracteristicas: caract, fotos: fotosDe(f, 'oficina'), tipo: /puesto/i.test(tipo) ? 'puesto fijo' : 'oficina privada', pax, m2, precio, libre_ya: ocup === 'disponible', se_libera: ocup === 'disponible' ? null : libera.slice(0, 10) || null, linea: `- ${[nombre && num ? `${nombre} (${num})` : nombre || num, tipo.toLowerCase()].filter(Boolean).join(', ')}${pax ? `, para ${pax} ${pax === 1 ? 'persona' : 'personas'}` : ''}${m2 ? `, ${m2} m²` : ''}${precio ? `, ${mxn(precio)} al mes + IVA` : ''}: ${cuando}${caract || desc ? `. ${[caract && `Características: ${caract}`, desc].filter(Boolean).join('. ').slice(0, 220)}` : ''}` });
  }
  if (soloFilas) return filas.map(({ linea, ...x }) => ({ ...x, texto: linea.replace(/^- /, '') }));
  const sello = new Intl.DateTimeFormat('es-MX', { timeZone: config.timezone, dateStyle: 'medium', timeStyle: 'short' }).format(ahora);
  if (!filas.length) return `## Oficinas y puestos fijos disponibles ahora (actualizado ${sello})\nPor ahora no hay oficinas ni puestos fijos disponibles. Si preguntan precios, da los de referencia de la lista general, aclara que hoy no hay disponible, ofrece anotarlos con prioridad para cuando se libere uno de su tamaño y zona, y pásalo con un asesor.`;
  const porSede = {};
  for (const x of filas) (porSede[x.sede] ||= []).push(x.linea);
  return `## Oficinas y puestos fijos disponibles ahora (actualizado ${sello})
Esta lista manda sobre la disponibilidad: ofrece como disponibles solo las oficinas y puestos fijos que estén aquí, con el precio que trae aquí. La lista general de precios (más arriba) sigue sirviendo de respaldo: si una oficina de aquí no trae precio, usa el de referencia; y si preguntan por el precio de algo que no está en esta lista, dales el precio de referencia, aclara que hoy no hay disponible y ofrece anotarlos con prioridad para cuando se libere, y pásalo con un asesor. La visita y el apartado siempre los confirma un asesor.
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
    const items = aTexto(regs, new Date(), { soloFilas: true });
    // Fotos de cada sede (de cualquier registro, aunque la oficina esté ocupada) y de cada oficina disponible.
    const sedesFotos = {};
    for (const r of regs) { const f = r.fields || {}; const s = texto(campo(f, 'ubicacion')); if (!s) continue; const k = SEDES[norm(s)] || s; for (const x of fotosDe(f, 'sede')) if (!(sedesFotos[k] ||= []).some((y) => y.archivo === x.archivo) && sedesFotos[k].length < 6) sedesFotos[k].push(x); }
    await guardarFotos([...items.flatMap((x) => x.fotos || []), ...Object.values(sedesFotos).flat()]);
    for (const x of items) x.fotos = publicas(x.fotos || []);
    const fotos_sede = Object.fromEntries(Object.entries(sedesFotos).map(([k, v]) => [k, publicas(v)]).filter(([, v]) => v.length));
    const st = { texto: t, items, fotos_sede, n: (t.match(/^- /gm) || []).length, total: regs.length, at: new Date().toISOString(), error: null };
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

const n2 = (x) => norm(x).replace(/\s+/g, ' ');
const ALIAS_SEDE = { roma: 'roma norte', 'la roma': 'roma norte', hundido: 'parque hundido', borja: 'san borja', 'insurgentes san borja': 'san borja', valle: 'del valle' };
/** Lo que el agente pregunta en el momento: ¿qué hay libre? Filtra por sede, personas y tipo. */
export function consultar(client, { sede = '', personas = 0, tipo = '' } = {}) {
  if (!configurado(client)) return { conectado: false, resultado: 'No hay un sistema de disponibilidad conectado: no digas que hay o que no hay lugar; ofrece que un asesor lo confirme.' };
  bloque(client); // si ya pasaron 15 minutos, se vuelve a leer en segundo plano
  const st = estado(client);
  const items = Array.isArray(st?.items) ? st.items : [];
  let s = n2(sede); s = ALIAS_SEDE[s] || s;
  const p = Number(personas) || 0;
  const t = /puesto/i.test(tipo) ? 'puesto fijo' : /oficina/i.test(tipo) ? 'oficina privada' : '';
  const enSede = (x) => !s || n2(x.sede).includes(s) || s.includes(n2(x.sede));
  const cabe = (x) => !p || (x.pax || 0) >= p;
  const del = (x) => !t || x.tipo === t;
  const exactas = items.filter((x) => enSede(x) && cabe(x) && del(x)).sort((a, b) => (a.pax || 0) - (b.pax || 0));
  const otras = exactas.length || !s ? [] : items.filter((x) => cabe(x) && del(x)).sort((a, b) => (a.pax || 0) - (b.pax || 0)).slice(0, 4);
  const linea = (x) => `${x.sede}: ${x.texto}`;
  const hace = st?.at ? Math.round((Date.now() - new Date(st.at).getTime()) / 60000) : null;
  const resultado = exactas.length
    ? `Disponibles que cumplen lo que pidió (dato real, actualizado hace ${hace ?? '?'} min):\n${exactas.slice(0, 6).map(linea).join('\n')}`
    : `NO hay disponibilidad${s ? ` en ${sede}` : ''}${p ? ` para ${p} personas` : ''}${t ? ` (${t})` : ''} en este momento. Díselo con claridad, ofrece anotarlo con prioridad para cuando se libere y pásalo con un asesor.${otras.length ? `\nAlternativas disponibles en otras sedes:\n${otras.map(linea).join('\n')}` : ''}`;
  const conFotos = (x) => (x.fotos?.length ? ` [con fotos]` : '');
  const resFotos = exactas.some((x) => x.fotos?.length) ? '\nPor chat: si le interesa una opción [con fotos], ofrécele mandárselas (enviar_fotos con el nombre de la oficina). Por teléfono: descríbela con sus características y ofrece mandarle las fotos por WhatsApp.' : '';
  return { conectado: true, actualizado: st?.at || null, opciones: exactas.slice(0, 6).map((x) => ({ ...x, texto: x.texto + conFotos(x) })), alternativas: otras, resultado: resultado + resFotos };
}

/** Fotos para mandar por WhatsApp: de una oficina (por nombre o número) o de una sede. */
export function fotos(client, { oficina = '', sede = '' } = {}) {
  const st = estado(client);
  const items = Array.isArray(st?.items) ? st.items : [];
  const o = n2(oficina);
  let s = n2(sede); s = ALIAS_SEDE[s] || s;
  if (o) {
    const x = items.find((i) => [i.nombre, i.num, `${i.nombre} ${i.num}`].some((v) => v && (n2(v) === o || n2(v).includes(o) || o.includes(n2(v)))) && (!s || n2(i.sede).includes(s)));
    if (x) return { encontrada: true, titulo: `${x.nombre}${x.num && x.num !== x.nombre ? ` (${x.num})` : ''} · ${x.sede}`, fotos: (x.fotos || []).slice(0, 6), descripcion: x.descripcion || '', caracteristicas: x.caracteristicas || '' };
  }
  if (s) {
    const k = Object.keys(st?.fotos_sede || {}).find((n) => n2(n).includes(s) || s.includes(n2(n)));
    if (k) return { encontrada: true, titulo: `Sucursal ${k}`, fotos: st.fotos_sede[k].slice(0, 6) };
  }
  return { encontrada: false, fotos: [], resultado: 'No encontré fotos de eso. Ofrece agendar una visita para que la conozca.' };
}
