// Carga en el panel "Lo que sabe tu agente" de cada marca de AMG desde scripts/datos/amg-conocimiento/<slug>.md
// (menú con precios, sucursales, horarios, cómo pedir y facturar, y las preguntas frecuentes que mandó AMG).
// Guarda una versión nueva (las anteriores quedan en el historial del panel). Si alguien de la marca ya editó el
// texto en el panel, no lo pisa salvo con --forzar.
//
//   sudo -u agente /opt/agente-social/node/bin/node --env-file=.env scripts/conocimiento-amg.js [--forzar] [--solo amg-chubbies]
import fs from 'node:fs';
import * as db from '../src/db.js';
import * as conocimiento from '../src/conocimiento.js';

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : ''; };
const forzar = process.argv.includes('--forzar');
const dir = new URL('./datos/amg-conocimiento/', import.meta.url);
db.openDb();
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) {
  const slug = f.replace(/\.md$/, '');
  if (arg('solo') && arg('solo') !== slug) continue;
  const c = db.listClients().find((x) => x.slug === slug);
  if (!c) { console.log(`✖ ${slug}: no existe en el panel`); continue; }
  const texto = fs.readFileSync(new URL(f, dir), 'utf8').trim();
  const k = conocimiento.actual(c.id);
  if (k && k.autor && k.autor !== 'Kuper' && !forzar) { console.log(`· ${c.nombre}: lo editó ${k.autor} en el panel; no lo toco (usa --forzar)`); continue; }
  const r = conocimiento.guardar(c.id, { texto, datos: k?.datos || {} }, 'Kuper');
  console.log(`✔ ${c.nombre.padEnd(16)} ${texto.length} caracteres · versión ${r.version}${k && r.version === k.version ? ' (sin cambios)' : ''}`);
}
console.log('\nLos agentes lo toman en máximo 5 minutos.');
