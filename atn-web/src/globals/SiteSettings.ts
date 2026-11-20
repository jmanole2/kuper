import type { GlobalConfig } from 'payload'
import { linkField } from '../fields/link'
import { revalidateGlobal } from '../hooks/revalidate'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Configuración del sitio',
  admin: { group: 'Configuración' },
  access: { read: () => true },
  hooks: { afterChange: [revalidateGlobal] },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'General',
          fields: [
            { name: 'siteName', label: 'Nombre del sitio', type: 'text', required: true },
            {
              type: 'row',
              fields: [
                {
                  name: 'logo',
                  label: 'Logo (fondo claro)',
                  type: 'upload',
                  relationTo: 'media',
                  admin: { width: '50%' },
                },
                {
                  name: 'logoLight',
                  label: 'Logo blanco (sobre fotos)',
                  type: 'upload',
                  relationTo: 'media',
                  admin: { width: '50%' },
                },
              ],
            },
            {
              name: 'nav',
              label: 'Menú principal',
              type: 'array',
              labels: { singular: 'Enlace', plural: 'Enlaces' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'label', label: 'Texto', type: 'text', required: true, admin: { width: '50%' } },
                    { name: 'url', label: 'URL', type: 'text', required: true, admin: { width: '50%' } },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Aliados',
          description:
            'Bloque "Un programa de / En colaboración con / Implementado por". Aparece en Inicio, Comunidad y los programas.',
          fields: [
            {
              name: 'allies',
              label: 'Aliados',
              type: 'array',
              maxRows: 6,
              labels: { singular: 'Aliado', plural: 'Aliados' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'heading', label: 'Encabezado', type: 'text', required: true, admin: { width: '50%' } },
                    { name: 'name', label: 'Nombre del aliado', type: 'text', required: true, admin: { width: '50%' } },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'logo', label: 'Logo', type: 'upload', relationTo: 'media', admin: { width: '50%' } },
                    {
                      name: 'background',
                      label: 'Foto de fondo',
                      type: 'upload',
                      relationTo: 'media',
                      admin: { width: '50%' },
                    },
                  ],
                },
                { name: 'url', label: 'Sitio web del aliado', type: 'text' },
              ],
            },
          ],
        },
        {
          label: 'Pie de página y contacto',
          fields: [
            {
              name: 'whatsapp',
              label: 'Botón de WhatsApp',
              type: 'group',
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'number',
                      label: 'Número (con lada, sin espacios)',
                      type: 'text',
                      admin: { width: '50%', placeholder: '5215512345678' },
                    },
                    {
                      name: 'message',
                      label: 'Mensaje inicial',
                      type: 'text',
                      admin: { width: '50%' },
                    },
                  ],
                },
              ],
            },
            {
              name: 'footerLinks',
              label: 'Enlaces legales',
              type: 'array',
              labels: { singular: 'Enlace', plural: 'Enlaces' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'label', label: 'Texto', type: 'text', required: true, admin: { width: '50%' } },
                    { name: 'url', label: 'URL', type: 'text', required: true, admin: { width: '50%' } },
                  ],
                },
              ],
            },
            {
              name: 'footerLogos',
              label: 'Logos de entidades',
              type: 'array',
              maxRows: 8,
              labels: { singular: 'Logo', plural: 'Logos' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'name', label: 'Nombre', type: 'text', required: true, admin: { width: '50%' } },
                    { name: 'url', label: 'URL', type: 'text', admin: { width: '50%' } },
                  ],
                },
                { name: 'logo', label: 'Logo', type: 'upload', relationTo: 'media' },
              ],
            },
            { name: 'contactTitle', label: 'Título de contacto', type: 'text' },
            {
              name: 'contactLinks',
              label: 'Datos de contacto',
              type: 'array',
              labels: { singular: 'Dato', plural: 'Datos' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'label', label: 'Texto', type: 'text', required: true, admin: { width: '50%' } },
                    {
                      name: 'url',
                      label: 'URL (https://, mailto:, tel:)',
                      type: 'text',
                      admin: { width: '50%' },
                    },
                  ],
                },
              ],
            },
            {
              name: 'social',
              label: 'Redes sociales',
              type: 'group',
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'facebook', label: 'Facebook', type: 'text', admin: { width: '33%' } },
                    { name: 'linkedin', label: 'LinkedIn', type: 'text', admin: { width: '33%' } },
                    { name: 'instagram', label: 'Instagram', type: 'text', admin: { width: '33%' } },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'SEO general',
          fields: [
            {
              name: 'siteUrl',
              label: 'URL pública del sitio',
              type: 'text',
              admin: {
                description: 'Ej: https://amasandotunegocio.mx — se usa para el sitemap, canonical y Open Graph.',
              },
            },
            { name: 'defaultTitle', label: 'Título por defecto', type: 'text' },
            { name: 'defaultDescription', label: 'Descripción por defecto', type: 'textarea' },
            { name: 'defaultImage', label: 'Imagen para compartir por defecto', type: 'upload', relationTo: 'media' },
            {
              name: 'googleVerification',
              label: 'Código de verificación de Google Search Console',
              type: 'text',
            },
            {
              name: 'gaId',
              label: 'ID de Google Analytics 4 (G-XXXXXXX)',
              type: 'text',
            },
          ],
        },
      ],
    },
  ],
}
