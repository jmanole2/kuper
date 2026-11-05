// Libera espacio: npm run limpiar  (con --simular solo dice cuánto se liberaría). Ver src/limpieza.js.
import { limpiar, espacio } from '../src/limpieza.js';
const antes = espacio();
const r = limpiar({ simular: process.argv.includes('--simular') });
console.log(`Archivos del panel: ${antes.archivos} (${antes.mb} MB)`);
console.log(`${r.simular ? 'Se liberarían' : 'Liberados'}: ${r.mb} MB · ${r.archivos} archivos · ${r.posts_aligerados} posts publicados aligerados · ${r.posts_descartados} rechazados · ${r.eventos} eventos viejos`);
