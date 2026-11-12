// Envío de pendientes con aprobación (demo para convocatorias): una lista de aplicantes, cada uno con lo que le falta,
// y el mensaje de WhatsApp que se le mandaría con el tono de su país. Sin IA: el texto sale igual siempre,
// porque cuando el negocio escribe primero Meta exige una plantilla aprobada (texto fijo con variables).
//
// En la demo (demos/<nombre>.json): "aplicantes": [{ id, nombre, negocio, pais, pendientes: [...], escribio_hace_h }]
// y "envios": { programa, fecha_limite, limite_diario }.

const MAX_FILAS = 300;

// Tono de cada país. {a} asistente, {n} nombre, {neg} negocio, {p} pendientes, {f} fecha límite, {prog} programa.
export const TONOS = {
  'México': '¡Hola, {n}! Soy {a}, de {prog}. Para que la postulación de {neg} siga en la convocatoria, te falta: {p}. ¿Me lo puedes mandar por aquí antes del {f}? Si tienes dudas, escríbeme.',
  Colombia: '¡Hola, {n}! ¿Cómo vas? Te escribe {a}, de {prog}. Para que la postulación de {neg} siga en proceso, nos hace falta: {p}. ¿Nos lo puedes enviar por acá antes del {f}? Quedo atenta a cualquier duda.',
  Argentina: '¡Hola, {n}! ¿Cómo andás? Soy {a}, de {prog}. Para que la postulación de {neg} siga en carrera, te falta: {p}. ¿Me lo podés mandar por acá antes del {f}? Cualquier duda, escribime.',
  'Perú': '¡Hola, {n}! ¿Qué tal? Te saluda {a}, de {prog}. Para que la postulación de {neg} continúe, nos falta: {p}. ¿Nos lo podrías enviar por aquí antes del {f}? Cualquier consulta, me escribes nomás.',
  Chile: '¡Hola, {n}! ¿Cómo estás? Soy {a}, de {prog}. Para que la postulación de {neg} siga en curso, te falta: {p}. ¿Me lo puedes enviar por acá antes del {f}? Cualquier duda, me escribes.',
};
const baja = (pais) => (pais === 'Argentina' ? 'Si ya no querés recibir estos mensajes, respondé BAJA.' : 'Si ya no quieres recibir estos mensajes, responde BAJA.');

const PAISES = Object.keys(TONOS);
const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export function paisDe(texto) {
  const t = sinAcentos(texto);
  return PAISES.find((p) => sinAcentos(p) === t) || ({ mx: 'México', co: 'Colombia', ar: 'Argentina', pe: 'Perú', cl: 'Chile' })[t] || 'México';
}

const enumerar = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
const primerNombre = (n) => String(n || '').trim().split(/\s+/)[0] || 'hola';

/** ¿Escribió en las últimas 24 h? Entonces el mensaje es libre y gratis; si no, va como plantilla (con costo). */
export function ventana(a) {
  const h = Number(a.escribio_hace_h);
  return a.escribio_hace_h !== null && a.escribio_hace_h !== undefined && a.escribio_hace_h !== '' && Number.isFinite(h) && h >= 0 && h < 24
    ? { abierta: true, texto: `Escribió hace ${Math.max(1, Math.round(h))} h · ventana de 24 h abierta: gratis` }
    : { abierta: false, texto: 'No ha escrito en 24 h · va como plantilla aprobada (con costo de Meta)' };
}

export function mensaje(demo, a) {
  const e = demo.envios || {};
  return `${TONOS[paisDe(a.pais)]
    .replace('{a}', demo.asistente || 'tu asistente')
    .replace('{n}', primerNombre(a.nombre))
    .replace('{prog}', e.programa || demo.negocio)
    .replace('{neg}', a.negocio || 'tu negocio')
    .replace('{p}', enumerar(a.pendientes || []))
    .replace('{f}', e.fecha_limite || 'la fecha límite')} ${baja(paisDe(a.pais))}`;
}

/** Limpia filas que vienen del navegador o de un CSV. */
export function normalizar(filas) {
  return (Array.isArray(filas) ? filas : []).slice(0, MAX_FILAS).map((f, i) => ({
    id: String(f?.id || `fila-${i + 1}`).replace(/[^\w-]/g, '').slice(0, 40) || `fila-${i + 1}`,
    nombre: String(f?.nombre || '').trim().slice(0, 80),
    negocio: String(f?.negocio || '').trim().slice(0, 80),
    pais: paisDe(f?.pais),
    whatsapp: String(f?.whatsapp || '').replace(/[^\d+ ]/g, '').slice(0, 20),
    pendientes: (Array.isArray(f?.pendientes) ? f.pendientes : String(f?.pendientes || '').split(/[;|]/)).map((x) => String(x).trim().slice(0, 120)).filter(Boolean).slice(0, 8),
    escribio_hace_h: f?.escribio_hace_h === '' || f?.escribio_hace_h === undefined ? null : f.escribio_hace_h,
  })).filter((f) => f.nombre && f.pendientes.length);
}

/** Lista lista para la página: cada aplicante con su mensaje y si cuesta o no. */
export function preparar(demo, filas) {
  return normalizar(filas).map((a) => ({ ...a, mensaje: mensaje(demo, a), ventana: ventana(a) }));
}

export const aplicanteDe = (demo, id) => (demo?.aplicantes || []).find((a) => a.id === id) || null;

/** Variables para que la asistente sepa con quién habla (llamada o chat) cuando se prueba "como" un aplicante. */
export function variables(demo, a) {
  const prog = demo.envios?.programa || demo.negocio;
  return {
    nombre_cliente: `${a.nombre}, de ${a.negocio} (${paisDe(a.pais)})`,
    motivo_llamada: `seguimiento de su postulación a ${prog}: le falta ${enumerar(a.pendientes)}; fecha límite ${demo.envios?.fecha_limite || 'por confirmar'}`,
    saludo: `Hola, ¿hablo con ${primerNombre(a.nombre)}? Te llama ${demo.asistente}, asistente virtual de ${prog}, por la postulación de ${a.negocio}. ¿${paisDe(a.pais) === 'Argentina' ? 'Tenés' : 'Tienes'} un minuto?`,
  };
}
