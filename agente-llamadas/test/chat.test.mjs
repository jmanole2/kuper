// node --test agente-llamadas/test/chat.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hooks, limpiarMensajes, promptChat, responder } from '../chat.mjs';

const demo = JSON.parse(readFileSync(new URL('../demos/inhousework.json', import.meta.url), 'utf8'));
const env = { ANTHROPIC_API_KEY: 'k' };

test('el chat usa las instrucciones de la voz, sin variables de Retell y con reglas de texto', () => {
  const p = promptChat(demo, { infoPanel: 'Coyoacán sin lugares', ahora: Date.parse('2026-11-11T18:00:00Z') });
  assert.doesNotMatch(p, /\{\{/);
  assert.match(p, /Coyoacán sin lugares/);
  assert.match(p, /chat escrito/);
  assert.match(p, /Valeria/);
  assert.match(p, /noviembre/);
});

test('limpia la conversación: sin saludo inicial, roles alternados, textos acotados', () => {
  const m = limpiarMensajes([{ rol: 'assistant', texto: 'Hola' }, { rol: 'user', texto: 'a' }, { rol: 'user', texto: 'b' }, { rol: 'assistant', texto: 'c' }, { rol: 'user', texto: 'x'.repeat(5000) }]);
  assert.deepEqual(m.map((x) => x.role), ['user', 'assistant', 'user']);
  assert.equal(m[0].content, 'a\nb');
  assert.equal(m[2].content.length, 1200);
});

test('consulta disponibilidad con la herramienta y contesta con el resultado', async () => {
  const llamadas = [];
  hooks.fetch = async (_u, o) => {
    const b = JSON.parse(o.body); llamadas.push(b);
    if (llamadas.length === 1) return { ok: true, json: async () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'consultar_disponibilidad', input: { sede: 'Polanco' } }] }) };
    return { ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'En Polanco hay una oficina para 6.' }] }) };
  };
  const pedidos = [];
  const t = await responder({ cfg: demo, env, mensajes: [{ rol: 'user', texto: '¿Hay oficina en Polanco?' }], disponibilidad: async (a) => { pedidos.push(a); return 'Polanco: oficina 6 personas'; } });
  assert.equal(t, 'En Polanco hay una oficina para 6.');
  assert.deepEqual(pedidos, [{ sede: 'Polanco' }]);
  assert.equal(llamadas[0].tools[0].name, 'consultar_disponibilidad');
  assert.equal(llamadas[1].messages.at(-1).content[0].type, 'tool_result');
});

test('sin panel no manda herramientas; errores claros', async () => {
  hooks.fetch = async (_u, o) => { assert.equal(JSON.parse(o.body).tools, undefined); return { ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Hola' }] }) }; };
  assert.equal(await responder({ cfg: demo, env, mensajes: [{ rol: 'user', texto: 'hola' }] }), 'Hola');
  await assert.rejects(responder({ cfg: demo, env, mensajes: [] }), /sin_mensaje/);
  hooks.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'invalid x-api-key' } }) });
  await assert.rejects(responder({ cfg: demo, env, mensajes: [{ rol: 'user', texto: 'hola' }] }), /401/);
});
