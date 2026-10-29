// Variedad: el sistema (no la IA) decide pilar, tipo de post, estructura, formato, fórmulas de gancho
// y dirección visual de cada pieza, rotando contra lo publicado. Si se deja a la IA, tiende a repetir
// el mismo tema, el mismo guion y el mismo video.
import { PLATFORM_RULES, pilarActivo } from './rules.js';

export const TIPOS = ['ensenanza', 'opinion', 'historia', 'prueba', 'oferta'];
export const ESTRUCTURAS = ['dato_curioso', 'mito_realidad', 'error_comun', 'checklist', 'antes_despues', 'pregunta_directa', 'comparacion', 'tendencia'];
export const FORMULAS_IDS = Array.from({ length: 26 }, (_, i) => i + 1);

// Recursos visuales que el animador puede hacer con canvas 2D y el kit, sin salirse del estilo de marca.
export const DIRECCIONES = [
  { id: 'tipografia_gigante', txt: 'Tipografía gigante: una palabra clave enorme que casi no cabe (recortada por el borde), el resto del texto pequeño alrededor. Nada más en pantalla.' },
  { id: 'chat', txt: 'Conversación en pantalla: burbujas de chat que aparecen una por una (escribiendo…, visto, hora), como una captura de celular estilizada.' },
  { id: 'dato_grande', txt: 'El número manda: una cifra enorme que cuenta (K.counter) y una gráfica simple que se dibuja (barras o línea).' },
  { id: 'checklist', txt: 'Lista que se va marcando: renglones con casilla que se palomean uno por uno; el último queda resaltado.' },
  { id: 'pantalla_dividida', txt: 'Pantalla dividida: dos mitades que se contrastan (antes / después, ellos / tú) con una línea que barre de un lado al otro.' },
  { id: 'linea_tiempo', txt: 'Línea de tiempo: un eje con puntos y horas o pasos que se van encendiendo en orden.' },
  { id: 'anillo', txt: 'Anillo de progreso o reloj: un círculo que se llena alrededor del titular, como cuenta regresiva o porcentaje.' },
  { id: 'rejilla_editorial', txt: 'Rejilla editorial tipo revista: módulos numerados separados por líneas finas, el titular ocupa dos módulos, mucho aire.' },
  { id: 'diagrama', txt: 'Diagrama de flujo: nodos conectados por líneas que se trazan (de A a B a C), mostrando un proceso.' },
  { id: 'tarjetas', txt: 'Tarjetas apiladas que se barajan: cada escena es una tarjeta que sale y deja ver la siguiente.' },
  { id: 'maquina_escribir', txt: 'Texto que se teclea con cursor parpadeante (style "type"), como una nota o un buscador; luego se tacha y se reescribe.' },
  { id: 'lupa', txt: 'Zoom: la cámara se acerca a un detalle (una palabra, una cifra) que crece hasta llenar la pantalla y revela el remate.' },
];

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();

// ------------------------------------------------------------ temas agotados
// Palabras demasiado generales para contar como "tema" (aparecen en casi cualquier post de un negocio).
const VACIAS = new Set(('para pero como cuando este esta esto estos estas porque sobre entre tiene tienes tener hasta desde todo todos toda todas nada cada solo tambien donde mucho muchos mismo misma otro otra otros otras ' +
  'antes despues ahora siempre nunca hacer hace haces puede puedes sabes saber quien cual cuales aqui alla menos mejor peor dias horas veces ' +
  'negocio negocios cliente clientes empresa empresas pyme pymes dueno duenos venta ventas vender vende tuyo tuya nuestro nuestra error errores').split(' '));
const raiz = (w) => w.slice(0, 6);
/** Raíces de las palabras con contenido de un texto. */
export function raices(texto) {
  return new Set(norm(texto).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 4 && !VACIAS.has(w)).map(raiz));
}
const textoDe = (h) => [h.tema, h.gancho, ...(h.titulares || [])].filter(Boolean).join(' ');
const textoSalida = (o) => [o.tema, o.ganchos?.[o.gancho_elegido ?? 0]?.en_pantalla, ...(o.animacion?.escenas || []).map((e) => e.titular), ...(o.slides || []).map((x) => x.titulo)].filter(Boolean).join(' ');

