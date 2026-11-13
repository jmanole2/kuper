// Lee la página web de un negocio (para armar "Lo que sabe tu agente"). Protegido contra direcciones internas:
// solo http(s), puertos 80/443, cada redirección revisada, tamaño y tiempo máximos. Viene de la demo gratis.
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import * as conocimiento from './conocimiento.js';
import { pedirJSON } from './llm/proveedor.js';

export const hooks = { fetch: (...a) => fetch(...a), lookup: (h) => lookup(h, { all: true }), ia: (...a) => pedirJSON(...a) }; // pruebas
const MAX_BYTES = 1_500_000, MAX_TEXTO = 40000;

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
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KuperPanel/1.0)', Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'es-MX,es;q=0.9' } });
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
    .filter((x) => x.url && new URL(x.url).hostname === base.hostname && /contact|servicio|precio|nosotros|about|menu|menú|tarifa|productos|ubicaci|sucursal|faq|preguntas|horario|planes|paquete|cursos|carrera|eventos/i.test(`${x.url} ${x.t}`))
    .map((x) => x.url);
  return { titulo, desc, sitio, logo: abs(logoImg || '') || abs(icono || '') || abs(og || ''), texto, internos: [...new Set(internos)].slice(0, 6) };
}

/** Lee la página principal y hasta dos internas (contacto, servicios…). */
export async function leerSitio(url) {
  const p = await descargar(url);
  const e = extraer(p.html, p.url);
  const extras = await Promise.allSettled(e.internos.map(async (x) => extraer((await descargar(new URL(x))).html, new URL(x)).texto.slice(0, 6000)));
  const texto = [e.texto, ...extras.filter((x) => x.status === 'fulfilled').map((x) => x.value)].join('\n\n').slice(0, MAX_TEXTO);
  return { ...e, texto, url: p.url.href };
}

// ------------------------------------------------------------ borrador de "Lo que sabe tu agente"
const SISTEMA = `Con el texto de la página web de un negocio, escribe la base de conocimiento de su agente de atención (WhatsApp, Instagram, llamadas).
Formato Markdown con estas secciones, en español de México, frases cortas y claras:
# Lo que tu agente sabe de tu negocio
## Quiénes somos
## Servicios y precios   (cada servicio o producto con su precio si aparece; si no aparece, "se cotiza")
## Horarios y ubicación  (sucursales, direcciones, cómo llegar, si aparecen)
## Cómo comprar, agendar o contratar
## Preguntas frecuentes  (las que se desprendan del sitio: "- ¿…? Respuesta")
## Contacto con una persona
## Reglas
- No inventes precios, plazos ni promociones que no estén aquí. Si no sabes algo, dilo y ofrece que una persona lo confirme.
Reglas para ti: usa SOLO lo que dice el texto, no inventes nada. Si una sección no tiene información, escribe "- [completar]". Quita menús, avisos de cookies y texto legal.`;

/** Lee el sitio y regresa un borrador (no se guarda: la persona lo revisa y guarda). */
export async function borradorDesdeWeb(client, entrada) {
  const u = normalizarUrl(entrada);
  if (!u) throw new Error('Escribe la dirección de tu página (por ejemplo, tumarca.com).');
  let sitio;
  try { sitio = await leerSitio(u); } catch (e) {
    throw new Error(e.message === 'direccion_no_permitida' ? 'Esa dirección no se puede leer.' : /^pagina_/.test(e.message) ? `La página respondió con error (${e.message.slice(7)}).` : 'No pude leer esa página. Revisa la dirección o intenta más tarde.');
  }
  if (sitio.texto.length < 200) throw new Error('La página casi no tiene texto que leer (puede estar hecha solo con imágenes). Escribe la información a mano.');
  const actual = conocimiento.actual(client.id)?.texto || '';
  const r = await hooks.ia({ etiqueta: 'conocimiento_web', maxTokens: 6000, schema: { type: 'object', additionalProperties: false, required: ['texto'], properties: { texto: { type: 'string' } } },
    system: SISTEMA, messages: [{ role: 'user', content: `Negocio: ${client.nombre}\nPágina: ${sitio.url}\nTítulo: ${sitio.titulo}\n${sitio.desc}\n\nTEXTO DEL SITIO:\n${sitio.texto}${actual.trim() && actual.trim() !== conocimiento.PLANTILLA.trim() ? `\n\nYA TIENEN ESTA INFORMACIÓN (consérvala e intégrala; si el sitio contradice algo, deja lo que ya tenían y anótalo como "[revisar: …]"):\n${actual.slice(0, 15000)}` : ''}` }] });
  const texto = String(r.data?.texto || '').trim().slice(0, conocimiento.MAX_TEXTO);
  if (texto.length < 80) throw new Error('No pude armar la información con esa página. Intenta con otra o escríbela a mano.');
  return { texto, url: sitio.url };
}
