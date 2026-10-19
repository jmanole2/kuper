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
  // MOCK_LLM=1 usa un generador falso (para probar sin gastar API).
  mockLlm: bool('MOCK_LLM', '0'),

  geminiApiKey: env('GEMINI_API_KEY', ''),
  geminiImageModel: env('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash-image'),

  metaGraphVersion: env('META_GRAPH_VERSION', 'v24.0'),
  linkedinApiVersion: env('LINKEDIN_API_VERSION', '202609'),

  // DRY_RUN=1: no publica de verdad, solo registra lo que haría.
  dryRun: bool('DRY_RUN', '0'),
  schedulerEnabled: bool('SCHEDULER', '1'),
  schedulerIntervalSec: Number(env('SCHEDULER_INTERVAL_SEC', 60)),
  // Con cuántos días de anticipación se genera cada post (para dar tiempo a aprobar).
  leadDays: Number(env('LEAD_DAYS', 3)),
  competitorRefreshDays: Number(env('COMPETITOR_REFRESH_DAYS', 7)),
};

export const mediaDir = () => path.join(config.dataDir, 'media');
export const mediaUrl = (file) => `${config.publicBaseUrl}/media/${encodeURIComponent(path.basename(file))}`;
