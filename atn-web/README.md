# Amasando Tu Negocio — sitio web + administrador

Sitio construido a partir del Figma **ATN Web**. Tiene 4 páginas (Inicio, Comunidad, Fortalecimiento e Ideas) más páginas legales, y un administrador para que el cliente edite todo el contenido sin tocar código.

- **Next.js 16** (App Router, React Server Components, páginas estáticas con revalidación al guardar)
- **Payload CMS 3** como administrador, integrado en el mismo proyecto, en `/admin`
- **SQLite** como base de datos, en un solo archivo (`atn.db`)
- Tipografía **Inter**, con medidas, colores y espaciados tomados del Figma (frame de 1440 px), y diseño adaptable a tablet y móvil

## Arranque local

```bash
cp .env.example .env      # edita PAYLOAD_SECRET
npm install
npm run dev
```

`npm run dev` aplica las migraciones, carga el contenido inicial del Figma (solo si la base está vacía) y levanta el sitio en http://localhost:3000.

La primera vez que entres a **http://localhost:3000/admin**, Payload te pide crear el usuario administrador.

## Qué se edita desde el administrador

| Sección del admin | Contenido |
| --- | --- |
| **Páginas → Inicio** | Logo o título, carrusel (máx. 4 fotos), "¿Qué es?", Impacto (íconos), mapa, tarjetas de programas, recetario, botón de comunidad y SEO |
| **Páginas → Comunidad** | Título, video más reciente (YouTube, Vimeo o MP4), mapa, testimonios, recetario y SEO |
| **Páginas → Programas** | Una ficha por programa (Fortalecimiento, Ideas o nuevos): portada, introducción, beneficios, convocatoria, requisitos, proceso, etapas, testimonios, bloque de comunidad y SEO. Cada programa genera su URL (`/fortalecimiento`) |
| **Páginas → Páginas de texto** | Aviso de privacidad, Quejas y sugerencias y cualquier otra página de texto |
| **Contenido → Imágenes y archivos** | Fotos, logos y PDFs (por ejemplo, los recetarios para descargar). Las imágenes se convierten a WebP y se generan varios tamaños automáticamente |
| **Configuración → Configuración del sitio** | Nombre, logos, menú, aliados ("Un programa de / En colaboración con / Implementado por"), WhatsApp, enlaces del pie, logos de entidades, contacto, redes sociales y SEO general (URL del sitio, Google Search Console, Google Analytics) |

Cada página tiene **vista previa en vivo** (móvil, tablet y escritorio) mientras se edita.

Algunos elementos solo aparecen cuando tienen datos:
- Botón flotante de WhatsApp: cuando se captura el número.
- Íconos de redes sociales: cuando se capturan sus URLs.
- "Logos 4 entidades" en el pie: cuando se suben los logos.
- Enlace "Descargar" del recetario: cuando se sube el PDF.

## SEO incluido

- HTML renderizado en el servidor, con `lang="es-MX"` y un `<h1>` por página con la jerarquía de encabezados correcta.
- Título, meta descripción, canonical, Open Graph y Twitter Cards por página, editables desde el admin. Si se dejan vacíos, se usan los valores generales.
- Imagen para compartir de 1200×630 generada automáticamente.
- Datos estructurados JSON-LD: `Organization` y `WebSite` en todo el sitio, y `Course` en cada programa.
- `sitemap.xml` y `robots.txt` dinámicos (el admin y la API quedan fuera de los buscadores).
- Opción "noindex" por página.
- Imágenes optimizadas (`next/image`, WebP, `srcset`), texto alternativo obligatorio y fuentes autoalojadas sin cambios de diseño al cargar.
- Verificación de Google Search Console y Google Analytics 4 configurables desde el admin.

## Producción

```bash
npm run build   # migraciones + contenido inicial + compilación
npm start
```

Variables necesarias: `PAYLOAD_SECRET`, `DATABASE_URL` y `NEXT_PUBLIC_SERVER_URL` con el dominio real. También hay que capturar **SEO general → URL pública del sitio** en el admin.

Hosting recomendado: un servidor con disco persistente (VPS, Railway, Render, Fly.io…), donde se conservan `atn.db` y la carpeta `media/`. Para Vercel u otro serverless:
- Cambia `DATABASE_URL` a una base Turso/libSQL (`libsql://…` + `DATABASE_AUTH_TOKEN`).
- Agrega un adaptador de almacenamiento para las imágenes (`@payloadcms/storage-vercel-blob` o S3).

Si cambias campos del admin en el código, genera una migración con:

```bash
npx payload migrate:create nombre-del-cambio
```
