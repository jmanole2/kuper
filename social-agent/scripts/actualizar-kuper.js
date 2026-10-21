// Actualiza en Kuper Media (ya cargado) el DM de la palabra AGENTE, la voz (voice.md) y las reglas de citas,
// sin tocar credenciales, redes ni lo demás.   npm run actualizar-kuper
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../src/config.js';
import * as db from '../src/db.js';
import { cleanCalendarId } from '../src/agenda/index.js';

const c = db.listClients().find((x) => x.slug === 'kuper-media');
if (!c) { console.error('No existe el cliente kuper-media'); process.exit(1); }
const voz = fs.readFileSync(path.join(ROOT, '..', '.claude/instagram/voice.md'), 'utf8');
const config = {
  ...c.config,
  // Reglas de citas de Kuper: 45 min, 15 de margen, 4 h de anticipación, lunes a jueves de 9 a 18, última cita a las 16:00.
  // calendar_id: el correo del Google Calendar (CALENDAR_ID=... npm run actualizar-kuper), o se conserva el que ya tenga.
  agenda: {
    ...(c.config.agenda || {}),
    calendar_id: cleanCalendarId(process.env.CALENDAR_ID) || c.config.agenda?.calendar_id || '',
    duracion_min: 45, margen_min: 15, anticipacion_horas: 4, paso_min: 30, ultima_cita: '16:00',
    link_reunion: 'https://meet.google.com/pvg-ynqe-kin',
    horario: { lun: ['09:00', '18:00'], mar: ['09:00', '18:00'], mie: ['09:00', '18:00'], jue: ['09:00', '18:00'] },
    titulo: 'Kuper · {nombre}',
  },
  respuesta_palabra_clave: {
    ...(c.config.respuesta_palabra_clave || {}),
    activo: true,
    palabra: 'AGENTE',
    mensaje: '¡Hola @{usuario}! Te comparto un ejemplo de agente para que lo pruebes como si fueras tu cliente 👉 https://wa.me/525534907598?text=Hola%2C%20vengo%20de%20Instagram\n\nPregúntale por horarios, precios o pídele una cita: contesta en segundos, a cualquier hora.\n\nY cuéntame, ¿qué te gustaría que hiciera tu agente? ¿Contestar tu WhatsApp, publicar en tus redes u otra tarea?',
    respuesta_publica: '¡Listo @{usuario}! Te lo mandé por mensaje directo.',
  },
};
db.updateClient(c.id, { perfil: { ...c.perfil, voz }, config });
console.log(`Kuper Media actualizado: DM de AGENTE, voz (voice.md) y reglas de citas${config.agenda.calendar_id ? ` (calendario ${config.agenda.calendar_id})` : ' (falta el calendario: CALENDAR_ID=...)'}.`);
