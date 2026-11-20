import type { Media } from '@/payload-types'

export type MaybeMedia = number | Media | null | undefined

export const asMedia = (m: MaybeMedia): Media | null => (m && typeof m === 'object' ? m : null)

export const mediaUrl = (m: MaybeMedia, size?: 'thumbnail' | 'card' | 'large' | 'og'): string | null => {
  const media = asMedia(m)
  if (!media) return null
  const sized = size ? media.sizes?.[size]?.url : null
  return sized || media.url || null
}

export const siteUrl = (settingsUrl?: string | null) =>
  (settingsUrl || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/$/, '')

export const absolute = (base: string, url?: string | null) => {
  if (!url) return undefined
  if (/^https?:\/\//.test(url)) return url
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`
}

export const isExternal = (url?: string | null) => !!url && /^(https?:)?\/\//.test(url)
