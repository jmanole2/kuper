// Generador falso para probar el flujo completo sin llamar a la API (MOCK_LLM=1).
import { PLATFORM_RULES, variantsFor, pilarActivo } from '../rules.js';

const FILLER = ('Una marca clara ayuda a que tus clientes te reconozcan y te recuerden. Revisa cada punto de contacto, ' +
  'desde tu sitio hasta tus redes, y asegúrate de que todo cuente la misma historia con el mismo tono y los mismos ' +
  'colores. Empieza por lo que tus clientes ven primero y ajusta poco a poco sin perder tu esencia. ').split(' ').filter(Boolean);
const ESTRUCTURAS = ['error_comun', 'checklist', 'mito_realidad', 'dato_curioso', 'comparacion'];

const words = (n, seed = 0) => Array.from({ length: n }, (_, i) => FILLER[(i + seed) % FILLER.length]).join(' ');

export function mockPost({ plataforma, perfil, config, historial, fechaCalculada, feedback }) {
  const rules = PLATFORM_RULES[plataforma];
  const prevs = historial.ultimas_publicaciones.filter((h) => h.plataforma === plataforma);
  const pilares = perfil.pilares_de_contenido.filter(pilarActivo).filter((p) => !p.requiere_fuente_real);
  const pilar = pilares.find((p) => !p.requiere_imagen_real && p.nombre !== prevs[0]?.pilar) || pilares[0];
  const allowed = (config[plataforma].formatos?.length ? config[plataforma].formatos : rules.formatos).filter((f) => rules.formatos.includes(f));
  const formato = pilar.requiere_imagen_real ? 'imagen_estatica' : allowed[prevs.length % allowed.length];
  const estructura = ESTRUCTURAS.find((e) => !prevs.slice(0, 2).some((p) => p.estructura === e));
  const n = Math.round((rules.palabras[0] + rules.palabras[1]) / 2);
  const stamp = Date.now() % 100000;
  const variantes = Array.from({ length: variantsFor(config[plataforma].modo_publicacion) }, (_, v) => ({
    copy: `${v ? 'Otra forma de verlo:' : 'Tu marca habla antes que tú.'} ${words(n - 6, v * 7)} ${perfil.cta_preferido}`.split(' ').slice(0, n).join(' '),
    hashtags: ['#marketingdigital', '#pymes', '#branding', '#mexico', '#emprendedores', '#diseno', '#redessociales', '#negocios'].slice(0, rules.hashtags[1]),
  }));
  const sintetico = !pilar.requiere_imagen_real;
  return {
    error: null,
    cliente: perfil.cliente,
    plataforma,
    pilar_de_contenido: pilar.nombre,
    estructura,
    tema: `Tema de prueba ${stamp}${feedback ? ' (corregido)' : ''}`,
    formato_contenido: formato,
    headline_corto: '3 errores al usar IA en tu PyME',
    subheadline: 'Y cómo corregirlos esta semana',
    idea_visual: 'Cada error aparece en una tarjeta, se tacha y debajo se escribe la corrección.',
    variantes_copy: variantes,
    prompt_imagen: null,
    animacion: sintetico && formato === 'video_animado' ? {
      duracion_seg: 10,
      escenas: [
        { titular: 'Usarla sin un objetivo claro', apoyo: 'Define primero qué tarea quieres ahorrar' },
        { titular: 'Publicar lo que escribe tal cual', apoyo: 'Revisa y ajusta a tu tono de marca' },
        { titular: 'Pagar cinco herramientas a la vez', apoyo: 'Empieza con una y mide resultados' },
      ],
      cierre: 'Usa la IA con estrategia',
    } : null,
    slides: sintetico && formato === 'carrusel' ? [
      { titulo: '3 errores al usar IA en tu PyME', texto: '' },
      { titulo: 'Usarla sin un objetivo claro', texto: 'Define primero qué tarea repetitiva quieres ahorrar.' },
      { titulo: 'Publicar lo que escribe tal cual', texto: 'Revisa cada texto y ajústalo a tu tono de marca.' },
      { titulo: 'Usa la IA con estrategia', texto: 'Empieza con una herramienta y mide resultados.' },
    ] : null,
    requiere_asset_real: !sintetico,
    alt_text: 'Gráfico con tarjetas sobre errores comunes al usar IA en una PyME.',
    formato_imagen: formato === 'video_animado' ? (plataforma === 'linkedin' ? '1:1' : '9:16') : plataforma === 'linkedin' ? '1:1' : '4:5',
    cta: perfil.cta_preferido,
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
