// "Haz tu demo gratis" (kuper.media/demo): la persona pega el link de su negocio (o lo describe), leemos su página,
// la IA arma la información y en segundos puede hablar con Sofía como si fuera la recepcionista de SU negocio:
// llamada de voz (máximo 1 minuto, una por demo) y chat con estilo de WhatsApp (máximo 20 mensajes).
//
// - Un solo agente de Retell ("Demo instantánea Kuper", demos/instantanea.json) recibe los datos del negocio en
//   cada llamada como variables: no se crea un agente por visitante.
// - Cada demo dura 7 días y se guarda en datos/instantaneas/<id>.json.
// - La lectura de la página está protegida: solo http(s), nada de direcciones internas, redirecciones revisadas,
//   tamaño y tiempo máximos.
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { pedirJSON } from './chat.mjs';

export const hooks = { fetch: (...a) => fetch(...a), lookup: (h) => lookup(h, { all: true }), ia: (...a) => pedirJSON(...a) }; // pruebas
export const LIMITES = { llamadas: 1, segundos: 60, mensajes: 20, dias: 7 };
const MAX_BYTES = 1_500_000, MAX_TEXTO = 14000;

// ------------------------------------------------------------ leer la página (sin SSRF)
const privada = (ip) => {
  if (isIP(ip) === 6) {
    const x = ip.toLowerCase();
    if (x.startsWith('::ffff:')) return privada(x.slice(7));
    return x === '::1' || x === '::' || /^f[cd]/.test(x) || /^fe[89ab]/.test(x);
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127) || a >= 224;
};
export function normalizarUrl(entrada) {
  let s = String(entrada || '').trim();
  if (!s) return null;
  if (/^@[\w.]+$/.test(s)) s = `https://www.instagram.com/${s.slice(1)}`;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.') || u.username || u.password) return null;
  if (u.port && !['80', '443'].includes(u.port)) return null;
  return u;
}
async function seguro(u) {
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error('direccion_no_permitida');
  const ips = isIP(host) ? [{ address: host }] : await hooks.lookup(host);
  if (!ips.length || ips.some((x) => privada(x.address))) throw new Error('direccion_no_permitida');
}
/** Descarga una página HTML revisando cada redirección. */
export async function descargar(urlInicial) {
  let u = urlInicial;
  for (let i = 0; i < 4; i++) {
    await seguro(u);
    const r = await hooks.fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(9000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KuperDemo/1.0)', Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'es-MX,es;q=0.9' } });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { u = new URL(r.headers.get('location'), u); if (!/^https?:$/.test(u.protocol)) throw new Error('direccion_no_permitida'); continue; }
    if (!r.ok) throw new Error(`pagina_${r.status}`);
    if (!/html|text\/plain/i.test(r.headers.get('content-type') || 'text/html')) throw new Error('no_es_pagina');
    const lector = r.body?.getReader?.();
    if (!lector) return { url: u, html: (await r.text()).slice(0, MAX_BYTES) };
    const partes = []; let n = 0;
    for (;;) { const { done, value } = await lector.read(); if (done) break; n += value.length; partes.push(value); if (n > MAX_BYTES) { lector.cancel().catch(() => {}); break; } }
    return { url: u, html: Buffer.concat(partes.map((x) => Buffer.from(x))).toString('utf8') };
  }
  throw new Error('demasiadas_redirecciones');
}

const ent = (s) => String(s).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const meta = (html, re) => { const m = html.match(re); return m ? ent(m[1]).trim() : ''; };
/** Texto visible, título, descripción, logo y links internos útiles. */
export function extraer(html, base) {
  const titulo = meta(html, /<title[^>]*>([^<]{1,200})/i);
  const desc = meta(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,400})/i) || meta(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{1,400})/i);
  const sitio = meta(html, /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']{1,120})/i);
  const abs = (x) => { if (!x) return ''; try { const v = new URL(ent(x), base); return /^https?:$/.test(v.protocol) ? v.href : ''; } catch { return ''; } };
  const icono = html.match(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)/i)?.[1] || html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)/i)?.[1];
  const logoImg = html.match(/<img[^>]+(?:class|id|alt|src)=["'][^"']*logo[^"']*["'][^>]*>/i)?.[0]?.match(/src=["']([^"']+)/i)?.[1];
  const og = meta(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i);
  const texto = ent(html.replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/section)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .replace(/[ \t\r\f\v]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  const internos = [...html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi)]
    .map(([, h, t]) => ({ url: abs(h), t: ent(t.replace(/<[^>]+>/g, '')).toLowerCase() }))
    .filter((x) => x.url && new URL(x.url).hostname === base.hostname && /contact|servicio|precio|nosotros|about|menu|menú|tarifa|productos|ubicaci|sucursal/i.test(`${x.url} ${x.t}`))
    .map((x) => x.url);
  return { titulo, desc, sitio, logo: abs(logoImg || '') || abs(icono || '') || abs(og || ''), texto, internos: [...new Set(internos)].slice(0, 2) };
}

/** Lee la página principal y hasta dos internas (contacto, servicios…). */
export async function leerSitio(url) {
  const p = await descargar(url);
  const e = extraer(p.html, p.url);
  const extras = await Promise.allSettled(e.internos.map(async (x) => extraer((await descargar(new URL(x))).html, new URL(x)).texto.slice(0, 4000)));
  const texto = [e.texto, ...extras.filter((x) => x.status === 'fulfilled').map((x) => x.value)].join('\n\n').slice(0, MAX_TEXTO);
  return { ...e, texto, url: p.url.href };
}

