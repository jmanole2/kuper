// Llamadas a Claude: generación de posts y análisis de competencia.
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';
import { config, ROOT } from '../config.js';
import { POST_SCHEMA, COMPETITOR_SCHEMA } from './schemas.js';
import { mockPost, mockCompetitors } from './mock.js';

const MAESTRO = fs.readFileSync(path.join(ROOT, 'prompts/maestro.md'), 'utf8');

const COMPETENCIA_SYSTEM = `Eres analista de redes sociales de una agencia de marketing.
Recibes datos públicos reales de cuentas de la competencia de un cliente (obtenidos de la API oficial de Instagram) y notas manuales de la agencia.
Tu trabajo: detectar qué temas, formatos y ganchos generan más interacción en ese nicho, con qué frecuencia publican, y sobre todo qué huecos de oportunidad deja la competencia que el cliente podría ocupar.
Reglas:
- Basa todo SOLO en los datos recibidos. No inventes cifras. Si los datos son pocos, dilo en "advertencias".
- Calcula el engagement de un post como (likes + comentarios) / seguidores cuando tengas esos datos.
- "posts_destacados": máximo 5, con el permalink tal cual viene en los datos.
- Escribe en español (México), concreto y accionable.`;

let client;
const anthropic = () => (client ??= new Anthropic());

class RefusalError extends Error {}

async function callClaude({ system, messages, schema, maxTokens = 32000 }) {
  const stream = anthropic().beta.messages.stream({
    model: config.anthropicModel,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    output_config: { effort: config.anthropicEffort, format: { type: 'json_schema', schema } },
    // Si el modelo declina por política, el servidor reintenta con el modelo de respaldo recomendado.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages,
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') {
    throw new RefusalError(`Claude declinó la solicitud (${msg.stop_details?.category ?? 'sin categoría'}).`);
  }
  if (msg.stop_reason === 'max_tokens') throw new Error('La respuesta se cortó por max_tokens.');
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { data: JSON.parse(text), content: msg.content, usage: msg.usage };
}

/**
 * Genera un post. `validate(out)` devuelve la lista de errores; si hay errores
 * se le devuelven a Claude para que corrija (hasta `maxRounds` veces).
 */
export async function generatePost(input, validate, { maxRounds = 2 } = {}) {
  if (config.mockLlm) {
    const out = mockPost(input);
    return { out, errors: validate(out), rounds: 0 };
  }
  const messages = [{ role: 'user', content: renderInput(input) }];
  let out, errors = [];
  for (let round = 0; round <= maxRounds; round++) {
    const res = await callClaude({ system: MAESTRO, messages, schema: POST_SCHEMA });
    out = res.data;
    errors = validate(out);
    if (!errors.length || round === maxRounds) return { out, errors, rounds: round };
    // Se agrega la respuesta completa (incluye bloques de razonamiento) y luego las correcciones.
    messages.push({ role: 'assistant', content: res.content });
    messages.push({
      role: 'user',
      content: `El backend validó tu salida y encontró estos problemas. Corrígelos todos y devuelve el JSON completo de nuevo:\n- ${errors.join('\n- ')}`,
    });
  }
  return { out, errors };
}

function renderInput(i) {
  const blocks = [
    ['PLATAFORMA_OBJETIVO', i.plataforma],
    ['PERFIL_DE_MARCA', i.perfil],
    ['CONFIG_PLATAFORMA', i.config],
    ['HISTORIAL_RECIENTE', i.historial],
    ['INSIGHTS_COMPETENCIA', i.competencia ?? 'Sin análisis de competencia disponible.'],
  ];
  if (i.feedback) blocks.push(['FEEDBACK_CLIENTE', i.feedback]);
  return blocks
    .map(([k, v]) => `## ${k}\n${typeof v === 'string' ? v : '```json\n' + JSON.stringify(v, null, 2) + '\n```'}`)
    .join('\n\n') + `\n\nGenera el post para ${i.plataforma}.`;
}

export async function analyzeCompetitors({ perfil, data, notas }) {
  if (config.mockLlm) return mockCompetitors(data);
  const content = `## CLIENTE\n${perfil.cliente} — ${perfil.giro}\nBuyer persona: ${perfil.buyer_persona}\n\n` +
    `## DATOS_COMPETENCIA (API de Instagram)\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n\n` +
    `## NOTAS_DE_LA_AGENCIA\n${notas || 'Ninguna.'}`;
  const res = await callClaude({ system: COMPETENCIA_SYSTEM, messages: [{ role: 'user', content }], schema: COMPETITOR_SCHEMA });
  return res.data;
}

export { RefusalError };
