// Reglas por plataforma y validación determinista de la salida del LLM
// (la sección 9 del prompt maestro, verificada en código).

export const PLATFORM_RULES = {
  instagram: { palabras: [80, 150], hashtags: [5, 8], formatos: ['video_animado', 'carrusel', 'imagen_estatica'], proporciones: ['1:1', '4:5', '9:16'] },
  facebook: { palabras: [60, 120], hashtags: [0, 3], formatos: ['video_animado', 'carrusel', 'imagen_estatica', 'solo_texto'], proporciones: ['1:1', '4:5', '9:16'] },
  linkedin: { palabras: [150, 300], hashtags: [0, 3], formatos: ['video_animado', 'carrusel', 'imagen_estatica', 'solo_texto'], proporciones: ['1:1', '1.91:1', '4:5'] },
};

export const LIMITES = { escenas: [2, 5], duracion: [6, 15], slides: [3, 7], tituloSlide: 60, textoSlide: 30, headline: 60 };
export const pilarActivo = (p) => p.activo !== false;

export const needsApproval = (modo) => modo !== 'auto';
export const variantsFor = (modo) => (needsApproval(modo) ? 2 : 1);

export const countWords = (s) => (String(s).trim().match(/\S+/g) || []).length;

const EMOJI_RE = /\p{Extended_Pictographic}/u;
export const hasEmoji = (s) => EMOJI_RE.test(s);

const GENERICAS = ['en el mundo de hoy', 'en la era digital', 'la clave del exito', 'hoy en dia', 'en el mundo digital'];
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

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

  const nVar = variantsFor(modo);
  if ((out.variantes_copy || []).length !== nVar) errs.push(`Se requieren exactamente ${nVar} variante(s) de copy (modo ${modo}).`);

  for (const [i, v] of (out.variantes_copy || []).entries()) {
    const n = countWords(v.copy);
    if (n < r.palabras[0] || n > r.palabras[1]) errs.push(`Variante ${i + 1}: el copy tiene ${n} palabras; debe tener entre ${r.palabras[0]} y ${r.palabras[1]}.`);
    const h = v.hashtags || [];
    if (h.length < r.hashtags[0] || h.length > r.hashtags[1]) errs.push(`Variante ${i + 1}: ${h.length} hashtags; deben ser entre ${r.hashtags[0]} y ${r.hashtags[1]}.`);
    if (h.some((t) => !/^#[\p{L}\p{N}_]+$/u.test(t))) errs.push(`Variante ${i + 1}: cada hashtag debe empezar con # y no llevar espacios ni signos.`);
    if (/(^|\s)#[\p{L}\p{N}_]+/u.test(v.copy)) errs.push(`Variante ${i + 1}: los hashtags van en el arreglo "hashtags", no dentro del copy.`);
    if (!perfil.permite_emojis && hasEmoji(v.copy + h.join(' '))) errs.push(`Variante ${i + 1}: contiene emojis y la marca no los permite.`);
    for (const t of perfil.temas_prohibidos || []) {
      if (norm(v.copy).includes(norm(t))) errs.push(`Variante ${i + 1}: menciona un tema prohibido ("${t}").`);
    }
    for (const g of GENERICAS) if (norm(v.copy).includes(g)) errs.push(`Variante ${i + 1}: usa la frase de relleno "${g}"; ve directo al punto.`);
  }

  const visualTexts = [out.headline_corto, ...(out.animacion?.escenas || []).flatMap((e) => [e.titular, e.apoyo]), out.animacion?.cierre, ...(out.slides || []).flatMap((s) => [s.titulo, s.texto])].filter(Boolean);
  if (!perfil.permite_emojis && visualTexts.some(hasEmoji)) errs.push('Los textos del visual contienen emojis y la marca no los permite.');
  if (String(out.headline_corto || '').length > LIMITES.headline) errs.push(`"headline_corto" debe tener máximo ${LIMITES.headline} caracteres.`);

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
        if (a.escenas.length < e0 || a.escenas.length > e1) errs.push(`La animación debe tener de ${e0} a ${e1} escenas.`);
        if (a.duracion_seg < d0 || a.duracion_seg > d1) errs.push(`"duracion_seg" debe estar entre ${d0} y ${d1}.`);
        a.escenas.forEach((e, i) => {
          if (countWords(e.titular) > 7) errs.push(`Escena ${i + 1}: el titular debe tener máximo 7 palabras.`);
          if (countWords(e.apoyo) > 14) errs.push(`Escena ${i + 1}: el apoyo debe tener máximo 14 palabras.`);
        });
        if (countWords(a.cierre) > 8) errs.push('El cierre de la animación debe tener máximo 8 palabras.');
      }
      if (out.slides) errs.push('En video_animado "slides" debe ser null.');
    } else if (f === 'carrusel') {
      const sl = out.slides;
      const [s0, s1] = LIMITES.slides;
      if (!sl || sl.length < s0 || sl.length > s1) errs.push(`Formato carrusel requiere de ${s0} a ${s1} slides.`);
      (sl || []).forEach((s, i) => {
        if (s.titulo.length > LIMITES.tituloSlide) errs.push(`Slide ${i + 1}: el título tiene ${s.titulo.length} caracteres (máximo ${LIMITES.tituloSlide}).`);
        if (countWords(s.texto) > LIMITES.textoSlide) errs.push(`Slide ${i + 1}: el texto debe tener máximo ${LIMITES.textoSlide} palabras.`);
      });
      if (out.animacion) errs.push('En carrusel "animacion" debe ser null.');
    } else if (out.animacion || out.slides) {
      errs.push(`En ${f} "animacion" y "slides" deben ser null.`);
    }
    if (out.prompt_imagen && !(perfil.imagenes_ia && f === 'imagen_estatica')) errs.push('"prompt_imagen" debe ser null (las imágenes con IA no están activadas para esta marca o este formato).');
  }
  if (!r.proporciones.includes(out.formato_imagen) && out.formato_contenido !== 'solo_texto') {
    errs.push(`"formato_imagen" para ${plataforma} debe ser ${r.proporciones.join(', ')}.`);
  }

  if (['imagen_estatica', 'carrusel'].includes(f) && out.formato_imagen === '9:16') {
    errs.push('Imágenes y carruseles van en 4:5 o 1:1 (9:16 solo para videos).');
  }

  const anterior = historial.find((h) => h.plataforma === plataforma);
  if (anterior && pilares.length > 1 && norm(anterior.pilar) === norm(out.pilar_de_contenido)) {
    errs.push(`El pilar "${out.pilar_de_contenido}" ya se usó en la publicación anterior de ${plataforma}; elige otro.`);
  }
  if (historial.some((h) => h.tema && norm(h.tema) === norm(out.tema))) errs.push(`El tema "${out.tema}" ya se publicó recientemente.`);
  const estructurasPrevias = historial.filter((h) => h.plataforma === plataforma).slice(0, 2).map((h) => h.estructura).filter(Boolean);
  if (estructurasPrevias.includes(out.estructura)) errs.push(`La estructura "${out.estructura}" se usó en las 2 publicaciones anteriores de ${plataforma}; elige otra.`);
  if (fechaCalculada && out.fecha_sugerida !== fechaCalculada) errs.push(`"fecha_sugerida" debe ser exactamente ${fechaCalculada}.`);
  return errs;
}
