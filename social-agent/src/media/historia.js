// Versión vertical (1080x1920) de un video o imagen para subirlo a historias. Si la pieza es 4:5
// o cuadrada, Instagram la agranda para llenar la pantalla y corta los lados; aquí va completa al
// centro, con la misma pieza desenfocada y oscurecida de fondo.
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';

const FILTRO = '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=40:2,eq=brightness=-0.18[fondo];' +
  '[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[pieza];[fondo][pieza]overlay=(W-w)/2:(H-h)/2,setsar=1,format=yuv420p[v]';

export const rutaHistoria = (file) => file.replace(/\.[^.]+$/, '') + (/\.mp4$/i.test(file) ? '-historia.mp4' : '-historia.jpg');

export function argsHistoria(file, out) {
  const video = /\.(mp4|mov|webm)$/i.test(file);
  return ['-y', '-loglevel', 'error', '-i', file, '-filter_complex', FILTRO, '-map', '[v]',
    ...(video ? ['-map', '0:a?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-movflags', '+faststart'] : ['-frames:v', '1', '-q:v', '2']),
    out];
}

/** Devuelve la ruta del archivo vertical (lo crea una vez y lo reutiliza). */
export function versionHistoria(file, { run = execFile } = {}) {
  const out = rutaHistoria(file);
  if (fs.existsSync(out)) return Promise.resolve(out);
  return new Promise((res, rej) => run(process.env.FFMPEG || ffmpegStatic, argsHistoria(file, out), { timeout: 180_000 },
    (e) => (e ? rej(new Error(`No se pudo preparar la historia: ${e.message}`)) : res(out))));
}
