// Lo que sabe el agente de cada marca (servicios, precios, preguntas frecuentes, horarios, dirección).
// Se edita en el panel, guarda versiones y los agentes lo leen por la API (/api/<marca>/conocimiento).
import * as db from './db.js';

export const MAX_TEXTO = 20000;
// Datos fijos que algunos agentes usan tal cual (p. ej. el correo de entrevista de Buen Sabor).
export const CAMPOS = {
  direccion: 'Dirección (oficina o sucursal donde se atiende)',
  referencias: 'Referencias para llegar',
  que_llevar: 'Qué deben llevar a la cita',
  horario: 'Horario de atención',
  telefono: 'Teléfono o WhatsApp de contacto humano',
};
export const PLANTILLA = `# Lo que tu agente sabe de tu negocio

## Quiénes somos
- (Qué hace el negocio, en 2 o 3 frases.)

## Servicios y precios
- (Servicio · precio o "se cotiza".)

## Preguntas frecuentes
- ¿…? Respuesta corta.

## Reglas
- No inventes precios, plazos ni promociones que no estén aquí. Si no sabes algo, dilo y ofrece que una persona lo confirme.
`;

const d = () => db.getDb();
export function ensureTables() {
  d().exec(`CREATE TABLE IF NOT EXISTS conocimiento (
    id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    texto TEXT NOT NULL, datos_json TEXT NOT NULL DEFAULT '{}', autor TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
  d().exec('CREATE INDEX IF NOT EXISTS conocimiento_client ON conocimiento(client_id, id)');
}
const fila = (r) => (r ? { id: r.id, version: r.id, texto: r.texto, datos: JSON.parse(r.datos_json || '{}'), autor: r.autor, actualizado: r.created_at } : null);

export function actual(clientId) {
  ensureTables();
  return fila(d().prepare('SELECT * FROM conocimiento WHERE client_id = ? ORDER BY id DESC LIMIT 1').get(clientId));
}
export function versiones(clientId, n = 12) {
  ensureTables();
  return d().prepare('SELECT id, autor, created_at, length(texto) AS largo FROM conocimiento WHERE client_id = ? ORDER BY id DESC LIMIT ?').all(clientId, n);
}
export function guardar(clientId, { texto, datos = {} }, autor) {
  ensureTables();
  const t = String(texto ?? '').replace(/\r\n/g, '\n').trim();
  if (!t) throw new Error('Escribe al menos algo de información para tu agente.');
  if (t.length > MAX_TEXTO) throw new Error(`El texto es muy largo (${t.length} caracteres; máximo ${MAX_TEXTO}). Resume un poco.`);
  const limpio = Object.fromEntries(Object.keys(CAMPOS).map((k) => [k, String(datos[k] ?? '').trim().slice(0, 300)]).filter(([, v]) => v));
  const prev = actual(clientId);
  if (prev && prev.texto === t && JSON.stringify(prev.datos) === JSON.stringify(limpio)) return prev; // sin cambios
  const r = d().prepare('INSERT INTO conocimiento (client_id, texto, datos_json, autor) VALUES (?, ?, ?, ?)').run(clientId, t, JSON.stringify(limpio), autor ? String(autor).slice(0, 80) : null);
  db.logEvent({ clientId, tipo: 'conocimiento_actualizado', detalle: `${autor || 'alguien'} · versión ${r.lastInsertRowid}` });
  return actual(clientId);
}
export function restaurar(clientId, versionId, autor) {
  ensureTables();
  const v = d().prepare('SELECT * FROM conocimiento WHERE id = ? AND client_id = ?').get(versionId, clientId);
  if (!v) throw new Error('Esa versión no existe');
  return guardar(clientId, { texto: v.texto, datos: JSON.parse(v.datos_json || '{}') }, `${autor || 'alguien'} (restauró v${v.id})`);
}
