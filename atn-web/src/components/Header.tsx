'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

type Props = {
  siteName: string
  logo?: { url: string; alt: string; width: number; height: number } | null
  nav: { label: string; url: string }[]
  logoLight?: Props['logo']
  /** Rutas con portada fotográfica: el menú va en blanco sobre la foto. */
  overlayPaths: string[]
}

export function Header({ siteName, logo, logoLight, nav, overlayPaths }: Props) {
  const pathname = usePathname()
  const tone = overlayPaths.includes(pathname ?? '') ? 'light' : 'dark'
  const brandLogo = tone === 'light' ? logoLight || logo : logo
  const [open, setOpen] = useState(false)

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header className={`site-header site-header--${tone} ${open ? 'is-open' : ''}`}>
      <div className="container site-header__inner">
        <Link href="/" className="site-header__brand" aria-label={`${siteName} – Inicio`}>
          {brandLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brandLogo.url} alt={brandLogo.alt || siteName} width={brandLogo.width} height={brandLogo.height} />
          ) : (
            siteName
          )}
        </Link>
        <button
          type="button"
          className="site-header__toggle"
          aria-expanded={open}
          aria-controls="menu-principal"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        <nav id="menu-principal" className="site-header__nav" aria-label="Principal">
          <ul>
            {nav.map((item) => {
              const active = item.url !== '/' && pathname?.startsWith(item.url)
              return (
                <li key={item.url}>
                  <Link href={item.url} aria-current={active ? 'page' : undefined}>
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </header>
  )
}
