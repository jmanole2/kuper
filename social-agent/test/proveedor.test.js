// IA de los posts: Gemini gratis primero, Claude de respaldo cuando Gemini falla o se acaba su cupo.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.GEMINI_TEXT_API_KEY = 'gratis-123';
process.env.GEMINI_TEXT_MODEL = 'gemini-prueba';
delete process.env.ANTHROPIC_API_KEY;
const ia = await import('../src/llm/proveedor.js');
ia.hooks.esperaMs = 0;

const pedidos = [];
let respuestaGemini = () => ({ status: 200, body: { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'pensando…', thought: true }, { text: '{"ok":"gemini"}' }] } }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20 } } });
ia.hooks.fetch = async (url, opt) => {
  const body = JSON.parse(opt.body);
  pedidos.push({ url, headers: opt.headers, body });
  const r = respuestaGemini(body);
  return { ok: r.status === 200, status: r.status, json: async () => r.body };
};
const aClaude = [];
ia.hooks.anthropic = { beta: { messages: { stream: (args) => { aClaude.push(args); return { finalMessage: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"ok":"claude"}' }], usage: { input_tokens: 5, output_tokens: 3 } }) }; } } } };
const schema = { type: 'object', properties: { ok: { type: 'string' } }, required: ['ok'], additionalProperties: false };
const silencio = () => { const l = console.log, e = console.error; console.log = console.error = () => {}; return () => { console.log = l; console.error = e; }; };

test('Gemini va primero, con la clave gratis y el esquema JSON', async () => {
  const fin = silencio();
  const r = await ia.pedirJSON({ system: 'sys', messages: [{ role: 'user', content: 'hola' }], schema });
  fin();
  assert.deepEqual(r.data, { ok: 'gemini' }); assert.equal(r.proveedor, 'gemini');
  const p = pedidos.at(-1);
  assert.match(p.url, /models\/gemini-prueba:streamGenerateContent\?alt=sse$/);
  assert.equal(p.headers['x-goog-api-key'], 'gratis-123');
  assert.deepEqual(p.body.generationConfig.responseJsonSchema, schema);
  assert.equal(r.content, '{"ok":"gemini"}', 'no incluye el "pensamiento"');
  assert.equal(aClaude.length, 0);
});

test('mensajes de Claude se traducen: imágenes sí, razonamiento no', () => {
  const g = ia.aGemini([
    { role: 'user', content: 'brief' },
    { role: 'assistant', content: [{ type: 'thinking', thinking: 'x' }, { type: 'text', text: '{"a":1}' }] },
    { role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAA' } }, { type: 'text', text: 'revisa' }] },
  ]);
  assert.deepEqual(g, [
    { role: 'user', parts: [{ text: 'brief' }] },
    { role: 'model', parts: [{ text: '{"a":1}' }] },
    { role: 'user', parts: [{ inline_data: { mime_type: 'image/png', data: 'AAA' } }, { text: 'revisa' }] },
  ]);
});

test('si Gemini no acepta el esquema, lo pide con el esquema en las instrucciones', async () => {
  let n = 0;
  respuestaGemini = (body) => (n++ === 0 ? { status: 400, body: { error: { message: 'Invalid responseJsonSchema' } } } : { status: 200, body: { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"ok":"gemini"}' }] } }] } });
  const fin = silencio();
  const r = await ia.pedirJSON({ system: 'sys', messages: [{ role: 'user', content: 'hola' }], schema });
  fin();
  assert.equal(r.proveedor, 'gemini');
  const ult = pedidos.at(-1).body;
  assert.equal(ult.generationConfig.responseJsonSchema, undefined);
  assert.match(ult.systemInstruction.parts[0].text, /esquema/);
});

test('se acaba el cupo gratis: contesta Claude y Gemini se salta un rato', async () => {
  respuestaGemini = () => ({ status: 429, body: { error: { message: 'Resource has been exhausted (quota)' } } });
  const fin = silencio();
  const antes = pedidos.length;
  const r = await ia.pedirJSON({ system: 'sys', messages: [{ role: 'user', content: 'hola' }], schema });
  assert.deepEqual(r.data, { ok: 'claude' }); assert.equal(r.proveedor, 'anthropic');
  assert.equal(pedidos.length, antes + 1);
  await ia.pedirJSON({ system: 'sys', messages: [{ role: 'user', content: 'otra' }], schema });
  fin();
  assert.equal(pedidos.length, antes + 1, 'ya no le pregunta a Gemini mientras está en pausa');
  assert.equal(aClaude.length, 2);
  ia._reset();
});

test('si Gemini tarda demasiado, reintenta una vez antes de rendirse', async () => {
  let n = 0;
  const antes = ia.hooks.fetch;
  ia.hooks.fetch = async (url, opt) => { if (n++ === 0) throw new Error('The operation was aborted due to timeout'); return antes(url, opt); };
  respuestaGemini = () => ({ status: 200, body: { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"ok":"gemini"}' }] } }] } });
  const fin = silencio();
  const r = await ia.pedirJSON({ system: 's', messages: [{ role: 'user', content: 'x' }], schema });
  fin();
  ia.hooks.fetch = antes;
  assert.equal(r.proveedor, 'gemini'); assert.equal(n, 2);
  assert.equal(pedidos.at(-1).body.generationConfig.thinkingConfig.thinkingLevel, 'low', 'Gemini piensa poco');
});

test('si falla una corrección, el post se queda con la versión anterior (para revisión)', async () => {
  const { generatePost } = await import('../src/llm/claude.js');
  respuestaGemini = (() => { let k = 0; return () => (k++ === 0 ? { status: 200, body: { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"tema":"v1"}' }] } }] } } : { status: 400, body: { error: { message: 'bad' } } }); })();
  const claudeAntes = ia.hooks.anthropic;
  ia.hooks.anthropic = { beta: { messages: { stream: () => ({ finalMessage: async () => { throw new Error('sin crédito'); } }) } } };
  const fin = silencio();
  const r = await generatePost({ plataforma: 'instagram', perfil: {}, config: {}, historial: {}, competencia: null }, (out) => (out.tema === 'v1' ? ['falta algo'] : []));
  fin();
  ia.hooks.anthropic = claudeAntes; ia._reset();
  assert.deepEqual(r.out, { tema: 'v1' }); assert.deepEqual(r.errors, ['falta algo']);
});

test('Gemini en stream: junta los pedazos y si se corta la conexión reintenta', async () => {
  let n = 0;
  const antes = ia.hooks.fetch;
  ia.hooks.fetch = async (url) => {
    if (n++ === 0) { const e = new TypeError('fetch failed'); e.cause = { code: 'UND_ERR_HEADERS_TIMEOUT' }; throw e; }
    const sse = [
      { candidates: [{ content: { parts: [{ text: 'pienso', thought: true }] } }] },
      { candidates: [{ content: { parts: [{ text: '{"ok":' }] } }] },
      { candidates: [{ content: { parts: [{ text: '"stream"}' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4 } },
    ].map((x) => `data: ${JSON.stringify(x)}\r\n\r\n`).join('');
    return { ok: true, status: 200, text: async () => sse };
  };
  const fin = silencio();
  const r = await ia.pedirJSON({ system: 's', messages: [{ role: 'user', content: 'x' }], schema });
  fin();
  ia.hooks.fetch = antes;
  assert.deepEqual(r.data, { ok: 'stream' }); assert.equal(n, 2);
});
