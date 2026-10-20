// Crea el cliente Kuper Media (si no existe) con su voz de .claude/instagram/voice.md.
import path from 'node:path';
import fs from 'node:fs';
import { openDb, listClients, createClient, updateClient } from '../src/db.js';
import { config, ROOT, mediaDir } from '../src/config.js';

openDb();
if (listClients().some((c) => c.slug === 'kuper-media')) {
  console.log('Kuper Media ya existe.');
  process.exit(0);
}
const voicePath = path.join(ROOT, '..', '.claude/instagram/voice.md');
const voz = fs.existsSync(voicePath) ? fs.readFileSync(voicePath, 'utf8') : '';

const perfil = {
  cliente: 'Kuper Media',
  giro: 'Agentes de IA a la medida que atienden a los clientes de un negocio por WhatsApp, a cualquier hora; y agencia de marketing digital (diseño web, branding, redes sociales, marketing, fotografía y automatización con IA)',
  idioma: 'es-MX',
  tono_de_voz: 'cercano, claro y práctico; explica como a un amigo que tiene un negocio, sin tecnicismos; tutea',
  buyer_persona: 'dueños de negocios pequeños y medianos (consultorios, restaurantes, tiendas, servicios locales) que contestan WhatsApp a mano, pierden clientes por responder tarde y no tienen equipo técnico',
  voz,
  pilares_de_contenido: [
    { nombre: 'el costo de contestar tarde', requiere_imagen_real: false },
    { nombre: 'cómo funciona un agente de IA en WhatsApp', requiere_imagen_real: false },
    { nombre: 'bot de menú vs. agente que entiende', requiere_imagen_real: false },
    { nombre: 'atención al cliente por WhatsApp para negocios pequeños', requiere_imagen_real: false },
    { nombre: 'mitos sobre la IA en negocios pequeños', requiere_imagen_real: false },
    { nombre: 'oferta: precio y proceso en 4 pasos', requiere_imagen_real: false },
    { nombre: 'diseño web que vende', requiere_imagen_real: false },
    { nombre: 'marca e identidad visual', requiere_imagen_real: false },
    { nombre: 'constancia y estrategia en redes', requiere_imagen_real: false },
    { nombre: 'errores comunes de PyMEs en digital', requiere_imagen_real: false },
    { nombre: 'tips de IA aplicados a PyMEs y marketing', requiere_imagen_real: false },
    { nombre: 'antes y después de proyectos', requiere_imagen_real: true },
    { nombre: 'casos reales de clientes', requiere_imagen_real: true },
    { nombre: 'detrás de cámaras del equipo', requiere_imagen_real: true, activo: false },
    { nombre: 'blog del sitio web', requiere_imagen_real: false, requiere_fuente_real: true, activo: false },
  ],
  colores_marca: ['#02040A', '#0B1E46', '#1F6BFF', '#6FA8FF', '#EAF2FF'],
  tipografia: { titulos: 'Inter Tight', texto: 'Inter Tight' },
  estilo_visual: 'Editorial, oscuro y luminoso. Fondo casi negro azulado con una sola fuente de luz azul eléctrico (mancha de luz difusa, aurora tras vidrio acanalado o cono de luz). Titulares grandes en peso regular, sin negritas ni mayúsculas, interlineado apretado. Mucho aire. Detalles finos: líneas de 1 px, destellos de 4 puntas, asterisco como marca, etiquetas pequeñas en las esquinas (Kuper Media / tema), píldoras de borde fino. Movimiento lento: la luz deriva y el texto entra desenfocado y se enfoca. Logo blanco al cierre.',
  imagenes_ia: false,
  permite_emojis: true,
  max_emojis: 1,
  palabras_prohibidas: ['revolucionario', 'disruptivo', 'sinergia', 'potencia tu marca', 'en el mundo actual', 'soluciones integrales', 'de vanguardia', 'LLM', 'API', 'prompt'],
  temas_prohibidos: ['política', 'religión'],
  cta_preferido: 'Comenta AGENTE y te mando una demo con precios',
  palabra_clave_cta: 'AGENTE',
  terminos_busqueda: ['agente de IA para WhatsApp', 'atención a clientes por WhatsApp', 'chatbot para negocios', 'agencia de marketing digital', 'diseño de páginas web', 'branding para PyMEs'],
  blog_posts: [],
  ejemplos_de_posts_que_funcionaron: [],
};

const c = createClient({
  slug: 'kuper-media',
  nombre: 'Kuper Media',
  perfil,
  config: {
    instagram: { activo: true, frecuencia: '3_por_semana', modo_publicacion: 'aprobacion', hora: '19:00', formatos: ['video_animado', 'carrusel'] },
    facebook: { activo: true, frecuencia: 'semanal', modo_publicacion: 'aprobacion', hora: '12:00' },
    linkedin: { activo: true, frecuencia: 'semanal', modo_publicacion: 'aprobacion', hora: '08:30' },
    // Aviso de posts por revisar: escribe el correo de quien aprueba en el panel. Sin WhatsApp.
    notificaciones: { email: process.env.AVISO_EMAIL || '', whatsapp: false },
    // Quien comenta AGENTE recibe por DM el link al agente de demostración en WhatsApp.
    respuesta_palabra_clave: {
      activo: true,
      palabra: 'AGENTE',
      mensaje: 'Hola @{usuario}, aquí está: escríbele a nuestro agente de prueba como si fueras tu cliente 👉 https://wa.me/525534907598?text=Hola%2C%20vengo%20de%20Instagram\n\nPregúntale horarios, precios o pídele una cita. Contesta en segundos, a cualquier hora.\n\n¿Qué quieres que haga tu agente: contestar tu WhatsApp, publicar en tus redes u otra tarea?',
      respuesta_publica: 'Listo @{usuario}, te lo mandé por DM.',
      dias: 7,
    },
  },
  credentials: { dry_run: true },
});
fs.mkdirSync(mediaDir(), { recursive: true });
const logo = path.join(mediaDir(), 'logo-kuper-media.png');
fs.copyFileSync(path.join(ROOT, 'assets/kuper/logo_kuper_blanco.png'), logo);
updateClient(c.id, { logo_path: logo });
console.log(`Kuper Media creado (id ${c.id}). Portal del cliente: ${config.publicBaseUrl}/p/${c.portal_token}`);
console.log('Está en modo simulación: captura sus credenciales en el panel y desmarca "Modo simulación" para publicar de verdad.');
