# Auditoría SEO: carteleras.com

**Fecha:** 13 oct 2026
**Tipo de negocio:** medio de publicidad exterior (OOH), B2B, con inventario de sitios físicos en todo México.
**Páginas analizadas:** las 9 del sitemap.

**Datos usados:**
- HTML, robots, sitemap y encabezados descargados del sitio.
- Pesos medidos de cada recurso.
- Un SERP en vivo para "renta de espectaculares cdmx".
- No hubo datos de volumen de búsqueda ni de backlinks: la herramienta no tiene créditos.

## Puntuación de salud SEO: 42 / 100

| Categoría | Peso | Puntos | Comentario |
|---|---|---|---|
| SEO técnico | 22 % | 65 | HTTPS, redirecciones y gzip están bien. GTM tiene un ID de ejemplo, faltan favicon y HSTS, y 4 imágenes dan 404. |
| Calidad de contenido | 23 % | 45 | Páginas delgadas, `/ubicaciones` tiene 63 palabras y no hay página "Nosotros" ni casos con datos. |
| SEO on-page | 20 % | 50 | Títulos sin palabras clave, H1 de eslogan, sin Open Graph. |
| Datos estructurados | 10 % | 0 | Ningún JSON-LD en todo el sitio. |
| Rendimiento (CWV) | 10 % | 20 | La portada descarga alrededor de 36 MB. |
| Preparación para IA | 10 % | 35 | Sin llms.txt, y el inventario vive solo dentro de un archivo JS. |
| Imágenes | 5 % | 30 | Los alt están bien, pero hay PNG de 1 a 6 MB. |

---

## Lo más importante en una frase
Carteleras.com tiene **3,219 sitios en 341 ciudades**, pero esa información solo existe dentro de un archivo JavaScript de 1 MB (`assets/data/ubicaciones-data.js`). Para Google, `/ubicaciones` es una página de 63 palabras sin H1.

Al mismo tiempo, quienes ganan búsquedas como "renta de espectaculares cdmx" son competidores con **una página por ciudad o por sitio**:
- naranti.com tiene 3 de los 10 primeros resultados con páginas tipo `/espectaculares-en-ixtapaluca`.
- Aparecen también publisitios.com, publicate.mx y publicidadespectacular.mx.

Carteleras.com no aparece.

---

## Crítico

### 1. Google Tag Manager con ID de ejemplo (`GTM-XXXXXXX`)
- Está en las 9 páginas.
- **No se está midiendo nada:** ni visitas, ni envíos del formulario, ni clics a WhatsApp. Eso pasa aunque `main.js` sí envía eventos al `dataLayer`.
- **Arreglo:** poner el ID real del contenedor GTM en el `<head>` y en el `<noscript>` de cada página.
- **Cómo saber que quedó:** en GTM, "Vista previa" debe detectar el sitio, y GA4 en "Tiempo real" debe mostrar la visita.

### 2. La portada pesa alrededor de 36 MB
| Recurso | Peso |
|---|---|
| `Home/VideoHero.mp4` (autoplay, sin `poster` ni `preload`) | 13.6 MB |
| Imágenes que cargan al abrir (sin `loading="lazy"`) | 12.4 MB |
| Imágenes del bento de proyectos (lazy, pero de 1 a 6 MB cada una) | 9.8 MB |

Las más pesadas:

| Imagen | Peso | Formato |
|---|---|---|
| `Mercado_Libre.png` | 6.0 MB | PNG |
| `landmark-santafe2.jpg` | 5.0 MB | JPG |
| `landmark-1.png` | 1.7 MB | PNG |
| `muro-1.png` | 1.6 MB | PNG |
| `espectacular-1.png` | 1.4 MB | PNG |
| `Nave_Espacial.png` | 1.3 MB | PNG |

En celular con 4G eso significa un LCP de muchos segundos y un costo real de datos para el visitante.

**Arreglo:**
- Video: recomprimirlo a menos de 3 MB (720p, H.264 o AV1, unos 15 s), agregar `poster` y `preload="none"`, y no cargarlo en celular.
- Imágenes: pasarlas a WebP a 1600 px como máximo (cada una debería quedar en menos de 200 KB) y agregar `loading="lazy"` a todo lo que está debajo del primer pantallazo.

**Cómo saber que quedó:** PageSpeed móvil debe mostrar un peso total menor a 3 MB.

### 3. El inventario de 3,219 sitios es invisible para Google
- `/ubicaciones` carga el mapa (Leaflet) y los datos con JavaScript. El HTML no tiene ni un nombre de calle ni de ciudad.
- Ninguna ciudad tiene su propia URL.

| Tipo de sitio | Cantidad |
|---|---|
| Espectaculares | 2,870 |
| Pantallas digitales | 232 |
| Muros | 109 |
| Landmarks | 8 |

43 ciudades tienen 20 sitios o más. Las principales:

| Ciudad | Sitios |
|---|---|
| CDMX | 257 |
| Puebla | 111 |
| Tijuana | 100 |
| Querétaro | 99 |
| Monterrey | 97 |
| Guadalajara | 87 |
| Zapopan | 77 |
| Mérida | 74 |

**Arreglo:** ver el punto 1 del plan de acción, sobre páginas por ciudad y por tipo.

