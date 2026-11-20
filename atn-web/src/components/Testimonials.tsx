import type { Programa } from '@/payload-types'
import { MediaImage } from './MediaImage'

export function Testimonials({ data }: { data: Programa['testimonials'] }) {
  if (!data?.items?.length) return null
  return (
    <section className="section testimonials" aria-labelledby="testimonios-title">
      <div className="container">
        {data.title && (
          <h2 className="h2 h2--lg" id="testimonios-title">
            {data.title}
          </h2>
        )}
        <ul className="testimonials__grid">
          {data.items.map((t, i) => (
            <li key={t.id ?? i}>
              <figure className="quote-card">
                <blockquote className="quote-card__text">{t.quote}</blockquote>
                <figcaption className="quote-card__author">
                  {t.avatar && (
                    <span className="quote-card__avatar">
                      <MediaImage media={t.avatar} sizes="45px" alt="" />
                    </span>
                  )}
                  <span>
                    <span className="quote-card__name">{t.name}</span>
                    {t.detail && <span className="quote-card__detail">{t.detail}</span>}
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
