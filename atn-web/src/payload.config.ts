import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { es } from '@payloadcms/translations/languages/es'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { Media } from './collections/Media'
import { Paginas } from './collections/Paginas'
import { Programas } from './collections/Programas'
import { Users } from './collections/Users'
import { Comunidad } from './globals/Comunidad'
import { Home } from './globals/Home'
import { SiteSettings } from './globals/SiteSettings'
import { migrations } from './migrations'
import { seedIfEmpty } from './seed'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || '',
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: {
      titleSuffix: ' · Admin Amasando Tu Negocio',
    },
    livePreview: {
      breakpoints: [
        { label: 'Móvil', name: 'mobile', width: 390, height: 844 },
        { label: 'Tablet', name: 'tablet', width: 834, height: 1112 },
        { label: 'Escritorio', name: 'desktop', width: 1440, height: 900 },
      ],
    },
  },
  i18n: { supportedLanguages: { es }, fallbackLanguage: 'es' },
  collections: [Programas, Paginas, Media, Users],
  globals: [Home, Comunidad, SiteSettings],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URL || 'file:./atn.db',
      authToken: process.env.DATABASE_AUTH_TOKEN,
    },
    prodMigrations: migrations,
    push: false, // el esquema se controla con migraciones (src/migrations)
  }),
  sharp,
  upload: { limits: { fileSize: 50_000_000 } },
  onInit: async (payload) => {
    await seedIfEmpty(payload)
  },
})
