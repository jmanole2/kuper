import Image from 'next/image'
import type { MaybeMedia } from '@/lib/media'
import { asMedia } from '@/lib/media'

type Props = {
  media: MaybeMedia
  sizes: string
  priority?: boolean
  className?: string
  alt?: string
}

/** Imagen del CMS que llena su contenedor (object-fit: cover) respetando el punto focal. */
export function MediaImage({ media, sizes, priority, className, alt }: Props) {
  const m = asMedia(media)
  if (!m?.url) return null
  const isSvg = m.mimeType === 'image/svg+xml'
  return (
    <Image
      src={m.url}
      alt={alt ?? m.alt ?? ''}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={isSvg}
      className={className}
      style={{
        objectFit: 'cover',
        objectPosition: `${m.focalX ?? 50}% ${m.focalY ?? 50}%`,
      }}
    />
  )
}

/** Logo a tamaño natural (contain). */
export function MediaLogo({ media, className, alt, sizes = '400px', priority }: Props & { sizes?: string }) {
  const m = asMedia(media)
  if (!m?.url) return null
  return (
    <Image
      src={m.url}
      alt={alt ?? m.alt ?? ''}
      width={m.width ?? 400}
      height={m.height ?? 200}
      sizes={sizes}
      priority={priority}
      unoptimized={m.mimeType === 'image/svg+xml'}
      className={className}
    />
  )
}
