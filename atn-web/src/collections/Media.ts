import type { CollectionConfig } from 'payload'
import { revalidateCollection, revalidateCollectionDelete } from '../hooks/revalidate'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Archivo', plural: 'Imágenes y archivos' },
  admin: { group: 'Contenido', description: 'Imágenes, logos y PDFs del sitio.' },
  access: { read: () => true },
  hooks: { afterChange: [revalidateCollection], afterDelete: [revalidateCollectionDelete] },
  fields: [
    {
      name: 'alt',
      label: 'Texto alternativo (SEO / accesibilidad)',
      type: 'text',
      required: true,
      admin: { description: 'Describe la imagen en pocas palabras. Google lo usa para entenderla.' },
    },
  ],
  upload: {
    mimeTypes: ['image/*', 'application/pdf', 'video/mp4', 'video/webm'],
    focalPoint: true,
    formatOptions: { format: 'webp', options: { quality: 82 } },
    imageSizes: [
      { name: 'thumbnail', width: 400, formatOptions: { format: 'webp', options: { quality: 80 } } },
      { name: 'card', width: 900, formatOptions: { format: 'webp', options: { quality: 80 } } },
      { name: 'large', width: 1920, formatOptions: { format: 'webp', options: { quality: 82 } } },
      {
        name: 'og',
        width: 1200,
        height: 630,
        position: 'centre',
        formatOptions: { format: 'jpeg', options: { quality: 82 } },
      },
    ],
  },
}