/** Palabras que ya salieron en muchos posts recientes (en 3 o más de los últimos 8, y en al menos 40%). */
export function temasAgotados(historial = []) {
  const vistos = new Set();
  const docs = [];
  for (const h of historial) {
    const k = norm(h.tema);
    if (!h.tema || vistos.has(k)) continue; // el mismo post en IG y FB cuenta una vez
    vistos.add(k); docs.push(h);
    if (docs.length >= 8) break;
  }
  if (docs.length < 3) return [];
  const df = new Map(), forma = new Map();
  for (const h of docs) {
    const palabras = norm(textoDe(h)).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 4 && !VACIAS.has(w));
    for (const w of palabras) if (!forma.has(raiz(w))) forma.set(raiz(w), w);
    for (const r of new Set(palabras.map(raiz))) df.set(r, (df.get(r) || 0) + 1);
  }
  const min = Math.max(3, Math.ceil(docs.length * 0.4));
  return [...df].filter(([, n]) => n >= min).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([r]) => forma.get(r));
}

/** Mezcla con desempate al azar: ordena por uso y, entre los igual de usados, al azar. */
function menosUsadosPrimero(opciones, usos, rand) {
  return opciones.map((o) => ({ o, n: usos.get(o) || 0, r: rand() })).sort((a, b) => a.n - b.n || a.r - b.r).map((x) => x.o);
}
function contar(lista) {
  const m = new Map();
  for (const x of lista) if (x != null) m.set(x, (m.get(x) || 0) + 1);
  return m;
}

/** Fórmula del gancho usado en un post guardado. */
export function formulaDe(salida) {
  const g = salida?.ganchos?.[salida?.gancho_elegido ?? 0];
  return Number.isInteger(g?.formula_id) ? g.formula_id : null;
}

/**
 * Receta del siguiente post. `historial`: lo reciente del cliente (más nuevo primero), con
 * { plataforma, pilar, tipo_post, estructura, formato, formula }.
 */
export function elegirReceta({ perfil, plataforma, historial = [], formatosPermitidos, tema, rand = Math.random }) {
  const previas = historial.filter((h) => h.plataforma === plataforma);
  const receta = {};

  // Pilar: el menos usado; nunca uno de los últimos (3 si hay muchos pilares, si no el anterior).
  if (!tema) {
    const pilares = (perfil?.pilares_de_contenido || []).filter(pilarActivo)
      .filter((p) => !p.requiere_imagen_real && !(p.requiere_fuente_real && !(perfil.blog_posts || []).length))
      .map((p) => p.nombre);
    if (pilares.length) {
      const ventana = pilares.length >= 6 ? 3 : pilares.length > 1 ? 1 : 0;
      const recientes = new Set(previas.slice(0, ventana).map((h) => norm(h.pilar)));
      const usos = contar(historial.map((h) => pilares.find((p) => norm(p) === norm(h.pilar))));
      const libres = pilares.filter((p) => !recientes.has(norm(p)));
      receta.pilar = menosUsadosPrimero(libres.length ? libres : pilares, usos, rand)[0];
    }
  }

  // Tipo de post: distinto al anterior; "oferta" máx. 1 de cada 4; "prueba" solo si la voz trae pruebas.
  const conPruebas = /prueba|caso|resultado|cliente/i.test(String(perfil?.voz || ''));
  let tipos = TIPOS.filter((t) => t !== previas[0]?.tipo_post && (t !== 'prueba' || conPruebas));
  if (previas.slice(0, 3).some((h) => h.tipo_post === 'oferta')) tipos = tipos.filter((t) => t !== 'oferta');
  receta.tipo_post = menosUsadosPrimero(tipos, contar(previas.slice(0, 8).map((h) => h.tipo_post)), rand)[0];

  // Estructura: ninguna de las 3 anteriores, la menos usada.
  const ultimas = new Set(previas.slice(0, 3).map((h) => h.estructura));
  receta.estructura = menosUsadosPrimero(ESTRUCTURAS.filter((e) => !ultimas.has(e)), contar(previas.slice(0, 10).map((h) => h.estructura)), rand)[0];

  // Formato: rota entre los permitidos (sin "solo texto" si hay visuales); el video pesa doble.
  const permitidos = (formatosPermitidos?.length ? formatosPermitidos : PLATFORM_RULES[plataforma]?.formatos || [])
    .filter((f) => (PLATFORM_RULES[plataforma]?.formatos || []).includes(f));
  const visuales = permitidos.filter((f) => f !== 'solo_texto');
  const opciones = visuales.length ? visuales : permitidos;
  if (opciones.length > 1) {
    const usos = contar(previas.slice(0, 6).map((h) => h.formato));
    if (usos.has('video_animado')) usos.set('video_animado', usos.get('video_animado') / 2);
    // Nunca tres seguidos del mismo formato.
    const mismo = previas[0]?.formato && previas.slice(0, 2).every((h) => h.formato === previas[0].formato) ? previas[0].formato : null;
    receta.formato = menosUsadosPrimero(opciones.filter((f) => f !== mismo), usos, rand)[0];
  } else if (opciones.length === 1) receta.formato = opciones[0];

  // Fórmulas de gancho: 5 que no se hayan usado en los últimos 10 posts.
  const usadas = new Set(historial.slice(0, 10).map((h) => h.formula).filter(Boolean));
  const libres = FORMULAS_IDS.filter((id) => !usadas.has(id));
  receta.formulas = menosUsadosPrimero(libres.length >= 5 ? libres : FORMULAS_IDS, new Map(), rand).slice(0, 5).sort((a, b) => a - b);

  // Temas agotados: no se tocan salvo que el pilar sea justo de eso. Con tema pedido no se impone nada.
  if (!tema) {
    const delPilar = raices(receta.pilar || '');
    const evitar = temasAgotados(historial).filter((w) => !delPilar.has(raiz(w)));
    if (evitar.length) receta.evitar = evitar;
    receta.recientes = historial.map((h) => h.tema).filter(Boolean).slice(0, 8);
  }
  return receta;
}

