import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/media'
import { getSettings } from '@/lib/payload'

export const revalidate = 3600

export default async function robots(): Promise<MetadataRoute.Robots> {
  const s = await getSettings()
  const base = siteUrl(s.siteUrl)
  return {
    rules: [{ userAgent: '*', allow: ['/', '/api/media/file/'], disallow: ['/admin', '/api/'] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
