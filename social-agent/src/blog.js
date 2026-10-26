// Agente de blog: busca noticias del momento de cada categoría, escribe un artículo original con su
// SEO (título, meta descripción, slug, etiquetas), le pone imagen (Pexels gratis, o IA si se activa)
// y lo deja para revisar o lo publica solo. Los sitios PHP leen lo publicado con /blog/<sitio>/….
// Todo gratis: noticias por RSS (Google Noticias y los feeds que se agreguen), texto con Gemini
// (clave gratis, ver llm/proveedor.js) e imágenes de Pexels (clave gratis).
import fs from 'node:fs';
import path from 'node:path';
import { config, mediaDir } from './config.js';
import { getDb, logEvent } from './db.js';
import { pedirJSON } from './llm/proveedor.js';
import { freqDays } from './schedule.js';
import { randomToken } from './crypto.js';
import { generateImage, ensureJpeg } from './media/image.js';

export const hooks = { fetch: (...a) => fetch(...a), pedir: (...a) => pedirJSON(...a) }; // pruebas
const db = () => getDb();
const J = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };

export const FRECUENCIAS = { diario: 'Diario', '3_por_semana': '3 por semana', '2_por_semana': '2 por semana', semanal: '1 por semana', quincenal: 'Cada 15 días', mensual: '1 al mes' };
export const ESTADOS = { generando: 'Escribiendo…', borrador: 'Por revisar', publicado: 'Publicado', rechazado: 'Rechazado', error: 'Error' };

export const slugify = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/ñ/g, 'n').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');

// ------------------------------------------------------------ sitios
const DEFAULT_CFG = {
  descripcion: '', // de qué trata el sitio y para quién escribe
  categorias: [], // [{ nombre, slug, busqueda }]
  frecuencia: '3_por_semana',
  modo: 'aprobacion', // 'aprobacion' | 'auto'
  tono: 'cercano, claro y profesional',
  autor: '',
  palabras: 900,
  pais: 'MX', // para Google Noticias
  fuentes_rss: [], // URLs de feeds RSS extra
  imagen: 'pexels', // 'pexels' | 'ia' | 'ninguna'
  temas_pendientes: [], // [{ texto, categoria }]
};
const hydrateSitio = (r) => (r ? { ...r, activo: !!r.activo, config: { ...DEFAULT_CFG, ...J(r.config_json, {}) } } : null);
export const getSitio = (id) => hydrateSitio(db().prepare('SELECT * FROM blog_sitios WHERE id = ?').get(id));
export const sitioPorSlug = (slug) => hydrateSitio(db().prepare('SELECT * FROM blog_sitios WHERE slug = ?').get(slug));
export const listarSitios = (clientId) => db().prepare('SELECT * FROM blog_sitios WHERE client_id = ? ORDER BY id').all(clientId).map(hydrateSitio);
const todosLosSitios = () => db().prepare('SELECT * FROM blog_sitios WHERE activo = 1 ORDER BY id').all().map(hydrateSitio);

