import type { CollectionConfig } from 'payload'
import { linkField } from '../fields/link'
import { iconItemsField, testimonialsField } from '../fields/sections'
import { seoField } from '../fields/seo'
import { slugField } from '../fields/slug'
import { revalidateCollection, revalidateCollectionDelete } from '../hooks/revalidate'

export const Programas: CollectionConfig = {
  slug: 'programas',
  labels: { singular: 'Programa', plural: 'Programas' },
  admin: {
    group: 'Páginas',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'updatedAt'],
    description: 'Páginas de programa: Fortalecimiento, Ideas…',
    livePreview: { url: ({ data }) => `/${data?.slug ?? ''}` },
  },
  access: { read: () => true },
  hooks: { afterChange: [revalidateCollection], afterDelete: [revalidateCollectionDelete] },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'name', label: 'Nombre del programa', type: 'text', required: true, admin: { width: '50%' } },
        {
          name: 'order',
          label: 'Orden en el menú',
          type: 'number',
          defaultValue: 1,
          admin: { width: '25%' },
        },
      ],
    },
    slugField('name'),
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
                { name: 'background', label: 'Imagen de fondo', type: 'upload', relationTo: 'media' },
                {
                  name: 'logo',
                  label: 'Logo (opcional)',
                  type: 'upload',
                  relationTo: 'media',
                  admin: { description: 'Si no subes logo se muestra el título en texto.' },
                },
                { name: 'title', label: 'Título (si no hay logo)', type: 'text' },
                { name: 'subtitle', label: 'Subtítulo', type: 'text' },
                linkField({ name: 'cta', label: 'Botón' }),
              ],
            },
          ],
        },
        {
          label: 'Introducción',
          fields: [
            {
              name: 'intro',
              label: false,
              type: 'group',
              fields: [
                { name: 'title', label: 'Título', type: 'text' },
                { name: 'body', label: 'Texto', type: 'textarea', admin: { rows: 8 } },
                { name: 'image', label: 'Foto', type: 'upload', relationTo: 'media' },
              ],
            },
          ],
        },
        {
          label: 'Beneficios',
          fields: [
            {
              name: 'benefits',
              label: false,
              type: 'group',
              fields: [
                { name: 'title', label: 'Título', type: 'text' },
                iconItemsField('items', 'Beneficios'),
              ],
            },
          ],
        },
        {
          label: 'Convocatoria',
          fields: [
            {
              name: 'call',
              label: false,
              type: 'group',
              fields: [
                { name: 'title', label: 'Título', type: 'text' },
                {
                  name: 'images',
                  label: 'Fotos',
                  type: 'array',
                  maxRows: 2,
                  fields: [{ name: 'image', label: 'Foto', type: 'upload', relationTo: 'media', required: true }],
                },
                linkField({ name: 'cta', label: 'Botón' }),
                { name: 'eligibilityTitle', label: 'Título: ¿Quién puede aplicar?', type: 'text' },
                {
                  name: 'eligibility',
                  label: 'Requisitos',
                  type: 'array',
                  labels: { singular: 'Requisito', plural: 'Requisitos' },
                  fields: [{ name: 'text', label: 'Requisito', type: 'text', required: true }],
                },
              ],
            },
          ],
        },
        {
          label: 'Proceso y etapas',
          fields: [
            {
              name: 'process',
              label: 'Proceso de aplicación',
              type: 'group',
              fields: [
                { name: 'title', label: 'Título', type: 'text' },
                iconItemsField('steps', 'Pasos', 8),
              ],
            },
            {
              name: 'stages',
              label: 'Etapas del programa',
              type: 'group',
              fields: [
                { name: 'title', label: 'Título', type: 'text' },
                {
                  name: 'items',
                  label: 'Etapas',
                  type: 'array',
                  labels: { singular: 'Etapa', plural: 'Etapas' },
                  admin: { initCollapsed: true },
                  fields: [
                    { name: 'image', label: 'Foto', type: 'upload', relationTo: 'media' },
                    { name: 'title', label: 'Título', type: 'text', required: true },
                    { name: 'description', label: 'Descripción', type: 'textarea' },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Testimonios y comunidad',
          fields: [
            testimonialsField,
            {
              name: 'community',
              label: 'Sección: Conoce la comunidad',
              type: 'group',
              fields: [
                { name: 'title', label: 'Título', type: 'text' },
                { name: 'image', label: 'Foto', type: 'upload', relationTo: 'media' },
                linkField({ name: 'cta', label: 'Botón' }),
              ],
            },
          ],
        },
        { label: 'SEO', fields: [seoField] },
      ],
    },
  ],
}
