<?php
/**
 * Definición de los formularios del administrador.
 * Tipos: text, textarea, richtext, url, image, file, select, checkbox, number, group, repeater, tabs.
 */

function f_text(string $name, string $label, array $o = []): array { return ['type' => 'text', 'name' => $name, 'label' => $label] + $o; }
function f_area(string $name, string $label, array $o = []): array { return ['type' => 'textarea', 'name' => $name, 'label' => $label] + $o; }
function f_img(string $name, string $label, array $o = []): array { return ['type' => 'image', 'name' => $name, 'label' => $label] + $o; }
function f_group(string $name, string $label, array $fields, array $o = []): array { return ['type' => 'group', 'name' => $name, 'label' => $label, 'fields' => $fields] + $o; }
function f_rep(string $name, string $label, string $singular, array $fields, array $o = []): array { return ['type' => 'repeater', 'name' => $name, 'label' => $label, 'singular' => $singular, 'fields' => $fields] + $o; }
function f_link(string $name, string $label): array
{
    return f_group($name, $label, [
        f_text('label', 'Texto del botón', ['half' => true]),
        f_text('url', 'Enlace', ['half' => true, 'help' => 'Ruta interna (/ideas), ancla (#convocatoria) o enlace externo (https://…).']),
    ], ['compact' => true]);
}
function f_icon(): array { return ['type' => 'select', 'name' => 'icon', 'label' => 'Ícono', 'options' => icon_options(), 'third' => true]; }

function f_seo(): array
{
    return f_group('seo', 'SEO de esta página', [
        f_text('title', 'Título para Google', ['max' => 70, 'help' => 'Recomendado: 50–60 caracteres. Si lo dejas vacío se usa el general.']),
        f_area('description', 'Meta descripción', ['max' => 200, 'rows' => 3, 'help' => 'Recomendado: 140–160 caracteres.']),
        f_img('image', 'Imagen para compartir en redes', ['help' => 'Ideal 1200 × 630 px. Se recorta automáticamente.']),
        ['type' => 'checkbox', 'name' => 'noIndex', 'label' => 'Ocultar esta página de Google (noindex)'],
    ]);
}

function f_icon_items(string $name, string $label, int $max = 8): array
{
    return f_rep($name, $label, 'elemento', [
        f_icon(),
        f_text('title', 'Título', ['twothirds' => true]),
        f_area('description', 'Descripción', ['rows' => 3]),
    ], ['max' => $max]);
}

function f_map(): array
{
    return f_group('map', 'Encuentra tu panadería (mapa)', [
        ['type' => 'checkbox', 'name' => 'enabled', 'label' => 'Mostrar esta sección'],
        f_text('title', 'Título'),
        f_area('description', 'Descripción', ['rows' => 4]),
        f_img('image', 'Imagen del mapa'),
        f_text('embedUrl', 'Mapa interactivo (opcional)', ['help' => 'URL de Google My Maps → "Insertar en mi sitio" (https://www.google.com/maps/d/embed?...). Si la pones, se muestra el mapa en lugar de la imagen.']),
        f_link('primaryButton', 'Botón principal'),
        f_link('secondaryButton', 'Botón secundario'),
    ]);
}

function f_testimonials(): array
{
    return f_group('testimonials', 'Testimonios', [
        f_text('title', 'Título de la sección'),
        f_rep('items', 'Testimonios', 'testimonio', [
            f_area('quote', 'Testimonio', ['rows' => 3]),
            f_text('name', 'Nombre', ['half' => true]),
            f_text('detail', 'Descripción / año', ['half' => true]),
            f_img('avatar', 'Foto'),
        ], ['max' => 12]),
    ]);
}

function f_recetario(): array
{
    return f_group('recetario', 'Recetario', [
        ['type' => 'checkbox', 'name' => 'enabled', 'label' => 'Mostrar esta sección'],
        f_text('title', 'Título'),
        f_rep('items', 'Recetarios', 'recetario', [
            f_img('image', 'Portada'),
            f_text('title', 'Título', ['half' => true]),
            f_text('subtitle', 'Subtítulo (opcional)', ['half' => true]),
            ['type' => 'file', 'name' => 'file', 'label' => 'PDF para descargar'],
            f_text('downloadLabel', 'Texto del enlace de descarga', ['placeholder' => 'Descargar']),
        ]),
    ]);
}

