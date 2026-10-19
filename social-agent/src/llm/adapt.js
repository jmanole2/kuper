// Adapta el texto de un post de Instagram para publicar el MISMO video/carrusel en otra red
// (Facebook o TikTok). Solo texto: no vuelve a animar nada, así que es barato y rápido.
import { config } from '../config.js';
import { callClaude } from './claude.js';
import { cleanText, slopIssues, findAsks } from '../textcheck.js';

const REGLAS = {
  facebook: `Red: FACEBOOK (página de empresa). Mismo video o carrusel que ya salió en Instagram.
- Facebook SÍ permite links clicables: si hay LINK_DESTINO, la acción es ir directo al link (escríbelo completo en su propia línea). Quita "comenta PALABRA": en Facebook no hay respuesta automática.
- 40 a 120 palabras. Primera línea fuerte (es lo que se ve antes de "Ver más").
- 0 a 3 hashtags, solo si aportan. Una sola acción.`,
  tiktok: `Red: TIKTOK. Mismo video que ya salió en Instagram.
- En TikTok los links del texto NO son clicables: no pongas URLs. Quita "comenta PALABRA y te mando…": en TikTok no hay DM automático, sería una promesa falsa.
- La acción: que vayan al link del perfil, o que sigan la cuenta para ver más; elige la que encaje.
- Muy corto: 8 a 40 palabras. La primera frase repite o remata el gancho del video.
- 3 a 5 hashtags de nicho en español (nada de #fyp, #parati, #viral).`,
};

const SYSTEM = `Eres el redactor de redes de una agencia. Adaptas el caption de un post de Instagram para publicar el mismo video o carrusel en otra red.
Respeta la voz de la marca (PERFIL), no inventes datos ni promesas que no estén en el caption original, y escribe en español de México.
Sin rayas largas (—), sin comillas curvas, sin muletillas de IA.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['copy', 'hashtags'],
  properties: {
    copy: { type: 'string', description: 'Caption adaptado, sin los hashtags' },
    hashtags: { type: 'array', items: { type: 'string' } },
  },
};

const URL_RE = /https?:\/\/\S+/; // sin /g: .test() no guarda estado entre llamadas

/** Link al que mandar a la gente (p. ej. el WhatsApp del agente de prueba), si la marca lo tiene. */
export function destinationLink(client) {
  return client.perfil.link_destino || (client.config.respuesta_palabra_clave?.mensaje || '').match(URL_RE)?.[0] || null;
}

export function adaptIssues(plataforma, { copy, hashtags }, perfil, link) {
  const errs = [...slopIssues(copy, perfil, 'Caption')];
  const words = (copy.match(/\S+/g) || []).filter((w) => !URL_RE.test(w)).length;
  const [min, max] = plataforma === 'tiktok' ? [8, 40] : [40, 120];
  if (words < min || words > max) errs.push(`El caption tiene ${words} palabras; debe tener entre ${min} y ${max}.`);
  const [hmin, hmax] = plataforma === 'tiktok' ? [3, 5] : [0, 3];
  if (hashtags.length < hmin || hashtags.length > hmax) errs.push(`Lleva ${hashtags.length} hashtags; deben ser entre ${hmin} y ${hmax}.`);
  if (/\bcomenta\b/i.test(copy)) errs.push('Quita "comenta PALABRA": en esta red no hay respuesta automática.');
  if (plataforma === 'tiktok' && URL_RE.test(copy)) errs.push('En TikTok no pongas links en el texto.');
  if (plataforma === 'facebook' && link && !copy.includes(link)) errs.push(`Incluye el link ${link} como la acción.`);
  if (findAsks(copy).length > 1) errs.push('Deja una sola acción.');
  return errs;
}

function mockAdapt(plataforma, post, link) {
  const base = post.copy_final.split('\n')[0];
  if (plataforma === 'tiktok') {
    return { copy: `${base} El link para probarlo está en el perfil.`, hashtags: ['#whatsappbusiness', '#pymes', '#atencionalcliente'] };
  }
  return { copy: `${post.copy_final.replace(/comenta[^\n.]*[.\n]?/gi, '').trim()}\n\nPruébalo aquí: ${link || 'escríbenos por Messenger'}`, hashtags: (post.hashtags || []).slice(0, 3) };
}

/** Devuelve { copy, hashtags, advertencias } para `plataforma` a partir del post de Instagram. */
export async function adaptCaption({ plataforma, post, client }) {
  // El link del DM de Instagram dice "vengo de Instagram"; en Facebook se cambia para saber de dónde llegó.
  const link = destinationLink(client)?.replace(/Instagram/g, plataforma === 'facebook' ? 'Facebook' : 'TikTok') || null;
  const clean = (r) => ({ copy: cleanText(r.copy).trim(), hashtags: (r.hashtags || []).map((h) => (h.startsWith('#') ? h : `#${h}`)) });
  if (config.mockLlm) return { ...clean(mockAdapt(plataforma, post, link)), advertencias: [] };

  const input = `${REGLAS[plataforma]}

PERFIL:
${JSON.stringify({ cliente: client.perfil.cliente, voz: client.perfil.voz, palabras_prohibidas: client.perfil.palabras_prohibidas, max_emojis: client.perfil.max_emojis }, null, 1)}

LINK_DESTINO: ${link || '(no hay)'}

TEMA DEL VIDEO: ${post.tema}
CAPTION_INSTAGRAM:
${post.copy_final}
HASHTAGS_INSTAGRAM: ${(post.hashtags || []).join(' ')}`;
  const messages = [{ role: 'user', content: input }];
  let out, errs = [];
  for (let round = 0; round < 3; round++) {
    const res = await callClaude({ system: SYSTEM, messages, schema: SCHEMA, maxTokens: 8000 });
    out = clean(res.data);
    errs = adaptIssues(plataforma, out, client.perfil, link);
    if (!errs.length) break;
    messages.push({ role: 'assistant', content: res.content });
    messages.push({ role: 'user', content: `Corrige esto y devuelve el JSON completo:\n- ${errs.join('\n- ')}` });
  }
  return { ...out, advertencias: errs.map((e) => `Validación: ${e}`) };
}
