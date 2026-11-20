import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, GlobalAfterChangeHook } from 'payload'

/** Vuelve a generar las páginas públicas cuando se edita contenido en el admin. */
const revalidateAll = async () => {
  try {
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/', 'layout')
  } catch {
    // Fuera de Next (ej. script de seed): no hay caché que invalidar.
  }
}

export const revalidateGlobal: GlobalAfterChangeHook = async ({ doc }) => {
  await revalidateAll()
  return doc
}

export const revalidateCollection: CollectionAfterChangeHook = async ({ doc }) => {
  await revalidateAll()
  return doc
}

export const revalidateCollectionDelete: CollectionAfterDeleteHook = async ({ doc }) => {
  await revalidateAll()
  return doc
}
