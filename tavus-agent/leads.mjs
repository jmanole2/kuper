// Prospectos: guarda cada llamada, baja la transcripción de Tavus al terminar,
// saca los datos del cliente + un resumen con una IA y los manda al panel (webhook).
import fs from 'node:fs';
import path from 'node:path';

export function createLeads({ dir, tavus, env = process.env, log = console }) {
  const file = path.join(dir, 'data', 'leads.json');
  const processing = new Set();

  const load = () => {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
  };
  const save = (leads) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file + '.tmp', JSON.stringify(leads, null, 2));
    fs.renameSync(file + '.tmp', file);
  };
  const update = (id, patch) => {
    const leads = load();
    const lead = leads.find((l) => l.conversationId === id);
    if (!lead) return null;
    Object.assign(lead, patch, { updatedAt: new Date().toISOString() });
    save(leads);
    return lead;
  };

  function add({ conversationId, agentName, maxCallSeconds }) {
    const leads = load();
    leads.unshift({
      conversationId,
      agentName,
      status: 'en_curso',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (maxCallSeconds + 60) * 1000).toISOString(),
    });
    save(leads);
  }

  // Tavus publica la transcripción unos segundos después de colgar.
  async function fetchTranscript(id) {
    for (let i = 0; i < 18; i++) {
      const conv = await tavus('GET', `/conversations/${id}?verbose=true`);
      const ev = (conv.events || []).find((e) => e.event_type === 'application.transcription_ready');
      const turns = ev?.properties?.transcript;
      if (turns) return turns.filter((t) => t.role === 'user' || t.role === 'assistant')
        .map((t) => ({ role: t.role === 'user' ? 'cliente' : 'agente', text: t.content }));
      if (conv.status !== 'ended' && i === 0) await tavus('POST', `/conversations/${id}/end`).catch(() => {});
      await new Promise((r) => setTimeout(r, 10_000));
    }
    return null;
  }

  async function summarize(transcript) {
    const text = transcript.map((t) => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
    const fallback = {
      telefono: text.match(/\+?\d[\d\s-]{7,}\d/)?.[0] || '',
      correo: text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] || '',
    };
    const base = env.SUMMARY_API_BASE || 'https://generativelanguage.googleapis.com/v1beta/openai';
    const key = env.SUMMARY_API_KEY;
    if (!key && !/localhost|127\.0\.0\.1/.test(base)) return { ...fallback, resumen: '', aviso: 'Sin SUMMARY_API_KEY: no se generó resumen.' };

    const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({
        model: env.SUMMARY_MODEL || 'gemini-2.5-flash',
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'Analizas transcripciones de videollamadas de ventas de Kuper Media (agencia de marketing e IA en México). Responde SOLO con un objeto JSON válido, sin texto extra.' },
          { role: 'user', content: `Extrae de esta llamada:
{"nombre": "", "negocio": "", "telefono": "", "correo": "", "necesidad": "qué quiere resolver", "servicio_interes": "", "interes": "alto|medio|bajo", "cita": "fecha/hora si se acordó, si no vacío", "siguientes_pasos": "", "resumen": "3-4 frases"}
Deja "" lo que no se mencione. No inventes datos.

TRANSCRIPCIÓN:
${text}` },
        ],
      }),
    });
    if (!res.ok) throw new Error(`IA de resumen ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const content = (await res.json()).choices?.[0]?.message?.content || '';
    const json = content.match(/\{[\s\S]*\}/)?.[0];
    if (!json) throw new Error('La IA no devolvió JSON: ' + content.slice(0, 200));
    const data = JSON.parse(json);
    return { ...data, telefono: data.telefono || fallback.telefono, correo: data.correo || fallback.correo };
  }

  async function notifyPanel(lead) {
    if (!env.PANEL_WEBHOOK_URL) return;
    const res = await fetch(env.PANEL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': env.PANEL_WEBHOOK_SECRET || '' },
      body: JSON.stringify({ tipo: 'videollamada', ...lead }),
    });
    if (!res.ok) throw new Error(`Panel respondió ${res.status}`);
  }

  async function processLead(id) {
    if (processing.has(id)) return;
    processing.add(id);
    try {
      update(id, { status: 'procesando', endedAt: new Date().toISOString() });
      const transcript = await fetchTranscript(id);
      if (!transcript?.length) {
        update(id, { status: 'sin_conversacion', transcript: transcript || [] });
        return;
      }
      update(id, { transcript });
      let datos = {};
      try { datos = await summarize(transcript); } catch (err) {
        log.error('Resumen:', err.message);
        datos = { aviso: err.message };
      }
      const lead = update(id, { status: 'listo', datos });
      try {
        await notifyPanel(lead);
        update(id, { enviadoAlPanel: Boolean(env.PANEL_WEBHOOK_URL) });
      } catch (err) {
        log.error('Webhook del panel:', err.message);
        update(id, { enviadoAlPanel: false, errorPanel: err.message });
      }
      log.log(`Prospecto listo: ${datos.nombre || id} (${datos.interes || 'sin datos'})`);
    } catch (err) {
      log.error(`Procesando ${id}:`, err.message);
      update(id, { status: 'error', error: err.message });
    } finally {
      processing.delete(id);
    }
  }

  // Por si cerraron la pestaña sin colgar o se reinició el servidor.
  function sweep() {
    const now = Date.now();
    for (const l of load()) {
      const stale = l.status === 'en_curso' && Date.parse(l.expiresAt) < now;
      const stuck = l.status === 'procesando' && !processing.has(l.conversationId);
      if (stale || stuck) processLead(l.conversationId);
    }
  }

  return { add, load, processLead, sweep };
}
