import type { MaybeMedia } from '@/lib/media'
import { asMedia } from '@/lib/media'
import { MediaImage } from './MediaImage'

const embed = (url: string): string | null => {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/)
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0`
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`
  return null
}

export function Video({
  url,
  file,
  poster,
  title,
}: {
  url?: string | null
  file?: MaybeMedia
  poster?: MaybeMedia
  title: string
}) {
  const src = url ? embed(url) : null
  const f = asMedia(file)
  const p = asMedia(poster)
  return (
    <div className="video">
      {src ? (
        <iframe
          src={src}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : f?.url ? (
        <video controls preload="metadata" poster={p?.url ?? undefined}>
          <source src={f.url} type={f.mimeType ?? 'video/mp4'} />
        </video>
      ) : (
        <MediaImage media={poster} sizes="(max-width: 1440px) 100vw, 1281px" priority />
      )}
    </div>
  )
}
