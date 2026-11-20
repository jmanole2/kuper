import type { Field } from 'payload'

const slugify = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

export const slugField = (from = 'title'): Field => ({
  name: 'slug',
  label: 'URL (slug)',
  type: 'text',
  unique: true,
  index: true,
  admin: {
    position: 'sidebar',
    description: 'Se genera automáticamente. Ej: "fortalecimiento" → /fortalecimiento',
  },
  hooks: {
    beforeValidate: [
      ({ value, data }) => {
        if (typeof value === 'string' && value.length) return slugify(value)
        const src = data?.[from]
        return typeof src === 'string' ? slugify(src) : value
      },
    ],
  },
})
