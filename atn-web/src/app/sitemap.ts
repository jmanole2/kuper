import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/media'
import { getComunidad, getHome, getPaginas, getProgramas, getSettings } from '@/lib/payload'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [s, home, comunidad, programas, paginas] = await Promise.all([
    getSettings(),
    getHome(),
    getComunidad(),
    getProgramas(),
    getPaginas(),
  ])
  const base = siteUrl(s.siteUrl)
  const entries: MetadataRoute.Sitemap = []
  if (!home.seo?.noIndex) entries.push({ url: `${base}/`, lastModified: home.updatedAt ?? undefined, priority: 1 })
  if (!comunidad.seo?.noIndex)
    entries.push({ url: `${base}/comunidad`, lastModified: comunidad.updatedAt ?? undefined, priority: 0.8 })
  for (const p of programas.docs)
    if (!p.seo?.noIndex) entries.push({ url: `${base}/${p.slug}`, lastModified: p.updatedAt, priority: 0.9 })
  for (const p of paginas.docs)
    if (!p.seo?.noIndex) entries.push({ url: `${base}/${p.slug}`, lastModified: p.updatedAt, priority: 0.3 })
  return entries
}
