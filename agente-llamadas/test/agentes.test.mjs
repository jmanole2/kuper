import test from 'node:test';
import assert from 'node:assert/strict';
import { agentePorNombre } from '../agentes.mjs';

test('busca por nombre con POST /v2/list-agents y sigue la paginación', async () => {
  const llamadas = [];
  globalThis.fetch = async (url, opt) => {
    llamadas.push({ url, opt });
    const pagina2 = String(url).includes('pagination_key=p2');
    return new Response(JSON.stringify(pagina2
      ? { items: [{ agent_id: 'a2', agent_name: 'Demo INHOUSE - Recepcion' }], has_more: false }
      : { items: [{ agent_id: 'a1', agent_name: 'Kuper - Agente de citas' }], has_more: true, pagination_key: 'p2' }), { status: 200 });
  };
  const a = await agentePorNombre('k', 'Demo INHOUSE - Recepcion');
  assert.equal(a.agent_id, 'a2');
  assert.equal(llamadas[0].opt.method, 'POST');
  assert.match(String(llamadas[0].url), /\/v2\/list-agents\?/);
  assert.equal(await agentePorNombre('k', 'No existe'), null);
});