/** Errores si la salida no respetó la receta (se le devuelven a la IA para que corrija). */
export function erroresReceta(out, receta) {
  if (!receta) return [];
  const errs = [];
  if (receta.pilar && norm(out.pilar_de_contenido) !== norm(receta.pilar)) errs.push(`Este post es del pilar "${receta.pilar}" (asignado en RECETA_DE_ESTE_POST), no de "${out.pilar_de_contenido}".`);
  if (receta.estructura && out.estructura !== receta.estructura) errs.push(`La estructura asignada es "${receta.estructura}", no "${out.estructura}".`);
  if (receta.formato && out.formato_contenido !== receta.formato) errs.push(`El formato asignado es "${receta.formato}", no "${out.formato_contenido}".`);
  const propias = raices(textoSalida(out));
  const repetidas = (receta.evitar || []).filter((w) => propias.has(raiz(w)));
  if (repetidas.length) errs.push(`El post vuelve a hablar de ${repetidas.map((w) => `"${w}"`).join(', ')}, que ya salió en muchas publicaciones recientes. Busca otra idea del pilar "${receta.pilar || out.pilar_de_contenido}" que no toque eso (ni en el tema, ni en el gancho, ni en los titulares).`);
  const tema = raices(out.tema);
  for (const prev of receta.recientes || []) {
    const r = raices(prev);
    const comun = [...tema].filter((x) => r.has(x)).length;
    if (Math.min(tema.size, r.size) >= 3 && comun / Math.min(tema.size, r.size) >= 0.6) { errs.push(`El tema se parece demasiado a uno reciente ("${prev}"); elige otra idea.`); break; }
  }
  const f = formulaDe(out);
  if (receta.formulas?.length && f != null && !receta.formulas.includes(f)) errs.push(`El gancho elegido debe usar una de las fórmulas asignadas (${receta.formulas.join(', ')}); usaste la ${f}.`);
  return errs;
}

/** Dirección visual para el animador: la menos usada entre las piezas anteriores, nunca una de las 4 últimas. */
export function elegirDireccion(anteriores = [], rand = Math.random) {
  const ultimas = new Set(anteriores.slice(0, 4).map((a) => a.direccion).filter(Boolean));
  const opciones = DIRECCIONES.filter((d) => !ultimas.has(d.id));
  const usos = contar(anteriores.map((a) => a.direccion));
  return menosUsadosPrimero(opciones.length ? opciones : DIRECCIONES, new Map([...usos].map(([k, v]) => [DIRECCIONES.find((d) => d.id === k), v])), rand)[0];
}

/** Lo que el redactor necesita ver de cada post anterior para no repetir guion. */
export function resumenGuion(salida) {
  if (!salida) return {};
  const g = salida.ganchos?.[salida.gancho_elegido ?? 0];
  const titulares = (salida.animacion?.escenas || []).map((e) => e.titular)
    .concat((salida.slides || []).map((s) => s.titulo)).filter(Boolean).slice(0, 5);
  return {
    gancho: g?.en_pantalla || salida.headline_corto || null,
    formula: formulaDe(salida),
    ...(titulares.length ? { titulares } : {}),
  };
}
