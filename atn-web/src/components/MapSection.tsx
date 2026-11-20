import type { Home } from '@/payload-types'
import { Button } from './Button'
import { MediaImage } from './MediaImage'

export function MapSection({ map, wide = false }: { map: Home['map']; wide?: boolean }) {
  if (!map?.enabled || !map.title) return null
  return (
    <section className={`section split map-section ${wide ? 'map-section--wide' : ''}`} id="mapa" aria-labelledby="mapa-title">
      <div className="container split__grid">
        <div className="split__media map-section__media">
          {map.embedUrl ? (
            <iframe src={map.embedUrl} title={map.title} loading="lazy" allowFullScreen />
          ) : (
            <MediaImage media={map.image} sizes="(max-width: 900px) 100vw, 629px" />
          )}
        </div>
        <div className="split__copy">
          <h2 className="h2 h2--flat" id="mapa-title">
            {map.title}
          </h2>
          {map.description && <p className="lead">{map.description}</p>}
          {(map.primaryButton?.url || map.secondaryButton?.url) && (
            <div className="btn-row">
              <Button href={map.primaryButton?.url}>{map.primaryButton?.label}</Button>
              <Button href={map.secondaryButton?.url} variant="secondary">
                {map.secondaryButton?.label}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
