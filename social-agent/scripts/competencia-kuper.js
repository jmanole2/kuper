// Agrega a Kuper Media las cuentas de competencia (verificadas desde el sitio de cada empresa).
//   npm run competencia-kuper
import * as db from '../src/db.js';

const LISTA = [
  ['aizualabs', 'España (Málaga). Agencia de agentes de IA para pymes: WhatsApp, ventas, atención; también webs y SEO. Muy parecida a Kuper.'],
  ['simviotik', 'España (Madrid). Agentes de IA por WhatsApp para pymes (citas, recordatorios), webs, CRM y anuncios. Paquetes con precio público.'],
  ['leadsalesio', 'México. CRM de ventas por WhatsApp, Instagram y Facebook con chatbot (Leadbot). Autoservicio.'],
  ['cliengo.chat', 'Argentina / LatAm. Chatbots para web, WhatsApp e Instagram que capturan leads. Autoservicio.'],
  ['kommolatam', 'LatAm. CRM de mensajería con constructor de bots. Mucho contenido educativo en redes.'],
  ['treble.ai.latam', 'LatAm. Automatización de conversaciones por WhatsApp para empresas.'],
  ['chattigo', 'LatAm. Plataforma omnicanal de atención (WhatsApp, Instagram, Facebook) con IA.'],
];
const c = db.listClients().find((x) => x.slug === 'kuper-media');
if (!c) { console.error('No existe el cliente kuper-media'); process.exit(1); }
const ya = new Set(db.listCompetitors(c.id).map((x) => x.handle.toLowerCase()));
for (const [h, notas] of LISTA) {
  if (ya.has(h)) { console.log(`@${h} ya estaba`); continue; }
  db.addCompetitor(c.id, h, 'instagram', notas); console.log(`@${h} agregado`);
}
