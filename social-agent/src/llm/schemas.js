// Esquemas JSON para salidas estructuradas (output_config.format).
const str = { type: 'string' };
const nullable = (s) => ({ anyOf: [s, { type: 'null' }] });
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

export const POST_SCHEMA = obj({
  error: nullable(str),
  cliente: str,
  plataforma: { type: 'string', enum: ['instagram', 'facebook', 'linkedin'] },
  pilar_de_contenido: str,
  estructura: { type: 'string', enum: ['dato_curioso', 'mito_realidad', 'error_comun', 'checklist', 'antes_despues', 'pregunta_directa', 'comparacion', 'tendencia'] },
  tema: str,
  formato_contenido: { type: 'string', enum: ['video_animado', 'carrusel', 'imagen_estatica', 'solo_texto'] },
  headline_corto: str,
  subheadline: str,
  idea_visual: str,
  variantes_copy: { type: 'array', items: obj({ copy: str, hashtags: { type: 'array', items: str } }) },
  prompt_imagen: nullable(str),
  animacion: nullable(obj({
    duracion_seg: { type: 'integer' },
    escenas: { type: 'array', items: obj({ titular: str, apoyo: str }) },
    cierre: str,
  })),
  slides: nullable({ type: 'array', items: obj({ titulo: str, texto: str }) }),
  requiere_asset_real: { type: 'boolean' },
  alt_text: str,
  formato_imagen: { type: 'string', enum: ['1:1', '4:5', '9:16', '1.91:1'] },
  cta: str,
  modo_publicacion: str,
  fecha_sugerida: str,
  inspiracion_competencia: nullable(str),
  advertencias: { type: 'array', items: str },
});

export const COMPETITOR_SCHEMA = obj({
  resumen: str,
  temas_frecuentes: { type: 'array', items: str },
  formatos_que_funcionan: { type: 'array', items: str },
  ganchos_efectivos: { type: 'array', items: str },
  frecuencia_publicacion: str,
  huecos_oportunidad: { type: 'array', items: str },
  posts_destacados: {
    type: 'array',
    items: obj({ competidor: str, permalink: str, engagement: str, por_que_funciono: str }),
  },
  advertencias: { type: 'array', items: str },
});
