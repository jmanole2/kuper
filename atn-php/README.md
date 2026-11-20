# Amasando Tu Negocio — sitio web en PHP

Sitio programado a partir del Figma **ATN Web**:
- Las 4 páginas del diseño: Inicio, Comunidad, Fortalecimiento e Ideas.
- Páginas de texto (Aviso de Privacidad, Quejas y Sugerencias).
- Un **administrador** para editar todo sin tocar código.

- **PHP 8 puro**, sin Composer ni instalaciones.
- **SQLite**: la base de datos es un archivo (`data/atn.sqlite`) que se crea solo. No tienes que crear nada en el panel de DreamHost.
- Responsivo (escritorio, tablet y móvil) y con SEO completo.

---

## Subirlo a DreamHost por SFTP

1. En el panel de DreamHost, el dominio debe estar en **hosting completo con PHP 8.1 o superior**.
   - Ve a *Websites → Manage Websites → (tu dominio) → Settings → PHP*.
2. Conéctate por SFTP (FileZilla, Cyberduck…) con tu usuario de DreamHost.
3. Sube **todo el contenido** de esta carpeta (`atn-php/`) a la carpeta del dominio, por ejemplo `/home/tu-usuario/amasandotunegocio.mx/`.
   - Incluye los archivos ocultos `.htaccess`. En FileZilla: *Servidor → Forzar mostrar archivos ocultos*.
4. Abre `https://tu-dominio/` en el navegador. La primera visita tarda unos segundos porque crea la base de datos y carga el contenido del diseño.
5. Entra a `https://tu-dominio/admin/` y crea tu usuario administrador. El primero que entre lo crea, así que hazlo en cuanto subas el sitio.
6. En el admin, ve a **Configuración del sitio → SEO general** y escribe la URL pública (`https://tu-dominio`).
7. Cuando tengas el certificado SSL (Let's Encrypt gratis en DreamHost), activa HTTPS: quita los dos `#` de las líneas "Forzar HTTPS" en `.htaccess`.

Permisos: las carpetas `data/` y `uploads/` deben poder escribirse. En DreamHost ya funciona así; si no, ponles permiso **755**.

### Actualizar el sitio después
Sube solo los archivos que cambien. **Nunca sobrescribas ni borres** estas dos carpetas del servidor:
- `data/`: la base de datos con todo lo que se editó en el admin.
- `uploads/`: las imágenes subidas.

### Respaldos
Descarga por SFTP las carpetas `data/` y `uploads/`. Con eso tienes todo el contenido.

---

## Qué se edita en el administrador (`/admin`)

| Sección | Contenido |
| --- | --- |
| **Inicio** | Logo o título, carrusel (máx. 4 fotos), ¿Qué es?, Impacto con íconos, mapa, tarjetas de programas, recetario, botón de comunidad, SEO |
| **Comunidad** | Título, video (YouTube, Vimeo o MP4), mapa, testimonios, recetario, SEO |
| **Programas** | Fortalecimiento, Ideas y los que agregues: portada, introducción, beneficios, convocatoria, requisitos, proceso, etapas, testimonios, comunidad, SEO y URL |
| **Páginas de texto** | Aviso de privacidad, Quejas y sugerencias u otras, con editor de texto |
| **Imágenes y archivos** | Biblioteca de fotos, logos y PDFs (con texto alternativo para SEO) |
| **Configuración del sitio** | Nombre, logos, menú, aliados, WhatsApp, enlaces y logos del pie, contacto, redes, SEO general, Google Search Console y Google Analytics |
| **Usuarios** | Agregar administradores y cambiar contraseña |

Cómo funcionan las imágenes:
- Al subir una foto, se optimiza sola: se reduce, se convierte a WebP y se crean varios tamaños para celular y escritorio.
- También se genera la imagen de 1200×630 para compartir en redes.

Algunos elementos aparecen solo cuando tienen datos:
- Botón flotante de WhatsApp: al capturar el número.
- Íconos de redes sociales: al capturar sus URLs.
- Logos de entidades en el pie: al subirlos.
- Enlace "Descargar" del recetario: al subir el PDF.

## SEO incluido
- URLs limpias (`/fortalecimiento`, `/ideas`).
- Título, meta descripción, canonical, Open Graph y Twitter Cards por página, editables desde el admin.
- Datos estructurados (JSON-LD): `Organization`, `WebSite` y `Course` en cada programa.
- `sitemap.xml` y `robots.txt` automáticos. Da de alta el sitemap en Google Search Console: `https://tu-dominio/sitemap.xml`.
- Opción "noindex" por página.
- HTML semántico: un solo `<h1>` por página, `lang="es-MX"` y textos alternativos.
- Imágenes con `srcset`, WebP y carga diferida.
- Fuente Inter alojada en el mismo sitio.
- Compresión y caché del navegador en `.htaccess`.

## Probar en tu computadora (opcional)
```bash
php -S localhost:8000 dev-server.php
```
Abre http://localhost:8000. `dev-server.php` solo funciona con ese comando; en DreamHost está bloqueado.

## Estructura
```
index.php            Rutas del sitio público
config.php           Ajustes (ruta de la base de datos, límite de subida)
.htaccess            URLs limpias, seguridad, caché
admin/               Administrador
assets/              CSS, JS, fuente, favicon
includes/            Lógica (BD, imágenes, SEO, esquemas del admin, contenido inicial)
templates/           Plantillas HTML de cada página
data/                Base de datos (protegida, se crea sola)
uploads/             Imágenes subidas (se crea sola)
```
