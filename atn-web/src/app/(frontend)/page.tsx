import type { Metadata } from 'next'
import { Allies } from '@/components/Allies'
import { Button } from '@/components/Button'
import { Carousel } from '@/components/Carousel'
import { IconGrid } from '@/components/IconGrid'
import { MapSection } from '@/components/MapSection'
import { MediaImage, MediaLogo } from '@/components/MediaImage'
import { Recetario } from '@/components/Recetario'
import { asMedia } from '@/lib/media'
import { getHome, getSettings } from '@/lib/payload'
import { buildMetadata } from '@/lib/seo'

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const home = await getHome()
  return buildMetadata(home.seo, '/')
}

export default async function HomePage() {
  const [home, settings] = await Promise.all([getHome(), getSettings()])
  const slides = (home.hero?.slides ?? [])
    .map((s) => asMedia(s.image))
    .filter((m): m is NonNullable<typeof m> => !!m?.url)
    .map((m) => ({ url: m.sizes?.large?.url || m.url!, alt: m.alt, focalX: m.focalX, focalY: m.focalY }))
  const title = home.hero?.title || settings.siteName

  return (
    <>
      <section className="page-hero" aria-label="Portada">
        <div className="container">
          <h1 className="display page-hero__title">
            {home.hero?.logo ? (
              <>
                <MediaLogo media={home.hero.logo} alt={title} priority sizes="(max-width: 900px) 80vw, 844px" className="page-hero__logo" />
                <span className="sr-only">{title}</span>
              </>
            ) : (
              title
            )}
          </h1>
          <Carousel slides={slides} label={`Fotos de ${settings.siteName}`} />
        </div>
      </section>

      {home.about?.title && (
        <section className="section about" aria-labelledby="about-title">
          <div className="container about__grid">
            <div className="about__copy">
              <h2 className="about__title" id="about-title">
                {home.about.title}
              </h2>
              {home.about.body?.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
            </div>
            {home.about.image && (
              <div className="about__media">
                <MediaImage media={home.about.image} sizes="(max-width: 900px) 100vw, 633px" />
              </div>
            )}
          </div>
        </section>
      )}

      <Allies allies={settings.allies} />

      <IconGrid id="impacto" title={home.impact?.title} items={home.impact?.items} />

      <MapSection map={home.map} wide />

      {home.programs && home.programs.length > 0 && (
        <section className="section programs" aria-label="Programas">
          <div className="container programs__grid">
            {home.programs.map((p, i) => (
              <article key={p.id ?? i} className="program-card">
                <div className="program-card__image">
                  <MediaImage media={p.image} sizes="(max-width: 900px) 100vw, 624px" />
                </div>
                <h2 className="program-card__question">{p.question}</h2>
                <Button href={p.cta?.url}>{p.cta?.label}</Button>
              </article>
            ))}
          </div>
        </section>
      )}

      <Recetario data={home.recetario} />

      {home.communityCta?.url && (
        <section className="section community-cta">
          <div className="container">
            <Button href={home.communityCta.url}>{home.communityCta.label}</Button>
          </div>
        </section>
      )}
    </>
  )
}
