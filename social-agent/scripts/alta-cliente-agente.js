// Da de alta (o actualiza) un cliente que solo tiene agente de chat + agenda (sin publicaciones).
// Se usa para marcas como Red One: su agente de WhatsApp/Instagram/Messenger vive en otro servicio
// y se conecta al panel con la llave de la API.
//
//   SLUG=red-one NOMBRE="Red One" CORREO=provoc@redone.agency AGENTE_URL=https://ai.redone.agency \
//   CALENDAR_ID=correo@empresa.com MEET=https://meet.google.com/xxx-xxxx-xxx \
//   AGENTE_ENV=/opt/redone-agent/.env npm run alta-cliente-agente
//
// AGENTE_ENV (opcional): escribe PANEL_URL y PANEL_API_KEY en el .env del agente, sin mostrar la llave.
import fs from 'node:fs';
import { config as appConfig } from '../src/config.js';
import * as db from '../src/db.js';
import { randomToken } from '../src/crypto.js';
import { cleanCalendarId } from '../src/agenda/index.js';

const E = process.env;
const slug = String(E.SLUG || '').trim().toLowerCase();
if (!/^[a-z0-9-]{2,40}$/.test(slug) || !E.NOMBRE) { console.error('Faltan SLUG (letras, números y guiones) y NOMBRE.'); process.exit(1); }
const dias = String(E.DIAS || 'lun,mar,mie,jue,vie').split(',').map((d) => d.trim());
const [ini, fin] = String(E.HORARIO || '09:00-18:00').split('-');
const dur = Number(E.DURACION || 30);

const previo = db.listClients().find((x) => x.slug === slug);
const base = previo?.config || {};
const plan = { ...(base.plan || {}), servicios: { redes: false, chat: true, agenda: true, llamadas: false, videollamadas: false, ...(base.plan?.servicios || {}), redes: false } };
const config = {
  ...base,
  plan,
  agenda: {
    ...(base.agenda || {}),
    calendar_id: cleanCalendarId(E.CALENDAR_ID) || base.agenda?.calendar_id || '',
    duracion_min: dur, margen_min: Number(E.MARGEN || 0), anticipacion_horas: Number(E.ANTICIPACION || 3), paso_min: dur,
    horario: Object.fromEntries(dias.map((d) => [d, [ini, fin]])),
    ...(E.MEET ? { link_reunion: E.MEET.trim() } : {}),
    titulo: E.TITULO || `${E.NOMBRE} · {nombre}`,
  },
  notificaciones: { ...(base.notificaciones || {}), ...(E.CORREO ? { email: E.CORREO.trim() } : {}) },
};
const credsPrevias = previo ? db.clientCredentials(previo) : {};
const credentials = { ...credsPrevias, api_key: credsPrevias.api_key || randomToken(24), ...(E.AGENTE_URL ? { agente_url: E.AGENTE_URL.replace(/\/+$/, '') } : {}) };

let c;
if (previo) {
  db.updateClient(previo.id, { config, credentials });
  c = db.getClient(previo.id);
} else {
  c = db.createClient({ slug, nombre: E.NOMBRE.trim(), perfil: { cliente: E.NOMBRE.trim(), pilares_de_contenido: [] }, config, credentials });
}
console.log(`${previo ? 'Actualizado' : 'Creado'}: ${c.nombre} (${slug}) · chat y agenda, sin publicaciones.`);
console.log(`  Agenda: ${config.agenda.calendar_id || 'FALTA el calendario (CALENDAR_ID=...)'} · ${dur} min · ${dias.join(', ')} ${ini}-${fin}${config.agenda.link_reunion ? ` · ${config.agenda.link_reunion}` : ' · sin link fijo de Meet'}`);
console.log(`  Avisos y reporte mensual a: ${config.notificaciones.email || 'FALTA (CORREO=...)'}`);
console.log(`  Página para agendar: ${appConfig.publicBaseUrl}/agendar/${slug}`);

if (E.AGENTE_ENV) {
  const ruta = E.AGENTE_ENV;
  const antes = fs.existsSync(ruta) ? fs.readFileSync(ruta, 'utf8') : '';
  const lineas = antes.split('\n').filter((l) => l && !/^PANEL_(URL|API_KEY)=/.test(l));
  lineas.push(`PANEL_URL=${appConfig.publicBaseUrl}/api/${slug}`, `PANEL_API_KEY=${credentials.api_key}`);
  fs.writeFileSync(ruta, lineas.join('\n') + '\n', { mode: 0o600 });
  fs.chmodSync(ruta, 0o600);
  console.log(`  Conexión con el agente guardada en ${ruta} (PANEL_URL y PANEL_API_KEY).`);
} else {
  console.log('  Para conectar el agente, vuelve a correr con AGENTE_ENV=/ruta/al/.env del agente.');
}
