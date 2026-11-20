import type { GlobalConfig } from 'payload'
import { linkField } from '../fields/link'
import { iconItemsField, mapSectionField, recetarioField } from '../fields/sections'
import { seoField } from '../fields/seo'
import { revalidateGlobal } from '../hooks/revalidate'

export const Home: GlobalConfig = {
  slug: 'home',
  label: 'Inicio',
  admin: { group: 'Páginas', livePreview: { url: '/' } },
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
                {
                  name: 'logo',
                  label: 'Logo grande (opcional)',
                  type: 'upload',
                  relationTo: 'media',
                  admin: { description: 'Si no subes logo se muestra el título en texto.' },
                },
                { name: 'title', label: 'Título (si no hay logo)', type: 'text' },
                {
                  name: 'slides',
                  label: 'Carrusel (máximo 4 fotos)',
                  type: 'array',
                  maxRows: 4,
                  labels: { singular: 'Foto', plural: 'Fotos' },
                  fields: [{ name: 'image', label: 'Foto', type: 'upload', relationTo: 'media', required: true }],
                },
              ],
            },
          ],
        },
        {
          label: '¿Qué es?',
          fields: [
            {
              name: 'about',
              label: false,
              type: 'group',
              fields: [
                { name: 'title', label: 'Título', type: 'text' },
                { name: 'body', label: 'Texto', type: 'textarea', admin: { rows: 8 } },
                { name: 'image', label: 'Foto de sesiones', type: 'upload', relationTo: 'media' },
              ],
            },
          ],
        },
        {
          label: 'Impacto',
          fields: [
            {
              name: 'impact',
              label: false,
              type: 'group',
              fields: [{ name: 'title', label: 'Título', type: 'text' }, iconItemsField('items', 'Cifras')],
            },
          ],
        },
        { label: 'Mapa', fields: [mapSectionField] },
        {
          label: 'Programas',
          fields: [
            {
              name: 'programs',
              label: 'Tarjetas de programas',
              type: 'array',
              maxRows: 4,
              labels: { singular: 'Programa', plural: 'Programas' },
              fields: [
                { name: 'image', label: 'Foto', type: 'upload', relationTo: 'media' },
                { name: 'question', label: 'Pregunta', type: 'text', required: true },
                linkField({ name: 'cta', label: 'Botón', required: true }),
              ],
            },
          ],
        },
        {
          label: 'Recetario y comunidad',
          fields: [recetarioField, linkField({ name: 'communityCta', label: 'Botón: Conoce la comunidad' })],
        },
        { label: 'SEO', fields: [seoField] },
      ],
    },
  ],
}
