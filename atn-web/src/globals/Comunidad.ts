import type { GlobalConfig } from 'payload'
import { mapSectionField, recetarioField, testimonialsField } from '../fields/sections'
import { seoField } from '../fields/seo'
import { revalidateGlobal } from '../hooks/revalidate'

export const Comunidad: GlobalConfig = {
  slug: 'comunidad',
  label: 'Comunidad',
  admin: { group: 'Páginas', livePreview: { url: '/comunidad' } },
  access: { read: () => true },
  hooks: { afterChange: [revalidateGlobal] },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Portada',
          fields: [
            {
              name: 'hero',
              label: false,
              type: 'group',
              fields: [
                { name: 'eyebrow', label: 'Título (primera línea)', type: 'text' },
                {
                  name: 'logo',
                  label: 'Logo (opcional)',
                  type: 'upload',
                  relationTo: 'media',
                },
                { name: 'title', label: 'Título (si no hay logo)', type: 'text' },
                {
                  name: 'videoUrl',
                  label: 'Video más reciente (URL de YouTube o Vimeo)',
                  type: 'text',
                },
                {
                  name: 'videoFile',
                  label: 'O sube un video MP4',
                  type: 'upload',
                  relationTo: 'media',
                },
                {
                  name: 'poster',
                  label: 'Imagen de portada del video',
                  type: 'upload',
                  relationTo: 'media',
                },
              ],
            },
          ],
        },
        { label: 'Mapa', fields: [mapSectionField] },
        { label: 'Testimonios', fields: [testimonialsField] },
        { label: 'Recetario', fields: [recetarioField] },
        { label: 'SEO', fields: [seoField] },
      ],
    },
  ],
}
