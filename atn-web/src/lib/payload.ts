import config from '@payload-config'
import { getPayload } from 'payload'
import { cache } from 'react'

export const payload = cache(async () => getPayload({ config }))

export const getSettings = cache(async () => (await payload()).findGlobal({ slug: 'site-settings', depth: 1 }))
export const getHome = cache(async () => (await payload()).findGlobal({ slug: 'home', depth: 1 }))
export const getComunidad = cache(async () => (await payload()).findGlobal({ slug: 'comunidad', depth: 1 }))

export const getProgramas = cache(async () =>
  (await payload()).find({ collection: 'programas', depth: 0, limit: 50, sort: 'order', pagination: false }),
)

export const getPrograma = cache(async (slug: string) => {
  const res = await (await payload()).find({
    collection: 'programas',
    where: { slug: { equals: slug } },
    depth: 1,
    limit: 1,
  })
  return res.docs[0] ?? null
})

export const getPagina = cache(async (slug: string) => {
  const res = await (await payload()).find({
    collection: 'paginas',
    where: { slug: { equals: slug } },
    depth: 1,
    limit: 1,
  })
  return res.docs[0] ?? null
})

export const getPaginas = cache(async () =>
  (await payload()).find({ collection: 'paginas', depth: 0, limit: 100, pagination: false }),
)
