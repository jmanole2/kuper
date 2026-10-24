// Animador: Claude escribe el código de cada pieza visual, el motor la prueba,
// Claude revisa una hoja de contacto como director de arte y corrige. Al final se renderiza.
import { pedirJSON } from '../llm/proveedor.js';
import fs from 'node:fs';
import path from 'node:path';
import { config, ROOT } from '../config.js';
import { Stage } from './render.js';
import { FALLBACK_CODE } from './fallback.js';

const SYSTEM = fs.readFileSync(path.join(ROOT, 'prompts/animador.md'), 'utf8')
  .replace('{{EJEMPLO}}', fs.readFileSync(path.join(ROOT, 'prompts/ejemplo-animacion.js'), 'utf8').trim());

const SCHEMA = {
  type: 'object',
  properties: {
    concepto: { type: 'string' },
    codigo: { type: 'string' },
    aprobado: { type: 'boolean' },
    problemas: { type: 'array', items: { type: 'string' } },
  },
  required: ['concepto', 'codigo', 'aprobado', 'problemas'],
  additionalProperties: false,
};

// Código que nunca debe aparecer: el motor ya bloquea la red, esto da un error claro antes.
const FORBIDDEN = [/\bfetch\s*\(/, /XMLHttpRequest/, /\bimport\s*[({]/, /\bimport\s+\w/, /\beval\s*\(/, /WebSocket/, /document\.(cookie|write)/, /localStorage/];

// Gemini gratis primero y Claude de respaldo (ver llm/proveedor.js).
async function ask(messages) {
  const { data, content } = await pedirJSON({ system: SYSTEM, messages, schema: SCHEMA, maxTokens: 64000, effort: config.animatorEffort, etiqueta: 'animador' });
  return { data, content };
}

function briefText(job) {
  const dims = { '9:16': '1080x1920', '4:5': '1080x1350', '1:1': '1080x1080', '1.91:1': '1200x628' }[job.formato];
  const queEs = job.kind === 'video' ? `un video animado (Reel) de ${job.duration} s`
    : job.kind === 'carrusel' ? `un carrusel de ${job.slides} slides` : 'una imagen fija';
  return [
    `## BRIEF`,
    `Pieza: ${queEs}, formato ${job.formato} (${dims} px), para ${job.plataforma}.`,
    `Marca: ${job.brand.name}. Colores: ${job.brand.colors.join(', ')}. Tipografía titulares: ${job.brand.fontHead}; texto: ${job.brand.fontBody}. Logo: ${job.brand.logoPath ? 'sí' : 'no (usa el nombre)'}.`,
    `Estilo visual de la marca: ${job.brand.style || 'sin indicaciones; propone uno coherente con la paleta'}.`,
    job.ideaVisual ? `Idea visual sugerida por el redactor (puedes mejorarla): ${job.ideaVisual}` : '',
    job.feedback ? `Comentarios del cliente sobre la versión anterior: ${job.feedback}` : '',
    job.anteriores?.length ? `## PIEZAS ANTERIORES DE ESTA MARCA (no las repitas)\nAsí se diseñaron las últimas. Mantén colores, tipografía y estilo de la marca, pero usa una composición, un recurso visual y una animación DISTINTOS a estos:\n${job.anteriores.map((a, i) => `${i + 1}. (${a.formato || 'pieza'}) ${a.concepto}`).join('\n')}` : '',
    `## K.content`,
    '```json', JSON.stringify(job.content, null, 2), '```',
  ].filter(Boolean).join('\n');
}

const fmtProbe = (p) => [...p.errors.map((e) => `ERROR: ${e}`), ...p.warnings.map((w) => `AVISO: ${w}`)].join('\n');

/**
 * Crea la pieza. job: { kind, formato, duration, slides, content, brand, plataforma, ideaVisual, feedback }
 * outBase: ruta sin extensión. Devuelve { video?, images[], cover, concepto, codigo, rondas, respaldo }.
 */
export async function createVisual(job, outBase, { log = () => {}, askFn = ask, useClaude = !config.mockLlm } = {}) {
  const stage = await Stage.open();
  try {
    let result = null;
    if (useClaude) {
      try { result = await designLoop(stage, job, log, askFn); } catch (e) { log(`Animador: ${e.message}. Se usa el diseño de respaldo.`); }
    }
    if (!result) {
      result = { concepto: 'Diseño de respaldo', codigo: FALLBACK_CODE, rondas: 0, respaldo: true };
    }
    await stage.load(job, result.codigo);
    return { ...result, ...(await renderFinal(stage, job, outBase)) };
  } finally {
    await stage.close();
  }
}

async function designLoop(stage, job, log, askFn) {
  const messages = [{ role: 'user', content: `${briefText(job)}\n\nDiseña la pieza y entrega el código.` }];
  let code = null, good = null, concepto = '', reviews = 0, rounds = 0;
  const MAX_ROUNDS = 6, MAX_REVIEWS = 2;

  while (rounds < MAX_ROUNDS) {
    rounds++;
    const { data, content } = await askFn(messages);
    messages.push({ role: 'assistant', content });
    if (data.concepto) concepto = data.concepto;
    const nuevo = data.codigo?.trim() ? data.codigo : null;
    const aprobado = data.aprobado && reviews > 0;
    if (aprobado && (!nuevo || nuevo === good)) return { concepto, codigo: good, rondas: rounds };
    if (aprobado) reviews = MAX_REVIEWS; // aprobó con un último ajuste: se prueba y se entrega
    if (nuevo) code = nuevo;
    if (!code) { messages.push({ role: 'user', content: 'Falta el código. Entrega setup y draw completos.' }); continue; }

    // 1) Revisión técnica
    const bad = FORBIDDEN.find((re) => re.test(code));
    let probe;
    if (bad) probe = { errors: [`El código usa algo no permitido (${bad.source}). Usa solo canvas 2D y el kit.`], warnings: [] };
    else {
      try { await stage.load(job, code); probe = await stage.probe(); } catch (e) { probe = { errors: [e.message], warnings: [] }; }
    }
    log(`Animador ronda ${rounds}: ${probe.errors.length} errores, ${probe.warnings.length} avisos`);
    if (probe.errors.length) {
      messages.push({ role: 'user', content: `El motor encontró problemas. Corrígelos y devuelve el código completo:\n${fmtProbe(probe)}` });
      continue;
    }
    good = code;
    if (reviews >= MAX_REVIEWS) return { concepto, codigo: good, rondas: rounds };

    // 2) Revisión visual: Claude ve su propia pieza
    reviews++;
    const sheet = await stage.sheet();
    messages.push({
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: sheet.toString('base64') } },
        { type: 'text', text: `Hoja de contacto de tu pieza (${job.kind === 'video' ? 'cuadros a lo largo del video' : 'todas las slides'}).` +
          (probe.warnings.length ? `\nAvisos automáticos:\n${fmtProbe(probe)}` : '') +
          `\nRevísala como director de arte (sección "Revisión"). Si la aprobarías para publicar, responde aprobado: true y codigo vacío. Si no, corrige y devuelve el código completo.` },
      ],
    });
  }
  if (good) return { concepto, codigo: good, rondas: rounds };
  throw new Error('no se obtuvo código que pase la revisión técnica');
}

async function renderFinal(stage, job, outBase) {
  if (job.kind === 'video') {
    const video = await stage.renderVideo(`${outBase}.mp4`, { seed: [...path.basename(outBase)].reduce((a, ch) => a + ch.charCodeAt(0), 0) });
    const cover = `${outBase}-portada.jpg`;
    // Portada: el cuadro al 35% suele tener el primer contenido ya armado.
    fs.writeFileSync(cover, await stage.capture(job.duration * 0.35, 'image/jpeg'));
    return { video, images: [], cover };
  }
  const images = await stage.renderStills(outBase);
  return { video: null, images, cover: images[0] };
}

/** Vuelve a renderizar un código ya aprobado (p. ej. tras cambiar el logo). */
export async function rerender(job, code, outBase) {
  const stage = await Stage.open();
  try {
    await stage.load(job, code);
    return await renderFinal(stage, job, outBase);
  } finally {
    await stage.close();
  }
}