/** Formulario del panel → datos del sitio (lanza Error con mensaje claro). */
export function parseSitio(b) {
  const nombre = String(b.nombre || '').trim().slice(0, 80);
  if (nombre.length < 2) throw new Error('Ponle nombre al sitio.');
  const dominio = String(b.dominio || '').trim().replace(/\/+$/, '').slice(0, 120);
  if (dominio && !/^https?:\/\/[^\s/]+\.[^\s/]+/.test(dominio)) throw new Error('El dominio debe empezar con https:// (ej. https://misitio.com).');
  const slug = slugify(b.slug || nombre);
  if (slug.length < 2) throw new Error('El identificador del sitio no es válido.');
  const categorias = String(b.categorias || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [n, busq] = l.split('|').map((x) => x.trim());
    return { nombre: n.slice(0, 60), slug: slugify(n), busqueda: (busq || n).slice(0, 120) };
  }).filter((c) => c.slug);
  if (!categorias.length) throw new Error('Agrega al menos una categoría (una por línea: Nombre | qué buscar en noticias).');
  const fuentes = String(b.fuentes_rss || '').split('\n').map((l) => l.trim()).filter(Boolean);
  for (const f of fuentes) if (!/^https?:\/\//.test(f)) throw new Error(`La fuente RSS no es una dirección válida: ${f}`);
  return {
    nombre, dominio, slug, activo: b.activo === '1' || b.activo === true,
    config: {
      descripcion: String(b.descripcion || '').trim().slice(0, 1500),
      categorias,
      frecuencia: FRECUENCIAS[b.frecuencia] ? b.frecuencia : '3_por_semana',
      modo: b.modo === 'auto' ? 'auto' : 'aprobacion',
      tono: String(b.tono || DEFAULT_CFG.tono).trim().slice(0, 200),
      autor: String(b.autor || '').trim().slice(0, 80),
      palabras: Math.min(2500, Math.max(500, Number(b.palabras) || 900)),
      pais: ['MX', 'ES', 'US', 'AR', 'CO', 'CL', 'PE'].includes(b.pais) ? b.pais : 'MX',
      fuentes_rss: fuentes.slice(0, 15),
      imagen: ['pexels', 'ia', 'ninguna'].includes(b.imagen) ? b.imagen : 'pexels',
    },
  };
}
export function guardarSitio(clientId, datos, id = null) {
  if (id) {
    const actual = getSitio(id);
    const cfg = { ...actual.config, ...datos.config, temas_pendientes: actual.config.temas_pendientes };
    db().prepare('UPDATE blog_sitios SET nombre = ?, dominio = ?, slug = ?, config_json = ?, activo = ? WHERE id = ? AND client_id = ?')
      .run(datos.nombre, datos.dominio, datos.slug, JSON.stringify(cfg), datos.activo ? 1 : 0, id, clientId);
    return getSitio(id);
  }
  try {
    const r = db().prepare('INSERT INTO blog_sitios (client_id, nombre, dominio, slug, config_json, activo) VALUES (?, ?, ?, ?, ?, ?)')
      .run(clientId, datos.nombre, datos.dominio, datos.slug, JSON.stringify(datos.config), datos.activo ? 1 : 0);
    return getSitio(Number(r.lastInsertRowid));
  } catch (e) {
    if (/UNIQUE/.test(e.message)) throw new Error(`Ya existe un sitio con el identificador "${datos.slug}". Usa otro.`);
    throw e;
  }
}
export const borrarSitio = (clientId, id) => db().prepare('DELETE FROM blog_sitios WHERE id = ? AND client_id = ?').run(id, clientId);

export function agregarTemaBlog(sitioId, texto) {
  const t = String(texto || '').trim().replace(/\s+/g, ' ').slice(0, 300);
  if (t.length < 3) throw new Error('Escribe de qué quieres el artículo.');
  const s = getSitio(sitioId);
  const temas = [...s.config.temas_pendientes, { texto: t }].slice(-10);
  db().prepare('UPDATE blog_sitios SET config_json = ? WHERE id = ?').run(JSON.stringify({ ...s.config, temas_pendientes: temas }), sitioId);
}
function quitarPrimerTema(sitioId, texto) {
  const s = getSitio(sitioId);
  const temas = s.config.temas_pendientes.filter((t, i) => !(t.texto === texto && i === s.config.temas_pendientes.findIndex((x) => x.texto === texto)));
  db().prepare('UPDATE blog_sitios SET config_json = ? WHERE id = ?').run(JSON.stringify({ ...s.config, temas_pendientes: temas }), sitioId);
}

