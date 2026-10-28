// Generador falso para probar el flujo completo sin llamar a la API (MOCK_LLM=1).
// Produce salidas que cumplen las reglas, con el mismo estilo que el ejemplo del prompt maestro.
import { PLATFORM_RULES, variantsFor, pilarActivo } from '../rules.js';

const ESTRUCTURAS = ['antes_despues', 'error_comun', 'checklist', 'mito_realidad', 'comparacion'];
const TIPOS = ['historia', 'ensenanza', 'opinion', 'ensenanza', 'oferta'];

const PARRAFOS = [
  'La mayoría de los clientes que escriben de noche no esperan a la mañana. Le escriben a dos o tres negocios y se quedan con el primero que contesta.',
  'Responder rápido no es cuestión de ganas. Nadie puede estar pegado al teléfono todo el día y además atender a quien tiene enfrente.',
  'Por eso conviene dejar listas las respuestas a lo que más te preguntan: horarios, precios, servicios y cómo agendar.',
  'Tú sigues atendiendo lo importante. Las preguntas repetidas ya no te quitan el día.',
  'Cuando el cliente recibe una respuesta clara en segundos, la conversación sigue contigo y no con el siguiente de la lista.',
  'Lo que cambia no es la herramienta, es cuánto tiempo pasa entre la pregunta y la respuesta.',
];

function caption({ plataforma, perfil, v, kw, trabajo }) {
  const r = PLATFORM_RULES[plataforma];
  const term = perfil.terminos_busqueda?.[0];
  const ask = `Comenta ${kw} y te mando más información.`;
  const first = trabajo === 'A' ? (v ? `Si contestas mensajes a mano, comenta ${kw} y te mando más información.` : ask)
    : v ? 'Nadie espera nueve horas una respuesta.' : 'El cliente que escribe de noche ya está comparando.';
  const body = [];
  if (term) body.push(`Esto aplica a cualquier ${term} que quieras armar: lo que cuenta es contestar a tiempo.`);
  let i = v * 2;
  const target = Math.round((r.palabras[0] + r.palabras[1]) / 2);
  const words = () => [first, ...body].join(' ').split(/\s+/).length;
  while (words() < target - 25) body.push(PARRAFOS[i++ % PARRAFOS.length]);
  if (trabajo !== 'A') body.push(ask);
  return [first, ...body].join('\n\n');
}

