// Generación de imágenes con Gemini (Nano Banana) vía la API REST oficial.
import fs from 'node:fs';
import { config } from '../config.js';

// Gemini no maneja 1.91:1; se usa el más cercano.
const ASPECT = { '1:1': '1:1', '4:5': '4:5', '9:16': '9:16', '1.91:1': '16:9' };

export const imageModelConfigured = () => !!config.geminiApiKey;

export async function generateImage({ prompt, formato, outFileBase }) {
  if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY no configurada');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiImageModel}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.geminiApiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: ASPECT[formato] || '1:1' } },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${body.error?.message || JSON.stringify(body).slice(0, 300)}`);
  const part = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) throw new Error(`Gemini no devolvió imagen (${body.candidates?.[0]?.finishReason || 'sin motivo'})`);
  const ext = part.inlineData.mimeType === 'image/png' ? 'png' : 'jpg';
  const file = `${outFileBase}.${ext}`;
  fs.writeFileSync(file, Buffer.from(part.inlineData.data, 'base64'));
  return file;
}

// Instagram solo acepta JPEG para fotos: convierte cualquier imagen a JPEG.
import { execFileSync } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';

export function ensureJpeg(file) {
  if (/\.jpe?g$/i.test(file)) return file;
  const out = file.replace(/\.[^.]+$/, '') + '.jpg';
  execFileSync(process.env.FFMPEG || ffmpegStatic, ['-y', '-loglevel', 'error', '-i', file, '-q:v', '2', out]);
  return out;
}
