'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'

type Slide = { url: string; alt: string; focalX?: number | null; focalY?: number | null }

/** Carrusel accesible de hasta 4 fotos con autoplay (pausa al pasar el mouse o con "reduce motion"). */
export function Carousel({ slides, label }: { slides: Slide[]; label: string }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchX = useRef<number | null>(null)
  const count = slides.length
  const go = useCallback((i: number) => setIndex((i + count) % count), [count])

  useEffect(() => {
    if (count < 2 || paused) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 5000)
    return () => clearInterval(t)
  }, [count, paused])

  if (!count) return null

  return (
    <div
      className="carousel"
      role="region"
      aria-roledescription="carrusel"
      aria-label={label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1))
        touchX.current = null
      }}
    >
      {slides.map((s, i) => (
        <div
          key={s.url + i}
          className={`carousel__slide ${i === index ? 'is-active' : ''}`}
          role="group"
          aria-roledescription="diapositiva"
          aria-label={`${i + 1} de ${count}`}
          aria-hidden={i !== index}
        >
          <Image
            src={s.url}
            alt={s.alt}
            fill
            priority={i === 0}
            sizes="(max-width: 1440px) 100vw, 1281px"
            style={{ objectFit: 'cover', objectPosition: `${s.focalX ?? 50}% ${s.focalY ?? 50}%` }}
          />
        </div>
      ))}
      {count > 1 && (
        <>
          <button type="button" className="carousel__arrow carousel__arrow--prev" onClick={() => go(index - 1)} aria-label="Foto anterior">
            ‹
          </button>
          <button type="button" className="carousel__arrow carousel__arrow--next" onClick={() => go(index + 1)} aria-label="Foto siguiente">
            ›
          </button>
          <div className="carousel__dots">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                className={i === index ? 'is-active' : ''}
                aria-label={`Ir a la foto ${i + 1}`}
                aria-current={i === index}
                onClick={() => go(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
