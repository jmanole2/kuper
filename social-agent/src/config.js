// Toda la configuración sale de variables de entorno (.env). Ver .env.example.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const env = (k, d) => (process.env[k] === undefined || process.env[k] === '' ? d : process.env[k]);
const bool = (k, d) => ['1', 'true', 'yes', 'si'].includes(String(env(k, d)).toLowerCase());

export const config = {
  port: Number(env('PORT', 3000)),
  // URL pública del servidor. Instagram y Facebook descargan las imágenes/videos
  // desde aquí, así que en producción debe ser accesible desde internet (https).
  publicBaseUrl: env('PUBLIC_BASE_URL', 'http://localhost:3000').replace(/\/$/, ''),
  dataDir: path.resolve(ROOT, env('DATA_DIR', 'data')),
  timezone: env('TIMEZONE', 'America/Mexico_City'),

  adminPassword: env('ADMIN_PASSWORD', ''),
  // Llave para firmar sesiones y cifrar los tokens de cada cliente en la base de datos.
  secretKey: env('SECRET_KEY', ''),

  anthropicModel: env('ANTHROPIC_MODEL', 'claude-opus-5-5'),
  anthropicEffort: env('ANTHROPIC_EFFORT', 'high'),
  // Esfuerzo del animador (código de las animaciones): xhigh da mejores piezas pero tarda y cuesta más.
  animatorEffort: env('ANIMATOR_EFFORT', 'high'),
  // MOCK_LLM=1 usa un generador falso (para probar sin gastar API).
  mockLlm: bool('MOCK_LLM', '0'),

  geminiApiKey: env('GEMINI_API_KEY', ''),
  geminiImageModel: env('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash-image'),
  // Clave de Gemini para escribir posts y animaciones (la gratis de Google AI Studio). Va primero;
  // si falla o se acaba su cupo del día, entra Claude. POSTS_LLM_ORDEN cambia el orden.
  geminiTextApiKey: env('GEMINI_TEXT_API_KEY', ''),
  geminiTextModel: env('GEMINI_TEXT_MODEL', 'gemini-3.8-flash'),
  // Modelos de respaldo (gratis también) si el principal está saturado o sin cupo.
  geminiTextFallbacks: env('GEMINI_TEXT_RESPALDO', 'gemini-3.6-flash,gemini-3.5-flash-lite'),
  postsLlmOrden: env('POSTS_LLM_ORDEN', ''),
  // Facturación automática con Factura.com (CFDI 4.0). FACTURACOM_SANDBOX=1 usa el ambiente de pruebas.
  facturacom: { apiKey: env('FACTURACOM_API_KEY', ''), secretKey: env('FACTURACOM_SECRET_KEY', ''), sandbox: bool('FACTURACOM_SANDBOX', '0') },
  // Fotos gratis para el blog (pexels.com/api).
  pexelsApiKey: env('PEXELS_API_KEY', ''),
  geminiThinking: env('GEMINI_THINKING', 'low'), // low | high | default (lo que decida el modelo)
  geminiTimeoutMs: Number(env('GEMINI_TIMEOUT_SEG', 600)) * 1000,

  // App de TikTok de la agencia (Content Posting API). Cada cliente la autoriza desde el panel.
  tiktok: { clientKey: env('TIKTOK_CLIENT_KEY', ''), clientSecret: env('TIKTOK_CLIENT_SECRET', '') },

  metaGraphVersion: env('META_GRAPH_VERSION', 'v24.0'),
  linkedinApiVersion: env('LINKEDIN_API_VERSION', '202609'),

  // DRY_RUN=1: no publica de verdad, solo registra lo que haría.
  dryRun: bool('DRY_RUN', '0'),
  schedulerEnabled: bool('SCHEDULER', '1'),
  schedulerIntervalSec: Number(env('SCHEDULER_INTERVAL_SEC', 60)),
  // Con cuántos días de anticipación se genera cada post (para dar tiempo a aprobar).
  leadDays: Number(env('LEAD_DAYS', 7)),
  // Ritmo de generación automática: cuántas piezas al día (en total, todos los clientes)
  // y en qué horas locales (de madrugada para no cargar el servidor mientras atienden los agentes de WhatsApp).
  maxPiezasDia: Number(env('MAX_PIEZAS_DIA', 1)),
  horasGeneracion: env('HORAS_GENERACION', '01-06'),
  // Aviso por correo al cliente cuando tiene posts por revisar (máximo uno al día, desde esta hora local).
  horaAviso: env('HORA_AVISO', '09:00'),
  smtp: {
    host: env('SMTP_HOST', ''),
    port: Number(env('SMTP_PORT', 465)),
    user: env('SMTP_USER', ''),
    pass: env('SMTP_PASS', ''),
    from: env('SMTP_FROM', env('SMTP_USER', '')),
  },
  // Google Places (búsqueda de empresas por giro y ciudad para el agente de ventas).
  googlePlacesKey: env('GOOGLE_PLACES_API_KEY', ''),
  competitorRefreshDays: Number(env('COMPETITOR_REFRESH_DAYS', 7)),
};

export const mediaDir = () => path.join(config.dataDir, 'media');
export const mediaUrl = (file) => `${config.publicBaseUrl}/media/${encodeURIComponent(path.basename(file))}`;