---

## Alto

### 4. Sin datos estructurados
No hay `Organization`, `WebSite`, `Service` ni `BreadcrumbList`.

**Agregar:**
- En la portada: `Organization` con logo, teléfono, correo y dirección de Tlalpan.
- En `/medios` y en las páginas de ciudad: `Service` (tipo de servicio "Publicidad exterior", área servida México o la ciudad).
- En las páginas internas: `BreadcrumbList`.

### 5. Títulos y H1 sin las palabras que la gente busca

| Página | Título actual | Propuesta |
|---|---|---|
| `/` | Carteleras.com — Publicidad Exterior en México | Publicidad exterior en México: espectaculares y pantallas · Carteleras.com |
| `/medios` | Medios · Carteleras.com | Espectaculares, pantallas digitales, muros y vallas en México · Carteleras.com |
| `/ubicaciones` | Ubicaciones · Carteleras.com | Mapa de espectaculares y pantallas en México (3,200+ sitios) · Carteleras.com |
| `/centro-impresion` | Centro de Impresión · Carteleras.com | Impresión de lonas para espectaculares · Carteleras.com |
| `/proyectos-especiales` | Proyectos Especiales · Carteleras.com | Proyectos especiales y activaciones OOH en México · Carteleras.com |

Cambios en los H1:
- Portada: hoy es "30+ AÑOS EN LAS CALLES". Puede seguir viéndose igual, pero el texto real del H1 debería incluir "publicidad exterior en México". Por ejemplo, un `<span>` visualmente oculto o una línea pequeña dentro del mismo H1.
- `/ubicaciones` no tiene H1. Debería ser "Ubicaciones de espectaculares y pantallas en México".

### 6. `/medios` junta 7 productos en una sola URL con anclas (`#espectaculares`, `#pantallas`…)
Google no posiciona anclas. "Renta de espectaculares", "pantallas digitales publicidad" y "publicidad en camiones" son búsquedas distintas, y cada una necesita su propia página con:
- precio orientativo o desde cuánto cuesta;
- medidas;
- ciudades disponibles;
- fotos y formulario.

### 7. Contenido delgado y poca autoridad (E-E-A-T)
- **Sin página "Nosotros":** el sitio dice "30+ años" y "empresa líder", pero no hay historia, equipo, razón social ni certificaciones.
- **Casos sin datos:** los proyectos especiales son fotos con nombre de marca, sin reto, ejecución, ciudad ni resultados.
- **Redes sociales:** los enlaces de LinkedIn, Instagram, Facebook y X están vacíos en `main.js`, así que se ocultan. Llenarlos también sirve para `sameAs` en el schema.

### 8. Cuatro imágenes de la portada dan 404
- `proyectos-home/nave-espacial.jpg`, `mercado-libre.jpg`, `corona.png` y `starbucks.png` no existen.
- El `onerror` carga entonces los PNG originales, que son de 1 a 6 MB. Es una petición fallida más una imagen enorme.
- **Arreglo:** subir las versiones optimizadas a `proyectos-home/` o apuntar directo a WebP ligeros.

---

## Medio
- **Open Graph y Twitter Card:** faltan en las 9 páginas. Al compartir el sitio en WhatsApp o LinkedIn no sale imagen ni descripción.
- **Favicon:** `/favicon.ico` da 404 y no hay `<link rel="icon">`.
- **Idioma:** `lang="es"` → `lang="es-MX"`.
- **HSTS:** falta `Strict-Transport-Security`. Ya tienen `nosniff`, `X-Frame-Options` y `Referrer-Policy`.
- **Rutas relativas:** `assets/css/styles.css` e `img src="assets/..."` funcionan hoy porque todas las páginas están en la raíz. En cuanto existan URLs como `/espectaculares/monterrey`, se rompen. Hay que cambiarlas a `/assets/...`.
- **Formulario de contacto:**
  - Está bien hecho: tiene `label`, honeypot y validación.
  - Conviene agregar "Ciudad de interés" y "Tipo de medio", porque califican mejor el lead y además sirven para medir demanda por ciudad.
- **Menú:** dice "Home" en un sitio en español. Mejor "Inicio".
- **Cifras distintas:** la portada dice "1000+ marcas" y el H2 dice "MILES DE MARCAS". Conviene usar una sola cifra.

## Bajo
- **llms.txt:** no existe. Es opcional, pero ayuda a los asistentes de IA a entender el catálogo; Google no lo usa.
- **`lastmod` del sitemap:** todas las URLs tienen la misma fecha. Debe reflejar cambios reales.
- **Carrusel de logos:** la segunda copia ya está bien marcada con `aria-hidden`. Sin cambios.

---

## Lo que ya está bien
- `http` y `www` redirigen con 301 a `https://carteleras.com/`, y las URLs `.html` redirigen a la versión limpia.
- `robots.txt` está abierto y apunta al sitemap.
- La canonical está en cada página.
- gzip está activo; las imágenes tienen caché de 1 año y el CSS de 1 semana.
- Todos los `<img>` tienen `alt`, y no hay contenido oculto ni pop-ups intrusivos.
- WhatsApp flotante y teléfono en el footer, con enlaces clicables.
