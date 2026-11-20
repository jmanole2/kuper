<?php
/**
 * Contenido inicial tomado del Figma "ATN Web". Solo se carga la primera vez
 * (cuando la base de datos está vacía). Después todo se edita desde /admin.
 */

function seed_content(): void
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        seed_run();
        $pdo->commit();
    } catch (Throwable $t) {
        $pdo->rollBack();
        throw $t;
    }
}

function seed_run(): void
{
    $m = function (string $name, string $alt): int {
        static $cache = [];
        return $cache[$name] ??= media_store(ROOT . "/includes/seed/{$name}.jpg", "{$name}.jpg", $alt, false);
    };

    $rabanos = $m('aliado-rabanos', 'Rábanos frescos sobre fondo blanco');
    $cerezas = $m('aliado-cerezas', 'Cerezas sobre fondo claro');
    $hongos = $m('aliado-hongos', 'Hongos sobre fondo claro');
    $mapa = $m('mapa', 'Mapa de panaderías Amasando Tu Negocio');
    $recetario = $m('recetario', 'Portada del recetario Amasando Recuerdos');
    $fondo = $m('programa-fondo', 'Peras frescas, fondo del programa');
    $intro = $m('programa-intro', 'Sesión del programa Amasando Tu Negocio');
    $conv1 = $m('convocatoria-1', 'Pan, fruta y vino sobre una mesa');
    $conv2 = $m('convocatoria-2', 'Canasta y fruta sobre mantel blanco');
    $fotoFort = $m('foto-fortalecimiento', 'Panadería tradicional mexicana');
    $sesiones = $m('foto-sesiones', 'Sesión de capacitación Amasando Tu Negocio');
    $carrusel = $m('carrusel-1', 'Amasando Tu Negocio, capacitación para panaderos');
    $av1 = $m('avatar-1', 'Foto de Rosa Isela');
    $av2 = $m('avatar-2', 'Foto de David');
    $av3 = $m('avatar-3', 'Foto de Jaime');

    $testimonials = [
        ['quote' => "“Me siento muy contenta y agradecida con amasando tu negocio.\nEste mes, al día de hoy, cerré ventas con \$16,400 ya de utilidad neta.”", 'name' => 'Rosa Isela', 'detail' => '2026', 'avatar' => $av1],
        ['quote' => '“¡Me encanta poder formar parte de una comunidad tan activa y abierta!”', 'name' => 'David', 'detail' => '2025', 'avatar' => $av2],
        ['quote' => '“Gracias a lo aprendido en el programa compre mi laminadora y hoy se paga practicamente sola.”', 'name' => 'Jaime', 'detail' => '2026', 'avatar' => $av3],
    ];
    $map = fn(string $title) => [
        'enabled' => true,
        'title' => $title,
        'description' => "Panaderías en sitio y Dark Bakeries que vale la pena probar en México!\nCada una de ellas paso por el programa de fortalecimiento e incubación \"Amasando Tu Negocio\".",
        'image' => $mapa,
        'embedUrl' => '',
        'primaryButton' => ['label' => 'Ver mapa', 'url' => '#mapa'],
        'secondaryButton' => ['label' => 'Conoce los programas', 'url' => '/fortalecimiento'],
    ];
    $recetarioItems = [
        ['image' => $recetario, 'title' => 'Recetario 2025', 'subtitle' => '', 'file' => null, 'downloadLabel' => 'Descargar'],
        ['image' => $recetario, 'title' => 'Recetario 2026', 'subtitle' => '', 'file' => null, 'downloadLabel' => 'Descargar'],
    ];

    doc_save('settings', 'settings', [
        'siteName' => 'Amasando Tu Negocio',
        'logo' => null,
        'logoLight' => null,
        'nav' => [
            ['label' => 'Comunidad', 'url' => '/comunidad'],
            ['label' => 'Fortalecimiento', 'url' => '/fortalecimiento'],
            ['label' => 'Ideas', 'url' => '/ideas'],
        ],
        'allies' => [
            ['heading' => 'Un programa de', 'name' => 'Lesaffre', 'logo' => null, 'background' => $rabanos, 'url' => ''],
            ['heading' => 'En colaboración con', 'name' => 'San Blas', 'logo' => null, 'background' => $cerezas, 'url' => ''],
            ['heading' => 'Implementado por', 'name' => 'New Ventures', 'logo' => null, 'background' => $hongos, 'url' => ''],
        ],
        'whatsapp' => ['number' => '', 'message' => 'Hola, quiero información sobre Amasando Tu Negocio'],
        'footerLinks' => [
            ['label' => 'Aviso de Privacidad', 'url' => '/aviso-de-privacidad'],
            ['label' => 'Quejas y Sugerencias', 'url' => '/quejas-y-sugerencias'],
        ],
        'footerLogos' => [],
        'contactTitle' => 'Contáctanos',
        'contactLinks' => [
            ['label' => 'Página', 'url' => '/'],
            ['label' => 'Mail', 'url' => 'mailto:contacto@amasandotunegocio.mx'],
        ],
        'social' => ['facebook' => '', 'linkedin' => '', 'instagram' => ''],
        'siteUrl' => '',
        'defaultTitle' => 'Amasando Tu Negocio | Capacitación gratuita para panaderos en México',
        'defaultDescription' => 'Amasando Tu Negocio es una iniciativa de capacitación gratuita para panaderos y panaderas en todo México, diseñada por expertos en panificación y negocios.',
        'defaultImage' => $carrusel,
        'googleVerification' => '',
        'gaId' => '',
    ]);

    doc_save('home', 'home', [
        'hero' => ['logo' => null, 'title' => 'Amasando Tu Negocio', 'slides' => [['image' => $carrusel], ['image' => $conv2], ['image' => $intro]]],
        'about' => [
            'title' => '¿Qué es Amasando Tu Negocio?',
            'body' => "Diseñado por expertos en panificación y negocios, Amasando Tu Negocio es una iniciativa de capacitación gratuita para panaderos y panaderas en TODO México.\n\nLa iniciativa que opera desde 2023 se desarrolla a través de dos programas estratégicos, diseñados para acompañar distintas etapas del negocio.",
            'image' => $sesiones,
        ],
        'impact' => [
            'title' => 'Impacto Amasando Tu Negocio',
            'items' => [
                ['icon' => 'users', 'title' => '+760 Panaderos/as', 'description' => 'Han cruzado por el programa.'],
                ['icon' => 'clock', 'title' => '+745 horas de capacitación', 'description' => "En temas de:\nAdministración y Finanzas\nMarketing y Ventas\nTécnicas panaderas\nResiliencia y Liderazgo\nModelo de Negocios"],
                ['icon' => 'pin', 'title' => 'Presencia en Toda la República Mexicana', 'description' => ''],
            ],
        ],
        'map' => $map('Encuentra tu panadería Amasando Tu Negocio'),
        'programs' => [
            ['image' => $conv1, 'question' => '¿Quieres inicar un negocio de pan?', 'cta' => ['label' => 'Conoce Amasando Ideas', 'url' => '/ideas']],
            ['image' => $fotoFort, 'question' => '¿Buscas fortalecer y hacer crecer tu panadería?', 'cta' => ['label' => 'Conoce Amasando tu Negocio Fortalecimiento', 'url' => '/fortalecimiento']],
        ],
        'recetario' => ['enabled' => true, 'title' => 'Amasando Recuerdos: Un recetario con historia', 'items' => $recetarioItems],
        'communityCta' => ['label' => 'Conoce más de la Comunidad Amasando Tu Negocio', 'url' => '/comunidad'],
        'seo' => [
            'title' => 'Amasando Tu Negocio | Capacitación gratuita para panaderos en México',
            'description' => 'Iniciativa de capacitación gratuita para panaderos y panaderas en todo México. Programas Fortalecimiento e Ideas, diseñados por expertos en panificación y negocios.',
            'image' => null, 'noIndex' => false,
        ],
    ]);

    doc_save('comunidad', 'comunidad', [
        'hero' => ['eyebrow' => 'Comunidad', 'logo' => null, 'title' => 'Amasando Tu Negocio', 'videoUrl' => '', 'videoFile' => null, 'poster' => $carrusel],
        'map' => $map('Encuentra tu panadería'),
        'testimonials' => ['title' => 'Testimonios', 'items' => $testimonials],
        'recetario' => ['enabled' => true, 'title' => 'Amasando Recuerdos: Un recetario con historia', 'items' => array_map(fn($i) => ['subtitle' => 'Generación'] + $i, $recetarioItems)],
        'seo' => [
            'title' => 'Comunidad | Amasando Tu Negocio',
            'description' => 'Conoce la comunidad de panaderos y panaderas de Amasando Tu Negocio: testimonios, panaderías participantes y el recetario Amasando Recuerdos.',
            'image' => null, 'noIndex' => false,
        ],
    ]);

    $filler = 'Agrega puntos clave, citas, anécdotas o una historia muy muy breve.';
    $steps = [
        ['icon' => 'form', 'title' => 'Llena el formulario de Aplicación', 'description' => 'Breve formulario de 5 minutos'],
        ['icon' => 'avatar', 'title' => 'Te contactaremos via WhatsApp ¡espera nuestro mensaje!', 'description' => 'Te estaremos buscando para darte los siguientes pasos.'],
        ['icon' => 'lock', 'title' => 'Segundo formulario', 'description' => 'Queremos conocerte y saber más de tu panadería.'],
        ['icon' => 'calendar', 'title' => 'Notificación por WhatsApp', 'description' => 'Si fuiste uno o una de los 100 seleccionados recibirás una notificación vía WhatsApp'],
    ];
    $community = ['title' => 'Conoce más sobre la comunidad Amasando Tu Negocio', 'image' => $mapa, 'cta' => ['label' => 'Ir a Comunidad', 'url' => '/comunidad']];
    $req = fn(array $l) => array_map(fn($t) => ['text' => $t], $l);

    doc_save('programa:fortalecimiento', 'programa', [
        'name' => 'Fortalecimiento', 'order' => 1,
        'hero' => ['background' => $fondo, 'logo' => null, 'title' => 'Amasando Tu Negocio', 'subtitle' => 'Fortalecimiento', 'cta' => ['label' => 'Aplica a la convocatoria Aquí', 'url' => '#convocatoria']],
        'intro' => [
            'title' => 'Amasando tu negocio Fortalecimiento es....',
            'body' => "Programa de profesionalización y fortalecimiento gratuito para dueñas y dueños de panaderías tradicionales en México.\n\nEste programa esta diseñado por expertos en pan y negocios para que las Mipymes panaderas puedan mejorar sus ventas, administrar mejor su tiempo, dirigir a su equipo y profesionalizar su negocio.\nDuración: 4 meses",
            'image' => $intro,
        ],
        'benefits' => ['title' => 'Beneficios de Participar en Amasando Tu Negocio Fortalecimiento', 'items' => [
            ['icon' => 'book', 'title' => 'Capacitación práctica', 'description' => $filler],
            ['icon' => 'users', 'title' => 'Acceso a una red de mentores y especialistas del sector panadero y de negocios', 'description' => $filler],
            ['icon' => 'heart', 'title' => 'Pertenecer a una comunidad nacional de panaderos', 'description' => $filler],
            ['icon' => 'money', 'title' => 'Posibilidad de postular a un microcrédito de hasta $30,000 MXN', 'description' => $filler],
        ]],
        'call' => [
            'title' => 'Convocatoria 2027',
            'images' => [['image' => $conv1], ['image' => $conv2]],
            'cta' => ['label' => 'Aplica a la convocatoria aquí', 'url' => '#'],
            'eligibilityTitle' => '¿Quién puede aplicar a Amasando Tu Negocio Fortalecimiento?',
            'eligibility' => $req([
                'Personas mayores de 18 años.',
                'Que radiquen en la República Mexicana.',
                'Mantener ventas activas y operación regular.',
                'Más de 1 año de operación.',
                'Ser dueño o dueña de una panadería ubicada en cualquier estado de la República mexicana.',
                'Con acceso a internet para conectarse a los talleres de manera virtual.',
                'Interés en hacer crecer tu negocio.',
            ]),
        ],
        'process' => ['title' => 'Proceso de Aplicación', 'steps' => $steps],
        'stages' => ['title' => 'Etapas del programa', 'items' => [
            ['image' => $rabanos, 'title' => 'Etapa 1: Bootcamp', 'description' => '2 semanas de talleres grupales sobre negocios y técnicas panaderas.'],
            ['image' => $cerezas, 'title' => 'Etapa 2: Mentorías Personalizadas', 'description' => '3 semanas de acompañamiento intensivo uno a uno.'],
            ['image' => $hongos, 'title' => 'Etapa 3: Gran Reto Baking Center', 'description' => 'Viaje al Baking Center de Lesaffre en Toluca durante 3 días todo pagado, para participar en el "Reto final" del programa en donde presentarás tu mini caso de negocio.'],
        ]],
        'testimonials' => ['title' => 'Testimoniales', 'items' => $testimonials],
        'community' => $community,
        'seo' => [
            'title' => 'Fortalecimiento | Amasando Tu Negocio',
            'description' => 'Programa gratuito de profesionalización para dueñas y dueños de panaderías tradicionales en México. Mejora tus ventas, tu equipo y tu negocio en 4 meses.',
            'image' => null, 'noIndex' => false,
        ],
    ], 1);

    doc_save('programa:ideas', 'programa', [
        'name' => 'Ideas', 'order' => 2,
        'hero' => ['background' => $fondo, 'logo' => null, 'title' => 'Amasando Tu Negocio', 'subtitle' => 'Ideas', 'cta' => ['label' => 'Aplica a la convocatoria Aquí', 'url' => '#convocatoria']],
        'intro' => [
            'title' => 'Amasando tu negocio IDEAS es....',
            'body' => "Programa GRATUITO y 100% en línea diseñado para ayudar a emprendedores en panadería a darle forma a su idea y conviertirla en un negocio, recibirás la guía y las herramientas necesarias para emprender con éxito.\nDuración: 3 meses",
            'image' => $intro,
        ],
        'benefits' => ['title' => 'Beneficios de Participar en Amasando Tu Negocio Ideas', 'items' => [
            ['icon' => 'book', 'title' => 'Acceso a talleres de incubación de negocios y panadería.', 'description' => $filler],
            ['icon' => 'star', 'title' => 'Acceso a recursos y materiales exclusivos.', 'description' => $filler],
            ['icon' => 'users', 'title' => 'Acceso a una red de mentores y especialistas del sector panadero y de negocios', 'description' => $filler],
            ['icon' => 'heart', 'title' => 'Pertenecer a una comunidad nacional de panaderos', 'description' => $filler],
        ]],
        'call' => [
            'title' => 'Convocatoria 2027',
            'images' => [['image' => $conv1], ['image' => $conv2]],
            'cta' => ['label' => 'Aplica a la convocatoria aquí', 'url' => '#'],
            'eligibilityTitle' => '¿Quién puede aplicar a Amasando Tu Negocio Ideas?',
            'eligibility' => $req([
                'Personas mayores de 18 años.',
                'Que radiquen en la República Mexicana.',
                'Con conocimientos básicos y pasión por la panadería.',
                'Con interés en emprender formalmente y crear su negocio de panadería.',
                'Con acceso a internet para conectarse a los talleres de manera virtual.',
            ]),
        ],
        'process' => ['title' => 'Proceso de Aplicación', 'steps' => $steps],
        'stages' => ['title' => 'Etapas del programa', 'items' => [
            ['image' => $rabanos, 'title' => 'Etapa 1: Bootcamp', 'description' => '2 semanas de talleres grupales sobre negocios y técnicas panaderas.'],
            ['image' => $cerezas, 'title' => 'Etapa 2: Mentorías Personalizadas', 'description' => '4 semanas de sesiones uno a uno para trabajar en tu modelo de negocio.'],
            ['image' => $hongos, 'title' => 'Etapa 3: Pitch Day', 'description' => '1 día de presentación de tu pitch ante un panel de expertos.'],
        ]],
        'testimonials' => ['title' => 'Testimoniales', 'items' => $testimonials],
        'community' => $community,
        'seo' => [
            'title' => 'Ideas | Amasando Tu Negocio',
            'description' => 'Programa gratuito y 100% en línea para emprendedores en panadería: convierte tu idea en un negocio con guía de expertos en 3 meses.',
            'image' => null, 'noIndex' => false,
        ],
    ], 2);

    doc_save('pagina:aviso-de-privacidad', 'pagina', [
        'title' => 'Aviso de Privacidad',
        'content' => '<p>Edita este texto desde el administrador (Páginas de texto → Aviso de Privacidad).</p>',
        'seo' => ['title' => '', 'description' => '', 'image' => null, 'noIndex' => false],
    ], 1);
    doc_save('pagina:quejas-y-sugerencias', 'pagina', [
        'title' => 'Quejas y Sugerencias',
        'content' => '<p>Edita este texto desde el administrador (Páginas de texto → Quejas y Sugerencias).</p>',
        'seo' => ['title' => '', 'description' => '', 'image' => null, 'noIndex' => false],
    ], 2);
}
