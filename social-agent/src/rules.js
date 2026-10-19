// Reglas por plataforma y validación determinista de la salida del LLM
// (la sección 9 del prompt maestro, verificada en código).

export const PLATFORM_RULES = {
  instagram: { palabras: [80, 150], hashtags: [5, 8], formatos: ['imagen_estatica', 'video_animado'], proporciones: ['1:1', '4:5', '9:16'] },
  facebook: { palabras: [60, 120], hashtags: [0, 3], formatos: ['imagen_estatica', 'video_animado', 'solo_texto'], proporciones: ['1:1', '4:5', '9:16'] },
  linkedin: { palabras: [150, 300], hashtags: [0, 3], formatos: ['imagen_estatica', 'video_animado', 'solo_texto'], proporciones: ['1:1', '1.91:1', '4:5'] },
};

export const needsApproval = (modo) => modo !== 'auto';
export const variantsFor = (modo) => (needsApproval(modo) ? 2 : 1);

export const countWords = (s) => (String(s).trim().match(/\S+/g) || []).length;

const EMOJI_RE = /\p{Extended_Pictographic}/u;
export const hasEmoji = (s) => EMOJI_RE.test(s);

const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/** Devuelve la lista de errores (vacía = OK). */
export function validatePost(out, { perfil, plataforma, modo, historial = [], fechaCalculada, formatosPermitidos }) {
  const errs = [];
  const r = PLATFORM_RULES[plataforma];
  if (out.error) return [`El modelo devolvió error: ${out.error}`];
  if (out.plataforma !== plataforma) errs.push(`"plataforma" debe ser "${plataforma}".`);

  const pilares = (perfil.pilares_de_contenido || []);
  const pilar = pilares.find((p) => norm(p.nombre) === norm(out.pilar_de_contenido));
  if (!pilar) errs.push(`El pilar "${out.pilar_de_contenido}" no existe en el perfil. Usa uno de: ${pilares.map((p) => p.nombre).join(' | ')}.`);

  const formatos = formatosPermitidos?.length ? formatosPermitidos.filter((f) => r.formatos.includes(f)) : r.formatos;
  if (!formatos.includes(out.formato_contenido)) errs.push(`Formato "${out.formato_contenido}" no permitido en ${plataforma}; usa ${formatos.join(' o ')}.`);

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
  }

  if (pilar?.requiere_imagen_real) {
    if (!out.requiere_asset_real) errs.push('El pilar requiere imagen real: "requiere_asset_real" debe ser true.');
    if (out.prompt_imagen) errs.push('El pilar requiere imagen real: "prompt_imagen" debe ser null.');
    if (out.animacion) errs.push('El pilar requiere imagen real: "animacion" debe ser null.');
  } else if (pilar) {
    if (out.formato_contenido === 'video_animado') {
      const a = out.animacion;
      if (!a) errs.push('Formato video_animado requiere el bloque "animacion".');
      else {
        if (a.escenas.length < 2 || a.escenas.length > 4) errs.push('La animación debe tener de 2 a 4 escenas.');
        if (a.duracion_seg < 6 || a.duracion_seg > 12) errs.push('"duracion_seg" debe estar entre 6 y 12.');
        a.escenas.forEach((e, i) => {
          if (countWords(e.titular) > 6) errs.push(`Escena ${i + 1}: el titular debe tener máximo 6 palabras.`);
          if (countWords(e.apoyo) > 14) errs.push(`Escena ${i + 1}: el apoyo debe tener máximo 14 palabras.`);
        });
        if (countWords(a.cierre) > 8) errs.push('El cierre de la animación debe tener máximo 8 palabras.');
      }
      if (out.prompt_imagen) errs.push('En video_animado "prompt_imagen" debe ser null.');
    } else if (out.formato_contenido === 'imagen_estatica') {
      if (!out.prompt_imagen) errs.push('En imagen_estatica sin asset real se requiere "prompt_imagen".');
      if (out.animacion) errs.push('En imagen_estatica "animacion" debe ser null.');
    } else if (out.animacion || out.prompt_imagen) {
      errs.push('En solo_texto "prompt_imagen" y "animacion" deben ser null.');
    }
  }
  if (!r.proporciones.includes(out.formato_imagen) && out.formato_contenido !== 'solo_texto') {
    errs.push(`"formato_imagen" para ${plataforma} debe ser ${r.proporciones.join(', ')}.`);
  }

  if (plataforma === 'instagram' && out.formato_contenido === 'imagen_estatica' && !['1:1', '4:5'].includes(out.formato_imagen)) {
    errs.push('En Instagram una imagen de feed debe ser 1:1 o 4:5 (9:16 solo para Reels animados).');
  }

  const anterior = historial.find((h) => h.plataforma === plataforma);
  if (anterior && pilares.length > 1 && norm(anterior.pilar) === norm(out.pilar_de_contenido)) {
    errs.push(`El pilar "${out.pilar_de_contenido}" ya se usó en la publicación anterior de ${plataforma}; elige otro.`);
  }
  if (historial.some((h) => h.tema && norm(h.tema) === norm(out.tema))) errs.push(`El tema "${out.tema}" ya se publicó recientemente.`);
  if (fechaCalculada && out.fecha_sugerida !== fechaCalculada) errs.push(`"fecha_sugerida" debe ser exactamente ${fechaCalculada}.`);
  return errs;
}