// ------------------------------------------------------------ artículos
const hydrateArt = (r) => (r ? {
  ...r, etiquetas: J(r.etiquetas_json, []), fuentes: J(r.fuentes_json, []), advertencias: J(r.advertencias_json, []), imagen_credito: J(r.imagen_credito_json, null),
} : null);
export const getArticulo = (id) => hydrateArt(db().prepare('SELECT * FROM blog_articulos WHERE id = ?').get(id));
export const listarArticulos = (sitioId, { limit = 60 } = {}) => db().prepare('SELECT * FROM blog_articulos WHERE sitio_id = ? ORDER BY id DESC LIMIT ?').all(sitioId, limit).map(hydrateArt);
function actualizar(id, f) {
  const map = { etiquetas: 'etiquetas_json', fuentes: 'fuentes_json', advertencias: 'advertencias_json', imagen_credito: 'imagen_credito_json' };
  const campos = Object.entries(f).map(([k, v]) => [map[k] || k, map[k] ? JSON.stringify(v) : v]);
  if (!campos.length) return getArticulo(id);
  db().prepare(`UPDATE blog_articulos SET ${campos.map(([k]) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...campos.map(([, v]) => v), id);
  return getArticulo(id);
}
const slugLibre = (sitioId, slug, id) => {
  let s = slug || `articulo-${randomToken(4).toLowerCase()}`, n = 2;
  while (db().prepare('SELECT 1 FROM blog_articulos WHERE sitio_id = ? AND slug = ? AND id != ?').get(sitioId, s, id)) s = `${slug}-${n++}`;
  return s;
};

export function publicar(id) {
  const a = getArticulo(id);
  if (!a || !['borrador', 'rechazado'].includes(a.status)) throw new Error('Solo se publican artículos por revisar.');
  return actualizar(id, { status: 'publicado', published_at: new Date().toISOString(), error: null });
}
export const rechazar = (id) => actualizar(id, { status: 'rechazado' });
export const despublicar = (id) => actualizar(id, { status: 'borrador', published_at: null });
export function borrarArticulo(id) {
  const a = getArticulo(id);
  if (a?.imagen_path) try { fs.unlinkSync(a.imagen_path); } catch { /* ya no está */ }
  db().prepare('DELETE FROM blog_articulos WHERE id = ?').run(id);
}
/** Edición a mano desde el panel (título, metas, extracto, categoría, etiquetas, contenido). */
export function editar(id, b) {
  const a = getArticulo(id), s = getSitio(a.sitio_id);
  const cat = s.config.categorias.find((c) => c.slug === b.categoria);
  return actualizar(id, {
    titulo: String(b.titulo || a.titulo).trim().slice(0, 140),
    slug: slugLibre(a.sitio_id, slugify(b.slug || a.slug), id),
    meta_title: String(b.meta_title || '').trim().slice(0, 70),
    meta_description: String(b.meta_description || '').trim().slice(0, 170),
    extracto: String(b.extracto || '').trim().slice(0, 400),
    categoria: cat ? cat.slug : a.categoria,
    etiquetas: String(b.etiquetas || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 8),
    contenido_html: limpiarHtml(String(b.contenido_html || a.contenido_html)),
  });
}

// ------------------------------------------------------------ HTML seguro
// Solo etiquetas de texto; los enlaces solo http(s) y abren aparte. Lo demás se quita (se deja su texto).
const PERMITIDAS = new Set(['p', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'a', 'blockquote', 'br']);
export function limpiarHtml(html) {
  let s = String(html || '')
    .replace(/<(script|style|iframe|object|embed|noscript|svg|form)[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<\s*(\/?)\s*([a-z0-9]+)([^>]*)>/gi, (_, cierre, tag, attrs) => {
    const t = tag.toLowerCase();
    if (!PERMITIDAS.has(t)) return t === 'h1' ? (cierre ? '</h2>' : '<h2>') : '';
    if (cierre) return t === 'br' ? '' : `</${t}>`;
    if (t === 'a') {
      const href = /href\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
      const url = href ? (href[2] ?? href[3] ?? '') : '';
      return /^https?:\/\//i.test(url) ? `<a href="${url.replace(/"/g, '&quot;')}" target="_blank" rel="noopener nofollow">` : '<a>';
    }
    return `<${t}>`;
  });
  return s.trim();
}
const palabras = (html) => String(html || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

// ------------------------------------------------------------ noticias (RSS gratis)
const entidades = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
// Texto plano de un campo RSS: quita CDATA, decodifica (los resúmenes traen HTML escapado) y quita etiquetas.
const decode = (s) => entidades(entidades(String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).replace(/<[^>]+>/g, ' '))
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
export function parseRss(xml) {
  return [...String(xml || '').matchAll(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi)].map(([it]) => {
    const tag = (n) => decode((new RegExp(`<${n}\\b[^>]*>([\\s\\S]*?)<\\/${n}>`, 'i').exec(it) || [])[1]);
    const link = tag('link') || (/<link[^>]*href="([^"]+)"/i.exec(it) || [])[1] || '';
    return { titulo: tag('title'), url: link, fecha: tag('pubDate') || tag('published') || tag('updated'), fuente: tag('source'), resumen: tag('description').slice(0, 400) || tag('summary').slice(0, 400) };
  }).filter((n) => n.titulo && /^https?:\/\//.test(n.url));
}
const IDIOMA = { MX: ['es-419', 'MX:es-419'], ES: ['es', 'ES:es'], US: ['es-419', 'US:es-419'], AR: ['es-419', 'AR:es-419'], CO: ['es-419', 'CO:es-419'], CL: ['es-419', 'CL:es-419'], PE: ['es-419', 'PE:es-419'] };
export async function buscarNoticias(sitio, categoria, { limite = 10 } = {}) {
  const [hl, ceid] = IDIOMA[sitio.config.pais] || IDIOMA.MX;
  const urls = [`https://news.google.com/rss/search?q=${encodeURIComponent(`${categoria.busqueda} when:7d`)}&hl=${hl}&gl=${sitio.config.pais}&ceid=${ceid}`, ...sitio.config.fuentes_rss];
  const usadas = new Set(db().prepare('SELECT noticia_url FROM blog_articulos WHERE sitio_id = ? AND noticia_url IS NOT NULL').all(sitio.id).map((r) => r.noticia_url));
  const todas = [];
  for (const u of urls) {
    try {
      const r = await hooks.fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (KuperBlog)' }, signal: AbortSignal.timeout(20_000) });
      if (r.ok) todas.push(...parseRss(await r.text()).slice(0, 25));
    } catch (e) { console.error('[blog] noticias', u.slice(0, 80), e.message); }
  }
  const vistos = new Set();
  return todas.filter((n) => !usadas.has(n.url) && !vistos.has(n.titulo.toLowerCase()) && vistos.add(n.titulo.toLowerCase())).slice(0, limite);
}

// ------------------------------------------------------------ redacción
const str = { type: 'string' };
const obj = (p) => ({ type: 'object', properties: p, required: Object.keys(p), additionalProperties: false });
export const BLOG_SCHEMA = obj({
  titulo: str, slug: str, meta_title: str, meta_description: str, extracto: str, categoria: str,
  etiquetas: { type: 'array', items: str }, palabra_clave: str, contenido_html: str,
  fuentes: { type: 'array', items: obj({ titulo: str, url: str }) },
  noticia_base_url: str, busqueda_imagen: str, prompt_imagen: str, alt_imagen: str,
});
const SISTEMA = `Eres el redactor del blog de un sitio web. Escribes artículos ORIGINALES en español, útiles y bien posicionables en Google, a partir de noticias recientes de una categoría.

Cómo trabajas:
- Recibes el sitio (de qué trata y para quién escribe), la categoría, el tono, el largo y una lista de noticias recientes (título, medio, fecha, resumen y url). Elige UNA noticia como punto de partida (o un tema pedido, si lo hay) y escribe un artículo que explique qué pasó, por qué importa y qué puede hacer el lector con eso.
- NO copies las noticias ni traduzcas párrafos: escribe con tus palabras. Solo tienes título y resumen; no inventes detalles, cifras, citas ni nombres que no estén en lo que recibes. Si das contexto general, que sea conocimiento común y verificable, sin datos exactos.
- Cita como fuentes SOLO urls de la lista que recibes (1 a 3). Pon la noticia base en "noticia_base_url". Si no hay noticias o eliges un tema pedido sin noticias, "fuentes" va vacío y "noticia_base_url" vacío.
- Estructura de "contenido_html": un párrafo de entrada que enganche (sin repetir el título), 3 a 5 secciones con <h2> (y <h3> si hace falta), párrafos cortos, alguna lista <ul> cuando ayude, y un cierre con una conclusión práctica. Usa solo <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <a>, <blockquote>. Sin <h1> (el título lo pone la página), sin estilos, sin imágenes.
- SEO: "palabra_clave" es lo que una persona buscaría en Google (2 a 5 palabras). Debe aparecer en el título, en el primer párrafo y en al menos un <h2>. "meta_title" máximo 60 caracteres. "meta_description" de 120 a 155 caracteres, con la palabra clave y una razón para hacer clic. "slug" en minúsculas, sin acentos, con guiones, máximo 6 palabras. "extracto" de 1 a 2 frases. "etiquetas" de 3 a 6, cortas.
- "categoria" es el identificador (slug) de la categoría que recibiste, tal cual.
- Imagen: "busqueda_imagen" son 2 a 4 palabras EN INGLÉS para buscar una foto de stock que ilustre el tema (sin marcas ni personas famosas). "prompt_imagen" describe en español una imagen editorial realista para la portada, sin texto ni logos. "alt_imagen" describe la imagen en español para personas que no la ven.
- Nada de relleno ("en el mundo actual", "en conclusión", "sin duda"), nada de rayas largas (—), nada de promesas exageradas. No hables de política partidista ni religión salvo que la categoría sea esa, y en ese caso con neutralidad.`;

export function validarArticulo(out, { sitio, noticias = [] }) {
  const errs = [];
  const cats = sitio.config.categorias.map((c) => c.slug);
  if (!out.titulo || out.titulo.length < 20 || out.titulo.length > 110) errs.push('El título debe tener entre 20 y 110 caracteres.');
  if (!out.meta_title || out.meta_title.length > 60) errs.push('"meta_title" debe tener máximo 60 caracteres.');
  if (!out.meta_description || out.meta_description.length < 110 || out.meta_description.length > 160) errs.push(`"meta_description" debe tener entre 120 y 155 caracteres (tiene ${out.meta_description?.length || 0}).`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(out.slug || '') || out.slug.length > 80) errs.push('"slug" debe ir en minúsculas, sin acentos y con guiones.');
  if (!cats.includes(out.categoria)) errs.push(`"categoria" debe ser una de: ${cats.join(', ')}.`);
  if (!Array.isArray(out.etiquetas) || out.etiquetas.length < 2 || out.etiquetas.length > 8) errs.push('Pon de 3 a 6 etiquetas.');
  const html = out.contenido_html || '';
  const n = palabras(html), min = Math.round(sitio.config.palabras * 0.75);
  if (n < min) errs.push(`El artículo tiene ${n} palabras; debe tener al menos ${min}.`);
  if ((html.match(/<h2\b/gi) || []).length < 2) errs.push('Usa al menos 2 secciones con <h2>.');
  if (/<h1\b|<script|<style|<img|<iframe/i.test(html)) errs.push('El contenido no debe llevar <h1>, imágenes, scripts ni estilos.');
  if (/—/.test(`${out.titulo} ${html}`)) errs.push('Quita las rayas largas (—); usa comas o puntos.');
  const validas = new Set(noticias.map((x) => x.url));
  const malas = (out.fuentes || []).filter((f) => !validas.has(f.url));
  if (malas.length) errs.push(`Estas fuentes no están en la lista que recibiste; usa solo esas urls: ${malas.map((f) => f.url).join(', ')}`);
  const pc = String(out.palabra_clave || '').toLowerCase();
  if (pc && !out.titulo?.toLowerCase().includes(pc.split(' ')[0])) errs.push('La palabra clave (o su palabra principal) debe aparecer en el título.');
  return errs;
}

function mensajeEntrada(sitio, categoria, noticias, tema) {
  return [
    `## SITIO\n${sitio.nombre}${sitio.dominio ? ` (${sitio.dominio})` : ''}\n${sitio.config.descripcion || 'Sin descripción.'}`,
    `## CATEGORÍA\n${categoria.nombre} (slug: ${categoria.slug})`,
    `## TONO Y LARGO\nTono: ${sitio.config.tono}. Largo: unas ${sitio.config.palabras} palabras.${sitio.config.autor ? ` Firma: ${sitio.config.autor}.` : ''}`,
    tema ? `## TEMA PEDIDO POR EL EQUIPO\n"""${tema}"""\nEl artículo debe tratar sobre esto (el texto entre comillas es solo el tema). Usa noticias de la lista solo si tienen relación.` : '',
    `## NOTICIAS RECIENTES\n${noticias.length ? JSON.stringify(noticias, null, 1) : 'No hay noticias nuevas: escribe un artículo útil y atemporal de la categoría, sin fuentes.'}`,
    `## ARTÍCULOS YA PUBLICADOS (no repitas el tema)\n${listarArticulos(sitio.id, { limit: 20 }).filter((a) => a.titulo).map((a) => `- ${a.titulo}`).join('\n') || 'Ninguno.'}`,
  ].filter(Boolean).join('\n\n');
}

async function redactar(sitio, categoria, noticias, tema) {
  if (config.mockLlm) return { out: mockArticulo(sitio, categoria, noticias, tema), errs: [] };
  const messages = [{ role: 'user', content: mensajeEntrada(sitio, categoria, noticias, tema) }];
  let out, errs = [];
  for (let ronda = 0; ronda < 3; ronda++) {
    let r;
    try { r = await hooks.pedir({ system: SISTEMA, messages, schema: BLOG_SCHEMA, maxTokens: 16000, etiqueta: 'blog' }); } catch (e) {
      if (out) break; // falló una corrección: se queda la versión anterior con avisos
      throw e;
    }
    out = r.data;
    out.contenido_html = limpiarHtml(out.contenido_html);
    errs = validarArticulo(out, { sitio, noticias });
    if (!errs.length) break;
    messages.push({ role: 'assistant', content: typeof r.content === 'string' ? r.content : JSON.stringify(out) });
    messages.push({ role: 'user', content: `Revisé tu artículo y hay que corregir esto. Devuelve el JSON completo corregido:\n- ${errs.join('\n- ')}` });
  }
  return { out, errs };
}

function mockArticulo(sitio, categoria, noticias, tema) {
  const n = noticias[0];
  const p = (t) => `<p>${t} ${'Texto de prueba para el artículo del blog. '.repeat(12)}</p>`;
  return {
    titulo: tema ? `Guía práctica: ${tema}` : `Lo que significa ${n?.titulo || categoria.nombre} para tu negocio`,
    slug: slugify(tema || n?.titulo || categoria.nombre), meta_title: `${categoria.nombre}: lo que debes saber`.slice(0, 60),
    meta_description: 'Te explicamos qué pasó, por qué importa y qué puedes hacer hoy mismo con esta información para tu negocio y tus clientes.',
    extracto: 'Qué pasó, por qué importa y qué hacer.', categoria: categoria.slug, etiquetas: ['prueba', categoria.slug, 'blog'], palabra_clave: categoria.nombre.toLowerCase(),
    contenido_html: [p('Entrada.'), '<h2>Qué pasó</h2>', p('Uno.'), '<h2>Por qué importa</h2>', p('Dos.'), '<h2>Qué hacer</h2>', p('Tres.'), p('Cuatro.'), p('Cinco.')].join(''),
    fuentes: n ? [{ titulo: n.titulo, url: n.url }] : [], noticia_base_url: n?.url || '',
    busqueda_imagen: 'business news', prompt_imagen: 'Escritorio con una laptop y café', alt_imagen: 'Escritorio con laptop',
  };
}

// ------------------------------------------------------------ imagen
async function imagenPexels(sitio, art, busqueda) {
  if (!config.pexelsApiKey) throw new Error('Falta PEXELS_API_KEY (es gratis en pexels.com/api).');
  const usadas = new Set(db().prepare("SELECT imagen_credito_json FROM blog_articulos WHERE sitio_id = ? AND imagen_credito_json IS NOT NULL").all(sitio.id).map((r) => J(r.imagen_credito_json, {})?.pexels_id));
  const buscar = async (q) => {
    const r = await hooks.fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=15&orientation=landscape`, { headers: { Authorization: config.pexelsApiKey }, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`Pexels ${r.status}`);
    return ((await r.json()).photos || []).filter((f) => !usadas.has(f.id));
  };
  let fotos = await buscar(busqueda);
  if (!fotos.length) fotos = await buscar(art.categoria.replace(/-/g, ' '));
  if (!fotos.length) throw new Error(`Pexels no encontró fotos para "${busqueda}"`);
  const f = fotos[Math.floor(Math.random() * Math.min(5, fotos.length))];
  const r = await hooks.fetch(f.src.large2x || f.src.large || f.src.original, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`No se pudo descargar la foto (${r.status})`);
  const file = path.join(mediaDir(), `blog-${sitio.slug}-${art.id}-${randomToken(6)}.jpg`);
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  return { file, credito: { fuente: 'Pexels', pexels_id: f.id, autor: f.photographer, autor_url: f.photographer_url, url: f.url } };
}
async function ponerImagen(sitio, art, out) {
  if (sitio.config.imagen === 'ninguna') return {};
  const intentos = sitio.config.imagen === 'ia' ? ['ia', 'pexels'] : ['pexels', 'ia'];
  const fallas = [];
  for (const via of intentos) {
    try {
      if (via === 'pexels') {
        const { file, credito } = await imagenPexels(sitio, art, out.busqueda_imagen || out.palabra_clave);
        return { imagen_path: file, imagen_credito: credito };
      }
      if (!config.geminiApiKey && !config.geminiTextApiKey) throw new Error('sin clave de Gemini para imágenes');
      const base = path.join(mediaDir(), `blog-${sitio.slug}-${art.id}-${randomToken(6)}`);
      const file = ensureJpeg(await generateImage({ prompt: `${out.prompt_imagen}. Fotografía editorial realista, horizontal, sin texto ni logos.`, formato: '1.91:1', outFileBase: base, apiKey: config.geminiApiKey || config.geminiTextApiKey }));
      return { imagen_path: file, imagen_credito: { fuente: 'IA' } };
    } catch (e) { fallas.push(`${via}: ${e.message}`); }
  }
  return { advertencia: `Sin imagen (${fallas.join(' · ')})` };
}

// ------------------------------------------------------------ generar
const enCurso = new Set();
/** Genera un artículo para el sitio. tema: lo que pidió el equipo (si no, toma el primero en espera). */
export async function generarArticulo(sitioId, { tema = '', categoria: catSlug = '' } = {}) {
  const sitio = getSitio(sitioId);
  if (!sitio) throw new Error('Sitio no existe');
  if (enCurso.has(sitioId)) throw new Error('Ya se está escribiendo un artículo para este sitio.');
  enCurso.add(sitioId);
  const deLista = !tema && sitio.config.temas_pendientes[0]?.texto;
  const pedido = tema || deLista || '';
  const id = Number(db().prepare("INSERT INTO blog_articulos (sitio_id, status, tema_pedido) VALUES (?, 'generando', ?)").run(sitioId, pedido || null).lastInsertRowid);
  try {
    const cat = sitio.config.categorias.find((c) => c.slug === catSlug) || siguienteCategoria(sitio);
    const noticias = await buscarNoticias(sitio, pedido ? { ...cat, busqueda: `${pedido}` } : cat);
    const { out, errs } = await redactar(sitio, cat, noticias, pedido);
    const categoria = sitio.config.categorias.some((c) => c.slug === out.categoria) ? out.categoria : cat.slug;
    const art = actualizar(id, {
      titulo: out.titulo, slug: slugLibre(sitioId, slugify(out.slug || out.titulo), id), categoria,
      meta_title: out.meta_title, meta_description: out.meta_description, extracto: out.extracto, contenido_html: out.contenido_html,
      etiquetas: (out.etiquetas || []).slice(0, 8), palabra_clave: out.palabra_clave, imagen_alt: out.alt_imagen,
      fuentes: (out.fuentes || []).filter((f) => noticias.some((n) => n.url === f.url)), noticia_url: out.noticia_base_url || null,
    });
    const img = await ponerImagen(sitio, art, out);
    const avisos = errs.map((e) => `Validación: ${e}`);
    if (img.advertencia) avisos.push(img.advertencia);
    const auto = sitio.config.modo === 'auto' && !errs.length;
    actualizar(id, {
      ...(img.imagen_path ? { imagen_path: img.imagen_path, imagen_credito: img.imagen_credito } : {}),
      advertencias: avisos, status: auto ? 'publicado' : 'borrador', ...(auto ? { published_at: new Date().toISOString() } : {}),
    });
    if (deLista) quitarPrimerTema(sitioId, deLista);
    logEvent({ clientId: sitio.client_id, tipo: 'blog_generado', detalle: `${sitio.nombre}: ${out.titulo} → ${auto ? 'publicado' : 'por revisar'}` });
    return getArticulo(id);
  } catch (e) {
    actualizar(id, { status: 'error', error: e.message });
    logEvent({ clientId: sitio.client_id, tipo: 'blog_error', detalle: `${sitio.nombre}: ${e.message}` });
    throw e;
  } finally { enCurso.delete(sitioId); }
}

/** La categoría menos usada en los últimos artículos (para que el blog no hable siempre de lo mismo). */
export function siguienteCategoria(sitio) {
  const recientes = db().prepare("SELECT categoria FROM blog_articulos WHERE sitio_id = ? AND status IN ('borrador','publicado') ORDER BY id DESC LIMIT 20").all(sitio.id).map((r) => r.categoria);
  const usos = (slug) => recientes.filter((c) => c === slug).length;
  const ultima = recientes[0];
  const orden = [...sitio.config.categorias].sort((a, b) => usos(a.slug) - usos(b.slug) || (a.slug === ultima) - (b.slug === ultima));
  return orden[0];
}

/** ¿Le toca un artículo a este sitio? Según su frecuencia, contando desde el último que se generó bien. */
export function tocaSitio(sitio, now = new Date()) {
  if (!sitio.activo || !sitio.config.categorias.length) return false;
  if (db().prepare("SELECT 1 FROM blog_articulos WHERE sitio_id = ? AND status = 'generando'").get(sitio.id)) return false;
  const err = db().prepare("SELECT updated_at FROM blog_articulos WHERE sitio_id = ? AND status = 'error' ORDER BY id DESC LIMIT 1").get(sitio.id);
  if (err && now - new Date(err.updated_at.replace(' ', 'T') + 'Z') < 6 * 3600_000) return false; // no reintentar en bucle
  const ult = db().prepare("SELECT created_at FROM blog_articulos WHERE sitio_id = ? AND status IN ('borrador','publicado','rechazado') ORDER BY id DESC LIMIT 1").get(sitio.id);
  if (!ult) return true;
  const dias = (now - new Date(ult.created_at.replace(' ', 'T') + 'Z')) / 86400_000;
  return dias >= freqDays(sitio.config.frecuencia) - 0.25; // un poco de margen: la ventana de madrugada varía unos minutos
}

let ocupado = false;
/** Lo llama el programador cada minuto (en la ventana de madrugada): un artículo a la vez. */
export async function tickBlog(now = new Date()) {
  if (ocupado) return;
  const sitio = todosLosSitios().find((s) => tocaSitio(s, now));
  if (!sitio) return;
  ocupado = true;
  try { await generarArticulo(sitio.id); } catch { /* ya quedó en la bitácora */ } finally { ocupado = false; }
}

// ------------------------------------------------------------ lo que leen los sitios PHP (público, solo lo publicado)
const urlMedia = (f) => (f ? `${config.publicBaseUrl}/media/${path.basename(f)}` : null);
function publico(a, sitio, completo = false) {
  const cat = sitio.config.categorias.find((c) => c.slug === a.categoria);
  return {
    titulo: a.titulo, slug: a.slug, extracto: a.extracto, categoria: cat?.nombre || a.categoria, categoria_slug: a.categoria,
    etiquetas: a.etiquetas, meta_title: a.meta_title || a.titulo, meta_description: a.meta_description || a.extracto,
    imagen: urlMedia(a.imagen_path), imagen_alt: a.imagen_alt || a.titulo, imagen_credito: a.imagen_credito ? { fuente: a.imagen_credito.fuente, autor: a.imagen_credito.autor || null, autor_url: a.imagen_credito.autor_url || null, url: a.imagen_credito.url || null } : null,
    publicado: a.published_at, actualizado: a.updated_at ? new Date(a.updated_at.replace(' ', 'T') + 'Z').toISOString() : a.published_at,
    autor: sitio.config.autor || sitio.nombre, palabras: palabras(a.contenido_html),
    ...(completo ? { contenido_html: a.contenido_html, fuentes: a.fuentes, palabra_clave: a.palabra_clave } : {}),
  };
}
export function apiLista(slugSitio, { pagina = 1, porPagina = 12, categoria = '' } = {}) {
  const sitio = sitioPorSlug(slugSitio);
  if (!sitio) return null;
  const pp = Math.min(50, Math.max(1, Number(porPagina) || 12)), pg = Math.max(1, Number(pagina) || 1);
  const where = `sitio_id = ? AND status = 'publicado'${categoria ? ' AND categoria = ?' : ''}`;
  const args = categoria ? [sitio.id, categoria] : [sitio.id];
  const total = db().prepare(`SELECT COUNT(*) n FROM blog_articulos WHERE ${where}`).get(...args).n;
  const filas = db().prepare(`SELECT * FROM blog_articulos WHERE ${where} ORDER BY published_at DESC LIMIT ? OFFSET ?`).all(...args, pp, (pg - 1) * pp).map(hydrateArt);
  const conteo = Object.fromEntries(db().prepare("SELECT categoria, COUNT(*) n FROM blog_articulos WHERE sitio_id = ? AND status = 'publicado' GROUP BY categoria").all(sitio.id).map((r) => [r.categoria, r.n]));
  return {
    sitio: { nombre: sitio.nombre, dominio: sitio.dominio, descripcion: sitio.config.descripcion },
    categorias: sitio.config.categorias.map((c) => ({ nombre: c.nombre, slug: c.slug, total: conteo[c.slug] || 0 })),
    articulos: filas.map((a) => publico(a, sitio)), pagina: pg, paginas: Math.max(1, Math.ceil(total / pp)), total,
  };
}
export function apiArticulo(slugSitio, slug) {
  const sitio = sitioPorSlug(slugSitio);
  if (!sitio) return null;
  const a = hydrateArt(db().prepare("SELECT * FROM blog_articulos WHERE sitio_id = ? AND slug = ? AND status = 'publicado'").get(sitio.id, slug));
  if (!a) return null;
  const rel = db().prepare("SELECT * FROM blog_articulos WHERE sitio_id = ? AND status = 'publicado' AND id != ? ORDER BY (categoria = ?) DESC, published_at DESC LIMIT 3").all(sitio.id, a.id, a.categoria).map(hydrateArt);
  return { sitio: { nombre: sitio.nombre, dominio: sitio.dominio }, articulo: publico(a, sitio, true), relacionados: rel.map((r) => publico(r, sitio)) };
}
/** Todo lo publicado (para el sitemap del sitio). */
export function apiSitemap(slugSitio) {
  const sitio = sitioPorSlug(slugSitio);
  if (!sitio) return null;
  return db().prepare("SELECT slug, categoria, published_at, updated_at FROM blog_articulos WHERE sitio_id = ? AND status = 'publicado' ORDER BY published_at DESC").all(sitio.id)
    .map((r) => ({ slug: r.slug, categoria_slug: r.categoria, actualizado: r.updated_at ? new Date(r.updated_at.replace(' ', 'T') + 'Z').toISOString() : r.published_at }));
}
