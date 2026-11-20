import type { Metadata } from 'next'
import type { Media } from '@/payload-types'
import { getSettings } from './payload'
import { absolute, mediaUrl, siteUrl } from './media'

type SeoInput = {
  title?: string | null
  description?: string | null
  image?: number | Media | null
  noIndex?: boolean | null
} | null | undefined

/** Construye metadatos completos (title, description, canonical, OG, Twitter). */
export async function buildMetadata(seo: SeoInput, path: string, fallbackTitle?: string): Promise<Metadata> {
  const settings = await getSettings()
  const base = siteUrl(settings.siteUrl)
  const title = seo?.title || (fallbackTitle ? `${fallbackTitle} | ${settings.siteName}` : settings.defaultTitle) || settings.siteName
  const description = seo?.description || settings.defaultDescription || undefined
  const image = absolute(base, mediaUrl(seo?.image, 'og') || mediaUrl(settings.defaultImage, 'og'))
  const url = `${base}${path}`
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: seo?.noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type: 'website',
      locale: 'es_MX',
      url,
      siteName: settings.siteName,
      title,
      description,
      images: image ? [{ url: image, width: 1200, height: 630, alt: title }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  }
}
