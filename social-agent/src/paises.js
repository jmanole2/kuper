// País de cada contacto según la lada de su WhatsApp (+52 México, +57 Colombia, +51 Perú, +54 Argentina…).
// Si la marca lo activa (client.config.paises = { activo, asesores: { 'México': userId, … } }), cada lead
// nuevo queda con la etiqueta de su país y, si no tiene asesor, se le asigna el de su país.
import * as db from './db.js';

export const LADAS = [
  ['593', 'Ecuador'], ['591', 'Bolivia'], ['595', 'Paraguay'], ['598', 'Uruguay'], ['502', 'Guatemala'], ['503', 'El Salvador'], ['504', 'Honduras'],
  ['505', 'Nicaragua'], ['506', 'Costa Rica'], ['507', 'Panamá'], ['52', 'México'], ['57', 'Colombia'], ['51', 'Perú'], ['54', 'Argentina'], ['56', 'Chile'],
  ['58', 'Venezuela'], ['53', 'Cuba'], ['55', 'Brasil'], ['34', 'España'], ['1', 'Estados Unidos'],
];
export function paisDeTelefono(tel) {
  const d = String(tel || '').replace(/\D/g, '');
  if (d.length < 10) return null;
  if (d.length === 10) return 'México'; // número de México sin lada de país
  return LADAS.find(([l]) => d.startsWith(l))?.[1] || null;
}
export const ajustes = (client) => ({ activo: false, asesores: {}, ...(client?.config?.paises || {}) });
const tags = (l) => { try { return JSON.parse(l.tags_json || '[]'); } catch { return []; } };

/** Etiqueta el país (si falta) y asigna al asesor del país (si no tiene). Devuelve el lead actualizado. */
export function clasificar(client, lead) {
  const aj = ajustes(client);
  if (!aj.activo || !lead?.telefono) return lead;
  const pais = paisDeTelefono(lead.telefono);
  if (!pais) return lead;
  const t = tags(lead);
  const nuevas = t.includes(pais) ? t : [pais, ...t].slice(0, 12);
  const asesor = !lead.asignado_id && Number(aj.asesores?.[pais]) ? Number(aj.asesores[pais]) : null;
  if (nuevas === t && !asesor) return lead;
  const valido = asesor && db.getDb().prepare("SELECT 1 FROM users WHERE id = ? AND client_id = ? AND activo = 1").get(asesor, client.id);
  db.getDb().prepare('UPDATE leads SET tags_json = ?, asignado_id = COALESCE(asignado_id, ?) WHERE id = ?').run(JSON.stringify(nuevas), valido ? asesor : null, lead.id);
  return db.getLead(client.id, lead.id);
}
/** Para el teléfono de un mensaje que llegó por la API: busca el lead y lo clasifica. */
export function clasificarTelefono(client, telefono) {
  if (!ajustes(client).activo || !telefono) return null;
  const d = String(telefono).replace(/\D/g, '');
  const l = db.getDb().prepare("SELECT * FROM leads WHERE client_id = ? AND telefono LIKE ? ORDER BY updated_at DESC LIMIT 1").get(client.id, `%${d.slice(-10)}`);
  return l ? clasificar(client, l) : null;
}
/** Países presentes en los leads de la marca (para los filtros). */
export function presentes(client) {
  const cuenta = {};
  for (const l of db.listLeads(client.id, { limit: 100000 })) { const p = paisDeTelefono(l.telefono); if (p) cuenta[p] = (cuenta[p] || 0) + 1; }
  return Object.entries(cuenta).sort((a, b) => b[1] - a[1]);
}
