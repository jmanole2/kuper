// Reglas por plataforma y validación determinista de la salida del redactor
// (auto-chequeo del prompt maestro + reglas de las skills de Instagram, verificadas en código).
import { captionIssues, hookIssues, slopIssues, screenWords, countWords, countEmoji } from './textcheck.js';

export { countWords };

export const PLATFORM_RULES = {
  instagram: { palabras: [40, 140], hashtags: [0, 5], formatos: ['video_animado', 'carrusel', 'imagen_estatica'], proporciones: ['1:1', '4:5', '9:16'] },
  facebook: { palabras: [30, 120], hashtags: [0, 3], formatos: ['video_animado', 'carrusel', 'imagen_estatica', 'solo_texto'], proporciones: ['1:1', '4:5', '9:16'] },
  linkedin: { palabras: [120, 300], hashtags: [0, 3], formatos: ['video_animado', 'carrusel', 'imagen_estatica', 'solo_texto'], proporciones: ['1:1', '1.91:1', '4:5'] },
};

export const LIMITES = {
  escenas: [3, 6], duracion: [8, 20], titularEscena: 7, apoyo: 14, cierre: 8,
  slides: [5, 10], portada: 6, tituloSlide: 7, textoSlide: 25, headline: 60,
};
export const pilarActivo = (p) => p.activo !== false;

export const needsApproval = (modo) => modo !== 'auto';
export const variantsFor = (modo) => (needsApproval(modo) ? 2 : 1);

export const hasEmoji = (s) => countEmoji(s) > 0;
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
const BAD_TAGS = ['#viral', '#fyp', '#explorepage', '#foryou', '#parati', '#explore'];

