// Renderiza una animación de ejemplo en data/media/demo.mp4 (para ajustar la plantilla).
import path from 'node:path';
import fs from 'node:fs';
import { renderAnimation } from '../src/media/animation.js';
import { mediaDir } from '../src/config.js';

fs.mkdirSync(mediaDir(), { recursive: true });
const formato = process.argv[2] || '9:16';
const out = path.join(mediaDir(), `demo-${formato.replace(/[:.]/g, 'x')}.mp4`);
await renderAnimation({
  formato,
  outFile: out,
  perfil: { cliente: 'Kuper Media', colores_marca: ['#111111', '#FFFFFF', '#FF5A36'] },
  animacion: {
    duracion_seg: 9,
    cierre: 'Agenda una llamada',
    escenas: [
      { titular: 'Tu marca habla primero', apoyo: 'Antes de que digas una palabra, tu imagen ya comunicó algo' },
      { titular: '3 señales de alerta', apoyo: 'Colores distintos, tono cambiante, logo pixelado' },
      { titular: 'Coherencia es confianza', apoyo: '' },
    ],
  },
});
console.log(out);
