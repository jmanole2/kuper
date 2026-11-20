import type { Field } from 'payload'
import { iconField } from './icon'
import { linkField } from './link'

/** Lista de íconos con título y texto (Impacto, Beneficios, Proceso). */
export const iconItemsField = (name: string, label: string, maxRows = 8): Field => ({
  name,
  label,
  type: 'array',
  maxRows,
  labels: { singular: 'Elemento', plural: 'Elementos' },
  admin: { initCollapsed: true },
  fields: [
    {
      type: 'row',
      fields: [
        iconField,
        { name: 'title', label: 'Título', type: 'text', required: true, admin: { width: '70%' } },
      ],
    },
    { name: 'description', label: 'Descripción', type: 'textarea' },
  ],
})

/** Sección "Encuentra tu panadería" (mapa). */
export const mapSectionField: Field = {
  name: 'map',
  label: 'Sección: Encuentra tu panadería (mapa)',
  type: 'group',
  fields: [
    { name: 'enabled', label: 'Mostrar sección', type: 'checkbox', defaultValue: true },
    { name: 'title', label: 'Título', type: 'text' },
    { name: 'description', label: 'Descripción', type: 'textarea' },
    { name: 'image', label: 'Imagen del mapa', type: 'upload', relationTo: 'media' },
    {
      name: 'embedUrl',
      label: 'Mapa interactivo (URL de Google My Maps, opcional)',
      type: 'text',
      admin: {
        description:
          'Si lo llenas, se muestra el mapa interactivo en lugar de la imagen. Usa la URL de "Insertar en mi sitio" (https://www.google.com/maps/d/embed?...).',
      },
    },
    linkField({ name: 'primaryButton', label: 'Botón principal' }),
    linkField({ name: 'secondaryButton', label: 'Botón secundario' }),
  ],
}

/** Testimonios. */
export const testimonialsField: Field = {
  name: 'testimonials',
  label: 'Sección: Testimonios',
  type: 'group',
  fields: [
    { name: 'title', label: 'Título', type: 'text' },
    {
      name: 'items',
      label: 'Testimonios',
      type: 'array',
      labels: { singular: 'Testimonio', plural: 'Testimonios' },
      admin: { initCollapsed: true },
      fields: [
        { name: 'quote', label: 'Testimonio', type: 'textarea', required: true },
        {
          type: 'row',
          fields: [
            { name: 'name', label: 'Nombre', type: 'text', required: true, admin: { width: '50%' } },
            { name: 'detail', label: 'Descripción / año', type: 'text', admin: { width: '50%' } },
          ],
        },
        { name: 'avatar', label: 'Foto', type: 'upload', relationTo: 'media' },
      ],
    },
  ],
}

/** Recetario "Amasando Recuerdos". */
export const recetarioField: Field = {
  name: 'recetario',
  label: 'Sección: Recetario',
  type: 'group',
  fields: [
    { name: 'enabled', label: 'Mostrar sección', type: 'checkbox', defaultValue: true },
    { name: 'title', label: 'Título', type: 'text' },
    {
      name: 'items',
      label: 'Recetarios',
      type: 'array',
      labels: { singular: 'Recetario', plural: 'Recetarios' },
      admin: { initCollapsed: true },
      fields: [
        { name: 'image', label: 'Portada', type: 'upload', relationTo: 'media' },
        {
          type: 'row',
          fields: [
            { name: 'title', label: 'Título', type: 'text', required: true, admin: { width: '50%' } },
            { name: 'subtitle', label: 'Subtítulo (ej. Generación)', type: 'text', admin: { width: '50%' } },
          ],
        },
        { name: 'file', label: 'Archivo para descargar (PDF)', type: 'upload', relationTo: 'media' },
        {
          name: 'downloadLabel',
          label: 'Texto del enlace de descarga',
          type: 'text',
          defaultValue: 'Descargar',
        },
      ],
    },
  ],
}
