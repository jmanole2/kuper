// Calificación automática de cada llamada con una rúbrica (análisis de Retell al terminar la llamada).
// En negocio.json o en una demo: "rubrica": ["Saludó y se presentó", …] o "evaluar_llamadas": true (rúbrica de abajo).
// Retell llena "calificacion" (1 a 10) y "evaluacion" (qué cumplió, qué faltó y un consejo); llegan al panel en el resumen.

export const RUBRICA_DEFECTO = [
  'Saludó con calidez y se presentó con el nombre del negocio',
  'Entendió qué necesitaba la persona con preguntas claras',
  'Dio información correcta y no inventó precios ni datos',
  'Propuso el siguiente paso (cita, visita, cotización o contacto con el equipo)',
  'Tomó y confirmó los datos de contacto',
  'Cerró la llamada de forma amable y dejó claro qué sigue',
];

export function rubricaDe(cfg = {}) {
  if (Array.isArray(cfg.rubrica) && cfg.rubrica.some((x) => String(x).trim())) return cfg.rubrica.map((x) => String(x).trim()).filter(Boolean).slice(0, 12);
  return cfg.evaluar_llamadas === true ? RUBRICA_DEFECTO : null;
}

/** Campos extra de post_call_analysis_data (vacío si la demo no pide evaluación). */
export function camposAnalisis(cfg = {}) {
  const r = rubricaDe(cfg);
  if (!r) return [];
  const lista = r.map((x, i) => `${i + 1}. ${x}`).join(' ');
  return [
    { type: 'number', name: 'calificacion', description: `Calificación de 1 a 10 de cómo atendió la asistente, según estos criterios: ${lista}. 10 = cumplió todos de forma excelente. Si la persona colgó al inicio o no hubo conversación real, 0.` },
    { type: 'string', name: 'evaluacion', description: `Evaluación breve en español, máximo 3 líneas: "Cumplió: …" con los números de los criterios cumplidos, "Faltó: …" con los que no, y "Consejo: …" con una sola mejora concreta. Criterios: ${lista}` },
  ];
}

/** Texto para agregar al resumen que llega al panel. */
export function textoEvaluacion(datos = {}) {
  const n = Number(datos.calificacion);
  const ev = String(datos.evaluacion ?? '').trim();
  if (!(Number.isFinite(n) && n > 0) && !ev) return '';
  return [`Calificación de la llamada: ${Number.isFinite(n) && n > 0 ? `${Math.round(Math.min(10, n) * 10) / 10}/10` : 'sin calificar'}`, ev].filter(Boolean).join('\n');
}
