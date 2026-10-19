// Generador falso para probar el flujo completo sin llamar a la API (MOCK_LLM=1).
import { PLATFORM_RULES, variantsFor } from '../rules.js';

const FILLER = ('Una marca clara ayuda a que tus clientes te reconozcan y te recuerden. Revisa cada punto de contacto, ' +
  'desde tu sitio hasta tus redes, y asegúrate de que todo cuente la misma historia con el mismo tono y los mismos ' +
  'colores. Empieza por lo que tus clientes ven primero y ajusta poco a poco sin perder tu esencia. ').split(' ').filter(Boolean);

const words = (n, seed = 0) => Array.from({ length: n }, (_, i) => FILLER[(i + seed) % FILLER.length]).join(' ');

export function mockPost({ plataforma, perfil, config, historial, fechaCalculada, feedback }) {
  const rules = PLATFORM_RULES[plataforma];
  const prev = historial.ultimas_publicaciones.find((h) => h.plataforma === plataforma);
  const pilares = perfil.pilares_de_contenido;
  const pilar = pilares.find((p) => !p.requiere_imagen_real && p.nombre !== prev?.pilar) || pilares[0];
  const allowed = config[plataforma].formatos?.length ? config[plataforma].formatos : rules.formatos;
  const formato = pilar.requiere_imagen_real ? 'imagen_estatica' : allowed.includes('video_animado') ? 'video_animado' : allowed[0];
  const n = Math.round((rules.palabras[0] + rules.palabras[1]) / 2);
  const nh = rules.hashtags[1];
  const stamp = Date.now() % 100000;
  const variantes = Array.from({ length: variantsFor(config[plataforma].modo_publicacion) }, (_, v) => ({
    copy: `${v ? 'Otra forma de verlo:' : 'Tu marca habla antes que tú.'} ${words(n - 6, v * 7)} ${perfil.cta_preferido}`.split(' ').slice(0, n).join(' '),
    hashtags: ['#marketingdigital', '#pymes', '#branding', '#mexico', '#emprendedores', '#diseno', '#redessociales', '#negocios'].slice(0, nh),
  }));
  return {
    error: null,
    cliente: perfil.cliente,
    plataforma,
    pilar_de_contenido: pilar.nombre,
    tema: `Tema de prueba ${stamp}${feedback ? ' (corregido)' : ''}`,
    formato_contenido: formato,
    variantes_copy: variantes,
    prompt_imagen: !pilar.requiere_imagen_real && formato === 'imagen_estatica' ? 'Ilustración minimalista 1:1, paleta de la marca, sin texto.' : null,
    animacion: !pilar.requiere_imagen_real && formato === 'video_animado' ? {
      duracion_seg: 9,
      escenas: [
        { titular: 'Tu marca habla primero', apoyo: 'Antes de que digas una palabra, tu imagen ya comunicó algo' },
        { titular: '3 señales de alerta', apoyo: 'Colores distintos, tono cambiante, logo pixelado' },
        { titular: 'Coherencia es confianza', apoyo: 'Un mismo estilo en todos lados te hace memorable' },
      ],
      cierre: perfil.cta_preferido,
    } : null,
    requiere_asset_real: !!pilar.requiere_imagen_real,
    alt_text: 'Gráfico con frases sobre coherencia de marca en los colores de la marca.',
    formato_imagen: formato === 'video_animado' && plataforma === 'instagram' ? '9:16' : plataforma === 'linkedin' ? '1:1' : '4:5',
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
