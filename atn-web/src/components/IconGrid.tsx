import { Icon } from './Icon'

type Item = { id?: string | null; icon?: string | null; title: string; description?: string | null }

/** Rejilla de íconos (Impacto, Beneficios). */
export function IconGrid({ title, items, id }: { title?: string | null; items?: Item[] | null; id?: string }) {
  if (!items?.length) return null
  return (
    <section className="section icon-grid" id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="container">
        {title && (
          <h2 className="h2 icon-grid__title" id={id ? `${id}-title` : undefined}>
            {title}
          </h2>
        )}
        <ul className="icon-grid__list">
          {items.map((it, i) => (
            <li key={it.id ?? i} className="icon-item">
              <span className="icon-item__icon">
                <Icon name={it.icon} />
              </span>
              <h3 className="icon-item__title">{it.title}</h3>
              {it.description && <p className="icon-item__desc">{it.description}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
