import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { Allies } from '@/components/Allies'
import { Button } from '@/components/Button'
import { Icon } from '@/components/Icon'
import { IconGrid } from '@/components/IconGrid'
import { JsonLd } from '@/components/JsonLd'
import { MediaImage, MediaLogo } from '@/components/MediaImage'
import { Testimonials } from '@/components/Testimonials'
import { absolute, mediaUrl, siteUrl } from '@/lib/media'
import { getPagina, getPaginas, getPrograma, getProgramas, getSettings } from '@/lib/payload'
import { buildMetadata } from '@/lib/seo'

export const revalidate = 3600
export const dynamicParams = true

type Params = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  const [programas, paginas] = await Promise.all([getProgramas(), getPaginas()])
  return [...programas.docs, ...paginas.docs].filter((d) => d.slug).map((d) => ({ slug: d.slug! }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const programa = await getPrograma(slug)
  if (programa) return buildMetadata(programa.seo, `/${slug}`, programa.name)
  const pagina = await getPagina(slug)
  if (pagina) return buildMetadata(pagina.seo, `/${slug}`, pagina.title)
  return { title: 'Página no encontrada', robots: { index: false } }
}

export default async function SlugPage({ params }: Params) {
  const { slug } = await params
  const programa = await getPrograma(slug)
  if (programa) return <ProgramaPage programa={programa} />
  const pagina = await getPagina(slug)
  if (!pagina) notFound()
  return (
    <article className="section legal">
      <div className="container legal__inner">
        <h1 className="h2 h2--lg">{pagina.title}</h1>
        {pagina.content && <RichText data={pagina.content} className="prose" />}
      </div>
    </article>
  )
}

async function ProgramaPage({ programa: p }: { programa: NonNullable<Awaited<ReturnType<typeof getPrograma>>> }) {
  const settings = await getSettings()
  const base = siteUrl(settings.siteUrl)
  const heroTitle = p.hero?.title || settings.siteName

  return (
    <>
      <section className="program-hero" aria-label="Portada">
        <MediaImage media={p.hero?.background} sizes="100vw" priority className="program-hero__bg" alt="" />
        <div className="program-hero__dimmer" />
        <div className="container program-hero__content">
          <h1 className="program-hero__title">
            {p.hero?.logo ? (
              <>
                <MediaLogo media={p.hero.logo} alt={heroTitle} priority sizes="(max-width: 900px) 80vw, 844px" />
                <span className="sr-only">{heroTitle}</span>
              </>
            ) : (
              <span className="program-hero__name">{heroTitle}</span>
            )}
            {p.hero?.subtitle && <span className="program-hero__subtitle">{p.hero.subtitle}</span>}
          </h1>
          <Button href={p.hero?.cta?.url} size="lg">
            {p.hero?.cta?.label}
          </Button>
        </div>
      </section>

      {p.intro?.title && (
        <section className="section program-intro" aria-labelledby="intro-title">
          <div className="container program-intro__grid">
            <div className="program-intro__copy">
              <h2 className="h2 h2--flat" id="intro-title">
                {p.intro.title}
              </h2>
              {p.intro.body?.split(/\n{2,}/).map((para, i) => (
                <p key={i} className="lead">
                  {para}
                </p>
              ))}
            </div>
            {p.intro.image && (
              <div className="program-intro__media">
                <MediaImage media={p.intro.image} sizes="(max-width: 900px) 100vw, 624px" />
              </div>
            )}
          </div>
        </section>
      )}

      <Allies allies={settings.allies} className="allies--tight" />

      <IconGrid id="beneficios" title={p.benefits?.title} items={p.benefits?.items} />

      {(p.call?.title || p.call?.images?.length) && (
        <section className="section call" id="convocatoria" aria-labelledby="convocatoria-title">
          <div className="container">
            {p.call?.title && (
              <h2 className="h2 h2--lg call__title" id="convocatoria-title">
                {p.call.title}
              </h2>
            )}
            {p.call?.images && p.call.images.length > 0 && (
              <div className="call__images">
                {p.call.images.map((im, i) => (
                  <div key={im.id ?? i} className="call__image">
                    <MediaImage media={im.image} sizes="(max-width: 900px) 100vw, 566px" />
                  </div>
                ))}
              </div>
            )}
            {p.call?.cta?.url && (
              <div className="call__cta">
                <Button href={p.call.cta.url}>{p.call.cta.label}</Button>
              </div>
            )}
          </div>
        </section>
      )}

      {p.call?.eligibility && p.call.eligibility.length > 0 && (
        <section className="section eligibility" aria-labelledby="requisitos-title">
          <div className="container eligibility__inner">
            {p.call.eligibilityTitle && (
              <h2 className="h2 h2--lg" id="requisitos-title">
                {p.call.eligibilityTitle}
              </h2>
            )}
            <ul className="eligibility__list">
              {p.call.eligibility.map((e, i) => (
                <li key={e.id ?? i}>{e.text}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {p.process?.steps && p.process.steps.length > 0 && (
        <section className="section process" aria-labelledby="proceso-title">
          <div className="container">
            {p.process.title && (
              <h2 className="h2 h2--lg" id="proceso-title">
                {p.process.title}
              </h2>
            )}
            <ol className="process__list">
              {p.process.steps.map((s, i) => (
                <li key={s.id ?? i} className="icon-item">
                  <span className="icon-item__icon">
                    <Icon name={s.icon} />
                  </span>
                  <h3 className="icon-item__title process__step-title">
                    <span className="process__num">{i + 1}.</span> {s.title}
                  </h3>
                  {s.description && <p className="icon-item__desc">{s.description}</p>}
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {p.stages?.items && p.stages.items.length > 0 && (
        <section className="section stages" aria-labelledby="etapas-title">
          <div className="container">
            {p.stages.title && (
              <h2 className="h2 h2--flat stages__title" id="etapas-title">
                {p.stages.title}
              </h2>
            )}
            <ol className="stages__grid">
              {p.stages.items.map((s, i) => (
                <li key={s.id ?? i} className="stage-card">
                  <div className="stage-card__image">
                    <MediaImage media={s.image} sizes="(max-width: 768px) 100vw, 404px" alt="" />
                  </div>
                  <h3 className="stage-card__title">{s.title}</h3>
                  {s.description && <p className="stage-card__desc">{s.description}</p>}
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      <Testimonials data={p.testimonials} />

      {p.community?.title && (
        <section className="section split community" aria-labelledby="comunidad-title">
          <div className="container split__grid">
            <div className="split__media">
              <MediaImage media={p.community.image} sizes="(max-width: 900px) 100vw, 625px" />
            </div>
            <div className="split__copy">
              <h2 className="h2 h2--flat" id="comunidad-title">
                {p.community.title}
              </h2>
              <div className="btn-row">
                <Button href={p.community.cta?.url}>{p.community.cta?.label}</Button>
              </div>
            </div>
          </div>
        </section>
      )}

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Course',
          name: `${settings.siteName} ${p.name}`,
          description: p.seo?.description || p.intro?.body?.slice(0, 300),
          url: `${base}/${p.slug}`,
          inLanguage: 'es-MX',
          isAccessibleForFree: true,
          image: absolute(base, mediaUrl(p.hero?.background, 'og')),
          provider: { '@type': 'Organization', name: settings.siteName, url: base },
          offers: { '@type': 'Offer', price: 0, priceCurrency: 'MXN', category: 'Free' },
          hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'Online' },
        }}
      />
    </>
  )
}
