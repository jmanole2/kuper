import type { SiteSetting } from '@/payload-types'
import { MediaImage, MediaLogo } from './MediaImage'

export function Allies({ allies, className = '' }: { allies: SiteSetting['allies']; className?: string }) {
  if (!allies?.length) return null
  return (
    <section className={`section allies ${className}`} aria-label="Aliados">
      <div className="container">
        <ul className="allies__grid">
          {allies.map((a) => {
            const card = (
              <div className="allies__card">
                <MediaImage media={a.background} sizes="(max-width: 768px) 100vw, 404px" className="allies__bg" alt="" />
                <div className="allies__logo">
                  {a.logo ? <MediaLogo media={a.logo} alt={a.name} sizes="300px" /> : <span>Logo {a.name}</span>}
                </div>
              </div>
            )
            return (
              <li key={a.id ?? a.name} className="allies__item">
                <h2 className="h2 allies__heading">{a.heading}</h2>
                {a.url ? (
                  <a href={a.url} target="_blank" rel="noopener noreferrer" aria-label={`${a.heading} ${a.name}`}>
                    {card}
                  </a>
                ) : (
                  card
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