export function mockPost({ plataforma, perfil, config, historial, fechaCalculada, feedback, solicitud, receta }) {
  const rules = PLATFORM_RULES[plataforma];
  const prevs = historial.ultimas_publicaciones.filter((h) => h.plataforma === plataforma);
  const pilares = perfil.pilares_de_contenido.filter(pilarActivo).filter((p) => !p.requiere_fuente_real);
  const pilar = pilares.find((p) => p.nombre === receta?.pilar) || pilares.find((p) => !p.requiere_imagen_real && p.nombre !== prevs[0]?.pilar) || pilares[0];
  const allowed = (config[plataforma].formatos?.length ? config[plataforma].formatos : rules.formatos).filter((f) => rules.formatos.includes(f));
  const formato = pilar.requiere_imagen_real ? 'imagen_estatica' : receta?.formato || allowed[prevs.length % allowed.length];
  const estructura = receta?.estructura || ESTRUCTURAS.find((e) => !prevs.slice(0, 2).some((p) => p.estructura === e));
  const tipo_post = receta?.tipo_post || TIPOS.find((t) => t !== prevs[0]?.tipo_post);
  const kw = perfil.palabra_clave_cta || 'INFO';
  const sintetico = !pilar.requiere_imagen_real;
  const trabajo = formato === 'video_animado' ? 'A' : 'B';
  const stamp = Date.now() % 100000;
  const nTags = Math.min(3, rules.hashtags[1]);
  const variantes = Array.from({ length: variantsFor(config[plataforma].modo_publicacion) }, (_, v) => ({
    copy: caption({ plataforma, perfil, v, kw, trabajo }),
    hashtags: ['#AtencionAlCliente', '#WhatsAppBusiness', '#PyMEs'].slice(0, nTags),
  }));
  const ganchos = [
    { formula_id: 21, formula: 'Mid-Sentence Start', texto: '...y cuando le contestaste a las 9 de la mañana, ya había reservado en otro lado.', en_pantalla: 'Te escribió a las 11:47 p. m.' },
    { formula_id: 5, formula: 'Time Collapse', texto: 'De nueve horas a cuatro segundos: lo que tarda tu negocio en contestar.', en_pantalla: '9 horas vs. 4 segundos' },
    { formula_id: 1, formula: 'Cost Confession', texto: 'Ese cliente que te escribió de noche ya le compró a otro.', en_pantalla: 'Ese cliente ya compró' },
  ];
  if (receta?.formulas?.length >= 3) ganchos.forEach((g, i) => { g.formula_id = receta.formulas[i]; });
  const opening = formato === 'carrusel' ? ganchos[1].en_pantalla : ganchos[0].en_pantalla;
  return {
    error: null,
    cliente: perfil.cliente,
    plataforma,
    pilar_de_contenido: pilar.nombre,
    tipo_post,
    estructura,
    tema: solicitud ? `Sobre: ${solicitud}` : `Tema de prueba ${stamp}${feedback ? ' (corregido)' : ''}`,
    formato_contenido: formato,
    ganchos,
    gancho_elegido: formato === 'carrusel' ? 1 : 0,
    headline_corto: opening,
    subheadline: 'Le contestaste a las 9:12 a. m.',
    idea_visual: 'Dos horas enfrentadas, la del mensaje y la de la respuesta, unidas por una línea de luz.',
    trabajo_caption: trabajo,
    variantes_copy: variantes,
    prompt_imagen: null,
    animacion: sintetico && formato === 'video_animado' ? {
      duracion_seg: 16,
      escenas: [
        { titular: 'Te escribió a las 11:47 p. m.', apoyo: 'Quería agendar una cita para mañana.' },
        { titular: 'Le contestaste a las 9:12 a. m.', apoyo: 'Ya había reservado en otro lado.' },
        { titular: 'No perdiste por precio', apoyo: 'Perdiste por nueve horas de silencio.' },
        { titular: 'Tu agente contesta en segundos', apoyo: 'Con tus horarios, precios y servicios.' },
      ],
      cierre: `Comenta ${kw}`,
    } : null,
    slides: sintetico && formato === 'carrusel' ? [
      { titulo: '9 horas vs. 4 segundos', texto: 'Lo que tarda tu negocio en contestar, y lo que cuesta.' },
      { titulo: 'El que contesta primero, vende', texto: 'El cliente escribe a dos o tres negocios y se queda con el primero.' },
      { titulo: 'Un bot de menú no basta', texto: 'Si el cliente no puede escribir como habla, se va.' },
      { titulo: 'Deja listas tus respuestas', texto: 'Horarios, precios, servicios y cómo agendar.' },
      { titulo: 'En resumen', texto: 'Contesta en segundos, con información real, también de noche.' },
      { titulo: `Comenta ${kw}`, texto: 'Te mando más información.' },
    ] : null,
    requiere_asset_real: !sintetico,
    alt_text: 'Pieza oscura con dos horas en pantalla y una línea de luz azul entre ellas.',
    formato_imagen: formato === 'video_animado' ? (plataforma === 'linkedin' ? '1:1' : '9:16') : plataforma === 'linkedin' ? '1:1' : '4:5',
    cta: `Comenta ${kw}`,
    modo_publicacion: config[plataforma].modo_publicacion,
    fecha_sugerida: fechaCalculada,
    inspiracion_competencia: null,
    advertencias: ['Contenido de prueba generado con MOCK_LLM.'],
  };
}

export function mockCompetitors(data) {
  return {
    resumen: `Análisis de prueba de ${data.cuentas?.length ?? 0} cuentas.`,
    temas_frecuentes: ['casos de éxito', 'tips rápidos'],
    formatos_que_funcionan: ['Reels cortos con texto en pantalla'],
    ganchos_efectivos: ['Pregunta directa en la primera línea'],
    frecuencia_publicacion: '3 posts por semana en promedio',
    huecos_oportunidad: ['Nadie explica precios ni procesos'],
    posts_destacados: [],
    advertencias: ['Datos de prueba (MOCK_LLM).'],
  };
}
