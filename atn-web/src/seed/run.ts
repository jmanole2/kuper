import config from '@payload-config'
import { getPayload } from 'payload'
import { seedIfEmpty } from './index'

// `npm run seed` — carga el contenido inicial si la base de datos está vacía.
const payload = await getPayload({ config })
await seedIfEmpty(payload)
process.exit(0)
