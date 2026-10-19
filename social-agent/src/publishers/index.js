// Despacha un post aprobado a la plataforma correspondiente.
import { config, mediaUrl } from '../config.js';
import { clientCredentials, updateClient } from '../db.js';
import { publishInstagram, publishFacebook } from './meta.js';
import { publishLinkedIn } from './linkedin.js';
import { publishTikTok, freshTikTokCreds } from './tiktok.js';

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
        videoFile: post.video_path, altText: post.alt_text, title: post.tema,
      });
    case 'tiktok': {
      const tk = await freshTikTokCreds(creds.tiktok, (nuevo) => updateClient(client.id, { credentials: { ...clientCredentials(client), tiktok: nuevo } }));
      return publishTikTok(tk, { caption: captionFor(post), videoFile: post.video_path, opciones: post.salida?.tiktok });
    }
    default:
      throw new Error(`Plataforma no soportada: ${post.plataforma}`);
  }
}
