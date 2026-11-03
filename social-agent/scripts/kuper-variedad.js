// Cambio de fondo para que los posts de Kuper dejen de ser siempre "el WhatsApp que contestaste tarde, en azul".
//   node scripts/kuper-variedad.js            (muestra lo que cambiaría)
//   node scripts/kuper-variedad.js --aplicar  (lo guarda)
// - Pilares: apaga 3 de los 6 que eran del agente de WhatsApp y agrega otros servicios de Kuper.
// - Temas vetados: la escena de las 23:47 y "contestar tarde" quedan prohibidas (se rechazan en código).
// - Paletas: azul, morado, verde y claro, con los colores de kuper.media; cada pieza usa una distinta.
// - Estilo visual: ya no obliga "fondo oscuro con luz azul".
// - Buyer persona y voz: Kuper vende más que el agente de WhatsApp.
import * as db from '../src/db.js';

const aplicar = process.argv.includes('--aplicar');
const c = db.listClients().find((x) => x.slug === (process.argv.find((a) => a.startsWith('--slug='))?.slice(7) || 'kuper-media'));
if (!c) { console.error('No existe el cliente kuper-media'); process.exit(1); }
const p = c.perfil;

const APAGAR = ['el costo de contestar tarde', 'bot de menú vs. agente que entiende', 'atención al cliente por WhatsApp para negocios pequeños'];
const NUEVOS = [
  'agentes de IA más allá de WhatsApp: redes, llamadas y chat de tu página',
  'anuncios en Meta y Google que sí venden',
  'que te encuentren en Google: SEO y blog',
  'ideas y formatos para tus redes sociales',
  'automatiza tareas de tu negocio con IA',
];
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
const pilares = (p.pilares_de_contenido || []).map((x) => (APAGAR.some((a) => norm(a) === norm(x.nombre)) ? { ...x, activo: false } : x));
for (const n of NUEVOS) if (!pilares.some((x) => norm(x.nombre) === norm(n))) pilares.push({ nombre: n, requiere_imagen_real: false });

const paletas = [
  { nombre: 'azul', colores: ['#03070D', '#0B1E46', '#3F79E2', '#6FA8FF', '#EAF2FF'] },
  { nombre: 'morado', colores: ['#0D0718', '#2A1450', '#7C4DFF', '#9B6DFF', '#F1EBFF'] },
  { nombre: 'verde', colores: ['#050A12', '#12301F', '#B6DF4B', '#42D8AB', '#F2FBE6'] },
  { nombre: 'claro', fondo: '#F5F1EA', colores: ['#F5F1EA', '#1B1B1B', '#7C4DFF', '#B6DF4B', '#E95932'] },
];
const vetados = [...new Set([...(p.temas_vetados || []), '23:47', 'contestar tarde', 'mensaje de noche', 'responder al día siguiente', 'mensajes sin responder'])];
const estilo = 'Editorial y moderno, con mucho aire y tipografía grande en peso regular. Cada pieza usa UNA de las paletas de Kuper (azul, morado, verde o clara) con decisión: fondos sólidos o con una luz suave, nunca todas iguales. Detalles finos (líneas de 1 px, asterisco como marca, etiquetas pequeñas en las esquinas, píldoras de borde fino). A veces aparece la mascota de Kuper como protagonista, con movimiento y personalidad. Movimiento suave. Logo al cierre.';
const buyer = 'dueños de negocios pequeños y medianos (consultorios, restaurantes, tiendas, servicios locales) que quieren vender más con su presencia digital: página web, marca, redes sociales, anuncios y atención automática con IA, y no tienen equipo técnico';
const notaVoz = '\n\n## Variedad (manda sobre lo de arriba)\nKuper vende varias cosas: agentes de IA (WhatsApp, redes, llamadas, chat web), páginas web, branding, redes sociales, anuncios, SEO/blog y automatización. El agente de WhatsApp es solo uno de los temas: máximo 1 de cada 4 posts habla de él. Nunca uses la escena del mensaje de la noche que se contestó tarde.';
const voz = (p.voz || '').includes('## Variedad (manda sobre lo de arriba)') ? p.voz : `${p.voz || ''}${notaVoz}`;

const nuevo = { ...p, pilares_de_contenido: pilares, paletas, temas_vetados: vetados, estilo_visual: estilo, buyer_persona: buyer, voz };
const activos = pilares.filter((x) => x.activo !== false && !x.requiere_imagen_real).map((x) => x.nombre);
console.log(`Pilares activos (${activos.length}):\n  - ${activos.join('\n  - ')}`);
console.log(`Apagados: ${APAGAR.join(' · ')}`);
console.log(`Paletas: ${paletas.map((x) => x.nombre).join(', ')}`);
console.log(`Temas vetados: ${vetados.join(' · ')}`);
if (!aplicar) { console.log('\nNo se guardó nada. Para aplicarlo: node scripts/kuper-variedad.js --aplicar'); process.exit(0); }
db.updateClient(c.id, { perfil: nuevo });
console.log('\nListo: guardado en el perfil de Kuper. Sube la mascota (PNG sin fondo) en el panel → Kuper → Configuración → Mascota.');