// ------------------------------------------------------------ armar la información del negocio
const SISTEMA = `Recibes el texto de la página web de un negocio (o lo que el dueño escribió de su negocio) y armas la información
para una recepcionista virtual que contestará su teléfono y su WhatsApp. Responde SOLO un objeto JSON con:
{"es_negocio": true|false, "negocio": "nombre comercial", "giro": "qué hace, en una frase", "servicios": ["servicio o producto con precio si aparece", ...máximo 10],
 "horario": "horario de atención si aparece, si no ''", "ubicacion": "dirección o zona si aparece, si no ''", "contacto": "teléfono, WhatsApp o correo si aparecen, si no ''",
 "preguntas_frecuentes": ["Pregunta corta: respuesta corta", ...máximo 6], "tipo_de_cita": "el siguiente paso natural (agendar una cita, una visita, una cotización, tomar un pedido…)",
 "tono": "de usted o de tú, según el negocio", "idioma": "es"}
Reglas: usa solo lo que está en el texto, no inventes precios ni datos. Escribe en español de México, frases cortas.
Si el texto no es de un negocio (página vacía, error, contenido para adultos, apuestas, armas, drogas o algo ilegal), responde {"es_negocio": false}.`;

export async function armarNegocio({ sitio = null, descripcion = '', env = process.env }) {
  const texto = [sitio ? `URL: ${sitio.url}\nTítulo: ${sitio.titulo}\nDescripción: ${sitio.desc}\nNombre del sitio: ${sitio.sitio}\n\n${sitio.texto}` : '',
    descripcion ? `Lo que escribió el dueño:\n${String(descripcion).slice(0, 2000)}` : ''].filter(Boolean).join('\n\n');
  const d = await hooks.ia({ system: SISTEMA, texto, env, maxTokens: 1800 });
  if (!d || d.es_negocio === false || !String(d.negocio || '').trim()) throw new Error('no_es_negocio');
  const lista = (x, n) => (Array.isArray(x) ? x : []).map((s) => String(s).trim().slice(0, 240)).filter(Boolean).slice(0, n);
  return { negocio: String(d.negocio).trim().slice(0, 80), giro: String(d.giro || '').trim().slice(0, 240) || 'negocio', servicios: lista(d.servicios, 10),
    horario: String(d.horario || '').trim().slice(0, 160), ubicacion: String(d.ubicacion || '').trim().slice(0, 200), contacto: String(d.contacto || '').trim().slice(0, 160),
    preguntas_frecuentes: lista(d.preguntas_frecuentes, 6), tipo_de_cita: String(d.tipo_de_cita || '').trim().slice(0, 160) || 'que una persona del equipo le contacte',
    tono: /tú|tu\b/i.test(String(d.tono || '')) ? 'de tú' : 'de usted' };
}

// ------------------------------------------------------------ guardar
export function almacen(dir) {
  mkdirSync(dir, { recursive: true });
  const ruta = (id) => join(dir, `${id}.json`);
  const limpiarViejas = () => {
    const limite = Date.now() - LIMITES.dias * 86400000;
    for (const f of readdirSync(dir)) { const p = join(dir, f); try { if (statSync(p).mtimeMs < limite) unlinkSync(p); } catch { /* ya no está */ } }
  };
  return {
    crear(datos) {
      limpiarViejas();
      const id = randomBytes(6).toString('base64url');
      const inst = { id, creada: new Date().toISOString(), llamadas: 0, mensajes: 0, ...datos };
      writeFileSync(ruta(id), JSON.stringify(inst));
      return inst;
    },
    leer(id) {
      if (!/^[\w-]{6,16}$/.test(String(id || ''))) return null;
      if (!existsSync(ruta(id))) return null;
      const inst = JSON.parse(readFileSync(ruta(id), 'utf8'));
      return Date.now() - new Date(inst.creada) > LIMITES.dias * 86400000 ? null : inst;
    },
    guardar(inst) { writeFileSync(ruta(inst.id), JSON.stringify(inst)); },
  };
}

// ------------------------------------------------------------ usarla en la llamada y el chat
const lineas = (xs) => (xs.length ? xs.join('\n- ') : 'Información general del negocio');
/** Variables de Retell para el agente "Demo instantánea Kuper". */
export function variables(inst) {
  const n = inst.negocio;
  return {
    negocio: n.negocio, giro: `${n.giro}${n.ubicacion ? `. Ubicación: ${n.ubicacion}` : ''}${n.contacto ? `. Contacto: ${n.contacto}` : ''}`,
    servicios: lineas(n.servicios), horario: n.horario || 'el horario lo confirma el equipo', preguntas: lineas(n.preguntas_frecuentes), tipo_de_cita: n.tipo_de_cita,
    saludo: `Hola, gracias por llamar a ${n.negocio}, le atiende Sofía, asistente virtual. ¿En qué le puedo ayudar?`,
  };
}
/** Configuración tipo demos/*.json para el chat (promptChat). */
export function cfgChat(inst, base) {
  const n = inst.negocio;
  return { ...base, negocio: n.negocio, asistente: 'Sofía', giro: variables(inst).giro, servicios: n.servicios.length ? n.servicios : ['Información general del negocio'],
    horario: n.horario || 'el horario lo confirma el equipo', preguntas_frecuentes: n.preguntas_frecuentes.length ? n.preguntas_frecuentes : ['Sin preguntas frecuentes cargadas'],
    tipo_de_cita: n.tipo_de_cita, instrucciones: String(base.instrucciones || '').replaceAll('{{negocio}}', n.negocio).replaceAll('{{tipo_de_cita}}', n.tipo_de_cita)
      .replace('de usted.', `${n.tono}.`) };
}
