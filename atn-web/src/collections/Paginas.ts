import type { CollectionConfig } from 'payload'
import { seoField } from '../fields/seo'
import { slugField } from '../fields/slug'
import { revalidateCollection, revalidateCollectionDelete } from '../hooks/revalidate'

/** Páginas de texto simples: Aviso de privacidad, Quejas y sugerencias, etc. */
export const Paginas: CollectionConfig = {
  slug: 'paginas',
  labels: { singular: 'Página de texto', plural: 'Páginas de texto' },
  admin: {
    group: 'Páginas',
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'updatedAt'],
    description: 'Aviso de privacidad, Quejas y sugerencias y otras páginas de texto.',
  },
  access: { read: () => true },
  hooks: { afterChange: [revalidateCollection], afterDelete: [revalidateCollectionDelete] },
  fields: [
    { name: 'title', label: 'Título', type: 'text', required: true },
    slugField('title'),
    { name: 'content', label: 'Contenido', type: 'richText' },
    seoField,
  ],
}
