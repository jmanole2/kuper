<?php
/*
 * K-VIBE+ · Configuración del concurso
 * ------------------------------------------------------------
 * Aquí está todo lo que se cambia sin tocar código: textos, fechas, pregunta,
 * categorías, abrir/cerrar el concurso, límites, etc.
 *
 * Los SECRETOS (BD, SMTP, captcha) NO van aquí: van en app/config.local.php,
 * que no se sube al repo (copia app/config.local.sample.php).
 * Cualquier clave de este archivo se puede sobrescribir en config.local.php.
 */
return [

    // ---------- General ----------
    'debug'       => false,
    'timezone'    => 'America/Mexico_City',
    'base_url'    => 'https://k-vibe.com.mx',   // PENDIENTE: dominio elegido por el cliente
    'force_https' => true,
    'trust_cloudflare_ip' => false,            // true solo si el sitio está detrás de Cloudflare

    // ---------- Estado del concurso ----------
    // 'auto' usa las fechas de abajo. 'open' / 'closed' fuerzan el estado.
    'contest_mode' => 'auto',
    'opens_at'     => null,                    // p. ej. '2026-11-20 00:00:00' (null = abierto ya)
    'closes_at'    => '2026-12-05 00:00:00',   // vigencia según bases: 20 nov – 4 dic 2026 (cierra al terminar el 4 dic)
    'winners_announce_date' => '11 de diciembre de 2026',   // publicación de resultados según bases
    'contact_email' => 'glopez@vinter.mx',     // contacto de las bases (va en el correo de confirmación)

    // ---------- Origen del QR (?src=) ----------
    'sources'        => ['pantalla', 'redes', 'impreso'],  // extensible
    'default_source' => 'directo',

    // ---------- Textos de la landing ----------
    'texts' => [
        'site_title'    => 'K-VIBE+ · Muestra tu lado K-VIBE+ más creativo y gana',
        'meta_desc'     => 'Participa en el concurso de K-VIBE+ en el canal 564 de LG Channels. Sube tu foto, crea tu slogan y sé uno de los ganadores.',
        'channel_pill'  => 'Canal 564 · LG Channels',

        // Encabezado (diseño aprobado)
        'hero_over'  => 'Muestra tu lado',          // va sobre el logo
        'hero_pill'  => 'Más creativo y gana',      // píldora bajo el logo
        'hero_cta'   => '¡Quiero participar!',
        'nav_cta'    => 'Participar',

        // Pasos con personaje (image: archivo en public/assets/img/v3/)
        'steps_title' => 'Así se participa',
        'steps' => [
            ['image' => 'chica.webp', 'text' => 'Sube tu foto más creativa viendo K-VIBE+ en el canal 564, incorporando elementos inspirados en la cultura coreana que reflejen tu mejor K-VIBE.'],
            ['image' => 'chico.webp', 'text' => 'Además, crea un slogan original para K-VIBE+ que invite a más personas a sintonizar el canal.'],
        ],
        'claim_light' => '¡Demuestra tu creatividad',
        'claim_bold'  => 'y sé uno de los 12 ganadores!',

        'rules_title' => 'Cómo participar',
        'rules' => [
            'Vigencia: del 20 de noviembre al 4 de diciembre de 2026. Válido en toda la República Mexicana.',
            'Solo para mayores de 18 años con residencia en México.',
            'Solo se permite una participación por persona (correo y celular únicos).',
            'Tu foto debe mostrar que estás viendo K-VIBE+ en el canal 564 de LG Channels e incluir un elemento inspirado en Corea.',
            'Tu slogan debe ser original y de tu autoría. No se aceptan participaciones hechas con inteligencia artificial.',
            'Un jurado elegirá a los 12 ganadores por creatividad y originalidad.',
            'Consulta los Términos y Condiciones para conocer las bases completas.',
        ],

        'form_title' => 'Participa aquí',

        // Pregunta opcional (solo referencia interna, NO se califica)
        'category_label' => '¿Qué tipo de contenido te gustaría ver más en K-VIBE+?',

        'photo_label' => 'Tu foto creativa',
        'photo_help'  => 'Muéstranos que estás viendo K-VIBE+ en el canal 564 e incluye un elemento inspirado en Corea. JPG, PNG o WEBP.',

        // Pregunta creativa (la que califica el jurado)
        'slogan_label' => 'Crea un slogan original para K-VIBE+ que haga que la gente quiera sintonizar el canal 564.',
        'slogan_placeholder' => 'Escribe tu slogan aquí…',

        'submit' => 'Enviar mi participación',

        'thanks_title' => '¡Gracias por compartir tu K-VIBE+!',
        'thanks_text'  => 'Tu participación quedó registrada. Guarda tu folio.',

        'closed_title' => 'El concurso ha cerrado',
        'closed_text'  => 'Gracias por tu interés en K-VIBE+. Muy pronto anunciaremos a los ganadores.',
        'soon_title'   => 'Muy pronto',
        'soon_text'    => 'El concurso K-VIBE+ está por comenzar. ¡Vuelve pronto!',

        'duplicate'    => 'Ya participaste con este correo o teléfono.',
        'footer_note'  => 'K-VIBE+ en el canal 564 de LG Channels.',
    ],

    // Premios: solo se muestran si el cliente lo pide
    'show_prizes' => false,
    'prizes' => ['LG Smart TV', 'Bocinas LG XBOOM', 'Kits de skincare coreano', 'Parrillas de Korean BBQ', 'Audífonos'],

    // ---------- Formulario ----------
    // Categorías del desplegable opcional: código interno => texto mostrado.
    // El export incluye el código (en inglés) para el reporte al cliente.
    'categories' => [
        'movies'        => 'Películas',
        'entertainment' => 'Entretenimiento',
        'kpop'          => 'K-POP',
        'food'          => 'Comida',
        'beauty'        => 'Belleza',
        'travel'        => 'Viajes',
        'other'         => 'Otro',
    ],
    'category_enabled' => true,     // false = se oculta el desplegable
    'slogan_max'       => 150,      // caracteres
    'name_max'         => 80,

    // ---------- Foto ----------
    'upload' => [
        'max_bytes'   => 10 * 1024 * 1024,   // también ajustar upload_max_filesize/post_max_size (ver .user.ini)
        'max_side'    => 2400,               // px; la foto se re-codifica (quita EXIF/GPS)
        'thumb_side'  => 600,
        'jpeg_quality'=> 85,
        'client_resize_side' => 2000,        // el navegador la reduce antes de subir (menos datos móviles)
    ],

    // ---------- Legales ----------
    // url: null = se muestra app/legal/*.html; o URL externa del cliente.
    'legal' => [
        'terms'   => ['version' => 'v1-2026-11-19', 'url' => null],
        'privacy' => ['version' => 'v1-borrador', 'url' => null],
    ],

    // ---------- Verificación por correo ----------
    'verify' => [
        'code_ttl_min'    => 10,   // expira en minutos
        'max_attempts'    => 5,    // intentos de código
        'max_sends'       => 3,    // envíos (1 + 2 reenvíos)
        'resend_cooldown' => 60,   // segundos entre reenvíos
        'pending_ttl_hours' => 24, // se borran registros sin verificar
    ],

    // ---------- Límites anti-abuso ----------
    // Ojo: en México muchas líneas móviles comparten IP (CGNAT), por eso
    // el límite por IP es amplio y el de dispositivo es el estricto.
    'rate' => [
        'submit_per_device' => [5, 3600],    // [máximo, ventana en segundos]
        'submit_per_ip'     => [40, 3600],
        'verify_per_ip'     => [60, 3600],
        'login_per_ip'      => [10, 900],
    ],

    // ---------- Captcha invisible ----------
    // provider: 'turnstile' (recomendado) | 'recaptcha' (v3) | 'none' (solo pruebas)
    'captcha' => [
        'provider'  => 'turnstile',
        'site_key'  => '',
        'secret'    => '',
        'min_score' => 0.5,    // solo reCAPTCHA v3
        'fail_open' => false,  // si el servicio no responde: false = rechazar
    ],

    // ---------- Correo ----------
    // driver: 'smtp' | 'mail' (función mail() del hosting) | 'log' (pruebas: storage/logs/mail.log)
    'mail' => [
        'driver'    => 'smtp',
        'from'      => 'no-reply@k-vibe.com.mx',
        'from_name' => 'K-VIBE+',
        'smtp' => ['host' => '', 'port' => 465, 'secure' => 'ssl', 'user' => '', 'pass' => ''],
    ],

    // ---------- Base de datos ----------
    'db' => ['host' => 'localhost', 'port' => 3306, 'name' => 'kvibe', 'user' => '', 'pass' => ''],

    // ---------- Imágenes / tema ----------
    // Rutas relativas a public/. null = placeholder generado por CSS.
    'assets' => [
        'logo'          => 'assets/img/v3/logo-kvibe.webp',
        'hero_desktop'  => null,   // 1920×1080
        'hero_mobile'   => null,   // 1080×1350
        'lg_banner'     => null,   // ~1200×400 (confirmación)
        'lg_logo'       => 'assets/img/v3/lg-channels.webp',
    ],
    'theme' => [                   // ajustar con la paleta del cliente
        'bg'        => '#3a0ca3',      // violeta profundo
        'bg2'       => '#c21fd1',      // magenta
        'primary'   => '#8b3dff',      // violeta brillante
        'secondary' => '#4fd6ff',      // cian
        'accent'    => '#ff3fd2',      // rosa neón
    ],

    // ---------- Analítica (opcional) ----------
    'analytics' => ['ga4_id' => '', 'meta_pixel_id' => ''],

    // ---------- Panel (Fase 2) ----------
    'winners_count' => 12,   // confirmado en el diseño aprobado
];
