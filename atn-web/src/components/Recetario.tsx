import type { Home } from '@/payload-types'
import { asMedia } from '@/lib/media'
import { MediaImage } from './MediaImage'

export function Recetario({ data }: { data: Home['recetario'] }) {
  if (!data?.enabled || !data.items?.length) return null
  return (
    <section className="section recetario" aria-labelledby="recetario-title">
      <div className="container">
        {data.title && (
          <h2 className="h2 recetario__title" id="recetario-title">
            {data.title}
          </h2>
        )}
        <ul className="recetario__grid">
          {data.items.map((r, i) => {
            const file = asMedia(r.file)
            return (
              <li key={r.id ?? i} className="recetario__card">
                <div className="recetario__image">
                  <MediaImage media={r.image} sizes="(max-width: 768px) 100vw, 484px" alt={`Portada ${r.title}`} />
                </div>
                <div className="recetario__copy">
                  <h3 className="recetario__name">{r.title}</h3>
                  {r.subtitle && <p className="recetario__sub">{r.subtitle}</p>}
                  {file?.url && (
                    <a className="recetario__download" href={file.url} download>
                      {r.downloadLabel || 'Descargar'}
                      <span className="sr-only"> {r.title}</span>
                    </a>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
