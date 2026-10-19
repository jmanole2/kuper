// Crea el cliente Kuper Media con el perfil del prompt maestro (si no existe).
import { openDb, listClients, createClient } from '../src/db.js';
import { config } from '../src/config.js';

openDb();
if (listClients().some((c) => c.slug === 'kuper-media')) {
  console.log('Kuper Media ya existe.');
  process.exit(0);
}
const c = createClient({
  slug: 'kuper-media',
  nombre: 'Kuper Media',
  perfil: {
    cliente: 'Kuper Media',
    giro: 'Agencia de marketing digital (diseño web, branding, social media, marketing digital, fotografía)',
    idioma: 'es-MX',
    tono_de_voz: 'profesional, cercano, con autoridad técnica, sin tecnicismos innecesarios',
    buyer_persona: 'dueños de PyMEs y gerentes de marketing en México que buscan una agencia confiable',
    pilares_de_contenido: [
      { nombre: 'casos de éxito / portafolio', requiere_imagen_real: true },
      { nombre: 'tips de marketing digital', requiere_imagen_real: false },
      { nombre: 'detrás de cámaras del equipo', requiere_imagen_real: true },
      { nombre: 'tendencias de diseño y redes sociales', requiere_imagen_real: false },
    ],
    colores_marca: ['#111111', '#FFFFFF', '#FF5A36'],
    permite_emojis: false,
    temas_prohibidos: ['política', 'religión', 'comparaciones directas con competencia'],
    cta_preferido: 'Agenda una llamada',
    ejemplos_de_posts_que_funcionaron: [],
  },
  config: {
    instagram: { activo: true, frecuencia: 'semanal', modo_publicacion: 'aprobacion', hora: '10:00', formatos: ['imagen_estatica', 'video_animado'] },
    facebook: { activo: true, frecuencia: 'semanal', modo_publicacion: 'aprobacion', hora: '11:00' },
    linkedin: { activo: true, frecuencia: 'quincenal', modo_publicacion: 'aprobacion', hora: '09:00' },
  },
  credentials: { dry_run: true },
});
console.log(`Kuper Media creado (id ${c.id}). Portal del cliente: ${config.publicBaseUrl}/p/${c.portal_token}`);
console.log('Está en modo simulación: captura sus credenciales en el panel y desmarca "Modo simulación" para publicar de verdad.');