/** Devuelve la lista de errores (vacía = OK). */
export function validatePost(out, { perfil, plataforma, modo, historial = [], fechaCalculada, formatosPermitidos }) {
  const errs = [];
  const r = PLATFORM_RULES[plataforma];
  if (out.error) return [`El modelo devolvió error: ${out.error}`];
  if (out.plataforma !== plataforma) errs.push(`"plataforma" debe ser "${plataforma}".`);

  const pilares = (perfil.pilares_de_contenido || []).filter(pilarActivo);
  const pilar = pilares.find((p) => norm(p.nombre) === norm(out.pilar_de_contenido));
  if (!pilar) errs.push(`El pilar "${out.pilar_de_contenido}" no es un pilar activo del perfil. Usa uno de: ${pilares.map((p) => p.nombre).join(' | ')}.`);
  if (pilar?.requiere_fuente_real && !(perfil.blog_posts || []).length) errs.push(`El pilar "${pilar.nombre}" requiere un artículo real y no hay BLOG_POSTS_DISPONIBLES; elige otro pilar.`);

  const formatos = formatosPermitidos?.length ? formatosPermitidos.filter((f) => r.formatos.includes(f)) : r.formatos;
  if (!formatos.includes(out.formato_contenido) && !(pilar?.requiere_imagen_real && out.formato_contenido === 'imagen_estatica')) {
    errs.push(`Formato "${out.formato_contenido}" no permitido en ${plataforma}; usa ${formatos.join(' o ')}.`);
  }

  // ---- caption
  const nVar = variantsFor(modo);
  if ((out.variantes_copy || []).length !== nVar) errs.push(`Se requieren exactamente ${nVar} variante(s) de caption (modo ${modo}).`);
  for (const [i, v] of (out.variantes_copy || []).entries()) {
    const label = `Variante ${i + 1}`;
    const n = countWords(v.copy);
    if (n < r.palabras[0] || n > r.palabras[1]) errs.push(`${label}: el caption tiene ${n} palabras; debe tener entre ${r.palabras[0]} y ${r.palabras[1]}.`);
    const h = v.hashtags || [];
    if (h.length < r.hashtags[0] || h.length > r.hashtags[1]) errs.push(`${label}: ${h.length} hashtags; deben ser entre ${r.hashtags[0]} y ${r.hashtags[1]}.`);
    if (h.some((t) => !/^#[\p{L}\p{N}_]+$/u.test(t))) errs.push(`${label}: cada hashtag debe empezar con # y no llevar espacios ni signos.`);
    if (h.some((t) => BAD_TAGS.includes(t.toLowerCase()))) errs.push(`${label}: quita hashtags genéricos como #viral o #fyp; no describen nada.`);
    if (/(^|\s)#[\p{L}\p{N}_]+/u.test(v.copy)) errs.push(`${label}: los hashtags van en el arreglo "hashtags", no dentro del caption.`);
    for (const t of perfil.temas_prohibidos || []) {
      if (norm(v.copy).includes(norm(t))) errs.push(`${label}: menciona un tema prohibido ("${t}").`);
    }
    errs.push(...captionIssues(v.copy, { plataforma, perfil, trabajo: out.trabajo_caption, label }));
  }

  // ---- textos del visual
  const visualTexts = [out.headline_corto, out.subheadline, ...(out.animacion?.escenas || []).flatMap((e) => [e.titular, e.apoyo]), out.animacion?.cierre, ...(out.slides || []).flatMap((s) => [s.titulo, s.texto])].filter(Boolean);
  if (visualTexts.some(hasEmoji)) errs.push('Los textos en pantalla no pueden llevar emojis.');
  errs.push(...slopIssues(visualTexts.join('\n'), perfil, 'Textos en pantalla'));
  if (String(out.headline_corto || '').length > LIMITES.headline) errs.push(`"headline_corto" debe tener máximo ${LIMITES.headline} caracteres.`);
  if (out.formato_contenido !== 'solo_texto' && !(pilar?.requiere_imagen_real)) errs.push(...hookIssues(out));

  // ---- formato visual
  const f = out.formato_contenido;
  if (pilar?.requiere_imagen_real) {
    if (!out.requiere_asset_real) errs.push('El pilar requiere imagen real: "requiere_asset_real" debe ser true.');
    if (out.prompt_imagen) errs.push('El pilar requiere imagen real: "prompt_imagen" debe ser null.');
    if (out.animacion) errs.push('El pilar requiere imagen real: "animacion" debe ser null.');
    if (out.slides) errs.push('El pilar requiere imagen real: "slides" debe ser null.');
  } else if (pilar) {
    if (out.requiere_asset_real) errs.push('Este pilar no requiere asset real: "requiere_asset_real" debe ser false.');
    if (f === 'video_animado') {
      const a = out.animacion;
      if (!a) errs.push('Formato video_animado requiere el bloque "animacion".');
      else {
        const [e0, e1] = LIMITES.escenas, [d0, d1] = LIMITES.duracion;
        if (a.escenas.length < e0 || a.escenas.length > e1) errs.push(`El Reel debe tener de ${e0} a ${e1} escenas (gancho, lo que está en juego, cuerpo, remate).`);
        if (a.duracion_seg < d0 || a.duracion_seg > d1) errs.push(`"duracion_seg" debe estar entre ${d0} y ${d1}.`);
        a.escenas.forEach((e, i) => {
          if (screenWords(e.titular) > LIMITES.titularEscena) errs.push(`Escena ${i + 1}: el titular debe tener máximo ${LIMITES.titularEscena} palabras.`);
          if (countWords(e.apoyo) > LIMITES.apoyo) errs.push(`Escena ${i + 1}: el apoyo debe tener máximo ${LIMITES.apoyo} palabras.`);
        });
        if (screenWords(a.cierre) > LIMITES.cierre) errs.push(`El cierre debe tener máximo ${LIMITES.cierre} palabras.`);
        const palabras = a.escenas.reduce((s, e) => s + countWords(e.titular) + countWords(e.apoyo), 0) + countWords(a.cierre);
        const minDur = Math.ceil(palabras * 0.25 + 2);
        if (a.duracion_seg < minDur) errs.push(`Con ${palabras} palabras en pantalla el Reel necesita al menos ${minDur} s para leerse (~0.25 s por palabra + 2 s de cierre).`);
      }
      if (out.slides) errs.push('En video_animado "slides" debe ser null.');
    } else if (f === 'carrusel') {
      const sl = out.slides;
      const [s0, s1] = LIMITES.slides;
      if (!sl || sl.length < s0 || sl.length > s1) errs.push(`El carrusel debe tener de ${s0} a ${s1} slides (portada, lo que está en juego, una idea por slide, resumen, CTA).`);
      (sl || []).forEach((s, i) => {
        const max = i === 0 ? LIMITES.portada : LIMITES.tituloSlide;
        if (screenWords(s.titulo) > max) errs.push(`Slide ${i + 1}: el título debe tener máximo ${max} palabras${i === 0 ? ' (portada)' : ''}.`);
        if (countWords(s.texto) > LIMITES.textoSlide) errs.push(`Slide ${i + 1}: el texto debe tener máximo ${LIMITES.textoSlide} palabras; si no cabe, son dos slides.`);
      });
      if (out.animacion) errs.push('En carrusel "animacion" debe ser null.');
    } else if (out.animacion || out.slides) {
      errs.push(`En ${f} "animacion" y "slides" deben ser null.`);
    }
    if (out.prompt_imagen && !(perfil.imagenes_ia && f === 'imagen_estatica')) errs.push('"prompt_imagen" debe ser null (las imágenes con IA no están activadas para esta marca o este formato).');
  }
  if (!r.proporciones.includes(out.formato_imagen) && f !== 'solo_texto') errs.push(`"formato_imagen" para ${plataforma} debe ser ${r.proporciones.join(', ')}.`);
  if (plataforma === 'instagram' && f === 'video_animado' && out.formato_imagen !== '9:16') errs.push('Los Reels de Instagram van en 9:16 (vertical); si no, se ven con franjas y la historia sale recortada.');
  if (['imagen_estatica', 'carrusel'].includes(f) && out.formato_imagen === '9:16') errs.push('Imágenes y carruseles van en 4:5 o 1:1 (9:16 solo para videos).');

  // ---- rotación e historial
  const previas = historial.filter((h) => h.plataforma === plataforma);
  // Pilar: no repetir el de las últimas publicaciones (3 si hay pilares de sobra, si no la anterior).
  const ventana = pilares.length >= 6 ? 3 : pilares.length > 1 ? 1 : 0;
  if (previas.slice(0, ventana).some((h) => norm(h.pilar) === norm(out.pilar_de_contenido))) errs.push(`El pilar "${out.pilar_de_contenido}" ya se usó en ${ventana === 1 ? 'la publicación anterior' : `las últimas ${ventana} publicaciones`} de ${plataforma}; elige otro (de preferencia uno de "pilares_menos_usados").`);
  if (previas[0]?.tipo_post && previas[0].tipo_post === out.tipo_post) errs.push(`El tipo de post "${out.tipo_post}" ya se usó en la publicación anterior de ${plataforma}; elige otro.`);
  if (historial.some((h) => h.tema && norm(h.tema) === norm(out.tema))) errs.push(`El tema "${out.tema}" ya se publicó recientemente.`);
  if (previas.slice(0, 2).map((h) => h.estructura).includes(out.estructura)) errs.push(`La estructura "${out.estructura}" se usó en las 2 publicaciones anteriores de ${plataforma}; elige otra.`);
  if (fechaCalculada && out.fecha_sugerida !== fechaCalculada) errs.push(`"fecha_sugerida" debe ser exactamente ${fechaCalculada}.`);
  return [...new Set(errs)];
}
