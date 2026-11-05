// Busca un agente de voz por nombre en Retell (POST /v2/list-agents; el GET /list-agents ya no existe desde 07/2026).
export async function agentePorNombre(key, nombre) {
  let pagination_key;
  for (let i = 0; i < 20; i++) {
    const qs = new URLSearchParams({ limit: '1000', ...(pagination_key ? { pagination_key } : {}) });
    const pedir = (body) => fetch(`https://api.retellai.com/v2/list-agents?${qs}`, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    let r = await pedir({ filter_criteria: { channel: { op: 'eq', value: 'voice' } } });
    if (r.status === 400) r = await pedir({}); // por si cambia el formato del filtro
    if (!r.ok) throw new Error(`list-agents ${r.status}: ${await r.text()}`);
    const d = await r.json();
    const a = (d.items || []).find((x) => x.agent_name === nombre);
    if (a) return a;
    if (!d.has_more || !d.pagination_key) return null;
    pagination_key = d.pagination_key;
  }
  return null;
}
