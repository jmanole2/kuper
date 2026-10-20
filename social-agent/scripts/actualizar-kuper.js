// Actualiza en Kuper Media (ya cargado) el DM de la palabra AGENTE y la voz (voice.md),
// sin tocar credenciales, redes ni lo demás.   npm run actualizar-kuper
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../src/config.js';
import * as db from '../src/db.js';

const c = db.listClients().find((x) => x.slug === 'kuper-media');
if (!c) { console.error('No existe el cliente kuper-media'); process.exit(1); }
const voz = fs.readFileSync(path.join(ROOT, '..', '.claude/instagram/voice.md'), 'utf8');
const config = {
  ...c.config,
  respuesta_palabra_clave: {
    ...(c.config.respuesta_palabra_clave || {}),
    activo: true,
    palabra: 'AGENTE',
    mensaje: '¡Hola @{usuario}! Te comparto un ejemplo de agente para que lo pruebes como si fueras tu cliente 👉 https://wa.me/525534907598?text=Hola%2C%20vengo%20de%20Instagram\n\nPregúntale por horarios, precios o pídele una cita: contesta en segundos, a cualquier hora.\n\nY cuéntame, ¿qué te gustaría que hiciera tu agente? ¿Contestar tu WhatsApp, publicar en tus redes u otra tarea?',
    respuesta_publica: '¡Listo @{usuario}! Te lo mandé por mensaje directo.',
  },
};
db.updateClient(c.id, { perfil: { ...c.perfil, voz }, config });
console.log('Kuper Media actualizado: DM de AGENTE y voz (voice.md).');
