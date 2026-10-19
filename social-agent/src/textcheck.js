// Revisión de textos en español con las reglas de las skills de Instagram
// (ig-human, ig-caption, ig-reel, ig-carousel), adaptadas a un flujo automático.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.js';

const SLOP = JSON.parse(fs.readFileSync(path.join(ROOT, 'prompts/slop-es.json'), 'utf8'));
const STRUCT = SLOP.estructuras.map((e) => ({ re: new RegExp(e.regex, e.flags || 'iu'), msg: e.mensaje }));

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

// ------------------------------------------------------------ limpieza (como humanize.py)
const INVISIBLE = /[​-‍⁠﻿­᠎\u{E0000}-\u{E007F}]/gu;
const ODD_SPACE = /[  -   　]/g;

/** Quita huellas tipográficas de texto generado: invisibles, rayas, comillas curvas, elipsis. */
export function cleanText(s) {
  if (typeof s !== 'string') return s;
  return s
    .replace(INVISIBLE, '')
    .replace(ODD_SPACE, ' ')
    .replace(/\s*—\s*/g, ', ')            // raya → coma
    .replace(/(\d)\s*–\s*(\d)/g, '$1-$2')  // rangos numéricos
    .replace(/\s*–\s*/g, ', ')
    .replace(/[“”«»]/g, '"').replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/^\s*•\s*/gm, '- ')
    .replace(/,\s*([.,;:!?])/g, '$1')       // ", ." → "."
    .replace(/^,\s*/gm, '')
    .replace(/[ \t]{2,}/g, ' ');
}

/** Limpia todos los textos de la salida del redactor (muta y devuelve el objeto). */
export function cleanOutput(out) {
  if (!out || out.error) return out;
  for (const v of out.variantes_copy || []) v.copy = cleanText(v.copy);
  for (const k of ['headline_corto', 'subheadline', 'tema', 'alt_text', 'cta', 'idea_visual']) out[k] = cleanText(out[k]);
  if (out.animacion) {
    out.animacion.escenas = out.animacion.escenas.map((e) => ({ titular: cleanText(e.titular), apoyo: cleanText(e.apoyo) }));
    out.animacion.cierre = cleanText(out.animacion.cierre);
  }
  if (out.slides) out.slides = out.slides.map((s) => ({ titulo: cleanText(s.titulo), texto: cleanText(s.texto) }));
  for (const g of out.ganchos || []) { g.texto = cleanText(g.texto); g.en_pantalla = cleanText(g.en_pantalla); }
  return out;
}

// ------------------------------------------------------------ conteos
const EMOJI = /\p{Extended_Pictographic}/gu;
export const countEmoji = (s) => (String(s).match(EMOJI) || []).length;
export const countWords = (s) => (String(s ?? '').trim().match(/\S+/g) || []).length;
/** Palabras en pantalla: "p. m." o "a. m." cuentan como una sola. */
export const screenWords = (s) => (String(s ?? '').trim().match(/\S+/g) || []).filter((w) => !/^[a-z]\.$/i.test(w)).length;

// Llamadas a la acción típicas en español (imperativos de CTA).
const ASKS = [
  /\bcomenta(lo|la)?\b/i, /\bescr[ií]be(nos|me)\b/i, /\bm[aá]nda(nos|me)\b/i, /\benv[ií]a(nos|me)\b/i,
  /\bguarda(lo|la|este|esta)?\b/i, /\bagenda(\s+(tu|una))?\b/i, /\bs[ií]gue(nos|me)\b/i, /\blink en (la )?bio\b/i,
  /\breserva(\s+(tu|una))\b/i, /\bll[aá]ma(nos|me)\b/i, /\bdm\b/i, /\bcomp[aá]rte(lo|la)\b/i,
];
export function findAsks(s) {
  const out = new Set();
  for (const re of ASKS) { const m = String(s).match(re); if (m) out.add(norm(m[0]).replace(/(lo|la)$/, '')); }
  return [...out];
}

const GREETING = /^(hola|hey|buen(os|as)\s+(d[ií]as|tardes|noches)|qu[eé] tal)\b/i;

