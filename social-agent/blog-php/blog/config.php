<?php
// Configuración del blog. Solo cambia estas líneas.
$PANEL_URL    = 'https://redes.kuper.media';  // el panel de Kuper (no cambia)
$SITIO        = 'mi-sitio';                    // el identificador del sitio que ves en el panel (pestaña Blog)
$NOMBRE_SITIO = 'Mi sitio';                    // aparece en el encabezado y en Google
$BLOG_RUTA    = '/blog';                       // en qué carpeta de tu sitio está el blog
$TITULO_BLOG  = 'Blog';                        // título de la página principal del blog
$DESCRIPCION_BLOG = 'Noticias, guías y consejos.';
$POR_PAGINA   = 9;                             // artículos por página
$CACHE_MIN    = 10;                            // cada cuántos minutos pide lo nuevo al panel
$URLS_BONITAS = true;                          // true: /blog/mi-articulo (necesita el .htaccess). false: /blog/articulo.php?slug=mi-articulo

// Tu encabezado y pie (opcional). Si los pones, el blog usa los de tu sitio en lugar de los suyos.
// Ej.: $ENCABEZADO = __DIR__ . '/../inc/header.php';   $PIE = __DIR__ . '/../inc/footer.php';
// Dentro del <head> de tu encabezado agrega esta línea de PHP:  if (function_exists('blog_meta')) blog_meta();
// (pone el título, la descripción y los datos para Google de cada página del blog)
$ENCABEZADO = '';
$PIE        = '';
