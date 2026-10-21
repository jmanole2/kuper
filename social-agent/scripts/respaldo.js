// Respaldo diario de la base del panel (clientes, posts, leads, conversaciones, usuarios, pagos).
// Guarda una copia consistente en data/respaldos/ y conserva las últimas 14.   npm run respaldo
// Las credenciales van cifradas: para restaurar hace falta la misma SECRET_KEY del .env.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../src/config.js';

const origen = path.join(config.dataDir, 'agente.db');
const dir = path.join(config.dataDir, 'respaldos');
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
const destino = path.join(dir, `panel-${stamp}.db`);
const db = new DatabaseSync(origen, { readOnly: true });
db.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);
db.close();
fs.chmodSync(destino, 0o600);
const viejos = fs.readdirSync(dir).filter((f) => /^panel-.*\.db$/.test(f)).sort().reverse().slice(14);
for (const f of viejos) fs.rmSync(path.join(dir, f));
console.log(`Respaldo listo: ${destino} (${(fs.statSync(destino).size / 1024).toFixed(0)} KB) · borrados ${viejos.length} viejos`);
