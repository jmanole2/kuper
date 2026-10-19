// Crea el cliente Kuper Media con su perfil real (si no existe).
import path from 'node:path';
import fs from 'node:fs';
import { openDb, listClients, createClient, updateClient } from '../src/db.js';
import { config, ROOT, mediaDir } from '../src/config.js';

openDb();
if (listClients().some((c) => c.slug === 'kuper-media')) {
  console.log('Kuper Media ya existe.');
  process.exit(0);
}
const perfil = {
  "cliente": "Kuper Media",
  "giro": "Agencia de marketing digital e IA (diseño web, branding, social media, marketing digital, automatización con IA)",
  "idioma": "es-MX",
  "tono_de_voz": "profesional, cercano, con autoridad técnica, sin tecnicismos innecesarios",
  "buyer_persona": "dueños de PyMEs y gerentes de marketing en México que buscan una agencia confiable",
  "pilares_de_contenido": [
    {
      "nombre": "casos de éxito / portafolio",
      "requiere_imagen_real": true,
      "activo": true
    },
    {
      "nombre": "datos curiosos de IA",
      "requiere_imagen_real": false,
      "activo": true
    },
    {
      "nombre": "tips de IA aplicados a PyMEs/marketing",
      "requiere_imagen_real": false,
      "activo": true
    },
    {
      "nombre": "recomendaciones (herramientas, prácticas)",
      "requiere_imagen_real": false,
      "activo": true
    },
    {
      "nombre": "blog del sitio web",
      "requiere_imagen_real": false,
      "requiere_fuente_real": true,
      "activo": false
    },
    {
      "nombre": "tendencias tech 2026",
      "requiere_imagen_real": false,
      "activo": true
    },
    {
      "nombre": "noticias de IA y tecnología",
      "requiere_imagen_real": false,
      "activo": true
    },
    {
      "nombre": "mitos vs realidad del marketing digital",
      "requiere_imagen_real": false,
      "activo": true
    },
    {
      "nombre": "errores comunes de PyMEs",
      "requiere_imagen_real": false,
      "activo": true
    },
    {
      "nombre": "comparativas (herramientas, estrategias, plataformas)",
      "requiere_imagen_real": false,
      "activo": true
    },
    {
      "nombre": "antes y después (transformaciones)",
      "requiere_imagen_real": true,
      "activo": true
    },
    {
      "nombre": "procesos / behind the scenes",
      "requiere_imagen_real": false,
      "activo": true
    },
    {
      "nombre": "datos y estadísticas del sector",
      "requiere_imagen_real": false,
      "activo": true
    },
    {
      "nombre": "predicciones y futuro del marketing",
      "requiere_imagen_real": false,
      "activo": true
    },
    {
      "nombre": "humor tech / memes de marketing",
      "requiere_imagen_real": false,
      "activo": true
    },
    {
      "nombre": "preguntas frecuentes / FAQ",
      "requiere_imagen_real": false,
      "activo": true
    }
  ],
  "colores_marca": [
    "#0B0D1F",
    "#3B7CF6",
    "#8B5CF6",
    "#EC4899",
    "#FFFFFF"
  ],
  "estilo_visual": {
    "tipografia": "Poppins (bold para headline, regular/medium para subtexto)",
    "efecto": "glassmorphism (tarjeta de vidrio esmerilado, blur de fondo, borde sutil con glow)",
    "fondo": "azul marino oscuro casi negro, con degradado iridiscente azul-morado-magenta y líneas verticales sutiles de luz",
    "logo": "ícono pequeño y discreto en esquina inferior derecha"
  },
  "permite_emojis": false,
  "temas_prohibidos": [
    "política",
    "religión",
    "comparaciones directas con competencia"
  ],
  "cta_preferido": "Escríbenos / Agenda una llamada",
  "ejemplos_de_posts_que_funcionaron": [],
  "tipografia": {
    "titulos": "Poppins",
    "texto": "Poppins"
  },
  "imagenes_ia": false,
  "blog_posts": []
};

const c = createClient({
  slug: 'kuper-media',
  nombre: 'Kuper Media',
  perfil,
  config: {
    instagram: { activo: true, frecuencia: 'semanal', modo_publicacion: 'aprobacion', hora: '10:00', formatos: ['video_animado', 'carrusel', 'imagen_estatica'] },
    facebook: { activo: true, frecuencia: 'semanal', modo_publicacion: 'aprobacion', hora: '11:00' },
    linkedin: { activo: true, frecuencia: 'semanal', modo_publicacion: 'aprobacion', hora: '09:00' },
  },
  credentials: { dry_run: true },
});
// Logo blanco de Kuper (se copia a la carpeta de medios del agente).
fs.mkdirSync(mediaDir(), { recursive: true });
const logo = path.join(mediaDir(), 'logo-kuper-media.png');
fs.copyFileSync(path.join(ROOT, 'assets/kuper/logo_kuper_blanco.png'), logo);
updateClient(c.id, { logo_path: logo });
console.log(`Kuper Media creado (id ${c.id}). Portal del cliente: ${config.publicBaseUrl}/p/${c.portal_token}`);
console.log('Está en modo simulación: captura sus credenciales en el panel y desmarca "Modo simulación" para publicar de verdad.');
