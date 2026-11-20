import type { Field } from 'payload'

type Opts = { name: string; label: string; required?: boolean }

/** Botón / enlace editable: texto + URL. */
export const linkField = ({ name, label, required = false }: Opts): Field => ({
  name,
  label,
  type: 'group',
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'label', label: 'Texto', type: 'text', required, admin: { width: '50%' } },
        {
          name: 'url',
          label: 'URL',
          type: 'text',
          required,
          admin: {
            width: '50%',
            description: 'Ruta interna (/ideas) o enlace externo (https://…).',
          },
        },
      ],
    },
  ],
})
