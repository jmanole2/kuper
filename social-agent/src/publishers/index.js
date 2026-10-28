// Despacha un post aprobado a la plataforma correspondiente.
import { config, mediaUrl } from '../config.js';
import { clientCredentials, updateClient } from '../db.js';
import { publishInstagram, publishFacebook, publishInstagramStory } from './meta.js';
import { publishLinkedIn } from './linkedin.js';
import { publishTikTok, freshTikTokCreds } from './tiktok.js';
import { versionHistoria } from '../media/historia.js';

export function captionFor(post) {
  const tags = post.hashtags?.length ? `\n\n${post.hashtags.join(' ')}` : '';
  return `${post.copy_final}${tags}`;
}

export async function publishPost(post, client) {
  const creds = clientCredentials(client);
  const imageUrl = post.image_path ? mediaUrl(post.image_path) : null;
  const videoUrl = post.video_path ? mediaUrl(post.video_path) : null;
  const carousel = post.images?.length > 1 ? post.images : null;
  const imageUrls = carousel ? carousel.map(mediaUrl) : null;

  if (config.dryRun || creds.dry_run) {
    return { id: `dry-run-${post.plataforma}-${post.id}`, url: null, dryRun: true };
  }
  switch (post.plataforma) {
    case 'instagram':
      return publishInstagram(creds.meta, {
        caption: captionFor(post), imageUrl: videoUrl ? null : imageUrl, imageUrls, videoUrl,
        coverUrl: videoUrl && imageUrl ? imageUrl : null, altText: post.alt_text,
      });
    case 'facebook':
      return publishFacebook(creds.meta, { caption: captionFor(post), imageUrl: videoUrl ? null : imageUrl, imageUrls, videoUrl, altText: post.alt_text });
    case 'linkedin':
      return publishLinkedIn(creds.linkedin, {
        copy: post.copy_final, hashtags: post.hashtags, imageFile: post.video_path ? null : post.image_path, imageFiles: carousel,
        videoFile: post.video_path, altText: post.alt_text, title: post.tema, as: client.config.linkedin?.publicar_como,
      });
    case 'tiktok': {
      const tk = await freshTikTokCreds(creds.tiktok, (nuevo) => updateClient(client.id, { credentials: { ...clientCredentials(client), tiktok: nuevo } }));
      return publishTikTok(tk, { caption: captionFor(post), videoFile: post.video_path, opciones: post.salida?.tiktok });
    }
    default:
      throw new Error(`Plataforma no soportada: ${post.plataforma}`);
  }
}

/** Sube a historias de Instagram el video (o la primera imagen) de un post ya publicado. */
export async function publishStory(post, client) {
  const creds = clientCredentials(client);
  if (config.dryRun || creds.dry_run) return { id: `dry-run-historia-${post.id}`, dryRun: true };
  const img = post.images?.[0] || post.image_path;
  let archivo = post.video_path || img;
  if (!archivo) throw new Error('No hay video ni imagen para la historia');
  // Lo que no es vertical se acomoda en 9:16 para que Instagram no lo recorte.
  if (post.salida?.formato_imagen !== '9:16') archivo = await versionHistoria(archivo);
  const url = mediaUrl(archivo);
  return publishInstagramStory(creds.meta, post.video_path ? { videoUrl: url, imageUrl: null } : { videoUrl: null, imageUrl: url });
}
