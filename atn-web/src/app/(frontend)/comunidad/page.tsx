import type { Metadata } from 'next'
import { Allies } from '@/components/Allies'
import { MapSection } from '@/components/MapSection'
import { MediaLogo } from '@/components/MediaImage'
import { Recetario } from '@/components/Recetario'
import { Testimonials } from '@/components/Testimonials'
import { Video } from '@/components/Video'
import { getComunidad, getSettings } from '@/lib/payload'
import { buildMetadata } from '@/lib/seo'

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const c = await getComunidad()
  return buildMetadata(c.seo, '/comunidad', 'Comunidad')
}

export default async function ComunidadPage() {
  const [c, settings] = await Promise.all([getComunidad(), getSettings()])
  const title = c.hero?.title || settings.siteName
  return (
    <>
      <section className="page-hero page-hero--wide" aria-label="Portada">
        <div className="container">
          <h1 className="display page-hero__title">
            {c.hero?.eyebrow && <span className="page-hero__eyebrow">{c.hero.eyebrow}</span>}
            {c.hero?.logo ? (
              <>
                <MediaLogo media={c.hero.logo} alt={title} priority sizes="(max-width: 900px) 80vw, 844px" className="page-hero__logo" />
                <span className="sr-only">{title}</span>
              </>
            ) : (
              <span>{title}</span>
            )}
          </h1>
          <Video
            url={c.hero?.videoUrl}
            file={c.hero?.videoFile}
            poster={c.hero?.poster}
            title={`Video más reciente de ${settings.siteName}`}
          />
        </div>
      </section>
      <Allies allies={settings.allies} className="allies--tight" />
      <MapSection map={c.map} />
      <Testimonials data={c.testimonials} />
      <Recetario data={c.recetario} />
    </>
  )
}
