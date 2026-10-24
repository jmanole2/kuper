// ¿Por qué no se están generando publicaciones? Revisa cada cliente con redes y lo explica en palabras simples.
// Solo lee la base (no cambia nada).   npm run diagnostico-posts
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../src/config.js';

const db = new DatabaseSync(path.join(config.dataDir, 'agente.db'), { readOnly: true });
const tz = config.timezone;
const hora = new Intl.DateTimeFormat('es-MX', { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' });
const f = (t) => (t ? hora.format(new Date(String(t).includes('T') ? t : String(t).replace(' ', 'T') + 'Z')) : '—');
const ABIERTOS = ['generando', 'necesita_asset', 'pendiente', 'cambios_solicitados', 'aprobado', 'publicando'];
const NOMBRE = { generando: 'generándose', necesita_asset: 'esperando una foto o video del cliente', pendiente: 'esperando que el cliente lo apruebe', cambios_solicitados: 'con cambios pedidos', aprobado: 'aprobado, esperando su fecha', publicando: 'publicándose' };
const FREQ = { diario: 'diario', '3_por_semana': '3 por semana (cada 2 días)', '2_por_semana': '2 por semana', semanal: '1 por semana', quincenal: 'cada 15 días', mensual: '1 al mes' };

console.log('\n== Generales');
console.log(`Programador: ${config.schedulerEnabled ? 'encendido' : 'APAGADO (SCHEDULER=0 en .env)'}`);
console.log(`Genera solo de ${config.horasGeneracion} h (hora de ${tz}), máximo ${config.maxPiezasDia} pieza(s) al día entre TODOS los clientes, hasta ${config.leadDays} días antes de su fecha.`);
const ordenIa = (config.postsLlmOrden || 'gemini,anthropic').split(',').map((x) => x.trim());
const ias = ordenIa.map((p) => (p === 'gemini' ? `Gemini ${config.geminiTextModel} (${config.geminiTextApiKey ? 'clave sí' : 'SIN CLAVE: se salta'})` : `Claude ${config.anthropicModel} (${process.env.ANTHROPIC_API_KEY ? 'clave sí' : 'SIN CLAVE'})`));
console.log(`IA, en orden: ${config.mockLlm ? 'FALSA (MOCK_LLM=1)' : ias.join(' → ')}`);
const hoy = db.prepare("SELECT COUNT(*) n FROM events WHERE tipo = 'generado' AND created_at >= datetime('now','-1 day')").get().n;
console.log(`Generadas en las últimas 24 h: ${hoy}`);

for (const c of db.prepare('SELECT * FROM clients WHERE activo = 1').all()) {
  const cfg = JSON.parse(c.config_json || '{}');
  const redesContratado = cfg.plan?.servicios ? cfg.plan.servicios.redes !== false : true;
  console.log(`\n== ${c.nombre}`);
  if (!redesContratado) { console.log('  No tiene contratado "Redes sociales": no se generan posts.'); continue; }
  if (cfg.plan?.posts_semana) console.log(`  Plan: ${cfg.plan.posts_semana} publicaciones por semana (ojo: lo que manda es la frecuencia de cada red, abajo).`);
  for (const red of ['instagram', 'facebook', 'linkedin', 'tiktok']) {
    const r = cfg[red] || {};
    if (!r.activo) continue;
    const reusa = red !== 'instagram' && (red === 'tiktok' || r.reusar_instagram);
    const abierto = db.prepare(`SELECT id, status, scheduled_at, updated_at FROM posts WHERE client_id = ? AND plataforma = ? AND status IN (${ABIERTOS.map(() => '?').join(',')}) ORDER BY id DESC LIMIT 1`).get(c.id, red, ...ABIERTOS);
    const ultimo = db.prepare("SELECT MAX(COALESCE(published_at, scheduled_at)) t FROM posts WHERE client_id = ? AND plataforma = ? AND status = 'publicado'").get(c.id, red).t;
    const err = db.prepare("SELECT error, updated_at FROM posts WHERE client_id = ? AND plataforma = ? AND status = 'error_generacion' ORDER BY id DESC LIMIT 1").get(c.id, red);
    console.log(`  ${red}: ${FREQ[r.frecuencia || 'semanal'] || r.frecuencia} · ${r.modo_publicacion === 'auto' ? 'se publica solo' : 'necesita aprobación'}${reusa ? ' · usa el mismo contenido de Instagram' : ''}`);
    console.log(`    Último publicado: ${f(ultimo)}`);
    if (abierto) console.log(`    DETENIDO: el post #${abierto.id} está ${NOMBRE[abierto.status] || abierto.status} (fecha ${f(abierto.scheduled_at)}). No se genera el siguiente hasta que se resuelva.`);
    if (err) console.log(`    Último error al generar (${f(err.updated_at)}): ${String(err.error || '').slice(0, 300)}`);
    if (err && /credit balance/i.test(err.error || '')) console.log('    → Sin crédito en Anthropic: recarga en console.anthropic.com o guarda la clave gratis de Gemini (GEMINI_TEXT_API_KEY).');
    if (!abierto && !err && !reusa) console.log('    Sin bloqueos: el siguiente se genera en la próxima ventana de madrugada.');
  }
}
console.log('');
