# Plan de acción: carteleras.com

Ordenado por impacto y por dependencias: lo de arriba desbloquea lo de abajo.

## Semana 1: arreglos rápidos (sin diseño nuevo)
1. **ID real de GTM** en las 9 páginas.
   - Sin esto no se puede medir nada de lo que sigue.
   - Verificar con la vista previa de GTM.
   - En GA4, marcar como eventos clave el envío del formulario y el clic a WhatsApp.
2. **Peso de la portada:**
   - Video a menos de 3 MB, con `poster` y `preload="none"`.
   - Las 16 imágenes a WebP.
   - `loading="lazy"` en todo lo que está debajo del hero.
   - Subir las 4 imágenes que dan 404.
   - Meta: menos de 3 MB en total y LCP móvil menor a 2.5 s.
3. **Títulos y H1** de la tabla del punto 5 del reporte, y H1 en `/ubicaciones`.
4. **Schema `Organization` y `WebSite`** en la portada, `BreadcrumbList` en las internas.
5. **Open Graph, favicon, `lang="es-MX"`, HSTS** y rutas `/assets/...` absolutas.

## Semanas 2 a 6: páginas que pueden posicionar (lo que más mueve tráfico)
1. **Una página por tipo de medio**, que reemplaza las anclas de `/medios`:
   - `/espectaculares`, `/pantallas-digitales`, `/muros`, `/vallas-landmarks`, `/publicidad-en-camiones`, `/pantalla-wtc`.
   - Cada una con medidas, ciudades, fotos, preguntas reales de clientes y formulario.
2. **Páginas de ciudad generadas desde `ubicaciones-data.js`**:
   - Empezar con unas **15 ciudades**, las de más inventario: CDMX, Puebla, Tijuana, Querétaro, Monterrey, Guadalajara, Zapopan, Mérida, Aguascalientes, Torreón, Veracruz, Saltillo y las que más pidan sus vendedores.
   - Ejemplo de URL: `/espectaculares/monterrey`.
   - El contenido debe estar **en el HTML** (generado del lado del servidor), no con JavaScript:
     - número de sitios por tipo;
     - lista de ubicaciones con dirección, medidas e iluminación;
     - mini mapa;
     - qué avenidas cubren;
     - un texto propio de la ciudad.
   - **Regla de calidad:** con más de 30 páginas de ubicación, cada una necesita al menos 60 % de contenido único. La lista real de sitios ya lo da, pero no se deben copiar los mismos párrafos cambiando solo el nombre de la ciudad.
   - Llegar a las 43 ciudades con 20 sitios o más solo si las primeras 15 se indexan y reciben impresiones en Search Console.
   - Las ciudades con menos sitios se quedan dentro de la página de su estado.
3. **Fotos de los sitios:** hoy `foto` está vacío en los 3,219 registros. Aunque sea una foto de los sitios principales por ciudad, mejora mucho la conversión y el SEO de imágenes.
4. **Página "Nosotros"** con historia, equipo, cifras verificables y razón social. **Casos de éxito** con reto, medio, ciudad y resultado.

## Mes 2 en adelante
- **Search Console:** enviar el sitemap con las nuevas URLs y revisar impresiones por página de ciudad cada 2 semanas.
- **Fichas de sitio** (`/sitio/PMS6512`): solo para los de mayor valor, como landmarks, WTC y pantallas premium. No hacer las 3,219, porque serían páginas casi vacías.
- **Contenido de apoyo** para decisiones de compra, dentro de un blog o de las páginas de producto:
  - cuánto cuesta un espectacular por ciudad;
  - medidas estándar;
  - permisos;
  - impresión de lonas.

## Cómo saber si funcionó (indicadores)
| Señal | Dónde verla | Meta |
|---|---|---|
| Leads medidos | GA4, eventos clave | Que existan: hoy no se mide ninguno |
| Peso de la portada | PageSpeed | Menos de 3 MB |
| Páginas de ciudad indexadas | Search Console, Páginas | 15 de 15 en 4 semanas |
| Impresiones de "espectaculares + ciudad" | Search Console, Rendimiento | Crecimiento semana a semana |
| Presencia en el SERP de "renta de espectaculares cdmx" | Búsqueda manual | Entrar al top 10. Hoy no aparece |
