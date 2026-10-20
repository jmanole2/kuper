// Revisa la conexión con Google Calendar paso por paso.   npm run probar-agenda
import * as db from '../src/db.js';
import { agendaCfg, serviceAccount, upcomingEvents, availability } from '../src/agenda/index.js';

const c = db.listClients().find((x) => x.slug === (process.argv[2] || 'kuper-media'));
if (!c) { console.error('No existe el cliente'); process.exit(1); }
const sa = serviceAccount(), cfg = agendaCfg(c);
console.log('Cuenta de servicio:', sa?.client_email || 'NO ENCONTRADA (falta data/google-service-account.json o no se puede leer)');
console.log('Proyecto de Google:', sa?.project_id || '-');
console.log('Calendario guardado:', JSON.stringify(c.config.agenda?.calendar_id ?? null), '→ se usa:', JSON.stringify(cfg.calendar_id));
if (!sa || !cfg.calendar_id) process.exit(1);
try { const ev = await upcomingEvents(cfg.calendar_id, 5); console.log(`OK leer eventos: ${ev.length} próximos`); }
catch (e) { console.log('FALLA leer eventos:', e.message); }
try { const s = await availability(c); console.log(`OK disponibilidad: ${s.length} horarios libres en 7 días${s[0] ? `, el primero ${s[0].inicio}` : ''}`); }
catch (e) { console.log('FALLA disponibilidad:', e.message); }
