// Renderiza la animación de ejemplo del animador (prompts/ejemplo-animacion.js) con la marca Kuper.
// Útil para probar cambios al kit sin gastar API: npm run render:demo
import path from 'node:path';
import fs from 'node:fs';
import { Stage } from '../src/animator/render.js';
import { mediaDir, ROOT } from '../src/config.js';

fs.mkdirSync(mediaDir(), { recursive: true });
const code = fs.readFileSync(path.join(ROOT, 'prompts/ejemplo-animacion.js'), 'utf8');
const job = {
  kind: 'video', formato: '9:16', duration: 12,
  brand: {
    name: 'Kuper Media', colors: ['#02040A', '#0B1E46', '#1F6BFF', '#6FA8FF', '#EAF2FF'],
    fontHead: 'Inter Tight', fontBody: 'Inter Tight', logoPath: path.join(ROOT, 'assets/kuper/logo_kuper_blanco.png'),
  },
  content: {
    escenas: [
      { titular: 'Te escribió a las 11:47 p. m.', apoyo: 'Quería agendar una cita para mañana.' },
      { titular: 'Le contestaste a las 9:12 a. m.', apoyo: 'Ya había reservado en otro lado.' },
      { titular: 'Tu agente responde en segundos', apoyo: 'Con tus horarios, precios y servicios. 24/7.' },
    ],
    cierre: 'Comenta AGENTE', cta: 'Comenta AGENTE',
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
