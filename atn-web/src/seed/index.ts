import path from 'path'
import type { Payload } from 'payload'
import { fileURLToPath } from 'url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const img = (name: string) => path.resolve(dirname, 'images', `${name}.jpg`)

const text = (s: string) => s.trim()

/** Carga el contenido del diseño de Figma la primera vez que arranca el sitio. */
export async function seedIfEmpty(payload: Payload) {
  if (process.env.SKIP_SEED === 'true') return
  const existing = await payload.find({ collection: 'programas', limit: 1, depth: 0 })
  const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0 })
  if (existing.totalDocs > 0 || settings?.siteName) return
  payload.logger.info('Sembrando contenido inicial del diseño…')
  await seed(payload)
  payload.logger.info('Contenido inicial listo.')
}

export async function seed(payload: Payload) {
  const cache = new Map<string, number>()
  const media = async (name: string, alt: string) => {
    const key = `${name}|${alt}`
    if (cache.has(key)) return cache.get(key)!
    const doc = await payload.create({ collection: 'media', data: { alt }, filePath: img(name) })
    cache.set(key, doc.id as number)
    return doc.id as number
  }

  const [rabanos, cerezas, hongos] = await Promise.all([
    media('aliado-rabanos', 'Rábanos frescos sobre fondo blanco'),
    media('aliado-cerezas', 'Cerezas sobre fondo claro'),
    media('aliado-hongos', 'Hongos sobre fondo claro'),
  ])
  const mapa = await media('mapa', 'Mapa de panaderías Amasando Tu Negocio')
  const recetario = await media('recetario', 'Portada del recetario Amasando Recuerdos')
  const programaFondo = await media('programa-fondo', 'Peras frescas, fondo del programa')
  const programaIntro = await media('programa-intro', 'Sesión del programa Amasando Tu Negocio')
  const conv1 = await media('convocatoria-1', 'Pan, fruta y vino sobre una mesa')
  const conv2 = await media('convocatoria-2', 'Canasta y fruta sobre mantel blanco')
  const fotoFort = await media('foto-fortalecimiento', 'Panadería tradicional mexicana')
  const fotoSesiones = await media('foto-sesiones', 'Foto de sesiones de capacitación')
  const carrusel1 = await media('carrusel-1', 'Amasando Tu Negocio, capacitación para panaderos')
  const av1 = await media('avatar-1', 'Foto de Rosa Isela')
  const av2 = await media('avatar-2', 'Foto de David')
  const av3 = await media('avatar-3', 'Foto de Jaime')

  const testimonials = [
    {
      quote: text(
        '“Me siento muy contenta y agradecida con amasando tu negocio.\nEste mes, al día de hoy, cerré ventas con $16,400 ya de utilidad neta.”',
      ),
      name: 'Rosa Isela',
      detail: '2026',
      avatar: av1,
    },
    {
      quote: '“¡Me encanta poder formar parte de una comunidad tan activa y abierta!”',
      name: 'David',
      detail: '2025',
      avatar: av2,
    },
    {
      quote: '“Gracias a lo aprendido en el programa compre mi laminadora y hoy se paga practicamente sola.”',
      name: 'Jaime',
      detail: '2026',
      avatar: av3,
    },
  ]

  const mapSection = (title: string) => ({
    enabled: true,
    title,
    description:
      'Panaderías en sitio y Dark Bakeries que vale la pena probar en México!\nCada una de ellas paso por el programa de fortalecimiento e incubación "Amasando Tu Negocio".',
    image: mapa,
    primaryButton: { label: 'Ver mapa', url: '#mapa' },
    secondaryButton: { label: 'Conoce los programas', url: '/fortalecimiento' },
  })

  const recetarioItems = [
    { image: recetario, title: 'Recetario 2025', downloadLabel: 'Descargar' },
    { image: recetario, title: 'Recetario 2026', downloadLabel: 'Descargar' },
  ]

  await payload.updateGlobal({
    slug: 'site-settings',
    data: {
      siteName: 'Amasando Tu Negocio',
      nav: [
        { label: 'Comunidad', url: '/comunidad' },
        { label: 'Fortalecimiento', url: '/fortalecimiento' },
        { label: 'Ideas', url: '/ideas' },
      ],
      allies: [
        { heading: 'Un programa de', name: 'Lesaffre', background: rabanos },
        { heading: 'En colaboración con', name: 'San Blas', background: cerezas },
        { heading: 'Implementado por', name: 'New Ventures', background: hongos },
      ],
      whatsapp: { number: '', message: 'Hola, quiero información sobre Amasando Tu Negocio' },
      footerLinks: [
        { label: 'Aviso de Privacidad', url: '/aviso-de-privacidad' },
        { label: 'Quejas y Sugerencias', url: '/quejas-y-sugerencias' },
      ],
      footerLogos: [],
      contactTitle: 'Contáctanos',
      contactLinks: [
        { label: 'Página', url: '/' },
        { label: 'Mail', url: 'mailto:contacto@amasandotunegocio.mx' },
      ],
      social: { facebook: '', linkedin: '', instagram: '' },
      siteUrl: process.env.NEXT_PUBLIC_SERVER_URL || '',
      defaultTitle: 'Amasando Tu Negocio | Capacitación gratuita para panaderos en México',
      defaultDescription:
        'Amasando Tu Negocio es una iniciativa de capacitación gratuita para panaderos y panaderas en todo México, diseñada por expertos en panificación y negocios.',
      defaultImage: carrusel1,
    },
  })

  await payload.updateGlobal({
    slug: 'home',
    data: {
      hero: {
        title: 'Amasando Tu Negocio',
        slides: [{ image: carrusel1 }, { image: conv2 }, { image: programaIntro }],
      },
      about: {
        title: '¿Qué es Amasando Tu Negocio?',
        body: 'Diseñado por expertos en panificación y negocios, Amasando Tu Negocio es una iniciativa de capacitación gratuita para panaderos y panaderas en TODO México.\n\nLa iniciativa que opera desde 2023 se desarrolla a través de dos programas estratégicos, diseñados para acompañar distintas etapas del negocio.',
        image: fotoSesiones,
      },
      impact: {
        title: 'Impacto Amasando Tu Negocio',
        items: [
          { icon: 'users', title: '+760 Panaderos/as', description: 'Han cruzado por el programa.' },
          {
            icon: 'clock',
            title: '+745 horas de capacitación',
            description:
              'En temas de:\nAdministración y Finanzas\nMarketing y Ventas\nTécnicas panaderas\nResiliencia y Liderazgo\nModelo de Negocios',
          },
          { icon: 'pin', title: 'Presencia en Toda la República Mexicana', description: '' },
        ],
      },
      map: mapSection('Encuentra tu panadería Amasando Tu Negocio'),
      programs: [
        {
          image: conv1,
          question: '¿Quieres inicar un negocio de pan?',
          cta: { label: 'Conoce Amasando Ideas', url: '/ideas' },
        },
        {
          image: fotoFort,
          question: '¿Buscas fortalecer y hacer crecer tu panadería?',
          cta: { label: 'Conoce Amasando tu Negocio Fortalecimiento', url: '/fortalecimiento' },
        },
      ],
      recetario: {
        enabled: true,
        title: 'Amasando Recuerdos: Un recetario con historia',
        items: recetarioItems,
      },
      communityCta: { label: 'Conoce más de la Comunidad Amasando Tu Negocio', url: '/comunidad' },
      seo: {
        title: 'Amasando Tu Negocio | Capacitación gratuita para panaderos en México',
        description:
          'Iniciativa de capacitación gratuita para panaderos y panaderas en todo México. Programas Fortalecimiento e Ideas, diseñados por expertos en panificación y negocios.',
      },
    },
  })

  await payload.updateGlobal({
    slug: 'comunidad',
    data: {
      hero: { eyebrow: 'Comunidad', title: 'Amasando Tu Negocio', poster: carrusel1, videoUrl: '' },
      map: mapSection('Encuentra tu panadería'),
      testimonials: { title: 'Testimonios', items: testimonials },
      recetario: {
        enabled: true,
        title: 'Amasando Recuerdos: Un recetario con historia',
        items: recetarioItems.map((i) => ({ ...i, subtitle: 'Generación' })),
      },
      seo: {
        title: 'Comunidad | Amasando Tu Negocio',
        description:
          'Conoce la comunidad de panaderos y panaderas de Amasando Tu Negocio: testimonios, panaderías participantes y el recetario Amasando Recuerdos.',
      },
    },
  })

  const filler = 'Agrega puntos clave, citas, anécdotas o una historia muy muy breve.'
  const processSteps = [
    { icon: 'form', title: 'Llena el formulario de Aplicación', description: 'Breve formulario de 5 minutos' },
    {
      icon: 'avatar',
      title: 'Te contactaremos via WhatsApp ¡espera nuestro mensaje!',
      description: 'Te estaremos buscando para darte los siguientes pasos.',
    },
    { icon: 'lock', title: 'Segundo formulario', description: 'Queremos conocerte y saber más de tu panadería.' },
    {
      icon: 'calendar',
      title: 'Notificación por WhatsApp',
      description: 'Si fuiste uno o una de los 100 seleccionados recibirás una notificación vía WhatsApp',
    },
  ] as const
  const community = {
    title: 'Conoce más sobre la comunidad Amasando Tu Negocio',
    image: mapa,
    cta: { label: 'Ir a Comunidad', url: '/comunidad' },
  }

  await payload.create({
    collection: 'programas',
    data: {
      name: 'Fortalecimiento',
      slug: 'fortalecimiento',
      order: 1,
      hero: {
        background: programaFondo,
        title: 'Amasando Tu Negocio',
        subtitle: 'Fortalecimiento',
        cta: { label: 'Aplica a la convocatoria Aquí', url: '#convocatoria' },
      },
      intro: {
        title: 'Amasando tu negocio Fortalecimiento es....',
        body: 'Programa de profesionalización y fortalecimiento gratuito para dueñas y dueños de panaderías tradicionales en México.\n\nEste programa esta diseñado por expertos en pan y negocios para que las Mipymes panaderas puedan mejorar sus ventas, administrar mejor su tiempo, dirigir a su equipo y profesionalizar su negocio.\nDuración: 4 meses',
        image: programaIntro,
      },
      benefits: {
        title: 'Beneficios de Participar en Amasando Tu Negocio Fortalecimiento',
        items: [
          { icon: 'book', title: 'Capacitación práctica', description: filler },
          {
            icon: 'users',
            title: 'Acceso a una red de mentores y especialistas del sector panadero y de negocios',
            description: filler,
          },
          { icon: 'heart', title: 'Pertenecer a una comunidad nacional de panaderos', description: filler },
          {
            icon: 'money',
            title: 'Posibilidad de postular a un microcrédito de hasta $30,000 MXN',
            description: filler,
          },
        ],
      },
      call: {
        title: 'Convocatoria 2027',
        images: [{ image: conv1 }, { image: conv2 }],
        cta: { label: 'Aplica a la convocatoria aquí', url: '#' },
        eligibilityTitle: '¿Quién puede aplicar a Amasando Tu Negocio Fortalecimiento?',
        eligibility: [
          'Personas mayores de 18 años.',
          'Que radiquen en la República Mexicana.',
          'Mantener ventas activas y operación regular.',
          'Más de 1 año de operación.',
          'Ser dueño o dueña de una panadería ubicada en cualquier estado de la República mexicana.',
          'Con acceso a internet para conectarse a los talleres de manera virtual.',
          'Interés en hacer crecer tu negocio.',
        ].map((t) => ({ text: t })),
      },
      process: { title: 'Proceso de Aplicación', steps: [...processSteps] },
      stages: {
        title: 'Etapas del programa',
        items: [
          {
            image: rabanos,
            title: 'Etapa 1: Bootcamp',
            description: '2 semanas de talleres grupales sobre negocios y técnicas panaderas.',
          },
          {
            image: cerezas,
            title: 'Etapa 2: Mentorías Personalizadas',
            description: '3 semanas de acompañamiento intensivo uno a uno.',
          },
          {
            image: hongos,
            title: 'Etapa 3: Gran Reto Baking Center',
            description:
              'Viaje al Baking Center de Lesaffre en Toluca durante 3 días todo pagado, para participar en el "Reto final" del programa en donde presentarás tu mini caso de negocio.',
          },
        ],
      },
      testimonials: { title: 'Testimoniales', items: testimonials },
      community,
      seo: {
        title: 'Fortalecimiento | Amasando Tu Negocio',
        description:
          'Programa gratuito de profesionalización para dueñas y dueños de panaderías tradicionales en México. Mejora tus ventas, tu equipo y tu negocio en 4 meses.',
      },
    },
  })

  await payload.create({
    collection: 'programas',
    data: {
      name: 'Ideas',
      slug: 'ideas',
      order: 2,
      hero: {
        background: programaFondo,
        title: 'Amasando Tu Negocio',
        subtitle: 'Ideas',
        cta: { label: 'Aplica a la convocatoria Aquí', url: '#convocatoria' },
      },
      intro: {
        title: 'Amasando tu negocio IDEAS es....',
        body: 'Programa GRATUITO y 100% en línea diseñado para ayudar a emprendedores en panadería a darle forma a su idea y conviertirla en un negocio, recibirás la guía y las herramientas necesarias para emprender con éxito.\nDuración: 3 meses',
        image: programaIntro,
      },
      benefits: {
        title: 'Beneficios de Participar en Amasando Tu Negocio Ideas',
        items: [
          { icon: 'book', title: 'Acceso a talleres de incubación de negocios y panadería.', description: filler },
          { icon: 'star', title: 'Acceso a recursos y materiales exclusivos.', description: filler },
          {
            icon: 'users',
            title: 'Acceso a una red de mentores y especialistas del sector panadero y de negocios',
            description: filler,
          },
          { icon: 'heart', title: 'Pertenecer a una comunidad nacional de panaderos', description: filler },
        ],
      },
      call: {
        title: 'Convocatoria 2027',
        images: [{ image: conv1 }, { image: conv2 }],
        cta: { label: 'Aplica a la convocatoria aquí', url: '#' },
        eligibilityTitle: '¿Quién puede aplicar a Amasando Tu Negocio Ideas?',
        eligibility: [
          'Personas mayores de 18 años.',
          'Que radiquen en la República Mexicana.',
          'Con conocimientos básicos y pasión por la panadería.',
          'Con interés en emprender formalmente y crear su negocio de panadería.',
          'Con acceso a internet para conectarse a los talleres de manera virtual.',
        ].map((t) => ({ text: t })),
      },
      process: { title: 'Proceso de Aplicación', steps: [...processSteps] },
      stages: {
        title: 'Etapas del programa',
        items: [
          {
            image: rabanos,
            title: 'Etapa 1: Bootcamp',
            description: '2 semanas de talleres grupales sobre negocios y técnicas panaderas.',
          },
          {
            image: cerezas,
            title: 'Etapa 2: Mentorías Personalizadas',
            description: '4 semanas de sesiones uno a uno para trabajar en tu modelo de negocio.',
          },
          {
            image: hongos,
            title: 'Etapa 3: Pitch Day',
            description: '1 día de presentación de tu pitch ante un panel de expertos.',
          },
        ],
      },
      testimonials: { title: 'Testimoniales', items: testimonials },
      community,
      seo: {
        title: 'Ideas | Amasando Tu Negocio',
        description:
          'Programa gratuito y 100% en línea para emprendedores en panadería: convierte tu idea en un negocio con guía de expertos en 3 meses.',
      },
    },
  })

  const legal = (title: string, body: string) => ({
    title,
    content: {
      root: {
        type: 'root',
        format: '' as const,
        indent: 0,
        version: 1,
        direction: 'ltr' as const,
        children: [
          {
            type: 'paragraph',
            format: '' as const,
            indent: 0,
            version: 1,
            direction: 'ltr' as const,
            textFormat: 0,
            children: [{ type: 'text', text: body, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }],
          },
        ],
      },
    },
  })
  await payload.create({
    collection: 'paginas',
    data: {
      ...legal('Aviso de Privacidad', 'Edita este texto desde el administrador (Páginas de texto → Aviso de Privacidad).'),
      slug: 'aviso-de-privacidad',
    },
  })
  await payload.create({
    collection: 'paginas',
    data: {
      ...legal(
        'Quejas y Sugerencias',
        'Edita este texto desde el administrador (Páginas de texto → Quejas y Sugerencias).',
      ),
      slug: 'quejas-y-sugerencias',
    },
  })
}
