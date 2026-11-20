import type { Field } from 'payload'

/** Grupo de SEO reutilizable para cada página. */
export const seoField: Field = {
  name: 'seo',
  label: 'SEO',
  type: 'group',
  admin: {
    description:
      'Cómo aparece esta página en Google y al compartirla en redes. Si lo dejas vacío se usan los valores generales de "Configuración del sitio".',
  },
  fields: [
    {
      name: 'title',
      label: 'Título SEO',
      type: 'text',
      admin: { description: 'Recomendado: 50–60 caracteres.' },
      maxLength: 70,
    },
    {
      name: 'description',
      label: 'Meta descripción',
      type: 'textarea',
      admin: { description: 'Recomendado: 140–160 caracteres.' },
      maxLength: 200,
    },
    {
      name: 'image',
      label: 'Imagen para compartir (Open Graph)',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Ideal 1200 × 630 px.' },
    },
    {
      name: 'noIndex',
      label: 'Ocultar de buscadores (noindex)',
      type: 'checkbox',
      defaultValue: false,
    },
  ],
}