function schema_for(string $type): array
{
    switch ($type) {
        case 'home':
            return ['tabs' => [
                'Portada' => [f_group('hero', '', [
                    f_img('logo', 'Logo grande (opcional)', ['help' => 'Si no subes logo se muestra el título en texto.']),
                    f_text('title', 'Título (si no hay logo)'),
                    f_rep('slides', 'Carrusel de fotos (máximo 4)', 'foto', [f_img('image', 'Foto')], ['max' => 4]),
                ])],
                '¿Qué es?' => [f_group('about', '', [
                    f_text('title', 'Título'),
                    f_area('body', 'Texto', ['rows' => 8, 'help' => 'Deja una línea en blanco para separar párrafos.']),
                    f_img('image', 'Foto de sesiones'),
                ])],
                'Impacto' => [f_group('impact', '', [f_text('title', 'Título'), f_icon_items('items', 'Cifras')])],
                'Mapa' => [f_map()],
                'Programas' => [f_rep('programs', 'Tarjetas de programas', 'programa', [
                    f_img('image', 'Foto'),
                    f_text('question', 'Pregunta'),
                    f_link('cta', 'Botón'),
                ], ['max' => 4])],
                'Recetario' => [f_recetario(), f_link('communityCta', 'Botón final: Conoce la comunidad')],
                'SEO' => [f_seo()],
            ]];
        case 'comunidad':
            return ['tabs' => [
                'Portada' => [f_group('hero', '', [
                    f_text('eyebrow', 'Primera línea del título'),
                    f_img('logo', 'Logo (opcional)'),
                    f_text('title', 'Título (si no hay logo)'),
                    f_text('videoUrl', 'Video más reciente (URL de YouTube o Vimeo)'),
                    ['type' => 'file', 'name' => 'videoFile', 'label' => 'O sube un video MP4'],
                    f_img('poster', 'Imagen de portada del video'),
                ])],
                'Mapa' => [f_map()],
                'Testimonios' => [f_testimonials()],
                'Recetario' => [f_recetario()],
                'SEO' => [f_seo()],
            ]];
        case 'programa':
            return ['tabs' => [
                'General' => [
                    f_text('name', 'Nombre del programa', ['required' => true, 'half' => true]),
                    ['type' => 'number', 'name' => 'order', 'label' => 'Orden', 'third' => true],
                ],
                'Portada' => [f_group('hero', '', [
                    f_img('background', 'Imagen de fondo'),
                    f_img('logo', 'Logo (opcional)', ['help' => 'Si no subes logo se muestra el título en texto.']),
                    f_text('title', 'Título (si no hay logo)', ['half' => true]),
                    f_text('subtitle', 'Subtítulo', ['half' => true]),
                    f_link('cta', 'Botón'),
                ])],
                'Introducción' => [f_group('intro', '', [
                    f_text('title', 'Título'),
                    f_area('body', 'Texto', ['rows' => 8, 'help' => 'Deja una línea en blanco para separar párrafos.']),
                    f_img('image', 'Foto'),
                ])],
                'Beneficios' => [f_group('benefits', '', [f_text('title', 'Título'), f_icon_items('items', 'Beneficios')])],
                'Convocatoria' => [f_group('call', '', [
                    f_text('title', 'Título'),
                    f_rep('images', 'Fotos', 'foto', [f_img('image', 'Foto')], ['max' => 2]),
                    f_link('cta', 'Botón'),
                    f_text('eligibilityTitle', 'Título: ¿Quién puede aplicar?'),
                    f_rep('eligibility', 'Requisitos', 'requisito', [f_text('text', 'Requisito')]),
                ])],
                'Proceso y etapas' => [
                    f_group('process', 'Proceso de aplicación', [f_text('title', 'Título'), f_icon_items('steps', 'Pasos')]),
                    f_group('stages', 'Etapas del programa', [
                        f_text('title', 'Título'),
                        f_rep('items', 'Etapas', 'etapa', [
                            f_img('image', 'Foto'),
                            f_text('title', 'Título'),
                            f_area('description', 'Descripción', ['rows' => 3]),
                        ]),
                    ]),
                ],
                'Testimonios y comunidad' => [
                    f_testimonials(),
                    f_group('community', 'Conoce la comunidad', [
                        f_text('title', 'Título'),
                        f_img('image', 'Foto'),
                        f_link('cta', 'Botón'),
                    ]),
                ],
                'SEO' => [f_seo()],
            ]];
        case 'pagina':
            return ['tabs' => [
                'Contenido' => [
                    f_text('title', 'Título', ['required' => true]),
                    ['type' => 'richtext', 'name' => 'content', 'label' => 'Contenido'],
                ],
                'SEO' => [f_seo()],
            ]];
        case 'settings':
            $row2 = fn(string $a, string $al, string $b, string $bl) => [f_text($a, $al, ['half' => true]), f_text($b, $bl, ['half' => true])];
            return ['tabs' => [
                'General' => [
                    f_text('siteName', 'Nombre del sitio', ['required' => true]),
                    f_img('logo', 'Logo (para fondo blanco)', ['half' => true]),
                    f_img('logoLight', 'Logo blanco (sobre fotos)', ['half' => true]),
                    f_rep('nav', 'Menú principal', 'enlace', $row2('label', 'Texto', 'url', 'Enlace')),
                ],
                'Aliados' => [f_rep('allies', 'Aliados (Un programa de / En colaboración con / Implementado por)', 'aliado', [
                    f_text('heading', 'Encabezado', ['half' => true]),
                    f_text('name', 'Nombre del aliado', ['half' => true]),
                    f_img('logo', 'Logo', ['half' => true]),
                    f_img('background', 'Foto de fondo', ['half' => true]),
                    f_text('url', 'Sitio web del aliado (opcional)'),
                ], ['max' => 6, 'help' => 'Aparece en Inicio, Comunidad y en cada programa.'])],
                'Pie y contacto' => [
                    f_group('whatsapp', 'Botón flotante de WhatsApp', [
                        f_text('number', 'Número con lada (ej. 5215512345678)', ['half' => true]),
                        f_text('message', 'Mensaje inicial', ['half' => true]),
                    ]),
                    f_rep('footerLinks', 'Enlaces legales', 'enlace', $row2('label', 'Texto', 'url', 'Enlace')),
                    f_rep('footerLogos', 'Logos de entidades', 'logo', [
                        f_text('name', 'Nombre', ['half' => true]),
                        f_text('url', 'Enlace (opcional)', ['half' => true]),
                        f_img('logo', 'Logo'),
                    ], ['max' => 8]),
                    f_text('contactTitle', 'Título de contacto'),
                    f_rep('contactLinks', 'Datos de contacto', 'dato', $row2('label', 'Texto', 'url', 'Enlace (https://, mailto:, tel:)')),
                    f_group('social', 'Redes sociales', [
                        f_text('facebook', 'Facebook', ['third' => true]),
                        f_text('linkedin', 'LinkedIn', ['third' => true]),
                        f_text('instagram', 'Instagram', ['third' => true]),
                    ]),
                ],
                'SEO general' => [
                    f_text('siteUrl', 'URL pública del sitio', ['help' => 'Ej: https://amasandotunegocio.mx — se usa en el sitemap, canonical y redes. Si la dejas vacía se detecta sola.']),
                    f_text('defaultTitle', 'Título por defecto'),
                    f_area('defaultDescription', 'Descripción por defecto', ['rows' => 3]),
                    f_img('defaultImage', 'Imagen para compartir por defecto'),
                    f_text('googleVerification', 'Código de verificación de Google Search Console', ['help' => 'Solo el valor de content="..."']),
                    f_text('gaId', 'ID de Google Analytics 4', ['placeholder' => 'G-XXXXXXXXXX']),
                ],
            ]];
    }
    return ['tabs' => []];
}