// ------------------------------------------------------------ revisiones
/** Muletillas, palabras prohibidas y estructuras de IA en un texto. */
export function slopIssues(text, perfil = {}, label = 'Texto') {
  const t = norm(text);
  const errs = [];
  for (const f of new Set([...SLOP.frases, ...(perfil.palabras_prohibidas || [])].map((x) => x.toLowerCase()))) {
    const nf = norm(f);
    const re = new RegExp(`(^|[^\\p{L}])${nf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'u');
    if (re.test(t)) errs.push(`${label}: usa "${f}" (suena a IA o está prohibido por la marca); dilo de forma concreta.`);
  }
  const kw = perfil.palabra_clave_cta;
  for (const s of STRUCT) {
    const src = kw ? String(text).replace(new RegExp(`\\b${kw}\\b`, 'g'), kw.toLowerCase()) : String(text);
    if (s.re.test(src)) errs.push(`${label}: tiene ${s.msg}; reescríbelo de forma natural.`);
  }
  return errs;
}

/** Reglas del caption por plataforma (ig-caption). */
export function captionIssues(copy, { plataforma, perfil = {}, trabajo, label = 'Caption' }) {
  const errs = [];
  const text = String(copy ?? '');
  const first = text.split('\n')[0].trim();
  const asks = findAsks(text);
  if (asks.length > 1) errs.push(`${label}: tiene ${asks.length} llamadas a la acción (${asks.join(', ')}); deja una sola.`);
  const maxE = perfil.permite_emojis ? perfil.max_emojis ?? 3 : 0;
  if (countEmoji(text) > maxE) errs.push(`${label}: ${countEmoji(text)} emojis; máximo ${maxE}.`);
  errs.push(...slopIssues(text, perfil, label));
  if (plataforma !== 'instagram') return errs;

  if (first.length > 125) errs.push(`${label}: la primera línea tiene ${first.length} caracteres; Instagram corta en 125. Acórtala para que se lea completa antes de "más".`);
  if (GREETING.test(first)) errs.push(`${label}: la primera línea empieza con un saludo; empieza con lo importante.`);
  if (/^[#@]/.test(first) || /^\p{Extended_Pictographic}/u.test(first)) errs.push(`${label}: la primera línea no puede empezar con hashtag, mención ni emoji.`);
  if (/https?:\/\/|www\./i.test(text)) errs.push(`${label}: tiene un link; en Instagram no son clicables. Usa "link en la bio".`);
  if (!asks.length) errs.push(`${label}: no tiene ninguna llamada a la acción; pon una (p. ej. ${perfil.palabra_clave_cta ? `"Comenta ${perfil.palabra_clave_cta}"` : 'comentar una palabra clave'}).`);
  if (perfil.palabra_clave_cta && /comenta/i.test(text) && !new RegExp(`\\b${perfil.palabra_clave_cta}\\b`).test(text)) {
    errs.push(`${label}: pide comentar pero no usa la palabra clave ${perfil.palabra_clave_cta} en MAYÚSCULAS.`);
  }
  if (trabajo === 'A' && !findAsks(first).length) errs.push(`${label}: es un Reel (trabajo A), así que la primera línea debe ser la acción dicha sin rodeos.`);
  const terms = perfil.terminos_busqueda || [];
  if (terms.length && !terms.some((k) => norm(text).includes(norm(k)))) {
    errs.push(`${label}: no incluye ningún término de búsqueda (${terms.join(' / ')}); mete al menos uno como frase natural.`);
  }
  const paras = text.split(/\n\s*\n/).filter((p) => p.trim());
  if (paras.length < 2) errs.push(`${label}: sepáralo en 2 a 6 párrafos cortos con una línea en blanco entre ellos.`);
  return errs;
}

/** Ganchos (ig-reel): 3 fórmulas distintas y el elegido abre la pieza. */
export function hookIssues(out) {
  const errs = [];
  const g = out.ganchos || [];
  if (g.length !== 3) errs.push('Escribe exactamente 3 ganchos.');
  const ids = new Set(g.map((x) => x.formula_id));
  if (ids.size !== g.length) errs.push('Los 3 ganchos deben usar fórmulas distintas.');
  if (g.some((x) => !(x.formula_id >= 1 && x.formula_id <= 26))) errs.push('"formula_id" debe ser un id de FORMULAS_DE_GANCHO (1-26).');
  const chosen = g[out.gancho_elegido];
  if (!chosen) { errs.push('"gancho_elegido" debe ser 0, 1 o 2.'); return errs; }
  if (screenWords(chosen.en_pantalla) > 6) errs.push(`El gancho en pantalla "${chosen.en_pantalla}" tiene más de 6 palabras.`);
  if (GREETING.test(chosen.texto) || /\b(en este (video|post)|hoy te (voy|vamos) a)\b/i.test(chosen.texto)) errs.push('El gancho tiene preámbulo (saludo, "en este video", "hoy te voy a..."); empieza directo.');
  const opening = out.formato_contenido === 'video_animado' ? out.animacion?.escenas?.[0]?.titular
    : out.formato_contenido === 'carrusel' ? out.slides?.[0]?.titulo
    : out.formato_contenido === 'imagen_estatica' && !out.requiere_asset_real ? out.headline_corto : null;
  if (opening != null && norm(opening).replace(/[^\p{L}\p{N}]/gu, '') !== norm(chosen.en_pantalla).replace(/[^\p{L}\p{N}]/gu, '')) {
    errs.push(`La pieza debe abrir con el gancho elegido: "${chosen.en_pantalla}" (ahora abre con "${opening}").`);
  }
  return errs;
}
