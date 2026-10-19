// Renderiza la animación de ejemplo del animador (prompts/ejemplo-animacion.js) con la marca Kuper.
// Útil para probar cambios al kit sin gastar API: npm run render:demo
import path from 'node:path';
import fs from 'node:fs';
import { Stage } from '../src/animator/render.js';
import { mediaDir, ROOT } from '../src/config.js';

fs.mkdirSync(mediaDir(), { recursive: true });
const code = fs.readFileSync(path.join(ROOT, 'prompts/ejemplo-animacion.js'), 'utf8');
const job = {
  kind: 'video', formato: '9:16', duration: 10,
  brand: {
    name: 'Kuper Media', colors: ['#0B0D1F', '#3B7CF6', '#8B5CF6', '#EC4899', '#FFFFFF'],
    fontHead: 'Poppins', fontBody: 'Poppins', logoPath: path.join(ROOT, 'assets/kuper/logo_kuper_blanco.png'),
  },
  content: {
    hook: '3 errores al usar IA en tu PyME', cierre: 'Usa la IA con estrategia',
    items: [
      { mal: 'Usarla sin un objetivo claro', bien: 'Define primero qué tarea quieres ahorrar.' },
      { mal: 'Publicar lo que escribe tal cual', bien: 'Revisa y ajusta a tu tono de marca.' },
      { mal: 'Pagar 5 herramientas a la vez', bien: 'Empieza con una y mide resultados.' },
    ],
  },
};
const stage = await Stage.open();
try {
  await stage.load(job, code);
  console.log(await stage.probe());
  const out = path.join(mediaDir(), 'demo-animador.mp4');
  fs.writeFileSync(out.replace('.mp4', '-hoja.png'), await stage.sheet());
  await stage.renderVideo(out);
  console.log(out);
} finally {
  await stage.close();
}
